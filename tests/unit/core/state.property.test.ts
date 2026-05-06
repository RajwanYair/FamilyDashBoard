/**
 * fast-check property tests — src/core/state.ts (Sprint 479)
 *
 * Properties under test:
 *  ST1. get(key) after set(key, v) returns exactly v (round-trip identity).
 *  ST2. set() with the same value does NOT dispatch an event (no-op guard).
 *  ST3. Writes to config.* don't affect cache.* (slice isolation).
 *  ST4. Writes to cache.* don't affect ui.* (cross-slice isolation).
 *  ST5. on() callback receives the exact value passed to set().
 *  ST6. Setting different keys dispatches separate events (per-key isolation).
 *  ST7. Invalid slice key (not config/cache/ui) is silently ignored — get returns undefined.
 *  ST8. Repeated set() with different values always returns the latest (last-write-wins).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";

// Mock the app-signals lazy import so no circular-dep promise fires.
vi.mock("@/core/app-signals", () => ({
  syncAppSignal: vi.fn(),
}));

import { state, _resetForTest } from "@/core/state";

// ── Helpers ───────────────────────────────────────────────────────────────────

afterEach(_resetForTest);

// Arbitraries
const fieldArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes("."));
const scalarArb: fc.Arbitrary<string | number | boolean> = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.boolean(),
);
const sliceArb = fc.constantFrom("config" as const, "cache" as const, "ui" as const);

// ── ST1: round-trip identity ──────────────────────────────────────────────────

describe("state — ST1: get(key) after set(key, v) returns v", () => {
  it("string values round-trip correctly in config slice", () => {
    fc.assert(
      fc.property(fieldArb, fc.string({ maxLength: 40 }), (field, value) => {
        _resetForTest();
        const key = `config.${field}` as const;
        state.set(key, value);
        expect(state.get(key)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("numeric values round-trip correctly in cache slice", () => {
    fc.assert(
      fc.property(fieldArb, fc.integer({ min: -1_000_000, max: 1_000_000 }), (field, value) => {
        _resetForTest();
        const key = `cache.${field}` as const;
        state.set(key, value);
        expect(state.get(key)).toBe(value);
      }),
      { numRuns: 80 },
    );
  });

  it("boolean values round-trip correctly in ui slice", () => {
    fc.assert(
      fc.property(fieldArb, fc.boolean(), (field, value) => {
        _resetForTest();
        const key = `ui.${field}` as const;
        state.set(key, value);
        expect(state.get(key)).toBe(value);
      }),
      { numRuns: 60 },
    );
  });
});

// ── ST2: same-value set() is a no-op (no event dispatched) ───────────────────

describe("state — ST2: set() same value does NOT dispatch event", () => {
  it("no event is dispatched when set is called twice with the same primitive", () => {
    fc.assert(
      fc.property(sliceArb, fieldArb, scalarArb, (slice, field, value) => {
        _resetForTest();
        const key = `${slice}.${field}` as const;

        let callCount = 0;
        const handler = () => {
          callCount++;
        };
        state.addEventListener(key, handler);

        state.set(key, value); // first write → fires event
        const afterFirst = callCount;
        state.set(key, value); // same value → must NOT fire again
        const afterSecond = callCount;

        state.removeEventListener(key, handler);
        expect(afterFirst).toBe(1);
        expect(afterSecond).toBe(1); // no extra event
      }),
      { numRuns: 80 },
    );
  });
});

// ── ST3: config writes don't bleed into cache ─────────────────────────────────

describe("state — ST3: config slice writes do not affect cache slice", () => {
  it("writing config.field does not change cache.field", () => {
    fc.assert(
      fc.property(fieldArb, scalarArb, scalarArb, (field, configVal, cacheVal) => {
        _resetForTest();
        const cacheKey = `cache.${field}` as const;
        const configKey = `config.${field}` as const;

        state.set(cacheKey, cacheVal);
        state.set(configKey, configVal);

        expect(state.get(cacheKey)).toBe(cacheVal); // cache untouched
      }),
      { numRuns: 80 },
    );
  });
});

// ── ST4: cache writes don't bleed into ui ────────────────────────────────────

describe("state — ST4: cache slice writes do not affect ui slice", () => {
  it("writing cache.field does not change ui.field", () => {
    fc.assert(
      fc.property(fieldArb, scalarArb, scalarArb, (field, cacheVal, uiVal) => {
        _resetForTest();
        const cacheKey = `cache.${field}` as const;
        const uiKey = `ui.${field}` as const;

        state.set(uiKey, uiVal);
        state.set(cacheKey, cacheVal);

        expect(state.get(uiKey)).toBe(uiVal); // ui untouched
      }),
      { numRuns: 80 },
    );
  });
});

// ── ST5: on() receives the exact value passed to set() ───────────────────────

describe("state — ST5: on() callback receives exact value from set()", () => {
  it("callback detail equals value for any scalar in any slice", () => {
    fc.assert(
      fc.property(sliceArb, fieldArb, scalarArb, (slice, field, value) => {
        _resetForTest();
        const key = `${slice}.${field}` as const;

        const received: unknown[] = [];
        const handler = (v: unknown) => {
          received.push(v);
        };
        state.on(key, handler as Parameters<typeof state.on>[1]);

        state.set(key, value);
        state.removeEventListener(key, handler as EventListener);

        expect(received).toHaveLength(1);
        expect(received[0]).toBe(value);
      }),
      { numRuns: 80 },
    );
  });
});

// ── ST6: different keys dispatch separate events ──────────────────────────────

describe("state — ST6: distinct keys fire distinct events", () => {
  it("writing key A does not trigger listener on key B", () => {
    fc.assert(
      fc.property(
        sliceArb,
        fieldArb,
        fieldArb.filter((f) => f !== "z"),
        scalarArb,
        (slice, fieldA, fieldB, value) => {
          fc.pre(fieldA !== fieldB);
          _resetForTest();

          const keyA = `${slice}.${fieldA}` as const;
          const keyB = `${slice}.${fieldB}` as const;

          let bFired = false;
          const handlerB = () => {
            bFired = true;
          };
          state.addEventListener(keyB, handlerB);

          state.set(keyA, value);

          state.removeEventListener(keyB, handlerB);
          expect(bFired).toBe(false);
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── ST7: invalid slice is silently ignored ────────────────────────────────────

describe("state — ST7: invalid slice key is silently ignored", () => {
  it("set on unknown slice does not throw and get returns undefined", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 20 }).filter((s) => !["config", "cache", "ui"].includes(s) && /^[a-z]+$/.test(s)),
        fieldArb,
        scalarArb,
        (badSlice, field, value) => {
          _resetForTest();
          const key = `${badSlice}.${field}` as `config.${string}`;
          expect(() => state.set(key, value)).not.toThrow();
          expect(state.get(key)).toBeUndefined();
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── ST8: last-write-wins ──────────────────────────────────────────────────────

describe("state — ST8: repeated set() returns the latest value (last-write-wins)", () => {
  it("N sequential writes — get() always returns the last value written", () => {
    fc.assert(
      fc.property(
        sliceArb,
        fieldArb,
        fc.array(scalarArb, { minLength: 2, maxLength: 10 }),
        (slice, field, values) => {
          _resetForTest();
          const key = `${slice}.${field}` as const;

          let last: unknown = undefined;
          for (const v of values) {
            if (v !== last) {
              state.set(key, v);
              last = v;
            }
          }

          if (last !== undefined) {
            expect(state.get(key)).toBe(last);
          }
        },
      ),
      { numRuns: 80 },
    );
  });
});
