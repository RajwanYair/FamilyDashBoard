/**
 * Tests for src/core/cache.ts — Dual-layer cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cGet, cSet, cGetStale, cEvict, cClear, getOldestCacheAgeMinutes, cacheStats, resetCacheStats } from "@/core/cache";

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
  beforeEach(() => { cClear(); });
  afterEach(() => { cClear(); });

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
  beforeEach(() => { cClear(); });
  afterEach(() => { cClear(); });

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
  afterEach(() => { cClear(); vi.restoreAllMocks(); });

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

  it("removes localStorage entry older than 7 days", () => {
    const oldTs = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
    localStorage.setItem(
      "dash_v2_evict-old",
      JSON.stringify({ data: "old", ts: oldTs }),
    );
    cEvict();
    expect(localStorage.getItem("dash_v2_evict-old")).toBeNull();
  });

  it("removes corrupt localStorage entry during eviction", () => {
    localStorage.setItem("dash_v2_corrupt-evict", "{{bad}}");
    cEvict();
    expect(localStorage.getItem("dash_v2_corrupt-evict")).toBeNull();
  });

  it("keeps fresh localStorage entry (< 7 days)", () => {
    const freshTs = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago
    localStorage.setItem(
      "dash_v2_fresh-entry",
      JSON.stringify({ data: "fresh", ts: freshTs }),
    );
    cEvict();
    expect(localStorage.getItem("dash_v2_fresh-entry")).not.toBeNull();
    localStorage.removeItem("dash_v2_fresh-entry");
  });

  it("skips non-prefixed keys during eviction", () => {
    // Non-dash_v2_ key should be ignored (line 25: !k?.startsWith(LS_PREFIX) continue)
    localStorage.setItem("other_app_key", "some-value");
    const oldTs = Date.now() - 10 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      "dash_v2_stale",
      JSON.stringify({ data: "x", ts: oldTs }),
    );
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
    localStorage.setItem(
      "dash_v2_cached",
      JSON.stringify({ data: "a", ts: Date.now() }),
    );
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
