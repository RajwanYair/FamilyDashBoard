/**
 * fast-check property tests — src/core/semantic-clipboard.ts (Sprint 494)
 *
 * Properties under test:
 *  SC1. registerSemanticProducer → getSemanticPayload round-trip.
 *  SC2. getSemanticPayload returns null for unregistered cardId.
 *  SC3. registerSemanticProducer is idempotent (last registration wins).
 *  SC4. getSemanticPayload returns null when producer throws.
 *  SC5. findFocusedCardId walks up the DOM tree to find data-card-id.
 *  SC6. findFocusedCardId returns null when no ancestor has data-card-id.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  registerSemanticProducer,
  getSemanticPayload,
  findFocusedCardId,
  _resetSemanticProducers,
} from "@/core/semantic-clipboard";
import type { SemanticPayload } from "@/core/semantic-clipboard";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetSemanticProducers();
});

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cardIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/);

// ── SC1: register → get round-trip ───────────────────────────────────────────

describe("semantic-clipboard — SC1: register → get round-trip", () => {
  it("getSemanticPayload returns the producer's result", () => {
    fc.assert(
      fc.property(cardIdArb, fc.string({ minLength: 1, maxLength: 30 }), (cardId, text) => {
        _resetSemanticProducers();
        const payload: SemanticPayload = {
          text,
          jsonLd: { "@context": "https://schema.org" },
          cardId,
          ts: Date.now(),
        };
        registerSemanticProducer(cardId, () => payload);
        const result = getSemanticPayload(cardId);
        expect(result).not.toBeNull();
        expect(result!.text).toBe(text);
        expect(result!.cardId).toBe(cardId);
      }),
      { numRuns: 30 },
    );
  });
});

// ── SC2: get returns null for unregistered ───────────────────────────────────

describe("semantic-clipboard — SC2: get returns null for unregistered cardId", () => {
  it("returns null when no producer registered", () => {
    fc.assert(
      fc.property(cardIdArb, (cardId) => {
        _resetSemanticProducers();
        expect(getSemanticPayload(cardId)).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});

// ── SC3: last registration wins ──────────────────────────────────────────────

describe("semantic-clipboard — SC3: re-registration replaces previous", () => {
  it("latest producer's result is returned", () => {
    _resetSemanticProducers();
    const payload1: SemanticPayload = { text: "first", jsonLd: {}, cardId: "card-a", ts: 1 };
    const payload2: SemanticPayload = { text: "second", jsonLd: {}, cardId: "card-a", ts: 2 };
    registerSemanticProducer("card-a", () => payload1);
    registerSemanticProducer("card-a", () => payload2);
    expect(getSemanticPayload("card-a")!.text).toBe("second");
  });
});

// ── SC4: producer throws → null ──────────────────────────────────────────────

describe("semantic-clipboard — SC4: throwing producer returns null", () => {
  it("getSemanticPayload returns null when producer throws", () => {
    fc.assert(
      fc.property(cardIdArb, (cardId) => {
        _resetSemanticProducers();
        registerSemanticProducer(cardId, () => {
          throw new Error("boom");
        });
        expect(getSemanticPayload(cardId)).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});

// ── SC5: findFocusedCardId walks up DOM ──────────────────────────────────────

describe("semantic-clipboard — SC5: findFocusedCardId walks up DOM", () => {
  it("finds data-card-id on ancestor", () => {
    const parent = document.createElement("div");
    parent.setAttribute("data-card-id", "weather");
    const child = document.createElement("span");
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(findFocusedCardId(child)).toBe("weather");
    document.body.removeChild(parent);
  });
});

// ── SC6: findFocusedCardId returns null when none ────────────────────────────

describe("semantic-clipboard — SC6: findFocusedCardId returns null when no ancestor", () => {
  it("returns null for orphan element", () => {
    const orphan = document.createElement("div");
    expect(findFocusedCardId(orphan)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(findFocusedCardId(null)).toBeNull();
  });
});
