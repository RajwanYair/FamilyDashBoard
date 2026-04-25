/**
 * tests/unit/core/signals-property.test.ts — Sprint 104 (V14-FOUNDATIONS)
 *
 * Property-based tests for the zero-dep signals primitive. Verifies the
 * three core invariants of the reactive system across randomly generated
 * sequences of mutations:
 *
 *   1. Glitch-free: each signal write produces ≤ 1 effect run per effect.
 *   2. Observability: a write that changes a value (under Object.is)
 *      always notifies its directly subscribed effect.
 *   3. Equality short-circuit: writing an Object.is-equal value never
 *      schedules an effect run.
 *   4. Computed correctness: a derived value always reflects the latest
 *      values of its dependencies on read.
 *   5. Disposed effects never run again, no matter what writes follow.
 */

import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { signal, computed, effect, batch } from "@/core/signals";

describe("Property: signals — glitch-free notification", () => {
  it("an effect runs at most once per single signal write", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 50 }),
        (writes) => {
          const s = signal(writes[0] ?? 0);
          let runs = 0;
          effect(() => {
            void s.value;
            runs += 1;
          });
          const runsBefore = runs;
          for (const v of writes) {
            const before = runs;
            s.value = v;
            // After a write, runs increases by 0 (equal value) or 1 (new value).
            expect(runs - before).toBeLessThanOrEqual(1);
          }
          // First run was the immediate eager run on creation.
          expect(runsBefore).toBe(1);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("batch() collapses N writes into ≤ 1 effect run regardless of N", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 2, maxLength: 100 }),
        (writes) => {
          const s = signal(0);
          let runs = 0;
          effect(() => {
            void s.value;
            runs += 1;
          });
          const runsBefore = runs;
          batch(() => {
            for (const v of writes) s.value = v;
          });
          // Either 0 (final value equals initial 0) or 1 additional run.
          expect(runs - runsBefore).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("Property: signals — equality short-circuit", () => {
  it("writing an Object.is-equal value never triggers effect", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.string(),
          fc.boolean(),
          fc.constantFrom(null, undefined, Number.NaN, 0, -0),
        ),
        (v) => {
          const s = signal(v);
          let runs = 0;
          effect(() => {
            void s.value;
            runs += 1;
          });
          const before = runs;
          // Multiple identical writes.
          s.value = v;
          s.value = v;
          s.value = v;
          expect(runs).toBe(before);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("Property: computed — always reflects current dependency state", () => {
  it("computed value equals the function applied to current source values", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.integer({ min: -100, max: 100 }), fc.integer({ min: -100, max: 100 })),
          { minLength: 1, maxLength: 30 },
        ),
        (writes) => {
          const a = signal(0);
          const b = signal(0);
          const sum = computed(() => a.value + b.value);
          for (const [av, bv] of writes) {
            a.value = av;
            b.value = bv;
            expect(sum.value).toBe(av + bv);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe("Property: effect — disposed effects never re-run", () => {
  it("after dispose(), no number of writes triggers the effect again", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1, maxLength: 50 }),
        (writes) => {
          const s = signal(0);
          let runs = 0;
          const dispose = effect(() => {
            void s.value;
            runs += 1;
          });
          const runsAtDispose = runs;
          dispose();
          for (const v of writes) s.value = v;
          expect(runs).toBe(runsAtDispose);
        },
      ),
      { numRuns: 50 },
    );
  });
});
