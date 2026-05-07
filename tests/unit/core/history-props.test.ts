/**
 * Property-based tests for sparklineSvg() in src/core/history.ts (HP1–HP6)
 *
 * Uses fast-check to verify structural invariants across all possible value arrays.
 * Complements the concrete unit tests in history.test.ts.
 */

import fc from "fast-check";
import { describe, it } from "vitest";
import { sparklineSvg } from "../../../src/core/history";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Finite non-NaN float safe for SVG coordinate math. */
const finiteNum = fc.float({ noNaN: true, noDefaultInfinity: true });

/** Arrays with ≥2 elements — sparklineSvg should render SVG. */
const valuesAtLeast2 = fc.array(finiteNum, { minLength: 2, maxLength: 50 });

/** Arrays with 0 or 1 element — sparklineSvg must return "". */
const valuesFewerThan2 = fc.oneof(
  fc.constant([] as number[]),
  fc.array(finiteNum, { minLength: 1, maxLength: 1 }),
);

/** Positive integer dimensions for w/h parameters. */
const posDim = fc.integer({ min: 10, max: 300 });

/** CSS color strings (simple non-injectable literals). */
const colorArb = fc.constantFrom(
  "red",
  "#ff0000",
  "var(--positive)",
  "var(--negative)",
  "currentColor",
  "rgba(0,128,0,0.8)",
);

// ── HP1: returns empty string for arrays shorter than 2 ──────────────────────

describe("HP1: sparklineSvg returns '' for length < 2", () => {
  it("returns empty string for any array with fewer than 2 elements", () => {
    fc.assert(
      fc.property(valuesFewerThan2, colorArb, (values, color) => {
        return sparklineSvg(values, color) === "";
      }),
      { numRuns: 100 },
    );
  });
});

// ── HP2: returns non-empty string for ≥2 values ──────────────────────────────

describe("HP2: sparklineSvg returns non-empty string for ≥2 values", () => {
  it("returns a non-empty string for any array with at least 2 elements", () => {
    fc.assert(
      fc.property(valuesAtLeast2, colorArb, (values, color) => {
        return sparklineSvg(values, color).length > 0;
      }),
      { numRuns: 200 },
    );
  });
});

// ── HP3: output always contains <polyline for ≥2 values ──────────────────────

describe("HP3: sparklineSvg output contains <polyline for ≥2 values", () => {
  it("always contains a <polyline element in SVG output", () => {
    fc.assert(
      fc.property(valuesAtLeast2, colorArb, (values, color) => {
        return sparklineSvg(values, color).includes("<polyline");
      }),
      { numRuns: 200 },
    );
  });
});

// ── HP4: SVG viewBox matches passed w and h ───────────────────────────────────

describe("HP4: SVG viewBox dimensions match passed w and h", () => {
  it("viewBox='0 0 w h' reflects the w/h parameters exactly", () => {
    fc.assert(
      fc.property(valuesAtLeast2, colorArb, posDim, posDim, (values, color, w, h) => {
        const svg = sparklineSvg(values, color, w, h);
        return svg.includes(`viewBox="0 0 ${w} ${h}"`);
      }),
      { numRuns: 100 },
    );
  });
});

// ── HP5: x-coordinates in polyline points are monotonically non-decreasing ───

describe("HP5: polyline x-coordinates are monotonically non-decreasing", () => {
  it("each successive x in the points string is ≥ the previous x", () => {
    fc.assert(
      fc.property(valuesAtLeast2, colorArb, (values, color) => {
        const svg = sparklineSvg(values, color);
        const match = svg.match(/points="([^"]+)"/);
        if (!match || !match[1]) return false;
        const xs = match[1]
          .trim()
          .split(/\s+/)
          .map((pt) => parseFloat(pt.split(",")[0] ?? "0"));
        return xs.every((x, i) => i === 0 || x >= xs[i - 1]!);
      }),
      { numRuns: 200 },
    );
  });
});

// ── HP6: color string is embedded verbatim in the stroke attribute ────────────

describe("HP6: color parameter appears verbatim in stroke attribute", () => {
  it("stroke value in the output matches the passed color string", () => {
    fc.assert(
      fc.property(valuesAtLeast2, colorArb, (values, color) => {
        return sparklineSvg(values, color).includes(`stroke="${color}"`);
      }),
      { numRuns: 200 },
    );
  });
});
