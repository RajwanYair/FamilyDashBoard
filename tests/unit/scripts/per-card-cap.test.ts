/**
 * Sprint 351 / D13: per-card source hard-cap regression tests.
 *
 * Asserts the hard-cap and warn-cap constants in
 * `scripts/check-bundle-size.mjs` stay aligned with the ratchet plan
 * documented in ADR-057. Catches accidental loosening of the budget.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = resolve(process.cwd(), "scripts/check-bundle-size.mjs");

describe("check-bundle-size per-card cap (Sprint 351 / D13)", () => {
  const text = readFileSync(SCRIPT, "utf-8");

  it("hard-cap is at most 80 KB (ratchet only down, never up)", () => {
    const m = text.match(/PER_CARD_HARD_CAP_KB\s*=\s*(\d+)/);
    expect(m).not.toBeNull();
    const hard = Number(m![1]);
    expect(hard).toBeLessThanOrEqual(80);
    expect(hard).toBeGreaterThan(0);
  });

  it("warn-cap is at most 50 KB and below hard-cap", () => {
    const hard = Number(text.match(/PER_CARD_HARD_CAP_KB\s*=\s*(\d+)/)![1]);
    const warn = Number(text.match(/PER_CARD_WARN_KB\s*=\s*(\d+)/)![1]);
    expect(warn).toBeLessThanOrEqual(50);
    expect(warn).toBeLessThan(hard);
  });

  it("script exits 1 on hard-cap breach (process.exit(1) present)", () => {
    expect(text).toMatch(/perCardCapOk[\s\S]*process\.exit\(1\)/);
  });
});
