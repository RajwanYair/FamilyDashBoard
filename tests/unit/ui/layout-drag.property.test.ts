/**
 * fast-check property tests — src/ui/layout-drag.ts
 *
 * Properties under test:
 *  LD1. readCurrentLayout: always returns a 3-tuple of string arrays
 *  LD2. readCurrentLayout: returns empty arrays when no grid columns exist
 *  LD3. resetLayout: does not throw
 */

import { describe, it, expect } from "vitest";
import { readCurrentLayout, resetLayout } from "@/ui/layout-drag";

// ── LD1: readCurrentLayout returns 3-tuple of arrays ─────────────────────────

describe("layout-drag — LD1: readCurrentLayout shape", () => {
  it("returns a tuple of exactly 3 arrays", () => {
    const result = readCurrentLayout();
    expect(result).toHaveLength(3);
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
    expect(Array.isArray(result[2])).toBe(true);
  });
});

// ── LD2: readCurrentLayout empty when no columns ─────────────────────────────

describe("layout-drag — LD2: readCurrentLayout empty DOM", () => {
  it("returns three empty arrays when no grid columns exist", () => {
    const [left, mid, right] = readCurrentLayout();
    expect(left).toEqual([]);
    expect(mid).toEqual([]);
    expect(right).toEqual([]);
  });
});

// ── LD3: resetLayout does not throw ──────────────────────────────────────────

describe("layout-drag — LD3: resetLayout safe", () => {
  it("does not throw when called", () => {
    expect(() => resetLayout()).not.toThrow();
  });
});
