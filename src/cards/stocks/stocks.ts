/**
 * FamilyDashBoard v7 — Stocks Card
 *
 * Yahoo Finance v8 chart API. Bare URL (no query params) to avoid
 * allorigins 522 timeouts. BTC-USD uses CoinGecko fallback (CORS-enabled).
 * Renders price, % change, mini sparkline chart, 52-week range.
 */

import { scheduleCard } from "../base-card";
import "./stocks.css";
import {
  INTERVALS,
  STOCK_SYMBOLS,
  STOCK_META,
  API,
  LS_STOCK_ALERTS,
  LS_PORTFOLIO,
} from "../../core/constants";
import { cGet, cGetStale, cSet } from "../../core/cache";
import {
  fetchJSONWithWorker,
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
import { loadConfig } from "../../core/config";
import { showToast } from "../../ui/toast";
import type { YahooChartResponse, CoinGeckoResponse } from "../../types/api";

// ── Helpers ──
export function fmtPrice(price: number, sym: string): string {
  if (price >= 1000)
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 10) return price.toFixed(2);
  if (sym === "^VIX") return price.toFixed(2);
  return price.toFixed(4);
}

/**
 * Format a trading volume number with K/M/B suffix.
 * e.g. 1_234_567 → "1.2M"
 */
export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return String(vol);
}

/**
 * Return the position (0–1) of `price` within the 52-week [low, high] range.
 * Returns null when range data is missing or low === high.
 */
export function priceInRange52w(
  price: number,
  low52: number,
  high52: number,
): number | null {
  if (low52 == null || high52 == null || high52 <= low52) return null;
  return Math.max(0, Math.min(1, (price - low52) / (high52 - low52)));
}

/** Map of well-known stock symbols to display emoji by sector. */
const SECTOR_EMOJI: Record<string, string> = {
  AAPL: "🍎",
  MSFT: "🪟",
  GOOGL: "🔍",
  GOOG: "🔍",
  META: "📘",
  AMZN: "📦",
  NVDA: "🎮",
  TSLA: "⚡",
  AMD: "💻",
  INTC: "🔵",
  JPM: "🏦",
  BAC: "🏦",
  GS: "🏦",
  MS: "🏦",
  WFC: "🏦",
  XOM: "🛢",
  CVX: "🛢",
  COP: "🛢",
  JNJ: "💊",
  PFE: "💊",
  ABBV: "💊",
  MRK: "💊",
  DIS: "🏰",
  NFLX: "🎬",
  SPOT: "🎵",
  "BTC-USD": "₿",
  "ETH-USD": "⟠",
  SPY: "📊",
  QQQ: "📈",
  "^VIX": "📉",
  "^GSPC": "📊",
};

/**
 * Return a sector emoji for a given stock symbol.
 * Falls back to "📈" for unknown symbols.
 */
export function sectorEmoji(sym: string): string {
  return SECTOR_EMOJI[sym.toUpperCase()] ?? "📈";
}

/**
 * Compute the aggregate portfolio % change across all provided quote pairs.
 * Each entry is { prev, cur }. Returns null when list is empty.
 */
export function portfolioChange(
  quotes: Array<{ prev: number; cur: number }>,
): number | null {
  if (!quotes.length) return null;
  const totalPrev = quotes.reduce((s, q) => s + q.prev, 0);
  if (totalPrev === 0) return null;
  const totalCur = quotes.reduce((s, q) => s + q.cur, 0);
  return ((totalCur - totalPrev) / totalPrev) * 100;
}

/**
 * Return a Hebrew label for the current market status.
 * (Re-exports from getMarketStatus, adds Hebrew text.)
 */
export function marketStatusLabel(): string {
  const status = getMarketStatus();
  const labels: Record<MarketStatus, string> = {
    pre: "טרום-שוק",
    open: "שוק פתוח ✅",
    after: "אחרי-שוק",
    closed: "שוק סגור",
  };
  return labels[status];
}

