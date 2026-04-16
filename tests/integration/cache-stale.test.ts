/**
 * Integration: Cache cGet + cSet + cGetStale
 *
 * Tests the dual-layer cache (in-memory Map + localStorage) for:
 * - Fresh hit: cGet returns data within TTL
 * - Cold miss: cGet returns null when nothing stored
 * - Stale hit: cGetStale returns data even after TTL expires
 * - Eviction: cGet returns null after TTL expires in memory
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { cGet, cSet, cGetStale } from "@/core/cache";

const KEY = "integ:test:data";
const DATA = { value: 42, name: "test" };

describe("Cache — cSet + cGet + cGetStale round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cGet returns data immediately after cSet", () => {
    cSet(KEY, DATA);
    const result = cGet<typeof DATA>(KEY, 60_000);
    expect(result).toEqual(DATA);
  });

  it("cGet returns null for unknown key", () => {
    const result = cGet("integ:ghost:key", 60_000);
    expect(result).toBeNull();
  });

  it("cGet returns null after TTL expires", () => {
    cSet(KEY, DATA);
    vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes
    const result = cGet<typeof DATA>(KEY, 60 * 60 * 1000); // 60 min TTL
    expect(result).toBeNull();
  });

  it("cGetStale returns data even after TTL expires", () => {
    cSet(KEY, DATA);
    vi.advanceTimersByTime(61 * 60 * 1000); // 61 minutes — beyond TTL
    const stale = cGetStale<typeof DATA>(KEY);
    expect(stale).toEqual(DATA);
  });

  it("cSet overwrites existing data", () => {
    cSet(KEY, { value: 1 });
    cSet(KEY, { value: 2 });
    const result = cGet<{ value: number }>(KEY, 60_000);
    expect(result?.value).toBe(2);
  });

  it("cGet respects TTL in milliseconds", () => {
    cSet(KEY, DATA);
    vi.advanceTimersByTime(29 * 60 * 1000); // 29 min — still fresh
    const result = cGet<typeof DATA>(KEY, 30 * 60 * 1000); // 30 min TTL
    expect(result).toEqual(DATA);

    vi.advanceTimersByTime(2 * 60 * 1000); // now 31 min total — expired
    const expired = cGet<typeof DATA>(KEY, 30 * 60 * 1000);
    expect(expired).toBeNull();
  });
});
