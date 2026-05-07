/**
 * fast-check property tests — src/core/history.ts 
 *
 * Properties under test:
 *  HIS1. sparklineSvg with < 2 values always returns empty string.
 *  HIS2. sparklineSvg with ≥ 2 values always returns a non-empty SVG string
 *        containing a <polyline> element.
 *  HIS3. sparklineSvg polyline points: x-coordinates are strictly increasing
 *        (oldest-first rendering).
 *  HIS4. sparklineSvg handles a flat (all-equal) values array without NaN
 *        or Infinity in the output.
 *  HIS5. sparklineSvg color parameter is emitted verbatim in the stroke attribute.
 *  HIS6. sparklineSvg viewBox reflects the w×h parameters passed in.
 *  HIS7. sparklineSvg with negative values still produces valid SVG (no NaN/Infinity).
 *  HIS8. sparklineSvg polyline has exactly values.length coordinate pairs.
 *  HIS9. sparklineSvg y-coordinates are always within [0, h].
 *  HIS10. sparklineSvg output never contains NaN or Infinity strings.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { sparklineSvg } from "@/core/history";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Finite, non-NaN float in a reasonable numeric range */
const finiteFloatArb = fc.double({
  noNaN: true,
  noDefaultInfinity: true,
  min: -1_000_000,
  max: 1_000_000,
});

/** Array with < 2 values */
const tooFewArb: fc.Arbitrary<number[]> = fc.oneof(
  fc.constant([]),
  fc.array(finiteFloatArb, { minLength: 1, maxLength: 1 }),
);

/** Array with ≥ 2 finite values */
const enoughArb = fc.array(finiteFloatArb, { minLength: 2, maxLength: 30 });

/** Flat (all-equal) array with ≥ 2 elements */
const flatArb = fc
  .tuple(finiteFloatArb, fc.integer({ min: 2, max: 20 }))
  .map(([v, n]) => Array<number>(n).fill(v));

/** Printable CSS color string (no injection risk; just needs to round-trip) */
const colorArb = fc.oneof(
  fc.constantFrom("#fff", "#000", "#ff5500", "red", "blue", "var(--accent)"),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !/[<>"&]/.test(s)),
);

/** Positive integer dimension for w/h */
const dimArb = fc.integer({ min: 10, max: 200 });

// ── HIS1: < 2 values → empty string ──────────────────────────────────────────

describe("sparklineSvg — HIS1: returns empty string for < 2 values", () => {
  it("always returns '' when values has 0 or 1 elements", () => {
    fc.assert(
      fc.property(tooFewArb, colorArb, (values, color) => {
        expect(sparklineSvg(values, color)).toBe("");
      }),
      { numRuns: 60 },
    );
  });
});

// ── HIS2: ≥ 2 values → non-empty SVG with polyline ───────────────────────────

describe("sparklineSvg — HIS2: returns non-empty SVG with <polyline> for ≥ 2 values", () => {
  it("output is a non-empty string containing <polyline", () => {
    fc.assert(
      fc.property(enoughArb, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        expect(svg.length).toBeGreaterThan(0);
        expect(svg).toContain("<polyline");
      }),
      { numRuns: 80 },
    );
  });

  it("output always starts with <svg", () => {
    fc.assert(
      fc.property(enoughArb, colorArb, (values, color) => {
        expect(sparklineSvg(values, color)).toMatch(/^<svg/);
      }),
      { numRuns: 60 },
    );
  });
});

// ── HIS3: x-coordinates are strictly increasing ───────────────────────────────

describe("sparklineSvg — HIS3: x-coordinates are strictly increasing", () => {
  it("each point's x is ≥ previous x (oldest-to-newest left-to-right)", () => {
    fc.assert(
      fc.property(enoughArb, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        // Extract the points="..." attribute
        const m = svg.match(/points="([^"]+)"/);
        if (!m) return; // guard — HIS2 covers the presence check
        const pts = m[1]!.trim().split(/\s+/);
        const xs = pts.map((p) => parseFloat(p.split(",")[0]!));
        for (let i = 1; i < xs.length; i++) {
          expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
        }
      }),
      { numRuns: 80 },
    );
  });
});

