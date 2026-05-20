/**
 * FamilyDashBoard — Freshness Badge System (P1 Info Hierarchy)
 *
 * Shows "X minutes ago" / "Y hours ago" badges on data cards so the user
 * instantly sees how recent the displayed data is.
 *
 * Usage:
 *   markFresh("weather");          // call after successful fetch
 *   renderFreshnessBadge("weather", containerEl);  // mount badge into a card
 *
 * A single 30-second interval updates all registered badges.
 */

import { nowMs, fromEpochMs } from "./temporal";
import { MS_PER_MIN } from "./constants";

// ── State ──────────────────────────────────────────────────────────────────────

const lastFetch = new Map<string, number>();
const badges = new Map<string, HTMLElement>();
let _tickInterval: ReturnType<typeof setInterval> | null = null;

// ── Public API ─────────────────────────────────────────────────────────────────

/** Record that `cardId` just received fresh data. */
export function markFresh(cardId: string): void {
  lastFetch.set(cardId, nowMs());
  const el = badges.get(cardId);
  if (el) updateBadge(cardId, el);
}

/** Get the timestamp of the last fetch for a card (or null if never fetched). */
export function getLastFetchMs(cardId: string): number | null {
  return lastFetch.get(cardId) ?? null;
}

/**
 * Mount a freshness `<time>` badge into the given container.
 * If a badge already exists for this card, it reuses it.
 * The badge auto-updates every 30 seconds via the shared tick.
 */
export function renderFreshnessBadge(cardId: string, container: HTMLElement): HTMLElement {
  let el = badges.get(cardId);
  if (!el) {
    el = document.createElement("time");
    el.className = "freshness-badge";
    el.setAttribute("aria-live", "polite");
    badges.set(cardId, el);
    ensureTick();
  }
  if (!container.contains(el)) {
    container.appendChild(el);
  }
  updateBadge(cardId, el);
  return el;
}

/** Remove a badge (e.g., on card destroy). */
export function removeFreshnessBadge(cardId: string): void {
  const el = badges.get(cardId);
  if (el) {
    el.remove();
    badges.delete(cardId);
  }
  if (badges.size === 0 && _tickInterval !== null) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
}

/** Format an elapsed duration as a Hebrew relative string. */
export function formatRelativeTime(elapsedMs: number): string {
  if (elapsedMs < MS_PER_MIN) return "עכשיו";
  const mins = Math.floor(elapsedMs / MS_PER_MIN);
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

/** Classify freshness into a state for CSS coloring. */
export function freshnessState(elapsedMs: number, ttlMs: number): "fresh" | "aging" | "stale" {
  if (elapsedMs <= ttlMs) return "fresh";
  if (elapsedMs <= ttlMs * 2) return "aging";
  return "stale";
}

// ── Internals ──────────────────────────────────────────────────────────────────

function updateBadge(cardId: string, el: HTMLElement): void {
  const ts = lastFetch.get(cardId);
  if (ts === undefined) {
    el.textContent = "";
    el.removeAttribute("datetime");
    el.removeAttribute("data-state");
    return;
  }
  const elapsed = nowMs() - ts;
  el.textContent = formatRelativeTime(elapsed);
  el.setAttribute("datetime", fromEpochMs(ts).toISOString());
  // Default TTL for badge coloring: 15 min (can be overridden per-card in future)
  el.dataset["state"] = freshnessState(elapsed, 15 * MS_PER_MIN);
}

function tickAll(): void {
  for (const [cardId, el] of badges) {
    updateBadge(cardId, el);
  }
}

function ensureTick(): void {
  if (_tickInterval !== null) return;
  _tickInterval = setInterval(tickAll, 30_000);
}

/** Reset all state (testing). */
export function resetFreshness(): void {
  lastFetch.clear();
  for (const el of badges.values()) el.remove();
  badges.clear();
  if (_tickInterval !== null) {
    clearInterval(_tickInterval);
    _tickInterval = null;
  }
}
