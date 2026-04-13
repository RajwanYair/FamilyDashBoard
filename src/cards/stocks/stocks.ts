/**
 * FamilyDashBoard v6 — Stocks Card
 *
 * Yahoo Finance v8 chart API. Bare URL (no query params) to avoid
 * allorigins 522 timeouts. BTC-USD uses CoinGecko fallback (CORS-enabled).
 * Renders price, % change, mini sparkline chart, 52-week range.
 */

import { scheduleCard } from "../base-card";
import {
  INTERVALS,
  STOCK_SYMBOLS,
  STOCK_META,
  API,
} from "../../core/constants";
import { cGet, cGetStale, cSet } from "../../core/cache";
import {
  fetchJSON,
  runConcurrent,
  acquireLock,
  releaseLock,
} from "../../core/fetch";
import {
  setSync,
  syncBurst,
  recordSuccess,
  recordFailure,
} from "../../core/sync";
import { isPageVisible } from "../../core/idle";
import { diagLog } from "../../core/diag";
import type { YahooChartResponse, CoinGeckoResponse } from "../../types/api";

// ── Helpers ──
function fmtPrice(price: number, sym: string): string {
  if (price >= 1000)
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 10) return price.toFixed(2);
  if (sym === "^VIX") return price.toFixed(2);
  return price.toFixed(4);
}

function isMarketOpen(): boolean {
  const now = new Date();
  const nyHour = parseInt(
    now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
    }),
    10,
  );
  const nyMin = now.getMinutes();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const nyMins = nyHour * 60 + nyMin;
  return nyMins >= 570 && nyMins < 960; // 9:30 – 16:00 ET
}

function getStockTTL(): number {
  return isMarketOpen() ? INTERVALS.STOCKS_OPEN : INTERVALS.STOCKS_CLOSED;
}

