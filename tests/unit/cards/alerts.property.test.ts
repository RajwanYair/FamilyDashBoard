/**
 * fast-check property tests — src/cards/alerts/alerts.ts
 *
 * Properties under test:
 *  AL1. alertThreatIcon: threat=5 → 🟡
 *  AL2. alertThreatIcon: threat≤1 → 🔴
 *  AL3. alertThreatIcon: 2–4 → 🟠
 *  AL4. alertAgeLabel: <1 → "עכשיו"
 *  AL5. alertAgeLabel: 1–59 → includes "ד׳"
 *  AL6. alertAgeLabel: ≥60 → includes "ש׳"
 *  AL7. alertAgeLabel: hours = floor(ageMin/60)
 *  AL8. isAlertEvent: valid shape → true
 *  AL9. isAlertEvent: non-object → false
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { alertThreatIcon, alertAgeLabel } from "@/cards/alerts/alerts";
import { isAlertEvent } from "@/types/api";

// ── AL1: threat=5 → 🟡 ──────────────────────────────────────────────────────

describe("alerts — AL1: threat=5", () => {
  it("returns yellow circle", () => {
    expect(alertThreatIcon(5)).toBe("🟡");
  });
});

// ── AL2: threat≤1 → 🔴 ──────────────────────────────────────────────────────

describe("alerts — AL2: threat≤1", () => {
  it("returns red for 0 and 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: -10, max: 1 }), (t) => {
        expect(alertThreatIcon(t)).toBe("🔴");
      }),
      { numRuns: 15 },
    );
  });
});

// ── AL3: threat 2–4 → 🟠 ────────────────────────────────────────────────────

describe("alerts — AL3: threat 2-4", () => {
  it("returns orange", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 4 }), (t) => {
        expect(alertThreatIcon(t)).toBe("🟠");
      }),
      { numRuns: 10 },
    );
  });
});

// ── AL4: ageMin < 1 → "עכשיו" ───────────────────────────────────────────────

describe("alerts — AL4: ageMin<1", () => {
  it("returns 'now' label", () => {
    fc.assert(
      fc.property(fc.double({ min: -60, max: 0.99, noNaN: true }), (age) => {
        expect(alertAgeLabel(age)).toBe("עכשיו");
      }),
      { numRuns: 15 },
    );
  });
});

// ── AL5: 1–59 → contains "ד׳" ───────────────────────────────────────────────

describe("alerts — AL5: 1-59 minutes", () => {
  it("contains minutes marker", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 59 }), (age) => {
        const label = alertAgeLabel(age);
        expect(label).toContain("ד׳");
        expect(label).toContain(String(age));
      }),
      { numRuns: 20 },
    );
  });
});

// ── AL6: ≥60 → contains "ש׳" ────────────────────────────────────────────────

describe("alerts — AL6: ≥60 minutes", () => {
  it("contains hours marker", () => {
    fc.assert(
      fc.property(fc.integer({ min: 60, max: 1440 }), (age) => {
        const label = alertAgeLabel(age);
        expect(label).toContain("ש׳");
      }),
      { numRuns: 20 },
    );
  });
});

// ── AL7: hours = floor(ageMin/60) ────────────────────────────────────────────

describe("alerts — AL7: hours computation", () => {
  it("label contains floor(age/60)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 60, max: 1440 }), (age) => {
        const h = Math.floor(age / 60);
        expect(alertAgeLabel(age)).toContain(String(h));
      }),
      { numRuns: 20 },
    );
  });
});

// ── AL8: isAlertEvent valid shape → true ─────────────────────────────────────

describe("alerts — AL8: isAlertEvent valid", () => {
  it("returns true for valid shape", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.nat(),
          alerts: fc.array(
            fc.record({
              cities: fc.array(fc.string({ minLength: 1, maxLength: 10 })),
              time: fc.nat(),
              threat: fc.nat({ max: 10 }),
            }),
            { minLength: 1, maxLength: 3 },
          ),
        }),
        (ev) => {
          expect(isAlertEvent(ev)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── AL9: isAlertEvent non-object → false ─────────────────────────────────────

describe("alerts — AL9: isAlertEvent rejects", () => {
  it("rejects primitives", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), (v) => {
        expect(isAlertEvent(v)).toBe(false);
      }),
      { numRuns: 15 },
    );
  });

  it("rejects object without alerts array", () => {
    expect(isAlertEvent({ id: 1 })).toBe(false);
    expect(isAlertEvent({ alerts: "not-array" })).toBe(false);
  });
});
