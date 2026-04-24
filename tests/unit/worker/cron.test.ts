/**
 * Worker unit tests — handleScheduled, handleNextYearPreWarm (cron.ts)
 *
 * Covers the pre-warm paths that were previously at 0% coverage.
 * All upstream handlers are mocked so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../../../worker/src/types";

// ── Mock all upstream handlers ────────────────────────────────────────────────
// We mock the imported route handlers before importing cron.ts so that
// handleScheduled / handleNextYearPreWarm only test their own wiring.

vi.mock("../../../worker/src/routes/data", () => ({
  handleCurrency: vi.fn().mockResolvedValue(new Response("ok")),
  handleHebcal: vi.fn().mockResolvedValue(new Response("ok")),
  handleHebcalHolidays: vi.fn().mockResolvedValue(new Response("ok")),
}));

vi.mock("../../../worker/src/routes/feeds", () => ({
  handleStocks: vi.fn().mockResolvedValue(new Response("ok")),
  handleNews: vi.fn().mockResolvedValue(new Response("ok")),
}));

vi.mock("../../../worker/src/utils/d1-reports", () => ({
  pruneOldReports: vi.fn().mockResolvedValue(undefined),
}));

import { handleScheduled, handleNextYearPreWarm } from "../../../worker/src/routes/cron";
import { handleCurrency, handleHebcal, handleHebcalHolidays } from "../../../worker/src/routes/data";
import { handleStocks } from "../../../worker/src/routes/feeds";
import { pruneOldReports } from "../../../worker/src/utils/d1-reports";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Record<string, unknown>> = {}): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
    },
    ...overrides,
  } as unknown as Env;
}

// ── handleScheduled ───────────────────────────────────────────────────────────

describe("handleScheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without throwing", async () => {
    const env = makeEnv();
    await expect(handleScheduled(env)).resolves.toBeUndefined();
  });

  it("calls handleCurrency", async () => {
    const env = makeEnv();
    await handleScheduled(env);
    expect(handleCurrency).toHaveBeenCalledWith(env);
  });

  it("calls handleHebcal with the warm URL", async () => {
    const env = makeEnv();
    await handleScheduled(env);
    expect(handleHebcal).toHaveBeenCalledWith(expect.any(URL), env);
    const url = (handleHebcal as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as URL;
    expect(url.hostname).toBe("worker");
    expect(url.pathname).toBe("/api/hebcal");
  });

  it("calls handleHebcalHolidays for current year", async () => {
    const env = makeEnv();
    await handleScheduled(env);
    expect(handleHebcalHolidays).toHaveBeenCalledWith(expect.any(URL), env);
    const url = (handleHebcalHolidays as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as URL;
    const currentYear = String(new Date().getUTCFullYear());
    expect(url.searchParams.get("year")).toBe(currentYear);
  });

  it("calls handleStocks for BTC-USD", async () => {
    const env = makeEnv();
    await handleScheduled(env);
    expect(handleStocks).toHaveBeenCalledWith(expect.any(URL), env);
    const url = (handleStocks as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as URL;
    expect(url.searchParams.get("sym")).toBe("BTC-USD");
  });

  it("calls pruneOldReports when DB is present", async () => {
    const mockDB = { prepare: vi.fn() };
    const env = makeEnv({ DB: mockDB });
    await handleScheduled(env);
    expect(pruneOldReports).toHaveBeenCalledWith(mockDB, 30);
  });

  it("does NOT call pruneOldReports when DB is absent", async () => {
    const env = makeEnv({ DB: undefined });
    await handleScheduled(env);
    expect(pruneOldReports).not.toHaveBeenCalled();
  });

  it("does not throw when a downstream handler rejects", async () => {
    (handleCurrency as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("upstream failed"),
    );
    const env = makeEnv();
    await expect(handleScheduled(env)).resolves.toBeUndefined();
  });

  it("does not throw when pruneOldReports rejects", async () => {
    (pruneOldReports as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("D1 error"),
    );
    const env = makeEnv({ DB: { prepare: vi.fn() } });
    await expect(handleScheduled(env)).resolves.toBeUndefined();
  });
});

// ── handleNextYearPreWarm ─────────────────────────────────────────────────────

describe("handleNextYearPreWarm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without throwing", async () => {
    const env = makeEnv();
    await expect(handleNextYearPreWarm(env)).resolves.toBeUndefined();
  });

  it("calls handleHebcalHolidays with next year's URL", async () => {
    const env = makeEnv();
    await handleNextYearPreWarm(env);
    expect(handleHebcalHolidays).toHaveBeenCalledWith(expect.any(URL), env);
    const url = (handleHebcalHolidays as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as URL;
    const nextYear = String(new Date().getUTCFullYear() + 1);
    expect(url.searchParams.get("year")).toBe(nextYear);
  });

  it("does not throw when handleHebcalHolidays rejects", async () => {
    (handleHebcalHolidays as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("upstream error"),
    );
    const env = makeEnv();
    await expect(handleNextYearPreWarm(env)).resolves.toBeUndefined();
  });
});
