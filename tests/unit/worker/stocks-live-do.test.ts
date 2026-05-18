/**
 * Tests for worker/src/durable-objects/stocks-live-do.ts
 *
 * Uses a minimal in-process stub for DoState (WebSocket Hibernation API)
 * to verify connection handling, price push fan-out, message dispatch,
 * alarm keepalive, and diagnostic state endpoint.
 */

import { describe, it, expect, vi } from "vitest";
import { StocksLiveDO } from "../../../worker/src/durable-objects/stocks-live-do";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

interface StubWS {
  sent: string[];
  closed: { code: number; reason: string } | null;
  send(msg: string): void;
  close(code: number, reason: string): void;
  _tags: string[];
}

function makeWS(tags: string[] = []): StubWS {
  const ws: StubWS = {
    sent: [],
    closed: null,
    _tags: tags,
    send(msg) {
      this.sent.push(msg);
    },
    close(code, reason) {
      this.closed = { code, reason };
    },
  };
  return ws;
}

let _alarmTime: number | null = null;
const _sockets: StubWS[] = [];

function makeDoState() {
  return {
    acceptWebSocket(ws: WebSocket, tags?: string[]) {
      const stub = ws as unknown as StubWS;
      stub._tags = tags ?? [];
      _sockets.push(stub);
    },
    getWebSockets(tag?: string): WebSocket[] {
      if (tag === undefined) return _sockets as unknown as WebSocket[];
      return _sockets.filter((s) => s._tags.includes(tag)) as unknown as WebSocket[];
    },
    storage: {
      getAlarm: async () => _alarmTime,
      setAlarm: async (t: number) => {
        _alarmTime = t;
      },
      deleteAlarm: async () => {
        _alarmTime = null;
      },
    },
  };
}

/** Minimal WebSocketPair stub — wires server into sockets[] list on acceptWebSocket. */
function installWebSocketPair(server: StubWS, client: StubWS) {
  // Patch globalThis.WebSocketPair for this call only
  const WsPair = function (this: { 0: StubWS; 1: StubWS }) {
    this[0] = client;
    this[1] = server;
  };
  (globalThis as unknown as Record<string, unknown>)["WebSocketPair"] = WsPair;
}

function makeConnectRequest(): Request {
  const req = new Request("https://do/connect", { method: "GET" });
  // happy-dom strips the Upgrade header (forbidden request header in Fetch spec).
  // Override the headers getter so the DO can read it in the unit test.
  const original = req.headers;
  Object.defineProperty(req, "headers", {
    get() {
      return {
        get(name: string) {
          if (name.toLowerCase() === "upgrade") return "websocket";
          return original.get(name);
        },
      };
    },
  });
  return req;
}

function makePushRequest(batch: object[]): Request {
  return new Request("https://do/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
}

// ── Tests: fetch() routes ─────────────────────────────────────────────────────

describe("StocksLiveDO.fetch()", () => {
  it("rejects /connect without Upgrade header (426)", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const do_ = new StocksLiveDO(makeDoState());
    const res = await do_.fetch(new Request("https://do/connect"));
    expect(res.status).toBe(426);
  });

  it("returns 101 for valid WS upgrade, schedules alarm", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const server = makeWS();
    const client = makeWS();
    installWebSocketPair(server, client);
    const do_ = new StocksLiveDO(makeDoState());
    const res = await do_.fetch(makeConnectRequest());
    expect(res.status).toBe(101);
    expect(_alarmTime).not.toBeNull(); // alarm scheduled
  });

  it("does not reset alarm if already set", async () => {
    _sockets.length = 0;
    _alarmTime = 99999999;
    const server = makeWS();
    const client = makeWS();
    installWebSocketPair(server, client);
    const state = makeDoState();
    const setSpy = vi.spyOn(state.storage, "setAlarm");
    const do_ = new StocksLiveDO(state);
    await do_.fetch(makeConnectRequest());
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("POST /push fans out tick to tagged sockets", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const aapl = makeWS(["sym:AAPL"]);
    const msft = makeWS(["sym:MSFT"]);
    _sockets.push(aapl, msft);

    const do_ = new StocksLiveDO(makeDoState());
    const res = await do_.fetch(
      makePushRequest([{ symbol: "AAPL", price: 185.42, changePercent: 0.5, ts: 1000 }]),
    );
    const body = (await res.json()) as { ok: boolean; sent: number };
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(1);
    expect(aapl.sent).toHaveLength(1);
    expect(JSON.parse(aapl.sent[0])).toMatchObject({ type: "tick", symbol: "AAPL", price: 185.42 });
    expect(msft.sent).toHaveLength(0);
  });

  it("POST /push with invalid JSON returns 400", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const do_ = new StocksLiveDO(makeDoState());
    const res = await do_.fetch(
      new Request("https://do/push", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("GET /state returns connection count", async () => {
    _sockets.length = 0;
    _sockets.push(makeWS(), makeWS());
    const do_ = new StocksLiveDO(makeDoState());
    const res = await do_.fetch(new Request("https://do/state"));
    const body = (await res.json()) as { ok: boolean; connections: number };
    expect(body.ok).toBe(true);
    expect(body.connections).toBe(2);
  });

  it("returns 404 for unknown route", async () => {
    _sockets.length = 0;
    const do_ = new StocksLiveDO(makeDoState());
    const res = await do_.fetch(new Request("https://do/unknown"));
    expect(res.status).toBe(404);
  });
});

// ── Tests: webSocketMessage() ─────────────────────────────────────────────────

describe("StocksLiveDO.webSocketMessage()", () => {
  it("responds pong to ping message", () => {
    _sockets.length = 0;
    const do_ = new StocksLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ type: "ping" }));
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "pong" });
  });

  it("closes socket on subscribe (resubscribe pattern)", () => {
    _sockets.length = 0;
    const do_ = new StocksLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(
      ws as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", symbols: ["AAPL"] }),
    );
    expect(ws.closed).toMatchObject({ code: 1000, reason: "resubscribe" });
  });

  it("sends error on invalid JSON", () => {
    _sockets.length = 0;
    const do_ = new StocksLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(ws as unknown as WebSocket, "{bad json");
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "error" });
  });

  it("ignores ArrayBuffer messages (no crash)", () => {
    _sockets.length = 0;
    const do_ = new StocksLiveDO(makeDoState());
    const ws = makeWS();
    expect(() =>
      do_.webSocketMessage(ws as unknown as WebSocket, new ArrayBuffer(4)),
    ).not.toThrow();
    expect(ws.sent).toHaveLength(0);
  });
});

// ── Tests: alarm() ────────────────────────────────────────────────────────────

describe("StocksLiveDO.alarm()", () => {
  it("sends ping to all connected sockets and reschedules", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const ws1 = makeWS();
    const ws2 = makeWS();
    _sockets.push(ws1, ws2);

    const do_ = new StocksLiveDO(makeDoState());
    await do_.alarm();

    expect(ws1.sent).toHaveLength(1);
    expect(JSON.parse(ws1.sent[0])).toMatchObject({ type: "ping" });
    expect(ws2.sent).toHaveLength(1);
    expect(_alarmTime).not.toBeNull(); // rescheduled
  });

  it("deletes alarm and does not ping when no clients", async () => {
    _sockets.length = 0;
    _alarmTime = 12345;

    const do_ = new StocksLiveDO(makeDoState());
    await do_.alarm();

    expect(_alarmTime).toBeNull(); // alarm deleted
  });
});
