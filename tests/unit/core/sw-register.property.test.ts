/**
 * fast-check property tests — src/core/sw-register.ts
 *
 * Properties under test:
 *  SWR1. registerSW() resolves when "serviceWorker" is absent from navigator.
 *  SWR2. registerSW() resolves silently on file:// protocol.
 *  SWR3. registerSW() resolves silently when ?nosw query param is present.
 *  SWR4. unregisterSW() always resolves to a non-negative integer.
 *  SWR5. swSkipWaiting() never throws regardless of registration state.
 *  SWR6. registerSW() can be called N times without unhandled rejections.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/sw-constants", () => ({
  SW_MSG_SKIP_WAITING: "SKIP_WAITING",
  SW_MSG_VERSION_ACTIVATED: "VERSION_ACTIVATED",
  isVersionActivatedMsg: vi.fn(() => false),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ── SWR1: resolves when serviceWorker is absent ───────────────────────────────

describe("sw-register — SWR1: resolves when serviceWorker absent from navigator", () => {
  it("registerSW() resolves without throwing when SW API is missing", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        // Remove serviceWorker from navigator
        const nav = Object.create(Object.getPrototypeOf(navigator), {
          ...Object.getOwnPropertyDescriptors(navigator),
        });
        delete (nav as Record<string, unknown>).serviceWorker;
        vi.stubGlobal("navigator", nav);
        const { registerSW } = await import("@/core/sw-register");
        await expect(registerSW()).resolves.toBeUndefined();
      }),
      { numRuns: 5 },
    );
  });
});

// ── SWR2: resolves silently on file:// protocol ───────────────────────────────

describe("sw-register — SWR2: registerSW() is a no-op on file:// protocol", () => {
  it("resolves without throwing on file://", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        vi.stubGlobal("location", {
          protocol: "file:",
          search: "",
          href: "file:///index.html",
          origin: "null",
        });
        const { registerSW } = await import("@/core/sw-register");
        await expect(registerSW()).resolves.toBeUndefined();
      }),
      { numRuns: 5 },
    );
  });
});

// ── SWR3: resolves silently with ?nosw param ──────────────────────────────────

describe("sw-register — SWR3: registerSW() is a no-op when ?nosw is present", () => {
  it("resolves without throwing when the nosw flag is set", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        vi.stubGlobal("location", {
          protocol: "https:",
          search: "?nosw=1",
          href: "https://example.com/?nosw=1",
          origin: "https://example.com",
        });
        const { registerSW } = await import("@/core/sw-register");
        await expect(registerSW()).resolves.toBeUndefined();
      }),
      { numRuns: 5 },
    );
  });
});

// ── SWR4: unregisterSW always resolves to ≥0 ─────────────────────────────────

describe("sw-register — SWR4: unregisterSW() resolves to a non-negative integer", () => {
  it("returns a number ≥ 0 regardless of SW support", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (hasSw) => {
        vi.resetModules();
        if (!hasSw) {
          const nav = Object.create(Object.getPrototypeOf(navigator), {
            ...Object.getOwnPropertyDescriptors(navigator),
          });
          delete (nav as Record<string, unknown>).serviceWorker;
          vi.stubGlobal("navigator", nav);
        } else {
          vi.stubGlobal("navigator", {
            ...navigator,
            serviceWorker: {
              getRegistrations: vi.fn().mockResolvedValue([]),
              controller: null,
              addEventListener: vi.fn(),
            },
          });
        }
        const { unregisterSW } = await import("@/core/sw-register");
        const count = await unregisterSW();
        expect(count).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 8 },
    );
  });
});

// ── SWR5: swSkipWaiting never throws ─────────────────────────────────────────

describe("sw-register — SWR5: swSkipWaiting() never throws", () => {
  it("swSkipWaiting() is safe regardless of registration state", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        const { swSkipWaiting } = await import("@/core/sw-register");
        expect(() => swSkipWaiting()).not.toThrow();
      }),
      { numRuns: 5 },
    );
  });
});

// ── SWR6: multiple registerSW calls don't reject ─────────────────────────────

describe("sw-register — SWR6: N registerSW() calls do not cause unhandled rejections", () => {
  it("all calls resolve without throwing when SW is absent", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 5 }), async (n) => {
        vi.resetModules();
        const nav = Object.create(Object.getPrototypeOf(navigator), {
          ...Object.getOwnPropertyDescriptors(navigator),
        });
        delete (nav as Record<string, unknown>).serviceWorker;
        vi.stubGlobal("navigator", nav);
        const { registerSW } = await import("@/core/sw-register");
        for (let i = 0; i < n; i++) {
          await expect(registerSW()).resolves.toBeUndefined();
        }
      }),
      { numRuns: 6 },
    );
  });
});
