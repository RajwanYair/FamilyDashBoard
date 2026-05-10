/**
 * tests/unit/core/idb-store.test.ts — *
 * Direct unit tests for the IDB code path in src/core/idb-store.ts.
 * The fast-check property suite (idb-store-props.test.ts) runs only in the
 * in-memory fallback path because happy-dom has no real indexedDB.
 *
 * This file stubs globalThis.indexedDB via vi.stubGlobal so the IDB-available
 * branches in openStore / idbGet / idbSet / idbDelete / idbGetAll are executed.
 *
 * Tests:
 *  IDB-A  — isIDBAvailable returns true when indexedDB stub is present
 *  IDB-B  — openStore resolves with a DB and calls createObjectStore on upgrade
 *  IDB-C  — idbGet returns null for a missing key via IDB
 *  IDB-D  — idbSet + idbGet round-trip via IDB
 *  IDB-E  — idbDelete removes the key via IDB
 *  IDB-F  — idbGetAll returns all stored values via IDB
 *  IDB-G  — idbGet falls back to in-memory on IDB onerror
 *  IDB-H  — idbSet falls back silently on IDB onerror (value already in fallback)
 *  IDB-I  — idbDelete falls back silently on IDB onerror
 *  IDB-J  — idbGetAll falls back to in-memory on IDB onerror
 *  IDB-K  — openStore triggers onerror path → caller receives fallback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { idbGet, idbSet, idbDelete, idbGetAll, _idbClearFallback } from "@/core/idb-store";

// ─── Fake IDB factory ─────────────────────────────────────────────────────────

/** In-memory store map shared across the fake DB instance within a test. */
type FakeStore = Map<string, unknown>;

/** Build a minimal, async-correct fake IDBFactory backed by plain Maps. */
function buildFakeIDB(opts: { failOnOpen?: boolean; failOnOp?: boolean } = {}): IDBFactory {
  const storage = new Map<string, FakeStore>();

  function storeMap(dbName: string, storeName: string): FakeStore {
    const key = `${dbName}::${storeName}`;
    if (!storage.has(key)) storage.set(key, new Map());
    return storage.get(key)!;
  }

  /** A fake IDBRequest that resolves via queueMicrotask. */
  function successReq<T>(compute: () => T): IDBRequest<T> {
    let _result: T;
    const req = {
      error: null,
      get result(): T {
        return _result;
      },
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null as ((e: Event) => void) | null,
    };
    queueMicrotask(() => {
      _result = compute();
      req.onsuccess?.({} as Event);
    });
    return req as unknown as IDBRequest<T>;
  }

  /** A fake IDBRequest that fires onerror via queueMicrotask. */
  function errorReq(): IDBRequest<unknown> {
    const req = {
      error: new DOMException("FakeIDB error", "UnknownError"),
      result: undefined as unknown,
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null as ((e: Event) => void) | null,
    };
    queueMicrotask(() => {
      req.onerror?.({} as Event);
    });
    return req as unknown as IDBRequest<unknown>;
  }

  return {
    open(dbName: string): IDBOpenDBRequest {
      const openReq = {
        result: null as unknown as IDBDatabase,
        error: null as DOMException | null,
        onsuccess: null as ((e: Event) => void) | null,
        onerror: null as ((e: Event) => void) | null,
        onupgradeneeded: null as ((e: IDBVersionChangeEvent) => void) | null,
        onblocked: null as ((e: Event) => void) | null,
      };

      queueMicrotask(() => {
        if (opts.failOnOpen) {
          openReq.error = new DOMException("open failed", "UnknownError");
          openReq.onerror?.({} as Event);
          return;
        }

        const db: Partial<IDBDatabase> = {
          objectStoreNames: {
            contains: (_: string) => false,
          } as unknown as DOMStringList,
          createObjectStore: (storeName: string) => {
            storeMap(dbName, storeName);
            return {} as IDBObjectStore;
          },
          transaction: (storeName: string, _mode: string): IDBTransaction => {
            const m = storeMap(dbName, storeName);
            return {
              objectStore: (): IDBObjectStore =>
                ({
                  get: (key: string) =>
                    opts.failOnOp ? errorReq() : successReq(() => m.get(key) ?? undefined),
                  put: (value: unknown, key: string) =>
                    opts.failOnOp
                      ? errorReq()
                      : successReq(() => {
                          m.set(key, value);
                        }),
                  delete: (key: string) =>
                    opts.failOnOp
                      ? errorReq()
                      : successReq(() => {
                          m.delete(key);
                        }),
                  getAll: () =>
                    opts.failOnOp ? errorReq() : successReq(() => Array.from(m.values())),
                }) as unknown as IDBObjectStore,
            } as unknown as IDBTransaction;
          },
        };

        (openReq as Record<string, unknown>)["result"] = db;
        openReq.onupgradeneeded?.({} as IDBVersionChangeEvent);
        openReq.onsuccess?.({} as Event);
      });

      return openReq as unknown as IDBOpenDBRequest;
    },
    cmp: () => 0,
    deleteDatabase: () => ({}) as IDBOpenDBRequest,
    databases: async () => [] as IDBDatabaseInfo[],
  } as unknown as IDBFactory;
}

