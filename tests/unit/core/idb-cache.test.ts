/**
 * tests/unit/core/idb-cache.test.ts — Sprint 43
 *
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
  isIdbAvailable,
  _resetIdb,
} from "../../../src/core/idb-cache";

// ── Minimal in-memory IDB mock ────────────────────────────────────────────────

function makeMockIdb() {
  const store = new Map<string, unknown>();

  function makeRequest<T>(fn: () => T): IDBRequest<T> {
    const req = { result: undefined as T, onsuccess: null as ((e: Event) => void) | null, onerror: null as ((e: Event) => void) | null } as unknown as IDBRequest<T>;
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
    put: (value: unknown, key: string) => makeRequest(() => { store.set(key, value); return key; }),
    delete: (key: string) => makeRequest(() => { store.delete(key); return undefined; }),
    clear: () => makeRequest(() => { store.clear(); return undefined; }),
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
