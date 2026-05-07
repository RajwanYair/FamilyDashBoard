/**
 * tests/unit/core/card-signal-protocol-props.test.ts — (v14.1.0)
 *
 * fast-check property tests for src/core/card-signal-protocol.ts (CSP1-CSP5).
 *
 *  CSP1 — setCardSignal + getCardSignal round-trip: value is preserved verbatim.
 *  CSP2 — signal always carries v:1 (schema version invariant).
 *  CSP3 — cardId and key are always stored as passed (identity round-trip).
 *  CSP4 — unset (cardId, key) pair always returns null.
 *  CSP5 — published value is deeply frozen (mutation attempt has no effect).
 */

import { describe, it, beforeEach, expect } from "vitest";
import * as fc from "fast-check";
import {
  setCardSignal,
  getCardSignal,
  _resetCardSignals,
} from "../../../src/core/card-signal-protocol";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Card registry IDs: non-empty, trimmed, up to 30 chars */
const cardIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim() === s && s.length > 0);

/** Signal keys: short, kebab-style strings */
const keyArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim() === s && s.length > 0);

/** JSON-safe scalar values */
const scalarArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 50 }),
  fc.integer({ min: -1e9, max: 1e9 }),
  fc.boolean(),
  fc.constant(null),
);

/** Shallow JSON-safe object */
const objectArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 10 }),
  scalarArb,
  { minKeys: 1, maxKeys: 5 },
) as fc.Arbitrary<Record<string, unknown>>;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetCardSignals();
});

// ── CSP1: value round-trip ────────────────────────────────────────────────────

describe("card-signal-protocol — CSP1: value round-trip identity", () => {
  it("getCardSignal returns exactly the value passed to setCardSignal (scalars)", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, scalarArb, (cardId, key, value) => {
        _resetCardSignals();
        setCardSignal(cardId, key, value);
        const sig = getCardSignal<typeof value>(cardId, key);
        return sig !== null && sig.value === value;
      }),
      { numRuns: 300 },
    );
  });

  it("getCardSignal returns deeply equal object value passed to setCardSignal", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, objectArb, (cardId, key, value) => {
        _resetCardSignals();
        setCardSignal(cardId, key, value);
        const sig = getCardSignal<Record<string, unknown>>(cardId, key);
        if (sig === null) return false;
        for (const k of Object.keys(value)) {
          if (sig.value[k] !== value[k]) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ── CSP2: schema version always v:1 ──────────────────────────────────────────

describe("card-signal-protocol — CSP2: signal.v is always 1", () => {
  it("every published signal carries v === 1", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, scalarArb, (cardId, key, value) => {
        _resetCardSignals();
        setCardSignal(cardId, key, value);
        const sig = getCardSignal(cardId, key);
        return sig !== null && sig.v === 1;
      }),
      { numRuns: 300 },
    );
  });
});

// ── CSP3: cardId + key identity ───────────────────────────────────────────────

describe("card-signal-protocol — CSP3: cardId and key stored verbatim", () => {
  it("signal.cardId equals the cardId passed to setCardSignal", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, scalarArb, (cardId, key, value) => {
        _resetCardSignals();
        setCardSignal(cardId, key, value);
        const sig = getCardSignal(cardId, key);
        return sig !== null && sig.cardId === cardId && sig.key === key;
      }),
      { numRuns: 300 },
    );
  });
});

// ── CSP4: unset pair always null ──────────────────────────────────────────────

describe("card-signal-protocol — CSP4: unset (cardId, key) always returns null", () => {
  it("getCardSignal returns null for any (cardId, key) that has never been set", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, (cardId, key) => {
        _resetCardSignals();
        return getCardSignal(cardId, key) === null;
      }),
      { numRuns: 300 },
    );
  });
});

// ── CSP5: published value is deeply frozen ────────────────────────────────────

describe("card-signal-protocol — CSP5: published value is deeply frozen", () => {
  it("mutating the retrieved signal value has no effect (deep freeze)", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, objectArb, (cardId, key, value) => {
        _resetCardSignals();
        setCardSignal(cardId, key, value);
        const sig = getCardSignal<Record<string, unknown>>(cardId, key);
        if (sig === null) return false;

        const firstKey = Object.keys(sig.value)[0];
        if (firstKey === undefined) return true; // empty object — skip mutation attempt

        const original = sig.value[firstKey];
        // Attempt to mutate — must be silently ignored in strict mode (frozen)
        try {
          (sig.value as Record<string, unknown>)[firstKey] = "MUTATED";
        } catch {
          // TypeError expected in strict mode — that's the correct behavior
        }
        // The value must still equal the original (not "MUTATED")
        const sigAfter = getCardSignal<Record<string, unknown>>(cardId, key);
        expect(sigAfter?.value[firstKey]).toBe(original);
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
