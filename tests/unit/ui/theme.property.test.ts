/**
 * fast-check property tests — src/ui/theme.ts ( b → )
 *
 * Properties under test:
 *  TH1. applyTheme: invalid theme defaults to "black"
 *  TH2. applyTheme: valid theme applies correct class
 *  TH3. cycleTheme: after applying any theme, cycling moves to next
 *  TH4. currentTheme: returns whatever was applied
 *  TH5. applyTheme: removes previous theme class
 *  TH6. checkAutoTheme: no-op when disabled
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { applyTheme, cycleTheme, currentTheme, checkAutoTheme, THEMES } from "@/ui/theme";

// ── TH1: invalid theme defaults to black ─────────────────────────────────────

describe("theme — TH1: invalid theme fallback", () => {
  it("random invalid names fall back to black", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^invalid-[a-z]{3,10}$/), (name) => {
        applyTheme(name);
        expect(document.body.classList.contains("theme-black")).toBe(true);
      }),
      { numRuns: 10 },
    );
  });
});

// ── TH2: valid theme applies correct class ───────────────────────────────────

describe("theme — TH2: valid theme class", () => {
  it("each of the 7 themes applies its class", () => {
    for (const t of THEMES) {
      applyTheme(t);
      expect(document.body.classList.contains(`theme-${t}`)).toBe(true);
    }
  });
});

// ── TH3: cycleTheme moves to next ───────────────────────────────────────────

describe("theme — TH3: cycleTheme progression", () => {
  it("cycling from each theme goes to the next", () => {
    for (let i = 0; i < THEMES.length; i++) {
      applyTheme(THEMES[i]!);
      cycleTheme();
      const expected = THEMES[(i + 1) % THEMES.length]!;
      expect(currentTheme()).toBe(expected);
    }
  });
});

// ── TH4: currentTheme returns applied ────────────────────────────────────────

describe("theme — TH4: currentTheme", () => {
  it("returns the last applied valid theme", () => {
    for (const t of THEMES) {
      applyTheme(t);
      expect(currentTheme()).toBe(t);
    }
  });
});

// ── TH5: applyTheme removes previous ────────────────────────────────────────

describe("theme — TH5: removes previous theme", () => {
  it("only one theme class is present at a time", () => {
    applyTheme("blue");
    applyTheme("matrix");
    const themeClasses = THEMES.filter((t) => document.body.classList.contains(`theme-${t}`));
    expect(themeClasses).toHaveLength(1);
    expect(themeClasses[0]).toBe("matrix");
  });
});

// ── TH6: checkAutoTheme no-op when disabled ──────────────────────────────────

describe("theme — TH6: checkAutoTheme disabled", () => {
  it("does not change theme when enabled=false", () => {
    applyTheme("purple");
    checkAutoTheme(false, "blue");
    expect(currentTheme()).toBe("purple");
  });
});