export function isMarketOpen(): boolean {
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

// ── Market status badge (v6.1) ──
export type MarketStatus = "pre" | "open" | "after" | "closed";

export function getMarketStatus(): MarketStatus {
  const now = new Date();
  // Get day-of-week in New York to handle weekends
  const nyDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = nyDate.getDay();
  if (day === 0 || day === 6) return "closed";

  const nyTimeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  });
  const [hourStr, minStr] = nyTimeStr.split(":");
  const nyMins = parseInt(hourStr!, 10) * 60 + parseInt(minStr!, 10);

  if (nyMins < 240) return "closed"; // Midnight – 3:59 AM
  if (nyMins < 570) return "pre"; // 4:00 – 9:29 AM
  if (nyMins < 960) return "open"; // 9:30 AM – 3:59 PM
  if (nyMins < 1200) return "after"; // 4:00 PM – 7:59 PM
  return "closed"; // 8:00 PM+
}

export function getMinutesToNextTransition(): number {
  const now = new Date();
  const nyDate = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = nyDate.getDay();

  const nyTimeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  });
  const [hourStr, minStr] = nyTimeStr.split(":");
  const nyMins = parseInt(hourStr!, 10) * 60 + parseInt(minStr!, 10);

  // Weekend — return 0 (don't show countdown)
  if (day === 0 || day === 6) return 0;

  if (nyMins < 240) return 240 - nyMins; // Until pre-market 4:00 AM
  if (nyMins < 570) return 570 - nyMins; // Until open 9:30 AM
  if (nyMins < 960) return 960 - nyMins; // Until close 4:00 PM
  if (nyMins < 1200) return 1200 - nyMins; // Until after-hours end 8:00 PM
  return 0; // After 8:00 PM — don't show countdown
}

let _marketBadgeEl: HTMLElement | null = null;
let _statusMarketChip: HTMLElement | null = null;

export function updateMarketBadge(): void {
  if (!_marketBadgeEl?.isConnected) {
    _marketBadgeEl = document.getElementById("market-badge");
  }
  if (!_statusMarketChip?.isConnected) {
    _statusMarketChip = document.getElementById("status-market-chip");
  }

  const status = getMarketStatus();
  const mins = getMinutesToNextTransition();
  const countdown =
    mins > 0
      ? ` ${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`
      : "";

  const labels: Record<MarketStatus, string> = {
    open: `🟢 פתוח${countdown}`,
    pre: `🟡 פרה${countdown}`,
    after: `🟠 אח"מ${countdown}`,
    closed: "🔴 סגור",
  };
  const label = labels[status];

  if (_marketBadgeEl) {
    _marketBadgeEl.textContent = label;
    _marketBadgeEl.className = `market-badge market-badge--${status}`;
  }
  if (_statusMarketChip) {
    _statusMarketChip.textContent = label;
    _statusMarketChip.className = `market-badge market-badge--${status}`;
  }
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

// Index symbols shown in the first sector ("📊 מדדים")
const INDEX_SYMBOLS = ["^GSPC", "^VIX"] as const;
// The Tel Aviv index is shown as a separate trailing entry
const TA35_SYMBOL = "^TA35.TA";

/**
 * Render the stock row skeleton HTML into `#stocks-body`.
 * Called once from initStocksCard() before any data loads.
 * Driven by STOCK_SYMBOLS + STOCK_META; no user data is interpolated.
 */
export function renderStocksShell(): void {
  const container = document.getElementById("stocks-body");
  if (!container) return;

  const FAVICON = (domain: string) =>
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  const makeStockRow = (symbol: string): HTMLElement | null => {
    const meta = STOCK_META[symbol];
    if (!meta) return null;
    const displaySym = meta.sym ?? symbol;
    const logoSrc = meta.logoUrl ?? FAVICON(meta.domain);

    const row = document.createElement("div");
    row.className = "stk";
    row.dataset.symbol = symbol;

    const logoDiv = document.createElement("div");
    logoDiv.className = "stk-logo";
    const img = document.createElement("img");
    img.src = logoSrc;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.style.display = "none";
    });
    logoDiv.appendChild(img);

    const infoDiv = document.createElement("div");
    infoDiv.className = "stk-info";
    const symDiv = document.createElement("div");
    symDiv.className = "stk-sym";
    symDiv.textContent = displaySym;
    const descDiv = document.createElement("div");
    descDiv.className = "stk-desc";
    descDiv.textContent = meta.he;
    infoDiv.append(symDiv, descDiv);

    const valsDiv = document.createElement("div");
    valsDiv.className = "stk-vals";
    const priceDiv = document.createElement("div");
    priceDiv.className = "stk-price skeleton";
    priceDiv.textContent = "---";
    const chgDiv = document.createElement("div");
    chgDiv.className = "stk-chg";
    chgDiv.textContent = "-";
    valsDiv.append(priceDiv, chgDiv);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "stk-chart");
    svg.setAttribute("viewBox", "0 0 200 22");

    const timeDiv = document.createElement("div");
    timeDiv.className = "stk-time";
    timeDiv.textContent = "-";

    row.append(logoDiv, infoDiv, valsDiv, svg, timeDiv);
    return row;
  };

  const makeSectorHeader = (text: string): HTMLElement => {
    const hdr = document.createElement("div");
    hdr.className = "stk-sector-hdr";
    hdr.textContent = text;
    return hdr;
  };

  const stockSymbols = STOCK_SYMBOLS.filter(
    (s) => !INDEX_SYMBOLS.includes(s as "^GSPC" | "^VIX") && s !== TA35_SYMBOL,
  );

  const fragment = document.createDocumentFragment();
  // Sprint 49: gate sector headers on cfg.stocksGroupBySector
  const cfg = loadConfig();
  if (cfg.stocksGroupBySector)
    fragment.appendChild(makeSectorHeader("📊 מדדים"));
  INDEX_SYMBOLS.forEach((s) => {
    const el = makeStockRow(s);
    if (el) fragment.appendChild(el);
  });
  if (cfg.stocksGroupBySector)
    fragment.appendChild(makeSectorHeader("📈 מניות"));
  stockSymbols.forEach((s) => {
    const el = makeStockRow(s);
    if (el) fragment.appendChild(el);
  });
  const ta35 = makeStockRow(TA35_SYMBOL);
  if (ta35) fragment.appendChild(ta35);

  container.replaceChildren(fragment);
}

