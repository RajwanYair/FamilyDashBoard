/**
 * fast-check property tests — src/ui/screen-mode.ts 
 *
 * Properties under test:
 *  SM1. applyFontScale clamps below 0.7 to 0.7
 *  SM2. applyFontScale clamps above 1.5 to 1.5
 *  SM3. applyFontScale within range rounds to 2 decimal places
 *  SM4. applyFontScale sets --font-scale CSS custom property
 *  SM5. applyScreenMode applies correct class to body
 *  SM6. applyScreenMode removes previous screen class
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { applyFontScale, applyScreenMode } from "@/ui/screen-mode";

// ── SM1: clamp lower bound ───────────────────────────────────────────────────

describe("screen-mode — SM1: applyFontScale lower clamp", () => {
  it("any value < 0.7 results in 0.7", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 0.69, noNaN: true }),
        (val) => {
          applyFontScale(val);
          const prop = document.documentElement.style.getPropertyValue("--font-scale");
          expect(prop).toBe("0.7");
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── SM2: clamp upper bound ───────────────────────────────────────────────────

describe("screen-mode — SM2: applyFontScale upper clamp", () => {
  it("any value > 1.5 results in 1.5", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.51, max: 1000, noNaN: true }),
        (val) => {
          applyFontScale(val);
          const prop = document.documentElement.style.getPropertyValue("--font-scale");
          expect(prop).toBe("1.5");
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── SM3: within range rounds to 2dp ─────────────────────────────────────────

describe("screen-mode — SM3: applyFontScale precision", () => {
  it("within [0.7, 1.5] rounds to 2 decimal places", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.7, max: 1.5, noNaN: true }),
        (val) => {
          applyFontScale(val);
          const prop = document.documentElement.style.getPropertyValue("--font-scale");
          const parsed = Number(prop);
          // rounded to 2dp
          expect(parsed).toBe(Math.round(parsed * 100) / 100);
          // within range
          expect(parsed).toBeGreaterThanOrEqual(0.7);
          expect(parsed).toBeLessThanOrEqual(1.5);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── SM4: CSS property is set ─────────────────────────────────────────────────

describe("screen-mode — SM4: applyFontScale sets property", () => {
  it("sets --font-scale on documentElement", () => {
    applyFontScale(1.0);
    expect(document.documentElement.style.getPropertyValue("--font-scale")).toBe("1");
  });
});

// ── SM5: applyScreenMode correct class ───────────────────────────────────────

describe("screen-mode — SM5: applyScreenMode class", () => {
  it("applies screen-tv / screen-tablet / screen-phone", () => {
    const modes = ["tv", "tablet", "phone"] as const;
    for (const m of modes) {
      applyScreenMode(m);
      expect(document.body.classList.contains(`screen-${m}`)).toBe(true);
    }
  });
});

// ── SM6: applyScreenMode removes old ────────────────────────────────────────

describe("screen-mode — SM6: applyScreenMode removes old", () => {
  it("removes previous screen class", () => {
    applyScreenMode("tv");
    applyScreenMode("tablet");
    expect(document.body.classList.contains("screen-tv")).toBe(false);
    expect(document.body.classList.contains("screen-tablet")).toBe(true);
  });
});
