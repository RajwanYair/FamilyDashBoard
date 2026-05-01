/**
 * Sprint 335 / D12: module-boundary lint script tests.
 *
 * Asserts that the baseline set is honoured and the script exits 0
 * against the current tree. Catches accidental new violations slipping
 * in unnoticed when developers add cross-layer imports.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(process.cwd(), "scripts/check-module-boundaries.mjs");

describe("check-module-boundaries (Sprint 335 / D12)", () => {
  it("exits 0 against the current src/ tree (baseline grandfathered)", () => {
    const out = execFileSync(process.execPath, [SCRIPT], { encoding: "utf-8" });
    expect(out).toMatch(/Module boundaries clean/);
    expect(out).toMatch(/grandfathered/);
  });
});
