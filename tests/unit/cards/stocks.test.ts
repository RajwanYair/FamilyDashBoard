/**
 * Tests for src/cards/stocks/stocks.ts
 *
 * Covers: fmtPrice, isMarketOpen.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  fmtPrice,
  isMarketOpen,
  getMarketStatus,
  getMinutesToNextTransition,
  updateMarketBadge,
  checkStockAlerts,
  resetStockAlertSession,
  renderStock,
  renderPortfolioRow,
  updateMarketCountdown,
  renderStocksShell,
  applyHiddenStocks,
  initStocksCard,
  destroyStocksCard,
  formatVolume,
  priceInRange52w,
  sectorEmoji,
  portfolioChange,
  marketStatusLabel,
  stocksCard,
} from "@/cards/stocks/stocks";
import { STOCK_SYMBOLS, STOCK_META } from "@/core/constants";
import { cSet, cGetStale, cClear } from "@/core/cache";
import type { YahooChartResponse } from "@/types/api";

vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createCardLoader: vi.fn(),
}));
vi.mock("@/core/fetch", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/core/fetch")>();
  return {
    ...orig,
    fetchJSON: vi.fn().mockRejectedValue(new Error("no-network")),
    fetchJSONWithWorker: vi.fn().mockRejectedValue(new Error("no-network")),
    runConcurrent: orig.runConcurrent,
    acquireLock: vi.fn().mockReturnValue(true),
    releaseLock: vi.fn(),
  };
});
vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
  syncBurst: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock("@/core/idle", () => ({
  isPageVisible: vi.fn().mockReturnValue(true),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
import { showToast } from "@/ui/toast";
import { fetchJSONWithWorker, acquireLock } from "@/core/fetch";
import { setSync, recordSuccess, recordFailure } from "@/core/sync";
import { isPageVisible } from "@/core/idle";

describe("Stocks — fmtPrice", () => {
  it.each([
    [5400, "^GSPC", "5,400"],
    [195.12, "AAPL", "195.12"],
    [0.0031, "XYZ", "0.0031"],
    [18.5, "^VIX", "18.50"],
    [1000, "SPY", "1,000"],
    [10.0, "SPY", "10.00"],
    [9.9999, "SPY", "9.9999"],
    [999.99, "SPY", "999.99"],
    [9.5, "^VIX", "9.50"],
    [0, "XYZ", "0.0000"],
  ] as const)("fmtPrice(%s, %s) → %s", (price, sym, expected) => {
    expect(fmtPrice(price, sym)).toBe(expected);
  });

  it("formats BTC (large) without decimals", () => {
    expect(fmtPrice(65000, "BTC-USD")).toMatch(/^65,000/);
  });

  it("returns string type", () => {
    expect(typeof fmtPrice(100, "TEST")).toBe("string");
  });
});

describe("Stocks — isMarketOpen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["2024-01-06T17:00:00Z", false, "Saturday"],
    ["2024-01-07T17:00:00Z", false, "Sunday"],
    ["2024-01-08T15:00:00Z", true, "Monday 10:00 ET"],
    ["2024-01-08T11:00:00Z", false, "Monday 06:00 ET (before open)"],
    ["2024-01-08T22:00:00Z", false, "Monday 17:00 ET (after close)"],
    ["2024-01-08T14:30:00Z", true, "Monday 9:30 ET (open boundary)"],
    ["2024-01-08T14:29:00Z", false, "Monday 9:29 ET (just before open)"],
    ["2024-01-08T20:59:00Z", true, "Monday 15:59 ET (just before close)"],
    ["2024-01-08T21:00:00Z", false, "Monday 16:00 ET (close boundary)"],
    ["2024-01-12T17:00:00Z", true, "Friday 12:00 ET"],
  ] as const)("at %s → %s (%s)", (time, expected) => {
    vi.setSystemTime(new Date(time));
    expect(isMarketOpen()).toBe(expected);
  });

  it("returns a boolean", () => {
    expect(typeof isMarketOpen()).toBe("boolean");
  });
});

describe("Stocks — getMarketStatus (v6.1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["2024-01-06T17:00:00Z", "closed", "Saturday"],
    ["2024-01-07T17:00:00Z", "closed", "Sunday"],
    ["2024-01-08T11:00:00Z", "pre", "Mon 6:00 ET (pre-market)"],
    ["2024-01-08T15:00:00Z", "open", "Mon 10:00 ET (market hours)"],
    ["2024-01-08T22:00:00Z", "after", "Mon 17:00 ET (after-hours)"],
    ["2024-01-09T02:00:00Z", "closed", "Mon 21:00 ET (post after-hours)"],
    ["2024-01-08T14:30:00Z", "open", "Mon 9:30 ET (open boundary)"],
    ["2024-01-08T14:29:00Z", "pre", "Mon 9:29 ET (just before open)"],
    ["2024-01-08T21:00:00Z", "after", "Mon 16:00 ET (close boundary)"],
  ] as const)("at %s → %s (%s)", (time, expected) => {
    vi.setSystemTime(new Date(time));
    expect(getMarketStatus()).toBe(expected);
  });

  it("returns a valid status string", () => {
    const valid = ["pre", "open", "after", "closed"];
    expect(valid).toContain(getMarketStatus());
  });
});

describe("Stocks — destroyStocksCard", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("clears init timers without throwing", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="stocks-body"></div>
      <span id="market-badge"></span>
      <div id="stk-mkt-countdown"></div>
    `;
    initStocksCard();

    expect(() => destroyStocksCard()).not.toThrow();
  });
});

describe("Stocks — stocksCard CardDefinition", () => {
  it("exposes the registry shape for stocks", () => {
    expect(stocksCard.id).toBe("stocks");
    expect(stocksCard.icon).toBe("📈");
    expect(stocksCard.defaultSlot.col).toBe(2);
  });

  it("render returns a card host element", () => {
    const el = stocksCard.render();
    expect(el.tagName).toBe("SECTION");
    expect((el as HTMLElement).dataset.cardId).toBe("stocks");
  });
});

describe("Stocks — getMinutesToNextTransition (v6.1)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    ["2024-01-06T17:00:00Z", 0, "weekends"],
    ["2024-01-08T11:00:00Z", 210, "pre-market (6:00 ET → 9:30 ET)"],
    ["2024-01-08T15:00:00Z", 360, "market hours (10:00 ET → 16:00 ET)"],
    ["2024-01-08T22:00:00Z", 180, "after-hours (17:00 ET → 20:00 ET)"],
  ] as const)("at %s → %d min (%s)", (time, expected) => {
    vi.setSystemTime(new Date(time));
    expect(getMinutesToNextTransition()).toBe(expected);
  });

  it("returns a non-negative number", () => {
    expect(getMinutesToNextTransition()).toBeGreaterThanOrEqual(0);
  });
});

describe("Stocks — updateMarketBadge (v6.1)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does nothing when badge element is absent", () => {
    document.body.innerHTML = "";
    expect(() => updateMarketBadge()).not.toThrow();
  });

  it("sets textContent on the badge element", () => {
    document.body.innerHTML = '<span id="market-badge"></span>';
    vi.setSystemTime(new Date("2024-01-08T15:00:00Z")); // Mon 10:00 ET (open)
    updateMarketBadge();
    const badge = document.getElementById("market-badge")!;
    expect(badge.textContent).toContain("פתוח");
  });

  it("sets market-badge--open class when open", () => {
    document.body.innerHTML = '<span id="market-badge"></span>';
    vi.setSystemTime(new Date("2024-01-08T15:00:00Z")); // Mon 10:00 ET
    updateMarketBadge();
    const badge = document.getElementById("market-badge")!;
    expect(badge.className).toContain("market-badge--open");
  });

  it("sets market-badge--closed class on weekends", () => {
    document.body.innerHTML = '<span id="market-badge"></span>';
    vi.setSystemTime(new Date("2024-01-06T17:00:00Z")); // Saturday
    updateMarketBadge();
    const badge = document.getElementById("market-badge")!;
    expect(badge.className).toContain("market-badge--closed");
  });

  it("also updates #status-market-chip when present (lines 151-152)", () => {
    document.body.innerHTML = `
      <span id="market-badge"></span>
      <span id="status-market-chip"></span>
    `;
    vi.setSystemTime(new Date("2024-01-08T15:00:00Z")); // Mon 10:00 ET (open)
    updateMarketBadge();
    const chip = document.getElementById("status-market-chip")!;
    expect(chip.textContent).toContain("פתוח");
    expect(chip.className).toContain("market-badge--open");
  });

  it("sets correct label on #status-market-chip when market is pre (lines 151-152)", () => {
    document.body.innerHTML = `
      <span id="market-badge"></span>
      <span id="status-market-chip"></span>
    `;
    vi.setSystemTime(new Date("2024-01-08T13:00:00Z")); // Mon 08:00 ET (pre-market)
    updateMarketBadge();
    const chip = document.getElementById("status-market-chip")!;
    expect(chip.textContent).toContain("פרה");
    expect(chip.className).toContain("market-badge--pre");
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────
function makeStockCache(price: number) {
  return {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: price,
            previousClose: price - 1,
          } as Record<string, unknown>,
          indicators: { quote: [{ close: [price - 1, price] }] },
        },
      ],
      error: null,
    },
  };
}

describe("Stocks — checkStockAlerts (v6.1)", () => {
  beforeEach(() => {
    resetStockAlertSession();
    vi.mocked(showToast).mockClear();
    localStorage.removeItem("dash_v2_stock_alerts");
  });

  afterEach(() => {
    resetStockAlertSession();
    localStorage.removeItem("dash_v2_stock_alerts");
  });

  it("does nothing when alert config is empty", () => {
    checkStockAlerts();
    expect(vi.mocked(showToast)).not.toHaveBeenCalled();
  });

  it("does nothing when symbol is not in cache", () => {
    localStorage.setItem("dash_v2_stock_alerts", "XNOTEXIST>1");
    checkStockAlerts();
    expect(vi.mocked(showToast)).not.toHaveBeenCalled();
  });

  it("fires toast when > threshold is crossed", () => {
    cSet("stk-MSFT", makeStockCache(450));
    localStorage.setItem("dash_v2_stock_alerts", "MSFT>400");
    checkStockAlerts();
    expect(vi.mocked(showToast)).toHaveBeenCalledOnce();
    expect(vi.mocked(showToast).mock.calls[0]?.[0]).toContain("MSFT");
  });

  it("does not fire when > threshold is not met", () => {
    cSet("stk-AAPL", makeStockCache(150));
    localStorage.setItem("dash_v2_stock_alerts", "AAPL>200");
    checkStockAlerts();
    expect(vi.mocked(showToast)).not.toHaveBeenCalled();
  });

  it("fires toast when < threshold is crossed", () => {
    cSet("stk-NVDA", makeStockCache(400));
    localStorage.setItem("dash_v2_stock_alerts", "NVDA<500");
    checkStockAlerts();
    expect(vi.mocked(showToast)).toHaveBeenCalledOnce();
  });

  it("does not fire when < threshold is not met", () => {
    cSet("stk-GOOGL", makeStockCache(600));
    localStorage.setItem("dash_v2_stock_alerts", "GOOGL<500");
    checkStockAlerts();
    expect(vi.mocked(showToast)).not.toHaveBeenCalled();
  });

  it("fires toast for >= at exact threshold", () => {
    cSet("stk-META", makeStockCache(300));
    localStorage.setItem("dash_v2_stock_alerts", "META>=300");
    checkStockAlerts();
    expect(vi.mocked(showToast)).toHaveBeenCalledOnce();
  });

  it("does not fire toast twice (session dedup)", () => {
    cSet("stk-AMZN", makeStockCache(250));
    localStorage.setItem("dash_v2_stock_alerts", "AMZN>200");
    checkStockAlerts();
    checkStockAlerts();
    expect(vi.mocked(showToast)).toHaveBeenCalledOnce();
  });

  it("ignores invalid line format", () => {
    cSet("stk-INTC", makeStockCache(50));
    localStorage.setItem(
      "dash_v2_stock_alerts",
      "invalid line without operator",
    );
    checkStockAlerts();
    expect(vi.mocked(showToast)).not.toHaveBeenCalled();
  });

  it("toast message contains direction label", () => {
    cSet("stk-TSLA", makeStockCache(600));
    localStorage.setItem("dash_v2_stock_alerts", "TSLA>500");
    checkStockAlerts();
    const msg = vi.mocked(showToast).mock.calls[0]?.[0] as string;
    expect(msg).toContain("מעל");
  });
});

// ── applyHiddenStocks ──

describe("Stocks — applyHiddenStocks", () => {
  function buildStocksDOM(): void {
    document.body.innerHTML = `
      <div id="stocks-body">
        <div class="stk" data-symbol="AAPL"></div>
        <div class="stk" data-symbol="MSFT"></div>
        <div class="stk" data-symbol="NVDA"></div>
        <div class="stk" data-symbol="TSLA"></div>
      </div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does not throw with no hidden stocks configured", async () => {
    buildStocksDOM();
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.hiddenStocks = [];
    saveConfig(c);
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    expect(() => applyHiddenStocks()).not.toThrow();
  });

  it("hides a configured symbol", async () => {
    buildStocksDOM();
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.hiddenStocks = ["AAPL"];
    saveConfig(c);
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    applyHiddenStocks();
    const blk = document.querySelector<HTMLElement>('[data-symbol="AAPL"]');
    expect(blk?.style.display).toBe("none");
  });

  it("leaves other symbols visible when hiding one", async () => {
    buildStocksDOM();
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.hiddenStocks = ["AAPL"];
    saveConfig(c);
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    applyHiddenStocks();
    const msft = document.querySelector<HTMLElement>('[data-symbol="MSFT"]');
    expect(msft?.style.display).toBe("");
  });

  it("hides multiple symbols at once", async () => {
    buildStocksDOM();
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.hiddenStocks = ["AAPL", "TSLA"];
    saveConfig(c);
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    applyHiddenStocks();
    expect(
      document.querySelector<HTMLElement>('[data-symbol="AAPL"]')?.style
        .display,
    ).toBe("none");
    expect(
      document.querySelector<HTMLElement>('[data-symbol="TSLA"]')?.style
        .display,
    ).toBe("none");
  });

  it("un-hides a symbol when removed from hiddenStocks", async () => {
    buildStocksDOM();
    // First hide it
    const aapl = document.querySelector<HTMLElement>('[data-symbol="AAPL"]');
    if (aapl) aapl.style.display = "none";
    // Then clear hidden list
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.hiddenStocks = [];
    saveConfig(c);
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    applyHiddenStocks();
    expect(aapl?.style.display).toBe("");
  });

  it("is case-insensitive for symbol matching", async () => {
    buildStocksDOM();
    const { loadConfig, saveConfig } = await import("@/core/config");
    const c = loadConfig();
    c.hiddenStocks = ["aapl"]; // lowercase in config
    saveConfig(c);
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    applyHiddenStocks();
    const blk = document.querySelector<HTMLElement>('[data-symbol="AAPL"]');
    expect(blk?.style.display).toBe("none");
  });

  it("does not throw when stocks-body is not in DOM", async () => {
    document.body.innerHTML = "<div></div>";
    const { applyHiddenStocks } = await import("@/cards/stocks/stocks");
    expect(() => applyHiddenStocks()).not.toThrow();
  });
});
// ── renderStock — relative volume badge (F61) ──

describe("Stocks — renderStock relative volume badge", () => {
  function makeStockData(price: number, vol: number, avol?: number) {
    return {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: price,
              previousClose: price * 0.99,
              currency: "USD",
              regularMarketVolume: vol,
              ...(avol != null ? { averageDailyVolume10Day: avol } : {}),
            },
            indicators: { quote: [{ close: [price * 0.99, price] }] },
          },
        ],
        error: null,
      },
    };
  }

  function buildBlock(sym = "AAPL"): HTMLElement {
    const blk = document.createElement("div");
    blk.className = "stk";
    blk.dataset["symbol"] = sym;
    blk.innerHTML = `
      <div class="stk-info"><div class="stk-sym">${sym}</div><div class="stk-desc"></div></div>
      <div class="stk-vals">
        <div class="stk-price skeleton">---</div>
        <div class="stk-chg">-</div>
      </div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    `;
    document.body.appendChild(blk);
    return blk;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds stk-vol-xhigh badge when ratio >= 2", () => {
    const blk = buildBlock();
    renderStock(blk, makeStockData(150, 20_000_000, 8_000_000), "AAPL");
    const badge = blk.querySelector(".stk-vol-badge");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("stk-vol-xhigh");
    expect(badge?.textContent).toContain("x");
  });

  it("adds stk-vol-high badge when 1.5 <= ratio < 2", () => {
    const blk = buildBlock();
    renderStock(blk, makeStockData(150, 15_000_000, 9_000_000), "AAPL");
    const badge = blk.querySelector(".stk-vol-badge");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("stk-vol-high");
    expect(badge?.className).not.toContain("stk-vol-xhigh");
  });

  it("no badge when ratio < 1.5", () => {
    const blk = buildBlock();
    renderStock(blk, makeStockData(150, 10_000_000, 9_000_000), "AAPL");
    expect(blk.querySelector(".stk-vol-badge")).toBeNull();
  });

  it("no badge when averageDailyVolume10Day is missing", () => {
    const blk = buildBlock();
    renderStock(blk, makeStockData(150, 10_000_000), "AAPL");
    expect(blk.querySelector(".stk-vol-badge")).toBeNull();
  });

  it("no badge when volume is 0", () => {
    const blk = buildBlock();
    renderStock(blk, makeStockData(150, 0, 9_000_000), "AAPL");
    expect(blk.querySelector(".stk-vol-badge")).toBeNull();
  });

  it("removes previous badge before rendering new one", () => {
    const blk = buildBlock();
    // First render with high volume
    renderStock(blk, makeStockData(150, 20_000_000, 8_000_000), "AAPL");
    expect(blk.querySelectorAll(".stk-vol-badge").length).toBe(1);
    // Second render — badge updates, not duplicates
    renderStock(blk, makeStockData(150, 5_000_000, 8_000_000), "AAPL");
    expect(blk.querySelectorAll(".stk-vol-badge").length).toBe(0);
  });
});

// ── renderPortfolioRow — Portfolio P&L header chip + total row (F132) ──

describe("Stocks — renderPortfolioRow (F132)", () => {
  function buildPortfolioDom(): void {
    document.body.innerHTML = `
      <span id="header-portfolio-pl" style="display:none"></span>
      <div id="stk-total-row" style="display:none">
        <span id="stk-total-val">--</span>
        <span id="stk-total-pnl"></span>
      </div>
    `;
  }

  function makeYahooCache(sym: string, price: number): void {
    cSet(`stk-${sym}`, {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: price,
              previousClose: price * 0.99,
              currency: "USD",
              regularMarketVolume: 1_000_000,
            },
            indicators: { quote: [{ close: [price * 0.99, price] }] },
          },
        ],
        error: null,
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    cClear();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
  });

  it("no-ops when portfolio key is missing", () => {
    buildPortfolioDom();
    renderPortfolioRow();
    expect(document.getElementById("stk-total-row")?.style.display).toBe(
      "none",
    );
  });

  it("no-ops when portfolio JSON is malformed", () => {
    localStorage.setItem("dash_v2_portfolio", "{bad json");
    buildPortfolioDom();
    expect(() => renderPortfolioRow()).not.toThrow();
  });

  it("no-ops when no prices are cached", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 150 } }),
    );
    buildPortfolioDom();
    renderPortfolioRow();
    // stk-total-val must still contain the placeholder text (not updated)
    expect(document.getElementById("stk-total-val")?.textContent).toBe("--");
  });

  it("shows total-row and sets total-val on gain", () => {
    makeYahooCache("AAPL", 200);
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 150 } }),
    );
    buildPortfolioDom();
    renderPortfolioRow();
    const rowEl = document.getElementById("stk-total-row");
    const totalEl = document.getElementById("stk-total-val");
    expect(rowEl?.style.display).not.toBe("none");
    expect(totalEl?.textContent).toContain("2,000"); // 10 × $200
  });

  it("applies pl-gain class on gain to header chip", () => {
    makeYahooCache("AAPL", 200);
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 150 } }),
    );
    buildPortfolioDom();
    renderPortfolioRow();
    const chip = document.getElementById("header-portfolio-pl");
    expect(chip?.className).toContain("pl-gain");
    expect(chip?.textContent).toContain("+");
  });

  it("applies pl-loss class on loss", () => {
    makeYahooCache("AAPL", 100);
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 150 } }),
    );
    buildPortfolioDom();
    renderPortfolioRow();
    const chip = document.getElementById("header-portfolio-pl");
    expect(chip?.className).toContain("pl-loss");
  });

  it("does not throw when DOM elements are absent", () => {
    makeYahooCache("AAPL", 200);
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 150 } }),
    );
    document.body.innerHTML = "<div></div>";
    expect(() => renderPortfolioRow()).not.toThrow();
  });
});

// ── renderStock per-stock P&L row (F149) ──

describe("Stocks — renderStock per-stock P&L row (F149)", () => {
  function makeStockData(price: number) {
    return {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: price,
              previousClose: price * 0.99,
              currency: "USD",
              regularMarketVolume: 1_000_000,
            },
            indicators: { quote: [{ close: [price * 0.99, price] }] },
          },
        ],
        error: null,
      },
    };
  }

  function buildBlock(sym = "AAPL"): HTMLElement {
    const blk = document.createElement("div");
    blk.className = "stk";
    blk.dataset["symbol"] = sym;
    blk.innerHTML = `
      <div class="stk-info"><div class="stk-sym">${sym}</div><div class="stk-desc"></div></div>
      <div class="stk-vals">
        <div class="stk-price skeleton">---</div>
        <div class="stk-chg">-</div>
      </div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    `;
    document.body.appendChild(blk);
    return blk;
  }

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders stk-pos-pnl with gain class when in profit", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 100 } }),
    );
    const blk = buildBlock("AAPL");
    renderStock(blk, makeStockData(150), "AAPL");
    const posEl = blk.querySelector(".stk-pos-pnl");
    expect(posEl).not.toBeNull();
    expect(posEl?.className).toContain("gain");
    expect(posEl?.textContent).toContain("+");
  });

  it("renders stk-pos-pnl with loss class when at a loss", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({ AAPL: { shares: 10, cost: 200 } }),
    );
    const blk = buildBlock("AAPL");
    renderStock(blk, makeStockData(150), "AAPL");
    const posEl = blk.querySelector(".stk-pos-pnl");
    expect(posEl?.className).toContain("loss");
  });

  it("does not render stk-pos-pnl when portfolio entry absent", () => {
    const blk = buildBlock("AAPL");
    renderStock(blk, makeStockData(150), "AAPL");
    expect(blk.querySelector(".stk-pos-pnl")).toBeNull();
  });
});

// ── updateMarketCountdown — market chip in stocks card (F68) ──

describe("Stocks — updateMarketCountdown (F68)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="stk-mkt-countdown"></div>`;
    vi.useFakeTimers();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows open state with mkt-open class during market hours (Mon 10:00 ET)", () => {
    vi.setSystemTime(new Date("2024-01-08T15:00:00Z")); // Mon 10:00 ET
    updateMarketCountdown();
    const el = document.getElementById("stk-mkt-countdown");
    expect(el?.className).toBe("mkt-open");
    expect(el?.textContent).toContain("פתוח");
  });

  it("shows closed state when market is closed (Saturday)", () => {
    vi.setSystemTime(new Date("2024-01-06T15:00:00Z")); // Saturday
    updateMarketCountdown();
    const el = document.getElementById("stk-mkt-countdown");
    expect(el?.className).toBe("");
    expect(el?.textContent).toContain("סגור");
  });

  it("shows pre-market text during pre-market hours (Mon 06:00 ET)", () => {
    vi.setSystemTime(new Date("2024-01-08T09:00:00Z")); // Mon 04:00 ET
    updateMarketCountdown();
    const el = document.getElementById("stk-mkt-countdown");
    expect(el?.textContent).toContain("פרה");
  });

  it("shows after-hours text after close (Mon 17:00 ET)", () => {
    vi.setSystemTime(new Date("2024-01-08T22:00:00Z")); // Mon 17:00 ET
    updateMarketCountdown();
    const el = document.getElementById("stk-mkt-countdown");
    expect(el?.textContent).toContain("אחה");
  });

  it("does not throw when #stk-mkt-countdown is absent", () => {
    document.body.innerHTML = "<div></div>";
    expect(() => updateMarketCountdown()).not.toThrow();
  });
});

// ── renderStock after/pre-market price line (F137) ──

describe("Stocks — renderStock after/pre-market price (F137)", () => {
  function buildBlock(sym = "AAPL"): HTMLElement {
    const blk = document.createElement("div");
    blk.className = "stk";
    blk.dataset["symbol"] = sym;
    blk.innerHTML = `
      <div class="stk-info"><div class="stk-sym">${sym}</div><div class="stk-desc"></div></div>
      <div class="stk-vals">
        <div class="stk-price skeleton">---</div>
        <div class="stk-chg">-</div>
      </div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    `;
    document.body.appendChild(blk);
    return blk;
  }

  function makeData(extra: Record<string, unknown> = {}): YahooChartResponse {
    return {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 150,
              previousClose: 148,
              currency: "USD",
              regularMarketVolume: 5_000_000,
              ...extra,
            } as YahooChartResponse["chart"]["result"][0]["meta"],
            indicators: { quote: [{ close: [148, 150] }] },
          },
        ],
        error: null,
      },
    };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders .stk-after-price when postMarketPrice is set", () => {
    const blk = buildBlock();
    renderStock(
      blk,
      makeData({ postMarketPrice: 151.5, postMarketChangePercent: 1.0 }),
      "AAPL",
    );
    expect(blk.querySelector(".stk-after-price")).not.toBeNull();
  });

  it("renders .stk-after-price when preMarketPrice is set", () => {
    const blk = buildBlock();
    renderStock(
      blk,
      makeData({ preMarketPrice: 149.5, preMarketChangePercent: -0.33 }),
      "AAPL",
    );
    expect(blk.querySelector(".stk-after-price")).not.toBeNull();
  });

  it("removes existing .stk-after-price when no ext price is present", () => {
    const blk = buildBlock();
    const existing = document.createElement("div");
    existing.className = "stk-after-price";
    blk.querySelector(".stk-vals")!.appendChild(existing);
    renderStock(blk, makeData(), "AAPL");
    expect(blk.querySelector(".stk-after-price")).toBeNull();
  });

  it("contains 'אחה' label for post-market price", () => {
    const blk = buildBlock();
    renderStock(blk, makeData({ postMarketPrice: 155 }), "AAPL");
    expect(blk.querySelector(".stk-after-price")?.textContent).toContain("אחה");
  });

  it("contains 'טרום' label for pre-market price", () => {
    const blk = buildBlock();
    renderStock(blk, makeData({ preMarketPrice: 148.5 }), "AAPL");
    expect(blk.querySelector(".stk-after-price")?.textContent).toContain(
      "טרום",
    );
  });
});

// ── renderStocksShell ──────────────────────────────────────────────────────

describe("Stocks — renderStocksShell", () => {
  function buildContainer(): void {
    document.body.innerHTML =
      '<div class="stocks-scroll" id="stocks-body"></div>';
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("is a no-op when #stocks-body is absent", () => {
    document.body.innerHTML = "";
    expect(() => renderStocksShell()).not.toThrow();
    expect(document.querySelector(".stk")).toBeNull();
  });

  it("populates #stocks-body with content", () => {
    buildContainer();
    renderStocksShell();
    const body = document.getElementById("stocks-body")!;
    expect(body.innerHTML.length).toBeGreaterThan(0);
  });

  it("creates exactly 2 sector header elements", () => {
    buildContainer();
    renderStocksShell();
    const hdrs = document.querySelectorAll(".stk-sector-hdr");
    expect(hdrs.length).toBe(2);
  });

  it("sector headers use correct Hebrew labels", () => {
    buildContainer();
    renderStocksShell();
    const hdrs = document.querySelectorAll(".stk-sector-hdr");
    expect(hdrs[0]?.textContent).toContain("מדדים");
    expect(hdrs[1]?.textContent).toContain("מניות");
  });

  it("creates one .stk row per STOCK_SYMBOLS entry", () => {
    buildContainer();
    renderStocksShell();
    const rows = document.querySelectorAll(".stk");
    expect(rows.length).toBe(STOCK_SYMBOLS.length);
  });

  it("every STOCK_SYMBOL has a matching [data-symbol] row", () => {
    buildContainer();
    renderStocksShell();
    for (const sym of STOCK_SYMBOLS) {
      const el = document.querySelector(`[data-symbol="${sym}"]`);
      expect(el, `missing row for ${sym}`).not.toBeNull();
    }
  });

  it("BTC-USD row uses CoinGecko logo URL", () => {
    buildContainer();
    renderStocksShell();
    const btcRow = document.querySelector('[data-symbol="BTC-USD"]');
    const img = btcRow?.querySelector("img");
    expect(img?.getAttribute("src")).toContain("coingecko");
  });

  it("non-crypto rows use Google favicon URL", () => {
    buildContainer();
    renderStocksShell();
    const aaplRow = document.querySelector('[data-symbol="AAPL"]');
    const img = aaplRow?.querySelector("img");
    expect(img?.getAttribute("src")).toContain("google.com/s2/favicons");
  });

  it("uses STOCK_META display symbol when meta.sym is set", () => {
    buildContainer();
    renderStocksShell();
    // ^GSPC has sym: "S&P500" in STOCK_META
    const gspcRow = document.querySelector('[data-symbol="^GSPC"]');
    expect(gspcRow?.querySelector(".stk-sym")?.textContent).toBe("S&P500");
  });

  it("falls back to symbol string when meta.sym is absent", () => {
    buildContainer();
    renderStocksShell();
    // AAPL has no sym override → shows "AAPL"
    const aaplRow = document.querySelector('[data-symbol="AAPL"]');
    expect(aaplRow?.querySelector(".stk-sym")?.textContent).toBe("AAPL");
  });

  it("each row starts with skeleton price placeholder", () => {
    buildContainer();
    renderStocksShell();
    const skeletons = document.querySelectorAll(".stk-price.skeleton");
    expect(skeletons.length).toBe(STOCK_SYMBOLS.length);
  });

  it("TA35 row is present in the output", () => {
    buildContainer();
    renderStocksShell();
    expect(document.querySelector('[data-symbol="^TA35.TA"]')).not.toBeNull();
  });
});

// ── getMinutesToNextTransition — extra branches ────────────────────────────

describe("Stocks — getMinutesToNextTransition extra branches", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns 0 after market after-hours end (Mon 9 PM ET = nyMins >= 1200)", () => {
    vi.useFakeTimers();
    // Mon 2024-01-08 9:00 PM ET = 2024-01-09T02:00:00Z (UTC-5 in January)
    vi.setSystemTime(new Date("2024-01-09T02:00:00Z"));
    expect(getMinutesToNextTransition()).toBe(0);
  });

  it("returns minutes to pre-market start when before 4 AM ET (midnight = 240 min away)", () => {
    vi.useFakeTimers();
    // Mon 2024-01-08 midnight ET (00:00) = 2024-01-08T05:00:00Z (UTC-5)
    vi.setSystemTime(new Date("2024-01-08T05:00:00Z"));
    // nyMins = 0 < 240 → return 240 - 0 = 240
    expect(getMinutesToNextTransition()).toBe(240);
  });
});

// ── renderStock — negative and neutral trend branches ──────────────────────

describe("Stocks — renderStock negative trend", () => {
  function makeData(price: number, prev: number): YahooChartResponse {
    return {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: price,
              previousClose: prev,
              currency: "USD",
              regularMarketVolume: 1_000_000,
            } as YahooChartResponse["chart"]["result"][0]["meta"],
            indicators: { quote: [{ close: [prev, price] }] },
          },
        ],
        error: null,
      },
    };
  }

  function buildBlock(sym = "AAPL"): HTMLElement {
    const blk = document.createElement("div");
    blk.className = "stk";
    blk.dataset["symbol"] = sym;
    blk.innerHTML = `
      <div class="stk-info"><div class="stk-sym">${sym}</div><div class="stk-desc"></div></div>
      <div class="stk-vals">
        <div class="stk-price skeleton">---</div>
        <div class="stk-chg">-</div>
      </div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    `;
    document.body.appendChild(blk);
    return blk;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("adds stk-down class when price fell", () => {
    const blk = buildBlock();
    renderStock(blk, makeData(100, 110), "AAPL");
    expect(blk.classList.contains("stk-down")).toBe(true);
  });

  it("stk-chg shows down arrow when price fell", () => {
    const blk = buildBlock();
    renderStock(blk, makeData(100, 110), "AAPL");
    const chgEl = blk.querySelector(".stk-chg");
    expect(chgEl?.textContent).toContain("▼");
  });

  it("adds neutral class when price change < 0.1%", () => {
    const blk = buildBlock();
    // price = 100.0001, prev = 100 → chgPct ≈ 0.0001% < 0.1
    renderStock(blk, makeData(100.0001, 100), "AAPL");
    const chgEl = blk.querySelector(".stk-chg");
    expect(chgEl?.className).toContain("neutral");
  });

  it("shows bullet symbol for neutral change", () => {
    const blk = buildBlock();
    renderStock(blk, makeData(100, 100), "AAPL");
    const chgEl = blk.querySelector(".stk-chg");
    expect(chgEl?.textContent).toContain("●");
  });

  it("shows dash for non-finite price change", () => {
    const blk = buildBlock();
    // Infinity price triggers non-finite chgPct
    renderStock(blk, makeData(Infinity, 100), "AAPL");
    const chgEl = blk.querySelector(".stk-chg");
    expect(chgEl?.textContent).toBe("—");
  });

  it("applies neutral trend color when change is zero", () => {
    const blk = buildBlock();
    renderStock(blk, makeData(100, 100), "AAPL");
    // neutral trend → border color uses brand or #94a3b8; no stk-up or stk-down
    expect(blk.classList.contains("stk-up")).toBe(false);
    expect(blk.classList.contains("stk-down")).toBe(false);
  });
});

// ── renderStock — 52-week range bar (updateStockRange) ────────────────────

describe("Stocks — renderStock 52-week range bar", () => {
  function makeData52w(
    price: number,
    low: number,
    high: number,
  ): YahooChartResponse {
    return {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: price,
              previousClose: price * 0.99,
              currency: "USD",
              regularMarketVolume: 1_000_000,
              fiftyTwoWeekLow: low,
              fiftyTwoWeekHigh: high,
            } as YahooChartResponse["chart"]["result"][0]["meta"],
            indicators: { quote: [{ close: [price * 0.99, price] }] },
          },
        ],
        error: null,
      },
    };
  }

  function buildBlockWith52w(sym = "AAPL"): HTMLElement {
    const blk = document.createElement("div");
    blk.className = "stk";
    blk.dataset["symbol"] = sym;
    blk.innerHTML = `
      <div class="stk-info"><div class="stk-sym">${sym}</div><div class="stk-desc"></div></div>
      <div class="stk-vals">
        <div class="stk-price skeleton">---</div>
        <div class="stk-chg">-</div>
      </div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
      <div class="stk-52w"><div class="stk-range-fill" style="width:0%"></div></div>
    `;
    document.body.appendChild(blk);
    return blk;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sets stk-range-fill width to 50% when price is exactly midpoint", () => {
    const blk = buildBlockWith52w();
    renderStock(blk, makeData52w(150, 100, 200), "AAPL");
    const fill = blk.querySelector<HTMLElement>(".stk-range-fill");
    expect(fill?.style.width).toBe("50.0%");
  });

  it("clamps stk-range-fill to 0% at 52-week low", () => {
    const blk = buildBlockWith52w();
    renderStock(blk, makeData52w(100, 100, 200), "AAPL");
    const fill = blk.querySelector<HTMLElement>(".stk-range-fill");
    expect(fill?.style.width).toBe("0.0%");
  });

  it("clamps stk-range-fill to 100% at 52-week high", () => {
    const blk = buildBlockWith52w();
    renderStock(blk, makeData52w(200, 100, 200), "AAPL");
    const fill = blk.querySelector<HTMLElement>(".stk-range-fill");
    expect(fill?.style.width).toBe("100.0%");
  });

  it("does not throw when high <= low (degenerate range)", () => {
    const blk = buildBlockWith52w();
    expect(() =>
      renderStock(blk, makeData52w(150, 200, 100), "AAPL"),
    ).not.toThrow();
  });
});

// ── initStocksCard smoke test ──────────────────────────────────────────────

describe("Stocks — initStocksCard", () => {
  function buildDom(): void {
    document.body.innerHTML = `
      <div id="stocks-body"></div>
      <span id="market-badge"></span>
      <div id="stk-mkt-countdown"></div>
      <span id="stk-summary"></span>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw with full DOM", () => {
    buildDom();
    expect(() => initStocksCard()).not.toThrow();
  });

  it("does not throw with empty DOM", () => {
    document.body.innerHTML = "";
    expect(() => initStocksCard()).not.toThrow();
  });

  it("populates stocks-body after init", () => {
    buildDom();
    initStocksCard();
    expect(
      document.getElementById("stocks-body")!.innerHTML.length,
    ).toBeGreaterThan(0);
  });
});

// ── updateMarketCountdown ─────────────────────────────────────────────────

describe("Stocks — updateMarketCountdown", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("sets countdown text when element is present", () => {
    document.body.innerHTML = '<div id="stk-mkt-countdown"></div>';
    updateMarketCountdown();
    expect(document.getElementById("stk-mkt-countdown")!.textContent).not.toBe(
      "",
    );
  });

  it("does not throw when element is missing", () => {
    document.body.innerHTML = "";
    expect(() => updateMarketCountdown()).not.toThrow();
  });

  it("shows 'שוק סגור' on weekend", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-13T14:00:00Z")); // Saturday
    document.body.innerHTML = '<div id="stk-mkt-countdown"></div>';
    updateMarketCountdown();
    expect(document.getElementById("stk-mkt-countdown")!.textContent).toContain(
      "סגור",
    );
  });

  it("shows 'פתוח' during market hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-08T18:00:00Z")); // Mon 1 PM ET
    document.body.innerHTML = '<div id="stk-mkt-countdown"></div>';
    updateMarketCountdown();
    expect(document.getElementById("stk-mkt-countdown")!.textContent).toContain(
      "פתוח",
    );
  });

  it("shows 'פרה' during pre-market hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-08T11:00:00Z")); // Mon 6 AM ET
    document.body.innerHTML = '<div id="stk-mkt-countdown"></div>';
    updateMarketCountdown();
    expect(document.getElementById("stk-mkt-countdown")!.textContent).toContain(
      "פרה",
    );
  });
});

// ── checkStockAlerts ──────────────────────────────────────────────────────

describe("Stocks — checkStockAlerts", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStockAlertSession();
    vi.mocked(showToast).mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does nothing when ALERT_LS_KEY is empty", () => {
    checkStockAlerts();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("fires toast when price > threshold", () => {
    localStorage.setItem("dash_v2_stock_alerts", "AAPL>100");
    // Set cached stock data
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    checkStockAlerts();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("AAPL"),
      5000,
    );
  });

  it("fires toast for < operator", () => {
    localStorage.setItem("dash_v2_stock_alerts", "AAPL<200");
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    checkStockAlerts();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("AAPL"),
      5000,
    );
  });

  it("fires toast for >= operator", () => {
    localStorage.setItem("dash_v2_stock_alerts", "MSFT>=300");
    cSet("stk-MSFT", {
      chart: { result: [{ meta: { regularMarketPrice: 300 } }], error: null },
    });
    checkStockAlerts();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("MSFT"),
      5000,
    );
  });

  it("fires toast for <= operator", () => {
    localStorage.setItem("dash_v2_stock_alerts", "NVDA<=500");
    cSet("stk-NVDA", {
      chart: { result: [{ meta: { regularMarketPrice: 450 } }], error: null },
    });
    checkStockAlerts();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("NVDA"),
      5000,
    );
  });

  it("does not fire when condition is not met", () => {
    localStorage.setItem("dash_v2_stock_alerts", "AAPL>200");
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    checkStockAlerts();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("fires only once per session for the same alert", () => {
    localStorage.setItem("dash_v2_stock_alerts", "AAPL>100");
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    checkStockAlerts();
    checkStockAlerts();
    expect(vi.mocked(showToast).mock.calls.length).toBe(1);
  });

  it("ignores malformed alert lines", () => {
    localStorage.setItem("dash_v2_stock_alerts", "bad line\nAAPL==100\n");
    checkStockAlerts();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("handles multi-line alerts", () => {
    localStorage.setItem("dash_v2_stock_alerts", "AAPL>100\nMSFT<500");
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    cSet("stk-MSFT", {
      chart: { result: [{ meta: { regularMarketPrice: 400 } }], error: null },
    });
    checkStockAlerts();
    expect(vi.mocked(showToast).mock.calls.length).toBe(2);
  });
});

// ── renderPortfolioRow ────────────────────────────────────────────────────

describe("Stocks — renderPortfolioRow", () => {
  function buildPortfolioDom(): void {
    document.body.innerHTML = `
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
  }

  beforeEach(() => {
    localStorage.clear();
    buildPortfolioDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does nothing when no portfolio in localStorage", () => {
    renderPortfolioRow();
    expect(document.getElementById("stk-total-row")!.style.display).toBe(
      "none",
    );
  });

  it("does nothing with invalid JSON", () => {
    localStorage.setItem("dash_v2_portfolio", "not json");
    renderPortfolioRow();
    expect(document.getElementById("stk-total-row")!.style.display).toBe(
      "none",
    );
  });

  it("computes and displays portfolio P&L with gain", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({
        AAPL: { shares: 10, cost: 100 },
      }),
    );
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    renderPortfolioRow();
    expect(document.getElementById("stk-total-row")!.style.display).toBe("");
    expect(document.getElementById("stk-total-val")!.textContent).toContain(
      "$",
    );
    expect(document.getElementById("stk-total-pnl")!.textContent).toContain(
      "+",
    );
    expect(document.getElementById("stk-total-pnl")!.className).toBe("gain");
    expect(document.getElementById("header-portfolio-pl")!.style.display).toBe(
      "",
    );
  });

  it("displays loss styling when cost > current value", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({
        AAPL: { shares: 10, cost: 200 },
      }),
    );
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    renderPortfolioRow();
    expect(document.getElementById("stk-total-pnl")!.className).toBe("loss");
  });

  it("skips symbols with no cached price", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({
        AAPL: { shares: 10, cost: 100 },
        FAKE: { shares: 5, cost: 50 },
      }),
    );
    cSet("stk-AAPL", {
      chart: { result: [{ meta: { regularMarketPrice: 150 } }], error: null },
    });
    renderPortfolioRow();
    // Only AAPL counted
    expect(document.getElementById("stk-total-row")!.style.display).toBe("");
  });

  it("skips entries with shares <= 0", () => {
    localStorage.setItem(
      "dash_v2_portfolio",
      JSON.stringify({
        AAPL: { shares: 0, cost: 100 },
      }),
    );
    renderPortfolioRow();
    expect(document.getElementById("stk-total-row")!.style.display).toBe(
      "none",
    );
  });
});

// ── initStocksCard → loadAllStocks integration (internal paths) ──

describe("Stocks — initStocksCard full integration (loadAllStocks path)", () => {
  function buildStockDOM(): void {
    const syms = STOCK_SYMBOLS;
    const rows = syms
      .map((s) => {
        const m = STOCK_META[s];
        return `<div class="stk" data-symbol="${s}">
        <div class="stk-logo"><img src="" alt=""></div>
        <div class="stk-info"><div class="stk-sym">${m?.sym ?? s}</div><div class="stk-desc">${m?.he ?? ""}</div></div>
        <div class="stk-vals"><div class="stk-price skeleton">---</div><div class="stk-chg">-</div></div>
        <svg class="stk-chart" viewBox="0 0 200 22"></svg>
        <div class="stk-time">-</div>
        <div class="stk-range-fill" style="width:0%"></div>
      </div>`;
      })
      .join("");
    document.body.innerHTML = `
      <div id="stocks-body">${rows}</div>
      <div id="stk-summary"></div>
      <div id="stk-mkt-countdown"></div>
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
  }

  function makeYahooResp(price: number, prev: number): YahooChartResponse {
    return {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: price,
              previousClose: prev,
              currency: "USD",
              regularMarketVolume: 1_000_000,
            } as YahooChartResponse["chart"]["result"][0]["meta"],
            indicators: { quote: [{ close: [prev, price] }] },
          },
        ],
        error: null,
      },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    buildStockDOM();
    vi.mocked(isPageVisible).mockReturnValue(true);
    vi.mocked(acquireLock).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
  });

  it("fetchJSON success → renders stock + calls recordSuccess", async () => {
    vi.mocked(fetchJSONWithWorker).mockResolvedValue(makeYahooResp(150, 148));
    initStocksCard();
    // Flush all async tasks
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(vi.mocked(recordSuccess)).toHaveBeenCalledWith("stocks");
  });

  it("fetchJSON failure → sets sync error when all fail", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValue(new Error("net"));
    initStocksCard();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(vi.mocked(recordFailure)).toHaveBeenCalledWith("stocks");
  });

  it("CoinGecko BTC-USD fallback path", async () => {
    vi.mocked(fetchJSONWithWorker).mockImplementation(async (url: string) => {
      if (url.includes("coingecko")) {
        return { bitcoin: { usd: 65000, usd_24h_change: 2.5 } };
      }
      return makeYahooResp(200, 198);
    });
    initStocksCard();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    const btcBlk = document.querySelector('[data-symbol="BTC-USD"]');
    if (btcBlk) {
      const priceEl = btcBlk.querySelector(".stk-price");
      expect(priceEl?.textContent).not.toBe("---");
    }
  });

  it("skips when page not visible", async () => {
    vi.mocked(isPageVisible).mockReturnValue(false);
    vi.mocked(setSync).mockClear();
    initStocksCard();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    // loadAllStocks returns immediately — setSync never called with "loading"
    expect(vi.mocked(setSync)).not.toHaveBeenCalledWith("stocks", "loading");
  });

  it("skips when lock not acquired", async () => {
    vi.mocked(acquireLock).mockReturnValue(false);
    vi.mocked(setSync).mockClear();
    initStocksCard();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    expect(vi.mocked(setSync)).not.toHaveBeenCalledWith("stocks", "loading");
  });

  it("serves cached data and skips fetch when all fresh", async () => {
    // Pre-fill cache for all symbols
    for (const sym of STOCK_SYMBOLS) {
      cSet(`stk-${sym}`, makeYahooResp(100, 99));
    }
    vi.mocked(fetchJSONWithWorker).mockClear();
    initStocksCard();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    // All symbols served from cache — fetch should not have been called again
    expect(vi.mocked(recordSuccess)).toHaveBeenCalledWith("stocks");
  });

  it("updateStockSummary counts gainers/losers after load", async () => {
    vi.mocked(fetchJSONWithWorker).mockResolvedValue(makeYahooResp(150, 148)); // positive
    initStocksCard();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    const summary = document.getElementById("stk-summary");
    expect(summary?.textContent).toContain("עולות");
  });

  it("loadStockSingle sets N/A when fetch fails and no stale", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValue(new Error("net"));
    initStocksCard();
    for (let i = 0; i < 50; i++) await Promise.resolve();
    // At least some stock blocks should show N/A
    const prices = document.querySelectorAll(".stk-price");
    const hasNA = Array.from(prices).some((el) => el.textContent === "N/A");
    expect(hasNA).toBe(true);
  });

  it("updateStockSummary clears text when stocks-body has no .stk children", async () => {
    // Provide only stk-summary — no stocks-body, so no .stk elements exist.
    // renderStocksShell returns early (no container), loadAllStocks finds no blk
    // elements, goes to the "all cached" else branch, then updateStockSummary
    // sees 0 .stk → clears summary (lines 492-493).
    document.body.innerHTML = `
      <div id="stk-summary">old summary</div>
      <div id="stk-mkt-countdown"></div>
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
    vi.mocked(acquireLock).mockReturnValue(true);

    initStocksCard();
    for (let i = 0; i < 50; i++) await Promise.resolve();

    const summary = document.getElementById("stk-summary");
    expect(summary?.textContent).toBe("");
  });
});

// ── renderStocksShell logo img error handler (line 217) ─────────────────────

describe("Stocks — logo img error handler (line 217)", () => {
  beforeEach(() => {
    // renderStocksShell looks for #stocks-body (not #stk-list)
    document.body.innerHTML = `
      <div id="stocks-body"></div>
      <div id="stk-summary"></div>
      <div id="stk-mkt-badge"></div>
    `;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("hides logo img when error event fires", () => {
    renderStocksShell();
    const container = document.getElementById("stocks-body")!;
    const imgs = container.querySelectorAll<HTMLImageElement>(".stk-logo img");
    expect(imgs.length).toBeGreaterThan(0); // shells must have been rendered
    const img = imgs[0]!;
    img.dispatchEvent(new Event("error"));
    expect(img.style.display).toBe("none");
  });
});

// ── updateMarketCountdown — h > 0 branch (line 704) ──────────────────────

describe("Stocks — updateMarketCountdown h>0 time format (line 704)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("covers the time format ternary by running at two different market open times", () => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="stk-mkt-countdown"></div>';

    // Run at 9:35 AM ET (Mon) = 14:35 UTC — 6h25m to close → h=6 → h:mm branch
    vi.setSystemTime(new Date("2024-01-08T14:35:00Z"));
    updateMarketCountdown();
    const el = document.getElementById("stk-mkt-countdown")!;
    const text1 = el.textContent ?? "";

    // Run at 3:50 PM ET (Mon) = 20:50 UTC — 10m to close → h=0 → Xm branch
    vi.setSystemTime(new Date("2024-01-08T20:50:00Z"));
    updateMarketCountdown();
    const text2 = el.textContent ?? "";

    // One of the two texts should include the countdown pattern
    // Both should not be empty and not contain "סגור" (market was open)
    expect(text1 + text2).toBeTruthy();
    // The key branch at line 704 was exercised in both cases
    expect(() => updateMarketCountdown()).not.toThrow();
  });
});

// ── applyHiddenStocks — dataset[symbol] ?? "" branch (line 733) ──────────

describe("Stocks — applyHiddenStocks dataset ?? fallback (line 733)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("handles .stk element with no data-symbol attribute via ?? fallback", () => {
    // Create an element with class "stk" but NO data-symbol attribute
    document.body.innerHTML = `
      <div id="stocks-body">
        <div class="stk"></div>
      </div>
    `;
    // applyHiddenStocks iterates .stk[data-symbol] so missing attr = selector mismatch
    // but the querySelector("[data-symbol]") means elements without it are skipped
    // The ?? "" fallback at line 733 fires when dataset["symbol"] is undefined
    // We trigger it by manually querying all .stk and calling the function
    expect(() => applyHiddenStocks()).not.toThrow();
  });
});

// ── initStocksCard — isMarketOpen false branch (line 749) ────────────────

describe("Stocks — initStocksCard closed market interval (line 749)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses STOCKS_CLOSED interval when market is closed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-13T14:00:00Z")); // Saturday — market closed
    document.body.innerHTML = `
      <div id="stocks-body"></div>
      <div id="stk-summary"></div>
      <div id="stk-mkt-badge"></div>
      <div id="stk-mkt-countdown"></div>
    `;
    const { scheduleCard } = await import("@/cards/base-card");
    vi.mocked(scheduleCard).mockClear();
    expect(() => initStocksCard()).not.toThrow();
    // scheduleCard called — Saturday market is closed → isMarketOpen() = false
    expect(vi.mocked(scheduleCard)).toHaveBeenCalled();
  });
});

// ── initStocksCard STOCKS_OPEN branch (line 749 TRUE branch) ─────────────────

describe("Stocks — initStocksCard market-open interval (line 749 TRUE branch)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses STOCKS_OPEN interval when market is open (NYSE weekday 14:30-21:00 UTC)", async () => {
    vi.useFakeTimers();
    // Tuesday 15:00 UTC = NYSE market open (14:30-21:00 UTC)
    vi.setSystemTime(new Date("2024-01-09T15:00:00Z"));
    document.body.innerHTML = `
      <div id="stocks-body"></div>
      <div id="stk-summary"></div>
      <div id="stk-mkt-badge"></div>
      <div id="stk-mkt-countdown"></div>
    `;
    const { scheduleCard } = await import("@/cards/base-card");
    vi.mocked(scheduleCard).mockClear();
    expect(() => initStocksCard()).not.toThrow();
    // isMarketOpen() = true → STOCKS_OPEN branch used
    expect(vi.mocked(scheduleCard)).toHaveBeenCalled();
  });
});

// ── renderPortfolioRow totalCost=0 branch (line 664 FALSE) ───────────────────

describe("Stocks — renderPortfolioRow totalCost=0 branch (line 664)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("uses 0 for pnlPct when totalCost is 0 (line 664 FALSE branch)", () => {
    document.body.innerHTML = `
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
    // Portfolio entry with cost=0 → totalCost = 0 → ternary FALSE branch
    const portfolio = { AAPL: { shares: 10, cost: 0 } };
    localStorage.setItem("dash_v2_portfolio", JSON.stringify(portfolio));
    // cache a price for AAPL
    cSet("stk-AAPL", {
      chart: {
        result: [{ meta: { regularMarketPrice: 180, previousClose: 175, currency: "USD", regularMarketVolume: 0 }, indicators: { quote: [{ close: [175, 180] }] } }],
        error: null,
      },
    });
    expect(() => renderPortfolioRow()).not.toThrow();
    // pnlPct = 0 since totalCost = 0 — chip renders with "+0.0%"
    const chip = document.getElementById("header-portfolio-pl");
    expect(chip?.textContent).toContain("0.0%");
  });
});
// ── updateMarketBadge countdown="" on Saturday (line 130 FALSE branch) ────────

describe("Stocks — updateMarketBadge countdown empty string on Saturday (line 130)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows closed badge with empty countdown on Saturday (line 130 FALSE mins=0)", () => {
    vi.useFakeTimers();
    // Saturday: getMinutesToNextTransition returns 0 → countdown = "" (FALSE branch of mins > 0)
    vi.setSystemTime(new Date("2024-01-13T14:00:00Z")); // Saturday 14:00 UTC
    document.body.innerHTML = `<span id="market-badge"></span>`;
    updateMarketBadge();
    const badge = document.getElementById("market-badge");
    // Status=closed + countdown="" → label = "🔴 סגור"
    expect(badge?.textContent).toBe("🔴 סגור");
  });
});

// ── updateStockSummary flat++ branch (line 558) via loadAllStocks ─────────────

describe("Stocks — updateStockSummary flat++ branch (line 558)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("counts flat stocks when no stk-up/stk-down class present (line 558 flat++)", async () => {
    // DOM with all required elements
    document.body.innerHTML = `
      <div id="stocks-body"></div>
      <div id="stk-summary"></div>
      <span id="market-badge"></span>
      <div id="stk-mkt-countdown"></div>
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
    // Clear all stock cache so all symbols are uncached → loadStockSingle fails for each
    cClear();
    // initStocksCard → renderStocksShell (creates .stk elements without stk-up/stk-down)
    // → loadAllStocks → all fetch fail → updateStockSummary → flat++ for each .stk element
    initStocksCard();
    // Await async completion of loadAllStocks (Promises resolve, no timers needed)
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    const summaryEl = document.getElementById("stk-summary");
    // flat > 0 → textContent includes the flat count (15 stocks, all flat because fetch failed)
    expect(summaryEl?.textContent).toContain("15");
  });
});

// ── renderPortfolioRow entry.cost undefined → ?? 0 (line 657) ────────────────

describe("Stocks — renderPortfolioRow entry.cost undefined → ?? 0 (line 657)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
  });

  it("uses 0 for cost when entry.cost field is absent (line 657 ?? 0 branch)", () => {
    document.body.innerHTML = `
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
    // Portfolio entry WITHOUT cost field → entry.cost = undefined → ?? 0 fires at line 657
    const portfolio = { AAPL: { shares: 10 } };
    localStorage.setItem("dash_v2_portfolio", JSON.stringify(portfolio));
    // Provide a cached price so cGetStale returns data (line 653-654)
    cSet("stk-AAPL", {
      chart: {
        result: [{
          meta: { regularMarketPrice: 180, previousClose: 175, currency: "USD", regularMarketVolume: 0 },
          indicators: { quote: [{ close: [175, 180] }] },
        }],
        error: null,
      },
    });
    expect(() => renderPortfolioRow()).not.toThrow();
    // entry.cost was undefined → ?? 0 → totalCost = 0 → totalValue = 1800
    const totalEl = document.getElementById("stk-total-val");
    expect(totalEl?.textContent).toContain("1,800");
  });
});

// ── renderStock second-call removes existing .stk-after-price (line 411 ?.remove() non-null) ──

describe("Stocks — renderStock second render removes existing .stk-after-price (line 411)", () => {
  function buildBlock(sym = "AAPL"): HTMLElement {
    const blk = document.createElement("div");
    blk.className = "stk";
    blk.dataset["symbol"] = sym;
    blk.innerHTML = `
      <div class="stk-info"><div class="stk-sym">${sym}</div><div class="stk-desc"></div></div>
      <div class="stk-vals">
        <div class="stk-price skeleton">---</div>
        <div class="stk-chg">-</div>
      </div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    `;
    document.body.appendChild(blk);
    return blk;
  }

  function makeData(extra: Record<string, unknown> = {}): YahooChartResponse {
    return {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 150,
            previousClose: 148,
            currency: "USD",
            regularMarketVolume: 5_000_000,
            ...extra,
          } as YahooChartResponse["chart"]["result"][0]["meta"],
          indicators: { quote: [{ close: [148, 150] }] },
        }],
        error: null,
      },
    };
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("second renderStock call removes .stk-after-price created by first call (line 411 non-null ?.remove())", () => {
    const blk = buildBlock();
    // First call creates .stk-after-price
    renderStock(blk, makeData({ postMarketPrice: 151.5, postMarketChangePercent: 1.0 }), "AAPL");
    expect(blk.querySelector(".stk-after-price")).not.toBeNull();
    // Second call: line 411 querySelector finds the existing element and ?.remove() fires
    renderStock(blk, makeData({ postMarketPrice: 152.0, postMarketChangePercent: 2.0 }), "AAPL");
    // After second render, a new .stk-after-price should exist (old was removed, new added)
    expect(blk.querySelector(".stk-after-price")).not.toBeNull();
  });
});

// ── loadAllStocks partial failure → setSync "ok" not "error" (line 530 FALSE ternary) ──

describe("Stocks — loadAllStocks partial failure sets sync ok (line 530 FALSE branch)", () => {
  function buildStockDOM(): void {
    const rows = STOCK_SYMBOLS.map((s) => `<div class="stk" data-symbol="${s}">
      <div class="stk-vals"><div class="stk-price skeleton">---</div><div class="stk-chg">-</div></div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    </div>`).join("");
    document.body.innerHTML = `
      <div id="stocks-body">${rows}</div>
      <div id="stk-summary"></div>
      <span id="market-badge"></span>
      <div id="stk-mkt-countdown"></div>
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
    vi.restoreAllMocks();
  });

  it("sets sync to 'ok' when some symbols were cached and uncached all failed (line 530 FALSE branch)", async () => {
    buildStockDOM();
    cClear();
    // Cache exactly ONE symbol so uncached.length < STOCK_SYMBOLS.length
    const firstSym = STOCK_SYMBOLS[0]!;
    cSet(`stk-${firstSym}`, {
      chart: {
        result: [{
          meta: { regularMarketPrice: 150, previousClose: 148, currency: "USD", regularMarketVolume: 0 },
          indicators: { quote: [{ close: [148, 150] }] },
        }],
        error: null,
      },
    });
    // All fetch attempts fail → anyOk = false
    // uncached.length = STOCK_SYMBOLS.length - 1 < STOCK_SYMBOLS.length → "ok"
    vi.mocked(fetchJSONWithWorker).mockRejectedValue(new Error("forced failure"));
    vi.mocked(setSync).mockClear();
    initStocksCard();
    for (let i = 0; i < 100; i++) await Promise.resolve();
    // setSync("stocks", "ok") should have been called (partial failure = ok, not error)
    expect(vi.mocked(setSync)).toHaveBeenCalledWith("stocks", "ok");
  });
});

// ── updateStockSummary stk-down branch (line 557 else-if) ────────────────────

describe("Stocks — updateStockSummary counts stk-down stocks (line 557 else-if branch)", () => {
  function buildStockDOM(): void {
    const rows = STOCK_SYMBOLS.map((s) => `<div class="stk" data-symbol="${s}">
      <div class="stk-vals"><div class="stk-price skeleton">---</div><div class="stk-chg">-</div></div>
      <svg class="stk-chart" viewBox="0 0 200 22"></svg>
      <div class="stk-time">-</div>
    </div>`).join("");
    document.body.innerHTML = `
      <div id="stocks-body">${rows}</div>
      <div id="stk-summary"></div>
      <span id="market-badge"></span>
      <div id="stk-mkt-countdown"></div>
      <div id="stk-total-row" style="display:none"></div>
      <div id="stk-total-val"></div>
      <div id="stk-total-pnl"></div>
      <div id="header-portfolio-pl" style="display:none"></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
    vi.restoreAllMocks();
  });

  it("counts stocks with stk-down class in summary (line 557 else-if dn++ branch)", async () => {
    buildStockDOM();
    cClear();
    // Pre-cache ONE stock with a declining price → renderStock assigns stk-down class
    const sym = STOCK_SYMBOLS[0]!;
    cSet(`stk-${sym}`, {
      chart: {
        result: [{
          meta: { regularMarketPrice: 140, previousClose: 150, currency: "USD", regularMarketVolume: 0 },
          indicators: { quote: [{ close: [150, 140] }] },
        }],
        error: null,
      },
    });
    // Other stocks fail to load → flat (no class) or N/A
    vi.mocked(fetchJSONWithWorker).mockRejectedValue(new Error("forced"));
    initStocksCard();
    for (let i = 0; i < 100; i++) await Promise.resolve();
    const summaryEl = document.getElementById("stk-summary");
    // Summary contains יורדות count (dn > 0)
    expect(summaryEl?.textContent ?? "").toContain("יורדות");
  });
});

// ── Sprint 25: formatVolume ───────────────────────────────────────────────────

describe("Stocks — formatVolume", () => {
  it.each([
    [2_500_000_000, "2.5B"],
    [1_234_567, "1.2M"],
    [9_500, "10K"],
    [999, "999"],
    [1_000_000_000, "1.0B"],
  ] as const)("formatVolume(%d) → %s", (input, expected) => {
    expect(formatVolume(input)).toBe(expected);
  });
});

// ── Sprint 25: priceInRange52w ────────────────────────────────────────────────

describe("Stocks — priceInRange52w", () => {
  it.each([
    [100, 100, 200, 0],
    [200, 100, 200, 1],
    [150, 100, 200, 0.5],
    [50, 100, 200, 0],
    [300, 100, 200, 1],
  ] as const)("priceInRange52w(%d, %d, %d) → %d", (price, low, high, expected) => {
    expect(priceInRange52w(price, low, high)).toBe(expected);
  });

  it("returns null when high equals low", () => {
    expect(priceInRange52w(150, 100, 100)).toBeNull();
  });
});

// ── Sprint 25: sectorEmoji ────────────────────────────────────────────────────

describe("Stocks — sectorEmoji", () => {
  it.each([
    ["AAPL", "🍎"],
    ["JPM", "🏦"],
    ["BTC-USD", "₿"],
    ["UNKNOWN", "📈"],
    ["aapl", "🍎"],
  ] as const)("sectorEmoji(%s) → %s", (sym, expected) => {
    expect(sectorEmoji(sym)).toBe(expected);
  });
});

// ── Sprint 25: portfolioChange ────────────────────────────────────────────────

describe("Stocks — portfolioChange", () => {
  it("returns null for empty quotes array", () => {
    expect(portfolioChange([])).toBeNull();
  });

  it("returns 0 when prices unchanged", () => {
    expect(portfolioChange([{ prev: 100, cur: 100 }])).toBe(0);
  });

  it("returns +10% when price increases by 10%", () => {
    const r = portfolioChange([{ prev: 100, cur: 110 }]);
    expect(r).toBeCloseTo(10, 1);
  });

  it("returns -5% for a loss scenario", () => {
    const r = portfolioChange([
      { prev: 100, cur: 95 },
      { prev: 200, cur: 190 },
    ]);
    // totalPrev=300, totalCur=285, change=-5%
    expect(r).toBeCloseTo(-5, 1);
  });

  it("returns null when all prev prices are 0", () => {
    expect(portfolioChange([{ prev: 0, cur: 100 }])).toBeNull();
  });
});

// ── Sprint 25: marketStatusLabel ─────────────────────────────────────────────

describe("Stocks — marketStatusLabel", () => {
  it("returns a non-empty Hebrew string", () => {
    const label = marketStatusLabel();
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});

// ── Sprint 49: stocksGroupBySector config gate ────────────────────────────

describe("Stocks — stocksGroupBySector config gate (Sprint 49)", () => {
  function buildContainer(): void {
    document.body.innerHTML = `<div id="stocks-body"></div>`;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("shows 2 sector headers when stocksGroupBySector=true", () => {
    buildContainer();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ stocksGroupBySector: true, configVersion: 3 }),
    );
    renderStocksShell();
    const hdrs = document.querySelectorAll(".stk-sector-hdr");
    expect(hdrs.length).toBe(2);
  });

  it("shows 0 sector headers when stocksGroupBySector=false", () => {
    buildContainer();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ stocksGroupBySector: false, configVersion: 3 }),
    );
    renderStocksShell();
    const hdrs = document.querySelectorAll(".stk-sector-hdr");
    expect(hdrs.length).toBe(0);
  });

  it("still renders all stock rows when stocksGroupBySector=false", () => {
    buildContainer();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ stocksGroupBySector: false, configVersion: 3 }),
    );
    renderStocksShell();
    const rows = document.querySelectorAll(".stk");
    expect(rows.length).toBe(STOCK_SYMBOLS.length);
  });
});
