/**
 * FamilyDashBoard — Provider "blocked-by-network" Toast
 *
 * Sprint 136 (Roadmap V14-RESILIENCE): when a provider transitions from
 * "ok"/"degraded" to "down" (3+ consecutive failures with no stale fallback),
 * surface a single, rate-limited toast so the user knows _which_ card is
 * silent because the corp proxy / hostile network blocked it — instead of
 * watching a perpetual "Loading…" spinner.
 *
 * Design notes:
 *  - One toast per provider per `RATE_LIMIT_MS` window (default: 10 minutes).
 *  - Pure side-effect module — caller (provider-adapter) decides _when_ to
 *    notify; this module decides _whether_ to actually surface it.
 *  - No DOM in tests: `showToast` itself is a no-op when `#toast` is missing.
 */

import { showToast } from "../ui/toast";

const RATE_LIMIT_MS = 10 * 60 * 1000;

const _lastNotifyAt = new Map<string, number>();

/**
 * Notify the user that a provider appears blocked by the network. Rate-limited
 * to one toast per `providerId` per 10-minute window.
 *
 * Caller responsibility: only invoke when (a) the provider has just flipped to
 * `down` AND (b) no stale cache fallback was served (otherwise the UX is fine).
 */
export function notifyProviderBlocked(
  providerId: string,
  displayName: string,
  now: number = Date.now(),
): boolean {
  const last = _lastNotifyAt.get(providerId);
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    return false;
  }
  _lastNotifyAt.set(providerId, now);
  // Hebrew RTL message — terse, non-blocking.
  showToast(`⚠️ ${displayName}: חסום ע"י הרשת`, 5000);
  return true;
}

/**
 * Reset the rate-limit window. Test-only.
 * @internal
 */
export function _resetProviderToast(): void {
  _lastNotifyAt.clear();
}
