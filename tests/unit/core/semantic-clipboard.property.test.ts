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
 *  SC7. findFocusedCardId finds deepest ancestor across arbitrary nesting (Sprint 596)
 *  SC8. getSemanticPayload returns null when producer returns null (Sprint 596)
 *  SC9. Multiple cards registered — each returns its own payload (Sprint 596)
 *  SC10. getSemanticPayload timestamp matches producer's ts (Sprint 596)
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

// ── SC7: findFocusedCardId with deep nesting ─────────────────────────────────

describe("semantic-clipboard — SC7: findFocusedCardId nested depth", () => {
  it("finds data-card-id regardless of nesting level", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), cardIdArb, (depth, id) => {
        const root = document.createElement("div");
        root.setAttribute("data-card-id", id);
        let current: HTMLElement = root;
        for (let i = 0; i < depth; i++) {
          const child = document.createElement("div");
          current.appendChild(child);
          current = child;
        }
        document.body.appendChild(root);
        expect(findFocusedCardId(current)).toBe(id);
        document.body.removeChild(root);
      }),
      { numRuns: 20 },
    );
  });
});

// ── SC8: producer returning null → getSemanticPayload null ────────────────────

describe("semantic-clipboard — SC8: null-returning producer", () => {
  it("returns null when producer explicitly returns null", () => {
    fc.assert(
      fc.property(cardIdArb, (cardId) => {
        _resetSemanticProducers();
        registerSemanticProducer(cardId, () => null);
        expect(getSemanticPayload(cardId)).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});

// ── SC9: multiple cards isolated ─────────────────────────────────────────────

describe("semantic-clipboard — SC9: multiple cards return own payloads", () => {
  it("each card returns its own distinct payload", () => {
    _resetSemanticProducers();
    const cards = ["weather", "news", "stocks", "calendar"];
    for (const id of cards) {
      const payload: SemanticPayload = { text: `data-${id}`, jsonLd: {}, cardId: id, ts: Date.now() };
      registerSemanticProducer(id, () => payload);
    }
    for (const id of cards) {
      const result = getSemanticPayload(id);
      expect(result).not.toBeNull();
      expect(result!.cardId).toBe(id);
      expect(result!.text).toBe(`data-${id}`);
    }
  });
});

// ── SC10: payload timestamp preserved ────────────────────────────────────────

describe("semantic-clipboard — SC10: payload ts matches producer", () => {
  it("timestamp from producer is preserved in result", () => {
    fc.assert(
      fc.property(cardIdArb, fc.integer({ min: 0, max: 2_000_000_000_000 }), (cardId, ts) => {
        _resetSemanticProducers();
        const payload: SemanticPayload = { text: "t", jsonLd: {}, cardId, ts };
        registerSemanticProducer(cardId, () => payload);
        expect(getSemanticPayload(cardId)!.ts).toBe(ts);
      }),
      { numRuns: 30 },
    );
  });
});
