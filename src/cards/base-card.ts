/**
 * FamilyDashBoard v7 — Base Card Module
 *
 * Common card lifecycle: load → cache check → fetch → render → schedule.
 * Each card module exports an init function and a load function.
 */

import { cGet, cGetStale, cSet } from "../core/cache";
import { isPageVisible } from "../core/idle";
import { setSync, syncBurst, recordSuccess, recordFailure } from "../core/sync";
import { acquireLock, releaseLock } from "../core/fetch";
import { diagLog } from "../core/diag";

export interface CardOptions {
  /** Unique card identifier (used for cache key, sync dot, fetch lock). */
  id: string;
  /** Cache TTL in milliseconds. */
  ttl: number;
  /** Refresh interval in milliseconds. */
  interval: number;
}

/**
 * Wrap a card loader with standard patterns:
 * visibility check, lock, cache check, sync indicators.
 * If `validate` is provided, fresh API data is validated before
 * rendering; invalid payloads fall back to stale cache and log a warning.
 */
export function createCardLoader<T>(
  opts: CardOptions,
  fetchData: () => Promise<T>,
  renderData: (data: T) => void,
  validate?: (data: unknown) => data is T,
): () => Promise<void> {
  return async function load(): Promise<void> {
    if (!isPageVisible() || !acquireLock(opts.id)) return;
    setSync(opts.id, "loading");

    // Cache check
    const fresh = cGet<T>(opts.id, opts.ttl);
    if (fresh) {
      renderData(fresh);
      setSync(opts.id, "ok");
      releaseLock(opts.id);
      return;
    }

    // Show stale data while fetching
    const stale = cGetStale<T>(opts.id);
    if (stale) renderData(stale);

    try {
      const data = await fetchData();
      // Runtime validation gate — reject malformed API responses
      if (validate && !validate(data)) {
        diagLog(`[${opts.id}] API response failed validation — using stale cache`);
        setSync(opts.id, stale ? "ok" : "error");
        recordFailure(opts.id);
        return;
      }
      cSet(opts.id, data);
      renderData(data);
      setSync(opts.id, "ok");
      syncBurst(opts.id);
      recordSuccess(opts.id);
    } catch (err) {
      diagLog(`[${opts.id}] Load failed: ${String(err)}`);
      setSync(opts.id, stale ? "ok" : "error");
      recordFailure(opts.id);
    } finally {
      releaseLock(opts.id);
    }
  };
}

/**
 * Schedule a card to refresh at a fixed interval.
 */
export function scheduleCard(
  load: () => Promise<void>,
  intervalMs: number,
): number {
  return window.setInterval(() => {
    void load();
  }, intervalMs);
}

/**
 * Build a short human-readable staleness chip label (Sprint 48).
 *
 * Returns a string like "לפני 3 דק'" or "לפני שעה 2".
 * Use for overlay captions, diagnostics, and stale-state badges.
 *
 * @param ageMs - Age of cached data in milliseconds
 * @returns Hebrew staleness label
 */
export function staleChip(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "\u05E2\u05DB\u05E9\u05D9\u05D5";
  if (minutes < 60) return `\u05DC\u05E4\u05E0\u05D9 ${minutes} \u05D3\u05E7'`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `\u05DC\u05E4\u05E0\u05D9 \u05E9\u05E2\u05D4${hours > 1 ? ` ${hours}` : ""}`;
  const days = Math.floor(hours / 24);
  return days === 1
    ? `\u05DC\u05E4\u05E0\u05D9 1 \u05D9\u05D5\u05DD`
    : `\u05DC\u05E4\u05E0\u05D9 ${days} \u05D9\u05DE\u05D9\u05DD`;
}

// ── Sprint 51-53: Card Shell Primitives ─────────────────────────────────────

/**
 * Build a skeleton placeholder element for use during initial card load (Sprint 51).
 *
 * Renders one or more animated shimmer lines inside a `<div class="card-skeleton">`.
 * Cards should replace the element once data is ready.
 *
 * @param lines - Number of shimmer lines to render (default 3)
 * @returns Skeleton container element
 */
export function createSkeleton(lines = 3): HTMLElement {
  const el = document.createElement("div");
  el.className = "card-skeleton";
  el.setAttribute("aria-hidden", "true");
  for (let i = 0; i < lines; i++) {
    const line = document.createElement("div");
    line.className = "card-skeleton__line";
    el.appendChild(line);
  }
  return el;
}

/**
 * Build a standardized empty-state element (Sprint 52).
 *
 * Displays a neutral message when a card has no data (e.g. empty news feed,
 * no upcoming calendar events, no tasks).
 *
 * @param message - Display message (use `textContent` — no raw HTML)
 * @returns Empty-state container element
 */
export function createEmptyState(message: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "card-empty";
  const icon = document.createElement("span");
  icon.className = "card-empty__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "—";
  const msg = document.createElement("p");
  msg.className = "card-empty__msg";
  msg.textContent = message;
  el.appendChild(icon);
  el.appendChild(msg);
  return el;
}

/**
 * Build a standardized error-state element (Sprint 53).
 *
 * Displays an error badge for unrecoverable card failures. Intended for
 * inline use inside a card's content area.
 *
 * @param message - Error description (sanitized via `textContent`)
 * @returns Error-state container element
 */
export function createErrorState(message: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "card-error";
  el.setAttribute("role", "alert");
  const icon = document.createElement("span");
  icon.className = "card-error__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⚠";
  const msg = document.createElement("p");
  msg.className = "card-error__msg";
  msg.textContent = message;
  el.appendChild(icon);
  el.appendChild(msg);
  return el;
}
