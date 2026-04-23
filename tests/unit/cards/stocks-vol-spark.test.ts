/**
 * V13-DATA — Stocks 7-day volume sparkline tests
 *
 * Verifies that renderStocksShell() adds a .stk-vol-spark element per row,
 * and that renderStock() writes volume to IDB history and renders the sparkline.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderStocksShell, renderStock } from "@/cards/stocks/stocks";
import { STOCK_SYMBOLS } from "@/core/constants";
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

// ── Mock IDB history ──
const mockAppend = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn().mockResolvedValue([]);
vi.mock("@/core/history", () => ({
  historyAppend: (...args: unknown[]) => mockAppend(...args),
  historyGet: (...args: unknown[]) => mockGet(...args),
  sparklineSvg: vi.fn().mockReturnValue('<polyline points="0,10 10,5 20,8"/>'),
  _resetHistoryDb: vi.fn(),
}));

function makeYahooResp(price: number, prev: number, volume = 0): YahooChartResponse {
  return {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: price,
          previousClose: prev,
          currency: "USD",
          regularMarketVolume: volume,
        },
        indicators: { quote: [{ close: [prev, price] }] },
      }],
      error: null,
    },
  };
}

describe("Stocks vol-spark — renderStocksShell adds .stk-vol-spark per row", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("each stock row gets a .stk-vol-spark element", () => {
    document.body.innerHTML = `<div id="stocks-body"></div>`;
    renderStocksShell();
    const rows = document.querySelectorAll(".stk");
    const sparks = document.querySelectorAll(".stk-vol-spark");
    expect(sparks.length).toBe(rows.length);
    expect(sparks.length).toBeGreaterThan(0);
  });

  it(".stk-vol-spark has aria-hidden=true", () => {
    document.body.innerHTML = `<div id="stocks-body"></div>`;
    renderStocksShell();
    const sparks = document.querySelectorAll(".stk-vol-spark");
    for (const spark of sparks) {
      expect((spark as HTMLElement).getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("Stocks vol-spark — renderStock with volume > 0 appends to IDB history", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="stocks-body"></div>`;
    renderStocksShell();
    mockAppend.mockClear();
    mockGet.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("calls historyAppend with stk:vol: key when volume > 0", async () => {
    const blk = document.querySelector('[data-symbol="AAPL"]')!;
    expect(blk).toBeTruthy();

    mockGet.mockImplementation(async (key: string) => {
      if (key === "stk:vol:AAPL") return [1_000_000, 1_200_000];
      return [];
    });

    renderStock(blk, makeYahooResp(190, 185, 2_500_000), "AAPL");

    // Wait for async fire-and-forget
    await new Promise((resolve) => setTimeout(resolve, 0));

    const volCalls = mockAppend.mock.calls.filter(
      ([key]: [string]) => key === "stk:vol:AAPL",
    );
    expect(volCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT call historyAppend for volume when volume is 0", async () => {
    const blk = document.querySelector('[data-symbol="AAPL"]')!;
    renderStock(blk, makeYahooResp(190, 185, 0), "AAPL");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const volCalls = mockAppend.mock.calls.filter(
      ([key]: [string]) => key === "stk:vol:AAPL",
    );
    expect(volCalls.length).toBe(0);
  });

  it("renders volume sparkline when historyGet returns ≥2 values", async () => {
    const blk = document.querySelector('[data-symbol="MSFT"]')!;

    mockGet.mockImplementation(async (key: string) => {
      if (key === "stk:vol:MSFT") return [500_000, 600_000, 550_000];
      return [];
    });

    renderStock(blk, makeYahooResp(415, 410, 3_000_000), "MSFT");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const volSpark = blk.querySelector(".stk-vol-spark");
    expect(volSpark).toBeTruthy();
    // sparklineSvg mock returns a polyline string; innerHTML should not be empty
    expect(volSpark!.innerHTML).not.toBe("");
  });

  it("does not render volume sparkline when historyGet returns <2 values", async () => {
    const blk = document.querySelector('[data-symbol="NVDA"]')!;
    const volSpark = blk.querySelector(".stk-vol-spark")!;

    mockGet.mockImplementation(async (key: string) => {
      if (key === "stk:vol:NVDA") return [1_000_000];
      return [];
    });

    renderStock(blk, makeYahooResp(880, 870, 5_000_000), "NVDA");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // innerHTML stays empty (mock sparklineSvg not called for this case)
    expect(volSpark.innerHTML).toBe("");
  });
});

describe("Stocks vol-spark — stk-vol-spark count matches STOCK_SYMBOLS count", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("number of .stk-vol-spark equals STOCK_SYMBOLS.length", () => {
    document.body.innerHTML = `<div id="stocks-body"></div>`;
    renderStocksShell();
    const sparks = document.querySelectorAll(".stk-vol-spark");
    expect(sparks.length).toBe(STOCK_SYMBOLS.length);
  });
});
