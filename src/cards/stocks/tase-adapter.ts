/**
 * D8/S-TASE — Tel Aviv Stock Exchange adapter (ADR-061, v14.0)
 *
 * Fetches authoritative native-ILS quotes for TASE-listed securities
 * (symbols ending in ".TA" but NOT index symbols starting with "^").
 *
 * Chain position (ADR-061): TASE → Yahoo Finance → Stooq (fallback)
 * The stocks card's `fetchStock` function calls `fetchTASE` when it detects
 * a non-index ".TA" suffix, then falls through to Yahoo on failure.
 *
 * Source: https://api.tase.co.il/api/share/GetByName/{name}
 *   — public endpoint, no API key required, 60 req/min per IP.
 *
 * ILS → USD cross-link:
 *   TASE prices are quoted in ILS. The adapter records the ILS price in
 *   the YahooChartResponse `currency` field and also converts to USD using
 *   the currency card's latest rates via `getLastCurrencyRates()`.
 *   When rates are unavailable the raw ILS price is stored unchanged and
 *   the caller renders it with an "₪" prefix.
 */

import type { YahooChartResponse } from "../../types/api";
import { FETCH_TIMEOUT_MS, PROXIES } from "../../core/constants";
import { fetchWithTimeout } from "../../core/fetch";
import { diagLog } from "../../core/diag";
import { cGet, cSet } from "../../core/cache";
import { getLastCurrencyRates } from "../currency/currency";

const PROVIDER_ID = "tase";
const CACHE_KEY_PREFIX = "tase:";
const CACHE_TTL_S = 300; // 5 min — TASE intraday rate

/** TASE API base URL (public, no auth). */
const TASE_API_BASE = "https://api.tase.co.il/api/share";

/**
 * Minimal shape returned by TASE GetByName API.
 * Fields are in ILS denomination.
 */
export interface TASEShareResponse {
  id?: number | null;
  name?: string | null;
  symbol?: string | null;
  /** Last trade price (ILS) */
  lastPrice?: number | null;
  /** Today's change percentage */
  changePercent?: number | null;
  /** Previous close (ILS) */
  closingPrice?: number | null;
  /** 52-week high (ILS) */
  high52W?: number | null;
  /** 52-week low (ILS) */
  low52W?: number | null;
  /** Today's volume (units) */
  volume?: number | null;
}

/**
 * Return true when `symbol` is a non-index TASE ticker
 * (ends with ".TA" but does NOT start with "^").
 */
export function isTASETicker(symbol: string): boolean {
  return symbol.toUpperCase().endsWith(".TA") && !symbol.startsWith("^");
}

/**
 * Strip the ".TA" suffix to get the TASE base ticker name.
 * "PERI.TA" → "PERI",  "IDB.TA" → "IDB"
 */
export function stripTASESuffix(symbol: string): string {
  return symbol.replace(/\.TA$/i, "");
}

/**
 * Convert a TASE ILS price to USD using the latest currency card rates.
 * Returns null when rates are unavailable or invalid.
 */
export function ilsToUsd(ilsPrice: number): number | null {
  const rates = getLastCurrencyRates();
  if (!rates) return null;
  // rates.USD is "1 ILS = X USD"
  const usdPerIls = rates["USD"];
  if (!usdPerIls || usdPerIls <= 0) return null;
  return ilsPrice * usdPerIls;
}

/**
 * Convert a TASEShareResponse to YahooChartResponse shape.
 * Prices are in ILS; `currency` is set to "ILS".
 * When currency conversion is available, the card will display "₪X (=$Y)" inline.
 */
export function taseToYahooResponse(share: TASEShareResponse): YahooChartResponse {
  const lastILS = typeof share.lastPrice === "number" ? share.lastPrice : 0;
  const prevILS =
    typeof share.closingPrice === "number" && share.closingPrice > 0
      ? share.closingPrice
      : lastILS;

  const high52 = typeof share.high52W === "number" ? share.high52W : lastILS;
  const low52 = typeof share.low52W === "number" ? share.low52W : lastILS;
  const volume = typeof share.volume === "number" ? share.volume : 0;

  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: lastILS,
            previousClose: prevILS,
            currency: "ILS",
            regularMarketVolume: volume,
            fiftyTwoWeekHigh: high52,
            fiftyTwoWeekLow: low52,
          },
          indicators: { quote: [{ close: [prevILS, lastILS] }] },
        },
      ],
      error: null,
    },
  };
}

/**
 * Fetch TASE quote data via direct request or allorigins proxy.
 * The TASE API uses JSON responses.
 */
async function fetchTASEJson(url: string): Promise<TASEShareResponse> {
  // 1. Direct request
  try {
    const r = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, {
      headers: { Accept: "application/json" },
    });
    if (r.ok) {
      const data = (await r.json()) as TASEShareResponse;
      diagLog(`[${PROVIDER_ID}] direct OK: ${url}`);
      return data;
    }
  } catch {
    // CORS or network failure — fall through to proxy.
  }

  // 2. allorigins proxy
  const allorigins = PROXIES[0]; // "https://api.allorigins.win/get?url="
  const proxyUrl = allorigins + encodeURIComponent(url);
  const r = await fetchWithTimeout(proxyUrl, 12_000);
  if (!r.ok) {
    throw new Error(`TASE proxy HTTP ${r.status}`);
  }

  const wrapper = (await r.json()) as { contents?: string };
  const contents = wrapper.contents;
  if (typeof contents !== "string" || !contents.trim().startsWith("{")) {
    throw new Error("TASE proxy: unexpected contents shape");
  }

  diagLog(`[${PROVIDER_ID}] proxy OK: ${url}`);
  return JSON.parse(contents) as TASEShareResponse;
}

/**
 * Fetch a TASE quote for the given ".TA" ticker symbol and return it in
 * YahooChartResponse shape. Throws on failure so callers can fall back.
 *
 * @param symbol  Ticker like "PERI.TA" or "IDB.TA" (non-index ".TA" only).
 */
export async function fetchTASE(symbol: string): Promise<YahooChartResponse> {
  if (!isTASETicker(symbol)) {
    throw new Error(`[${PROVIDER_ID}] ${symbol} is not a non-index .TA ticker`);
  }

  const cacheKey = `${CACHE_KEY_PREFIX}${symbol.toUpperCase()}`;
  const cached = cGet<YahooChartResponse>(cacheKey, CACHE_TTL_S);
  if (cached !== null) {
    diagLog(`[${PROVIDER_ID}] cache hit ${cacheKey}`);
    return cached;
  }

  const baseName = stripTASESuffix(symbol);
  const url = `${TASE_API_BASE}/GetByName/${encodeURIComponent(baseName)}`;

  diagLog(`[${PROVIDER_ID}] fetching ${symbol} via TASE API`);
  const shareData = await fetchTASEJson(url);

  if (!shareData || typeof shareData.lastPrice !== "number") {
    throw new Error(`[${PROVIDER_ID}] invalid response for ${symbol}`);
  }

  const result = taseToYahooResponse(shareData);
  cSet(cacheKey, result);
  return result;
}
