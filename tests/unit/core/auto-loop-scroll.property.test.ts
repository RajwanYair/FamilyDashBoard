/**
 * Property-based tests for src/core/auto-loop-scroll.ts
 *
 * ALS1 — destroyAutoLoopScroll never throws for any container/styleId
 * ALS2 — initAutoLoopScroll with prefers-reduced-motion: never clones children
 * ALS3 — initAutoLoopScroll with anim-level none/minimal: never clones children
 * ALS4 — destroyAutoLoopScroll is idempotent (double-call is safe)
 * ALS5 — initAutoLoopScroll with arbitrary pxPerSec/minDurSec never throws
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { initAutoLoopScroll, destroyAutoLoopScroll } from "@/core/auto-loop-scroll";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(itemCount: number): {
  parent: HTMLDivElement;
  container: HTMLDivElement;
} {
  const parent = document.createElement("div");
  const container = document.createElement("div");
  parent.appendChild(container);
  for (let i = 0; i < itemCount; i++) {
    const item = document.createElement("div");
    item.textContent = `Item ${i}`;
    container.appendChild(item);
  }
  document.body.appendChild(parent);
  return { parent, container };
}

function mockReducedMotion(matches: boolean): void {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("auto-loop-scroll — property tests", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("ALS1 — destroyAutoLoopScroll never throws for arbitrary container/styleId", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.integer({ min: 0, max: 20 }),
        (styleId, itemCount) => {
          const { container } = makeContainer(itemCount);
          // Must not throw
          expect(() => destroyAutoLoopScroll(container, styleId)).not.toThrow();
          // Animation style cleared
          expect(container.style.animation).toBe("");
          document.body.innerHTML = "";
        },
      ),
      { numRuns: 10 },
    );
  });

  it("ALS2 — initAutoLoopScroll with reduced-motion never adds clones", () => {
    mockReducedMotion(true);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (itemCount) => {
        const { container } = makeContainer(itemCount);
        initAutoLoopScroll(container, { styleId: `als-test-${itemCount}` });
        const clones = container.querySelectorAll("[data-als-clone='true']").length;
        expect(clones).toBe(0);
        document.body.innerHTML = "";
      }),
      { numRuns: 8 },
    );
  });

  it("ALS3 — initAutoLoopScroll with anim-level none/minimal never adds clones", () => {
    mockReducedMotion(false);
    fc.assert(
      fc.property(
        fc.oneof(fc.constant("none"), fc.constant("minimal")),
        fc.integer({ min: 1, max: 20 }),
        (animLevel, itemCount) => {
          document.body.dataset["animLevel"] = animLevel;
          const { container } = makeContainer(itemCount);
          initAutoLoopScroll(container, { styleId: `als-anim-${itemCount}` });
          const clones = container.querySelectorAll("[data-als-clone='true']").length;
          expect(clones).toBe(0);
          document.body.innerHTML = "";
          delete document.body.dataset["animLevel"];
        },
      ),
      { numRuns: 8 },
    );
  });

  it("ALS4 — destroyAutoLoopScroll is idempotent (safe to call twice)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.integer({ min: 0, max: 15 }),
        (styleId, itemCount) => {
          const { container } = makeContainer(itemCount);
          // Double-call must not throw
          expect(() => {
            destroyAutoLoopScroll(container, styleId);
            destroyAutoLoopScroll(container, styleId);
          }).not.toThrow();
          expect(container.querySelectorAll("[data-als-clone='true']").length).toBe(0);
          document.body.innerHTML = "";
        },
      ),
      { numRuns: 8 },
    );
  });

  it("ALS5 — initAutoLoopScroll with arbitrary pxPerSec/minDurSec never throws", () => {
    mockReducedMotion(false);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 1, max: 20 }),
        (pxPerSec, minDurSec, itemCount) => {
          const { container } = makeContainer(itemCount);
          expect(() =>
            initAutoLoopScroll(container, {
              styleId: `als-speed-${pxPerSec}-${minDurSec}`,
              pxPerSec,
              minDurSec,
            }),
          ).not.toThrow();
          destroyAutoLoopScroll(container, `als-speed-${pxPerSec}-${minDurSec}`);
          document.body.innerHTML = "";
        },
      ),
      { numRuns: 8 },
    );
  });
});