// ── Render a single stock block ──
export function renderStock(
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

  // Relative volume badge (F61)
  const valsEl = blk.querySelector<HTMLElement>(".stk-vals");
  if (valsEl) {
    valsEl.querySelector(".stk-vol-badge")?.remove();
    const vol = meta.regularMarketVolume;
    const avol = meta.averageDailyVolume10Day;
    if (vol > 0 && avol && avol > 0) {
      const ratio = vol / avol;
      if (ratio >= 1.5) {
        const badge = document.createElement("span");
        badge.className = `stk-vol-badge ${ratio >= 2 ? "stk-vol-xhigh" : "stk-vol-high"}`;
        badge.textContent = `${ratio.toFixed(1)}x`;
        valsEl.appendChild(badge);
      }
    }
  }

  // 52-week range
  if (cur != null && meta.fiftyTwoWeekLow && meta.fiftyTwoWeekHigh) {
    updateStockRange(blk, cur, meta.fiftyTwoWeekLow, meta.fiftyTwoWeekHigh);
  }

  // Per-stock portfolio P&L row (F149)
  const portRaw = localStorage.getItem(LS_PORTFOLIO);
  if (portRaw && cur != null) {
    try {
      const port = JSON.parse(portRaw) as Record<string, PortfolioEntry>;
      const entry = port[sym];
      if (entry && entry.shares > 0) {
        const costBasis = entry.shares * (entry.cost ?? 0);
        const curVal = entry.shares * cur;
        const pnl = curVal - costBasis;
        const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        const sign = pnl >= 0 ? "+" : "";
        let posEl = blk.querySelector<HTMLElement>(".stk-pos-pnl");
        if (!posEl) {
          posEl = document.createElement("div");
          blk.appendChild(posEl);
        }
        posEl.className = `stk-pos-pnl ${pnl >= 0 ? "gain" : "loss"}`;
        posEl.textContent = `${sign}$${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })} (${sign}${pnlPct.toFixed(1)}%)`;
      }
    } catch {
      /* ignore malformed portfolio */
    }
  }

  // After/pre-market secondary price line (F137)
  blk.querySelector(".stk-after-price")?.remove();
  const extPrice = meta.postMarketPrice || meta.preMarketPrice;
  const extChg = meta.postMarketChangePercent ?? meta.preMarketChangePercent;
  const extLbl = meta.postMarketPrice
    ? "אחה\u05f4מ"
    : meta.preMarketPrice
      ? "טרום"
      : null;
  if (extPrice != null && extLbl) {
    const afterEl = document.createElement("div");
    afterEl.className = "stk-after-price";
    const sign = (extChg ?? 0) >= 0 ? "+" : "";
    afterEl.textContent = `${fmtPrice(extPrice, sym)} (${extLbl}${isFinite(extChg ?? NaN) ? ` ${sign}${extChg!.toFixed(2)}%` : ""})`;
    afterEl.style.color =
      !isFinite(extChg ?? NaN) || Math.abs(extChg ?? 0) < 0.1
        ? ""
        : (extChg ?? 0) > 0
          ? "#34d399"
          : "#f87171";
    blk.querySelector(".stk-vals")?.appendChild(afterEl);
  }
}

