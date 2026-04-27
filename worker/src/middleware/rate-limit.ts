/**
 * FamilyDashBoard Worker — In-memory + DO-backed rate limiter (V13-EDGE-6)
 *
 * Limits each IP to MAX_REQUESTS_PER_WINDOW requests per sliding window.
 * When RATE_LIMITER_DO is bound, requests are checked via the Durable Object
 * for globally-consistent rate limiting across CF isolates.
 * Falls back to in-memory Map when the DO is unavailable.
 */

export const MAX_REQUESTS_PER_WINDOW = 120;
const WINDOW_MS = 60_000; // 1 minute

interface WindowEntry {
  count: number;
  windowStart: number;
}

const ipWindows = new Map<string, WindowEntry>();

// Minimal DO interfaces for structural typing — avoids hard dep on @cloudflare/workers-types in tests
interface DONamespace {
  idFromName(name: string): unknown;
  get(id: unknown): DOStub;
}

interface DOStub {
  fetch(request: Request): Promise<Response>;
}

/**
 * Check whether the given IP has exceeded the rate limit.
 * Returns true if the request should be blocked (rate limit exceeded).
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindows.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // Start a new window
    ipWindows.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  return false;
}

/**
 * Return how many requests this IP has remaining in their current window.
 * Returns MAX if no window exists yet (fresh IP).
 */
export function getRemainingRequests(ip: string): number {
  const now = Date.now();
  const entry = ipWindows.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) return MAX_REQUESTS_PER_WINDOW;
  return Math.max(0, MAX_REQUESTS_PER_WINDOW - entry.count);
}

/** Get the calling IP from CF-Connecting-IP or X-Forwarded-For headers. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Rate-limit response: 429 Too Many Requests. */
export function rateLimitResponse(): Response {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": "60",
      "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
      "X-RateLimit-Remaining": "0",
    },
  });
}

/** Clear all rate-limit windows (used in tests). */
export function clearRateLimitState(): void {
  ipWindows.clear();
}

/**
 * Async rate-limit check: uses DO when available for global per-client limiting,
 * falls back to in-memory on error or when DO is not bound (V13-EDGE-6).
 *
 * @param ip           - The client IP address.
 * @param doNamespace  - Optional RATE_LIMITER_DO binding from the Worker Env.
 * @returns { limited, remaining } — `limited=true` means the request should be rejected.
 */
export async function checkRateLimitAsync(
  ip: string,
  doNamespace?: DONamespace,
): Promise<{ limited: boolean; remaining: number }> {
  if (!doNamespace) {
    const limited = isRateLimited(ip);
    return { limited, remaining: getRemainingRequests(ip) };
  }

  try {
    const id = doNamespace.idFromName("rate-limiter");
    const stub = doNamespace.get(id);
    const params = new URLSearchParams({
      ip,
      max: String(MAX_REQUESTS_PER_WINDOW),
      window: String(WINDOW_MS),
    });
    const res = await stub.fetch(
      new Request(`https://rate-limiter.internal/check?${params}`, { method: "POST" }),
    );
    if (!res.ok) {
      const limited = isRateLimited(ip);
      return { limited, remaining: getRemainingRequests(ip) };
    }
    return (await res.json()) as { limited: boolean; remaining: number };
  } catch {
    const limited = isRateLimited(ip);
    return { limited, remaining: getRemainingRequests(ip) };
  }
}
