/**
 * fast-check property tests — src/core/sw-constants.ts
 *
 * Properties under test:
 *  SW1. isVersionActivatedMsg returns true only for objects with type === "VERSION_ACTIVATED".
 *  SW2. isVersionActivatedMsg returns false for any non-matching input.
 *  SW3. isSkipWaitingMsg returns true only for objects with type === "SKIP_WAITING".
 *  SW4. isSkipWaitingMsg returns false for any non-matching input.
 *  SW5. Type guards never throw regardless of input shape.
 *  SW6. CACHE_NAME constant starts with "familydashboard-v".
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  isVersionActivatedMsg,
  isSkipWaitingMsg,
  CACHE_NAME,
  SW_MSG_SKIP_WAITING,
  SW_MSG_VERSION_ACTIVATED,
} from "@/core/sw-constants";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const validVersionActivatedArb = fc.record({
  type: fc.constant(SW_MSG_VERSION_ACTIVATED),
  version: fc.string({ minLength: 1, maxLength: 20 }),
});

const validSkipWaitingArb = fc.constant({ type: SW_MSG_SKIP_WAITING });

const nonObjectArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant([]),
  fc.constant(NaN),
);

const wrongTypeObjectArb = fc.record({
  type: fc
    .string({ minLength: 1, maxLength: 30 })
    .filter((s) => s !== SW_MSG_VERSION_ACTIVATED && s !== SW_MSG_SKIP_WAITING),
});

// ── SW1: isVersionActivatedMsg positive ──────────────────────────────────────

describe("sw-constants — SW1: isVersionActivatedMsg returns true for valid msgs", () => {
  it("any object with type=VERSION_ACTIVATED returns true", () => {
    fc.assert(
      fc.property(validVersionActivatedArb, (msg) => {
        expect(isVersionActivatedMsg(msg)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});

// ── SW2: isVersionActivatedMsg negative ──────────────────────────────────────

describe("sw-constants — SW2: isVersionActivatedMsg rejects non-matching", () => {
  it("non-objects always return false", () => {
    fc.assert(
      fc.property(nonObjectArb, (input) => {
        expect(isVersionActivatedMsg(input)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });

  it("objects with wrong type return false", () => {
    fc.assert(
      fc.property(wrongTypeObjectArb, (input) => {
        expect(isVersionActivatedMsg(input)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});

// ── SW3: isSkipWaitingMsg positive ───────────────────────────────────────────

describe("sw-constants — SW3: isSkipWaitingMsg returns true for valid msgs", () => {
  it("object with type=SKIP_WAITING returns true", () => {
    fc.assert(
      fc.property(validSkipWaitingArb, (msg) => {
        expect(isSkipWaitingMsg(msg)).toBe(true);
      }),
      { numRuns: 10 },
    );
  });
});

// ── SW4: isSkipWaitingMsg negative ───────────────────────────────────────────

describe("sw-constants — SW4: isSkipWaitingMsg rejects non-matching", () => {
  it("non-objects always return false", () => {
    fc.assert(
      fc.property(nonObjectArb, (input) => {
        expect(isSkipWaitingMsg(input)).toBe(false);
      }),
      { numRuns: 30 },
    );
  });

  it("objects with wrong type return false", () => {
    fc.assert(
      fc.property(wrongTypeObjectArb, (input) => {
        expect(isSkipWaitingMsg(input)).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});

// ── SW5: type guards never throw ─────────────────────────────────────────────

describe("sw-constants — SW5: type guards never throw", () => {
  it("isVersionActivatedMsg never throws for any input", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => isVersionActivatedMsg(input)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("isSkipWaitingMsg never throws for any input", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => isSkipWaitingMsg(input)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

// ── SW6: CACHE_NAME constant ─────────────────────────────────────────────────

describe("sw-constants — SW6: CACHE_NAME starts with expected prefix", () => {
  it("starts with familydashboard-v", () => {
    expect(CACHE_NAME).toBe("familydashboard-v");
  });
});
