/**
 * fast-check property tests — worker/src/middleware/canary.ts (Sprint 550)
 *
 * Properties under test:
 *  CY1. shouldTagCanary: undefined/empty/null → false
 *  CY2. shouldTagCanary: non-numeric strings → false
 *  CY3. shouldTagCanary: pct ≥ 100 → always true
 *  CY4. shouldTagCanary: pct ≤ 0 → always false
 *  CY5. shouldTagCanary: result is always boolean
 *  CY6. applyCanaryHeader: "100" always sets X-Canary header
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { shouldTagCanary, applyCanaryHeader } from "../../../worker/src/middleware/canary";

// ── CY1: falsy pct → false ──────────────────────────────────────────────────

describe("canary — CY1: falsy pct", () => {
  it("returns false for undefined/empty/0", () => {
    expect(shouldTagCanary(undefined)).toBe(false);
    expect(shouldTagCanary("")).toBe(false);
    expect(shouldTagCanary("0")).toBe(false);
  });
});

// ── CY2: non-numeric → false ────────────────────────────────────────────────

describe("canary — CY2: non-numeric", () => {
  it("returns false for non-numeric strings", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{1,10}$/),
        (s) => {
          expect(shouldTagCanary(s)).toBe(false);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── CY3: pct ≥ 100 → always true ────────────────────────────────────────────

describe("canary — CY3: pct ≥ 100", () => {
  it("always returns true", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 10000 }), (n) => {
        expect(shouldTagCanary(String(n))).toBe(true);
      }),
      { numRuns: 10 },
    );
  });
});

// ── CY4: pct ≤ 0 → always false ─────────────────────────────────────────────

describe("canary — CY4: pct ≤ 0", () => {
  it("always returns false", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), (n) => {
        expect(shouldTagCanary(String(n))).toBe(false);
      }),
      { numRuns: 10 },
    );
  });
});

// ── CY5: result is boolean ───────────────────────────────────────────────────

describe("canary — CY5: always boolean", () => {
  it("returns boolean for any string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 10 }), (s) => {
        const result = shouldTagCanary(s);
        expect(typeof result).toBe("boolean");
      }),
      { numRuns: 15 },
    );
  });
});

// ── CY6: applyCanaryHeader at 100% sets header ──────────────────────────────

describe("canary — CY6: applyCanaryHeader 100%", () => {
  it("sets X-Canary header when pct is 100", () => {
    const res = new Response("ok");
    applyCanaryHeader(res, "100");
    expect(res.headers.get("X-Canary")).toBe("true");
  });
});
