/**
 * FamilyDashBoard v13 — Calendar/ICS Provider Adapter (Sprint 129)
 *
 * Implements ProviderAdapter for ICS calendar feeds.
 * Fetches a single ICS URL, returns raw text for downstream parsing.
 */

import type { ProviderAdapter, ProviderResult } from "../../types/provider";
import { cGet, cGetStale, cSetAsync } from "../../core/cache";
import { INTERVALS } from "../../core/constants";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from "../../core/provider";
import { fetchWithTimeout } from "../../core/fetch";
import { diagLog } from "../../core/diag";
import type { ProviderStatus } from "../../core/provider";

const PROVIDER_ID = "calendar-ics";
const FETCH_TIMEOUT = 10_000;

/**
 * Create a calendar provider adapter for a single ICS feed URL.
 *
 * @param icsUrl   Full URL of the ICS feed
 * @param feedIndex Index for cache-key disambiguation when multiple feeds exist
 */
export function createCalendarAdapter(icsUrl: string, feedIndex = 0): ProviderAdapter<string> {
  const cacheKey = `cal-ics-${feedIndex}`;
  const cacheTtl = INTERVALS.CALENDAR;

  return {
    id: PROVIDER_ID,
    displayName: `Calendar ICS #${feedIndex}`,
    cacheKey,
    cacheTtl,

    async fetch(): Promise<ProviderResult<string>> {
      const cached = cGet<string>(cacheKey, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      try {
        const resp = await fetchWithTimeout(icsUrl, FETCH_TIMEOUT);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const text = await resp.text();
        if (!text.includes("BEGIN:VCALENDAR")) {
          throw new Error("Response is not valid ICS");
        }
        await cSetAsync(cacheKey, text);
        recordProviderSuccess(PROVIDER_ID);
        diagLog(`FDB-129: [calendar] Fetched ICS #${feedIndex}`);
        return { ok: true, data: text };
      } catch (err) {
        recordProviderFailure(PROVIDER_ID);
        const stale = cGetStale<string>(cacheKey);
        const msg = err instanceof Error ? err.message : String(err);
        diagLog(`FDB-129: [calendar] Failed ICS #${feedIndex}: ${msg}`);
        return {
          ok: false,
          error: `Calendar fetch failed: ${msg}`,
          stale: stale ?? undefined,
        };
      }
    },

    status(): ProviderStatus {
      return getProviderHealth(PROVIDER_ID).status;
    },
  };
}
