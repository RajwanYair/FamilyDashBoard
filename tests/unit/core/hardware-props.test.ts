/**
 * fast-check property tests for src/core/hardware.ts 
 *
 * Verifies invariants of `getHardwareProfile()` over arbitrary
 * navigator.hardwareConcurrency × navigator.deviceMemory inputs.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import {
  _resetHardwareProfile,
  getHardwareProfile,
  getOptimalConcurrency,
  type HardwareTier,
} from "@/core/hardware";

function mockNav(cores: number, memGB: number): void {
  vi.stubGlobal("navigator", {
    hardwareConcurrency: cores,
    deviceMemory: memGB,
  });
}

const TIER_VALUES: readonly HardwareTier[] = ["high", "mid", "low"];

describe("hardware — fast-check properties (HWP1-HWP4 )", () => {
  beforeEach(() => {
    _resetHardwareProfile();
  });

  it("HWP1: profile.cpuCores and memoryGB always echo the navigator values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 64 }),
        fc.integer({ min: 1, max: 32 }),
        (cores, mem) => {
          _resetHardwareProfile();
          mockNav(cores, mem);
          const p = getHardwareProfile();
          expect(p.cpuCores).toBe(cores);
          expect(p.memoryGB).toBe(mem);
          expect(TIER_VALUES).toContain(p.tier);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("HWP2: optimalConcurrency is bounded to [2, 8] and equals max(2, min(8, floor(cores * 0.6)))", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 64 }), (cores) => {
        _resetHardwareProfile();
        mockNav(cores, 8);
        const c = getOptimalConcurrency();
        expect(c).toBeGreaterThanOrEqual(2);
        expect(c).toBeLessThanOrEqual(8);
        expect(c).toBe(Math.max(2, Math.min(8, Math.floor(cores * 0.6))));
      }),
      { numRuns: 30 },
    );
  });

  it("HWP3: tier is monotonic in score — at fixed mid GPU, more cores+ram never produces a LOWER tier", () => {
    // We test against a strictly larger config: doubling cores+ram should not
    // downgrade the tier. (`mid` GPU contributes +1 in both cases.)
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 16 }),
        fc.integer({ min: 1, max: 16 }),
        (cores, mem) => {
          const order: Record<HardwareTier, number> = { low: 0, mid: 1, high: 2 };
          _resetHardwareProfile();
          mockNav(cores, mem);
          const lo = getHardwareProfile().tier;
          _resetHardwareProfile();
          mockNav(Math.min(64, cores * 2), Math.min(32, mem * 2));
          const hi = getHardwareProfile().tier;
          expect(order[hi]).toBeGreaterThanOrEqual(order[lo]);
        },
      ),
      { numRuns: 25 },
    );
  });

  it("HWP4: profile is cached across calls within the same session (object identity)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 32 }),
        fc.integer({ min: 1, max: 16 }),
        (cores, mem) => {
          _resetHardwareProfile();
          mockNav(cores, mem);
          const a = getHardwareProfile();
          const b = getHardwareProfile();
          // Returned object is a reference to the cached profile (===)
          expect(a).toBe(b);
        },
      ),
      { numRuns: 15 },
    );
  });
});