// ─── Suite setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  _idbClearFallback();
});

afterEach(() => {
  vi.unstubAllGlobals();
  _idbClearFallback();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("idb-store — IDB-path direct tests ", () => {
  // IDB-A
  it("IDB-A: idbGet returns null via IDB for a missing key", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    const result = await idbGet<string>("dashDB", "settings", "nonexistent");
    expect(result).toBeNull();
  });

  // IDB-B: openStore fires onupgradeneeded → createObjectStore is called once, then get works
  it("IDB-B: openStore fires onupgradeneeded and allows subsequent get via IDB", async () => {
    // buildFakeIDB always returns contains: () => false, so createObjectStore is always called.
    // Verify that the upgrade path completes by performing a successful round-trip.
    vi.stubGlobal("indexedDB", buildFakeIDB());
    await idbSet("newDB", "kv", "hello", "world");
    const result = await idbGet<string>("newDB", "kv", "hello");
    // If openStore / onupgradeneeded path was broken, this would throw or return null.
    expect(result).toBe("world");
  });

  // IDB-C
  it("IDB-C: idbSet then idbGet returns the written value via IDB", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    await idbSet("dashDB", "settings", "theme", "matrix");
    const result = await idbGet<string>("dashDB", "settings", "theme");
    expect(result).toBe("matrix");
  });

  // IDB-D
  it("IDB-D: idbDelete removes the key via IDB (get returns null)", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    await idbSet("dashDB", "prefs", "lang", "he");
    await idbDelete("dashDB", "prefs", "lang");
    const result = await idbGet<string>("dashDB", "prefs", "lang");
    expect(result).toBeNull();
  });

  // IDB-E
  it("IDB-E: idbGetAll returns all stored values for a store via IDB", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    await idbSet("dashDB", "items", "a", { id: 1 });
    await idbSet("dashDB", "items", "b", { id: 2 });
    const all = await idbGetAll<{ id: number }>("dashDB", "items");
    expect(all).toHaveLength(2);
    expect(all.map((x) => x.id).sort()).toEqual([1, 2]);
  });

  // IDB-F
  it("IDB-F: idbGetAll returns empty array when store has no entries via IDB", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    const all = await idbGetAll<string>("emptyDB", "kv");
    expect(all).toEqual([]);
  });

  // IDB-G
  it("IDB-G: idbGet falls back to in-memory value on IDB onerror", async () => {
    // Pre-populate fallback via the fallback path
    _idbClearFallback();
    await idbSet("dashDB", "kv", "cached", "fallback-value");
    // Now stub IDB that always errors
    vi.stubGlobal("indexedDB", buildFakeIDB({ failOnOp: true }));
    _idbClearFallback();
    // Re-set fallback directly (IDB will fail, but fallback.set at the top of idbSet runs)
    await idbSet("dashDB", "kv", "cached", "fallback-value");
    // idbGet: IDB path errors → falls back
    const result = await idbGet<string>("dashDB", "kv", "cached");
    expect(result).toBe("fallback-value");
  });

  // IDB-H
  it("IDB-H: idbSet on IDB onerror does not throw (fallback already written)", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB({ failOnOp: true }));
    // Should not throw even if IDB write fails
    await expect(idbSet("dashDB", "kv", "key", "val")).resolves.toBeUndefined();
    // Fallback was written at start of idbSet
    const result = await idbGet<string>("dashDB", "kv", "key");
    expect(result).toBe("val");
  });

  // IDB-I
  it("IDB-I: idbDelete on IDB onerror does not throw", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB({ failOnOp: true }));
    await idbSet("dashDB", "kv", "toDelete", 99);
    await expect(idbDelete("dashDB", "kv", "toDelete")).resolves.toBeUndefined();
  });

  // IDB-J
  it("IDB-J: idbGetAll falls back to in-memory on IDB onerror", async () => {
    // In fallback path: populate two keys
    _idbClearFallback();
    await idbSet("dashDB", "items", "x", "alpha");
    await idbSet("dashDB", "items", "y", "beta");
    // Now switch to failing IDB — fallback still has the data
    vi.stubGlobal("indexedDB", buildFakeIDB({ failOnOp: true }));
    _idbClearFallback();
    await idbSet("dashDB", "items", "x", "alpha");
    await idbSet("dashDB", "items", "y", "beta");
    const all = await idbGetAll<string>("dashDB", "items");
    expect(all.sort()).toEqual(["alpha", "beta"]);
  });

  // IDB-K
  it("IDB-K: openStore onerror causes idbGet to fall back to in-memory", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB({ failOnOpen: true }));
    // Fallback path will have been seeded by idbSet before open fails
    await idbSet("crashDB", "kv", "k", "safe");
    const result = await idbGet<string>("crashDB", "kv", "k");
    expect(result).toBe("safe");
  });

  // IDB-L: multiple operations in same (db, store) share state
  it("IDB-L: multiple set/get/delete operations share the same IDB store", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    await idbSet("multi", "store", "k1", 10);
    await idbSet("multi", "store", "k2", 20);
    await idbSet("multi", "store", "k3", 30);
    await idbDelete("multi", "store", "k2");
    const k1 = await idbGet<number>("multi", "store", "k1");
    const k2 = await idbGet<number>("multi", "store", "k2");
    const k3 = await idbGet<number>("multi", "store", "k3");
    expect(k1).toBe(10);
    expect(k2).toBeNull();
    expect(k3).toBe(30);
  });

  // IDB-M: object values round-trip via IDB
  it("IDB-M: object values round-trip through IDB unchanged", async () => {
    vi.stubGlobal("indexedDB", buildFakeIDB());
    const obj = { name: "Alice", scores: [1, 2, 3], active: true };
    await idbSet("dashDB", "users", "u1", obj);
    const result = await idbGet<typeof obj>("dashDB", "users", "u1");
    expect(result).toEqual(obj);
  });

  // IDB-N: idbGetAll in the in-memory fallback path (lines 113-115)
  it("IDB-N: idbGetAll in fallback mode returns only matching store keys", async () => {
    // No indexedDB stub → isIDBAvailable() returns false → fallback path
    await idbSet("dbA", "storeX", "k1", "v1");
    await idbSet("dbA", "storeX", "k2", "v2");
    await idbSet("dbA", "storeY", "k3", "v3"); // different store — must not appear
    const all = await idbGetAll<string>("dbA", "storeX");
    expect(all.sort()).toEqual(["v1", "v2"]);
  });
});
