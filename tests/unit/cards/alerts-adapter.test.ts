/**
 * Tests for Alerts Provider Adapter (Sprint 92).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAlertsAdapter } from "@/cards/alerts/alerts-adapter";

vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSetAsync: vi.fn().mockResolvedValue(undefined),
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

describe("AlertsAdapter (Sprint 92)", () => {
  const adapter = createAlertsAdapter();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct id and displayName", () => {
    expect(adapter.id).toBe("tzeva-adom");
    expect(adapter.displayName).toBe("Tzeva Adom Alerts");
  });

  it("returns cached data when available", async () => {
    const mockData = [{ alertDate: "2025-01-01", data: "Tel Aviv", threat: 1 }];
    vi.mocked(cGet).mockReturnValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
  });

  it("fetches and validates array response", async () => {
    const mockData = [{ alertDate: "2025-01-01", data: "Haifa", threat: 2 }];
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(recordProviderSuccess).toHaveBeenCalledWith("tzeva-adom");
  });

  it("rejects non-array responses", async () => {
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce({ bad: true });
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    expect(recordProviderFailure).toHaveBeenCalled();
  });

  it("returns failure on fetch error", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValueOnce(new Error("blocked"));
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("blocked");
  });

  it("returns failure on non-Error rejection (String(err) path)", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValueOnce("network-error");
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("network-error");
  });

  it("status() returns current health", () => {
    expect(adapter.status()).toBe("ok");
  });
});
