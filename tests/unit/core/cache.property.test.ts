/**
 * fast-check property tests — src/core/cache.ts 
 *
 * Properties under test:
 *  CS1. cSet + cGet with fresh TTL always returns the stored data (round-trip identity).
 *  CS2. cGet with TTL=0 always returns null for any key (immediate expiry).
 *  CS3. cGetStale always returns the stored value regardless of TTL (never null after cSet).
 *  CS4. Key isolation — data stored under key A is never visible under a distinct key B.
 *  CS5. cSet overwrites: the most recent write always wins.
 *  CS6. cDelete removes data from all tiers; both cGet and cGetStale return null.
 *  CS7. cacheStats().hitRate is always in [0, 1] regardless of hit/miss sequence.
 *  CS8. lastHitLayer() is always one of the four known CacheLayer literals.
 *  CS9. cOr: returns cached value when fresh, fallback when miss 
 *  CS10. cAge: returns null for never-stored key 
 *  CS11. cClear: empties everything — cGet/cGetStale return null 
 *  CS12. cSet + cAge: age for just-stored key is 0 or very small 
 *  CS13. cEvict: never removes entries stored within the same test run 
 *  CS14. getOldestCacheAgeMinutes: returns 0 when cache is empty 
 *  CS15. cDelete is idempotent — double-delete never throws 
 *  CS16. cOr fallback value IS persisted after miss 
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  cGet,
  cSet,
  cGetStale,
  cDelete,
  cClear,
  cacheStats,
  resetCacheStats,
  lastHitLayer,
  cOr,
  cAge,
  cEvict,
  getOldestCacheAgeMinutes,
} from "@/core/cache";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Non-empty printable ASCII key (no control chars, no LS_PREFIX meta chars) */
const keyArb = fc
  .string({ minLength: 1, maxLength: 32 })
  .filter((s) => s.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(s));

/** Pair of distinct keys */
const distinctKeyPairArb = fc
  .tuple(keyArb, keyArb)
  .filter(([a, b]) => a !== b);

/** JSON-serializable scalar values */
const scalarArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
);

/** JSON-serializable data: scalars, arrays of scalars, plain objects */
const jsonDataArb: fc.Arbitrary<unknown> = fc.oneof(
  scalarArb,
  fc.array(scalarArb, { maxLength: 8 }),
  fc.record({
    id: fc.integer({ min: 0, max: 9999 }),
    name: fc.string({ maxLength: 20 }),
    active: fc.boolean(),
  }),
);

/** Fresh TTL: large enough that nothing expires during the test */
const freshTtlArb = fc.integer({ min: 60_000, max: 86_400_000 });

// ── CS1: round-trip identity ──────────────────────────────────────────────────

describe("cache — CS1: cSet+cGet round-trip identity", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("cGet returns exactly the stored data for any key/value with fresh TTL", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, freshTtlArb, (key, data, ttl) => {
        cSet(key, data);
        expect(cGet(key, ttl)).toEqual(data);
      }),
      { numRuns: 80 },
    );
  });
});

// ── CS2: TTL=0 always expires ─────────────────────────────────────────────────

describe("cache — CS2: cGet with TTL=0 always returns null", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("cGet(key, 0) returns null for any key immediately after cSet", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, (key, data) => {
        cSet(key, data);
        expect(cGet(key, 0)).toBeNull();
      }),
      { numRuns: 80 },
    );
  });
});

// ── CS3: cGetStale ignores TTL ────────────────────────────────────────────────

describe("cache — CS3: cGetStale always returns stored value", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("cGetStale returns the value regardless of any TTL consideration", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, (key, data) => {
        cSet(key, data);
        expect(cGetStale(key)).toEqual(data);
      }),
      { numRuns: 80 },
    );
  });
});

// ── CS4: key isolation ────────────────────────────────────────────────────────

describe("cache — CS4: distinct keys are isolated", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("data stored under key A is not returned for distinct key B", () => {
    fc.assert(
      fc.property(distinctKeyPairArb, jsonDataArb, freshTtlArb, ([keyA, keyB], data, ttl) => {
        cClear();
        cSet(keyA, data);
        // keyB was never written — must return null from cGet and cGetStale
        expect(cGet(keyB, ttl)).toBeNull();
        expect(cGetStale(keyB)).toBeNull();
      }),
      { numRuns: 60 },
    );
  });
});

// ── CS5: last write wins ──────────────────────────────────────────────────────

describe("cache — CS5: cSet overwrites — last write wins", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("second cSet overwrites the first; cGet returns second value", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, jsonDataArb, freshTtlArb, (key, first, second, ttl) => {
        cSet(key, first);
        cSet(key, second);
        expect(cGet(key, ttl)).toEqual(second);
      }),
      { numRuns: 60 },
    );
  });
});

// ── CS6: cDelete removes data ─────────────────────────────────────────────────

describe("cache — CS6: cDelete removes all tiers", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("after cDelete, both cGet and cGetStale return null", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, freshTtlArb, (key, data, ttl) => {
        cSet(key, data);
        cDelete(key);
        expect(cGet(key, ttl)).toBeNull();
        expect(cGetStale(key)).toBeNull();
      }),
      { numRuns: 60 },
    );
  });
});

