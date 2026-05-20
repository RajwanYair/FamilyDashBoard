/**
 * FamilyDashBoard — Refresh-Rate Governor (TRMNL harvest)
 *
 * Prevents unnecessary DOM repaints on always-on displays by tracking
 * a lightweight content hash per card. When the fetched payload is
 * identical to the last rendered payload, the render pass is skipped.
 *
 * Usage:
 *   if (shouldSkipRender("weather", jsonPayload)) return;
 *   // … expensive DOM update …
 *   markRendered("weather", jsonPayload);
 */

// ── Content fingerprint (FNV-1a 32-bit) ─────────────────────────────────────

function fnv1a32(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// ── State ────────────────────────────────────────────────────────────────────

const _lastHash = new Map<string, number>();
const _lastRenderMs = new Map<string, number>();
const _renderCount = new Map<string, number>();
const _skipCount = new Map<string, number>();

// S56: Adaptive interval — consecutive unchanged fetches extend the next interval.
const _consecutiveSkips = new Map<string, number>();

// Minimum interval (ms) between renders of the same card, even if content changed.
// Prevents rapid-fire repaints on flapping data (e.g. flaky API alternating payloads).
const MIN_RENDER_INTERVAL_MS = 2000;

/** Maximum backoff multiplier (cap at 4× the base interval). */
const MAX_BACKOFF = 4;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns `true` when the card should NOT re-render because:
 * 1. The content is identical to the last rendered content, OR
 * 2. The last render was less than MIN_RENDER_INTERVAL_MS ago.
 *
 * @param cardId  Unique card identifier (e.g. "weather", "stocks").
 * @param payload Serializable data to fingerprint (will be JSON.stringify'd).
 */
export function shouldSkipRender(cardId: string, payload: unknown): boolean {
  const hash = fnv1a32(JSON.stringify(payload));
  const prevHash = _lastHash.get(cardId);
  if (prevHash === hash) {
    _skipCount.set(cardId, (_skipCount.get(cardId) ?? 0) + 1);
    _consecutiveSkips.set(cardId, (_consecutiveSkips.get(cardId) ?? 0) + 1);
    return true;
  }

  const now = Date.now();
  const lastRender = _lastRenderMs.get(cardId);
  if (lastRender !== undefined && now - lastRender < MIN_RENDER_INTERVAL_MS) {
    _skipCount.set(cardId, (_skipCount.get(cardId) ?? 0) + 1);
    return true;
  }

  // Data changed — reset backoff
  _consecutiveSkips.set(cardId, 0);
  return false;
}

/**
 * Record that a card has just rendered with the given payload.
 * Call this AFTER the DOM update completes.
 */
export function markRendered(cardId: string, payload: unknown): void {
  _lastHash.set(cardId, fnv1a32(JSON.stringify(payload)));
  _lastRenderMs.set(cardId, Date.now());
  _renderCount.set(cardId, (_renderCount.get(cardId) ?? 0) + 1);
}

/**
 * S56: Adaptive interval multiplier.
 *
 * Returns a multiplier (1–MAX_BACKOFF) for the card's base refresh interval.
 * When data hasn't changed across consecutive cycles, the multiplier increases,
 * reducing network and CPU load. Resets to 1× on the next data change.
 *
 * @param cardId Card identifier.
 * @returns A number 1..MAX_BACKOFF to multiply against the base interval.
 */
export function getAdaptiveMultiplier(cardId: string): number {
  const skips = _consecutiveSkips.get(cardId) ?? 0;
  if (skips === 0) return 1;
  // Each consecutive skip adds 0.5×, capped at MAX_BACKOFF
  return Math.min(1 + skips * 0.5, MAX_BACKOFF);
}

/**
 * Invalidate the governor state for a card, forcing the next render.
 * Use when the user manually refreshes or switches themes.
 */
export function invalidateGovernor(cardId: string): void {
  _lastHash.delete(cardId);
  _lastRenderMs.delete(cardId);
}

/** Clear all governor state (e.g. on theme change or full reload). */
export function resetGovernor(): void {
  _lastHash.clear();
  _lastRenderMs.clear();
  _renderCount.clear();
  _skipCount.clear();
  _consecutiveSkips.clear();
}

/** Per-card render/skip statistics for the diagnostics overlay. */
export interface GovernorStats {
  cardId: string;
  renders: number;
  skips: number;
}

/** Return render/skip counts for all tracked cards. */
export function getGovernorStats(): GovernorStats[] {
  const ids = new Set([..._renderCount.keys(), ..._skipCount.keys()]);
  return [...ids].map((cardId) => ({
    cardId,
    renders: _renderCount.get(cardId) ?? 0,
    skips: _skipCount.get(cardId) ?? 0,
  }));
}

// ── Test helpers ─────────────────────────────────────────────────────────────

/** @internal — exposed for unit tests only. */
export function _resetForTest(): void {
  resetGovernor();
}

/** @internal — exposed for unit tests only. */
export function _fnv1a32ForTest(str: string): number {
  return fnv1a32(str);
}
