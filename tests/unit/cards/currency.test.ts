/**
 * Tests for src/cards/currency/currency.ts
 *
 * Covers: fetchCurrency (mock fetch), renderCurrency (DOM update).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCurrency,
  renderCurrency,
  cacheDom,
  formatRelativeTime,
  loadCurrencyHistory,
  storeCurrencyHistory,
  get7DayTrend,
  initCurrencyCard,
  destroyCurrencyCard,
  loadCurrency,
  _resetCurrencyForTest,
  calcCurrency,
  initCalcWidget,
  applyPairVisibility,
} from "@/cards/currency/currency";
import { clearFetchLocks } from "@/core/fetch";

const MOCK_RATES: Record<string, number> = {
  USD: 0.2667, // 1 ILS = 0.2667 USD → 1 USD ≈ 3.75 ILS
  EUR: 0.2451, // 1 EUR ≈ 4.08 ILS
  GBP: 0.2098,
  XAU: 0.000115,
  XAG: 0.009,
};

describe("Currency — fetchCurrency", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rates: MOCK_RATES }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns rate map on successful fetch", async () => {
    const rates = await fetchCurrency();
    expect(rates).toHaveProperty("USD");
    expect(typeof rates["USD"]).toBe("number");
  });

  it("throws when all APIs fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    await expect(fetchCurrency()).rejects.toThrow();
  });
});

describe("Currency — fetchCurrency metal injection (XAU/XAG from Yahoo Finance)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Multi-URL mock: returns currency JSON for er-api, Yahoo chart JSON for GC=F/SI=F
  // (Requests for Yahoo symbols are rewritten by the worker adapter to
  //  `/api/stocks?sym=<symbol>` OR hit the raw Yahoo URL when worker is disabled.
  //  Match on either.)
  function stubMetalsFetch(opts: { goldUsd?: number | null; silverUsd?: number | null }): void {
    function chartResponse(price: number): Response {
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: price,
                  previousClose: price,
                  currency: "USD",
                  regularMarketVolume: 0,
                },
                indicators: { quote: [{ close: [price] }] },
              },
            ],
            error: null,
          },
        }),
      } as unknown as Response;
    }
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) => {
        const urlStr = typeof input === "string" ? input : input.toString();
        const isYahoo =
          urlStr.includes("query1.finance.yahoo.com") || urlStr.includes("/api/stocks");
        if (isYahoo) {
          const isGold =
            urlStr.includes("GC%3DF") || urlStr.includes("GC=F") || urlStr.includes("sym=GC");
          const isSilver =
            urlStr.includes("SI%3DF") || urlStr.includes("SI=F") || urlStr.includes("sym=SI");
          if (isGold) {
            if (opts.goldUsd === null || opts.goldUsd === undefined) {
              return Promise.reject(new Error("Gold fail"));
            }
            return Promise.resolve(chartResponse(opts.goldUsd));
          }
          if (isSilver) {
            if (opts.silverUsd === null || opts.silverUsd === undefined) {
              return Promise.reject(new Error("Silver fail"));
            }
            return Promise.resolve(chartResponse(opts.silverUsd));
          }
          return Promise.reject(new Error("Unknown Yahoo symbol"));
        }
        // Currency API (er-api or worker /api/currency)
        return Promise.resolve({
          ok: true,
          json: async () => ({ rates: { USD: 0.2667, EUR: 0.2451, GBP: 0.2098 } }),
        } as unknown as Response);
      }),
    );
  }

  it("injects XAU from Yahoo GC=F (rate = usdRate / goldUsd)", async () => {
    stubMetalsFetch({ goldUsd: 2400, silverUsd: 30 });
    const rates = await fetchCurrency();
    expect(rates["XAU"]).toBeCloseTo(0.2667 / 2400, 10);
    // Render value = 1/rate ≈ 9000 ILS/oz (3.75 × 2400)
    const renderIls = 1 / rates["XAU"]!;
    expect(renderIls).toBeCloseTo(9000, -1); // within ±5
  });

  it("injects XAG from Yahoo SI=F (rate = usdRate / silverUsd)", async () => {
    stubMetalsFetch({ goldUsd: 2400, silverUsd: 30 });
    const rates = await fetchCurrency();
    expect(rates["XAG"]).toBeCloseTo(0.2667 / 30, 10);
    const renderIls = 1 / rates["XAG"]!;
    expect(renderIls).toBeCloseTo(112.5, 0);
  });

  it("leaves XAU undefined when Yahoo gold fetch fails", async () => {
    stubMetalsFetch({ goldUsd: null, silverUsd: 30 });
    const rates = await fetchCurrency();
    expect(rates["XAU"]).toBeUndefined();
    expect(rates["XAG"]).toBeDefined();
  });

  it("leaves XAG undefined when Yahoo silver fetch fails", async () => {
    stubMetalsFetch({ goldUsd: 2400, silverUsd: null });
    const rates = await fetchCurrency();
    expect(rates["XAG"]).toBeUndefined();
    expect(rates["XAU"]).toBeDefined();
  });

  it("does not crash when both metal fetches fail", async () => {
    stubMetalsFetch({ goldUsd: null, silverUsd: null });
    const rates = await fetchCurrency();
    expect(rates["USD"]).toBe(0.2667);
    expect(rates["XAU"]).toBeUndefined();
    expect(rates["XAG"]).toBeUndefined();
  });

  it("skips metal fetch when USD rate is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rates: { EUR: 0.2451 } }),
      }),
    );
    const rates = await fetchCurrency();
    expect(rates["XAU"]).toBeUndefined();
    expect(rates["XAG"]).toBeUndefined();
  });
});

describe("Currency — renderCurrency", () => {
  beforeEach(() => {
    // Set up minimal DOM
    document.body.innerHTML = `
      <div id="curUsd"></div>
      <div id="curEur"></div>
      <div id="curGbp"></div>
      <div id="curGold"></div>
      <div id="curSilver"></div>
      <div id="curUsdChg"></div>
      <div id="curEurChg"></div>
      <div id="curGbpChg"></div>
      <div id="curGoldChg"></div>
      <div id="curSilverChg"></div>
      <div id="currency-body"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders USD rate", () => {
    renderCurrency(MOCK_RATES);
    const el = document.getElementById("curUsd");
    expect(el?.textContent).toMatch(/₪/);
  });

  it("renders EUR rate", () => {
    renderCurrency(MOCK_RATES);
    const el = document.getElementById("curEur");
    expect(el?.textContent).toMatch(/₪/);
  });

  it("renders GBP rate", () => {
    renderCurrency(MOCK_RATES);
    const el = document.getElementById("curGbp");
    expect(el?.textContent).toMatch(/₪/);
  });

  it("renders Gold (XAU) rate", () => {
    renderCurrency(MOCK_RATES);
    const el = document.getElementById("curGold");
    expect(el?.textContent).toMatch(/₪/);
  });

  it("renders Silver (XAG) rate", () => {
    renderCurrency(MOCK_RATES);
    const el = document.getElementById("curSilver");
    expect(el?.textContent).toMatch(/₪/);
  });

  it("handles missing rate gracefully", () => {
    renderCurrency({});
    const el = document.getElementById("curUsd");
    expect(el?.textContent).toBe("--");
  });

  it("shows -- for EUR when rates is empty", () => {
    renderCurrency({});
    expect(document.getElementById("curEur")?.textContent).toBe("--");
  });

  it("shows -- for GBP when rates is empty", () => {
    renderCurrency({});
    expect(document.getElementById("curGbp")?.textContent).toBe("--");
  });

  it("shows -- for Gold when rates is empty", () => {
    renderCurrency({});
    expect(document.getElementById("curGold")?.textContent).toBe("--");
  });

  it("shows -- for Silver when rates is empty", () => {
    renderCurrency({});
    expect(document.getElementById("curSilver")?.textContent).toBe("--");
  });

  it("removes skeleton class from curUsd after render", () => {
    const el = document.getElementById("curUsd")!;
    el.classList.add("skeleton");
    renderCurrency(MOCK_RATES);
    expect(el.classList.contains("skeleton")).toBe(false);
  });
});

describe("Currency — initCurrencyCard", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="curUsd"></div>
      <div id="curEur"></div>
      <div id="curGbp"></div>
      <div id="curGold"></div>
      <div id="curSilver"></div>
      <div id="curUsdChg"></div>
      <div id="curEurChg"></div>
      <div id="curGbpChg"></div>
      <div id="curGoldChg"></div>
      <div id="curSilverChg"></div>
      <div id="currency-body"></div>
    `;
    _resetCurrencyForTest();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          rates: { USD: 0.27, EUR: 0.24, GBP: 0.21, XAU: 0.000115, XAG: 0.009 },
        }),
      }),
    );
  });

  afterEach(() => {
    _resetCurrencyForTest();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw with full DOM", () => {
    expect(() => initCurrencyCard()).not.toThrow();
  });

  it("does not throw with empty DOM", () => {
    document.body.innerHTML = "";
    expect(() => initCurrencyCard()).not.toThrow();
  });

  it("destroyCurrencyCard clears the schedule timer (lines 470-472)", () => {
    vi.useFakeTimers();
    initCurrencyCard();
    // Should not throw and should clear the timeout
    expect(() => destroyCurrencyCard()).not.toThrow();
    vi.useRealTimers();
  });

  it("destroyCurrencyCard is safe when called before init (line 470 FALSE branch)", () => {
    _resetCurrencyForTest();
    // _curScheduleId is null — destroyCurrencyCard should be a no-op
    expect(() => destroyCurrencyCard()).not.toThrow();
  });

  it("reload button triggers showPopover and loadCurrency (lines 459-462)", () => {
    document.body.innerHTML += `
      <button id="cur-reload-btn"></button>
      <div id="cur-reload-popover"></div>
    `;
    const popover = document.getElementById("cur-reload-popover") as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    popover.showPopover = vi.fn();
    popover.hidePopover = vi.fn();
    cacheDom();
    initCurrencyCard();
    const btn = document.getElementById("cur-reload-btn") as HTMLButtonElement;
    btn.click();
    expect(popover.showPopover).toHaveBeenCalledOnce();
  });
});

// ── Sprint: currency.ts branch coverage (change indicator + precision paths) ──

describe("Currency — renderCurrency change indicators", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="curUsd"></div><div id="curUsdChg"></div>
      <div id="curEur"></div><div id="curEurChg"></div>
      <div id="curGbp"></div><div id="curGbpChg"></div>
      <div id="curGold"></div><div id="curGoldChg"></div>
      <div id="curSilver"></div><div id="curSilverChg"></div>
      <div id="currency-body"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows ▲ positive change on second render with higher rate", () => {
    // First render establishes _prevRates
    renderCurrency(MOCK_RATES);
    // Second render with USD rate increased (smaller raw = higher ILS price)
    const changed = { ...MOCK_RATES, USD: 0.2 }; // 1/0.2 = 5.0 ILS vs 1/0.2667 = 3.75
    renderCurrency(changed);
    const chg = document.getElementById("curUsdChg");
    expect(chg?.textContent).toContain("▲");
    expect(chg?.className).toContain("positive");
  });

  it("shows ▼ negative change on second render with lower rate", () => {
    renderCurrency(MOCK_RATES);
    // Higher raw = lower ILS price
    const changed = { ...MOCK_RATES, USD: 0.35 }; // 1/0.35 = 2.85 vs 3.75
    renderCurrency(changed);
    const chg = document.getElementById("curUsdChg");
    expect(chg?.textContent).toContain("▼");
    expect(chg?.className).toContain("negative");
  });

  it("clears change text when diff is below threshold", () => {
    renderCurrency(MOCK_RATES);
    // Tiny change that doesn't exceed threshold
    const changed = { ...MOCK_RATES, USD: 0.26671 };
    renderCurrency(changed);
    const chg = document.getElementById("curUsdChg");
    expect(chg?.textContent).toBe("");
    expect(chg?.className).toBe("cur-chg");
  });

  it("shows change for gold (precision=0, threshold=5)", () => {
    renderCurrency(MOCK_RATES); // Gold 1/0.000115 ≈ 8695
    // Big change in gold: 1/0.00010 = 10000 → diff ≈ 1305
    const changed = { ...MOCK_RATES, XAU: 0.0001 };
    renderCurrency(changed);
    const chg = document.getElementById("curGoldChg");
    expect(chg?.textContent).toContain("▲");
  });

  it("clears chgEl text when no prevRaw exists for a tile", () => {
    // First render with only USD → no prevRaw for EUR on next render
    renderCurrency({ USD: 0.27 });
    renderCurrency({ EUR: 0.24 });
    const chg = document.getElementById("curEurChg");
    // No prev EUR rate → chgEl.textContent = ""
    expect(chg?.textContent).toBe("");
  });

  it("handles missing chgEl gracefully (no change DOM element)", () => {
    document.getElementById("curUsdChg")?.remove();
    cacheDom();
    // Should not throw even without the chgEl
    renderCurrency(MOCK_RATES);
    renderCurrency({ ...MOCK_RATES, USD: 0.2 });
    expect(document.getElementById("curUsd")?.textContent).toContain("₪");
  });

  it("applies data-fresh class to currency-body on render", () => {
    renderCurrency(MOCK_RATES);
    const body = document.getElementById("currency-body");
    expect(body?.classList.contains("data-fresh")).toBe(true);
  });

  it("works without currency-body element", () => {
    document.getElementById("currency-body")?.remove();
    cacheDom();
    expect(() => renderCurrency(MOCK_RATES)).not.toThrow();
  });
});

describe("Currency — fetchCurrency fallback API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to second API when first returns non-ok", async () => {
    // fetchCurrency now uses fetchJSON (proxy chain) internally.
    // Mock: first call (direct primary URL) fails, subsequent calls succeed.
    let callNum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async function (url: string) {
        callNum++;
        // First direct attempt fails; all subsequent calls (proxy chain) succeed
        if (callNum === 1) return { ok: false, json: async () => ({}) };
        // allorigins wraps content; other proxies return JSON directly
        const isAllOrigins = String(url).includes("allorigins");
        const payload = isAllOrigins
          ? { contents: JSON.stringify({ rates: MOCK_RATES }) }
          : { rates: MOCK_RATES };
        return { ok: true, json: async () => payload };
      }),
    );
    const rates = await fetchCurrency();
    expect(rates).toHaveProperty("USD");
    expect(callNum).toBeGreaterThanOrEqual(2);
  });

  it("falls back to second API when first returns empty rates", async () => {
    let callNum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async function (url: string) {
        callNum++;
        // First call returns empty rates → caught by the empty-check → continues
        if (callNum === 1) return { ok: true, json: async () => ({ rates: {} }) };
        const isAllOrigins = String(url).includes("allorigins");
        const payload = isAllOrigins
          ? { contents: JSON.stringify({ rates: MOCK_RATES }) }
          : { rates: MOCK_RATES };
        return { ok: true, json: async () => payload };
      }),
    );
    const rates = await fetchCurrency();
    expect(rates).toHaveProperty("USD");
    expect(callNum).toBeGreaterThanOrEqual(2);
  });
});

// ── v7.1: formatRelativeTime ───────────────────────────────────────────────

describe("Currency — formatRelativeTime", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 'עכשיו' for a date within 60 seconds", () => {
    vi.useFakeTimers();
    const now = new Date("2024-06-15T12:00:00");
    vi.setSystemTime(now);
    const result = formatRelativeTime(new Date(now.getTime() - 30_000));
    expect(result).toBe("עכשיו");
  });

  it("returns minutes label for 2-59 minutes ago", () => {
    vi.useFakeTimers();
    const now = new Date("2024-06-15T12:05:00");
    vi.setSystemTime(now);
    const result = formatRelativeTime(new Date(now.getTime() - 3 * 60_000));
    expect(result).toBe("לפני 3 דק׳");
  });

  it("returns hours label for 1+ hours ago", () => {
    vi.useFakeTimers();
    const now = new Date("2024-06-15T14:00:00");
    vi.setSystemTime(now);
    const result = formatRelativeTime(new Date(now.getTime() - 2 * 3_600_000));
    expect(result).toBe("לפני 2 ש׳");
  });

  it("returns 'לפני 1 דק\u05f3' for exactly 60-119 seconds ago", () => {
    vi.useFakeTimers();
    const now = new Date("2024-06-15T12:02:00");
    vi.setSystemTime(now);
    const result = formatRelativeTime(new Date(now.getTime() - 90_000));
    expect(result).toBe("לפני 1 דק׳");
  });
});

// ── renderCurrency last-fetch chip (lines 159-165) ────────────────────────────

describe("Currency — renderCurrency updates last-fetch chip", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="curUsd"></div><div id="curUsdChg"></div>
      <div id="curEur"></div><div id="curEurChg"></div>
      <div id="curGbp"></div><div id="curGbpChg"></div>
      <div id="curGold"></div><div id="curGoldChg"></div>
      <div id="curSilver"></div><div id="curSilverChg"></div>
      <div id="currency-body"></div>
      <span id="cur-last-fetch" title=""></span>`;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("sets textContent to time string on last-fetch chip after renderCurrency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:30:00"));
    renderCurrency(MOCK_RATES);
    const chip = document.getElementById("cur-last-fetch")!;
    // textContent should be a time string like "14:30" (Hebrew locale)
    expect(chip.textContent).not.toBe("--:--");
    expect(chip.textContent!.length).toBeGreaterThan(0);
  });

  it("sets title attribute on last-fetch chip after renderCurrency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:30:00"));
    renderCurrency(MOCK_RATES);
    const chip = document.getElementById("cur-last-fetch")!;
    expect(chip.title).toContain("עדכון אחרון");
  });
});

// ── Sprint 24: 7-day rate history ────────────────────────────────────────────

describe("Currency — storeCurrencyHistory / loadCurrencyHistory (Sprint 24)", () => {
  beforeEach(() => {
    localStorage.removeItem("dash_v2_cur_history");
  });
  afterEach(() => {
    localStorage.removeItem("dash_v2_cur_history");
  });

  it("loadCurrencyHistory returns [] when nothing stored", () => {
    expect(loadCurrencyHistory()).toEqual([]);
  });

  it("storeCurrencyHistory stores today's entry", () => {
    storeCurrencyHistory(MOCK_RATES);
    const history = loadCurrencyHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.rates).toEqual(MOCK_RATES);
  });

  it("storeCurrencyHistory replaces the same-day entry", () => {
    storeCurrencyHistory(MOCK_RATES);
    storeCurrencyHistory({ ...MOCK_RATES, USD: 0.28 });
    const history = loadCurrencyHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.rates.USD).toBe(0.28);
  });

  it("keeps a rolling 7-entry history", () => {
    for (let d = 1; d <= 10; d++) {
      const dateStr = `2024-01-${String(d).padStart(2, "0")}`;
      const stored = JSON.parse(localStorage.getItem("dash_v2_cur_history") ?? "[]") as Array<{
        date: string;
        rates: Record<string, number>;
      }>;
      stored.push({ date: dateStr, rates: { ...MOCK_RATES } });
      if (stored.length > 7) stored.splice(0, stored.length - 7);
      localStorage.setItem("dash_v2_cur_history", JSON.stringify(stored));
    }
    const history = loadCurrencyHistory();
    expect(history.length).toBeLessThanOrEqual(7);
  });
});

describe("Currency — get7DayTrend (Sprint 24)", () => {
  it("returns null when history has fewer than 2 entries", () => {
    expect(get7DayTrend("USD", [])).toBeNull();
    expect(get7DayTrend("USD", [{ date: "2024-01-01", rates: { USD: 0.27 } }])).toBeNull();
  });

  it("returns '↑' and positive pct when rate went up (ILS/USD increased)", () => {
    const history = [
      { date: "2024-01-01", rates: { USD: 0.28 } }, // 1/0.28 ≈ 3.57 ILS
      { date: "2024-01-07", rates: { USD: 0.26 } }, // 1/0.26 ≈ 3.85 ILS  ← ILS more expensive
    ];
    const result = get7DayTrend("USD", history);
    expect(result).not.toBeNull();
    expect(result?.arrow).toBe("↑");
    expect(result?.pct).toBeGreaterThan(0);
  });

  it("returns '↓' and negative pct when rate went down", () => {
    const history = [
      { date: "2024-01-01", rates: { USD: 0.26 } }, // 1/0.26 ≈ 3.85 ILS
      { date: "2024-01-07", rates: { USD: 0.28 } }, // 1/0.28 ≈ 3.57 ILS  ← ILS cheaper
    ];
    const result = get7DayTrend("USD", history);
    expect(result).not.toBeNull();
    expect(result?.arrow).toBe("↓");
    expect(result?.pct).toBeLessThan(0);
  });

  it("returns '→' when change is negligible (< 0.1%)", () => {
    const rate = 0.2667;
    const history = [
      { date: "2024-01-01", rates: { USD: rate } },
      { date: "2024-01-07", rates: { USD: rate * 1.0005 } }, // 0.05% change
    ];
    const result = get7DayTrend("USD", history);
    expect(result?.arrow).toBe("→");
  });

  it("returns null when key is missing from history", () => {
    const history = [
      { date: "2024-01-01", rates: { EUR: 0.24 } },
      { date: "2024-01-07", rates: { EUR: 0.25 } },
    ];
    expect(get7DayTrend("USD", history)).toBeNull();
  });
});

// ── loadCurrency async paths (lines 426-436, 446-447) ────────────────────────

describe("Currency — loadCurrency async coverage", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="curUsd"></div><div id="curUsdChg"></div>
      <div id="curEur"></div><div id="curEurChg"></div>
      <div id="curGbp"></div><div id="curGbpChg"></div>
      <div id="curGold"></div><div id="curGoldChg"></div>
      <div id="curSilver"></div><div id="curSilverChg"></div>
      <div id="currency-body"></div>
    `;
    _resetCurrencyForTest();
    cacheDom();
    clearFetchLocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    _resetCurrencyForTest();
    vi.restoreAllMocks();
  });

  it("loadCurrency success path (lines 426-430) — awaited directly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { USD: 0.27, EUR: 0.24, GBP: 0.21, XAU: 0.000115, XAG: 0.009 } }),
    }));
    await loadCurrency();
    const el = document.getElementById("curUsd");
    expect(el?.textContent).toContain("₪");
  });

  it("loadCurrency error path (lines 432-434) — fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    // Should not throw — just record failure
    await expect(loadCurrency()).resolves.toBeUndefined();
  });
});

// ── Sprint 184 / C1: calcCurrency + initCalcWidget ──────────────────────────

describe("Currency — calcCurrency (Sprint 184 C1)", () => {
  const rates = { USD: 0.2667, EUR: 0.2451, GBP: 0.2098, XAU: 0.000115, XAG: 0.009, BTC: 0.0000052 };

  it("converts ILS to USD correctly", () => {
    const result = calcCurrency(100, "USD", rates);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(26.67, 1);
  });

  it("converts ILS to BTC correctly", () => {
    const result = calcCurrency(1000, "BTC", rates);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.0052, 5);
  });

  it("returns null for missing rate key", () => {
    expect(calcCurrency(100, "ZZZ", rates)).toBeNull();
  });

  it("returns null for negative amount", () => {
    expect(calcCurrency(-10, "USD", rates)).toBeNull();
  });

  it("returns null for NaN amount", () => {
    expect(calcCurrency(NaN, "USD", rates)).toBeNull();
  });

  it("returns zero for zero ILS amount", () => {
    const result = calcCurrency(0, "USD", rates);
    expect(result).toBe(0);
  });

  it("returns null for empty rates object", () => {
    expect(calcCurrency(100, "USD", {})).toBeNull();
  });
});

describe("Currency — initCalcWidget DOM wiring (Sprint 184 C1)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="curUsd"></div><div id="curUsdChg"></div>
      <div id="curEur"></div><div id="curEurChg"></div>
      <div id="curGbp"></div><div id="curGbpChg"></div>
      <div id="curGold"></div><div id="curGoldChg"></div>
      <div id="curSilver"></div><div id="curSilverChg"></div>
      <div id="curOil"></div><div id="curOilChg"></div>
      <div id="curBtc"></div><div id="curBtcChg"></div>
      <div id="currency-body"></div>
      <span id="cur-last-fetch"></span>
      <input id="cur-calc-input" type="number">
      <select id="cur-calc-pair">
        <option value="USD" selected>USD</option>
        <option value="EUR">EUR</option>
        <option value="BTC">BTC</option>
      </select>
      <span id="cur-calc-result">--</span>
    `;
    _resetCurrencyForTest();
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    _resetCurrencyForTest();
    vi.restoreAllMocks();
  });

  it("shows -- when no rates loaded yet", () => {
    initCalcWidget();
    const input = document.getElementById("cur-calc-input") as HTMLInputElement;
    const result = document.getElementById("cur-calc-result");
    input.value = "100";
    input.dispatchEvent(new Event("input"));
    expect(result?.textContent).toBe("--");
  });

  it("updates result after rates are loaded via renderCurrency", () => {
    initCalcWidget();
    renderCurrency({ USD: 0.2667, EUR: 0.2451, GBP: 0.2098, XAU: 0.000115, XAG: 0.009, XOI: 0.003, BTC: 0.0000052 });
    const input = document.getElementById("cur-calc-input") as HTMLInputElement;
    const result = document.getElementById("cur-calc-result");
    input.value = "100";
    input.dispatchEvent(new Event("input"));
    // 100 * 0.2667 = 26.67
    expect(result?.textContent).toMatch(/26\./);
  });

  it("updates result when pair changes", () => {
    initCalcWidget();
    renderCurrency({ USD: 0.2667, EUR: 0.2451, GBP: 0.2098, XAU: 0.000115, XAG: 0.009, XOI: 0.003, BTC: 0.0000052 });
    const input = document.getElementById("cur-calc-input") as HTMLInputElement;
    const pairSel = document.getElementById("cur-calc-pair") as HTMLSelectElement;
    const result = document.getElementById("cur-calc-result");
    input.value = "1000";
    input.dispatchEvent(new Event("input"));
    pairSel.value = "BTC";
    pairSel.dispatchEvent(new Event("change"));
    // 1000 * 0.0000052 ≈ 0.0052 (6 decimal places)
    expect(result?.textContent).toMatch(/0\.00/);
  });

  it("shows -- when input is cleared", () => {
    initCalcWidget();
    renderCurrency({ USD: 0.2667, EUR: 0.2451, GBP: 0.2098, XAU: 0.000115, XAG: 0.009, XOI: 0.003, BTC: 0.0000052 });
    const input = document.getElementById("cur-calc-input") as HTMLInputElement;
    const result = document.getElementById("cur-calc-result");
    input.value = "100";
    input.dispatchEvent(new Event("input"));
    input.value = "";
    input.dispatchEvent(new Event("input"));
    expect(result?.textContent).toBe("--");
  });

  it("does not throw when DOM elements are missing", () => {
    document.body.innerHTML = "<div></div>";
    expect(() => initCalcWidget()).not.toThrow();
  });
});

// ── Sprint 189 / C2: applyPairVisibility ────────────────────────────────────

function makeCurDOM(): void {
  document.body.innerHTML = `
    <div class="currency-body" id="currency-body">
      <div class="cur-item"><div class="cur-rate" id="curUsd">--</div><div class="cur-chg" id="curUsdChg"></div></div>
      <div class="cur-item"><div class="cur-rate" id="curEur">--</div><div class="cur-chg" id="curEurChg"></div></div>
      <div class="cur-item"><div class="cur-rate" id="curGbp">--</div><div class="cur-chg" id="curGbpChg"></div></div>
      <div class="cur-item"><div class="cur-rate" id="curGold">--</div><div class="cur-chg" id="curGoldChg"></div></div>
      <div class="cur-item"><div class="cur-rate" id="curSilver">--</div><div class="cur-chg" id="curSilverChg"></div></div>
      <div class="cur-item"><div class="cur-rate" id="curOil">--</div><div class="cur-chg" id="curOilChg"></div></div>
      <div class="cur-item"><div class="cur-rate" id="curBtc">--</div><div class="cur-chg" id="curBtcChg"></div></div>
      <div id="cur-last-fetch"></div>
    </div>`;
  cacheDom();
}

describe("Currency — applyPairVisibility (Sprint 189 C2)", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCurrencyForTest();
    makeCurDOM();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows all 7 pairs by default (no config)", () => {
    applyPairVisibility();
    const items = document.querySelectorAll(".cur-item");
    const hidden = Array.from(items).filter((el) => el.classList.contains("is-hidden"));
    expect(hidden).toHaveLength(0);
  });

  it("hides a single pair (XAG)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, currencyHiddenPairs: "XAG" }),
    );
    applyPairVisibility();
    const silverItem = document.getElementById("curSilver")?.closest(".cur-item");
    expect(silverItem?.classList.contains("is-hidden")).toBe(true);
  });

  it("hides multiple pairs (XAG,BTC)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, currencyHiddenPairs: "XAG,BTC" }),
    );
    applyPairVisibility();
    expect(
      document.getElementById("curSilver")?.closest(".cur-item")?.classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document.getElementById("curBtc")?.closest(".cur-item")?.classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document.getElementById("curUsd")?.closest(".cur-item")?.classList.contains("is-hidden"),
    ).toBe(false);
  });

  it("restores hidden pairs when config cleared", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, currencyHiddenPairs: "XAG,BTC" }),
    );
    applyPairVisibility();
    // now clear hidden pairs
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, currencyHiddenPairs: "" }),
    );
    applyPairVisibility();
    const items = document.querySelectorAll(".cur-item");
    const hidden = Array.from(items).filter((el) => el.classList.contains("is-hidden"));
    expect(hidden).toHaveLength(0);
  });

  it("is case-insensitive (accepts 'xag,btc' lowercase)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, currencyHiddenPairs: "xag,btc" }),
    );
    applyPairVisibility();
    expect(
      document.getElementById("curSilver")?.closest(".cur-item")?.classList.contains("is-hidden"),
    ).toBe(true);
    expect(
      document.getElementById("curBtc")?.closest(".cur-item")?.classList.contains("is-hidden"),
    ).toBe(true);
  });

  it("does not throw when DOM elements are missing", () => {
    document.body.innerHTML = "<div></div>";
    cacheDom();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, currencyHiddenPairs: "XAG,BTC" }),
    );
    expect(() => applyPairVisibility()).not.toThrow();
  });
});
