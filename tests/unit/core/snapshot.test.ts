/**
 * Tests for src/core/snapshot.ts (Sprint 201 / X8)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildSnapshot } from "@/core/snapshot";

describe("buildSnapshot (Sprint 201 / X8)", () => {
  beforeEach(() => {
    vi.stubGlobal("__APP_VERSION__", "13.22.0");
    vi.stubGlobal("__BUILD_TIME__", "2025-01-01T00:00:00.000Z");
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("returns a snapshot object with expected shape", () => {
    const snap = buildSnapshot();
    expect(snap).toHaveProperty("version");
    expect(snap).toHaveProperty("timestamp");
    expect(snap).toHaveProperty("userAgent");
    expect(snap).toHaveProperty("config");
    expect(snap).toHaveProperty("localStorageSummary");
    expect(snap).toHaveProperty("diagLog");
  });

  it("timestamp is a valid ISO 8601 string", () => {
    const snap = buildSnapshot();
    const d = new Date(snap.timestamp);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it("localStorageSummary only contains dash/fdb prefixed keys", () => {
    localStorage.setItem("dash_v2_config", '{"theme":"black"}');
    localStorage.setItem("fdb_test_key", "val");
    localStorage.setItem("other_key", "should be excluded");
    const snap = buildSnapshot();
    expect(Object.keys(snap.localStorageSummary)).toContain("dash_v2_config");
    expect(Object.keys(snap.localStorageSummary)).toContain("fdb_test_key");
    expect(Object.keys(snap.localStorageSummary)).not.toContain("other_key");
  });

  it("truncates localStorage values longer than 300 chars", () => {
    const longVal = "x".repeat(500);
    localStorage.setItem("dash_v2_long", longVal);
    const snap = buildSnapshot();
    const val = snap.localStorageSummary["dash_v2_long"];
    expect(val).not.toBeNull();
    expect((val ?? "").length).toBeLessThan(400);
  });

  it("diagLog is an array of strings", () => {
    const snap = buildSnapshot();
    expect(Array.isArray(snap.diagLog)).toBe(true);
  });
});
