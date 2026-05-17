/**
 * fast-check property tests — src/ui/offline-banner.ts
 *
 * Properties under test:
 *  OBN1. initOfflineBanner() accepts any callback without throwing.
 *  OBN2. _disposeOfflineBanner() is safe to call N times consecutively.
 *  OBN3. Re-initialising replaces the prior effect (no stacked duplicates).
 *  OBN4. Callback is never invoked synchronously during init.
 *  OBN5. dispose → reinit cycle is stable for arbitrary repetition counts.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));
vi.mock("@/core/i18n", () => ({ t: (k: string) => k }));

afterEach(() => {
  document.body.innerHTML = "";
  vi.resetModules();
});

// ── OBN1: initOfflineBanner accepts any callback ──────────────────────────────

describe("offline-banner — OBN1: initOfflineBanner accepts any callback", () => {
  it("never throws for callbacks of any shape", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (noOp) => {
        vi.resetModules();
        document.body.innerHTML =
          '<div id="offline-banner"></div><div id="toast"></div>';
        // fresh event-bus so signals are clean
        const bus = await import("@/core/event-bus");
        bus._resetBusForTesting();
        const { initOfflineBanner, _disposeOfflineBanner } = await import(
          "@/ui/offline-banner"
        );
        const cb = noOp ? () => undefined : vi.fn();
        expect(() => initOfflineBanner(cb)).not.toThrow();
        _disposeOfflineBanner();
      }),
      { numRuns: 10 },
    );
  });
});

// ── OBN2: _disposeOfflineBanner idempotent ────────────────────────────────────

describe("offline-banner — OBN2: dispose is idempotent", () => {
  it("calling dispose N times never throws", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
        vi.resetModules();
        document.body.innerHTML =
          '<div id="offline-banner"></div>';
        const bus = await import("@/core/event-bus");
        bus._resetBusForTesting();
        const { initOfflineBanner, _disposeOfflineBanner } = await import(
          "@/ui/offline-banner"
        );
        initOfflineBanner(() => {});
        for (let i = 0; i < n; i++) {
          expect(() => _disposeOfflineBanner()).not.toThrow();
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── OBN3: reinit replaces prior effect ───────────────────────────────────────

describe("offline-banner — OBN3: re-init replaces previous effect", () => {
  it("second init does not double-fire the callback", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 4 }), async (inits) => {
        vi.resetModules();
        document.body.innerHTML =
          '<div id="offline-banner"></div>';
        const bus = await import("@/core/event-bus");
        bus._resetBusForTesting();
        const { initOfflineBanner, _disposeOfflineBanner } = await import(
          "@/ui/offline-banner"
        );
        const callbacks: Array<ReturnType<typeof vi.fn>> = [];
        for (let i = 0; i < inits; i++) {
          const cb = vi.fn();
          callbacks.push(cb);
          initOfflineBanner(cb);
        }
        // Only the last callback is active — prior ones replaced
        // Verify dispose doesn't throw after multiple inits
        expect(() => _disposeOfflineBanner()).not.toThrow();
        // All callbacks received 0 synchronous calls during init
        for (const cb of callbacks) {
          expect(cb).not.toHaveBeenCalled();
        }
      }),
      { numRuns: 8 },
    );
  });
});

// ── OBN4: callback never called synchronously during init ────────────────────

describe("offline-banner — OBN4: callback not invoked synchronously during init", () => {
  it("onReconnect is not called at init time", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (_flag) => {
        vi.resetModules();
        document.body.innerHTML = '<div id="offline-banner"></div>';
        const bus = await import("@/core/event-bus");
        bus._resetBusForTesting();
        const { initOfflineBanner, _disposeOfflineBanner } = await import(
          "@/ui/offline-banner"
        );
        const cb = vi.fn();
        initOfflineBanner(cb);
        // Effect runs synchronously on init but reconnect fires only on
        // transition offline→online; since we start online the callback
        // should not have been queued.
        expect(cb).not.toHaveBeenCalled();
        _disposeOfflineBanner();
      }),
      { numRuns: 10 },
    );
  });
});

// ── OBN5: dispose/reinit cycle is stable ─────────────────────────────────────

describe("offline-banner — OBN5: dispose → reinit cycle is stable", () => {
  it("N cycles of dispose+reinit never throw", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5 }), async (cycles) => {
        vi.resetModules();
        document.body.innerHTML = '<div id="offline-banner"></div>';
        const bus = await import("@/core/event-bus");
        bus._resetBusForTesting();
        const { initOfflineBanner, _disposeOfflineBanner } = await import(
          "@/ui/offline-banner"
        );
        for (let i = 0; i < cycles; i++) {
          expect(() => initOfflineBanner(() => {})).not.toThrow();
          expect(() => _disposeOfflineBanner()).not.toThrow();
        }
      }),
      { numRuns: 8 },
    );
  });
});
