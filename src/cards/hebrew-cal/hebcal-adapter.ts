/**
 * FamilyDashBoard v7 — Hebcal Provider Adapter (Sprint 90)
 *
 * Implements ProviderAdapter for the Hebcal API (holidays + Shabbat times).
 */

import type { ProviderAdapter, ProviderResult } from "../../types/provider";
import { cGet, cGetStale, cSetAsync } from "../../core/cache";
import { API, INTERVALS } from "../../core/constants";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from "../../core/provider";
import { fetchJSONWithWorker } from "../../core/fetch";
import { diagLog } from "../../core/diag";
import type { ProviderStatus } from "../../core/provider";

const PROVIDER_ID = "hebcal";
const CACHE_KEY = "hcal";

export interface HebcalItem {
  title: string;
  date: string;
  category?: string;
  hebrew?: string;
  memo?: string;
}

export interface HebcalResponse {
  items: HebcalItem[];
  title?: string;
}

export function createHebcalAdapter(geonameid = 281184): ProviderAdapter<HebcalResponse> {
  const cacheTtl = INTERVALS.HEBREW_CAL;

  return {
    id: PROVIDER_ID,
    displayName: "Hebcal Calendar",
    cacheKey: CACHE_KEY,
    cacheTtl,

    async fetch(): Promise<ProviderResult<HebcalResponse>> {
      const cached = cGet<HebcalResponse>(CACHE_KEY, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      const now = new Date();
      const url = `${API.HEBCAL}?v=1&cfg=json&maj=on&min=on&year=${now.getFullYear()}&month=x&geonameid=${geonameid}`;

      try {
        const data = await fetchJSONWithWorker<HebcalResponse>(url);
        if (!data?.items || !Array.isArray(data.items)) {
          recordProviderFailure(PROVIDER_ID);
          const stale = cGetStale<HebcalResponse>(CACHE_KEY);
          return { ok: false, error: "Invalid response shape", stale: stale ?? undefined };
        }
        await cSetAsync(CACHE_KEY, data);
        recordProviderSuccess(PROVIDER_ID);
        diagLog(`FDB-090: [hebcal] Fetched ${data.items.length} items`);
        return { ok: true, data };
      } catch (err) {
        recordProviderFailure(PROVIDER_ID);
        const stale = cGetStale<HebcalResponse>(CACHE_KEY);
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          stale: stale ?? undefined,
        };
      }
    },

    status(): ProviderStatus {
      return getProviderHealth(PROVIDER_ID).status;
    },
  };
}
