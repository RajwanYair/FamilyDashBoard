/**
 * fast-check property tests — src/ui/header.ts
 *
 * Properties under test:
 *  HD1. numToGematria: invalid input (≤0 or >9999 or non-integer) → String(n)
 *  HD2. numToGematria: valid input → non-empty Hebrew string
 *  HD3. numToGematria: result contains only Hebrew letters + gershayim/geresh
 *  HD4. numToGematria: 15 never produces יה (divine name avoidance)
 *  HD5. numToGematria: 16 never produces יו (divine name avoidance)
 *  HD6. formatHebrewDateGematria: output contains Hebrew month names
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { numToGematria, formatHebrewDateGematria } from "@/ui/header";

// ── HD1: invalid input → fallback to String(n) ──────────────────────────────

describe("header — HD1: numToGematria invalid", () => {
  it("returns String(n) for invalid inputs", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), (n) => {
        expect(numToGematria(n)).toBe(String(n));
      }),
      { numRuns: 5 },
    );
    expect(numToGematria(10000)).toBe("10000");
    expect(numToGematria(1.5)).toBe("1.5");
  });
});

// ── HD2: valid input → non-empty string ──────────────────────────────────────

describe("header — HD2: valid input non-empty", () => {
  it("returns non-empty string for 1-9999", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), (n) => {
        const result = numToGematria(n);
        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toBe(String(n));
      }),
      { numRuns: 20 },
    );
  });
});

// ── HD3: result is Hebrew chars + punctuation only ───────────────────────────

describe("header — HD3: Hebrew chars only", () => {
  it("contains only Hebrew letters and gershayim/geresh", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999 }), (n) => {
        const result = numToGematria(n);
        // Hebrew Unicode range: \u05D0-\u05EA (aleph-tav) + ״ (\u05F4) + ׳ (\u05F3)
        expect(result).toMatch(/^[\u05D0-\u05EA\u05F3\u05F4]+$/);
      }),
      { numRuns: 30 },
    );
  });
});

// ── HD4: 15 avoids divine name יה ────────────────────────────────────────────

describe("header — HD4: 15 avoidance", () => {
  it("15 uses טו instead of יה", () => {
    const result = numToGematria(15);
    expect(result).toContain("ט");
    expect(result).not.toMatch(/י[^״׳]?ה/);
  });
});

// ── HD5: 16 avoids divine name יו ────────────────────────────────────────────

describe("header — HD5: 16 avoidance", () => {
  it("16 uses טז instead of יו", () => {
    const result = numToGematria(16);
    expect(result).toContain("ט");
    expect(result).toContain("ז");
  });
});

// ── HD6: formatHebrewDateGematria output ─────────────────────────────────────

describe("header — HD6: formatHebrewDateGematria", () => {
  it("contains Hebrew characters and no ASCII digits", () => {
    const date = new Date(2024, 3, 15); // Apr 15, 2024
    const result = formatHebrewDateGematria(date);
    // Should not contain ASCII digits (all replaced by gematria)
    expect(result).not.toMatch(/\d/);
    // Should contain Hebrew letters
    expect(result).toMatch(/[\u05D0-\u05EA]/);
  });
});
