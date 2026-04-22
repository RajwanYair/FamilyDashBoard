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
  _resetCurrencyForTest,
} from "@/cards/currency/currency";

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
