/**
 * FamilyDashBoard Worker — RateLimiterDO: DO-backed sliding-window rate limiter (V13-EDGE-6)
 *
 * Replaces per-isolate in-memory state with a globally-consistent Durable Object.
 * A single DO instance ("rate-limiter") serialises all check requests, eliminating
 * race conditions across CF isolates at the cost of one extra DO round-trip per request.
 *
 * Route:
 *   POST /check?ip=<ip>&max=<n>&window=<ms>
 *   → 200 { limited: boolean; remaining: number }
 */

export class RateLimiterDO {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/check") {
      const ip = url.searchParams.get("ip") ?? "unknown";
      const max = parseInt(url.searchParams.get("max") ?? "120", 10);
      const windowMs = parseInt(url.searchParams.get("window") ?? "60000", 10);

      const now = Date.now();
      const key = `rl:${ip}`;
      const entry = await this.state.storage.get<{ count: number; windowStart: number }>(key);

      if (!entry || now - entry.windowStart > windowMs) {
        await this.state.storage.put(key, { count: 1, windowStart: now });
        return Response.json({ limited: false, remaining: max - 1 });
      }

      entry.count++;
      if (entry.count > max) {
        return Response.json({ limited: true, remaining: 0 });
      }

      await this.state.storage.put(key, entry);
      return Response.json({ limited: false, remaining: Math.max(0, max - entry.count) });
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
