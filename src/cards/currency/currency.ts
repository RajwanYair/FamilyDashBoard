/**
 * FamilyDashBoard v13 — Currency Card
 *
 * Fetches exchange rates from open.er-api.com (ILS base) + gold/silver
 * metals (XAU/XAG) from the same endpoint.
 * Renders tiles: USD, EUR, GBP, Gold, Silver.
 * Falls back to exchangerate-api.com if primary fails.
 *
 * X12/X15 protocol adopted (see ADR-071). */

import "./currency.css";
import {
  INTERVALS,
  CUR_TILES,
  API,
  LS_CUR_HISTORY,
  MS_PER_MIN,
  WORKER_BASE_URL,
} from "../../core/constants";
import { diagLog } from "../../core/diag";
import { fetchJSONWithWorker, acquireLock, releaseLock } from "../../core/fetch";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { setSync, syncBurst, recordSuccess, recordFailure } from "../../core/sync";
import { isPageVisible } from "../../core/idle";
import { historyAppend, historyGet, sparklineSvg } from "../../core/history";
import { trustedHTML } from "../../core/trusted-types";
import { loadConfig } from "../../core/config";
import type { CurrencyResponse, YahooChartResponse, CoinGeckoResponse } from "../../types/api";
import type { CardConfigField } from "../../types/card";
import { setCardSignal } from "../../core/card-signal-protocol";
import { registerSemanticProducer } from "../../core/semantic-clipboard";
import { markFresh, renderFreshnessBadge } from "../../core/freshness";
import type { SemanticPayload } from "../../types/semantic-clipboard";
import {
  today,
  toISODateString,
  addDays,
  parsePlainDateMs,
  fromEpochMs,
  fromDateString,
} from "../../core/temporal";

// X15: cached snapshot of headline rates for the semantic-clipboard producer.
let _ratesSnapshot: { usdIls: number; eurIls: number } | null = null;

