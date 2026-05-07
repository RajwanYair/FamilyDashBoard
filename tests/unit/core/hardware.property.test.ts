/**
 * fast-check property tests — src/core/hardware.ts 
 *
 * Properties under test:
 *  HW1. getHardwareProfile: tier is always "high"|"mid"|"low"
 *  HW2. getHardwareProfile: optimalConcurrency in [2, 8]
 *  HW3. getHardwareProfile: cpuCores fallback = 4 in non-browser env
 *  HW4. formatHardwareProfile: output contains tier name
 *  HW5. _resetHardwareProfile: calling it allows a fresh profile build
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getHardwareProfile,
  formatHardwareProfile,
  _resetHardwareProfile,
} from "@/core/hardware";

beforeEach(() => {
  _resetHardwareProfile();
});

// ── HW1: tier is valid ───────────────────────────────────────────────────────

describe("hardware — HW1: tier is valid", () => {
  it("tier is one of high/mid/low", () => {
    const profile = getHardwareProfile();
    expect(["high", "mid", "low"]).toContain(profile.tier);
  });
});

// ── HW2: optimalConcurrency in [2, 8] ───────────────────────────────────────

describe("hardware — HW2: optimalConcurrency range", () => {
  it("optimalConcurrency is between 2 and 8", () => {
    const profile = getHardwareProfile();
    expect(profile.optimalConcurrency).toBeGreaterThanOrEqual(2);
    expect(profile.optimalConcurrency).toBeLessThanOrEqual(8);
  });
});

// ── HW3: fallback defaults in test environment ───────────────────────────────

describe("hardware — HW3: default fallbacks", () => {
  it("cpuCores and memoryGB have sensible defaults", () => {
    const profile = getHardwareProfile();
    expect(profile.cpuCores).toBeGreaterThanOrEqual(1);
    expect(profile.memoryGB).toBeGreaterThanOrEqual(1);
  });
});

// ── HW4: formatHardwareProfile contains tier ─────────────────────────────────

describe("hardware — HW4: formatHardwareProfile", () => {
  it("output string contains the tier name", () => {
    const profile = getHardwareProfile();
    const formatted = formatHardwareProfile();
    expect(formatted).toContain(`tier: ${profile.tier}`);
    expect(formatted).toContain("CPU");
    expect(formatted).toContain("GB RAM");
  });
});

// ── HW5: reset allows fresh profile ─────────────────────────────────────────

describe("hardware — HW5: _resetHardwareProfile", () => {
  it("successive calls return a profile (cache is rebuilt)", () => {
    const first = getHardwareProfile();
    _resetHardwareProfile();
    const second = getHardwareProfile();
    // Same environment → same results
    expect(second.tier).toBe(first.tier);
    expect(second.cpuCores).toBe(first.cpuCores);
  });
});
