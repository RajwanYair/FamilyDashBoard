/**
 * Canary traffic tagging middleware (V12-EDGE-4b ).
 *
 * When the CANARY_PCT Worker variable is set to a number between 1 and 100,
 * a deterministic fraction of responses receives the `X-Canary: true` header.
 * This allows Cloudflare Load Balancing or external monitoring to identify
 * canary-tagged responses for staged rollout validation.
 *
 * Decision:
 *   - Random sampling: Math.random() * 100 < pct
 *   - Deterministic within a request, not across requests (stateless Worker).
 *   - No-op when CANARY_PCT is absent, "0", or not a valid integer.
 *   - Never throws — header injection is best-effort.
 */

/**
 * Return true if this request should be tagged as a canary response.
 *
 * @param canaryPct - The CANARY_PCT env var value (e.g. "10" for 10%).
 * @returns true when a random roll falls within the canary percentage.
 */
export function shouldTagCanary(canaryPct: string | undefined): boolean {
  if (!canaryPct) return false;
  const pct = parseInt(canaryPct, 10);
  if (isNaN(pct) || pct <= 0) return false;
  if (pct >= 100) return true;
  return Math.random() * 100 < pct;
}

/**
 * Inject the `X-Canary: true` header onto a Response when the canary roll passes.
 * Returns the (possibly mutated) Response unchanged when the roll fails.
 *
 * @param response   - The Hono/fetch Response object.
 * @param canaryPct  - The CANARY_PCT env var value.
 */
export function applyCanaryHeader(response: Response, canaryPct: string | undefined): void {
  if (shouldTagCanary(canaryPct)) {
    try {
      response.headers.set("X-Canary", "true");
    } catch {
      // Headers may be immutable in some environments — silently skip.
    }
  }
}
