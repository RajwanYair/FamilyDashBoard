/**
 * FamilyDashBoard v7 — Stocks Provider Adapter (Sprint 128)
 *
 * Implements ProviderAdapter for Yahoo Finance v8 chart API.
 * Fetches a single symbol per call; callers batch multiple symbols.
 */

import type { ProviderAdapter } from "../../types/provider";
import type { YahooChartResponse } from "../../types/api";
import { API, INTERVALS } from "../../core/constants";
import { fetchJSONWithWorker } from "../../core/fetch";
import { createCachedProviderAdapter } from "../../core/provider-adapter";

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

  return createCachedProviderAdapter({
    id: PROVIDER_ID,
    displayName: `Yahoo Finance (${symbol})`,
    cacheKey,
    cacheTtl,
    async fetchFresh(): Promise<YahooChartResponse> {
      const url = `${API.YAHOO_CHART}${encodeURIComponent(symbol)}`;
      const data = await fetchJSONWithWorker<YahooChartResponse>(url);

      if (
        !data?.chart?.result?.[0]?.meta ||
        typeof data.chart.result[0].meta.regularMarketPrice !== "number"
      ) {
        throw new Error(`Invalid chart response for ${symbol}`);
      }

      return data;
    },
    successLog: () => `FDB-128: [stocks] Fetched ${symbol}`,
    failureLog: (message) => `FDB-128: [stocks] Failed ${symbol}: ${message}`,
    failureMessage: (message) => `Stocks fetch failed for ${symbol}: ${message}`,
  });
}
