/**
 * Tests for Open-Meteo Provider Adapter (Sprint 89).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOpenMeteoAdapter } from "@/cards/weather/open-meteo-adapter";

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
vi.mock("@/types/api", () => ({
  isWeatherResponse: vi.fn().mockReturnValue(true),
}));

import { cGet } from "@/core/cache";
import { fetchJSONWithWorker } from "@/core/fetch";
import { recordProviderSuccess, recordProviderFailure } from "@/core/provider";

describe("OpenMeteoAdapter (Sprint 89)", () => {
  const adapter = createOpenMeteoAdapter(31.77, 35.21);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct id and displayName", () => {
    expect(adapter.id).toBe("open-meteo");
    expect(adapter.displayName).toBe("Open-Meteo Weather");
  });

  it("returns cached data when available", async () => {
    const mockData = { current: {} };
    vi.mocked(cGet).mockReturnValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(mockData);
  });

  it("fetches and returns data on cache miss", async () => {
    const mockData = { current: { temperature_2m: 25 } };
    vi.mocked(fetchJSONWithWorker).mockResolvedValueOnce(mockData);
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    expect(recordProviderSuccess).toHaveBeenCalledWith("open-meteo");
  });

  it("returns failure on fetch error", async () => {
    vi.mocked(fetchJSONWithWorker).mockRejectedValueOnce(new Error("timeout"));
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("timeout");
    expect(recordProviderFailure).toHaveBeenCalledWith("open-meteo");
  });

  it("status() returns current health", () => {
    expect(adapter.status()).toBe("ok");
  });
});
