/**
 * LS key audit tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { auditLocalStorageKeys, removeOrphanedLsKeys } from "@/core/config";

describe("auditLocalStorageKeys ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty result for empty localStorage", () => {
    const result = auditLocalStorageKeys();
    expect(result.total).toBe(0);
    expect(result.known).toEqual([]);
    expect(result.orphaned).toEqual([]);
  });

  it("identifies known dash_v2_ keys", () => {
    localStorage.setItem("dash_v2_config", "{}");
    localStorage.setItem("dash_v2_news", "[]");
    const result = auditLocalStorageKeys();
    expect(result.known.length).toBe(2);
    expect(result.orphaned.length).toBe(0);
  });

  it("identifies known non-prefixed keys", () => {
    localStorage.setItem("dash_theme", "blue");
    localStorage.setItem("dash_bookmarks", "{}");
    const result = auditLocalStorageKeys();
    expect(result.known.length).toBe(2);
  });

  it("identifies orphaned keys", () => {
    localStorage.setItem("dash_v2_config", "{}");
    localStorage.setItem("some_other_app_key", "data");
    localStorage.setItem("random", "value");
    const result = auditLocalStorageKeys();
    expect(result.known.length).toBe(1);
    expect(result.orphaned.length).toBe(2);
  });
});

describe("removeOrphanedLsKeys ", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes orphaned keys and returns count", () => {
    localStorage.setItem("dash_v2_config", "{}");
    localStorage.setItem("foreign_key", "data");
    localStorage.setItem("another_unknown", "x");
    const count = removeOrphanedLsKeys();
    expect(count).toBe(2);
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem("dash_v2_config")).toBe("{}");
  });

  it("returns 0 when nothing to remove", () => {
    localStorage.setItem("dash_v2_config", "{}");
    expect(removeOrphanedLsKeys()).toBe(0);
  });
});
