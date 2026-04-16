/**
 * FamilyDashBoard Worker — In-memory rate limiter
 *
 * Limits each IP to MAX_REQUESTS_PER_WINDOW requests per sliding window.
 * Uses a simple Map with timestamp-based eviction (no Cloudflare KV required).
 *
 * Note: In-memory state is per-isolate. For true global rate limiting,
 * replace the Map with a Cloudflare KV or Durable Object counter.
 */

export const MAX_REQUESTS_PER_WINDOW = 120;
const WINDOW_MS = 60_000; // 1 minute

interface WindowEntry {
  count: number;
  windowStart: number;
}

const ipWindows = new Map<string, WindowEntry>();

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
