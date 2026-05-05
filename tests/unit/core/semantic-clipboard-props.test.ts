/**
 * tests/unit/core/semantic-clipboard-props.test.ts — Sprint 430 (v14.1.0)
 *
 * fast-check property tests for src/core/semantic-clipboard.ts (SCP1-SCP5).
 * Probes algebraic invariants that unit tests cannot exhaustively cover.
 *
 *  SCP1 — producer round-trip: `text` field is always preserved exactly.
 *  SCP2 — `cardId` in payload always equals the registered key.
 *  SCP3 — `ts` in payload is always a positive integer.
 *  SCP4 — unregistered cardId always returns null.
 *  SCP5 — producer that throws always returns null (error swallowing).
 */

import { describe, it, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  registerSemanticProducer,
  getSemanticPayload,
  _resetSemanticProducers,
} from "../../../src/core/semantic-clipboard";
import type { SemanticPayload } from "../../../src/core/semantic-clipboard";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Valid card registry IDs: non-empty, printable, no leading/trailing spaces */
const cardIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim() === s && s.length > 0);

/** Arbitrary plain-text payload text */
const textArb = fc.string({ minLength: 0, maxLength: 200 });

/** Arbitrary JSON-LD block (shallow JSON-safe object) */
const jsonLdArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  { minKeys: 0, maxKeys: 5 },
) as fc.Arbitrary<Record<string, unknown>>;

/** Build a SemanticPayload with arbitrary text/jsonLd */
function makePayload(
  cardId: string,
  text: string,
  jsonLd: Record<string, unknown>,
): SemanticPayload {
  return { cardId, text, jsonLd, ts: Date.now() };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetSemanticProducers();
});

// ── SCP1: text field round-trip ───────────────────────────────────────────────

describe("semantic-clipboard — SCP1: text field round-trip identity", () => {
  it("getSemanticPayload always returns the exact text the producer supplied", () => {
    fc.assert(
      fc.property(cardIdArb, textArb, jsonLdArb, (cardId, text, jsonLd) => {
        _resetSemanticProducers();
        const payload = makePayload(cardId, text, jsonLd);
        registerSemanticProducer(cardId, () => payload);
        const result = getSemanticPayload(cardId);
        return result !== null && result.text === text;
      }),
      { numRuns: 200 },
    );
  });
});

// ── SCP2: cardId field identity ───────────────────────────────────────────────

describe("semantic-clipboard — SCP2: cardId in payload equals registration key", () => {
  it("getSemanticPayload returns a payload whose cardId equals the registered key", () => {
    fc.assert(
      fc.property(cardIdArb, textArb, (cardId, text) => {
        _resetSemanticProducers();
        const payload = makePayload(cardId, text, {});
        registerSemanticProducer(cardId, () => payload);
        const result = getSemanticPayload(cardId);
        return result !== null && result.cardId === cardId;
      }),
      { numRuns: 200 },
    );
  });
});

// ── SCP3: ts is a positive integer ───────────────────────────────────────────

describe("semantic-clipboard — SCP3: ts is a positive finite integer", () => {
  it("payload.ts is always a positive finite number", () => {
    fc.assert(
      fc.property(cardIdArb, fc.integer({ min: 1, max: 2 ** 53 }), (cardId, ts) => {
        _resetSemanticProducers();
        const payload: SemanticPayload = { cardId, text: "x", jsonLd: {}, ts };
        registerSemanticProducer(cardId, () => payload);
        const result = getSemanticPayload(cardId);
        return (
          result !== null &&
          Number.isFinite(result.ts) &&
          result.ts > 0 &&
          Number.isInteger(result.ts)
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ── SCP4: unregistered cardId always null ─────────────────────────────────────

describe("semantic-clipboard — SCP4: unregistered cardId always returns null", () => {
  it("getSemanticPayload(id) is null when no producer has been registered for id", () => {
    fc.assert(
      fc.property(cardIdArb, (cardId) => {
        _resetSemanticProducers();
        return getSemanticPayload(cardId) === null;
      }),
      { numRuns: 300 },
    );
  });
});

// ── SCP5: throwing producer → null (error swallowing) ────────────────────────

describe("semantic-clipboard — SCP5: throwing producer always returns null", () => {
  it("getSemanticPayload returns null when the registered producer throws", () => {
    fc.assert(
      fc.property(cardIdArb, fc.string(), (cardId, msg) => {
        _resetSemanticProducers();
        registerSemanticProducer(cardId, () => {
          throw new Error(msg);
        });
        return getSemanticPayload(cardId) === null;
      }),
      { numRuns: 200 },
    );
  });
});