// ── Bezier mini-chart (same as monolith) ──
function bezierChart(prices: number[], color: string): string {
  if (prices.length < 2) return "";
  const W = 80,
    H = 28,
    P = 3;
  const min = Math.min(...prices),
    max = Math.max(...prices),
    range = max - min || 1;
  const pts = prices.map((p, i) => ({
    x: P + (i / (prices.length - 1)) * (W - 2 * P),
    y: H - P - ((p - min) / range) * (H - 2 * P),
  }));
  const first = pts[0]!;
  let path = `M${first.x},${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const cp = (cur.x - prev.x) / 2;
    path += ` C${prev.x + cp},${prev.y} ${cur.x - cp},${cur.y} ${cur.x},${cur.y}`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

// ── Update 52-week range bar ──
function updateStockRange(
  blk: Element,
  cur: number,
  low: number,
  high: number,
): void {
  if (high <= low) return;
  const pct = Math.max(0, Math.min(100, ((cur - low) / (high - low)) * 100));
  const fill = blk.querySelector<HTMLElement>(".stk-range-fill");
  if (fill) fill.style.width = `${pct.toFixed(1)}%`;
}

// ── Render a single stock block ──
function renderStock(
  blk: Element,
  data: YahooChartResponse,
  sym: string,
): void {
  const result = data.chart?.result?.[0];
  if (!result) return;
  const meta = result.meta;
  const prices = (result.indicators?.quote?.[0]?.close ?? []).filter(
    (p): p is number => p !== null && isFinite(p),
  );

  const cur = meta.regularMarketPrice;
  const prev = meta.previousClose ?? cur;
  let chgPct = 0;
  if (prev && cur && isFinite(prev) && prev !== 0) {
    chgPct = ((cur - prev) / prev) * 100;
  }

  const absChg = Math.abs(chgPct);
  const trend =
    !isFinite(chgPct) || absChg < 0.1
      ? "neutral"
      : chgPct > 0
        ? "positive"
        : "negative";
  const trendColor =
    trend === "positive"
      ? "#34d399"
      : trend === "negative"
        ? "#f87171"
        : "#94a3b8";

  const brand = STOCK_META[sym];
  const brandColor = brand?.color ?? "#94a3b8";

  (blk as HTMLElement).style.borderRightColor = brandColor;
  blk.classList.remove("stk-up", "stk-down");
  if (trend === "positive") blk.classList.add("stk-up");
  else if (trend === "negative") blk.classList.add("stk-down");

  const symEl = blk.querySelector<HTMLElement>(".stk-sym");
  if (symEl) symEl.style.color = brandColor;

  const descEl = blk.querySelector(".stk-desc");
  if (descEl) descEl.textContent = brand?.he ?? sym;

  const priceEl = blk.querySelector<HTMLElement>(".stk-price");
  if (priceEl) {
    priceEl.textContent = cur != null ? fmtPrice(cur, sym) : "N/A";
    priceEl.classList.remove("skeleton");
  }

  const chgEl = blk.querySelector<HTMLElement>(".stk-chg");
  if (chgEl) {
    if (isFinite(chgPct) && absChg >= 0.1) {
      chgEl.textContent = `${chgPct > 0 ? "▲" : "▼"} ${chgPct > 0 ? "+" : ""}${chgPct.toFixed(2)}%`;
      chgEl.className = `stk-chg ${trend}`;
    } else if (isFinite(chgPct)) {
      chgEl.textContent = `● ${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(2)}%`;
      chgEl.className = "stk-chg neutral";
    } else {
      chgEl.textContent = "—";
      chgEl.className = "stk-chg";
    }
  }

  const chartEl = blk.querySelector(".stk-chart");
  if (chartEl && prices.length >= 2) {
    chartEl.innerHTML = bezierChart(prices, trendColor);
  }

  const timeEl = blk.querySelector(".stk-time");
  if (timeEl) {
    timeEl.textContent = new Date().toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
  }

  // 52-week range
  if (cur != null && meta.fiftyTwoWeekLow && meta.fiftyTwoWeekHigh) {
    updateStockRange(blk, cur, meta.fiftyTwoWeekLow, meta.fiftyTwoWeekHigh);
  }
}

// ── Fetch a single stock ──
async function fetchStock(sym: string): Promise<YahooChartResponse> {
  // BTC-USD: use CoinGecko (CORS-enabled, Yahoo crypto fails in browser)
  if (sym === "BTC-USD") {
    const cg = await fetchJSON<CoinGeckoResponse>(API.COINGECKO_BTC);
    if (cg?.bitcoin?.usd) {
      const price = cg.bitcoin.usd;
      const chgPct = cg.bitcoin.usd_24h_change ?? 0;
      const prev = price / (1 + chgPct / 100);
      return {
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: price,
                previousClose: prev,
                currency: "USD",
                regularMarketVolume: 0,
              },
              indicators: { quote: [{ close: [prev, price] }] },
            },
          ],
          error: null,
        },
      };
    }
  }

  // Yahoo Finance v8 chart (bare URL — proxy chain for CORS)
  const url = `${API.YAHOO_CHART}${encodeURIComponent(sym)}`;
  return fetchJSON<YahooChartResponse>(url);
}

// ── Load one stock (with DOM update) ──
async function loadStockSingle(sym: string): Promise<boolean> {
  const blk = document.querySelector(`[data-symbol="${sym}"]`);
  if (!blk) return false;
  const key = `stk-${sym}`;
  try {
    const data = await fetchStock(sym);
    if (data.chart?.result?.[0]) {
      cSet(key, data);
      renderStock(blk, data, sym);
      diagLog(`[stocks] ${sym} OK`);
      return true;
    }
  } catch (err) {
    diagLog(`[stocks] ${sym} failed: ${String(err)}`);
    const stale = cGetStale<YahooChartResponse>(key);
    if (!stale) {
      const priceEl = blk.querySelector<HTMLElement>(".stk-price");
      if (priceEl) {
        priceEl.textContent = "N/A";
        priceEl.classList.remove("skeleton");
      }
    }
  }
  return false;
}

// ── Load all stocks ──
async function loadAllStocks(): Promise<void> {
  if (!isPageVisible() || !acquireLock("stocks")) return;
  setSync("stocks", "loading");

  const ttl = getStockTTL();
  const uncached: string[] = [];

  // Phase 1: Serve cached data immediately
  for (const sym of STOCK_SYMBOLS) {
    const blk = document.querySelector(`[data-symbol="${sym}"]`);
    if (!blk) continue;
    const fresh = cGet<YahooChartResponse>(`stk-${sym}`, ttl);
    if (fresh) {
      renderStock(blk, fresh, sym);
    } else {
      const stale = cGetStale<YahooChartResponse>(`stk-${sym}`);
      if (stale) renderStock(blk, stale, sym);
      uncached.push(sym);
    }
  }

  // Phase 2: Fetch uncached symbols (max 4 concurrent)
  if (uncached.length) {
    const results = await runConcurrent(
      uncached.map((sym) => () => loadStockSingle(sym)),
      4,
    );
    const anyOk = results.some((r) => r.status === "fulfilled" && r.value);
    if (anyOk) {
      setSync("stocks", "ok");
      syncBurst("stocks");
      recordSuccess("stocks");
    } else {
      setSync(
        "stocks",
        uncached.length === STOCK_SYMBOLS.length ? "error" : "ok",
      );
      recordFailure("stocks");
    }
  } else {
    setSync("stocks", "ok");
    syncBurst("stocks");
    recordSuccess("stocks");
  }

  releaseLock("stocks");

  // Update gainers/losers summary
  updateStockSummary();
}

function updateStockSummary(): void {
  const summaryEl = document.getElementById("stk-summary");
  if (!summaryEl) return;
  const stocks = document.querySelectorAll("#stocks-body .stk");
  let up = 0,
    dn = 0,
    flat = 0;
  stocks.forEach((s) => {
    if (s.classList.contains("stk-up")) up++;
    else if (s.classList.contains("stk-down")) dn++;
    else flat++;
  });
  if (up + dn + flat === 0) {
    summaryEl.textContent = "";
    return;
  }
  summaryEl.textContent = `📈 ${up} עולות  •  📉 ${dn} יורדות  •  ➡️ ${flat} יציבות`;
}

export function initStocksCard(): void {
  void loadAllStocks();
  scheduleCard(
    loadAllStocks,
    isMarketOpen() ? INTERVALS.STOCKS_OPEN : INTERVALS.STOCKS_CLOSED,
  );
  diagLog("[stocks] Initialized");
}
