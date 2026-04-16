/**
 * FamilyDashBoard v6 — Base Card Module
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
