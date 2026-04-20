/**
 * Tests for Hebcal Provider Adapter (Sprint 90).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHebcalAdapter } from "@/cards/hebrew-cal/hebcal-adapter";

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

describe("HebcalAdapter (Sprint 90)", () => {
  const adapter = createHebcalAdapter(281184);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct id and displayName", () => {
    expect(adapter.id).toBe("hebcal");
    expect(adapter.displayName).toBe("Hebcal Calendar");
  });

  it("returns cached data when available", async () => {
    const mockData = { items: [{ title: "Shabbat", date: "2025-01-01" }] };
    vi.mocked(cGet).mockReturnValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(mockData);
  });

  it("fetches and validates on cache miss", async () => {
    const mockData = { items: [{ title: "Pesach", date: "2025-04-13" }] };
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(recordProviderSuccess).toHaveBeenCalledWith("hebcal");
  });

  it("returns failure on fetch error", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValueOnce(new Error("network"));
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("network");
    expect(recordProviderFailure).toHaveBeenCalledWith("hebcal");
  });

  it("status() delegates to getProviderHealth", () => {
    expect(adapter.status()).toBe("ok");
  });
});
