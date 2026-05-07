/**
 * fast-check property tests — src/core/idb-store.ts (Sprint 491)
 *
 * Tests run against the in-memory fallback since Vitest jsdom doesn't provide IndexedDB.
 *
 * Properties under test:
 *  IDB1. idbSet → idbGet round-trip returns the same value.
 *  IDB2. idbGet for unknown key returns null.
 *  IDB3. idbDelete removes the value (subsequent get returns null).
 *  IDB4. idbSet is idempotent (last write wins).
 *  IDB5. _idbClearFallback empties all keys.
 *  IDB6. idbGetAll returns all values for a given store.
 *  IDB7. idbDelete on non-existent key does not throw.
 *  IDB8. idbSet with same value twice keeps single entry (no duplication).
 *  IDB9. idbGetAll values match what was set (content correctness).
 *  IDB10. Separate stores are isolated (write to store A, read from store B → null).
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  idbGet,
  idbSet,
  idbDelete,
  idbGetAll,
  _idbClearFallback,
} from "@/core/idb-store";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _idbClearFallback();
});

// ── Arbitraries ───────────────────────────────────────────────────────────────

const dbNameArb = fc.constant("test-db");
const storeNameArb = fc.constant("test-store");
const keyArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/);
const jsonValueArb = fc.oneof(
  fc.string({ minLength: 0, maxLength: 50 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
);

// ── IDB1: set → get round-trip ───────────────────────────────────────────────

describe("idb-store — IDB1: set → get round-trip", () => {
  it("get returns what was set", async () => {
    await fc.assert(
      fc.asyncProperty(dbNameArb, storeNameArb, keyArb, jsonValueArb, async (db, store, key, val) => {
        _idbClearFallback();
        await idbSet(db, store, key, val);
        const result = await idbGet(db, store, key);
        expect(result).toEqual(val);
      }),
      { numRuns: 50 },
    );
  });
});

// ── IDB2: get unknown key returns null ───────────────────────────────────────

describe("idb-store — IDB2: get unknown key returns null", () => {
  it("returns null for key never set", async () => {
    await fc.assert(
      fc.asyncProperty(dbNameArb, storeNameArb, keyArb, async (db, store, key) => {
        _idbClearFallback();
        const result = await idbGet(db, store, key);
        expect(result).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});

// ── IDB3: delete removes value ───────────────────────────────────────────────

describe("idb-store — IDB3: delete removes value", () => {
  it("get returns null after delete", async () => {
    await fc.assert(
      fc.asyncProperty(dbNameArb, storeNameArb, keyArb, jsonValueArb, async (db, store, key, val) => {
        _idbClearFallback();
        await idbSet(db, store, key, val);
        await idbDelete(db, store, key);
        const result = await idbGet(db, store, key);
        expect(result).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});

// ── IDB4: last write wins ────────────────────────────────────────────────────

describe("idb-store — IDB4: last write wins", () => {
  it("second set overwrites first", async () => {
    await fc.assert(
      fc.asyncProperty(
        dbNameArb,
        storeNameArb,
        keyArb,
        jsonValueArb,
        jsonValueArb,
        async (db, store, key, val1, val2) => {
          _idbClearFallback();
          await idbSet(db, store, key, val1);
          await idbSet(db, store, key, val2);
          const result = await idbGet(db, store, key);
          expect(result).toEqual(val2);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── IDB5: _idbClearFallback empties all ──────────────────────────────────────

describe("idb-store — IDB5: clearFallback empties all keys", () => {
  it("get returns null for all keys after clear", async () => {
    await fc.assert(
      fc.asyncProperty(
        dbNameArb,
        storeNameArb,
        fc.array(keyArb, { minLength: 1, maxLength: 10 }),
        async (db, store, keys) => {
          _idbClearFallback();
          for (const k of keys) await idbSet(db, store, k, "value");
          _idbClearFallback();
          for (const k of keys) {
            expect(await idbGet(db, store, k)).toBeNull();
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── IDB6: getAll returns all values ──────────────────────────────────────────

describe("idb-store — IDB6: getAll returns all stored values", () => {
  it("getAll count matches unique keys set", async () => {
    await fc.assert(
      fc.asyncProperty(
        dbNameArb,
        storeNameArb,
        fc.uniqueArray(keyArb, { minLength: 1, maxLength: 10 }),
        async (db, store, keys) => {
          _idbClearFallback();
          for (const k of keys) await idbSet(db, store, k, `val-${k}`);
          const all = await idbGetAll(db, store);
          expect(all.length).toBe(keys.length);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── IDB7: delete on non-existent key does not throw ──────────────────────────

describe("idb-store — IDB7: idbDelete on non-existent key is safe", () => {
  it("does not throw for keys never set", async () => {
    await fc.assert(
      fc.asyncProperty(dbNameArb, storeNameArb, keyArb, async (db, store, key) => {
        _idbClearFallback();
        // Should not throw
        await idbDelete(db, store, key);
        const result = await idbGet(db, store, key);
        expect(result).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});

// ── IDB8: double set same value keeps single entry ───────────────────────────

describe("idb-store — IDB8: idbSet same key twice yields one entry", () => {
  it("getAll count stays 1 for same key set twice", async () => {
    await fc.assert(
      fc.asyncProperty(
        dbNameArb,
        storeNameArb,
        keyArb,
        jsonValueArb,
        jsonValueArb,
        async (db, store, key, v1, v2) => {
          _idbClearFallback();
          await idbSet(db, store, key, v1);
          await idbSet(db, store, key, v2);
          const all = await idbGetAll(db, store);
          expect(all.length).toBe(1);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── IDB9: getAll values match set content ────────────────────────────────────

describe("idb-store — IDB9: getAll values match what was set", () => {
  it("all stored values are present in getAll result", async () => {
    await fc.assert(
      fc.asyncProperty(
        dbNameArb,
        storeNameArb,
        fc.uniqueArray(keyArb, { minLength: 1, maxLength: 5 }),
        async (db, store, keys) => {
          _idbClearFallback();
          const expectedValues: string[] = [];
          for (const k of keys) {
            const val = `val-${k}`;
            expectedValues.push(val);
            await idbSet(db, store, k, val);
          }
          const all = await idbGetAll<string>(db, store);
          for (const val of expectedValues) {
            expect(all).toContain(val);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── IDB10: stores are isolated ───────────────────────────────────────────────

describe("idb-store — IDB10: separate stores are isolated", () => {
  it("write to store-a, read from store-b → null", async () => {
    await fc.assert(
      fc.asyncProperty(dbNameArb, keyArb, jsonValueArb, async (db, key, val) => {
        _idbClearFallback();
        await idbSet(db, "store-a", key, val);
        const result = await idbGet(db, "store-b", key);
        expect(result).toBeNull();
      }),
      { numRuns: 30 },
    );
  });
});
