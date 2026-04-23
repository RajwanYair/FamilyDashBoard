/**
 * Worker unit tests — handleWeeklyDigest (V13-S27, ADR-033)
 *
 * Tests the weekly email digest function:
 *  - skips when EMAIL_SEND_FROM/TO not set
 *  - skips when send_email binding absent (logs instead)
 *  - sends email with correct subject and body when configured
 *  - does not throw when send_email.send() fails
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleWeeklyDigest } from "../../../worker/src/routes/cron";
import type { Env } from "../../../worker/src/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeKV(errorCount = 0) {
  return {
    get: vi.fn(async (key: string) => {
      if (key.startsWith("errors:count:")) return errorCount > 0 ? String(errorCount) : null;
      return null;
    }),
    put: vi.fn(async () => undefined),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
  };
}

function makeEnv(overrides: Partial<Record<string, unknown>> = {}): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: makeKV(),
    ...overrides,
  } as unknown as Env;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("handleWeeklyDigest — email not configured", () => {
  it("returns immediately when EMAIL_SEND_FROM is absent", async () => {
    const env = makeEnv({ EMAIL_SEND_TO: "family@example.com" });
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
  });

  it("returns immediately when EMAIL_SEND_TO is absent", async () => {
    const env = makeEnv({ EMAIL_SEND_FROM: "digest@example.com" });
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
  });

  it("returns immediately when both are absent", async () => {
    const env = makeEnv();
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
  });
});

describe("handleWeeklyDigest — send_email binding absent", () => {
  it("does not throw — logs instead of sending", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const env = makeEnv({
      EMAIL_SEND_FROM: "digest@example.com",
      EMAIL_SEND_TO: "family@example.com",
      // send_email intentionally absent
    });
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("send_email binding absent"));
    consoleSpy.mockRestore();
  });
});

describe("handleWeeklyDigest — send_email binding present", () => {
  let sendMock: ReturnType<typeof vi.fn>;
  let env: Env;

  beforeEach(() => {
    sendMock = vi.fn(async () => undefined);
    env = makeEnv({
      EMAIL_SEND_FROM: "digest@fdb.example.com",
      EMAIL_SEND_TO: "family@example.com",
      send_email: { send: sendMock },
    });
  });

  it("calls send_email.send() once", async () => {
    await handleWeeklyDigest(env);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("sends the correct from/to addresses", async () => {
    await handleWeeklyDigest(env);
    const call = sendMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call["from"]).toBe("digest@fdb.example.com");
    expect(call["to"]).toEqual(["family@example.com"]);
  });

  it("subject contains today's UTC date", async () => {
    await handleWeeklyDigest(env);
    const call = sendMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const today = new Date().toISOString().slice(0, 10);
    expect(String(call["subject"])).toContain(today);
  });

  it("body includes the error count from KV", async () => {
    const kvWithErrors = makeKV(42);
    const envWithErrors = makeEnv({
      EMAIL_SEND_FROM: "digest@fdb.example.com",
      EMAIL_SEND_TO: "family@example.com",
      CACHE_KV: kvWithErrors,
      send_email: { send: sendMock },
    });
    await handleWeeklyDigest(envWithErrors);
    const call = sendMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(String(call["text"])).toContain("42");
  });

  it("does not throw when send_email.send() rejects", async () => {
    sendMock.mockRejectedValueOnce(new Error("email send failed"));
    await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
  });
});