// ── CS7: hitRate is always in [0, 1] ─────────────────────────────────────────

describe("cache — CS7: cacheStats().hitRate is always in [0, 1]", () => {
  it("hitRate stays in [0, 1] for any interleaving of cGet hits and misses", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ key: keyArb, data: jsonDataArb, ttl: freshTtlArb, hit: fc.boolean() }),
          { minLength: 1, maxLength: 20 },
        ),
        (ops) => {
          cClear();
          resetCacheStats();
          for (const { key, data, ttl, hit } of ops) {
            if (hit) cSet(key, data);
            cGet(key, ttl);
          }
          const { hitRate } = cacheStats();
          expect(hitRate).toBeGreaterThanOrEqual(0);
          expect(hitRate).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 40 },
    );
  });
});

// ── CS8: lastHitLayer is always a valid CacheLayer ───────────────────────────

describe("cache — CS8: lastHitLayer() is always a known CacheLayer", () => {
  const VALID_LAYERS = new Set(["mem", "ls", "idb", "none"]);

  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("lastHitLayer() is one of mem/ls/idb/none after any cGet", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, freshTtlArb, fc.boolean(), (key, data, ttl, preload) => {
        if (preload) cSet(key, data);
        cGet(key, ttl);
        expect(VALID_LAYERS.has(lastHitLayer())).toBe(true);
      }),
      { numRuns: 80 },
    );
  });
});

// ── CS9: cOr returns cached value when fresh, fallback when miss ─────────────

describe("cache — CS9: cOr round-trip", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("returns stored value when fresh", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb.filter((d) => d !== null), freshTtlArb, (key, data, ttl) => {
        cSet(key, data);
        const result = cOr(key, ttl, () => "FALLBACK");
        expect(result).toEqual(data);
      }),
      { numRuns: 50 },
    );
  });

  it("returns fallback when key missing", () => {
    fc.assert(
      fc.property(keyArb, freshTtlArb, (key, ttl) => {
        const result = cOr(key, ttl, () => 42);
        expect(result).toBe(42);
      }),
      { numRuns: 30 },
    );
  });
});

// ── CS10: cAge returns null for never-stored key ──────────────────────────

describe("cache — CS10: cAge null for missing key", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("cAge returns null for unknown key", () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        expect(cAge(key)).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});

// ── CS11: cClear empties all ────────────────────────────────────────────

describe("cache — CS11: cClear empties everything", () => {
  it("after cClear, cGet and cGetStale return null", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(keyArb, jsonDataArb), { minLength: 1, maxLength: 10 }),
        (entries) => {
          for (const [k, d] of entries) cSet(k, d);
          cClear();
          resetCacheStats();
          for (const [k] of entries) {
            expect(cGet(k, 60_000)).toBeNull();
            expect(cGetStale(k)).toBeNull();
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── CS12: cAge for just-stored key is small ─────────────────────────────

describe("cache — CS12: cAge for fresh entry", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("age is 0 for just-stored key", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, (key, data) => {
        cSet(key, data);
        const age = cAge(key);
        expect(age).not.toBeNull();
        expect(age!).toBeLessThanOrEqual(50); // <= 50 ms (real-time jitter)
      }),
      { numRuns: 30 },
    );
  });
});

// ── CS13: cEvict never removes fresh entries ─────────────────────────────

describe("cache — CS13: cEvict never removes fresh entries", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("entries stored within this run survive cEvict", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, freshTtlArb, (key, data, ttl) => {
        cSet(key, data);
        cEvict();
        // Fresh entries must still be retrievable
        expect(cGet(key, ttl)).toEqual(data);
      }),
      { numRuns: 60 },
    );
  });
});

// ── CS14: getOldestCacheAgeMinutes returns 0 on empty cache ──────────────

describe("cache — CS14: getOldestCacheAgeMinutes on empty cache", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("returns 0 when no dash_v2_ entries exist", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        cClear();
        expect(getOldestCacheAgeMinutes()).toBe(0);
      }),
      { numRuns: 5 },
    );
  });
});

// ── CS15: cDelete is idempotent ──────────────────────────────────────────

describe("cache — CS15: cDelete is idempotent", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("double-delete never throws and returns consistent null", () => {
    fc.assert(
      fc.property(keyArb, jsonDataArb, freshTtlArb, (key, data, ttl) => {
        cSet(key, data);
        cDelete(key);
        cDelete(key); // idempotent — should not throw
        expect(cGet(key, ttl)).toBeNull();
        expect(cGetStale(key)).toBeNull();
      }),
      { numRuns: 50 },
    );
  });
});

// ── CS16: cOr fallback value is persisted ────────────────────────────────

describe("cache — CS16: cOr fallback is persisted", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("fallback result from cOr is stored and retrievable via cGet", () => {
    fc.assert(
      fc.property(keyArb, freshTtlArb, (key, ttl) => {
        const fallbackVal = "COMPUTED_FALLBACK";
        const result = cOr(key, ttl, () => fallbackVal);
        expect(result).toBe(fallbackVal);
        // cOr persists the fallback
        expect(cGet(key, ttl)).toBe(fallbackVal);
        expect(cGetStale(key)).toBe(fallbackVal);
      }),
      { numRuns: 50 },
    );
  });
});
