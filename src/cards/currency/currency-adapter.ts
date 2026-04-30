/**
 * FamilyDashBoard v13 — Currency Provider Adapter (Sprint 91)
 *
 * Implements ProviderAdapter for exchange-rate APIs (ER-API primary, exchangerate-api fallback).
 */

import type { ProviderAdapter } from "../../types/provider";
import { API, INTERVALS } from "../../core/constants";
import { fetchJSONWithWorker } from "../../core/fetch";
import { createCachedProviderAdapter } from "../../core/provider-adapter";

const PROVIDER_ID = "currency";
const CACHE_KEY = "cur";

export interface CurrencyRateResponse {
  rates: Record<string, number>;
  base_code?: string;
  base?: string;
}

export function createCurrencyAdapter(): ProviderAdapter<CurrencyRateResponse> {
  const cacheTtl = INTERVALS.CURRENCY;

  return createCachedProviderAdapter({
    id: PROVIDER_ID,
    displayName: "Currency Exchange Rates",
    cacheKey: CACHE_KEY,
    cacheTtl,
    async fetchFresh(): Promise<CurrencyRateResponse> {
      // Sprint 132 (Roadmap #16): ECB-direct via Frankfurter as 3rd fallback for redundancy.
      for (const url of [API.CURRENCY_PRIMARY, API.CURRENCY_FALLBACK, API.CURRENCY_FALLBACK_ECB]) {
        try {
          const data = await fetchJSONWithWorker<CurrencyRateResponse>(url);
          if (data?.rates && typeof data.rates === "object") {
            return data;
          }
        } catch {
          // Try next URL.
        }
      }

      throw new Error("All currency endpoints failed");
    },
    successLog: () => `FDB-091: [currency] Fetched rates from configured endpoint`,
  });
}
