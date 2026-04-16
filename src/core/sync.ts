/**
 * FamilyDashBoard v6 — Sync Indicators & Health Tracking
 *
 * Sync dots show green (ok), yellow (loading), or red (error) per pane.
 * Health tracking uses exponential backoff for failed fetches.
 */

import { diagLog } from "./diag";

export type SyncState = "ok" | "loading" | "error";

const syncDots = new Map<string, HTMLElement>();

/**
 * Register a sync dot element. Sets role="status" for accessibility.
 */
export function registerSyncDot(name: string, el: HTMLElement): void {
  el.setAttribute("role", "status");
  syncDots.set(name, el);
}

/**
 * Update a sync dot's visual state.
 */
export function setSync(name: string, state: SyncState): void {
  const dot = syncDots.get(name);
  if (!dot) return;
  dot.className = "sync-dot";
  if (state !== "ok") dot.classList.add(state);
  const labels: Record<SyncState, string> = {
    ok: "סנכרון תקין",
    loading: "טוען...",
    error: "שגיאת סנכרון",
  };
  dot.setAttribute("aria-label", labels[state]);
}

/**
 * Apply a brief burst animation on successful refresh.
 */
export function syncBurst(name: string): void {
  const dot = syncDots.get(name);
  if (!dot) return;
  dot.classList.add("burst");
  setTimeout(() => dot.classList.remove("burst"), 600);
}

// ── Exponential Backoff ──
const backoff = new Map<string, number>();

/**
 * Record a fetch failure — increases backoff delay.
 */
export function recordFailure(key: string): void {
  const current = backoff.get(key) ?? 0;
  backoff.set(key, Math.min(current + 1, 5)); // max 5 retries (32x base delay)
  diagLog(`[backoff] ${key} failure #${current + 1}`);
}

/**
 * Record a fetch success — resets backoff.
 */
export function recordSuccess(key: string): void {
  backoff.delete(key);
}

/**
 * Get the current backoff delay multiplier (2^failures).
 */
export function getBackoffDelay(key: string): number {
  const failures = backoff.get(key) ?? 0;
  return Math.pow(2, failures);
}

/**
 * Clear all registered sync dots (for testing isolation).
 */
export function clearSyncDots(): void {
  syncDots.clear();
}
