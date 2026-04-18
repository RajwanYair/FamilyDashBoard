/**
 * FamilyDashBoard v7 — Currency Provider Adapter (Sprint 91)
 *
 * Implements ProviderAdapter for exchange-rate APIs (ER-API primary, exchangerate-api fallback).
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

const PROVIDER_ID = "currency";
const CACHE_KEY = "cur";

export interface CurrencyRateResponse {
  rates: Record<string, number>;
  base_code?: string;
  base?: string;
}

export function createCurrencyAdapter(): ProviderAdapter<CurrencyRateResponse> {
  const cacheTtl = INTERVALS.CURRENCY;

  return {
    id: PROVIDER_ID,
    displayName: "Currency Exchange Rates",
    cacheKey: CACHE_KEY,
    cacheTtl,

    async fetch(): Promise<ProviderResult<CurrencyRateResponse>> {
      const cached = cGet<CurrencyRateResponse>(CACHE_KEY, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      // Try primary, then fallback
      for (const url of [API.CURRENCY_PRIMARY, API.CURRENCY_FALLBACK]) {
        try {
          const data = await fetchJSONWithWorker<CurrencyRateResponse>(url);
          if (!data?.rates || typeof data.rates !== "object") continue;
          cSet(CACHE_KEY, data);
          recordProviderSuccess(PROVIDER_ID);
          diagLog(`FDB-091: [currency] Fetched rates from ${url}`);
          return { ok: true, data };
        } catch {
          // Try next URL
        }
      }

      recordProviderFailure(PROVIDER_ID);
      const stale = cGetStale<CurrencyRateResponse>(CACHE_KEY);
      return {
        ok: false,
        error: "All currency endpoints failed",
        stale: stale ?? undefined,
      };
    },

    status(): ProviderStatus {
      return getProviderHealth(PROVIDER_ID).status;
    },
  };
}