function buildCurrencyPayload(): SemanticPayload | null {
  const r = _ratesSnapshot;
  if (!r) return null;
  return {
    cardId: "currency",
    text: `שערי חליפין · USD ₪${r.usdIls.toFixed(2)} · EUR ₪${r.eurIls.toFixed(2)}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ExchangeRateSpecification",
      currency: "ILS",
      currentExchangeRate: [
        { "@type": "UnitPriceSpecification", price: r.usdIls, priceCurrency: "USD" },
        { "@type": "UnitPriceSpecification", price: r.eurIls, priceCurrency: "EUR" },
      ],
    },
    ts: Date.now(),
  };
}

// ── State ──
let _prevRates: Record<string, number> = {};
let _lastFetchTime: Date | null = null;

// 7-day rate history / extended to 30-day ──────

// LS_CUR_HISTORY imported from constants
const CUR_HISTORY_MAX_DAYS = 30;

interface CurHistoryEntry {
  date: string; // YYYY-MM-DD
  rates: Record<string, number>; // raw rates (ILS-based, same format as API)
}

/** Load the currency rate history from localStorage (up to 30 entries). */
export function loadCurrencyHistory(): CurHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_CUR_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as CurHistoryEntry[];
  } catch {
    return [];
  }
}

/** Store today's rates snapshot into the 30-day rolling history. */
export function storeCurrencyHistory(rates: Record<string, number>): void {
  const now = today();
  const todayStr = toISODateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
  let history = loadCurrencyHistory();
  // Replace today's entry if already present, or append
  history = history.filter((e) => e.date !== todayStr);
  history.push({ date: todayStr, rates });
  // Keep only the last 30 entries
  if (history.length > CUR_HISTORY_MAX_DAYS) {
    history = history.slice(-CUR_HISTORY_MAX_DAYS);
  }
  try {
    localStorage.setItem(LS_CUR_HISTORY, JSON.stringify(history));
  } catch {
    /* quota */
  }
}

/**
 * Compute the 30-day percentage change for a given currency key.
 * Returns null when insufficient history is available.
 * @param key  Currency key (e.g. "USD", "EUR", "XAU")
 * @param history  Loaded history array
 */
export function get7DayTrend(
  key: string,
  history: CurHistoryEntry[],
): { pct: number; arrow: "↑" | "↓" | "→" } | null {
  if (history.length < 2) return null;
  // Find the oldest available entry (≤ 30 days ago)
  const oldest = history[0];
  const newest = history[history.length - 1];
  if (!oldest || !newest) return null;
  const oldRate = oldest.rates[key];
  const newRate = newest.rates[key];
  if (!oldRate || !newRate || oldRate === 0) return null;
  // To ILS per foreign unit
  const oldVal = 1 / oldRate;
  const newVal = 1 / newRate;
  const pct = ((newVal - oldVal) / oldVal) * 100;
  const arrow: "↑" | "↓" | "→" = Math.abs(pct) < 0.1 ? "→" : pct > 0 ? "↑" : "↓";
  return { pct, arrow };
}

/**
 * Compute currency trend for a specific time window.
 * Searches back at most `days` calendar days in `history` for a reference entry.
 * Returns null when no suitable reference entry exists.
 */
export function getCurrencyTrend(
  key: string,
  history: CurHistoryEntry[],
  days: number,
): { pct: number; arrow: "↑" | "↓" | "→" } | null {
  if (history.length < 2) return null;
  const newest = history[history.length - 1];
  if (!newest) return null;
  const newRate = newest.rates[key];
  if (!newRate || newRate === 0) return null;
  const newVal = 1 / newRate;

  const cutoffDate = addDays(fromEpochMs(parsePlainDateMs(newest.date)), -days);
  const cutoff = toISODateString(
    cutoffDate.getFullYear(),
    cutoffDate.getMonth() + 1,
    cutoffDate.getDate(),
  );

  // Find the most recent entry that is at or before the cutoff
  let ref: CurHistoryEntry | undefined;
  for (let i = history.length - 2; i >= 0; i--) {
    const entry = history[i];
    if (entry && entry.date <= cutoff) {
      ref = entry;
      break;
    }
  }
  if (!ref) return null;
  const oldRate = ref.rates[key];
  if (!oldRate || oldRate === 0) return null;
  const oldVal = 1 / oldRate;
  const pct = ((newVal - oldVal) / oldVal) * 100;
  const arrow: "↑" | "↓" | "→" = Math.abs(pct) < 0.1 ? "→" : pct > 0 ? "↑" : "↓";
  return { pct, arrow };
}

/** Format a past date as a relative Hebrew label (e.g. "לפני 5 דק׳"). */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / MS_PER_MIN);
  if (diffMin < 1) return "עכשיו";
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffH = Math.floor(diffMin / 60);
  return `לפני ${diffH} ש׳`;
}

// ── DOM cache ──
interface CurEls {
  usd: HTMLElement | null;
  eur: HTMLElement | null;
  gbp: HTMLElement | null;
  gold: HTMLElement | null;
  silver: HTMLElement | null;
  oil: HTMLElement | null;
  btc: HTMLElement | null;
  usdChg: HTMLElement | null;
  eurChg: HTMLElement | null;
  gbpChg: HTMLElement | null;
  goldChg: HTMLElement | null;
  silverChg: HTMLElement | null;
  oilChg: HTMLElement | null;
  btcChg: HTMLElement | null;
  body: HTMLElement | null;
  lastFetch: HTMLElement | null;
}

let curEls: CurEls = {
  usd: null,
  eur: null,
  gbp: null,
  gold: null,
  silver: null,
  oil: null,
  btc: null,
  usdChg: null,
  eurChg: null,
  gbpChg: null,
  goldChg: null,
  silverChg: null,
  oilChg: null,
  btcChg: null,
  body: null,
  lastFetch: null,
};

// Map tile key → element IDs
const TILE_EL_MAP: Record<string, { rate: keyof CurEls; chg: keyof CurEls }> = {
  USD: { rate: "usd", chg: "usdChg" },
  EUR: { rate: "eur", chg: "eurChg" },
  GBP: { rate: "gbp", chg: "gbpChg" },
  XAU: { rate: "gold", chg: "goldChg" },
  XAG: { rate: "silver", chg: "silverChg" },
  XOI: { rate: "oil", chg: "oilChg" },
  BTC: { rate: "btc", chg: "btcChg" },
};

// Mini-calculator state ────────────────────────────────

/** Latest fetched rates snapshot (updated by renderCurrency). */
let _calcRates: Record<string, number> = {};

/**
 * Pure helper: convert ILS amount using current rates.
 * `rates[key]` = foreign-units-per-ILS (from er-api base=ILS).
 * Result is how many foreign units the amount in ILS is worth.
 * Returns null when the rate is missing or amount is invalid.
 */
export function calcCurrency(
  amountIls: number,
  rateKey: string,
  rates: Record<string, number>,
): number | null {
  if (!Number.isFinite(amountIls) || amountIls < 0) return null;
  const rate = rates[rateKey];
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  return amountIls * rate;
}

/** Wire up the mini-calculator DOM (called by initCurrencyCard). */
export function initCalcWidget(): void {
  const input = document.getElementById("cur-calc-input") as HTMLInputElement | null;
  const pairSel = document.getElementById("cur-calc-pair") as HTMLSelectElement | null;
  const result = document.getElementById("cur-calc-result");
  if (!input || !pairSel || !result) return;

  const recalc = (): void => {
    const amount = parseFloat(input.value);
    if (!input.value.trim() || isNaN(amount)) {
      result.textContent = "--";
      return;
    }
    const key = pairSel.value;
    const val = calcCurrency(amount, key, _calcRates);
    if (val === null) {
      result.textContent = "--";
      return;
    }
    // Format: BTC gets 6 decimals, gold/silver 4, others 2
    const dec = key === "BTC" ? 6 : key === "XAU" || key === "XAG" ? 4 : 2;
    result.textContent = val.toFixed(dec);
  };

  input.addEventListener("input", recalc);
  pairSel.addEventListener("change", recalc);
}

export function cacheDom(): void {
  curEls = {
    usd: document.getElementById("curUsd"),
    eur: document.getElementById("curEur"),
    gbp: document.getElementById("curGbp"),
    gold: document.getElementById("curGold"),
    silver: document.getElementById("curSilver"),
    oil: document.getElementById("curOil"),
    btc: document.getElementById("curBtc"),
    usdChg: document.getElementById("curUsdChg"),
    eurChg: document.getElementById("curEurChg"),
    gbpChg: document.getElementById("curGbpChg"),
    goldChg: document.getElementById("curGoldChg"),
    silverChg: document.getElementById("curSilverChg"),
    oilChg: document.getElementById("curOilChg"),
    btcChg: document.getElementById("curBtcChg"),
    body: document.getElementById("currency-body"),
    lastFetch: document.getElementById("cur-last-fetch"),
  };
}

// Multi-pair watch — apply visibility from config ─────────

/**
 * Shows or hides `.cur-item` rows based on `currencyHiddenPairs` config.
 * Reads comma-separated pair keys (e.g. "XAG,BTC") and adds/removes
 * the `is-hidden` class on the parent `.cur-item` element.
 */
export function applyPairVisibility(): void {
  const cfg = loadConfig();
  const hiddenSet = new Set(
    (cfg.currencyHiddenPairs ?? "")
      .split(",")
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean),
  );
  for (const tile of CUR_TILES) {
    const elMap = TILE_EL_MAP[tile.key];
    if (!elMap) continue;
    const rateEl = curEls[elMap.rate];
    if (!rateEl) continue;
    const item = rateEl.closest(".cur-item");
    if (!item) continue;
    if (hiddenSet.has(tile.key)) {
      item.classList.add("is-hidden");
    } else {
      item.classList.remove("is-hidden");
    }
  }
}

// ── Fetch gold & silver from Yahoo Finance (GC=F, SI=F) and inject into rates ──
// er-api base=ILS: rates["USD"] = USD per ILS → goldIls = goldUsd / rates["USD"]
// Stored as rate = usdRate / metalUsd so render val = 1/rate = goldIls correctly.
async function fetchMetalRates(rates: Record<string, number>): Promise<void> {
  const usdRate = rates["USD"];
  if (!usdRate || usdRate <= 0) return;

  const [goldResult, silverResult, oilResult] = await Promise.allSettled([
    fetchJSONWithWorker<YahooChartResponse>(`${API.YAHOO_CHART}${encodeURIComponent("GC=F")}`),
    fetchJSONWithWorker<YahooChartResponse>(`${API.YAHOO_CHART}${encodeURIComponent("SI=F")}`),
    fetchJSONWithWorker<YahooChartResponse>(`${API.YAHOO_CHART}${encodeURIComponent("CL=F")}`),
  ]);

  if (goldResult.status === "fulfilled") {
    const price = goldResult.value?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) {
      rates["XAU"] = usdRate / price;
      diagLog(`FDB-031b: [currency] Gold OK – $${price.toFixed(2)}`);
    }
  } else {
    diagLog("FDB-031b: [currency] Gold fetch failed");
  }

  if (silverResult.status === "fulfilled") {
    const price = silverResult.value?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) {
      rates["XAG"] = usdRate / price;
      diagLog(`FDB-031c: [currency] Silver OK – $${price.toFixed(2)}`);
    }
  } else {
    diagLog("FDB-031c: [currency] Silver fetch failed");
  }

  if (oilResult.status === "fulfilled") {
    const price = oilResult.value?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof price === "number" && price > 0) {
      rates["XOI"] = usdRate / price;
      diagLog(`FDB-031d: [currency] Oil OK – $${price.toFixed(2)}`);
    }
  } else {
    diagLog("FDB-031d: [currency] Oil fetch failed");
  }
}

// ── Fetch BTC price from worker and inject as BTC key into rates ──
// Stores BTC as a synthetic rate: BTC = usdPerIls / btcUsd
// so that renderCurrency can compute ilsVal = 1/rate = btcIls consistently.
async function fetchBtcRate(rates: Record<string, number>): Promise<void> {
  const usdRate = rates["USD"];
  if (!usdRate || usdRate <= 0) return;
  try {
    const json = await fetchJSONWithWorker<CoinGeckoResponse>(
      `${WORKER_BASE_URL}/api/crypto?ids=bitcoin&vs_currencies=usd`,
    );
    const btcUsd = json?.bitcoin?.usd;
    if (typeof btcUsd === "number" && btcUsd > 0) {
      // rates[USD] = USD-per-ILS; 1/rates[USD] = ILS-per-USD
      // BTC in ILS = btcUsd / (1/rates[USD]) = btcUsd * rates[USD]
      // Store as inverted rate so renderCurrency does: ilsVal = 1/rates[BTC]
      rates["BTC"] = 1 / (btcUsd * (1 / usdRate));
      diagLog(`FDB-031e: [currency] BTC OK – $${btcUsd.toLocaleString()}`);
    }
  } catch {
    diagLog("FDB-031e: [currency] BTC fetch failed");
  }
}

// ── Fetch exchange rates ──
export async function fetchCurrency(): Promise<Record<string, number>> {
  const apis = [API.CURRENCY_PRIMARY, API.CURRENCY_FALLBACK] as const;
  for (const apiUrl of apis) {
    try {
      const json = await fetchJSONWithWorker<CurrencyResponse>(apiUrl);
      if (json.rates && Object.keys(json.rates).length > 0) {
        diagLog(`FDB-031: [currency] Rates OK from ${apiUrl}`);
        const rates = { ...json.rates };
        await fetchMetalRates(rates);
        await fetchBtcRate(rates);
        return rates;
      }
    } catch {
      continue;
    }
  }
  throw new Error("All currency APIs failed");
}

// Tile key → spark element ID
const SPARK_EL: Record<string, string> = {
  USD: "cur-usd-spark",
  EUR: "cur-eur-spark",
  GBP: "cur-gbp-spark",
  XAU: "cur-gold-spark",
  XAG: "cur-silver-spark",
  XOI: "cur-oil-spark",
  BTC: "cur-btc-spark",
};

/**
 * Write today's ILS value per tile to IDB history and re-render sparklines.
 * Runs asynchronously — never blocks the synchronous render path.
 */
async function renderCurrencySparklines(rates: Record<string, number>): Promise<void> {
  const writes = Object.entries(SPARK_EL).map(async ([key, svgId]) => {
    const rawRate = rates[key];
    if (!rawRate || rawRate <= 0) return;
    const ilsValue = 1 / rawRate;

    // Persist to IDB history
    await historyAppend(`cur:${key}`, ilsValue);

    // Fetch the 30-day window and render
    const values = await historyGet(`cur:${key}`, 30);
    if (values.length < 2) return;

    const svgEl = document.getElementById(svgId);
    if (!svgEl) return;

    const positive = ilsValue >= (values[0] ?? ilsValue);
    const color = positive ? "var(--positive)" : "var(--negative)";
    svgEl.innerHTML = trustedHTML(sparklineSvg(values, color));
  });
  await Promise.allSettled(writes);
}

// ── Render currency tiles ──
export function renderCurrency(rates: Record<string, number>): void {
  // persist today's snapshot before rendering
  storeCurrencyHistory(rates);
  const history = loadCurrencyHistory();

  // keep calc rates up-to-date
  _calcRates = rates;

  // X12: publish ILS-quoted headline rates for sibling consumers.
  const usdRate = rates["USD"];
  const eurRate = rates["EUR"];
  const usdIls = usdRate && usdRate > 0 ? 1 / usdRate : null;
  const eurIls = eurRate && eurRate > 0 ? 1 / eurRate : null;
  if (usdIls !== null) setCardSignal("currency", "usd-ils", { ils: usdIls });
  if (eurIls !== null) setCardSignal("currency", "eur-ils", { ils: eurIls });
  if (usdIls !== null && eurIls !== null) {
    _ratesSnapshot = { usdIls, eurIls };
  }

  for (const tile of CUR_TILES) {
    const elMap = TILE_EL_MAP[tile.key];
    if (!elMap) continue;

    const rateEl = curEls[elMap.rate];
    const chgEl = curEls[elMap.chg];
    if (!rateEl) continue;

    const rawRate = rates[tile.key];
    // er-api base=ILS: rate means how many ILS per 1 foreign unit — already ILS price
    // Actually open.er-api.com base is ILS, so 1 ILS = rates[USD] USD
    // To get ILS per USD: value = 1 / rates[USD]
    const val = rawRate ? 1 / rawRate : null;

    if (val !== null) {
      const display =
        tile.precision === 0
          ? `₪${Math.round(val).toLocaleString("he-IL")}`
          : `₪${val.toFixed(tile.precision)}`;
      rateEl.textContent = display;
      rateEl.classList.remove("skeleton");
    } else {
      rateEl.textContent = "--";
    }

    // Change indicator vs. previous fetch
    if (chgEl) {
      const prevRaw = _prevRates[tile.key];
      let sessionChangeShown = false;
      if (prevRaw && rawRate && val !== null) {
        const prevVal = 1 / prevRaw;
        const diff = tile.precision === 0 ? Math.round(val) - Math.round(prevVal) : val - prevVal;
        const threshold = tile.precision === 0 ? 5 : tile.precision === 1 ? 0.05 : 0.0005;
        if (Math.abs(diff) > threshold) {
          chgEl.textContent = `${diff > 0 ? "▲" : "▼"} ${Math.abs(tile.precision === 0 ? diff : parseFloat(diff.toFixed(tile.precision)))}`;
          chgEl.className = `cur-chg ${diff > 0 ? "positive" : "negative"}`;
          sessionChangeShown = true;
        }
      }
      if (!sessionChangeShown) {
        // show 1d / 7d / 30d trend arrows
        const t1 = getCurrencyTrend(tile.key, history, 1);
        const t7 = getCurrencyTrend(tile.key, history, 7);
        const t30 = getCurrencyTrend(tile.key, history, 30);
        const parts: string[] = [];
        if (t1) parts.push(`1d${t1.arrow}${t1.pct >= 0 ? "+" : ""}${t1.pct.toFixed(1)}%`);
        if (t7) parts.push(`7d${t7.arrow}${t7.pct >= 0 ? "+" : ""}${t7.pct.toFixed(1)}%`);
        if (t30) parts.push(`30d${t30.arrow}${t30.pct >= 0 ? "+" : ""}${t30.pct.toFixed(1)}%`);
        if (parts.length > 0) {
          chgEl.textContent = parts.join(" · ");
          // Colour by 7d trend if available, else by 1d
          const dominant = t7 ?? t1;
          chgEl.className = `cur-chg${dominant ? (dominant.pct > 0.1 ? " positive" : dominant.pct < -0.1 ? " negative" : "") : ""}`;
        } else {
          // Fall back to legacy 7-day trend (uses full history range)
          const trend = get7DayTrend(tile.key, history);
          if (trend) {
            const sign = trend.pct >= 0 ? "+" : "";
            chgEl.textContent = `7d ${trend.arrow} ${sign}${trend.pct.toFixed(1)}%`;
            chgEl.className = `cur-chg ${trend.pct > 0.1 ? "positive" : trend.pct < -0.1 ? "negative" : ""}`;
          } else {
            chgEl.textContent = "";
            chgEl.className = "cur-chg";
          }
        }
      }
    }
  }

  _prevRates = { ...rates };
  _lastFetchTime = today();

  // Update last-fetch timestamp chip
  if (curEls.lastFetch) {
    curEls.lastFetch.textContent = _lastFetchTime.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
    curEls.lastFetch.title = `עדכון אחרון: ${formatRelativeTime(_lastFetchTime)}`;
  }

  // Flash data-fresh animation
  if (curEls.body) {
    curEls.body.classList.remove("data-fresh");
    void curEls.body.offsetWidth;
    curEls.body.classList.add("data-fresh");
  }

  // IDB history + sparklines (async — non-blocking)
  void renderCurrencySparklines(rates);

  // apply hidden-pair visibility after each render
  applyPairVisibility();

  diagLog(`FDB-032: [currency] Rendered ${Object.keys(rates).length} rates`);
}

/** Returns cache TTL for exchange rates: shorter when US markets are active. */
function getCurrencyTTL(): number {
  // Mirror isMarketOpen() from stocks.ts — forex rates move with NYSE hours.
  const nyDate = fromDateString(today().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = nyDate.getDay();
  if (day === 0 || day === 6) return INTERVALS.CURRENCY;
  const nyTimeStr = today().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  });
  const [h, m] = nyTimeStr.split(":");
  const nyMins = parseInt(h!, 10) * 60 + parseInt(m!, 10);
  return nyMins >= 570 && nyMins < 960 ? INTERVALS.CURRENCY_OPEN : INTERVALS.CURRENCY;
}

/** Load currency rates: cache check → fetch → render. Market-aware TTL. */
export async function loadCurrency(): Promise<void> {
  if (!isPageVisible() || !acquireLock("cur")) return;
  setSync("cur", "loading");

  const ttl = getCurrencyTTL();
  const fresh = cGet<Record<string, number>>("cur", ttl);
  if (fresh !== null) {
    renderCurrency(fresh);
    setSync("cur", "ok");
    releaseLock("cur");
    return;
  }

  const stale = cGetStale<Record<string, number>>("cur");
  if (stale !== null) renderCurrency(stale);

  try {
    const data = await fetchCurrency();
    cSet("cur", data);
    renderCurrency(data);
    setSync("cur", "ok");
    syncBurst("cur");
    recordSuccess("cur");
    markFresh("cur");
  } catch (err) {
    diagLog(`[currency] Load failed: ${String(err)}`);
    setSync("cur", stale !== null ? "ok" : "error");
    recordFailure("cur");
  } finally {
    releaseLock("cur");
  }
}

let _curScheduleId: number | null = null;

/**
 * Return the most-recently-fetched currency rates (stale ok).
 * Used by the stocks card to convert USD prices to ILS.
 * Rates are ILS-based (1 ILS expressed in foreign currency); USD rate → 1/rate = ILS per USD.
 */
export function getLastCurrencyRates(): Record<string, number> | null {
  return cGetStale<Record<string, number>>("cur");
}

/** Market-aware self-rescheduling refresh: 10 min when active, 60 min when closed. */
function scheduleCurrencyRefresh(): void {
  const delay = getCurrencyTTL(); // same as the TTL boundary — avoids over-fetching
  _curScheduleId = window.setTimeout(() => {
    void loadCurrency();
    scheduleCurrencyRefresh();
  }, delay);
}

export function initCurrencyCard(): void {
  cacheDom();
  registerSemanticProducer("currency", buildCurrencyPayload);
  applyPairVisibility(); // hide unconfigured pairs on init

  // Mount freshness badge in card header
  const hd = document.querySelector(
    '[data-card-id="currency"] .card-hd-title, [data-card-id="currency"] .card__hd-title',
  );
  if (hd) renderFreshnessBadge("cur", hd as HTMLElement);

  void loadCurrency();
  scheduleCurrencyRefresh();
  initCalcWidget(); // // F15: Popover API quick-reload button wiring
  const reloadBtn = document.getElementById("cur-reload-btn");
  const reloadPopover = document.getElementById("cur-reload-popover");
  if (reloadBtn && reloadPopover) {
    reloadBtn.addEventListener("click", () => {
      if (typeof reloadPopover.showPopover === "function") reloadPopover.showPopover();
      void loadCurrency().then(() => {
        if (typeof reloadPopover.hidePopover === "function") reloadPopover.hidePopover();
      });
    });
  }
  diagLog("FDB-033: [currency] Initialized");
}

export function destroyCurrencyCard(): void {
  if (_curScheduleId !== null) {
    clearTimeout(_curScheduleId);
    _curScheduleId = null;
  }
}

// configSchema ────────────────────────────────────────────────

export const currencyConfigSchema: CardConfigField[] = [
  {
    key: "currencyDecimals",
    labelHe: "ספרות אחרי נקודה",
    labelEn: "Decimal places",
    type: "range",
    defaultValue: 2,
    min: 0,
    max: 4,
    step: 1,
    group: "תצוגה",
    groupOpenByDefault: true,
  },
  // Multi-pair watch — hide individual pairs
  {
    key: "currencyHiddenPairs",
    labelHe: "הסתר זוגות (מופרד בפסיקים, לדוגמה: XAG,BTC)",
    labelEn: "Hidden pairs (comma-separated, e.g. XAG,BTC)",
    type: "text",
    defaultValue: "",
    placeholder: "XAG,BTC",
    group: "תצוגה",
  }, // base selector + calc/trend/sparkline ───────────────────────────
  {
    key: "currencyBase",
    labelHe: "מטבע בסיס",
    labelEn: "Base currency",
    type: "select",
    defaultValue: "ILS",
    options: [
      { value: "ILS", label: "שקל (ILS)" },
      { value: "USD", label: "דולר (USD)" },
      { value: "EUR", label: "אירו (EUR)" },
    ],
    group: "תצוגה",
  },
  {
    key: "currencyShowCalc",
    labelHe: "הצג מחשבון המרה",
    labelEn: "Show currency calculator",
    type: "boolean",
    defaultValue: false,
    group: "תצוגה",
  },
  {
    key: "currencyShowTrend",
    labelHe: "הצג שינוי יומי",
    labelEn: "Show daily trend arrow",
    type: "boolean",
    defaultValue: true,
    group: "תצוגה",
  },
  {
    key: "currencyShowSparkline",
    labelHe: "הצג גרף זעיר",
    labelEn: "Show sparkline chart",
    type: "boolean",
    defaultValue: true,
    group: "תצוגה",
  },
];

/** Reset module-level state (for tests only). */
export function _resetCurrencyForTest(): void {
  _prevRates = {};
  _lastFetchTime = null;
  _calcRates = {};
  curEls = {
    usd: null,
    eur: null,
    gbp: null,
    gold: null,
    silver: null,
    oil: null,
    btc: null,
    usdChg: null,
    eurChg: null,
    gbpChg: null,
    goldChg: null,
    silverChg: null,
    oilChg: null,
    btcChg: null,
    body: null,
    lastFetch: null,
  };
}
