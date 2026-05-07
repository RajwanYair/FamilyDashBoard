/**
 * fast-check property tests for src/core/anim-level.ts 
 *
 * Verifies `effectiveAnimLevel` and `applyAnimLevel` invariants over the
 * full level domain (none / minimal / normal / full) and arbitrary
 * matchMedia outcomes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import { applyAnimLevel, effectiveAnimLevel } from "@/core/anim-level";
import type { DashboardConfig } from "@/types/config";

type Level = DashboardConfig["animLevel"];
const LEVELS: readonly Level[] = ["none", "minimal", "normal", "full"];

describe("anim-level — fast-check properties (ALP1-ALP4 )", () => {
  let mmSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-anim-level");
  });

  afterEach(() => {
    mmSpy?.mockRestore();
    mmSpy = null;
  });

  function mockReducedMotion(reduced: boolean): void {
    mmSpy?.mockRestore();
    mmSpy = vi
      .spyOn(window, "matchMedia")
      .mockImplementation(
        (q) =>
          ({
            matches: q === "(prefers-reduced-motion: reduce)" ? reduced : false,
            media: q,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList,
      );
  }

  it("ALP1: applyAnimLevel always stamps data-anim-level to a valid level (defaults to 'normal' for invalid input)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.constantFrom(...LEVELS), fc.string()), (input) => {
        applyAnimLevel(input as Level);
        const stamped = document.body.dataset["animLevel"];
        expect(LEVELS).toContain(stamped as Level);
        if (LEVELS.includes(input as Level)) {
          expect(stamped).toBe(input);
        } else {
          expect(stamped).toBe("normal");
        }
      }),
      { numRuns: 50 },
    );
  });

  it("ALP2: effectiveAnimLevel('full') is always 'full' (user override wins)", () => {
    fc.assert(
      fc.property(fc.boolean(), (reduced) => {
        mockReducedMotion(reduced);
        expect(effectiveAnimLevel("full")).toBe("full");
      }),
      { numRuns: 10 },
    );
  });

  it("ALP3: when prefers-reduced-motion is set, 'normal' clamps to 'minimal'; other levels pass through", () => {
    mockReducedMotion(true);
    fc.assert(
      fc.property(fc.constantFrom(...LEVELS), (lvl) => {
        const out = effectiveAnimLevel(lvl);
        if (lvl === "normal") {
          expect(out).toBe("minimal");
        } else {
          expect(out).toBe(lvl);
        }
      }),
      { numRuns: 20 },
    );
  });

  it("ALP4: when prefers-reduced-motion is NOT set, effectiveAnimLevel is identity for every level", () => {
    mockReducedMotion(false);
    fc.assert(
      fc.property(fc.constantFrom(...LEVELS), (lvl) => {
        expect(effectiveAnimLevel(lvl)).toBe(lvl);
      }),
      { numRuns: 20 },
    );
  });
});
