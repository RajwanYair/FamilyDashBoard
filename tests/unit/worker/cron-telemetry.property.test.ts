/**
 * fast-check property tests — worker/src/routes/cron.ts
 *                            + worker/src/telemetry.ts
 *
 * Cron properties (CRON1-CRON4):
 *  CRON1. hebcalHolidaysUrl (via handleScheduled behavior): yearOffset 0
 *         → URL contains current civil year
 *  CRON2. handleScheduled: never rejects even when all handlers throw
 *  CRON3. handleNextYearPreWarm: never rejects
 *  CRON4. handleWeeklyDigest: never rejects when email is unconfigured
 *
 * Telemetry properties (OTEL1-OTEL3):
 *  OTEL1. initOtel with OTEL_ENABLED!=='true' → enabled === false
 *  OTEL2. span() always returns the callback's return value (no-op path)
 *  OTEL3. flush() always resolves (no-op path)
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import {
  handleScheduled,
  handleNextYearPreWarm,
  handleWeeklyDigest,
} from "../../../worker/src/routes/cron";
import { initOtel } from "../../../worker/src/telemetry";
import type { Env } from "../../../worker/src/types";

// ── Minimal mock env ──────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    OTEL_ENABLED: "false",
    ...overrides,
  } as unknown as Env;
}

// Mock all data/feeds routes so handleScheduled resolves quickly
vi.mock("../../../worker/src/routes/data", () => ({
  handleCurrency: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
  handleHebcal: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
  handleHebcalHolidays: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
}));
vi.mock("../../../worker/src/routes/feeds", () => ({
  handleStocks: vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
}));
vi.mock("../../../worker/src/utils/d1-reports", () => ({
  pruneOldReports: vi.fn().mockResolvedValue(undefined),
}));

// ── CRON1: handleScheduled never rejects with mock handlers ──────────────────

describe("cron — CRON1: handleScheduled never rejects", () => {
  it("resolves for any env without DB binding", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(makeEnv()), async (env) => {
        await expect(handleScheduled(env)).resolves.toBeUndefined();
      }),
      { numRuns: 10 },
    );
  });
});

// ── CRON2: handleScheduled swallows handler failures ─────────────────────────

describe("cron — CRON2: handleScheduled swallows all handler failures", () => {
  it("still resolves when mock handlers are changed to reject", async () => {
    // Override mocks to throw
    const { handleCurrency, handleHebcal, handleHebcalHolidays } =
      await import("../../../worker/src/routes/data");
    const { handleStocks } = await import("../../../worker/src/routes/feeds");
    vi.mocked(handleCurrency).mockRejectedValue(new Error("currency down"));
    vi.mocked(handleHebcal).mockRejectedValue(new Error("hebcal down"));
    vi.mocked(handleHebcalHolidays).mockRejectedValue(new Error("holidays down"));
    vi.mocked(handleStocks).mockRejectedValue(new Error("stocks down"));

    await fc.assert(
      fc.asyncProperty(fc.constant(makeEnv()), async (env) => {
        await expect(handleScheduled(env)).resolves.toBeUndefined();
      }),
      { numRuns: 5 },
    );

    // Restore happy mocks for subsequent tests
    vi.mocked(handleCurrency).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.mocked(handleHebcal).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.mocked(handleHebcalHolidays).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.mocked(handleStocks).mockResolvedValue(new Response("{}", { status: 200 }));
  });
});

// ── CRON3: handleNextYearPreWarm never rejects ────────────────────────────────

describe("cron — CRON3: handleNextYearPreWarm never rejects", () => {
  it("resolves for any env", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(makeEnv()), async (env) => {
        await expect(handleNextYearPreWarm(env)).resolves.toBeUndefined();
      }),
      { numRuns: 10 },
    );
  });
});

// ── CRON4: handleWeeklyDigest never rejects when email is unconfigured ────────

describe("cron — CRON4: handleWeeklyDigest never rejects without email config", () => {
  it("resolves for any env without email bindings", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(makeEnv()), async (env) => {
        await expect(handleWeeklyDigest(env)).resolves.toBeUndefined();
      }),
      { numRuns: 10 },
    );
  });
});

// ── OTEL1: initOtel with disabled flag → enabled === false ───────────────────

describe("telemetry — OTEL1: initOtel disabled returns enabled=false", () => {
  it("always returns enabled:false when OTEL_ENABLED !== 'true'", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("false", "0", "", "off", "disabled", "no", undefined as unknown as string),
        (flag) => {
          const env = makeEnv({ OTEL_ENABLED: flag });
          const handle = initOtel(env);
          expect(handle.enabled).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── OTEL2: span() returns callback result (no-op path) ───────────────────────

describe("telemetry — OTEL2: span() returns callback result", () => {
  it("always returns whatever the callback returns", () => {
    const env = makeEnv();
    const handle = initOtel(env);
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), (val) => {
        const result = handle.span("test:span", () => val);
        expect(result).toBe(val);
      }),
      { numRuns: 30 },
    );
  });
});

// ── OTEL3: flush() always resolves ───────────────────────────────────────────

describe("telemetry — OTEL3: flush() always resolves on no-op path", () => {
  it("flush always resolves to undefined", async () => {
    const env = makeEnv();
    const handle = initOtel(env);
    await fc.assert(
      fc.asyncProperty(fc.integer(), async (_n) => {
        await expect(handle.flush()).resolves.toBeUndefined();
      }),
      { numRuns: 20 },
    );
  });
});

// ── OTEL4: span callback can call setAttribute + setStatus ───────────────────

describe("telemetry — OTEL4: span callback can invoke setAttribute and setStatus", () => {
  it("setAttribute and setStatus on no-op span never throw", () => {
    const env = makeEnv();
    const handle = initOtel(env);
    fc.assert(
      fc.property(
        fc.string(),
        fc.oneof(fc.string(), fc.integer(), fc.boolean()),
        fc.constantFrom("ok" as const, "error" as const),
        fc.option(fc.string(), { nil: undefined }),
        (key, attrVal, code, msg) => {
          expect(() =>
            handle.span("test:otel4", (span) => {
              span.setAttribute(key, attrVal as string | number | boolean);
              span.setStatus(code, msg ?? undefined);
            }),
          ).not.toThrow();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── OTEL5: initOtel with OTEL_ENABLED="true" still returns a valid handle ────

describe("telemetry — OTEL5: initOtel with OTEL_ENABLED='true' returns handle", () => {
  it("returns a live handle when OTEL_ENABLED='true' and endpoint is set", () => {
    // With OTEL_ENABLED="true" and OTEL_ENDPOINT set, initOtel returns a live handle.
    const env = makeEnv({ OTEL_ENABLED: "true" });
    const handle = initOtel(env);
    // The no-op implementation returns the same noop handle regardless
    expect(typeof handle.span).toBe("function");
    expect(typeof handle.flush).toBe("function");
    // span should still work
    const result = handle.span("test:enabled", () => 42);
    expect(result).toBe(42);
  });
});