// ── Fetch a single stock ──
async function fetchStock(sym: string): Promise<YahooChartResponse> {
  // BTC-USD: use CoinGecko (CORS-enabled, Yahoo crypto fails in browser)
  if (sym === "BTC-USD") {
    const cg = await fetchJSONWithWorker<CoinGeckoResponse>(API.COINGECKO_BTC);
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
  return fetchJSONWithWorker<YahooChartResponse>(url);
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
      delete (blk as HTMLElement).dataset["stale"];
      diagLog(`FDB-044: [stocks] ${sym} OK`);
      return true;
    }
  } catch (err) {
    diagLog(`FDB-045: [stocks] ${sym} failed: ${String(err)}`);
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
      delete (blk as HTMLElement).dataset["stale"];
    } else {
      const stale = cGetStale<YahooChartResponse>(`stk-${sym}`);
      if (stale) {
        renderStock(blk, stale, sym);
        (blk as HTMLElement).dataset["stale"] = "true";
      }
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
  checkStockAlerts();
  renderPortfolioRow();
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

// ── Stock Price Alerts ──
// LS_STOCK_ALERTS imported from constants
const _alertedThisSession = new Set<string>();

/** Clear alert dedup Set — exported for testing. */
export function resetStockAlertSession(): void {
  _alertedThisSession.clear();
}

/**
 * Parse and check configured stock price alerts.
 * Format (one per line): MSFT>400  or  NVDA<500
 * Shows a toast when current cached price crosses the threshold.
 * Each alert fires at most once per page session.
 */
export function checkStockAlerts(): void {
  const raw = localStorage.getItem(LS_STOCK_ALERTS) ?? "";
  if (!raw.trim()) return;

  for (const line of raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    const m = /^([A-Z0-9^.-]+)(>=|<=|>|<)(\d+(?:\.\d+)?)$/i.exec(line);
    if (!m) continue;
    const sym = m[1]!.toUpperCase();
    const op = m[2]!;
    const threshold = parseFloat(m[3]!);

    const cached = cGetStale<YahooChartResponse>(`stk-${sym}`);
    const cur = cached?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (cur == null) continue;

    const alertKey = `${sym}${op}${threshold}`;
    if (_alertedThisSession.has(alertKey)) continue;

    const triggered =
      (op === ">" && cur > threshold) ||
      (op === ">=" && cur >= threshold) ||
      (op === "<" && cur < threshold) ||
      (op === "<=" && cur <= threshold);

    if (triggered) {
      _alertedThisSession.add(alertKey);
      const dir = op.startsWith(">") ? "מעל" : "מתחת";
      showToast(
        `🔔 ${sym}: ${fmtPrice(cur, sym)} — ${dir} ${String(threshold)}`,
        5000,
      );
      diagLog(
        `FDB-046: [stocks] alert fired: ${sym} ${String(cur)} ${op} ${String(threshold)}`,
      );
    }
  }
}

// ── Portfolio P&L (F132 header chip + F149 per-stock row) ──
// LS_PORTFOLIO imported from constants

interface PortfolioEntry {
  shares: number;
  cost: number;
}

/**
 * Update `#stk-total-row`, `#stk-total-val`, `#stk-total-pnl`, and
 * `#header-portfolio-pl` from the `dash_v2_portfolio` localStorage key.
 * Format: JSON Record<symbol, {shares, cost}> where cost = cost per share.
 */
export function renderPortfolioRow(): void {
  const raw = localStorage.getItem(LS_PORTFOLIO);
  if (!raw) return;

  let portfolio: Record<string, PortfolioEntry>;
  try {
    portfolio = JSON.parse(raw) as Record<string, PortfolioEntry>;
  } catch {
    return;
  }

  let totalValue = 0;
  let totalCost = 0;
  let count = 0;

  for (const [sym, entry] of Object.entries(portfolio)) {
    if (!entry || entry.shares <= 0) continue;
    const cached = cGetStale<YahooChartResponse>(`stk-${sym}`);
    const cur = cached?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (cur == null) continue;
    totalValue += entry.shares * cur;
    totalCost += entry.shares * (entry.cost ?? 0);
    count++;
  }

  if (count === 0) return;

  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  const sign = pnl >= 0 ? "+" : "";
  const gainLoss = pnl >= 0 ? "gain" : "loss";

  const rowEl = document.getElementById("stk-total-row");
  const totalEl = document.getElementById("stk-total-val");
  const pnlEl = document.getElementById("stk-total-pnl");
  const chipEl = document.getElementById("header-portfolio-pl");

  if (rowEl) rowEl.style.display = "";
  if (totalEl) {
    totalEl.textContent = `$${totalValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (pnlEl) {
    pnlEl.textContent = `${sign}$${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })} (${sign}${pnlPct.toFixed(1)}%)`;
    pnlEl.className = gainLoss;
  }
  if (chipEl) {
    chipEl.textContent = `${sign}${pnlPct.toFixed(1)}%`;
    chipEl.className = `pl-${gainLoss}`;
    chipEl.style.display = "";
  }
}

// ── Market open/close countdown chip (F68) ──
export function updateMarketCountdown(): void {
  const countdownEl = document.getElementById("stk-mkt-countdown");
  if (!countdownEl) return;

  const status = getMarketStatus();
  const mins = getMinutesToNextTransition();

  if (status === "closed" || mins === 0) {
    countdownEl.textContent = "🔴 שוק סגור";
    countdownEl.className = "";
    return;
  }

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const timeStr = h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m} דק׳`;

  const labels: Record<MarketStatus, string> = {
    open: `🟢 פתוח — נסגר בעוד ${timeStr}`,
    pre: `🟡 פרה — נפתח בעוד ${timeStr}`,
    after: `🟠 אחה"מ — נסגר בעוד ${timeStr}`,
    closed: "🔴 שוק סגור",
  };

  countdownEl.textContent = labels[status];
  countdownEl.className =
    status === "open"
      ? "mkt-open"
      : status === "pre" || (status === "after" && mins <= 30)
        ? "mkt-soon"
        : "";
}

/**
 * Show/hide stock rows based on `hiddenStocks` config array.
 * Symbols in the array are hidden; all others are shown.
 */
export function applyHiddenStocks(): void {
  const hidden = new Set(
    loadConfig().hiddenStocks.map((s) => s.toUpperCase().trim()),
  );
  document
    .querySelectorAll<HTMLElement>("#stocks-body .stk[data-symbol]")
    .forEach((blk) => {
      const sym = (blk.dataset["symbol"] ?? "").toUpperCase();
      blk.style.display = hidden.has(sym) ? "none" : "";
    });
}

export function initStocksCard(): void {
  renderStocksShell();
  applyHiddenStocks();
  updateMarketBadge();
  updateMarketCountdown();
  // Refresh badge and countdown every minute so they stay accurate
  setInterval(updateMarketBadge, INTERVALS.MARKET_BADGE);
  setInterval(updateMarketCountdown, INTERVALS.MARKET_BADGE);
  void loadAllStocks();
  scheduleCard(
    loadAllStocks,
    isMarketOpen() ? INTERVALS.STOCKS_OPEN : INTERVALS.STOCKS_CLOSED,
  );
  diagLog("FDB-047: [stocks] Initialized");
}
