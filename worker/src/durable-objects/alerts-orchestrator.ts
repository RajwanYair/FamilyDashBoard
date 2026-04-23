/**
 * FamilyDashBoard Worker — Durable Object stub: AlertsOrchestrator (V12-EDGE-3)
 *
 * This is a minimal stub that satisfies the Durable Objects API contract.
 * Full SSE fan-out implementation is deferred to v12.2 (ADR-025).
 *
 * Current behaviour:
 *   - Stores a counter of how many times it has been alarmed.
 *   - GET /state  → returns { alarmCount, lastAlarmAt }
 *   - POST /alarm → increments counter (used by the scheduled alarm handler)
 *
 * The DO is bound in wrangler.toml as `ALERTS_DO` but is not yet wired to
 * a live endpoint in index.ts — the binding is declared for type safety and
 * to allow incremental integration without a breaking schema change.
 *
 * See ADR-025 for the full SSE design and migration path.
 */

export class AlertsOrchestrator {
  private state: DurableObjectState;
  private alarmCount = 0;
  private lastAlarmAt: number | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

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
      return Response.json({ alarmCount: this.alarmCount, lastAlarmAt: this.lastAlarmAt });
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
}

/**
 * Minimal DurableObjectState interface — only storage methods used here.
 * The Cloudflare DurableObjectState satisfies this via structural typing.
 */
interface DurableObjectState {
  storage: DurableObjectStorage;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
