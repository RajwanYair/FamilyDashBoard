/**
 * FamilyDashBoard v7 — Alerts Provider Adapter (Sprint 92)
 *
 * Implements ProviderAdapter for the Tzeva Adom alert API.
 */

import type { ProviderAdapter, ProviderResult } from "../../types/provider";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { API, INTERVALS } from "../../core/constants";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from "../../core/provider";
import { fetchJSONWithWorker } from "../../core/fetch";
import { diagLog } from "../../core/diag";
import type { ProviderStatus } from "../../core/provider";

const PROVIDER_ID = "tzeva-adom";
const CACHE_KEY = "alerts";

export interface AlertItem {
  alertDate: string;
  data: string;
  threat: number;
}

export type AlertsResponse = AlertItem[];

export function createAlertsAdapter(): ProviderAdapter<AlertsResponse> {
  const cacheTtl = INTERVALS.ALERTS_ACTIVE;

  return {
    id: PROVIDER_ID,
    displayName: "Tzeva Adom Alerts",
    cacheKey: CACHE_KEY,
    cacheTtl,

    async fetch(): Promise<ProviderResult<AlertsResponse>> {
      const cached = cGet<AlertsResponse>(CACHE_KEY, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      try {
        const data = await fetchJSONWithWorker<AlertsResponse>(API.ALERTS);
        if (!Array.isArray(data)) {
          recordProviderFailure(PROVIDER_ID);
          const stale = cGetStale<AlertsResponse>(CACHE_KEY);
          return { ok: false, error: "Invalid response — expected array", stale: stale ?? undefined };
        }
        cSet(CACHE_KEY, data);
        recordProviderSuccess(PROVIDER_ID);
        diagLog(`FDB-092: [alerts] Fetched ${data.length} alert items`);
        return { ok: true, data };
      } catch (err) {
        recordProviderFailure(PROVIDER_ID);
        const stale = cGetStale<AlertsResponse>(CACHE_KEY);
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