// ── HIS4: flat values → no NaN or Infinity in output ──────────────────────────

describe("sparklineSvg — HIS4: flat values do not produce NaN or Infinity", () => {
  it("sparklineSvg of a flat array never contains NaN or Infinity", () => {
    fc.assert(
      fc.property(flatArb, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        expect(svg).not.toContain("NaN");
        expect(svg).not.toContain("Infinity");
      }),
      { numRuns: 60 },
    );
  });
});

// ── HIS5: color is emitted verbatim in stroke attribute ───────────────────────

describe("sparklineSvg — HIS5: color appears verbatim in stroke attribute", () => {
  it('stroke="<color>" is present in the SVG output', () => {
    fc.assert(
      fc.property(enoughArb, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        expect(svg).toContain(`stroke="${color}"`);
      }),
      { numRuns: 80 },
    );
  });
});

// ── HIS6: viewBox reflects w×h parameters ────────────────────────────────────

describe("sparklineSvg — HIS6: viewBox reflects the w and h parameters", () => {
  it('viewBox="0 0 W H" matches the w/h arguments', () => {
    fc.assert(
      fc.property(enoughArb, colorArb, dimArb, dimArb, (values, color, w, h) => {
        const svg = sparklineSvg(values, color, w, h);
        expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
      }),
      { numRuns: 80 },
    );
  });
});

// ── HIS7: negative values → valid SVG ────────────────────────────────────────

describe("sparklineSvg — HIS7: negative values produce valid SVG", () => {
  const negativeArb = fc.array(
    fc.double({ noNaN: true, noDefaultInfinity: true, min: -1_000_000, max: -1 }),
    { minLength: 2, maxLength: 20 },
  );

  it("output contains <polyline> even with all-negative data", () => {
    fc.assert(
      fc.property(negativeArb, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        expect(svg).toContain("<polyline");
        expect(svg).not.toContain("NaN");
        expect(svg).not.toContain("Infinity");
      }),
      { numRuns: 60 },
    );
  });
});

// ── HIS8: polyline has exactly values.length coordinate pairs ────────────────

describe("sparklineSvg — HIS8: point count matches values.length", () => {
  it("polyline points has N x,y pairs for N values", () => {
    fc.assert(
      fc.property(enoughArb, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        const match = svg.match(/points="([^"]+)"/);
        expect(match).not.toBeNull();
        const pairs = match![1].trim().split(" ");
        expect(pairs.length).toBe(values.length);
      }),
      { numRuns: 80 },
    );
  });
});

// ── HIS9: y-coordinates within [0, h] ───────────────────────────────────────

describe("sparklineSvg — HIS9: all y-values within [0, h]", () => {
  it("every y-coordinate in polyline is between 0 and h", () => {
    fc.assert(
      fc.property(enoughArb, colorArb, dimArb, dimArb, (values, color, w, h) => {
        const svg = sparklineSvg(values, color, w, h);
        const match = svg.match(/points="([^"]+)"/);
        if (!match) return;
        const pairs = match[1].trim().split(" ");
        for (const pair of pairs) {
          const y = parseFloat(pair.split(",")[1]);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(h);
        }
      }),
      { numRuns: 60 },
    );
  });
});

// ── HIS10: output never contains NaN or Infinity ─────────────────────────────

describe("sparklineSvg — HIS10: output free of NaN/Infinity", () => {
  it("no NaN or Infinity in output for any finite input", () => {
    fc.assert(
      fc.property(enoughArb, colorArb, dimArb, dimArb, (values, color, w, h) => {
        const svg = sparklineSvg(values, color, w, h);
        expect(svg).not.toContain("NaN");
        expect(svg).not.toContain("Infinity");
      }),
      { numRuns: 80 },
    );
  });
});
