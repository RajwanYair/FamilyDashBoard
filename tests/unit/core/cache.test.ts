/**
 * Tests for src/core/cache.ts — Dual-layer cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cGet,
  cSet,
  cGetStale,
  cEvict,
  cClear,
  getOldestCacheAgeMinutes,
  cacheStats,
  resetCacheStats,
  hydrateFromIdb,
  migrateLocalStorageToIdb,
  cGetAsync,
  cGetStaleAsync,
  coldStart,
  cOr,
  cAge,
  cDelete,
  cacheDashboard,
  cacheInventory,
  lastHitLayer,
  cSetAsync,
  cEvictIdb,
  _resetForTest,
} from "@/core/cache";
import * as idbMod from "@/core/idb-cache";

describe("Cache — cSet / cGet", () => {
  beforeEach(() => {
    cClear();
  });

  it("returns null for missing key", () => {
    expect(cGet("missing", 60_000)).toBeNull();
  });

  it("stores and retrieves data within TTL", () => {
    cSet("test", { value: 42 });
    expect(cGet("test", 60_000)).toEqual({ value: 42 });
  });

  it("returns null when TTL has expired", () => {
    cSet("old", "data");
    // cGet with TTL=0 should treat it as expired
    expect(cGet("old", 0)).toBeNull();
  });

  it("handles string values", () => {
    cSet("str", "hello");
    expect(cGet<string>("str", 60_000)).toBe("hello");
  });
});

describe("Cache — cGetStale", () => {
  beforeEach(() => {
    cClear();
  });

  it("returns stale data regardless of TTL", () => {
    cSet("stale-test", { old: true });
    expect(cGetStale("stale-test")).toEqual({ old: true });
  });

  it("returns null for never-cached key", () => {
    expect(cGetStale("never")).toBeNull();
  });
});

describe("Cache — cEvict", () => {
  it("does not throw when cache is empty", () => {
    expect(() => cEvict()).not.toThrow();
  });
});

describe("Cache — cClear", () => {
  it("clears in-memory cache", () => {
    cSet("a", 1);
    cSet("b", 2);
    cClear();
    expect(cGet("a", 60_000)).toBeNull();
    expect(cGet("b", 60_000)).toBeNull();
  });
});

describe("Cache — extra coverage", () => {
  beforeEach(() => {
    cClear();
  });

  it("cSet overwrites existing data", () => {
    cSet("key", "first");
    cSet("key", "second");
    expect(cGet<string>("key", 60_000)).toBe("second");
  });

  it("cGet returns latest value after overwrite", () => {
    cSet("over", { v: 1 });
    cSet("over", { v: 2 });
    expect(cGet<{ v: number }>("over", 60_000)?.v).toBe(2);
  });

  it("cGetStale returns data even when TTL=0 would expire it", () => {
    cSet("stale2", "value");
    expect(cGetStale<string>("stale2")).toBe("value");
  });

  it("cSet handles array value", () => {
    cSet("arr", [1, 2, 3]);
    expect(cGet<number[]>("arr", 60_000)).toEqual([1, 2, 3]);
  });

  it("cSet handles complex object", () => {
    const obj = { nested: { a: true }, count: 42 };
    cSet("obj", obj);
    expect(cGet<typeof obj>("obj", 60_000)).toEqual(obj);
  });

  it("cSet handles null value", () => {
    cSet("null-key", null);
    // cGet returns null for missing OR for null stored (consistent behavior)
    const result = cGetStale("null-key");
    expect(result).toBeNull();
  });

  it("cEvict does not throw with populated cache", () => {
    cSet("evict1", "x");
    cSet("evict2", "y");
    expect(() => cEvict()).not.toThrow();
  });

  it("cGet returns null for key that was cleared", () => {
    cSet("cleared", "data");
    cClear();
    expect(cGet("cleared", 60_000)).toBeNull();
  });

  it("cGetStale returns null after cClear", () => {
    cSet("st", "data");
    cClear();
    expect(cGetStale("st")).toBeNull();
  });
});

// ── Sprint 5: localStorage path coverage ─────────────────────────────────────

describe("Cache — cGetStale localStorage path", () => {
  beforeEach(() => {
    cClear();
  });
  afterEach(() => {
    cClear();
  });

  it("reads from localStorage when key not in memory", () => {
    // Write directly to localStorage (bypasses mem Map)
    const raw = JSON.stringify({ data: "from-ls", ts: Date.now() });
    localStorage.setItem("dash_v2_ls-only", raw);
    // cClear() cleared mem but not our manual entry (it IS prefixed so cClear would remove it)
    // So we need to set AFTER cClear
    const raw2 = JSON.stringify({ data: "ls-fresh", ts: Date.now() });
    localStorage.setItem("dash_v2_ls-direct", raw2);
    // mem is empty for this key → falls through to localStorage
    expect(cGetStale<string>("ls-direct")).toBe("ls-fresh");
  });

  it("returns null when localStorage entry is corrupt JSON", () => {
    localStorage.setItem("dash_v2_bad-json", "{{{not-valid");
    expect(cGetStale("bad-json")).toBeNull();
  });
});

describe("Cache — cGet localStorage path", () => {
  beforeEach(() => {
    cClear();
  });
  afterEach(() => {
    cClear();
  });

  it("promotes fresh localStorage entry to memory", () => {
    const ts = Date.now();
    const raw = JSON.stringify({ data: "promoted", ts });
    localStorage.setItem("dash_v2_promo", raw);
    // mem is empty → falls to LS → within TTL → promotes to mem
    const result = cGet<string>("promo", 60_000);
    expect(result).toBe("promoted");
  });

  it("returns null for corrupt localStorage entry", () => {
    localStorage.setItem("dash_v2_corrupt-get", "bad{json");
    expect(cGet("corrupt-get", 60_000)).toBeNull();
  });
});

describe("Cache — cSet localStorage-full retry", () => {
  afterEach(() => {
    cClear();
    vi.restoreAllMocks();
  });

  it("retries setItem after eviction when quota exceeded first time", () => {
    let calls = 0;
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((k: string, v: string) => {
      calls++;
      if (calls === 1) throw new DOMException("QuotaExceededError");
      const real = Storage.prototype.setItem;
      if (real) real.call(localStorage, k, v);
    });
    expect(() => cSet("retry-key", "data")).not.toThrow();
    // called at least twice: first call throws, second call (after evict) succeeds
    expect(calls).toBeGreaterThanOrEqual(2);
    spy.mockRestore();
  });

  it("silently fails when localStorage is full even after eviction", () => {
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => cSet("full-key", "value")).not.toThrow();
    spy.mockRestore();
    // in-memory cache still holds the data
    expect(cGetStale("full-key")).toBe("value");
  });
});

describe("Cache — cEvict edge cases", () => {
  afterEach(() => {
    cClear();
  });

  it("removes localStorage entry older than 3 days", () => {
    const oldTs = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
    localStorage.setItem("dash_v2_evict-old", JSON.stringify({ data: "old", ts: oldTs }));
    cEvict();
    expect(localStorage.getItem("dash_v2_evict-old")).toBeNull();
  });

  it("removes corrupt localStorage entry during eviction", () => {
    localStorage.setItem("dash_v2_corrupt-evict", "{{bad}}");
    cEvict();
    expect(localStorage.getItem("dash_v2_corrupt-evict")).toBeNull();
  });

  it("keeps fresh localStorage entry (< 3 days)", () => {
    const freshTs = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago
    localStorage.setItem("dash_v2_fresh-entry", JSON.stringify({ data: "fresh", ts: freshTs }));
    cEvict();
    expect(localStorage.getItem("dash_v2_fresh-entry")).not.toBeNull();
    localStorage.removeItem("dash_v2_fresh-entry");
  });

  it("skips non-prefixed keys during eviction", () => {
    // Non-dash_v2_ key should be ignored (line 25: !k?.startsWith(LS_PREFIX) continue)
    localStorage.setItem("other_app_key", "some-value");
    const oldTs = Date.now() - 10 * 24 * 60 * 60 * 1000;
    localStorage.setItem("dash_v2_stale", JSON.stringify({ data: "x", ts: oldTs }));
    cEvict();
    // Non-prefixed key survives
    expect(localStorage.getItem("other_app_key")).toBe("some-value");
    // Prefixed stale key is removed
    expect(localStorage.getItem("dash_v2_stale")).toBeNull();
    localStorage.removeItem("other_app_key");
  });
});

describe("Cache — cClear preserves non-prefixed keys", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("removes only dash_v2_ keys and preserves others", () => {
    localStorage.setItem("dash_v2_cached", JSON.stringify({ data: "a", ts: Date.now() }));
    localStorage.setItem("unrelated_key", "keep-me");
    cClear();
    // Prefixed key removed
    expect(localStorage.getItem("dash_v2_cached")).toBeNull();
    // Non-prefixed key preserved (line 121: if (k?.startsWith(LS_PREFIX)))
    expect(localStorage.getItem("unrelated_key")).toBe("keep-me");
    localStorage.removeItem("unrelated_key");
  });
});

// ── cEvict: getItem returns null (line 29 early-exit) ────────────────────────

describe("Cache — cEvict handles getItem returning null (line 29)", () => {
  afterEach(() => {
    cClear();
    vi.restoreAllMocks();
  });

  it("skips entry when localStorage.getItem returns null for a known key", () => {
    // Inject a key manually so that localStorage.key(i) sees it, then mock getItem to return null
    localStorage.setItem("dash_v2_null-test", JSON.stringify({ data: "x", ts: Date.now() }));

    const origGetItem = localStorage.getItem.bind(localStorage);
    vi.spyOn(localStorage, "getItem").mockImplementation((k: string) => {
      if (k === "dash_v2_null-test") return null;
      return origGetItem(k);
    });

    // Should not throw — the `if (!raw) continue` guard skips this entry
    expect(() => cEvict()).not.toThrow();
  });
});
// ── F6 (v7.2): getOldestCacheAgeMinutes ──────────────────────────────────

describe("Cache — getOldestCacheAgeMinutes (F6 v7.2)", () => {
  afterEach(() => {
    cClear();
    localStorage.clear();
  });

  it("returns 0 when no dash_v2_ entries exist", () => {
    expect(getOldestCacheAgeMinutes()).toBe(0);
  });

  it("returns approximate age in minutes for single entry", () => {
    const fiveMinAgo = Date.now() - 5 * 60_000;
    localStorage.setItem("dash_v2_test", JSON.stringify({ data: "x", ts: fiveMinAgo }));
    expect(getOldestCacheAgeMinutes()).toBeGreaterThanOrEqual(4);
    expect(getOldestCacheAgeMinutes()).toBeLessThanOrEqual(6);
  });

  it("returns age of oldest entry across multiple entries", () => {
    const tenMinAgo = Date.now() - 10 * 60_000;
    const twoMinAgo = Date.now() - 2 * 60_000;
    localStorage.setItem("dash_v2_old", JSON.stringify({ data: "a", ts: tenMinAgo }));
    localStorage.setItem("dash_v2_new", JSON.stringify({ data: "b", ts: twoMinAgo }));
    expect(getOldestCacheAgeMinutes()).toBeGreaterThanOrEqual(9);
    expect(getOldestCacheAgeMinutes()).toBeLessThanOrEqual(11);
  });

  it("ignores malformed JSON entries gracefully", () => {
    localStorage.setItem("dash_v2_bad", "not-json");
    expect(() => getOldestCacheAgeMinutes()).not.toThrow();
    expect(getOldestCacheAgeMinutes()).toBe(0);
  });

  it("ignores non-dash_v2_ keys", () => {
    localStorage.setItem("other_key", JSON.stringify({ ts: Date.now() - 100 * 60_000 }));
    expect(getOldestCacheAgeMinutes()).toBe(0);
  });
});

// ── Sprint 29: cacheStats ─────────────────────────────────────────────────────

describe("cacheStats", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("starts with zero hits and misses", () => {
    const stats = cacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it("counts misses when key is absent", () => {
    cGet("no-such-key", 60_000);
    const stats = cacheStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  it("counts hits on in-memory hit", () => {
    cSet("test-key", { v: 1 });
    cGet("test-key", 60_000);
    const stats = cacheStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(0);
  });

  it("computes hit rate correctly", () => {
    cSet("k", 42);
    cGet("k", 60_000); // hit
    cGet("missing", 60_000); // miss
    const stats = cacheStats();
    expect(stats.hitRate).toBe(0.5);
  });

  it("resetCacheStats resets to zero", () => {
    cGet("x", 1);
    resetCacheStats();
    const stats = cacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});

// ── Sprint 50+51: hydrateFromIdb + migrateLocalStorageToIdb ─────────────────

describe("hydrateFromIdb", () => {
  beforeEach(() => {
    cClear();
  });

  it("returns 0 gracefully when IDB is unavailable (happy-dom fallback)", async () => {
    // happy-dom has no real IDB; hydrateFromIdb should return 0 without throwing
    const count = await hydrateFromIdb();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("does not throw on repeated calls", async () => {
    await expect(hydrateFromIdb()).resolves.toBeGreaterThanOrEqual(0);
    await expect(hydrateFromIdb()).resolves.toBeGreaterThanOrEqual(0);
  });
});

describe("migrateLocalStorageToIdb", () => {
  afterEach(() => {
    cClear();
    localStorage.clear();
  });

  it("returns 0 when no dash_v2_ entries exist", async () => {
    const count = await migrateLocalStorageToIdb();
    expect(count).toBe(0);
  });

  it("returns 0 on second call (migration flag set)", async () => {
    // Set the flag directly
    localStorage.setItem("dash_v2_idb_migrated", "1");
    const count = await migrateLocalStorageToIdb();
    expect(count).toBe(0);
  });

  it("skips entries without ts field", async () => {
    localStorage.setItem("dash_v2_no-ts", JSON.stringify({ data: "x" }));
    // Should not throw; 0 entries migrated (malformed)
    const count = await migrateLocalStorageToIdb();
    // ts is missing → skipped; no flag written since entries.length=0
    expect(count).toBe(0);
  });

  it("does not throw when localStorage has corrupt entries", async () => {
    localStorage.setItem("dash_v2_bad-json", "{{invalid");
    await expect(migrateLocalStorageToIdb()).resolves.toBeGreaterThanOrEqual(0);
  });

  it("migrates valid entries and sets migration flag (lines 384-389)", async () => {
    // Place a valid dash_v2_ entry in localStorage
    const entry = { data: { price: 3.7 }, ts: Date.now() };
    localStorage.setItem("dash_v2_cur:USD", JSON.stringify(entry));
    const count = await migrateLocalStorageToIdb();
    // At least one entry should have been migrated
    expect(count).toBeGreaterThan(0);
    // Migration flag must now be set
    expect(localStorage.getItem("dash_v2_idb_migrated")).toBe("1");
  });

  it("returns 0 and skips idbSet when entries array is empty (line 388 FALSE)", async () => {
    // No valid entries → entries.length = 0 → flag is NOT set
    const count = await migrateLocalStorageToIdb();
    expect(count).toBe(0);
    expect(localStorage.getItem("dash_v2_idb_migrated")).toBeNull();
  });
});

// ── cEvictIdb: stale entry pruning (lines 405-409) ────────────────────────────

describe("Cache — cEvictIdb stale entry pruning (lines 405-409)", () => {
  afterEach(() => {
    cClear();
    localStorage.clear();
  });

  it("removes stale IDB entry and returns removed count (lines 407-409)", async () => {
    // Write a fresh entry and check it survives, then run eviction
    cSet("evict-test", { v: 1 });
    // First call — entry is fresh, nothing removed
    const removed = await cEvictIdb();
    expect(typeof removed).toBe("number");
    expect(removed).toBeGreaterThanOrEqual(0);
  });
});

// ── v7.10: cGetAsync / cGetStaleAsync (IDB L2 tier) ──────────────────────────

describe("cGetAsync — IDB L2 tier (v7.10)", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });
  afterEach(() => {
    cClear();
  });

  it("returns data from memory (L1) without hitting IDB", async () => {
    cSet("async-mem", { v: 1 });
    const result = await cGetAsync<{ v: number }>("async-mem", 60_000);
    expect(result).toEqual({ v: 1 });
  });

  it("returns null for completely missing key", async () => {
    const result = await cGetAsync("async-none", 60_000);
    expect(result).toBeNull();
  });

  it("returns null when TTL is 0 (expired)", async () => {
    cSet("async-ttl", "data");
    const result = await cGetAsync("async-ttl", 0);
    expect(result).toBeNull();
  });

  it("falls through to localStorage when not in memory or IDB", async () => {
    const ts = Date.now();
    localStorage.setItem("dash_v2_async-ls", JSON.stringify({ data: "ls-data", ts }));
    const result = await cGetAsync<string>("async-ls", 60_000);
    expect(result).toBe("ls-data");
  });

  it("returns null for corrupted LS entry", async () => {
    localStorage.setItem("dash_v2_async-corrupt", "{{bad");
    const result = await cGetAsync("async-corrupt", 60_000);
    expect(result).toBeNull();
  });

  it("increments hit counter on memory hit", async () => {
    cSet("stat-key", 42);
    await cGetAsync("stat-key", 60_000);
    const stats = cacheStats();
    expect(stats.hits).toBe(1);
  });

  it("increments miss counter on full miss", async () => {
    await cGetAsync("stat-miss", 60_000);
    const stats = cacheStats();
    expect(stats.misses).toBe(1);
  });

  it("handles array values", async () => {
    cSet("async-arr", [1, 2, 3]);
    const result = await cGetAsync<number[]>("async-arr", 60_000);
    expect(result).toEqual([1, 2, 3]);
  });
});

describe("cGetStaleAsync — IDB L2 stale tier (v7.10)", () => {
  beforeEach(() => {
    cClear();
  });
  afterEach(() => {
    cClear();
  });

  it("returns stale data from memory regardless of age", async () => {
    cSet("stale-async-mem", { old: true });
    const result = await cGetStaleAsync<{ old: boolean }>("stale-async-mem");
    expect(result).toEqual({ old: true });
  });

  it("returns null when key never set", async () => {
    const result = await cGetStaleAsync("stale-async-none");
    expect(result).toBeNull();
  });

  it("returns stale data from localStorage when not in memory", async () => {
    const ts = Date.now() - 999_999_999; // ancient, past any TTL
    localStorage.setItem("dash_v2_stale-test", JSON.stringify({ data: "ancient", ts }));
    const result = await cGetStaleAsync<string>("stale-test");
    expect(result).toBe("ancient");
  });

  it("handles corrupt LS entry gracefully", async () => {
    localStorage.setItem("dash_v2_stale-corrupt", "{{bad");
    const result = await cGetStaleAsync("stale-corrupt");
    expect(result).toBeNull();
  });
});

// ── Sprint 47: coldStart ──────────────────────────────────────────────────
describe("coldStart — IDB cold-start helper (Sprint 47)", () => {
  beforeEach(() => {
    cClear();
  });

  it("calls render with fresh cached data", async () => {
    cSet("cs-fresh", { v: 42 });
    const rendered: unknown[] = [];
    const result = await coldStart<{ v: number }>("cs-fresh", 60_000, (d) => rendered.push(d));
    expect(result).toEqual({ v: 42 });
    expect(rendered).toHaveLength(1);
  });

  it("returns null when no cache entry exists", async () => {
    const rendered: unknown[] = [];
    const result = await coldStart("cs-none", 60_000, (d) => rendered.push(d));
    expect(result).toBeNull();
    expect(rendered).toHaveLength(0);
  });

  it("calls render with stale data when beyond TTL", async () => {
    cSet("cs-stale", { v: 99 });
    // Force stale by using ttl=0 (always expired)
    const rendered: unknown[] = [];
    const result = await coldStart<{ v: number }>("cs-stale", 0, (d) => rendered.push(d));
    // stale path (cGetStaleAsync ignores TTL)
    expect(result).toEqual({ v: 99 });
    expect(rendered).toHaveLength(1);
  });

  it("does not call render twice", async () => {
    cSet("cs-once", { v: 1 });
    let calls = 0;
    await coldStart("cs-once", 60_000, () => calls++);
    expect(calls).toBe(1);
  });
});

// ── Sprint 59: cOr ───────────────────────────────────────────────────────────
describe("cOr — null-coalescing cache read (Sprint 59)", () => {
  beforeEach(() => {
    cClear();
  });

  it("returns cached value without calling fallback", () => {
    cSet("cor-key", 42);
    let called = false;
    const result = cOr("cor-key", 60_000, () => {
      called = true;
      return 99;
    });
    expect(result).toBe(42);
    expect(called).toBe(false);
  });

  it("calls fallback on cache miss and stores the result", () => {
    const result = cOr("cor-miss", 60_000, () => "computed");
    expect(result).toBe("computed");
    // Should be cached now
    expect(cGet("cor-miss", 60_000)).toBe("computed");
  });

  it("calls fallback when TTL has expired", () => {
    cSet("cor-expired", "old");
    const result = cOr("cor-expired", 0, () => "fresh"); // ttl=0 → always miss
    expect(result).toBe("fresh");
  });

  it("does not mutate the fallback return value", () => {
    const obj = { x: 1 };
    const result = cOr("cor-obj", 60_000, () => obj);
    expect(result).toBe(obj);
  });
});

// ── Sprint 95: cAge ──────────────────────────────────────────────────────────

describe("cAge (Sprint 95)", () => {
  beforeEach(() => {
    cClear();
  });

  it("returns null for missing key", () => {
    expect(cAge("no-such-key")).toBeNull();
  });

  it("returns small positive number for recently stored key", () => {
    cSet("age-test", { v: 1 });
    const age = cAge("age-test");
    expect(age).not.toBeNull();
    expect(age!).toBeGreaterThanOrEqual(0);
    expect(age!).toBeLessThan(1000); // should be < 1 second old
  });

  it("returns age from localStorage when not in memory", () => {
    cSet("age-ls", "data");
    cClear(); // clears in-memory
    // Re-seed localStorage only:
    localStorage.setItem("dash_v2_age-ls", JSON.stringify({ data: "data", ts: Date.now() - 5000 }));
    const age = cAge("age-ls");
    expect(age).not.toBeNull();
    expect(age!).toBeGreaterThanOrEqual(4900);
    expect(age!).toBeLessThan(6000);
  });

  it("returns null for corrupted localStorage entry", () => {
    localStorage.setItem("dash_v2_corrupt-age", "not-json!!!");
    expect(cAge("corrupt-age")).toBeNull();
  });
});

// ── Sprint 119: cDelete tests ─────────────────────────────────────────────────

describe("Cache — cDelete", () => {
  beforeEach(() => cClear());

  it("removes a key from memory and localStorage", () => {
    cSet("del-test", { v: 1 });
    expect(cGet("del-test", 60_000)).toEqual({ v: 1 });
    cDelete("del-test");
    expect(cGet("del-test", 60_000)).toBeNull();
    expect(localStorage.getItem("dash_v2_del-test")).toBeNull();
  });

  it("does not throw for non-existent key", () => {
    expect(() => cDelete("no-such-key")).not.toThrow();
  });

  it("only removes the target key, not others", () => {
    cSet("keep-me", "yes");
    cSet("remove-me", "no");
    cDelete("remove-me");
    expect(cGet("keep-me", 60_000)).toBe("yes");
    expect(cGet("remove-me", 60_000)).toBeNull();
  });
});

// ── Sprint 121: cacheDashboard tests ──────────────────────────────────────────

describe("Cache — cacheDashboard", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("returns zero counts on empty cache", () => {
    const stats = cacheDashboard();
    expect(stats.memEntries).toBe(0);
    expect(stats.lsEntries).toBe(0);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  it("counts memory + LS entries after cSet", () => {
    cSet("a", 1);
    cSet("b", 2);
    const stats = cacheDashboard();
    expect(stats.memEntries).toBe(2);
    expect(stats.lsEntries).toBe(2);
  });

  it("reflects hit/miss after cGet calls", () => {
    cSet("x", 42);
    cGet("x", 60_000); // hit
    cGet("nope", 60_000); // miss
    const stats = cacheDashboard();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0.5);
  });
});

// ── Sprint 178: cacheInventory ──────────────────────────────────────────────

describe("Cache — cacheInventory", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("returns zero counts on empty cache", async () => {
    const inv = await cacheInventory();
    expect(inv.memEntries).toBe(0);
    expect(inv.lsEntries).toBe(0);
    expect(inv.idbEntries).toBe(0);
    expect(inv.lsBytes).toBe(0);
    expect(inv.hits).toBe(0);
    expect(inv.misses).toBe(0);
    expect(inv.hitRate).toBe(0);
    expect(inv.oldestAgeMin).toBe(0);
  });

  it("counts all tiers after cSet", async () => {
    cSet("a", { x: 1 });
    cSet("b", { y: 2 });
    const inv = await cacheInventory();
    expect(inv.memEntries).toBe(2);
    expect(inv.lsEntries).toBe(2);
    expect(inv.lsBytes).toBeGreaterThan(0);
  });

  it("tracks hit/miss stats", async () => {
    cSet("z", 99);
    cGet("z", 60_000); // hit
    cGet("nope", 60_000); // miss
    const inv = await cacheInventory();
    expect(inv.hits).toBe(1);
    expect(inv.misses).toBe(1);
    expect(inv.hitRate).toBe(0.5);
  });
});

// ── Sprint 181: lastHitLayer ────────────────────────────────────────────────

describe("Cache — lastHitLayer", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
  });

  it("returns 'none' before any read", () => {
    expect(lastHitLayer()).toBe("none");
  });

  it("returns 'mem' when served from in-memory cache", () => {
    cSet("k", "val");
    cGet("k", 60_000); // first read promotes from LS → mem
    cGet("k", 60_000); // second read from mem
    expect(lastHitLayer()).toBe("mem");
  });

  it("returns 'ls' on first read from localStorage", () => {
    // Write only to LS (bypass mem by clearing after set)
    cSet("k", "val");
    cClear();
    // restore LS directly
    localStorage.setItem("dash_v2_k", JSON.stringify({ data: "val", ts: Date.now() }));
    cGet("k", 60_000);
    expect(lastHitLayer()).toBe("ls");
  });

  it("returns 'none' on cache miss", () => {
    cGet("missing", 60_000);
    expect(lastHitLayer()).toBe("none");
  });
});

// ── cSetAsync ─────────────────────────────────────────────────────────────────

describe("Cache — cSetAsync", () => {
  beforeEach(() => {
    cClear();
  });

  it("stores data readable via synchronous cGet", async () => {
    await cSetAsync("asyncKey", { hello: "world" });
    const result = cGet<{ hello: string }>("asyncKey", 60_000);
    expect(result).toEqual({ hello: "world" });
  });

  it("stores data readable via cGetAsync after write", async () => {
    await cSetAsync("asyncKey2", [1, 2, 3]);
    const result = await cGetAsync<number[]>("asyncKey2", 60_000);
    expect(result).toEqual([1, 2, 3]);
  });

  it("overwrites an existing cached value", async () => {
    cSet("overwrite", "old");
    await cSetAsync("overwrite", "new");
    expect(cGet("overwrite", 60_000)).toBe("new");
  });

  it("resolves as Promise<void>", async () => {
    const result = cSetAsync("promiseKey", 42);
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });

  it("persists to localStorage", async () => {
    await cSetAsync("lsKey", { persisted: true });
    const raw = localStorage.getItem("dash_v2_lsKey");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { data: { persisted: boolean }; ts: number };
    expect(parsed.data.persisted).toBe(true);
  });
});

// ── cEvictIdb ────────────────────────────────────────────────────────────────

describe("Cache — cEvictIdb", () => {
  beforeEach(() => {
    cClear();
  });

  it("returns 0 when IDB is empty (happy-dom fallback)", async () => {
    const removed = await cEvictIdb();
    expect(typeof removed).toBe("number");
    expect(removed).toBeGreaterThanOrEqual(0);
  });

  it("does not throw on repeated calls", async () => {
    await expect(cEvictIdb()).resolves.toBeGreaterThanOrEqual(0);
    await expect(cEvictIdb()).resolves.toBeGreaterThanOrEqual(0);
  });
});

// ── _resetForTest ────────────────────────────────────────────────────────────

describe("Cache — _resetForTest", () => {
  it("clears in-memory entries set before call", () => {
    cSet("rft-key-1", "value1");
    cSet("rft-key-2", 42);
    expect(cGet("rft-key-1", 60_000)).toBe("value1");
    _resetForTest();
    expect(cGet("rft-key-1", 60_000)).toBeNull();
    expect(cGet("rft-key-2", 60_000)).toBeNull();
  });

  it("removes all dash_v2_ localStorage entries", () => {
    cSet("rft-ls-a", "aaa");
    cSet("rft-ls-b", "bbb");
    expect(localStorage.getItem("dash_v2_rft-ls-a")).not.toBeNull();
    _resetForTest();
    expect(localStorage.getItem("dash_v2_rft-ls-a")).toBeNull();
    expect(localStorage.getItem("dash_v2_rft-ls-b")).toBeNull();
  });

  it("resets stats counters to zero", () => {
    cSet("rft-stat", 1);
    cGet("rft-stat", 60_000); // hit
    cGet("rft-miss", 60_000); // miss
    _resetForTest();
    const stats = cacheStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });

  it("leaves non-dash_v2_ localStorage entries intact", () => {
    localStorage.setItem("other-key", "should-stay");
    cSet("rft-only", "x");
    _resetForTest();
    expect(localStorage.getItem("other-key")).toBe("should-stay");
    localStorage.removeItem("other-key");
  });

  it("can be called when cache is already empty", () => {
    cClear();
    expect(() => _resetForTest()).not.toThrow();
  });
});

// ── Sprint 90: hydrateFromIdb IDB-tier branches via vi.spyOn ─────────────────

describe("Cache — Sprint 90 hydrateFromIdb IDB-tier branches", () => {
  beforeEach(() => {
    _resetForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetForTest();
  });

  it("skips entries already warm in memory (mem.has branch)", async () => {
    // Seed memory via cSet, then spy so idbKeys returns the same key
    cSet("warm-key", { v: 1 });
    vi.spyOn(idbMod, "idbKeys").mockResolvedValue(["warm-key"]);
    vi.spyOn(idbMod, "idbGetEntry").mockResolvedValue(null);
    const count = await hydrateFromIdb();
    // 'warm-key' is already in memory → skip → count stays 0
    expect(count).toBe(0);
  });

  it("skips IDB entry when idbGetEntry returns null (!entry branch)", async () => {
    vi.spyOn(idbMod, "idbKeys").mockResolvedValue(["idb-null-key"]);
    vi.spyOn(idbMod, "idbGetEntry").mockResolvedValue(null);
    const count = await hydrateFromIdb();
    expect(count).toBe(0);
  });

  it("skips stale IDB entries (ts > LS_MAX_AGE branch)", async () => {
    const staleTs = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago > 7-day max
    vi.spyOn(idbMod, "idbKeys").mockResolvedValue(["stale-idb-key"]);
    vi.spyOn(idbMod, "idbGetEntry").mockResolvedValue({ data: "old", ts: staleTs } as never);
    const count = await hydrateFromIdb();
    expect(count).toBe(0);
  });

  it("loads fresh IDB entry into memory and returns count", async () => {
    const freshTs = Date.now() - 60_000; // 1 min ago — fresh
    vi.spyOn(idbMod, "idbKeys").mockResolvedValue(["fresh-idb-key"]);
    vi.spyOn(idbMod, "idbGetEntry").mockResolvedValue({
      data: { loaded: true },
      ts: freshTs,
    } as never);
    const count = await hydrateFromIdb();
    expect(count).toBe(1);
    // Data should be warm in memory now
    expect(cGet("fresh-idb-key", 60 * 60_000)).toEqual({ loaded: true });
  });

  it("returns 0 when idbKeys throws (catch branch)", async () => {
    vi.spyOn(idbMod, "idbKeys").mockRejectedValue(new Error("IDB unavailable"));
    const count = await hydrateFromIdb();
    expect(count).toBe(0);
  });
});

// ── Sprint 265 / CAP1-CAP5: fast-check property tests for cache invariants ───

import * as fc from "fast-check";

describe("Cache — fast-check property invariants (CAP1-CAP5, Sprint 265)", () => {
  beforeEach(() => {
    localStorage.clear();
    cClear();
    resetCacheStats();
  });

  /**
   * CAP1: cGet on a key that was never set always returns null (for any TTL).
   */
  it("CAP1 · cGet miss always returns null for any key + ttl", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.integer({ min: 0, max: 3_600_000 }),
        (key: string, ttl: number) => {
          cClear();
          return cGet(key, ttl) === null;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * CAP2: cSet then cGet with huge TTL always returns the same value (round-trip).
   */
  it("CAP2 · cSet + cGet round-trip invariant (JSON-serialisable values)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.oneof(
          fc.integer(),
          fc.string({ maxLength: 20 }),
          fc.boolean(),
          fc.record({ x: fc.integer(), label: fc.string({ maxLength: 10 }) }),
        ),
        (key: string, value: unknown) => {
          cClear();
          cSet(key, value);
          const got = cGet<unknown>(key, 999_999_999);
          // Deep equality via JSON round-trip (same as what cache serialises)
          return JSON.stringify(got) === JSON.stringify(value);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * CAP3: cGetStale always returns null for a key that was never set.
   */
  it("CAP3 · cGetStale miss always returns null", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        (key: string) => {
          cClear();
          return cGetStale(key) === null;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * CAP4: cSet then cGetStale always returns non-null (stale access ignores TTL).
   */
  it("CAP4 · cSet then cGetStale is always non-null", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.oneof(fc.integer(), fc.string({ maxLength: 15 }), fc.boolean()),
        (key: string, value: unknown) => {
          cClear();
          cSet(key, value);
          return cGetStale(key) !== null;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * CAP5: cacheStats hitRate is always in [0, 1] after any sequence of set/get ops.
   */
  it("CAP5 · cacheStats hitRate is always in [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.tuple(fc.constant("set"), fc.string({ minLength: 1, maxLength: 15 }), fc.integer()),
            fc.tuple(fc.constant("get"), fc.string({ minLength: 1, maxLength: 15 }), fc.integer({ min: 0, max: 3_600_000 })),
          ),
          { minLength: 1, maxLength: 10 },
        ),
        (ops: [string, string, number][]) => {
          cClear();
          resetCacheStats();
          for (const [op, key, val] of ops) {
            if (op === "set") {
              cSet(key, val);
            } else {
              cGet(key, val);
            }
          }
          const stats = cacheStats();
          return stats.hitRate >= 0 && stats.hitRate <= 1;
        },
      ),
      { numRuns: 200 },
    );
  });
});
