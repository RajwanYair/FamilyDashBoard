/**
 * FamilyDashBoard v6 — Currency Card
 *
 * Fetches exchange rates from open.er-api.com (ILS base) + gold/silver
 * metals (XAU/XAG) from the same endpoint.
 * Renders tiles: USD, EUR, GBP, Gold, Silver.
 * Falls back to exchangerate-api.com if primary fails.
 */

import { createCardLoader, scheduleCard } from "../base-card";
import "./currency.css";
import {
  INTERVALS,
  CUR_TILES,
  API,
  LS_CUR_HISTORY,
} from "../../core/constants";
import { diagLog } from "../../core/diag";
import { fetchJSONWithWorker } from "../../core/fetch";
import type { CurrencyResponse } from "../../types/api";

// ── State ──
let _prevRates: Record<string, number> = {};
let _lastFetchTime: Date | null = null;

// ── Sprint 24: 7-day rate history ─────────────────────────────────────────────

// LS_CUR_HISTORY imported from constants
const CUR_HISTORY_MAX_DAYS = 7;

interface CurHistoryEntry {
  date: string; // YYYY-MM-DD
  rates: Record<string, number>; // raw rates (ILS-based, same format as API)
}

/** Load the currency rate history from localStorage (up to 7 entries). */
export function loadCurrencyHistory(): CurHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_CUR_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as CurHistoryEntry[];
  } catch {
    return [];
  }
}

/** Store today's rates snapshot into the 7-day rolling history. */
export function storeCurrencyHistory(rates: Record<string, number>): void {
  const today = new Date().toISOString().slice(0, 10);
  let history = loadCurrencyHistory();
  // Replace today's entry if already present, or append
  history = history.filter((e) => e.date !== today);
  history.push({ date: today, rates });
  // Keep only the last 7 entries
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
 * Compute the 7-day percentage change for a given currency key.
 * Returns null when insufficient history is available.
 * @param key  Currency key (e.g. "USD", "EUR", "XAU")
 * @param history  Loaded history array
 */
export function get7DayTrend(
  key: string,
  history: CurHistoryEntry[],
): { pct: number; arrow: "↑" | "↓" | "→" } | null {
  if (history.length < 2) return null;
  // Find the oldest available entry (≤ 7 days ago)
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

/** Format a past date as a relative Hebrew label (e.g. "לפני 5 דק׳"). */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
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
  usdChg: HTMLElement | null;
  eurChg: HTMLElement | null;
  gbpChg: HTMLElement | null;
  goldChg: HTMLElement | null;
  silverChg: HTMLElement | null;
  body: HTMLElement | null;
  lastFetch: HTMLElement | null;
}

let curEls: CurEls = {
  usd: null,
  eur: null,
  gbp: null,
  gold: null,
  silver: null,
  usdChg: null,
  eurChg: null,
  gbpChg: null,
  goldChg: null,
  silverChg: null,
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
};

export function cacheDom(): void {
  curEls = {
    usd: document.getElementById("curUsd"),
    eur: document.getElementById("curEur"),
    gbp: document.getElementById("curGbp"),
    gold: document.getElementById("curGold"),
    silver: document.getElementById("curSilver"),
    usdChg: document.getElementById("curUsdChg"),
    eurChg: document.getElementById("curEurChg"),
    gbpChg: document.getElementById("curGbpChg"),
    goldChg: document.getElementById("curGoldChg"),
    silverChg: document.getElementById("curSilverChg"),
    body: document.getElementById("currency-body"),
    lastFetch: document.getElementById("cur-last-fetch"),
  };
}

// ── Fetch exchange rates ──
export async function fetchCurrency(): Promise<Record<string, number>> {
  const apis = [API.CURRENCY_PRIMARY, API.CURRENCY_FALLBACK] as const;
  for (const apiUrl of apis) {
    try {
      const json = await fetchJSONWithWorker<CurrencyResponse>(apiUrl);
      if (json.rates && Object.keys(json.rates).length > 0) {
        diagLog(`FDB-031: [currency] Rates OK from ${apiUrl}`);
        return json.rates;
      }
    } catch {
      continue;
    }
  }
  throw new Error("All currency APIs failed");
}

// ── Render currency tiles ──
export function renderCurrency(rates: Record<string, number>): void {
  // Sprint 24: persist today's snapshot before rendering
  storeCurrencyHistory(rates);
  const history = loadCurrencyHistory();

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
        const diff =
          tile.precision === 0
            ? Math.round(val) - Math.round(prevVal)
            : val - prevVal;
        const threshold =
          tile.precision === 0 ? 5 : tile.precision === 1 ? 0.05 : 0.0005;
        if (Math.abs(diff) > threshold) {
          chgEl.textContent = `${diff > 0 ? "▲" : "▼"} ${Math.abs(tile.precision === 0 ? diff : parseFloat(diff.toFixed(tile.precision)))}`;
          chgEl.className = `cur-chg ${diff > 0 ? "positive" : "negative"}`;
          sessionChangeShown = true;
        }
      }
      if (!sessionChangeShown) {
        // Sprint 24: show 7-day trend when no intra-session change
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

  _prevRates = { ...rates };
  _lastFetchTime = new Date();

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

  diagLog(`FDB-032: [currency] Rendered ${Object.keys(rates).length} rates`);
}

const loadCurrency = createCardLoader<Record<string, number>>(
  { id: "cur", ttl: INTERVALS.CURRENCY, interval: INTERVALS.CURRENCY },
  fetchCurrency,
  renderCurrency,
);

export function initCurrencyCard(): void {
  cacheDom();
  void loadCurrency();
  scheduleCard(loadCurrency, INTERVALS.CURRENCY);
  diagLog("FDB-033: [currency] Initialized");
}
