/**
 * Tests for src/core/cache.ts — Dual-layer cache
 */

import { describe, it, expect, beforeEach } from "vitest";
import { cGet, cSet, cGetStale, cEvict, cClear } from "@/core/cache";

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
