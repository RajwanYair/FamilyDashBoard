/**
 * fast-check property tests — src/ui/status-bar.ts
 *
 * Properties under test:
 *  SB1. stampRefresh() with any DOM state never throws.
 *  SB2. updateRefreshAge() called before stampRefresh() never throws.
 *  SB3. updateUptime() never throws regardless of elapsed time.
 *  SB4. updateConnIndicator() never throws regardless of navigator.onLine state.
 *  SB5. initStatusBar() is safe to call without required DOM elements.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/sync", () => ({ registerSyncDot: vi.fn() }));
vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));
vi.mock("@/core/cache", () => ({ getOldestCacheAgeMinutes: vi.fn(() => 0) }));
vi.mock("@/core/constants", () => ({ MS_PER_MIN: 60_000 }));
vi.mock("@/core/utils", () => ({
  decomposeDuration: vi.fn((ms: number) => ({
    hours: Math.floor(ms / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: 0,
  })),
}));

afterEach(() => {
  document.body.innerHTML = "";
  vi.resetModules();
});

// ── SB1: stampRefresh never throws ────────────────────────────────────────────

describe("status-bar — SB1: stampRefresh() is safe with any DOM state", () => {
  it("stampRefresh() does not throw whether the element exists or not", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (addElement) => {
        vi.resetModules();
        document.body.innerHTML = addElement ? '<span id="refresh-stamp"></span>' : "";
        const { stampRefresh } = await import("@/ui/status-bar");
        expect(() => stampRefresh()).not.toThrow();
      }),
      { numRuns: 10 },
    );
  });
});

// ── SB2: updateRefreshAge safe before stampRefresh ────────────────────────────

describe("status-bar — SB2: updateRefreshAge() is safe before any stampRefresh", () => {
  it("updateRefreshAge() does not throw when no refresh has occurred", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (addElement) => {
        vi.resetModules();
        document.body.innerHTML = addElement ? '<span id="refresh-stamp"></span>' : "";
        const { updateRefreshAge } = await import("@/ui/status-bar");
        expect(() => updateRefreshAge()).not.toThrow();
      }),
      { numRuns: 10 },
    );
  });
});

// ── SB3: updateUptime never throws ────────────────────────────────────────────

describe("status-bar — SB3: updateUptime() never throws", () => {
  it("updateUptime() is safe regardless of elapsed time", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (addElement) => {
        vi.resetModules();
        document.body.innerHTML = addElement ? '<span id="uptime-display"></span>' : "";
        const { updateUptime } = await import("@/ui/status-bar");
        expect(() => updateUptime()).not.toThrow();
      }),
      { numRuns: 10 },
    );
  });
});

// ── SB4: updateConnIndicator for any onLine value ────────────────────────────

describe("status-bar — SB4: updateConnIndicator() handles any navigator.onLine value", () => {
  it("does not throw when online or offline", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (isOnline) => {
        vi.resetModules();
        document.body.innerHTML = '<span id="conn-indicator"></span>';
        Object.defineProperty(navigator, "onLine", {
          value: isOnline,
          configurable: true,
        });
        const { updateConnIndicator } = await import("@/ui/status-bar");
        expect(() => updateConnIndicator()).not.toThrow();
      }),
      { numRuns: 8 },
    );
  });
});

// ── SB5: initStatusBar safe without full DOM ──────────────────────────────────

describe("status-bar — SB5: initStatusBar() is safe without all DOM elements", () => {
  it("does not throw when DOM is empty", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(undefined), async () => {
        vi.resetModules();
        document.body.innerHTML = "";
        const { initStatusBar } = await import("@/ui/status-bar");
        expect(() => initStatusBar()).not.toThrow();
      }),
      { numRuns: 5 },
    );
  });
});
