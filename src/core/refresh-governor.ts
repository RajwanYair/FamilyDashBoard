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

// Minimum interval (ms) between renders of the same card, even if content changed.
// Prevents rapid-fire repaints on flapping data (e.g. flaky API alternating payloads).
const MIN_RENDER_INTERVAL_MS = 2000;

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
  if (prevHash === hash) return true;

  const now = Date.now();
  const lastRender = _lastRenderMs.get(cardId);
  if (lastRender !== undefined && now - lastRender < MIN_RENDER_INTERVAL_MS) return true;

  return false;
}

/**
 * Record that a card has just rendered with the given payload.
 * Call this AFTER the DOM update completes.
 */
export function markRendered(cardId: string, payload: unknown): void {
  _lastHash.set(cardId, fnv1a32(JSON.stringify(payload)));
  _lastRenderMs.set(cardId, Date.now());
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
