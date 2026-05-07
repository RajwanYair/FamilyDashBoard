/**
 * Tests for Currency Provider Adapter .
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCurrencyAdapter } from "@/cards/currency/currency-adapter";

vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));
vi.mock("@/core/provider", () => ({
  getProviderHealth: vi.fn().mockReturnValue({ status: "ok" }),
  recordProviderSuccess: vi.fn(),
  recordProviderFailure: vi.fn(),
}));
vi.mock("@/core/fetch", () => ({
  fetchJSONWithWorker: vi.fn(),
}));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/cards/currency/boi-adapter", () => ({
  fetchBoIRates: vi.fn().mockResolvedValue(null),
}));

import { cGet } from "@/core/cache";
import { fetchJSONWithWorker } from "@/core/fetch";
import { recordProviderSuccess, recordProviderFailure } from "@/core/provider";
import { fetchBoIRates } from "@/cards/currency/boi-adapter";

describe("CurrencyAdapter ", () => {
  const adapter = createCurrencyAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct id and displayName", () => {
    expect(adapter.id).toBe("currency");
    expect(adapter.displayName).toBe("Currency Exchange Rates");
  });

  it("returns cached data when available", async () => {
    const mockData = { rates: { USD: 0.27 } };
    vi.mocked(cGet).mockReturnValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
  });

  it("fetches from primary endpoint on cache miss", async () => {
    const mockData = { rates: { USD: 0.27, EUR: 0.25 } };
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(recordProviderSuccess).toHaveBeenCalledWith("currency");
  });

  it("falls back and reports failure when all endpoints fail", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValue(new Error("fail"));
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    expect(recordProviderFailure).toHaveBeenCalledWith("currency");
  });

  it(" : tries 3 endpoints (primary + ER fallback + ECB Frankfurter)", async () => {
    vi.mocked(fetchJSONWithWorker)
      .mockRejectedValueOnce(new Error("primary down"))
      .mockRejectedValueOnce(new Error("er-fallback down"))
      .mockResolvedValueOnce({ rates: { USD: 0.27, EUR: 0.25 } });
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(fetchJSONWithWorker).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetchJSONWithWorker).mock.calls[2]?.[0]).toContain("frankfurter.dev");
  });

  it("status() returns current health", () => {
    expect(adapter.status()).toBe("ok");
  });

  it("returns ok:false when all endpoints return data without valid rates (line 34 FALSE)", async () => {
    // All endpoints return data but without a valid 'rates' object
    vi.mocked(fetchJSONWithWorker)
      .mockResolvedValueOnce({ error: "no rates" })
      .mockResolvedValueOnce({ error: "no rates" })
      .mockResolvedValueOnce({ error: "no rates" });
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    expect(recordProviderFailure).toHaveBeenCalledWith("currency");
  });

  // BoI primary path (lines 37-38 in currency-adapter.ts)
  it("uses BoI rates when fetchBoIRates returns valid data with >2 rates", async () => {
    vi.mocked(fetchBoIRates).mockResolvedValueOnce({
      rates: { USD: 0.27, EUR: 0.25, GBP: 0.22, JPY: 40.1 },
      base_code: "ILS",
    });
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    // fetchJSONWithWorker should NOT have been called (BoI satisfied the request)
    expect(fetchJSONWithWorker).not.toHaveBeenCalled();
    expect(recordProviderSuccess).toHaveBeenCalledWith("currency");
  });

  it("falls through to provider chain when BoI returns <=2 rates", async () => {
    vi.mocked(fetchBoIRates).mockResolvedValueOnce({ rates: { USD: 0.27 } });
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce({ rates: { USD: 0.27, EUR: 0.25 } });
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(fetchJSONWithWorker).toHaveBeenCalledTimes(1);
  });

  it("falls through to provider chain when BoI throws", async () => {
    vi.mocked(fetchBoIRates).mockRejectedValueOnce(new Error("BoI unreachable"));
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce({ rates: { USD: 0.27, EUR: 0.25 } });
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(fetchJSONWithWorker).toHaveBeenCalledTimes(1);
  });
});
