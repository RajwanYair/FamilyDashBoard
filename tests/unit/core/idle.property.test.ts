/**
 * fast-check property tests — src/core/idle.ts
 *
 * Properties under test:
 *  ID1. scheduleIdle fires the callback exactly once for any function.
 *  ID2. onVisibilityChange: all registered callbacks are invoked on each change.
 *  ID3. isPageVisible always returns a boolean (never undefined/null).
 *  ID4. shouldWakeRefresh is false when the page has never been hidden.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/constants", () => ({ WAKE_REFRESH_MS: 60_000 }));

// ── ID1: scheduleIdle fires once ──────────────────────────────────────────────

describe("idle — ID1: scheduleIdle fires callback exactly once", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("callback is called exactly once after tick for any function", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async (n) => {
        vi.resetModules();
        vi.useFakeTimers();
        const { scheduleIdle } = await import("@/core/idle");
        const fn = vi.fn().mockReturnValue(n);
        scheduleIdle(fn);
        vi.runAllTimers();
        expect(fn).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
      }),
      { numRuns: 10 },
    );
  });
});

// ── ID2: onVisibilityChange notifies all registered callbacks ─────────────────

describe("idle — ID2: all registered visibility callbacks are called", () => {
  afterEach(() => vi.resetModules());

  it("all N registered callbacks receive the correct visibility value", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), fc.boolean(), async (n, visible) => {
        vi.resetModules();
        const mod = await import("@/core/idle");
        const spies = Array.from({ length: n }, () => vi.fn());
        for (const spy of spies) mod.onVisibilityChange(spy);

        // Wire up the event listener and dispatch
        mod.initVisibility();
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => !visible,
        });
        document.dispatchEvent(new Event("visibilitychange"));

        for (const spy of spies) {
          expect(spy).toHaveBeenCalledWith(visible);
        }
      }),
      { numRuns: 15 },
    );
  });
});

// ── ID3: isPageVisible always returns a boolean ───────────────────────────────

describe("idle — ID3: isPageVisible always returns a boolean", () => {
  it("returns true or false (never null/undefined) regardless of document.hidden", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (hidden) => {
        vi.resetModules();
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => hidden,
        });
        const { isPageVisible } = await import("@/core/idle");
        const result = isPageVisible();
        expect(typeof result).toBe("boolean");
      }),
      { numRuns: 20 },
    );
  });
});

// ── ID4: shouldWakeRefresh is false on a fresh module load ────────────────────

describe("idle — ID4: shouldWakeRefresh is false before first hide", () => {
  it("returns false before any visibility event for any state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        const { shouldWakeRefresh } = await import("@/core/idle");
        expect(shouldWakeRefresh()).toBe(false);
      }),
      { numRuns: 5 },
    );
  });
});
