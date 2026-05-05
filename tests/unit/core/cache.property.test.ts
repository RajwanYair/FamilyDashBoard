/**
 * fast-check property tests — src/core/cache.ts (Sprint 459)
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
