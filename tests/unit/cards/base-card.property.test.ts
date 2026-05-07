/**
 * fast-check property tests — src/cards/base-card.ts 
 *
 * Properties under test:
 *  BC1. staleChip: <1 min → "עכשיו"
 *  BC2. staleChip: 1-59 min → contains "דק'"
 *  BC3. staleChip: 60 min to <24h → contains "שעה"
 *  BC4. staleChip: ≥24h → contains "יום" or "ימים"
 *  BC5. createSkeleton: N lines → N child elements
 *  BC6. createEmptyState: textContent equals input
 *  BC7. createErrorState: role alert + textContent
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { staleChip, createSkeleton, createEmptyState, createErrorState } from "@/cards/base-card";

const MS_PER_MIN = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

// ── BC1: <1 min → "עכשיו" ────────────────────────────────────────────────────

describe("base-card — BC1: staleChip sub-minute", () => {
  it("returns 'עכשיו' for age < 1 minute", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MS_PER_MIN - 1 }), (ms) => {
        expect(staleChip(ms)).toBe("עכשיו");
      }),
      { numRuns: 10 },
    );
  });
});

// ── BC2: 1-59 min → "דק'" ────────────────────────────────────────────────────

describe("base-card — BC2: staleChip minutes", () => {
  it("contains 'דק'' for 1-59 minutes", () => {
    fc.assert(
      fc.property(fc.integer({ min: MS_PER_MIN, max: MS_PER_HOUR - 1 }), (ms) => {
        expect(staleChip(ms)).toContain("דק'");
      }),
      { numRuns: 10 },
    );
  });
});

// ── BC3: 1-23h → "שעה" ──────────────────────────────────────────────────────

describe("base-card — BC3: staleChip hours", () => {
  it("contains 'שעה' for 1-23 hours", () => {
    fc.assert(
      fc.property(fc.integer({ min: MS_PER_HOUR, max: MS_PER_DAY - 1 }), (ms) => {
        expect(staleChip(ms)).toContain("שעה");
      }),
      { numRuns: 10 },
    );
  });
});

// ── BC4: ≥24h → "יום" or "ימים" ─────────────────────────────────────────────

describe("base-card — BC4: staleChip days", () => {
  it("contains 'יום' or 'ימים' for ≥24 hours", () => {
    fc.assert(
      fc.property(fc.integer({ min: MS_PER_DAY, max: MS_PER_DAY * 30 }), (ms) => {
        const result = staleChip(ms);
        expect(result.includes("יום") || result.includes("ימים")).toBe(true);
      }),
      { numRuns: 10 },
    );
  });
});

// ── BC5: createSkeleton line count ───────────────────────────────────────────

describe("base-card — BC5: createSkeleton", () => {
  it("creates N skeleton lines", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const el = createSkeleton(n);
        expect(el.children.length).toBe(n);
        expect(el.className).toBe("card-skeleton");
      }),
      { numRuns: 5 },
    );
  });
});

// ── BC6: createEmptyState text ───────────────────────────────────────────────

describe("base-card — BC6: createEmptyState", () => {
  it("displays the given message text", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (msg) => {
        const el = createEmptyState(msg);
        expect(el.textContent).toContain(msg);
        expect(el.className).toBe("card-empty");
      }),
      { numRuns: 5 },
    );
  });
});

// ── BC7: createErrorState role=alert ─────────────────────────────────────────

describe("base-card — BC7: createErrorState", () => {
  it("has role alert and displays message", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (msg) => {
        const el = createErrorState(msg);
        expect(el.getAttribute("role")).toBe("alert");
        expect(el.textContent).toContain(msg);
      }),
      { numRuns: 5 },
    );
  });
});
