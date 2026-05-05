/**
 * D8/C-BoI — Bank of Israel currency adapter (ADR-061, v14.0)
 *
 * Fetches the official daily ILS reference rates from the BoI public XML
 * API and returns them in the shared CurrencyRateResponse shape.
 *
 * Chain position (ADR-061): BoI → Frankfurter → ECB → exchangerate.host
 *
 * Fetch path:
 *  1. Direct browser request (works in Cloudflare Worker / Node / permissive).
 *  2. allorigins CORS proxy — returns JSON { contents: "<xml>…" }.
 *
 * The BoI XML format expresses "ILS per 1 (or N) foreign units"
 * (e.g. USD RATE=3.70 means 1 USD = 3.70 ILS).
 * We invert to match the open.er-api.com "1 ILS in foreign currency" shape.
 */

import type { CurrencyRateResponse } from "./currency-adapter";
import { API, PROXIES, FETCH_TIMEOUT_MS } from "../../core/constants";
import { fetchWithTimeout } from "../../core/fetch";
import { diagLog } from "../../core/diag";

// Israel geographic bounds for geo-gating (ADR-061 §Adapter Contract rule 4).
export const IL_LAT_MIN = 29.4;
export const IL_LAT_MAX = 33.4;
export const IL_LON_MIN = 34.2;
export const IL_LON_MAX = 35.9;

/**
 * Return true when `lat`/`lon` falls inside Israel's bounding box.
 * Used by callers to decide whether to prefer BoI over generic providers.
 */
export function isILGeo(lat: number, lon: number): boolean {
  return lat >= IL_LAT_MIN && lat <= IL_LAT_MAX && lon >= IL_LON_MIN && lon <= IL_LON_MAX;
}

/**
 * Parse the BoI XML exchange-rate response into a CurrencyRateResponse.
 *
 * BoI XML shape (simplified):
 * ```xml
 * <EXCHANGERATES>
 *   <LAST_UPDATE>2026-05-05</LAST_UPDATE>
 *   <CURRENCY>
 *     <NAME>Dollar</NAME>
 *     <UNIT>1</UNIT>
 *     <CURRENCYCODE>USD</CURRENCYCODE>
 *     <COUNTRY>USA</COUNTRY>
 *     <RATE>3.7200</RATE>
 *     <CHANGE>0.020</CHANGE>
 *   </CURRENCY>
 *   …
 * </EXCHANGERATES>
 * ```
 * RATE is "ILS per UNIT foreign-currency units".
 * We convert to "1 ILS = ? foreign currency" (inverted) to match the
 * open.er-api.com shape: `{ rates: { USD: 0.269, EUR: 0.248, … }, base_code: "ILS" }`.
 *
 * Exported for direct use in unit tests.
 */
export function parseBoIRates(xmlText: string): CurrencyRateResponse {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // DOMParser signals errors via a <parsererror> element.
  if (doc.querySelector("parsererror")) {
    throw new Error("BoI XML parse error: malformed XML document");
  }

  const rates: Record<string, number> = { ILS: 1.0 };

  for (const el of doc.querySelectorAll("CURRENCY")) {
    const code = el.querySelector("CURRENCYCODE")?.textContent?.trim();
    const rateText = el.querySelector("RATE")?.textContent?.trim();
    const unitText = el.querySelector("UNIT")?.textContent?.trim();

    if (!code || !rateText) continue;

    const ilsPerUnit = parseFloat(rateText);
    const unit = unitText ? parseFloat(unitText) : 1;

    if (!isFinite(ilsPerUnit) || ilsPerUnit <= 0) continue;
    if (!isFinite(unit) || unit <= 0) continue;

    // ilsPerUnit is ILS per `unit` foreign units → ILS per 1 foreign unit
    const ilsPerOne = ilsPerUnit / unit;
    // Inverted: 1 ILS = (1 / ilsPerOne) foreign units
    rates[code] = 1 / ilsPerOne;
  }

  if (Object.keys(rates).length <= 1) {
    throw new Error("BoI XML: no valid currency entries found");
  }

  return { rates, base_code: "ILS" };
}

/**
 * Fetch the raw BoI XML text.
 * 1. Tries a direct HTTP request (succeeds in Worker/Node or CORS-permissive envs).
 * 2. Falls back to allorigins CORS proxy → unwraps `{ contents: "…" }`.
 * Throws when both paths fail.
 */
async function fetchBoIXmlText(): Promise<string> {
  // 1. Direct request
  try {
    const r = await fetchWithTimeout(API.CURRENCY_BOI, FETCH_TIMEOUT_MS);
    if (r.ok) {
      diagLog("FDB-D8-BOI: direct XML fetch OK");
      return r.text();
    }
  } catch {
    // CORS or network failure — fall through to proxy.
  }

  // 2. allorigins proxy (first entry in PROXIES array).
  const allorigins = PROXIES[0]; // "https://api.allorigins.win/get?url="
  const proxyUrl = allorigins + encodeURIComponent(API.CURRENCY_BOI);
  const r = await fetchWithTimeout(proxyUrl, 12_000);
  if (!r.ok) {
    throw new Error(`BoI proxy HTTP ${r.status}`);
  }

  const wrapper = (await r.json()) as { contents?: string };
  const contents = wrapper.contents;
  if (typeof contents !== "string" || !contents.includes("<CURRENCY>")) {
    throw new Error("BoI proxy: unexpected response shape (missing <CURRENCY>)");
  }

  diagLog("FDB-D8-BOI: proxy XML fetch OK");
  return contents;
}

/**
 * Fetch and parse the Bank of Israel daily ILS reference rates.
 * Returns a CurrencyRateResponse in the standard provider shape.
 * Throws on any failure so the caller can fall through to the next provider.
 */
export async function fetchBoIRates(): Promise<CurrencyRateResponse> {
  const xml = await fetchBoIXmlText();
  return parseBoIRates(xml);
}
