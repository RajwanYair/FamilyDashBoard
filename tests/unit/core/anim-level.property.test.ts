/**
 * fast-check property tests — src/core/anim-level.ts
 *
 * Properties under test:
 *  AL1. effectiveAnimLevel("full") always returns "full" regardless of OS pref.
 *  AL2. effectiveAnimLevel("normal") → "minimal" when prefers-reduced-motion.
 *  AL3. effectiveAnimLevel("none"|"minimal") passes through unchanged.
 *  AL4. effectiveAnimLevel returns a valid AnimLevel for any valid input.
 *  AL5. applyAnimLevel stamps data-anim-level on document.body.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import { effectiveAnimLevel, applyAnimLevel } from "@/core/anim-level";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const VALID_LEVELS = ["none", "minimal", "normal", "full"] as const;
const levelArb = fc.constantFrom(...VALID_LEVELS);

// ── Helper: mock matchMedia ───────────────────────────────────────────────────

function mockReducedMotion(prefers: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? prefers : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete document.body.dataset["animLevel"];
});

// ── AL1: "full" always passes through ────────────────────────────────────────

describe("anim-level — AL1: full always passes through", () => {
  it("returns full regardless of OS pref", () => {
    fc.assert(
      fc.property(fc.boolean(), (prefersReduced) => {
        mockReducedMotion(prefersReduced);
        expect(effectiveAnimLevel("full")).toBe("full");
      }),
      { numRuns: 10 },
    );
  });
});

// ── AL2: "normal" + reduced motion → "minimal" ──────────────────────────────

describe("anim-level — AL2: normal clamped to minimal with reduced motion", () => {
  it("returns minimal when OS has prefers-reduced-motion", () => {
    mockReducedMotion(true);
    expect(effectiveAnimLevel("normal")).toBe("minimal");
  });
});

// ── AL3: "none" and "minimal" pass through ───────────────────────────────────

describe("anim-level — AL3: none/minimal pass through unchanged", () => {
  it("returns input level for none and minimal", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("none" as const, "minimal" as const),
        fc.boolean(),
        (level, prefersReduced) => {
          mockReducedMotion(prefersReduced);
          expect(effectiveAnimLevel(level)).toBe(level);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── AL4: always returns a valid AnimLevel ────────────────────────────────────

describe("anim-level — AL4: always returns valid AnimLevel", () => {
  it("output is one of the 4 valid levels", () => {
    fc.assert(
      fc.property(levelArb, fc.boolean(), (level, prefersReduced) => {
        mockReducedMotion(prefersReduced);
        const result = effectiveAnimLevel(level);
        expect(VALID_LEVELS).toContain(result);
      }),
      { numRuns: 20 },
    );
  });
});

// ── AL5: applyAnimLevel stamps data attribute ────────────────────────────────

describe("anim-level — AL5: applyAnimLevel sets data-anim-level", () => {
  it("stamps the correct level on body", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        applyAnimLevel(level);
        expect(document.body.dataset["animLevel"]).toBe(level);
      }),
      { numRuns: 10 },
    );
  });
});
