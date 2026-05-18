/**
 * Tests for worker/src/durable-objects/alerts-live-do.ts
 *
 * Uses a minimal in-process stub for DoState (WebSocket Hibernation API)
 * to verify connection handling, global broadcast fan-out, message dispatch,
 * alarm keepalive, and diagnostic state endpoint.
 */

import { describe, it, expect, vi } from "vitest";
import { AlertsLiveDO } from "../../../worker/src/durable-objects/alerts-live-do";

// ── Minimal stubs ─────────────────────────────────────────────────────────────

interface StubWS {
  sent: string[];
  send(msg: string): void;
}

function makeWS(): StubWS {
  return {
    sent: [],
    send(msg) {
      this.sent.push(msg);
    },
  };
}

let _alarmTime: number | null = null;
const _sockets: StubWS[] = [];

function makeDoState() {
  return {
    acceptWebSocket(ws: WebSocket) {
      _sockets.push(ws as unknown as StubWS);
    },
    getWebSockets(): WebSocket[] {
      return _sockets as unknown as WebSocket[];
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

/** Install a minimal WebSocketPair stub that wires server into _sockets[] on acceptWebSocket. */
function installWebSocketPair(server: StubWS, client: StubWS) {
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

function makeBroadcastRequest(payload: object): Request {
  return new Request("https://do/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ── Tests: fetch() routes ─────────────────────────────────────────────────────

describe("AlertsLiveDO.fetch()", () => {
  it("rejects /connect without Upgrade header (426)", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(new Request("https://do/connect"));
    expect(res.status).toBe(426);
  });

  it("returns 101 for valid WS upgrade and schedules alarm", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const server = makeWS();
    const client = makeWS();
    installWebSocketPair(server, client);
    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(makeConnectRequest());
    expect(res.status).toBe(101);
    expect(_alarmTime).not.toBeNull();
  });

  it("does not reset alarm if already set", async () => {
    _sockets.length = 0;
    _alarmTime = 99999999;
    const server = makeWS();
    const client = makeWS();
    installWebSocketPair(server, client);
    const state = makeDoState();
    const setSpy = vi.spyOn(state.storage, "setAlarm");
    const do_ = new AlertsLiveDO(state);
    await do_.fetch(makeConnectRequest());
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("POST /broadcast fans out alert to ALL connected sockets", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const ws1 = makeWS();
    const ws2 = makeWS();
    const ws3 = makeWS();
    _sockets.push(ws1, ws2, ws3);

    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(makeBroadcastRequest({ event: "tzeva_adom", city: "Tel Aviv" }));
    const body = (await res.json()) as { ok: boolean; sent: number };
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(3);
    for (const ws of [ws1, ws2, ws3]) {
      expect(ws.sent).toHaveLength(1);
      const msg = JSON.parse(ws.sent[0]) as { type: string; data: Record<string, unknown> };
      expect(msg.type).toBe("alert");
      expect(msg.data).toMatchObject({ event: "tzeva_adom", city: "Tel Aviv" });
    }
  });

  it("POST /broadcast with no sockets returns sent=0", async () => {
    _sockets.length = 0;
    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(makeBroadcastRequest({ event: "test" }));
    const body = (await res.json()) as { ok: boolean; sent: number };
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(0);
  });

  it("POST /broadcast with invalid JSON returns 400", async () => {
    _sockets.length = 0;
    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(
      new Request("https://do/broadcast", { method: "POST", body: "not-json" }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("invalid_json");
  });

  it("POST /broadcast skips dead sockets without throwing", async () => {
    _sockets.length = 0;
    const dead: StubWS = {
      sent: [],
      send() {
        throw new Error("socket closed");
      },
    };
    const live = makeWS();
    _sockets.push(dead, live);

    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(makeBroadcastRequest({ event: "test" }));
    const body = (await res.json()) as { ok: boolean; sent: number };
    // dead socket threw — only live socket counted
    expect(body.ok).toBe(true);
    expect(body.sent).toBe(1);
    expect(live.sent).toHaveLength(1);
  });

  it("GET /state returns connection count", async () => {
    _sockets.length = 0;
    _sockets.push(makeWS(), makeWS());
    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(new Request("https://do/state"));
    const body = (await res.json()) as { ok: boolean; connections: number };
    expect(body.ok).toBe(true);
    expect(body.connections).toBe(2);
  });

  it("returns 404 for unknown route", async () => {
    _sockets.length = 0;
    const do_ = new AlertsLiveDO(makeDoState());
    const res = await do_.fetch(new Request("https://do/unknown"));
    expect(res.status).toBe(404);
  });
});

// ── Tests: webSocketMessage() ─────────────────────────────────────────────────

describe("AlertsLiveDO.webSocketMessage()", () => {
  it("responds pong to ping message", () => {
    const do_ = new AlertsLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ type: "ping" }));
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "pong" });
  });

  it("responds error to invalid JSON", () => {
    const do_ = new AlertsLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(ws as unknown as WebSocket, "not-json");
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toMatchObject({ type: "error", error: "invalid_json" });
  });

  it("ignores ArrayBuffer messages without throwing", () => {
    const do_ = new AlertsLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(ws as unknown as WebSocket, new ArrayBuffer(4));
    expect(ws.sent).toHaveLength(0);
  });

  it("ignores unknown message types without sending", () => {
    const do_ = new AlertsLiveDO(makeDoState());
    const ws = makeWS();
    do_.webSocketMessage(ws as unknown as WebSocket, JSON.stringify({ type: "unknown" }));
    expect(ws.sent).toHaveLength(0);
  });
});

// ── Tests: webSocketClose / webSocketError ────────────────────────────────────

describe("AlertsLiveDO.webSocketClose() and webSocketError()", () => {
  it("webSocketClose does not throw", () => {
    const do_ = new AlertsLiveDO(makeDoState());
    const ws = makeWS();
    expect(() => do_.webSocketClose(ws as unknown as WebSocket, 1000, "normal")).not.toThrow();
  });

  it("webSocketError does not throw", () => {
    const do_ = new AlertsLiveDO(makeDoState());
    const ws = makeWS();
    expect(() => do_.webSocketError(ws as unknown as WebSocket, new Error("test"))).not.toThrow();
  });
});

// ── Tests: alarm() ────────────────────────────────────────────────────────────

describe("AlertsLiveDO.alarm()", () => {
  it("sends ping to all connected sockets and reschedules", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const ws1 = makeWS();
    const ws2 = makeWS();
    _sockets.push(ws1, ws2);

    const state = makeDoState();
    const do_ = new AlertsLiveDO(state);
    await do_.alarm();

    expect(ws1.sent).toHaveLength(1);
    expect(ws2.sent).toHaveLength(1);
    expect(JSON.parse(ws1.sent[0])).toMatchObject({ type: "ping" });
    expect(_alarmTime).not.toBeNull();
    expect(_alarmTime).toBeGreaterThan(Date.now() + 25_000);
  });

  it("deletes alarm when no sockets are connected", async () => {
    _sockets.length = 0;
    _alarmTime = 12345;
    const do_ = new AlertsLiveDO(makeDoState());
    await do_.alarm();
    expect(_alarmTime).toBeNull();
  });

  it("continues sending to live sockets when one throws", async () => {
    _sockets.length = 0;
    _alarmTime = null;
    const dead: StubWS = {
      sent: [],
      send() {
        throw new Error("closed");
      },
    };
    const live = makeWS();
    _sockets.push(dead, live);

    const do_ = new AlertsLiveDO(makeDoState());
    await expect(do_.alarm()).resolves.not.toThrow();
    expect(live.sent).toHaveLength(1);
    expect(JSON.parse(live.sent[0])).toMatchObject({ type: "ping" });
  });
});
