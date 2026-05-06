/**
 * fast-check property tests — src/core/card-signal-protocol.ts (Sprint 493)
 *
 * Properties under test:
 *  CSP1. setCardSignal → getCardSignal round-trip: value is preserved.
 *  CSP2. getCardSignal returns null when no signal has been set.
 *  CSP3. setCardSignal deep-freezes the value — mutation throws in strict mode.
 *  CSP4. onCardSignal subscriber receives the published signal.
 *  CSP5. onCardSignal unsubscribe prevents future callbacks.
 *  CSP6. setCardSignal last-write-wins for same (cardId, key).
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  setCardSignal,
  getCardSignal,
  onCardSignal,
  _resetCardSignals,
} from "@/core/card-signal-protocol";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetCardSignals();
});

// ── Arbitraries ───────────────────────────────────────────────────────────────

const cardIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/);
const keyArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
const valueArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 30 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
);

// ── CSP1: set → get round-trip ───────────────────────────────────────────────

describe("card-signal-protocol — CSP1: set → get round-trip", () => {
  it("getCardSignal returns what was set", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, valueArb, (cardId, key, value) => {
        _resetCardSignals();
        setCardSignal(cardId, key, value);
        const result = getCardSignal(cardId, key);
        expect(result).not.toBeNull();
        expect(result!.value).toEqual(value);
        expect(result!.cardId).toBe(cardId);
        expect(result!.key).toBe(key);
        expect(result!.v).toBe(1);
      }),
      { numRuns: 50 },
    );
  });
});

// ── CSP2: get returns null when nothing set ──────────────────────────────────

describe("card-signal-protocol — CSP2: get returns null when not set", () => {
  it("returns null for unknown cardId/key combo", () => {
    fc.assert(
      fc.property(cardIdArb, keyArb, (cardId, key) => {
        _resetCardSignals();
        expect(getCardSignal(cardId, key)).toBeNull();
      }),
      { numRuns: 20 },
    );
  });
});

// ── CSP3: deep-freeze — value is immutable ───────────────────────────────────

describe("card-signal-protocol — CSP3: value is deep-frozen", () => {
  it("modifying the signal value throws", () => {
    _resetCardSignals();
    setCardSignal("test-card", "data", { count: 42 });
    const sig = getCardSignal<{ count: number }>("test-card", "data");
    expect(sig).not.toBeNull();
    expect(() => {
      (sig!.value as { count: number }).count = 99;
    }).toThrow();
  });
});

// ── CSP4: subscriber receives signal ─────────────────────────────────────────

describe("card-signal-protocol — CSP4: subscriber receives published signal", () => {
  it("callback fires with correct value", async () => {
    _resetCardSignals();
    const received: unknown[] = [];
    onCardSignal("test-card", "event", (sig) => {
      received.push(sig.value);
    });
    setCardSignal("test-card", "event", "hello");
    // Wait for microtask delivery
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
    expect(received).toEqual(["hello"]);
  });
});

// ── CSP5: unsubscribe prevents callback ──────────────────────────────────────

describe("card-signal-protocol — CSP5: unsubscribe stops callbacks", () => {
  it("no callback after unsubscribe", async () => {
    _resetCardSignals();
    const received: unknown[] = [];
    const unsub = onCardSignal("test-card", "ev", (sig) => {
      received.push(sig.value);
    });
    unsub();
    setCardSignal("test-card", "ev", "after-unsub");
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
    expect(received).toHaveLength(0);
  });
});

// ── CSP6: last write wins ────────────────────────────────────────────────────

describe("card-signal-protocol — CSP6: last write wins", () => {
  it("get returns the latest value", () => {
    fc.assert(
      fc.property(
        cardIdArb,
        keyArb,
        valueArb,
        valueArb,
        (cardId, key, val1, val2) => {
          _resetCardSignals();
          setCardSignal(cardId, key, val1);
          setCardSignal(cardId, key, val2);
          const result = getCardSignal(cardId, key);
          expect(result!.value).toEqual(val2);
        },
      ),
      { numRuns: 30 },
    );
  });
});
