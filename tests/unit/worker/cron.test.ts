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

import {
  handleScheduled,
  handleNextYearPreWarm,
  handleWeeklyDigest,
} from "../../../worker/src/routes/cron";
import {
  handleCurrency,
  handleHebcal,
  handleHebcalHolidays,
} from "../../../worker/src/routes/data";
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
    (pruneOldReports as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("D1 error"));
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

// ── handleWeeklyDigest ────────────────────────────────────────────────────────

describe("handleWeeklyDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early (no-op) when EMAIL_SEND_FROM is not set", async () => {
    const env = makeEnv({ EMAIL_SEND_FROM: undefined, EMAIL_SEND_TO: "test@test.com" });
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
  });

  it("returns early (no-op) when EMAIL_SEND_TO is not set", async () => {
    const env = makeEnv({ EMAIL_SEND_FROM: "noreply@test.com", EMAIL_SEND_TO: undefined });
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
  });

  it("logs and returns when send_email binding is absent", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    await handleWeeklyDigest(env);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[FDB-digest] send_email binding absent"));
    logSpy.mockRestore();
  });

  it("sends email when send_email binding and env vars are present", async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    await handleWeeklyDigest(env);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@test.com",
        to: ["user@test.com"],
        subject: expect.stringContaining("Weekly Digest"),
        text: expect.stringContaining("FamilyDashBoard Weekly Digest"),
      }),
    );
    logSpy.mockRestore();
  });

  it("reads error counts from KV when CACHE_KV is present", async () => {
    const kvGet = vi.fn().mockImplementation((key: string) => {
      if (key.startsWith("errors:count:")) return Promise.resolve("5");
      return Promise.resolve(null);
    });
    const kvList = vi.fn().mockResolvedValue({
      keys: [{ name: "errors:msg:TypeError" }, { name: "errors:msg:NetworkError" }],
      list_complete: true,
      cacheStatus: null,
    });
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: { get: kvGet, list: kvList },
    });
    await handleWeeklyDigest(env);
    expect(kvGet).toHaveBeenCalled();
    expect(kvList).toHaveBeenCalledWith({ prefix: "errors:msg:", limit: 5 });
    // The email body should contain the error count
    const sentText = sendMock.mock.calls[0]?.[0]?.text as string;
    expect(sentText).toContain("5");
    expect(sentText).toContain("TypeError");
    logSpy.mockRestore();
  });

  it("ignores non-numeric KV values (NaN branch)", async () => {
    const kvGet = vi.fn().mockResolvedValue("not-a-number");
    const kvList = vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null });
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: { get: kvGet, list: kvList },
    });
    await handleWeeklyDigest(env);
    // Should still send with 0 counts since values are NaN
    const sentText = sendMock.mock.calls[0]?.[0]?.text as string;
    expect(sentText).toContain("Client errors today (KV counter): 0");
    expect(sentText).toContain("Client errors past 7 days: 0");
    logSpy.mockRestore();
  });

  it("handles KV get rejection gracefully (non-fatal)", async () => {
    const kvGet = vi.fn().mockRejectedValue(new Error("KV unavailable"));
    const kvList = vi.fn().mockRejectedValue(new Error("KV unavailable"));
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: { get: kvGet, list: kvList },
    });
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
    // Should still attempt to send email (with 0 stats)
    expect(sendMock).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("logs error when send_email.send rejects", async () => {
    const sendMock = vi.fn().mockRejectedValue(new Error("email send failed"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    await handleWeeklyDigest(env);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[FDB-digest] Failed"),
      expect.any(Error),
    );
    errSpy.mockRestore();
  });

  it("produces top errors section when topErrors exist", async () => {
    const kvGet = vi.fn().mockResolvedValue(null);
    const kvList = vi.fn().mockResolvedValue({
      keys: [
        { name: "errors:msg:FetchFailed" },
        { name: "errors:msg:TimeoutError" },
      ],
      list_complete: true,
      cacheStatus: null,
    });
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: { get: kvGet, list: kvList },
    });
    await handleWeeklyDigest(env);
    const sentText = sendMock.mock.calls[0]?.[0]?.text as string;
    expect(sentText).toContain("Top errors this week");
    expect(sentText).toContain("FetchFailed");
    expect(sentText).toContain("TimeoutError");
    logSpy.mockRestore();
  });

  it("handles CACHE_KV being absent (no KV stats collected)", async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = makeEnv({
      EMAIL_SEND_FROM: "noreply@test.com",
      EMAIL_SEND_TO: "user@test.com",
      send_email: { send: sendMock },
      CACHE_KV: undefined,
    });
    await handleWeeklyDigest(env);
    // Should still send email (with 0 stats)
    expect(sendMock).toHaveBeenCalled();
    const sentText = sendMock.mock.calls[0]?.[0]?.text as string;
    expect(sentText).toContain("Client errors today (KV counter): 0");
    logSpy.mockRestore();
  });
});
