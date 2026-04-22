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
  _latencyHistory.clear();
}

// ── Sprint 163: API response time histogram per provider ─────────────────

const LATENCY_MAX_SAMPLES = 20;
const _latencyHistory = new Map<string, number[]>();

/**
 * Record a response time sample for a provider.
 * @param id - Provider identifier
 * @param ms - Response time in milliseconds
 */
export function recordProviderLatency(id: string, ms: number): void {
  let samples = _latencyHistory.get(id);
  if (!samples) {
    samples = [];
    _latencyHistory.set(id, samples);
  }
  samples.push(Math.round(ms * 10) / 10);
  if (samples.length > LATENCY_MAX_SAMPLES) samples.shift();
}

/**
 * Get latency history for a provider.
 */
export function getProviderLatency(id: string): readonly number[] {
  return _latencyHistory.get(id) ?? [];
}

/**
 * Get all provider latency histories.
 */
export function getAllProviderLatencies(): ReadonlyMap<string, readonly number[]> {
  return _latencyHistory;
}

// ── Sprint 96: Backoff policy ────────────────────────────────────────────

/**
 * Compute the recommended backoff delay in milliseconds for a provider.
 *
 * Returns 0 when no backoff is needed (status === "ok").
 * Uses capped exponential backoff: `baseMs * 2^(consecutiveFails - 1)`,
 * capped at `maxMs`.
 *
 * @param id     Provider identifier
 * @param baseMs Base delay (default 2 000 ms)
 * @param maxMs  Maximum delay cap (default 60 000 ms = 1 min)
 */
export function getBackoffMs(id: string, baseMs = 2_000, maxMs = 60_000): number {
  const h = _ensure(id);
  if (h.consecutiveFails === 0) return 0;
  return Math.min(baseMs * Math.pow(2, h.consecutiveFails - 1), maxMs);
}

/**
 * Returns `true` when a provider should skip fetching due to backoff.
 * Compares the time since the last failure against `getBackoffMs()`.
 *
 * NOTE: Requires the caller to pass the timestamp of the last attempt.
 * If no timestamp is available, default to allowing the fetch.
 */
export function shouldBackoff(
  id: string,
  lastAttemptMs: number,
  baseMs = 2_000,
  maxMs = 60_000,
): boolean {
  const delay = getBackoffMs(id, baseMs, maxMs);
  if (delay === 0) return false;
  return Date.now() - lastAttemptMs < delay;
}
