/**
 * fast-check property tests — src/core/trusted-types.ts 
 *
 * Properties under test:
 *  TT1. trustedHTML returns input unchanged when TrustedTypes API is absent.
 *  TT2. trustedHTML never throws for any string input.
 *  TT3. trustedHTML preserves string length (no truncation or mutation).
 *  TT4. trustedHTML is idempotent (applying twice yields same result).
 *  TT5. trustedHTML with empty string returns empty string.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { trustedHTML } from "@/core/trusted-types";

// ── TT1: identity in environments without TrustedTypes ───────────────────────

describe("trusted-types — TT1: trustedHTML is identity without TT API", () => {
  it("returns input unchanged for any string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (s) => {
        expect(trustedHTML(s)).toBe(s);
      }),
      { numRuns: 100 },
    );
  });
});

// ── TT2: never throws ───────────────────────────────────────────────────────

describe("trusted-types — TT2: trustedHTML never throws", () => {
  it("does not throw for any string", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 2000 }), (s) => {
        expect(() => trustedHTML(s)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

// ── TT3: preserves string length ────────────────────────────────────────────

describe("trusted-types — TT3: trustedHTML preserves length", () => {
  it("output length === input length", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 500 }), (s) => {
        expect(trustedHTML(s).length).toBe(s.length);
      }),
      { numRuns: 50 },
    );
  });
});

// ── TT4: idempotent ─────────────────────────────────────────────────────────

describe("trusted-types — TT4: trustedHTML is idempotent", () => {
  it("trustedHTML(trustedHTML(s)) === trustedHTML(s)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 500 }), (s) => {
        expect(trustedHTML(trustedHTML(s))).toBe(trustedHTML(s));
      }),
      { numRuns: 50 },
    );
  });
});

// ── TT5: empty string ───────────────────────────────────────────────────────

describe("trusted-types — TT5: trustedHTML handles empty string", () => {
  it("returns empty string for empty input", () => {
    expect(trustedHTML("")).toBe("");
  });
});
