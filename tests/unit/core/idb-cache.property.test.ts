/**
 * fast-check property tests — src/core/idb-cache.ts
 *
 * Properties under test:
 *  IDB-C1. idbGet() returns null for any key when IDB is unavailable.
 *  IDB-C2. idbSet()+idbGet() round-trips arbitrary JSON-serialisable values.
 *  IDB-C3. idbDel() after idbSet() makes idbGet() return null.
 *  IDB-C4. idbKeys() always resolves to an array.
 *  IDB-C5. _resetIdb() is safe to call N times consecutively.
 *  IDB-C6. idbEvictStale() resolves to a non-negative integer.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import { idbGet, idbSet, idbDel, idbKeys, idbEvictStale, _resetIdb } from "@/core/idb-cache";

// ── Minimal in-memory IDB mock (reused across tests) ─────────────────────────

function installMockIdb(): void {
  const store = new Map<string, unknown>();

  function req<T>(fn: () => T): IDBRequest<T> {
    const r = {
      result: undefined as unknown as T,
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null as ((e: Event) => void) | null,
    } as unknown as IDBRequest<T>;
    setTimeout(() => {
      (r as unknown as { result: T }).result = fn();
      r.onsuccess?.({} as Event);
    }, 0);
    return r;
  }

  const objectStore = {
    get: (k: string) => req(() => store.get(k) as unknown),
    put: (v: unknown, k: string) =>
      req(() => {
        store.set(k, v);
        return k;
      }),
    delete: (k: string) =>
      req(() => {
        store.delete(k);
        return undefined;
      }),
    clear: () =>
      req(() => {
        store.clear();
        return undefined;
      }),
    getAllKeys: () => req(() => [...store.keys()]),
    getAll: () => req(() => [...store.values()]),
    openCursor: () => {
      const entries = [...store.entries()];
      let idx = 0;
      const cursorReq = {
        result: null as unknown,
        onsuccess: null as ((e: Event) => void) | null,
        onerror: null as ((e: Event) => void) | null,
      } as unknown as IDBRequest;
      setTimeout(() => {
        function next(): void {
          if (idx < entries.length) {
            const [key, value] = entries[idx++]!;
            (cursorReq as unknown as { result: unknown }).result = {
              key,
              value,
              continue: next,
              delete: () =>
                req(() => {
                  store.delete(key as string);
                  return undefined;
                }),
            };
          } else {
            (cursorReq as unknown as { result: unknown }).result = null;
          }
          cursorReq.onsuccess?.({} as Event);
        }
        next();
      }, 0);
      return cursorReq;
    },
  };

  const txn = {
    objectStore: () => objectStore,
    oncomplete: null,
    onerror: null,
  };

  const mockIdb: Pick<IDBFactory, "open"> = {
    open: (_name: string, _version?: number) => {
      const openReq = {
        result: null as unknown,
        onupgradeneeded: null as ((e: IDBVersionChangeEvent) => void) | null,
        onsuccess: null as ((e: Event) => void) | null,
        onerror: null as ((e: Event) => void) | null,
      } as unknown as IDBOpenDBRequest;
      setTimeout(() => {
        const db = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => objectStore,
          transaction: () => txn,
        };
        (openReq as unknown as { result: unknown }).result = db;
        openReq.onsuccess?.({
          target: openReq,
        } as unknown as Event);
      }, 0);
      return openReq;
    },
  };

  vi.stubGlobal("indexedDB", mockIdb);
}

afterEach(() => {
  vi.unstubAllGlobals();
  _resetIdb();
});

// ── IDB-C1: returns null when IDB unavailable ─────────────────────────────────

describe("idb-cache — IDB-C1: idbGet() returns null when IDB is unavailable", () => {
  it("returns null for any key when indexedDB is undefined", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 30 }), async (key) => {
        vi.stubGlobal("indexedDB", undefined);
        _resetIdb();
        const result = await idbGet(key);
        expect(result).toBeNull();
      }),
      { numRuns: 10 },
    );
  });
});

// ── IDB-C2: set+get round-trip ────────────────────────────────────────────────

describe("idb-cache — IDB-C2: idbSet+idbGet round-trip", () => {
  it("idbGet returns stored value immediately after idbSet", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(fc.integer(), fc.string({ minLength: 0, maxLength: 50 }), fc.boolean()),
        async (key, value) => {
          installMockIdb();
          _resetIdb();
          await idbSet(key, value);
          const result = await idbGet<unknown>(key);
          expect(result).toEqual(value);
        },
      ),
      { numRuns: 12 },
    );
  });
});

// ── IDB-C3: del removes key ───────────────────────────────────────────────────

describe("idb-cache — IDB-C3: idbDel removes a previously set key", () => {
  it("idbGet returns null after idbDel for any key", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer(),
        async (key, value) => {
          installMockIdb();
          _resetIdb();
          await idbSet(key, value);
          await idbDel(key);
          const result = await idbGet<unknown>(key);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── IDB-C4: idbKeys always returns array ──────────────────────────────────────

describe("idb-cache — IDB-C4: idbKeys() always resolves to an array", () => {
  it("returns an array whether IDB has data or is empty", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (withData) => {
        installMockIdb();
        _resetIdb();
        if (withData) {
          await idbSet("test-key", 42);
        }
        const keys = await idbKeys();
        expect(Array.isArray(keys)).toBe(true);
      }),
      { numRuns: 8 },
    );
  });
});

// ── IDB-C5: _resetIdb safe to call N times ────────────────────────────────────

describe("idb-cache — IDB-C5: _resetIdb() is idempotent", () => {
  it("N consecutive _resetIdb() calls never throw", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 6 }), async (n) => {
        for (let i = 0; i < n; i++) {
          expect(() => _resetIdb()).not.toThrow();
        }
      }),
      { numRuns: 10 },
    );
  });
});

// ── IDB-C6: idbEvictStale resolves to ≥0 ─────────────────────────────────────

describe("idb-cache — IDB-C6: idbEvictStale() resolves to a non-negative count", () => {
  it("returns ≥ 0 when IDB is available or unavailable", async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (available) => {
        if (available) {
          installMockIdb();
        } else {
          vi.stubGlobal("indexedDB", undefined);
        }
        _resetIdb();
        const evicted = await idbEvictStale();
        expect(evicted).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 8 },
    );
  });
});
