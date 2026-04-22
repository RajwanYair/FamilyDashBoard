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
 * DOM element IDs to read when building per-card mini-info text.
 * Only cards whose headers lack dynamic data need an entry here.
 */
const MINI_INFO_SOURCES: Readonly<Record<string, readonly string[]>> = {
  weather: ["wx-temp", "wx-desc"],
  "hebrew-cal": ["hc-candles"],
  currency: ["curUsd"],
  motivation: ["moti-text"],
  "system-info": ["sysinfo-online", "sysinfo-battery"],
};

/**
 * Build a compact one-line summary for the given card's mini-info span.
 * Reads from live DOM elements so it always reflects the latest rendered data.
 */
function buildMiniText(cardId: string): string {
  if (cardId === "countdown") {
    const title = document.getElementById("cd-wedding-title")?.textContent?.trim() ?? "";
    const days = document.getElementById("cd-days")?.textContent?.trim() ?? "";
    if (!title) return "";
    return days && days !== "--" ? `${title} \u2014 ${days} \u05d9\u05de\u05d9\u05dd` : title;
  }
  const sources = MINI_INFO_SOURCES[cardId];
  if (!sources || sources.length === 0) return "";
  const parts = sources
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
    .filter((t) => t !== "" && t !== "--" && t !== "\u2014" && t !== "\u05d8\u05d5\u05e2\u05df...");
  const text = parts.join(" \u00b7 ");
  // Motivation quotes can be very long — truncate to one glanceable line
  return cardId === "motivation" && text.length > 50 ? `${text.slice(0, 50)}\u2026` : text;
}

/**
 * Update the `#mini-<cardId>` span in the card header with a compact summary.
 * No-op when the element does not exist (cards without a mini-info span).
 */
export function updateCardMiniInfo(cardDomId: string): void {
  const el = document.getElementById(`mini-${cardDomId}`);
  if (!el) return;
  el.textContent = buildMiniText(cardDomId);
}

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
  updateCardMiniInfo(cardDomId);
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
