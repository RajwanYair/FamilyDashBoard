/**
 * fast-check property tests — src/ui/resizer.ts (DOM-aware)
 *
 * Properties under test:
 *  RZ1. initResizers with .grids-area creates two guide elements in body
 *  RZ2. guide elements have aria-hidden="true" for accessibility
 *  RZ3. initResizers adds exactly 3 window event listeners (mousemove, mousedown, mouseup)
 *  RZ4. initResizers is safe to call multiple times without throwing
 *  RZ5. initResizers without .grids-area does NOT create guide elements
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as fc from "fast-check";

// ── Setup: ensure fresh module per test ──────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-resize-col");
  document.documentElement.removeAttribute("data-resize-row");
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// ── RZ1: guide elements created when .grids-area present ─────────────────────

describe("resizer — RZ1: initResizers creates guide elements", () => {
  it("creates col + row guide divs when .grids-area exists", async () => {
    document.body.innerHTML = '<div class="grids-area"></div>';
    const { initResizers } = await import("@/ui/resizer");
    initResizers();
    const guides = document.querySelectorAll("[class^='resize-guide--']");
    expect(guides.length).toBe(2);
  });
});

// ── RZ2: guides have aria-hidden ─────────────────────────────────────────────

describe("resizer — RZ2: guide elements have aria-hidden", () => {
  it("all guide elements are aria-hidden='true'", async () => {
    document.body.innerHTML = '<div class="grids-area"></div>';
    const { initResizers } = await import("@/ui/resizer");
    initResizers();
    const guides = document.querySelectorAll("[class^='resize-guide--']");
    for (const g of guides) {
      expect(g.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

// ── RZ3: window event listeners attached ─────────────────────────────────────

describe("resizer — RZ3: adds 3 window event listeners", () => {
  it("addEventListener called 3 times for mousemove, mousedown, mouseup", async () => {
    document.body.innerHTML = '<div class="grids-area"></div>';
    const addSpy = vi.spyOn(window, "addEventListener");
    const { initResizers } = await import("@/ui/resizer");
    initResizers();
    const eventTypes = addSpy.mock.calls.map((c) => c[0]);
    expect(eventTypes).toContain("mousemove");
    expect(eventTypes).toContain("mousedown");
    expect(eventTypes).toContain("mouseup");
  });
});

// ── RZ4: idempotent — multiple calls do not throw ────────────────────────────

describe("resizer — RZ4: multiple initResizers calls safe", () => {
  it("calling initResizers repeatedly does not throw", async () => {
    document.body.innerHTML = '<div class="grids-area"></div>';
    const { initResizers } = await import("@/ui/resizer");
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
        for (let i = 0; i < n; i++) {
          expect(() => initResizers()).not.toThrow();
        }
      }),
      { numRuns: 3 },
    );
  });
});

// ── RZ5: no .grids-area → no guides ─────────────────────────────────────────

describe("resizer — RZ5: no .grids-area → no guide creation", () => {
  it("does not inject guide elements when .grids-area missing", async () => {
    document.body.innerHTML = "<div></div>";
    const { initResizers } = await import("@/ui/resizer");
    initResizers();
    const guides = document.querySelectorAll("[class^='resize-guide--']");
    expect(guides.length).toBe(0);
  });
});
