/**
 * Tests for worker/src/middleware/canary.ts (V12-EDGE-4b, Sprint 32).
 */
import { describe, it, expect, vi } from "vitest";
import { shouldTagCanary, applyCanaryHeader } from "../../../worker/src/middleware/canary";

// ── shouldTagCanary ──────────────────────────────────────────────────────────

describe("shouldTagCanary", () => {
  it("returns false when canaryPct is undefined", () => {
    expect(shouldTagCanary(undefined)).toBe(false);
  });

  it("returns false when canaryPct is empty string", () => {
    expect(shouldTagCanary("")).toBe(false);
  });

  it("returns false when canaryPct is '0'", () => {
    expect(shouldTagCanary("0")).toBe(false);
  });

  it("returns false when canaryPct is negative", () => {
    expect(shouldTagCanary("-5")).toBe(false);
  });

  it("returns false when canaryPct is not a number", () => {
    expect(shouldTagCanary("abc")).toBe(false);
  });

  it("returns true when canaryPct is '100'", () => {
    expect(shouldTagCanary("100")).toBe(true);
  });

  it("returns true when canaryPct is '200' (above 100)", () => {
    expect(shouldTagCanary("200")).toBe(true);
  });

  it("returns true for most requests when canaryPct is '99'", () => {
    // With pct=99 and 1000 trials, almost all should be tagged (expect > 900)
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldTagCanary("99")) trueCount++;
    }
    expect(trueCount).toBeGreaterThan(900);
  });

  it("returns false for most requests when canaryPct is '1'", () => {
    // With pct=1 and 1000 trials, most should be untagged (expect < 100)
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (shouldTagCanary("1")) trueCount++;
    }
    expect(trueCount).toBeLessThan(100);
  });

  it("uses Math.random for sampling", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.05);
    // 0.05 * 100 = 5 < 10 → true
    expect(shouldTagCanary("10")).toBe(true);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.95);
    // 0.95 * 100 = 95 > 10 → false
    expect(shouldTagCanary("10")).toBe(false);
    vi.restoreAllMocks();
  });
});

// ── applyCanaryHeader ────────────────────────────────────────────────────────

describe("applyCanaryHeader", () => {
  it("sets X-Canary: true when canaryPct is 100", () => {
    const res = new Response("ok", { status: 200 });
    applyCanaryHeader(res, "100");
    expect(res.headers.get("X-Canary")).toBe("true");
  });

  it("does not set X-Canary when canaryPct is 0", () => {
    const res = new Response("ok", { status: 200 });
    applyCanaryHeader(res, "0");
    expect(res.headers.get("X-Canary")).toBeNull();
  });

  it("does not set X-Canary when canaryPct is undefined", () => {
    const res = new Response("ok", { status: 200 });
    applyCanaryHeader(res, undefined);
    expect(res.headers.get("X-Canary")).toBeNull();
  });

  it("does not throw when headers are immutable (simulated)", () => {
    const res = new Response("ok", { status: 200 });
    vi.spyOn(res.headers, "set").mockImplementationOnce(() => {
      throw new TypeError("immutable");
    });
    vi.spyOn(Math, "random").mockReturnValueOnce(0); // ensures shouldTagCanary = true for pct=50
    expect(() => applyCanaryHeader(res, "50")).not.toThrow();
    vi.restoreAllMocks();
  });
});
