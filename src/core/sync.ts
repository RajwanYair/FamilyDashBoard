/**
 * FamilyDashBoard v7 — Sync Indicators & Health Tracking
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
  // aria-busy on the nearest card ancestor for screen readers (Sprint 45)
  const card = dot.closest(".card");
  if (card) {
    card.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  }
}

/** Maps sync-dot IDs to their data-card-id attribute values where they differ. */
const SYNC_TO_CARD_ID: Readonly<Record<string, string>> = {
  wx: "weather",
  cur: "currency",
  moti: "motivation",
  hebcal: "hebrew-cal",
  cal: "calendar",
};

/**
 * Trigger a subtle reappear animation on the card element after a fresh data fetch.
 * Resolves the sync-dot ID to the correct data-card-id selector.
 */
function flashCardRefresh(syncId: string): void {
  const cardDomId = SYNC_TO_CARD_ID[syncId] ?? syncId;
  const card = document.querySelector<HTMLElement>(`[data-card-id="${cardDomId}"]`);
  if (!card) return;
  card.classList.remove("card--refreshed");
  void card.offsetWidth; // force reflow so re-adding the class retriggers the animation
  card.classList.add("card--refreshed");
  card.addEventListener("animationend", () => card.classList.remove("card--refreshed"), {
    once: true,
  });
}

/**
 * Apply a brief burst animation on successful refresh.
 */
export function syncBurst(name: string): void {
  const dot = syncDots.get(name);
  if (!dot) return;
  dot.classList.add("burst");
  setTimeout(() => dot.classList.remove("burst"), 600);
  flashCardRefresh(name);
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
 * Returns all panes that have at least one failure logged.
 */
export function getFailedPanes(): Array<{ key: string; delay: number }> {
  return Array.from(backoff.entries())
    .filter(([, n]) => n > 0)
    .map(([key, n]) => ({ key, delay: Math.pow(2, n) }));
}

/**
 * Clear all registered sync dots (for testing isolation).
 */
export function clearSyncDots(): void {
  syncDots.clear();
}
