/**
 * Config diff utility tests
 */
import { describe, it, expect } from "vitest";
import { diffConfigs } from "@/core/config";
import { DEFAULT_CONFIG } from "@/types/config";

describe("diffConfigs ", () => {
  it("returns empty array for identical configs", () => {
    const a = { ...DEFAULT_CONFIG };
    const b = { ...DEFAULT_CONFIG };
    expect(diffConfigs(a, b)).toEqual([]);
  });

  it("detects changed scalar field", () => {
    const a = { ...DEFAULT_CONFIG, theme: "black" as const };
    const b = { ...DEFAULT_CONFIG, theme: "blue" as const };
    const diffs = diffConfigs(a, b);
    expect(diffs.length).toBe(1);
    expect(diffs[0].key).toBe("theme");
    expect(diffs[0].oldValue).toBe("black");
    expect(diffs[0].newValue).toBe("blue");
  });

  it("detects multiple changes", () => {
    const a = { ...DEFAULT_CONFIG };
    const b = { ...DEFAULT_CONFIG, theme: "matrix" as const, fontScale: 1.5 };
    const diffs = diffConfigs(a, b);
    expect(diffs.length).toBe(2);
    expect(diffs.map((d) => d.key).sort()).toEqual(["fontScale", "theme"]);
  });

  it("detects array changes", () => {
    const a = { ...DEFAULT_CONFIG, hiddenCards: [] as string[] };
    const b = { ...DEFAULT_CONFIG, hiddenCards: ["news"] };
    const diffs = diffConfigs(a, b);
    expect(diffs.some((d) => d.key === "hiddenCards")).toBe(true);
  });

  it("detects nested object changes", () => {
    const a = {
      ...DEFAULT_CONFIG,
      featureFlags: { workerFetch: true, idleSchedule: true, idbCache: false },
    };
    const b = {
      ...DEFAULT_CONFIG,
      featureFlags: { workerFetch: false, idleSchedule: true, idbCache: false },
    };
    const diffs = diffConfigs(a, b);
    expect(diffs.some((d) => d.key === "featureFlags")).toBe(true);
  });
});
