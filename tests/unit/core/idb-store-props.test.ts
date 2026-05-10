/**
 * fast-check property tests for src/core/idb-store.ts
 *
 * Properties verified:
 *  IDB1 — set → get round-trip: arbitrary JSON values are returned unchanged
 *  IDB2 — get returns null for a key that was never set
 *  IDB3 — delete removes the key (get returns null after delete)
 *  IDB4 — namespace isolation: (dbA, storeA, key) never collides with (dbB, storeA, key)
 *  IDB5 — set is idempotent: setting the same key twice returns the last value
 *  IDB6 — multiple keys in the same store are independent
 *  IDB7 — delete is idempotent: deleting a non-existent key does not throw
 *  IDB8 — get with a never-set key in any (db, store) pair returns null
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { idbGet, idbSet, idbDelete, _idbClearFallback } from "@/core/idb-store";

// ─── Arbitraries ──────────────────────────────────────────────────────────────

/** Short identifier safe for DB/store names */
const nameArb = fc.stringMatching(/^[a-z][a-z0-9]{0,14}$/);

/** Arbitrary JSON-serializable object stored by the dashboard */
const jsonValArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.record({ label: fc.string(), count: fc.integer(), active: fc.boolean() }),
  fc.array(fc.integer(), { maxLength: 10 }),
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Runs in the in-memory fallback path (IDB unavailable in happy-dom) */
beforeEach(() => {
  _idbClearFallback();
});

// ─── Property tests ───────────────────────────────────────────────────────────

describe("idb-store — fast-check property tests ", () => {
  // IDB1: set → get round-trip
  it("IDB1: idbSet then idbGet returns the identical value for any key/value", async () => {
    await fc.assert(
      fc.asyncProperty(nameArb, nameArb, nameArb, jsonValArb, async (db, store, key, value) => {
        await idbSet(db, store, key, value);
        const result = await idbGet(db, store, key);
        expect(result).toEqual(value);
      }),
      { numRuns: 80, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB2: missing key returns null
  it("IDB2: idbGet returns null for a key that has never been set", async () => {
    await fc.assert(
      fc.asyncProperty(nameArb, nameArb, nameArb, async (db, store, key) => {
        const result = await idbGet(db, store, key);
        expect(result).toBeNull();
      }),
      { numRuns: 40, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB3: delete removes the entry
  it("IDB3: idbDelete causes idbGet to return null for the deleted key", async () => {
    await fc.assert(
      fc.asyncProperty(nameArb, nameArb, nameArb, jsonValArb, async (db, store, key, value) => {
        await idbSet(db, store, key, value);
        await idbDelete(db, store, key);
        const result = await idbGet(db, store, key);
        expect(result).toBeNull();
      }),
      { numRuns: 60, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB4: namespace isolation — different db names don't collide
  it("IDB4: (dbA, store, key) and (dbB, store, key) are fully independent namespaces", async () => {
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        nameArb.filter((b) => b !== "a"), // dbB !== dbA
        nameArb,
        nameArb,
        jsonValArb,
        jsonValArb,
        async (dbA, dbB, store, key, valueA, valueB) => {
          await idbSet(dbA, store, key, valueA);
          await idbSet(dbB, store, key, valueB);
          const resultA = await idbGet(dbA, store, key);
          const resultB = await idbGet(dbB, store, key);
          expect(resultA).toEqual(valueA);
          expect(resultB).toEqual(valueB);
        },
      ),
      { numRuns: 40, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB5: set is idempotent — last write wins
  it("IDB5: setting the same key twice always returns the last written value", async () => {
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        nameArb,
        nameArb,
        jsonValArb,
        jsonValArb,
        async (db, store, key, first, second) => {
          await idbSet(db, store, key, first);
          await idbSet(db, store, key, second);
          const result = await idbGet(db, store, key);
          expect(result).toEqual(second);
        },
      ),
      { numRuns: 50, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB6: two different keys in the same store are independent
  it("IDB6: two distinct keys in the same (db, store) never interfere with each other", async () => {
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        nameArb,
        fc.tuple(nameArb, nameArb).filter(([a, b]) => a !== b), // keyA !== keyB
        jsonValArb,
        jsonValArb,
        async (db, store, [keyA, keyB], valueA, valueB) => {
          await idbSet(db, store, keyA, valueA);
          await idbSet(db, store, keyB, valueB);
          expect(await idbGet(db, store, keyA)).toEqual(valueA);
          expect(await idbGet(db, store, keyB)).toEqual(valueB);
        },
      ),
      { numRuns: 50, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB7: delete is idempotent — no throw on missing key
  it("IDB7: deleting a non-existent key resolves without throwing", async () => {
    await fc.assert(
      fc.asyncProperty(nameArb, nameArb, nameArb, async (db, store, key) => {
        await expect(idbDelete(db, store, key)).resolves.toBeUndefined();
      }),
      { numRuns: 30, interruptAfterTimeLimit: 10_000 },
    );
  });

  // IDB8: store-level isolation — same key in different stores differs
  it("IDB8: (db, storeA, key) and (db, storeB, key) are independent stores", async () => {
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        fc.tuple(nameArb, nameArb).filter(([a, b]) => a !== b), // storeA !== storeB
        nameArb,
        jsonValArb,
        jsonValArb,
        async (db, [storeA, storeB], key, valueA, valueB) => {
          await idbSet(db, storeA, key, valueA);
          await idbSet(db, storeB, key, valueB);
          expect(await idbGet(db, storeA, key)).toEqual(valueA);
          expect(await idbGet(db, storeB, key)).toEqual(valueB);
        },
      ),
      { numRuns: 40, interruptAfterTimeLimit: 10_000 },
    );
  });
});
