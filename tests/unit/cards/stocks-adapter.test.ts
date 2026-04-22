/**
 * Tests — Stocks Provider Adapter (Sprint 128)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Provide required globals
(globalThis as Record<string, unknown>).__APP_VERSION__ = "7.18.0";
(globalThis as Record<string, unknown>).__BUILD_TIME__ = "2026-01-01T00:00:00Z";

// Mock fetch
vi.stubGlobal("fetch", vi.fn());

import { createStocksAdapter } from "@/cards/stocks/stocks-adapter";
import { _resetProviderHealth, getProviderHealth } from "@/core/provider";
import { cClear } from "@/core/cache";

describe("Stocks Provider Adapter (Sprint 128)", () => {
  beforeEach(() => {
    localStorage.clear();
    cClear();
    _resetProviderHealth();
    vi.mocked(fetch).mockReset();
  });

  it("returns adapter with correct id and displayName", () => {
    const adapter = createStocksAdapter("AAPL");
    expect(adapter.id).toBe("yahoo-finance");
    expect(adapter.displayName).toBe("Yahoo Finance (AAPL)");
    expect(adapter.cacheKey).toBe("stk-AAPL");
  });

  it("uses shorter TTL when market is open", () => {
    const open = createStocksAdapter("AAPL", true);
    const closed = createStocksAdapter("AAPL", false);
    expect(open.cacheTtl).toBeLessThan(closed.cacheTtl);
  });

  it("returns ok:false and records failure on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    const adapter = createStocksAdapter("MSFT");
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("MSFT");
    }
    const health = getProviderHealth("yahoo-finance");
    expect(health.consecutiveFails).toBe(1);
  });

  it("returns ok:false on invalid response shape", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ chart: { result: [] } }), { status: 200 }),
    );
    const adapter = createStocksAdapter("BAD");
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
  });

  it("returns ok:true and caches valid response", async () => {
    const mockResp: Record<string, unknown> = {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 150.5,
              previousClose: 149.0,
              currency: "USD",
              regularMarketVolume: 1000,
            },
            indicators: { quote: [{ close: [149, 150, 150.5] }] },
          },
        ],
        error: null,
      },
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(mockResp), { status: 200 }));
    const adapter = createStocksAdapter("AAPL");
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chart.result[0].meta.regularMarketPrice).toBe(150.5);
    }
    const health = getProviderHealth("yahoo-finance");
    expect(health.status).toBe("ok");
  });

  it("status() returns current provider health", () => {
    const adapter = createStocksAdapter("AAPL");
    expect(adapter.status()).toBe("ok");
  });
});
