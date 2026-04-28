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

vi.mock("@/core/provider-toast", () => ({
  notifyProviderBlocked: vi.fn(),
}));

import { createCachedProviderAdapter } from "@/core/provider-adapter";
import { cGet, cGetStale, cSet } from "@/core/cache";
import { getProviderHealth, recordProviderFailure, recordProviderSuccess } from "@/core/provider";
import { diagLog } from "@/core/diag";
import { notifyProviderBlocked } from "@/core/provider-toast";

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

  it("uses default diagLog format when successLog is not provided", async () => {
    const adapter = createCachedProviderAdapter({
      id: "demo2",
      displayName: "Demo2",
      cacheKey: "demo2-key",
      cacheTtl: 60,
      fetchFresh: vi.fn().mockResolvedValue({ x: 1 }),
      // no successLog provided
    });

    await adapter.fetch();

    // diagLog should NOT have been called with a custom message (successLog is undefined)
    expect(diagLog).not.toHaveBeenCalled();
    expect(recordProviderSuccess).toHaveBeenCalledWith("demo2");
  });

  it("uses default diagLog format when failureLog is not provided", async () => {
    const adapter = createCachedProviderAdapter({
      id: "demo3",
      displayName: "Demo3",
      cacheKey: "demo3-key",
      cacheTtl: 60,
      fetchFresh: vi.fn().mockRejectedValue(new Error("network error")),
      // no failureLog or failureMessage
    });

    const result = await adapter.fetch();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("network error");
    expect(diagLog).toHaveBeenCalledWith("[demo3] network error");
  });

  it("calls notifyProviderBlocked when stale is null and provider status is down", async () => {
    vi.mocked(cGetStale).mockReturnValue(null);
    vi.mocked(getProviderHealth).mockReturnValue({ status: "down" });

    const adapter = createCachedProviderAdapter({
      id: "demo4",
      displayName: "Demo Four",
      cacheKey: "demo4-key",
      cacheTtl: 60,
      fetchFresh: vi.fn().mockRejectedValue(new Error("blocked")),
    });

    await adapter.fetch();

    expect(notifyProviderBlocked).toHaveBeenCalledWith("demo4", "Demo Four");
  });

  it("does NOT call notifyProviderBlocked when stale data is available", async () => {
    vi.mocked(cGetStale).mockReturnValue({ cached: true });
    vi.mocked(getProviderHealth).mockReturnValue({ status: "down" });

    const adapter = createCachedProviderAdapter({
      id: "demo5",
      displayName: "Demo Five",
      cacheKey: "demo5-key",
      cacheTtl: 60,
      fetchFresh: vi.fn().mockRejectedValue(new Error("blocked")),
    });

    await adapter.fetch();

    expect(notifyProviderBlocked).not.toHaveBeenCalled();
  });

  it("wraps non-Error throw as a string message", async () => {
    const adapter = createCachedProviderAdapter({
      id: "demo6",
      displayName: "Demo6",
      cacheKey: "demo6-key",
      cacheTtl: 60,
      fetchFresh: vi.fn().mockRejectedValue("plain string error"),
    });

    const result = await adapter.fetch();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("plain string error");
  });
});
