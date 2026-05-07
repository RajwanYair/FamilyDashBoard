/**
 * FamilyDashBoard v13 — Currency Provider Adapter
 *
 * Implements ProviderAdapter for exchange-rate APIs.
 *
 * Provider chain (ADR-061 D8/C-BoI, v14.0):
 *   BoI (Bank of Israel) → open.er-api → exchangerate-api → Frankfurter/ECB
 */

import type { ProviderAdapter } from "../../types/provider";
import { API, INTERVALS } from "../../core/constants";
import { fetchJSONWithWorker } from "../../core/fetch";
import { createCachedProviderAdapter } from "../../core/provider-adapter";
import { fetchBoIRates } from "./boi-adapter";

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
      // D8/C-BoI (ADR-061): Bank of Israel as authoritative primary ILS source.
      try {
        const boi = await fetchBoIRates();
        if (boi?.rates && Object.keys(boi.rates).length > 2) {
          return boi;
        }
      } catch {
        // BoI failed — fall through to existing provider chain.
      }

      // ECB-direct via Frankfurter as 3rd fallback.
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
