/**
 * FamilyDashBoard v7 — Stocks Provider Adapter (Sprint 128)
 *
 * Implements ProviderAdapter for Yahoo Finance v8 chart API.
 * Fetches a single symbol per call; callers batch multiple symbols.
 */

import type { ProviderAdapter, ProviderResult } from "../../types/provider";
import type { YahooChartResponse } from "../../types/api";
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

const PROVIDER_ID = "yahoo-finance";

/**
 * Create a stocks provider adapter for a single symbol.
 *
 * @param symbol  Ticker symbol (e.g. "AAPL", "BTC-USD")
 * @param marketOpen Whether the market is currently open (affects TTL)
 */
export function createStocksAdapter(
  symbol: string,
  marketOpen = true,
): ProviderAdapter<YahooChartResponse> {
  const cacheKey = `stk-${symbol}`;
  const cacheTtl = marketOpen ? INTERVALS.STOCKS_OPEN : INTERVALS.STOCKS_CLOSED;

  return {
    id: PROVIDER_ID,
    displayName: `Yahoo Finance (${symbol})`,
    cacheKey,
    cacheTtl,

    async fetch(): Promise<ProviderResult<YahooChartResponse>> {
      const cached = cGet<YahooChartResponse>(cacheKey, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      try {
        const url = `${API.YAHOO_CHART}${encodeURIComponent(symbol)}`;
        const data = await fetchJSONWithWorker<YahooChartResponse>(url);

        if (
          !data?.chart?.result?.[0]?.meta ||
          typeof data.chart.result[0].meta.regularMarketPrice !== "number"
        ) {
          throw new Error(`Invalid chart response for ${symbol}`);
        }

        cSet(cacheKey, data);
        recordProviderSuccess(PROVIDER_ID);
        diagLog(`FDB-128: [stocks] Fetched ${symbol}`);
        return { ok: true, data };
      } catch (err) {
        recordProviderFailure(PROVIDER_ID);
        const stale = cGetStale<YahooChartResponse>(cacheKey);
        const msg = err instanceof Error ? err.message : String(err);
        diagLog(`FDB-128: [stocks] Failed ${symbol}: ${msg}`);
        return {
          ok: false,
          error: `Stocks fetch failed for ${symbol}: ${msg}`,
          stale: stale ?? undefined,
        };
      }
    },

    status(): ProviderStatus {
      return getProviderHealth(PROVIDER_ID).status;
    },
  };
}
