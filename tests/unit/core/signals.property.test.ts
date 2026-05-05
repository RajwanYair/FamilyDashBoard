/**
 * fast-check property tests — src/core/signals.ts (Sprint 460)
 *
 * Properties under test:
 *  SIG1. signal(v).value === v — initial value is always preserved exactly.
 *  SIG2. computed(fn).value equals fn() evaluated at read time for any signal source.
 *  SIG3. effect runs exactly once during construction (initial run for any value).
 *  SIG4. After signal.value update, effect count increments by exactly one.
 *  SIG5. batch() defers effects: multiple signal writes inside one batch produce
 *        exactly one combined effect notification (not N).
 *  SIG6. untrack() reads current value without registering a dependency — signal
 *        change after untrack does NOT trigger the enclosing effect.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { signal, computed, effect, batch, untrack, isSignal } from "@/core/signals";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const intArb = fc.integer({ min: -100_000, max: 100_000 });
const strArb = fc.string({ maxLength: 40 });
const boolArb = fc.boolean();

const scalarArb: fc.Arbitrary<string | number | boolean> = fc.oneof(strArb, intArb, boolArb);

// ── SIG1: initial value is preserved ─────────────────────────────────────────

describe("signals — SIG1: signal(v).value is v", () => {
  it("signal initial value equals the constructor argument for any scalar", () => {
    fc.assert(
      fc.property(scalarArb, (v) => {
        const s = signal(v);
        expect(s.value).toStrictEqual(v);
      }),
      { numRuns: 100 },
    );
  });

  it("signal initial value equals the constructor argument for any object", () => {
    fc.assert(
      fc.property(fc.record({ x: intArb, y: intArb }), (obj) => {
        const s = signal(obj);
        expect(s.value).toStrictEqual(obj);
      }),
      { numRuns: 60 },
    );
  });
});

// ── SIG2: computed derivation is always consistent ───────────────────────────

describe("signals — SIG2: computed(fn).value equals fn() for any signal state", () => {
  it("computed value tracks the underlying signal through arbitrary writes", () => {
    fc.assert(
      fc.property(intArb, intArb, (a, b) => {
        const src = signal(a);
        const doubled = computed(() => src.value * 2);
        expect(doubled.value).toBe(a * 2);

        src.value = b;
        expect(doubled.value).toBe(b * 2);
      }),
      { numRuns: 80 },
    );
  });

  it("computed chaining: computed of computed is always consistent", () => {
    fc.assert(
      fc.property(intArb, intArb, (a, b) => {
        const src = signal(a);
        const plus1 = computed(() => src.value + 1);
        const doubled = computed(() => plus1.value * 2);
        expect(doubled.value).toBe((a + 1) * 2);

        src.value = b;
        expect(doubled.value).toBe((b + 1) * 2);
      }),
      { numRuns: 60 },
    );
  });
});

// ── SIG3: effect runs exactly once initially ──────────────────────────────────

describe("signals — SIG3: effect runs exactly once on construction", () => {
  it("initial effect callback is called exactly once for any signal value", () => {
    fc.assert(
      fc.property(scalarArb, (v) => {
        const src = signal(v);
        let count = 0;
        const dispose = effect(() => {
          void src.value; // register dep
          count++;
        });
        expect(count).toBe(1);
        dispose();
      }),
      { numRuns: 80 },
    );
  });
});

// ── SIG4: effect re-runs on signal change ─────────────────────────────────────

describe("signals — SIG4: effect re-runs exactly once per signal.value change", () => {
  it("setting signal to a new value causes effect to re-run exactly once", () => {
    fc.assert(
      fc.property(intArb, intArb.filter((n) => n !== 0).map((n) => n + 1), (a, delta) => {
        const b = a + delta; // guaranteed a !== b
        const src = signal(a);
        let count = 0;
        const dispose = effect(() => {
          void src.value;
          count++;
        });
        // count is 1 after construction
        src.value = b;
        // count should now be exactly 2
        expect(count).toBe(2);
        dispose();
      }),
      { numRuns: 80 },
    );
  });

  it("setting signal to the same value does NOT re-run effect (Object.is identity)", () => {
    fc.assert(
      fc.property(intArb, (v) => {
        const src = signal(v);
        let count = 0;
        const dispose = effect(() => {
          void src.value;
          count++;
        });
        src.value = v; // same value — no notification
        expect(count).toBe(1);
        dispose();
      }),
      { numRuns: 80 },
    );
  });
});

// ── SIG5: batch() defers and coalesces effect runs ───────────────────────────

describe("signals — SIG5: batch() coalesces multiple writes into one effect run", () => {
  it("N writes inside one batch produce exactly one extra effect run", () => {
    fc.assert(
      fc.property(
        fc.array(intArb, { minLength: 2, maxLength: 8 }),
        (values) => {
          const src = signal(values[0]!);
          let count = 0;
          const dispose = effect(() => {
            void src.value;
            count++;
          });
          // count == 1 after construction
          batch(() => {
            for (const v of values) {
              src.value = v;
            }
          });
          // exactly one extra run after the batch drains
          expect(count).toBe(2);
          dispose();
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── SIG6: untrack() does not register dependencies ───────────────────────────

describe("signals — SIG6: untrack() reads value without registering a dependency", () => {
  it("signal change after untrack read does NOT trigger the enclosing effect", () => {
    fc.assert(
      fc.property(intArb, intArb.filter((n) => n !== 0).map((n) => n + 1), (a, delta) => {
        const b = a + delta;
        const watched = signal(0);   // the dep the effect actually registers
        const untracked = signal(a); // read via untrack — should not be a dep

        let count = 0;
        const dispose = effect(() => {
          void watched.value;          // register real dep
          void untrack(() => untracked.value); // read without dep
          count++;
        });
        // count == 1 after construction

        // mutating the untracked signal must NOT fire the effect
        untracked.value = b;
        expect(count).toBe(1);

        // mutating the watched signal DOES fire it
        watched.value = 999;
        expect(count).toBe(2);
        dispose();
      }),
      { numRuns: 60 },
    );
  });
});

// ── isSignal type guard ───────────────────────────────────────────────────────

describe("signals — isSignal type guard", () => {
  it("isSignal returns true for any signal() or computed() output", () => {
    fc.assert(
      fc.property(scalarArb, (v) => {
        expect(isSignal(signal(v))).toBe(true);
        expect(isSignal(computed(() => v))).toBe(true);
      }),
      { numRuns: 40 },
    );
  });

  it("isSignal returns false for non-signal primitives and objects", () => {
    fc.assert(
      fc.property(scalarArb, (v) => {
        expect(isSignal(v)).toBe(false);
        expect(isSignal({})).toBe(false);
        expect(isSignal(null)).toBe(false);
      }),
      { numRuns: 40 },
    );
  });
});
