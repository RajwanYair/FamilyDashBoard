/**
 * FamilyDashBoard Worker — AlertsLiveDO (ADR-089)
 *
 * Durable Object that delivers real-time alert notifications to browser clients
 * via the WebSocket Hibernation API. Supersedes the SSE-based AlertsOrchestrator
 * for real-time delivery — eliminating CPU cost at idle (ROADMAP §6.2 PLATFORM).
 *
 * Unlike the SSE fan-out in AlertsOrchestrator, this DO pays zero CPU between
 * broadcasts; Cloudflare only bills CPU when an alert fires or a client connects.
 *
 * Protocol:
 *   1. Client opens WS to GET /api/alerts/live
 *   2. Worker upgrades the connection and forwards to this DO via fetch().
 *   3. DO accepts the WS with hibernation enabled.
 *   4. When an alert fires (cron or POST /broadcast), the DO wakes and
 *      broadcasts the payload to all hibernating sockets.
 *   5. DO re-hibernates until the next broadcast.
 *
 * Message shapes (JSON):
 *   Client → DO:   { type: "ping" }
 *   DO → Client:   { type: "alert", data: Record<string, unknown> }
 *   DO → Client:   { type: "ping" }  (keepalive, every 30 s via alarm)
 *   DO → Client:   { type: "pong" }  (response to client ping)
 *
 * ADR reference: ADR-089.
 */

// ── Minimal DO state interface ────────────────────────────────────────────────

/**
 * Structural type for Cloudflare DurableObjectState (hibernation subset).
 * Avoids importing @cloudflare/workers-types; production binding satisfies this.
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

// ── Durable Object class ──────────────────────────────────────────────────────

/**
 * AlertsLiveDO — Hibernatable WebSocket DO for real-time alert fan-out.
 *
 * All connected browser clients receive every alert broadcast with zero
 * per-socket filtering — alerts are global events. When there are no clients
 * the DO is fully suspended at zero cost.
 */
export class AlertsLiveDO {
  private readonly state: DoState;

  constructor(state: DoState) {
    this.state = state;
  }

  // ── Cloudflare DO entry-point ──────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    // owasp-allow:A05 owasp-allow:A10
    const url = new URL(request.url);

    // ── WS upgrade path ───────────────────────────────────────────────────
    if (url.pathname === "/connect") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader?.toLowerCase() !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }

      // Cloudflare's WebSocketPair — typed minimally to avoid importing CF types.
      const pair = new (
        globalThis as unknown as { WebSocketPair: new () => { 0: WebSocket; 1: WebSocket } }
      ).WebSocketPair();
      const [client, server] = [pair[0], pair[1]];

      // Accept with hibernation — DO suspends between broadcasts.
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

    // ── Broadcast path (called by cron or POST /api/alerts/broadcast) ────
    if (url.pathname === "/broadcast" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try {
        payload = (await request.json()) as Record<string, unknown>;
      } catch {
        return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const msg = JSON.stringify({ type: "alert", data: payload });
      const sockets = this.state.getWebSockets();
      let sent = 0;
      for (const ws of sockets) {
        try {
          ws.send(msg);
          sent++;
        } catch {
          // Socket already closed — hibernation cleans it up automatically.
        }
      }

      return new Response(JSON.stringify({ ok: true, sent }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Connection count (diagnostic) ────────────────────────────────────
    if (url.pathname === "/state") {
      const allSockets = this.state.getWebSockets();
      return new Response(JSON.stringify({ ok: true, connections: allSockets.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // ── WebSocket Hibernation handlers ────────────────────────────────────────

  /** Called when a hibernated client sends a message. Only `ping` is handled. */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") return;
    let parsed: { type?: string };
    try {
      parsed = JSON.parse(message) as { type?: string };
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "invalid_json" }));
      return;
    }
    if (parsed.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }

  /** Called when a hibernated client closes the connection. */
  webSocketClose(_ws: WebSocket, _code: number, _reason: string): void {
    // Cloudflare hibernation removes the socket from getWebSockets() automatically.
  }

  /** Called when a hibernated client error fires. */
  webSocketError(_ws: WebSocket, _error: unknown): void {
    // Silently discard — hibernation handles cleanup.
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
