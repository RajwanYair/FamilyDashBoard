/**
 * Property-based tests for src/ui/scroll.ts — depth extension (Sprint 9).
 *
 * Complements SC1-SC4 in resizer-scroll.property.test.ts with deeper
 * coverage of the remaining scroll API surface.
 *
 * SL1 — stopScroll clears animation and removes .clone children (idempotent)
 * SL2 — startSimpleScroll never throws for arbitrary containers + params
 * SL3 — initScrollShadows never throws regardless of DOM state
 * SL4 — startCloneScroll + stopScroll round-trip: stopScroll never throws
 * SL5 — injectScrollKeyframes: style textContent always contains keyframe name
 */

import { describe, it, expect, afterEach } from "vitest";
import fc from "fast-check";
import {
  injectScrollKeyframes,
  startCloneScroll,
  startSimpleScroll,
  stopScroll,
  initScrollShadows,
} from "@/ui/scroll";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("scroll — SL1: stopScroll is idempotent and clears animation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("animation is cleared and clones removed after stopScroll", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (cloneCount) => {
        const container = document.createElement("div");
        container.style.animation = "someAnim 1s linear infinite";
        // Add fake clones
        for (let i = 0; i < cloneCount; i++) {
          const clone = document.createElement("div");
          clone.classList.add("clone");
          container.appendChild(clone);
        }
        document.body.appendChild(container);

        stopScroll(container);

        expect(container.style.animation).toBe("none");
        expect(container.querySelectorAll(".clone").length).toBe(0);

        document.body.removeChild(container);
      }),
      { numRuns: 10 },
    );
  });
});

describe("scroll — SL2: startSimpleScroll never throws for arbitrary inputs", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("does not throw regardless of container content or durationPerPx", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // childCount
        fc.integer({ min: 1, max: 20 }), // durationPerPx (integer avoids float edge cases)
        (childCount, durationPerPx) => {
          const container = document.createElement("div");
          for (let i = 0; i < childCount; i++) {
            const item = document.createElement("div");
            item.textContent = `item ${i}`;
            container.appendChild(item);
          }
          document.body.appendChild(container);

          // Function must not throw regardless of scrollDistance being < 10 (early exit)
          // or >= 10 (animates)
          expect(() =>
            startSimpleScroll(container, `simpleScroll_sl2`, durationPerPx),
          ).not.toThrow();

          stopScroll(container);
          document.body.removeChild(container);
          document.getElementById("simpleScroll_sl2-style")?.remove();
        },
      ),
      { numRuns: 8 },
    );
  });
});

describe("scroll — SL3: initScrollShadows never throws", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not throw with 0 .card__body elements in DOM", () => {
    expect(() => initScrollShadows()).not.toThrow();
  });

  it("does not throw with arbitrary count of .card__body elements", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
        document.body.innerHTML = "";
        for (let i = 0; i < count; i++) {
          const body = document.createElement("div");
          body.className = "card__body";
          document.body.appendChild(body);
        }
        expect(() => initScrollShadows()).not.toThrow();
      }),
      { numRuns: 8 },
    );
  });
});

describe("scroll — SL4: startCloneScroll + stopScroll round-trip", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("stopScroll never throws after startCloneScroll", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }), // childCount — ensures some content exists
        fc.integer({ min: 1, max: 10 }), // durationPerPx
        (childCount, durationPerPx) => {
          const container = document.createElement("div");
          for (let i = 0; i < childCount; i++) {
            const item = document.createElement("div");
            item.textContent = `row ${i}`;
            container.appendChild(item);
          }
          document.body.appendChild(container);

          startCloneScroll(container, "sl4Anim", durationPerPx);
          // stopScroll must not throw regardless of animation state
          expect(() => stopScroll(container)).not.toThrow();
          // After stop, no .clone children remain
          expect(container.querySelectorAll(".clone").length).toBe(0);

          document.body.removeChild(container);
          document.getElementById("sl4Anim-style")?.remove();
        },
      ),
      { numRuns: 8 },
    );
  });
});

describe("scroll — SL5: injectScrollKeyframes embeds keyframe name in style text", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("style textContent contains the given keyframeName", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)),
        fc.integer({ min: 10, max: 2000 }),
        (keyframeName, distance) => {
          const styleId = `sl5-${keyframeName}`;
          injectScrollKeyframes(styleId, keyframeName, distance);
          const style = document.getElementById(styleId) as HTMLStyleElement | null;
          expect(style).not.toBeNull();
          expect(style?.textContent).toContain(keyframeName);
          style?.remove();
        },
      ),
      { numRuns: 10 },
    );
  });
});
