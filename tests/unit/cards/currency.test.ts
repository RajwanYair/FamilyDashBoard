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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
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
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw with full DOM", async () => {
    vi.resetModules();
    const { initCurrencyCard } = await import("@/cards/currency/currency");
    expect(() => initCurrencyCard()).not.toThrow();
  });

  it("does not throw with empty DOM", async () => {
    document.body.innerHTML = "";
    vi.resetModules();
    const { initCurrencyCard } = await import("@/cards/currency/currency");
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
    let callNum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async function () {
        callNum++;
        if (callNum === 1) return { ok: false, json: async () => ({}) };
        return { ok: true, json: async () => ({ rates: MOCK_RATES }) };
      }),
    );
    const rates = await fetchCurrency();
    expect(rates).toHaveProperty("USD");
    expect(callNum).toBe(2);
  });

  it("falls back to second API when first returns empty rates", async () => {
    let callNum = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async function () {
        callNum++;
        if (callNum === 1)
          return { ok: true, json: async () => ({ rates: {} }) };
        return { ok: true, json: async () => ({ rates: MOCK_RATES }) };
      }),
    );
    const rates = await fetchCurrency();
    expect(rates).toHaveProperty("USD");
    expect(callNum).toBe(2);
  });
});
