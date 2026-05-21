/**
 * FamilyDashBoard — Provider "blocked-by-network" Toast
 *
 * when a provider transitions from
 * "ok"/"degraded" to "down" (3+ consecutive failures with no stale fallback),
 * surface a single, rate-limited toast so the user knows _which_ card is
 * silent because the corp proxy / hostile network blocked it — instead of
 * watching a perpetual "Loading…" spinner.
 *
 * Also surfaces a degradation toast when a provider first flips to "degraded".
 *
 * Design notes:
 *  - One toast per provider per `RATE_LIMIT_MS` window (default: 10 minutes).
 *  - Pure side-effect module — caller (provider-adapter) decides _when_ to
 *    notify; this module decides _whether_ to actually surface it.
 *  - No DOM in tests: `showToast` itself is a no-op when `#toast` is missing.
 */

import { showToast } from "../ui/toast";
import { nowMs } from "./temporal";
import { onProviderStatusChange } from "./provider";
import type { ProviderStatus } from "./provider";

const RATE_LIMIT_MS = 10 * 60 * 1000;

const _lastNotifyAt = new Map<string, number>();

// Track whether each provider was previously non-ok so recovery toasts only
// fire when the provider actually came back from a real degraded/down state.
const _wasNonOk = new Set<string>();

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
  now: number = nowMs(),
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
 * Notify the user that a provider has degraded. Rate-limited per provider.
 */
export function notifyProviderDegraded(providerId: string, now: number = nowMs()): boolean {
  const key = `${providerId}:degraded`;
  const last = _lastNotifyAt.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    return false;
  }
  _lastNotifyAt.set(key, now);
  showToast(`🟡 ${providerId}: מגיב באיטיות`, 4000);
  return true;
}

/**
 * Notify the user that a provider has recovered from degraded or down state.
 * Rate-limited per provider. Only shown when previous status was non-ok.
 */
export function notifyProviderRecovered(providerId: string, now: number = nowMs()): boolean {
  const key = `${providerId}:recovered`;
  const last = _lastNotifyAt.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    return false;
  }
  _lastNotifyAt.set(key, now);
  showToast(`✅ ${providerId}: חזר לתקינות`, 3500);
  return true;
}

/**
 * Wire the automatic degradation + recovery toast listener.
 * Call once during app init.
 */
export function initProviderDegradationToasts(): void {
  onProviderStatusChange((id: string, newStatus: ProviderStatus) => {
    if (newStatus === "degraded") {
      _wasNonOk.add(id);
      notifyProviderDegraded(id);
    } else if (newStatus === "down") {
      _wasNonOk.add(id);
      notifyProviderBlocked(id, id);
    } else if (newStatus === "ok" && _wasNonOk.has(id)) {
      _wasNonOk.delete(id);
      notifyProviderRecovered(id);
    }
  });
}

/**
 * Reset the rate-limit window. Test-only.
 * @internal
 */
export function _resetProviderToast(): void {
  _lastNotifyAt.clear();
  _wasNonOk.clear();
}
