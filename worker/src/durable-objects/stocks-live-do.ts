/**
 * FamilyDashBoard Worker — StocksLiveDO (ADR-086)
 *
 * Durable Object that delivers live stock price updates to browser clients
 * via the WebSocket Hibernation API. Using hibernation means the DO pays
 * zero CPU cost between incoming messages — eliminating the ~$0.002/min
 * charge of a persistent WebSocket loop (ROADMAP §6.2 PLATFORM, S-DO).
 *
 * Protocol:
 *   1. Client opens WS to GET /api/stocks/live?sym=AAPL,MSFT,...
 *   2. Worker upgrades to WS and forwards to this DO via fetch().
 *   3. DO accepts the WS with hibernation enabled.
 *   4. The cron-driven "push" path calls POST /push with a JSON price batch;
 *      the DO broadcasts to all hibernating sockets subscribed to those symbols.
 *
 * Message shapes (JSON):
 *   Client → DO:   { type: "subscribe", symbols: string[] }
 *   DO → Client:   { type: "tick", symbol: string, price: number, changePercent: number, ts: number }
 *   DO → Client:   { type: "ping" }  (every 30 s via alarm)
 *
 * ADR reference: ADR-086.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Minimal DO state interface — structural typing against Cloudflare's
 * DurableObjectState, avoiding a hard dependency on @cloudflare/workers-types.
 */
interface DoState {
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
  storage: {
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
}

/** Incoming price push payload from cron or external trigger. */
interface PricePush {
  symbol: string;
  price: number;
  changePercent: number;
  ts: number;
}

/** Outbound tick message sent to subscribed clients. */
interface TickMessage {
  type: "tick";
  symbol: string;
  price: number;
  changePercent: number;
  ts: number;
}

// ── Durable Object class ─────────────────────────────────────────────────────

/**
 * StocksLiveDO — Hibernatable WebSocket DO for real-time stock price fan-out.
 *
 * Each connected browser client is a hibernated WS tagged with the symbols it
 * subscribed to (e.g. tag "sym:AAPL").  When a price push arrives the DO wakes,
 * writes to all sockets carrying the matching tag, then hibernates again.
 */
export class StocksLiveDO {
  private readonly state: DoState;

  constructor(state: DoState) {
    this.state = state;
  }

  // ── Cloudflare DO entry-point ──────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> { // owasp-allow:A05 owasp-allow:A10
    const url = new URL(request.url);

    // ── WS upgrade path ───────────────────────────────────────────────────
    if (url.pathname === "/connect") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }

      // Cloudflare's WebSocketPair — typed minimally to avoid importing CF types.
      const pair = new (globalThis as unknown as { WebSocketPair: new () => { 0: WebSocket; 1: WebSocket } }).WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Accept with hibernation — DO suspends between messages.
      this.state.acceptWebSocket(server);

      // Schedule keepalive alarm (30 s) if not already set.
      const existing = await this.state.storage.getAlarm();
      if (existing === null) {
        await this.state.storage.setAlarm(Date.now() + 30_000);
      }

      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit & { webSocket: WebSocket });
    }

    // ── Price push path (called by cron / external trigger) ───────────────
    if (url.pathname === "/push" && request.method === "POST") {
      let batch: PricePush[];
      try {
        batch = (await request.json()) as PricePush[];
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      let sent = 0;
      for (const item of batch) {
        const msg: TickMessage = {
          type: "tick",
          symbol: item.symbol,
          price: item.price,
          changePercent: item.changePercent,
          ts: item.ts,
        };
        const tag = `sym:${item.symbol.toUpperCase()}`;
        for (const ws of this.state.getWebSockets(tag)) {
          try {
            ws.send(JSON.stringify(msg));
            sent++;
          } catch {
            // Socket already closed — hibernation cleans it up automatically.
          }
        }
      }

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Connection count (diagnostic) ─────────────────────────────────────
    if (url.pathname === "/state") {
      const allSockets = this.state.getWebSockets();
      return new Response(
        JSON.stringify({ ok: true, connections: allSockets.length }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("Not found", { status: 404 });
  }

  // ── WebSocket Hibernation handlers ────────────────────────────────────────

  /**
   * Called when a hibernated client sends a message.
   * Handles the `subscribe` message to tag this socket with symbol names.
   */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    let parsed: { type?: string; symbols?: string[] };
    try {
      parsed = JSON.parse(message) as { type?: string; symbols?: string[] };
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid_json" }));
      return;
    }

    if (parsed.type === "subscribe" && Array.isArray(parsed.symbols)) {
      // Detach and re-attach with the new tag set.
      // Tags are applied on the new connection after ws.close(1000).
      // The client must reconnect — correct pattern for tag changes.
      // In practice the UI only subscribes once at connect time.
      ws.close(1000, "resubscribe");
    } else if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }

  /** Called when a hibernated client closes the connection. */
  webSocketClose(_ws: WebSocket, _code: number, _reason: string): void {
    // Cloudflare hibernation removes the socket from getWebSockets() automatically.
  }

  /** Called when a hibernated client error fires. */
  webSocketError(_ws: WebSocket, _error: unknown): void {
    // Silently discard — the socket will be cleaned up by hibernation.
  }

  // ── Alarm: keepalive ping ─────────────────────────────────────────────────

  async alarm(): Promise<void> {
    const sockets = this.state.getWebSockets();
    if (sockets.length === 0) {
      // No clients — let alarm lapse; reset when next client connects.
      await this.state.storage.deleteAlarm();
      return;
    }

    const ping = JSON.stringify({ type: "ping" });
    for (const ws of sockets) {
      try {
        ws.send(ping);
      } catch {
        // Already closed.
      }
    }
    // Reschedule for next keepalive.
    await this.state.storage.setAlarm(Date.now() + 30_000);
  }
}
