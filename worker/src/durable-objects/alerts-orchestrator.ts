/**
 * FamilyDashBoard Worker — Durable Object: AlertsOrchestrator (V12-EDGE-3, V13-EDGE-1)
 *
 * Supports SSE fan-out to connected browser clients (ADR-025).
 *
 * Routes:
 *   GET  /state      → { alarmCount, lastAlarmAt, connections }
 *   POST /alarm      → increments counter; used by scheduled cron handler
 *   GET  /subscribe  → SSE stream; clients receive `event: alert` on broadcast
 *   POST /broadcast  → fan-out JSON payload to all active SSE subscribers
 */

export class AlertsOrchestrator {
  private state: DurableObjectState;
  private alarmCount = 0;
  private lastAlarmAt: number | null = null;
  private readonly connections = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private readonly encoder = new TextEncoder();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    // owasp-allow:A05 owasp-allow:A10 — Cloudflare DO entry point
    const url = new URL(request.url);

    // GET /subscribe → open SSE stream (does not need persisted state)
    if (request.method === "GET" && url.pathname === "/subscribe") {
      return this.handleSubscribe(request);
    }

    // POST /broadcast → fan-out to all live subscribers
    if (request.method === "POST" && url.pathname === "/broadcast") {
      const body = (await request.json()) as Record<string, unknown>;
      const count = await this.broadcast(JSON.stringify(body));
      return Response.json({ ok: true, connections: count });
    }

    // Lazy-load persisted state on first request
    const stored = await this.state.storage.get<number>("alarmCount");
    if (stored !== undefined && stored !== null) {
      this.alarmCount = stored;
    }
    const storedAt = await this.state.storage.get<number>("lastAlarmAt");
    if (storedAt !== undefined && storedAt !== null) {
      this.lastAlarmAt = storedAt;
    }

    if (request.method === "GET" && url.pathname === "/state") {
      return Response.json({
        alarmCount: this.alarmCount,
        lastAlarmAt: this.lastAlarmAt,
        connections: this.connections.size,
      });
    }

    if (request.method === "POST" && url.pathname === "/alarm") {
      this.alarmCount += 1;
      this.lastAlarmAt = Date.now();
      await this.state.storage.put("alarmCount", this.alarmCount);
      await this.state.storage.put("lastAlarmAt", this.lastAlarmAt);
      return Response.json({ ok: true, alarmCount: this.alarmCount });
    }

    return new Response("Not found", { status: 404 });
  }

  /** Open an SSE stream for this subscriber. */
  private handleSubscribe(request: Request): Response {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    this.connections.add(writer);

    // Send ping to confirm the stream is open
    writer.write(this.encoder.encode("event: ping\ndata: {}\n\n")).catch(() => {
      this.connections.delete(writer);
    });

    // Remove writer when the client disconnects
    request.signal.addEventListener("abort", () => {
      void writer.close().catch(() => {});
      this.connections.delete(writer);
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  }

  /** Broadcast a JSON payload to all active subscribers. Returns live connection count. */
  private async broadcast(data: string): Promise<number> {
    const msg = this.encoder.encode(`event: alert\ndata: ${data}\n\n`);
    const dead = new Set<WritableStreamDefaultWriter<Uint8Array>>();

    await Promise.allSettled(
      [...this.connections].map(async (w) => {
        try {
          await w.write(msg);
        } catch {
          dead.add(w);
        }
      }),
    );

    for (const w of dead) this.connections.delete(w);
    return this.connections.size;
  }
}

/**
 * Minimal DurableObjectState interface — only storage methods used here.
 * The Cloudflare DurableObjectState satisfies this via structural typing.
 */
interface DurableObjectState {
  storage: DurableObjectStorage;
  readonly signal: AbortSignal;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
