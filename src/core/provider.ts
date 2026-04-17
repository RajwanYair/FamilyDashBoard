/**
 * FamilyDashBoard v7.14 — Provider Health Model (Sprint 45)
 *
 * Lightweight per-provider health tracking: success/failure counters,
 * backoff state, and last-ok timestamp. Not a circuit breaker — just
 * enough signal for diagnostics and degraded-state UX decisions.
 *
 * Usage:
 *   recordSuccess("open-meteo");
 *   recordProviderFailure("open-meteo");
 *   const health = getProviderHealth("open-meteo");
 *   // { id, successCount, failureCount, lastOkAt, consecutiveFails, status }
 */

export type ProviderStatus = "ok" | "degraded" | "down";

export interface ProviderHealth {
  /** Provider identifier (e.g. "open-meteo", "yahoo-finance"). */
  id: string;
  /** Total successful fetches since session start. */
  successCount: number;
  /** Total failed fetches since session start. */
  failureCount: number;
  /** ISO timestamp of last successful response, or null. */
  lastOkAt: string | null;
  /** Number of failures since the last success (reset on success). */
  consecutiveFails: number;
  /**
   * Derived status:
   *   ok        — last attempt succeeded, or consecutiveFails === 0
   *   degraded  — 1–2 consecutive failures
   *   down      — 3+ consecutive failures
   */
  status: ProviderStatus;
}

const _health = new Map<string, ProviderHealth>();

function _ensure(id: string): ProviderHealth {
  let h = _health.get(id);
  if (!h) {
    h = {
      id,
      successCount: 0,
      failureCount: 0,
      lastOkAt: null,
      consecutiveFails: 0,
      status: "ok",
    };
    _health.set(id, h);
  }
  return h;
}

function _computeStatus(consecutiveFails: number): ProviderStatus {
  if (consecutiveFails === 0) return "ok";
  if (consecutiveFails <= 2) return "degraded";
  return "down";
}

/**
 * Record a successful provider response.
 * @param id - Provider identifier
 */
export function recordProviderSuccess(id: string): void {
  const h = _ensure(id);
  h.successCount++;
  h.consecutiveFails = 0;
  h.lastOkAt = new Date().toISOString();
  h.status = "ok";
}

/**
 * Record a failed provider response.
 * @param id - Provider identifier
 */
export function recordProviderFailure(id: string): void {
  const h = _ensure(id);
  h.failureCount++;
  h.consecutiveFails++;
  h.status = _computeStatus(h.consecutiveFails);
}

/**
 * Get current health snapshot for a provider.
 * Returns a default "ok" record if the provider has never been recorded.
 * @param id - Provider identifier
 */
export function getProviderHealth(id: string): ProviderHealth {
  return { ..._ensure(id) };
}

/**
 * Get health snapshots for all known providers.
 */
export function getAllProviderHealth(): ProviderHealth[] {
  return Array.from(_health.values()).map((h) => ({ ...h }));
}

/**
 * Reset health records. Intended for testing only.
 * @internal
 */
export function _resetProviderHealth(): void {
  _health.clear();
}
