/**
 * Tests for Currency Provider Adapter (Sprint 91).
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

import { cGet } from "@/core/cache";
import { fetchJSONWithWorker } from "@/core/fetch";
import { recordProviderSuccess, recordProviderFailure } from "@/core/provider";

describe("CurrencyAdapter (Sprint 91)", () => {
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

  it("Sprint 132 (Roadmap #16): tries 3 endpoints (primary + ER fallback + ECB Frankfurter)", async () => {
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
});
