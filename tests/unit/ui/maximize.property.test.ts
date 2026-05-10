/**
 * fast-check property tests — src/ui/maximize.ts
 *
 * Properties under test:
 *  MX1. computeFontScale: result always in [1, 4]
 *  MX2. computeFontScale: same-size rects → 1
 *  MX3. computeFontScale: zero-width first → clamped (no Infinity)
 *  MX4. cardVtName: result is valid CSS ident (letters/digits/hyphens)
 *  MX5. cardVtName: starts with "card-max-"
 *  MX6. getMaximizedCard: initially null
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeFontScale, cardVtName, getMaximizedCard } from "@/ui/maximize";

// ── MX1: computeFontScale range ──────────────────────────────────────────────

describe("maximize — MX1: computeFontScale range", () => {
  it("always returns value in [1, 4]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 2000, noNaN: true }),
        fc.double({ min: 1, max: 2000, noNaN: true }),
        fc.double({ min: 1, max: 4000, noNaN: true }),
        fc.double({ min: 1, max: 4000, noNaN: true }),
        (w1, h1, w2, h2) => {
          const first = { width: w1, height: h1 } as DOMRect;
          const last = { width: w2, height: h2 } as DOMRect;
          const result = computeFontScale(first, last);
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(4);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── MX2: same-size rects → 1 ─────────────────────────────────────────────────

describe("maximize — MX2: same size → 1", () => {
  it("same dimensions produce scale of 1", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 10, max: 1000, noNaN: true }),
        (w, h) => {
          const rect = { width: w, height: h } as DOMRect;
          expect(computeFontScale(rect, rect)).toBe(1);
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── MX3: zero-width first → safe clamp ───────────────────────────────────────

describe("maximize — MX3: zero-width safe", () => {
  it("does not produce Infinity", () => {
    const first = { width: 0, height: 0 } as DOMRect;
    const last = { width: 500, height: 500 } as DOMRect;
    const result = computeFontScale(first, last);
    expect(result).toBeLessThanOrEqual(4);
    expect(Number.isFinite(result)).toBe(true);
  });
});

// ── MX4: cardVtName valid CSS ident ──────────────────────────────────────────

describe("maximize — MX4: cardVtName valid CSS", () => {
  it("result contains only letters, digits, hyphens", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9_. ]{1,20}$/), (id) => {
        const el = document.createElement("section");
        el.dataset["cardId"] = id;
        const name = cardVtName(el);
        expect(name).toMatch(/^[a-zA-Z0-9-]+$/);
      }),
      { numRuns: 10 },
    );
  });
});

// ── MX5: cardVtName prefix ───────────────────────────────────────────────────

describe("maximize — MX5: cardVtName prefix", () => {
  it("starts with card-max-", () => {
    const el = document.createElement("section");
    el.dataset["cardId"] = "weather";
    expect(cardVtName(el)).toBe("card-max-weather");
  });
});

// ── MX6: getMaximizedCard initially null ─────────────────────────────────────

describe("maximize — MX6: getMaximizedCard initial", () => {
  it("returns null when nothing is maximized", () => {
    expect(getMaximizedCard()).toBeNull();
  });
});
