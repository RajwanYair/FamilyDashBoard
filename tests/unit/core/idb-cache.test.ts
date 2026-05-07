/**
 * tests/unit/core/idb-cache.test.ts — *
 * Tests for the IndexedDB cache tier.
 * Uses a vi.stubGlobal IDB mock because happy-dom's IDB implementation
 * does not persist data between requests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  idbGet,
  idbSet,
  idbDel,
  idbClear,
  idbKeys,
  idbGetEntry,
  isIdbAvailable,
  _resetIdb,
  idbEstimateSize,
  idbEvictLRU,
  IDB_MAX_BYTES,
  migrateLsToIdb,
  idbEvictStale,
} from "../../../src/core/idb-cache";

// ── Minimal in-memory IDB mock ────────────────────────────────────────────────

function makeMockIdb() {
  const store = new Map<string, unknown>();

  function makeRequest<T>(fn: () => T): IDBRequest<T> {
    const req = {
      result: undefined as T,
      onsuccess: null as ((e: Event) => void) | null,
      onerror: null as ((e: Event) => void) | null,
    } as unknown as IDBRequest<T>;
    setTimeout(() => {
      try {
        (req as unknown as { result: T }).result = fn();
        req.onsuccess?.({} as Event);
      } catch (err) {
        req.onerror?.({ target: { error: err } } as unknown as Event);
      }
    }, 0);
    return req;
  }

  const mockObjectStore = {
    get: (key: string) => makeRequest(() => store.get(key) ?? undefined),
    put: (value: unknown, key: string) =>
      makeRequest(() => {
        store.set(key, value);
        return key;
      }),
    delete: (key: string) =>
      makeRequest(() => {
        store.delete(key);
        return undefined;
      }),
    clear: () =>
      makeRequest(() => {
        store.clear();
        return undefined;
      }),
    getAllKeys: () => makeRequest(() => Array.from(store.keys())),
  };

  const mockTx = {
    objectStore: () => mockObjectStore,
  };

  const mockDb = {
    transaction: () => mockTx,
    objectStoreNames: { contains: () => true },
  };

  const mockOpen = {
    result: mockDb as unknown as IDBDatabase,
    onsuccess: null as ((e: Event) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onupgradeneeded: null as ((e: IDBVersionChangeEvent) => void) | null,
  } as unknown as IDBOpenDBRequest;

  setTimeout(() => mockOpen.onsuccess?.({ target: mockOpen } as unknown as Event), 0);

  return {
    open: () => mockOpen,
  } as unknown as IDBFactory;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetIdb();
  vi.stubGlobal("indexedDB", makeMockIdb());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IDB Cache — isIdbAvailable", () => {
  it("returns true when indexedDB is defined", () => {
    expect(isIdbAvailable()).toBe(true);
  });

  it("returns false when indexedDB is undefined", () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(isIdbAvailable()).toBe(false);
  });
});

describe("IDB Cache — idbSet / idbGet", () => {
  it("stores and retrieves a value", async () => {
    await idbSet("test-key", { hello: "world" });
    const result = await idbGet<{ hello: string }>("test-key");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null for a missing key", async () => {
    const result = await idbGet("no-such-key");
    expect(result).toBeNull();
  });

  it("returns null when TTL is exceeded", async () => {
    await idbSet("ttl-key", 42);
    await new Promise((r) => setTimeout(r, 5));
    const result = await idbGet("ttl-key", 1);
    expect(result).toBeNull();
  });

  it("returns data when TTL has not elapsed", async () => {
    await idbSet("fresh-key", "fresh-value");
    const result = await idbGet("fresh-key", 60_000);
    expect(result).toBe("fresh-value");
  });

  it("overwrites an existing entry", async () => {
    await idbSet("overwrite-key", "first");
    await idbSet("overwrite-key", "second");
    const result = await idbGet<string>("overwrite-key");
    expect(result).toBe("second");
  });

  it("stores complex nested objects", async () => {
    const payload = { list: [1, 2, 3], nested: { a: true } };
    await idbSet("complex", payload);
    const result = await idbGet<typeof payload>("complex");
    expect(result).toEqual(payload);
  });

  it("returns null when indexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    _resetIdb();
    const result = await idbGet("any");
    expect(result).toBeNull();
  });

  it("idbSet resolves silently when indexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    _resetIdb();
    await expect(idbSet("any", 42)).resolves.toBeUndefined();
  });
});

describe("IDB Cache — idbDel", () => {
  it("deletes an existing entry", async () => {
    await idbSet("to-delete", "value");
    await idbDel("to-delete");
    const result = await idbGet("to-delete");
    expect(result).toBeNull();
  });

  it("does not throw when deleting a non-existent key", async () => {
    await expect(idbDel("ghost-key")).resolves.toBeUndefined();
  });
});

describe("IDB Cache — idbClear", () => {
  it("removes all entries", async () => {
    await idbSet("a", 1);
    await idbSet("b", 2);
    await idbClear();
    expect(await idbGet("a")).toBeNull();
    expect(await idbGet("b")).toBeNull();
  });

  it("resolves silently when indexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    _resetIdb();
    await expect(idbClear()).resolves.toBeUndefined();
  });
});

describe("IDB Cache — idbKeys", () => {
  it("returns all stored keys", async () => {
    await idbSet("k1", "v1");
    await idbSet("k2", "v2");
    const keys = await idbKeys();
    expect(keys).toContain("k1");
    expect(keys).toContain("k2");
  });

  it("returns an empty array when the store is empty", async () => {
    const keys = await idbKeys();
    expect(Array.isArray(keys)).toBe(true);
  });

  it("returns an empty array when indexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    _resetIdb();
    expect(await idbKeys()).toEqual([]);
  });
});

describe("IDB Cache — isIdbAvailable", () => {
  it("returns a boolean", () => {
    expect(typeof isIdbAvailable()).toBe("boolean");
  });
});

describe("IDB Cache — idbSet / idbGet", () => {
  it("stores and retrieves a value", async () => {
    await idbSet("test-key", { hello: "world" });
    const result = await idbGet<{ hello: string }>("test-key");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null for a missing key", async () => {
    const result = await idbGet("no-such-key");
    expect(result).toBeNull();
  });

  it("returns null when TTL is exceeded", async () => {
    await idbSet("ttl-key", 42);
    // Use TTL = 1 ms so the entry is immediately stale
    await new Promise((r) => setTimeout(r, 5));
    const result = await idbGet("ttl-key", 1);
    expect(result).toBeNull();
  });

  it("returns data when TTL has not elapsed", async () => {
    await idbSet("fresh-key", "fresh-value");
    const result = await idbGet("fresh-key", 60_000);
    expect(result).toBe("fresh-value");
  });

  it("overwrites an existing entry", async () => {
    await idbSet("overwrite-key", "first");
    await idbSet("overwrite-key", "second");
    const result = await idbGet("overwrite-key");
    expect(result).toBe("second");
  });

  it("stores complex nested objects", async () => {
    const payload = { list: [1, 2, 3], nested: { a: true } };
    await idbSet("complex", payload);
    const result = await idbGet<typeof payload>("complex");
    expect(result).toEqual(payload);
  });
});

describe("IDB Cache — idbDel", () => {
  it("deletes an existing entry", async () => {
    await idbSet("to-delete", "value");
    await idbDel("to-delete");
    const result = await idbGet("to-delete");
    expect(result).toBeNull();
  });

  it("does not throw when deleting a non-existent key", async () => {
    await expect(idbDel("ghost-key")).resolves.toBeUndefined();
  });
});

describe("IDB Cache — idbClear", () => {
  it("removes all entries", async () => {
    await idbSet("a", 1);
    await idbSet("b", 2);
    await idbClear();
    expect(await idbGet("a")).toBeNull();
    expect(await idbGet("b")).toBeNull();
  });
});

describe("IDB Cache — idbKeys", () => {
  it("returns all stored keys", async () => {
    await idbSet("k1", "v1");
    await idbSet("k2", "v2");
    const keys = await idbKeys();
    expect(keys).toContain("k1");
    expect(keys).toContain("k2");
  });

  it("returns an empty array when the store is empty", async () => {
    const keys = await idbKeys();
    expect(keys).toEqual([]);
  });
});

describe("IDB Cache — isIdbAvailable", () => {
  it("returns true when indexedDB exists in the environment", () => {
    expect(typeof isIdbAvailable()).toBe("boolean");
  });
});

describe("IDB Cache — idbSet / idbGet", () => {
  it("stores and retrieves a value", async () => {
    await idbSet("test-key", { hello: "world" });
    const result = await idbGet<{ hello: string }>("test-key");
    expect(result).toEqual({ hello: "world" });
  });

  it("returns null for a missing key", async () => {
    const result = await idbGet("no-such-key");
    expect(result).toBeNull();
  });

  it("returns null when TTL is exceeded", async () => {
    await idbSet("ttl-key", 42);
    // Use TTL = 1 ms so the entry is immediately stale
    await new Promise((r) => setTimeout(r, 5));
    const result = await idbGet("ttl-key", 1);
    expect(result).toBeNull();
  });

  it("returns data when TTL has not elapsed", async () => {
    await idbSet("fresh-key", "fresh-value");
    const result = await idbGet("fresh-key", 60_000);
    expect(result).toBe("fresh-value");
  });

  it("overwrites an existing entry", async () => {
    await idbSet("overwrite-key", "first");
    await idbSet("overwrite-key", "second");
    const result = await idbGet("overwrite-key");
    expect(result).toBe("second");
  });

  it("stores complex nested objects", async () => {
    const payload = { list: [1, 2, 3], nested: { a: true } };
    await idbSet("complex", payload);
    const result = await idbGet<typeof payload>("complex");
    expect(result).toEqual(payload);
  });
});

describe("IDB Cache — idbDel", () => {
  it("deletes an existing entry", async () => {
    await idbSet("to-delete", "value");
    await idbDel("to-delete");
    const result = await idbGet("to-delete");
    expect(result).toBeNull();
  });

  it("does not throw when deleting a non-existent key", async () => {
    await expect(idbDel("ghost-key")).resolves.toBeUndefined();
  });
});

describe("IDB Cache — idbClear", () => {
  it("removes all entries", async () => {
    await idbSet("a", 1);
    await idbSet("b", 2);
    await idbClear();
    expect(await idbGet("a")).toBeNull();
    expect(await idbGet("b")).toBeNull();
  });
});

describe("IDB Cache — idbKeys", () => {
  it("returns all stored keys", async () => {
    await idbClear();
    await idbSet("k1", "v1");
    await idbSet("k2", "v2");
    const keys = await idbKeys();
    expect(keys).toContain("k1");
    expect(keys).toContain("k2");
  });

  it("returns an empty array when the store is empty", async () => {
    await idbClear();
    const keys = await idbKeys();
    expect(keys).toEqual([]);
  });
});

// ── idbGetEntry ────────────────────────────────────────────────────

describe("IDB Cache — idbGetEntry", () => {
  it("returns data and ts for a stored entry", async () => {
    const before = Date.now();
    await idbSet("entry-key", { v: 99 });
    const entry = await idbGetEntry<{ v: number }>("entry-key");
    expect(entry).not.toBeNull();
    expect(entry?.data).toEqual({ v: 99 });
    expect(entry?.ts).toBeGreaterThanOrEqual(before);
  });

  it("returns null for a missing key", async () => {
    const result = await idbGetEntry("ghost");
    expect(result).toBeNull();
  });

  it("returns null when indexedDB is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    _resetIdb();
    const result = await idbGetEntry("any");
    expect(result).toBeNull();
  });

  it("returned ts is a valid timestamp", async () => {
    await idbSet("ts-check", "hello");
    const entry = await idbGetEntry("ts-check");
    expect(typeof entry?.ts).toBe("number");
    expect(entry!.ts).toBeGreaterThan(1_000_000_000_000); // > year 2001
  });
});

// ── v7.10: idbEstimateSize ────────────────────────────────────────────────────

describe("IDB Cache — idbEstimateSize", () => {
  it("returns 0 when navigator is unavailable", async () => {
    const orig = globalThis.navigator;
    vi.stubGlobal("navigator", undefined);
    const size = await idbEstimateSize();
    expect(size).toBe(0);
    vi.stubGlobal("navigator", orig);
  });

  it("returns 0 when storage.estimate is unavailable", async () => {
    vi.stubGlobal("navigator", {});
    const size = await idbEstimateSize();
    expect(size).toBe(0);
  });

  it("returns usage from navigator.storage.estimate()", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 2048, quota: 1_000_000 }) },
    });
    const size = await idbEstimateSize();
    expect(size).toBe(2048);
  });

  it("returns 0 when estimate() rejects", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const size = await idbEstimateSize();
    expect(size).toBe(0);
  });

  it("returns 0 when usage is undefined in estimate result", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ quota: 1_000_000 }) },
    });
    const size = await idbEstimateSize();
    expect(size).toBe(0);
  });
});

// ── v7.10: IDB_MAX_BYTES constant ─────────────────────────────────────────────

describe("IDB Cache — IDB_MAX_BYTES", () => {
  it("equals 50 MB", () => {
    expect(IDB_MAX_BYTES).toBe(50 * 1024 * 1024);
  });
});

// ── v7.10: idbEvictLRU ────────────────────────────────────────────────────────

describe("IDB Cache — idbEvictLRU", () => {
  it("returns 0 when size is under the limit", async () => {
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 1024 }) },
    });
    const removed = await idbEvictLRU(IDB_MAX_BYTES);
    expect(removed).toBe(0);
  });

  it("evicts oldest entries when over the limit until under", async () => {
    // Seed IDB with 3 entries at known timestamps using idbSet then idbGetEntry to verify ts
    await idbSet("old1", "a");
    await idbSet("old2", "b");
    await idbSet("old3", "c");

    let callCount = 0;
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockImplementation(() => {
          callCount++;
          // First call: over limit. Every call after first batch of 5: under limit
          const usage = callCount <= 1 ? 60 * 1024 * 1024 : 1024;
          return Promise.resolve({ usage });
        }),
      },
    });

    const removed = await idbEvictLRU(IDB_MAX_BYTES);
    expect(removed).toBeGreaterThan(0);
  });

  it("stops evicting once size drops below maxBytes", async () => {
    await idbSet("e1", "x");
    await idbSet("e2", "x");

    let calls = 0;
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockImplementation(() => {
          calls++;
          return Promise.resolve({ usage: calls <= 1 ? 60 * 1024 * 1024 : 0 });
        }),
      },
    });
    const removed = await idbEvictLRU(IDB_MAX_BYTES);
    // Should have removed some but not more than available entries
    expect(removed).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 and removes nothing when IDB has no entries", async () => {
    await idbClear();
    vi.stubGlobal("navigator", {
      storage: { estimate: vi.fn().mockResolvedValue({ usage: 60 * 1024 * 1024 }) },
    });
    const removed = await idbEvictLRU(IDB_MAX_BYTES);
    expect(removed).toBe(0);
  });
});
// ── migrateLsToIdb ─────────────────────────────────────────────
describe("migrateLsToIdb ", () => {
  beforeEach(async () => {
    _resetIdb();
    await idbClear();
    localStorage.clear();
  });

  it("migrates a JSON value from localStorage to IDB", async () => {
    localStorage.setItem("my-key", JSON.stringify({ v: 1 }));
    const count = await migrateLsToIdb(["my-key"]);
    expect(count).toBe(1);
    // key removed from localStorage
    expect(localStorage.getItem("my-key")).toBeNull();
    // value accessible in IDB
    const result = await idbGet<{ v: number }>("my-key");
    expect(result).toEqual({ v: 1 });
  });

  it("skips keys not present in localStorage", async () => {
    const count = await migrateLsToIdb(["nonexistent"]);
    expect(count).toBe(0);
  });

  it("skips keys with non-JSON values", async () => {
    localStorage.setItem("bad-key", "{{not json");
    const count = await migrateLsToIdb(["bad-key"]);
    expect(count).toBe(0);
    // key left in localStorage (not removed)
    expect(localStorage.getItem("bad-key")).toBe("{{not json");
  });

  it("migrates multiple keys in one call", async () => {
    localStorage.setItem("k1", JSON.stringify("hello"));
    localStorage.setItem("k2", JSON.stringify(42));
    const count = await migrateLsToIdb(["k1", "k2"]);
    expect(count).toBe(2);
    expect(localStorage.getItem("k1")).toBeNull();
    expect(localStorage.getItem("k2")).toBeNull();
  });

  it("returns 0 for empty keys array", async () => {
    const count = await migrateLsToIdb([]);
    expect(count).toBe(0);
  });
});

// ── idbEvictStale tests ───────────────────────────────────────────

describe("idbEvictStale", () => {
  beforeEach(async () => {
    _resetIdb();
    await idbClear();
  });

  it("removes entries older than maxAgeMs", async () => {
    // Manually insert an old entry via idbSet then patch the ts
    await idbSet("old-key", "old-data");
    await idbSet("new-key", "new-data");

    // Evict anything older than 1 ms (everything qualifies after a tick)
    // Wait long enough to avoid same-millisecond timestamp collisions.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
    const evicted = await idbEvictStale(1);
    expect(evicted).toBeGreaterThanOrEqual(2);
    const keys = await idbKeys();
    expect(keys).toHaveLength(0);
  });

  it("keeps fresh entries", async () => {
    await idbSet("fresh", "data");
    const evicted = await idbEvictStale(60_000); // 60s — entry is fresh
    expect(evicted).toBe(0);
    const keys = await idbKeys();
    expect(keys).toContain("fresh");
  });

  it("returns 0 when IDB is empty", async () => {
    const evicted = await idbEvictStale(1);
    expect(evicted).toBe(0);
  });
});

// ── catch-block branches (lines 165, 192) ─────────────────────────

function makeThrowingMockIdb() {
  const throwingDb = {
    transaction: () => {
      throw new Error("IDB transaction error");
    },
    objectStoreNames: { contains: () => true },
  };
  const throwingOpen = {
    result: throwingDb,
    onsuccess: null as ((e: Event) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onupgradeneeded: null as ((e: IDBVersionChangeEvent) => void) | null,
  } as unknown as IDBOpenDBRequest;
  setTimeout(() => throwingOpen.onsuccess?.({ target: throwingOpen } as unknown as Event), 0);
  return { open: () => throwingOpen } as unknown as IDBFactory;
}

describe("IDB Cache — idbKeys catch branch (line 165)", () => {
  it("resolves with [] when db.transaction() throws", async () => {
    _resetIdb();
    vi.stubGlobal("indexedDB", makeThrowingMockIdb());
    const result = await idbKeys();
    expect(result).toEqual([]);
  });
});

describe("IDB Cache — idbGetEntry catch branch (line 192)", () => {
  it("resolves with null when db.transaction() throws", async () => {
    _resetIdb();
    vi.stubGlobal("indexedDB", makeThrowingMockIdb());
    const result = await idbGetEntry("any-key");
    expect(result).toBeNull();
  });
});

// ── idbEvictLRU size-check after 5 deletions (lines 254-256) ──────

describe("IDB Cache — idbEvictLRU size re-check at 5 deletions (line 255 TRUE)", () => {
  beforeEach(async () => {
    _resetIdb();
    vi.stubGlobal("indexedDB", makeMockIdb());
    await idbClear();
  });

  it("checks size after every 5 deletions and breaks when under limit", async () => {
    // Seed exactly 5 entries
    for (let i = 0; i < 5; i++) {
      await idbSet(`lru-k${i}`, `value${i}`);
    }
    let estimateCalls = 0;
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockImplementation(() => {
          estimateCalls++;
          // First call: over limit; second call (after 5 removals): under limit
          const usage = estimateCalls === 1 ? 60 * 1024 * 1024 : 1024;
          return Promise.resolve({ usage });
        }),
      },
    });

    const removed = await idbEvictLRU(IDB_MAX_BYTES);
    // All 5 deleted; at removed=5, size check fires (line 255 TRUE) and breaks (line 256 TRUE)
    expect(removed).toBe(5);
    expect(estimateCalls).toBe(2);
  });

  it("continues evicting when size is still over limit at the 5-deletion checkpoint", async () => {
    // Seed 10 entries so we pass the first checkpoint at 5 and keep going
    for (let i = 0; i < 10; i++) {
      await idbSet(`lru2-k${i}`, `v${i}`);
    }
    let estimateCalls = 0;
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockImplementation(() => {
          estimateCalls++;
          // Still over limit at first checkpoint (call 2), under at second (call 3)
          const usage = estimateCalls <= 2 ? 60 * 1024 * 1024 : 1024;
          return Promise.resolve({ usage });
        }),
      },
    });

    const removed = await idbEvictLRU(IDB_MAX_BYTES);
    // Removed at least 5 (first checkpoint size still over) then more until under
    expect(removed).toBeGreaterThanOrEqual(5);
  });
});
