/**
 * Tests for TASE (Tel Aviv Stock Exchange) adapter — D8/S-TASE (ADR-061, v14.0)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isTASETicker,
  stripTASESuffix,
  ilsToUsd,
  taseToYahooResponse,
  fetchTASE,
} from "@/cards/stocks/tase-adapter";
import type { TASEShareResponse } from "@/cards/stocks/tase-adapter";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/fetch", () => ({
  fetchWithTimeout: vi.fn(),
}));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
  cGetStale: vi.fn().mockReturnValue(null),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/cards/currency/currency", () => ({
  getLastCurrencyRates: vi.fn().mockReturnValue({ USD: 0.27, EUR: 0.25 }),
}));
vi.mock("@/core/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/constants")>();
  return {
    ...actual,
    PROXIES: ["https://api.allorigins.win/get?url="],
    FETCH_TIMEOUT_MS: 8_000,
    TASE_QUOTE: "https://api.tase.co.il/api/share/GetAllShares",
  };
});

import { fetchWithTimeout } from "@/core/fetch";
import { cGet, cSet } from "@/core/cache";
import { getLastCurrencyRates } from "@/cards/currency/currency";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PERI_SHARE: TASEShareResponse = {
  id: 630015,
  name: "פריון",
  symbol: "PERI",
  lastPrice: 35.5,
  changePercent: -1.8,
  closingPrice: 36.15,
  high52W: 42.0,
  low52W: 28.0,
  volume: 450_000,
};

// ── isTASETicker ──────────────────────────────────────────────────────────────

describe("isTASETicker", () => {
  it("returns true for PERI.TA", () => {
    expect(isTASETicker("PERI.TA")).toBe(true);
  });

  it("returns true for lowercase peri.ta", () => {
    expect(isTASETicker("peri.ta")).toBe(true);
  });

  it("returns false for index ^TA35.TA", () => {
    expect(isTASETicker("^TA35.TA")).toBe(false);
  });

  it("returns false for AAPL (no .TA suffix)", () => {
    expect(isTASETicker("AAPL")).toBe(false);
  });

  it("returns false for BTC-USD", () => {
    expect(isTASETicker("BTC-USD")).toBe(false);
  });
});

// ── stripTASESuffix ───────────────────────────────────────────────────────────

describe("stripTASESuffix", () => {
  it("strips .TA from PERI.TA", () => {
    expect(stripTASESuffix("PERI.TA")).toBe("PERI");
  });

  it("strips lowercase .ta", () => {
    expect(stripTASESuffix("peri.ta")).toBe("peri");
  });

  it("does not modify symbols without .TA", () => {
    expect(stripTASESuffix("AAPL")).toBe("AAPL");
  });
});

// ── ilsToUsd ─────────────────────────────────────────────────────────────────

describe("ilsToUsd", () => {
  it("converts ILS to USD using rates (1 ILS = 0.27 USD)", () => {
    expect(ilsToUsd(10)).toBeCloseTo(2.7, 5);
  });

  it("returns null when getLastCurrencyRates returns null", () => {
    vi.mocked(getLastCurrencyRates).mockReturnValueOnce(null);
    expect(ilsToUsd(10)).toBeNull();
  });

  it("returns null when USD rate is zero", () => {
    vi.mocked(getLastCurrencyRates).mockReturnValueOnce({ USD: 0 });
    expect(ilsToUsd(10)).toBeNull();
  });
});

// ── taseToYahooResponse ───────────────────────────────────────────────────────

describe("taseToYahooResponse", () => {
  it("sets currency to ILS", () => {
    const r = taseToYahooResponse(PERI_SHARE);
    expect(r.chart.result![0]!.meta.currency).toBe("ILS");
  });

  it("maps lastPrice to regularMarketPrice", () => {
    const r = taseToYahooResponse(PERI_SHARE);
    expect(r.chart.result![0]!.meta.regularMarketPrice).toBe(35.5);
  });

  it("maps closingPrice to previousClose", () => {
    const r = taseToYahooResponse(PERI_SHARE);
    expect(r.chart.result![0]!.meta.previousClose).toBe(36.15);
  });

  it("includes 52-week high/low", () => {
    const r = taseToYahooResponse(PERI_SHARE);
    expect(r.chart.result![0]!.meta.fiftyTwoWeekHigh).toBe(42.0);
    expect(r.chart.result![0]!.meta.fiftyTwoWeekLow).toBe(28.0);
  });

  it("has no top-level error", () => {
    const r = taseToYahooResponse(PERI_SHARE);
    expect(r.chart.error).toBeNull();
  });

  it("falls back prev=last when closingPrice is null", () => {
    const share: TASEShareResponse = { ...PERI_SHARE, closingPrice: null };
    const r = taseToYahooResponse(share);
    expect(r.chart.result![0]!.meta.previousClose).toBe(35.5);
  });

  it("produces 0 volume when volume is null", () => {
    const share: TASEShareResponse = { ...PERI_SHARE, volume: null };
    const r = taseToYahooResponse(share);
    expect(r.chart.result![0]!.meta.regularMarketVolume).toBe(0);
  });
});

// ── fetchTASE ─────────────────────────────────────────────────────────────────

describe("fetchTASE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cGet).mockReturnValue(null);
  });

  it("throws for non-TASE symbol (AAPL without .TA)", async () => {
    await expect(fetchTASE("AAPL")).rejects.toThrow("not a non-index .TA ticker");
  });

  it("throws for index symbol ^TA35.TA", async () => {
    await expect(fetchTASE("^TA35.TA")).rejects.toThrow("not a non-index .TA ticker");
  });

  it("returns cached data without fetching", async () => {
    const cached = taseToYahooResponse(PERI_SHARE);
    vi.mocked(cGet).mockReturnValue(cached);

    const result = await fetchTASE("PERI.TA");
    expect(result.chart.result![0]!.meta.regularMarketPrice).toBe(35.5);
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it("fetches PERI.TA successfully via direct request", async () => {
    const mockResponse = {
      ok: true,
      json: async () => PERI_SHARE,
    } as unknown as Response;
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(mockResponse);

    const result = await fetchTASE("PERI.TA");
    expect(result.chart.result![0]!.meta.regularMarketPrice).toBe(35.5);
    expect(cSet).toHaveBeenCalled();
  });

  it("falls back to allorigins proxy when direct fetch throws", async () => {
    // First call (direct) throws
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(new Error("CORS"));
    // Second call (proxy) succeeds
    const proxyResponse = {
      ok: true,
      json: async () => ({ contents: JSON.stringify(PERI_SHARE) }),
    } as unknown as Response;
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(proxyResponse);

    const result = await fetchTASE("PERI.TA");
    expect(result.chart.result![0]!.meta.currency).toBe("ILS");
  });

  it("throws when API response is missing lastPrice", async () => {
    const badShare: TASEShareResponse = { id: 1, name: "Bad", symbol: "BAD" };
    const mockResponse = {
      ok: true,
      json: async () => badShare,
    } as unknown as Response;
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(mockResponse);

    await expect(fetchTASE("BAD.TA")).rejects.toThrow("invalid response");
  });

  it("throws when proxy returns non-JSON contents", async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce(new Error("CORS"));
    const proxyResponse = {
      ok: true,
      json: async () => ({ contents: "<html>error</html>" }),
    } as unknown as Response;
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(proxyResponse);

    await expect(fetchTASE("PERI.TA")).rejects.toThrow("unexpected contents shape");
  });
});
