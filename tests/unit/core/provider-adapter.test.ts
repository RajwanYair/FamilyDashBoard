import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/cache", () => ({
  cGet: vi.fn(),
  cGetStale: vi.fn(),
  cSet: vi.fn(),
}));

vi.mock("@/core/provider", () => ({
  getProviderHealth: vi.fn().mockReturnValue({ status: "ok" }),
  recordProviderFailure: vi.fn(),
  recordProviderSuccess: vi.fn(),
}));

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

import { createCachedProviderAdapter } from "@/core/provider-adapter";
import { cGet, cGetStale, cSet } from "@/core/cache";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from "@/core/provider";
import { diagLog } from "@/core/diag";

describe("createCachedProviderAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cGet).mockReturnValue(null);
    vi.mocked(cGetStale).mockReturnValue(null);
  });

  it("returns fresh cache hits without provider bookkeeping", async () => {
    vi.mocked(cGet).mockReturnValueOnce({ value: 42 });
    const fetchFresh = vi.fn();
    const adapter = createCachedProviderAdapter({
      id: "demo",
      displayName: "Demo",
      cacheKey: "demo-key",
      cacheTtl: 123,
      fetchFresh,
    });

    const result = await adapter.fetch();

    expect(result).toEqual({ ok: true, data: { value: 42 } });
    expect(fetchFresh).not.toHaveBeenCalled();
    expect(recordProviderSuccess).not.toHaveBeenCalled();
  });

  it("stores fresh data and records success", async () => {
    const adapter = createCachedProviderAdapter({
      id: "demo",
      displayName: "Demo",
      cacheKey: "demo-key",
      cacheTtl: 123,
      fetchFresh: vi.fn().mockResolvedValue({ value: 7 }),
      successLog: () => "demo success",
    });

    const result = await adapter.fetch();

    expect(result).toEqual({ ok: true, data: { value: 7 } });
    expect(cSet).toHaveBeenCalledWith("demo-key", { value: 7 });
    expect(recordProviderSuccess).toHaveBeenCalledWith("demo");
    expect(diagLog).toHaveBeenCalledWith("demo success");
  });

  it("returns stale data on failure and records the provider error", async () => {
    vi.mocked(cGetStale).mockReturnValueOnce({ value: 1 });
    const adapter = createCachedProviderAdapter({
      id: "demo",
      displayName: "Demo",
      cacheKey: "demo-key",
      cacheTtl: 123,
      fetchFresh: vi.fn().mockRejectedValue(new Error("boom")),
      failureLog: (message) => `demo failed: ${message}`,
      failureMessage: (message) => `wrapped ${message}`,
    });

    const result = await adapter.fetch();

    expect(result).toEqual({
      ok: false,
      error: "wrapped boom",
      stale: { value: 1 },
    });
    expect(recordProviderFailure).toHaveBeenCalledWith("demo");
    expect(diagLog).toHaveBeenCalledWith("demo failed: boom");
  });

  it("surfaces provider status from provider health", () => {
    vi.mocked(getProviderHealth).mockReturnValueOnce({ status: "degraded" });
    const adapter = createCachedProviderAdapter({
      id: "demo",
      displayName: "Demo",
      cacheKey: "demo-key",
      cacheTtl: 123,
      fetchFresh: vi.fn(),
    });

    expect(adapter.status()).toBe("degraded");
  });
});
