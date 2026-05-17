/**
 * fast-check property tests — src/ui/toast.ts
 *
 * Properties under test:
 *  TS1. showToast(msg) with any non-empty string never throws.
 *  TS2. showToast(msg, duration) with any valid duration never throws.
 *  TS3. showToast sets the `visible` class on the toast element.
 *  TS4. Successive showToast calls never throw.
 *  TS5. showToast is safe when the toast element is absent from the DOM.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

afterEach(() => {
  document.body.innerHTML = "";
  vi.resetModules();
});

// ── TS1: any non-empty message never throws ───────────────────────────────────

describe("toast — TS1: showToast(msg) never throws for any string", () => {
  it("accepts arbitrary non-empty strings without throwing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (msg) => {
          vi.resetModules();
          document.body.innerHTML = '<div id="toast"></div>';
          const { showToast } = await import("@/ui/toast");
          expect(() => showToast(msg)).not.toThrow();
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── TS2: any duration never throws ────────────────────────────────────────────

describe("toast — TS2: showToast(msg, duration) accepts any positive duration", () => {
  it("does not throw for any duration in [1, 30000]", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 30_000 }),
        async (durationMs) => {
          vi.resetModules();
          document.body.innerHTML = '<div id="toast"></div>';
          const { showToast } = await import("@/ui/toast");
          expect(() => showToast("test", durationMs)).not.toThrow();
        },
      ),
      { numRuns: 12 },
    );
  });
});

// ── TS3: visible class is set after showToast ─────────────────────────────────

describe("toast — TS3: showToast sets visible class on element", () => {
  it("toast element has `visible` class after a call", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (msg) => {
          vi.resetModules();
          document.body.innerHTML = '<div id="toast"></div>';
          const { showToast } = await import("@/ui/toast");
          showToast(msg);
          const el = document.getElementById("toast")!;
          expect(el.classList.contains("visible")).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── TS4: successive calls do not throw ────────────────────────────────────────

describe("toast — TS4: successive showToast calls are safe", () => {
  it("N consecutive showToast calls never throw", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 6 }), async (n) => {
        vi.resetModules();
        document.body.innerHTML = '<div id="toast"></div>';
        const { showToast } = await import("@/ui/toast");
        for (let i = 0; i < n; i++) {
          expect(() => showToast(`message ${i}`)).not.toThrow();
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── TS5: safe when toast element is absent ────────────────────────────────────

describe("toast — TS5: showToast is a no-op when the toast element is absent", () => {
  it("does not throw when #toast is not in the DOM", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 100 }),
        async (msg) => {
          vi.resetModules();
          document.body.innerHTML = "";
          const { showToast } = await import("@/ui/toast");
          expect(() => showToast(msg)).not.toThrow();
        },
      ),
      { numRuns: 10 },
    );
  });
});
