/**
 * FamilyDashBoard — Feed Statistics (P3 Feed Intelligence)
 *
 * Module-boundary-safe intermediary for cross-layer feed diagnostics.
 * `src/cards/news/news.ts` writes here; `src/ui/diag-overlay.ts` reads here.
 * This keeps the strict ui/* ↔ cards/* isolation rule intact.
 */

import { nowMs, fromEpochMs } from "./temporal";

export interface DedupStats {
  /** Total news items fetched across all feeds before deduplication. */
  totalFetched: number;
  /** Items remaining after SimHash deduplication. */
  uniqueAfterDedup: number;
  /** Items actually rendered (capped at 50). */
  renderedCount: number;
  /** ISO timestamp of the last dedup run. */
  lastRunAt: string;
}

let _stats: DedupStats | null = null;

/** Record dedup stats from the latest news fetch. Called by news.ts. */
export function recordDedupStats(stats: Omit<DedupStats, "lastRunAt">): void {
  _stats = { ...stats, lastRunAt: fromEpochMs(nowMs()).toISOString() };
}

/** Return the most recent dedup stats, or null if news hasn't fetched yet. */
export function getDedupStats(): DedupStats | null {
  return _stats;
}
