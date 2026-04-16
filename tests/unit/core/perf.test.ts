/**
 * Tests for src/core/perf.ts
 * Sprint 41 — Web Vitals in diagnostics overlay
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getPerfVitals,
  formatVital,
  rateVital,
  hasPerfSupport,
  initPerfObserver,
  _resetPerfObserver,
} from "@/core/perf";

beforeEach(() => {
  _resetPerfObserver();
});

describe("getPerfVitals", () => {
  it("returns all null on initial state", () => {
    const v = getPerfVitals();
    expect(v.lcp).toBeNull();
    expect(v.cls).toBeNull();
    expect(v.inp).toBeNull();
    expect(v.fcp).toBeNull();
    expect(v.ttfb).toBeNull();
  });

  it("returns a copy (mutations do not affect internal state)", () => {
    const v = getPerfVitals();
    v.lcp = 9999;
    expect(getPerfVitals().lcp).toBeNull();
  });
});

describe("hasPerfSupport", () => {
  it("returns a boolean", () => {
    expect(typeof hasPerfSupport()).toBe("boolean");
  });
});

describe("formatVital", () => {
  it("shows – for null", () => {
    expect(formatVital("lcp", null)).toBe("–");
    expect(formatVital("cls", null)).toBe("–");
  });

  it("formats LCP/FCP/INP/TTFB in ms", () => {
    expect(formatVital("lcp", 1500)).toBe("1500 ms");
    expect(formatVital("fcp", 800)).toBe("800 ms");
    expect(formatVital("inp", 200)).toBe("200 ms");
    expect(formatVital("ttfb", 100)).toBe("100 ms");
  });

  it("formats CLS to 3 decimal places", () => {
    expect(formatVital("cls", 0.123)).toBe("0.123");
    expect(formatVital("cls", 0.1)).toBe("0.100");
  });

  it("rounds fractional ms", () => {
    expect(formatVital("lcp", 1500.7)).toBe("1501 ms");
  });
});

describe("rateVital", () => {
  it("returns unknown for null", () => {
    expect(rateVital("lcp", null)).toBe("unknown");
  });

  describe("LCP", () => {
    it("good ≤ 2500ms", () => expect(rateVital("lcp", 2500)).toBe("good"));
    it("needs-improvement ≤ 4000ms", () => expect(rateVital("lcp", 3000)).toBe("needs-improvement"));
    it("poor > 4000ms", () => expect(rateVital("lcp", 5000)).toBe("poor"));
  });

  describe("CLS", () => {
    it("good ≤ 0.1", () => expect(rateVital("cls", 0.05)).toBe("good"));
    it("needs-improvement ≤ 0.25", () => expect(rateVital("cls", 0.15)).toBe("needs-improvement"));
    it("poor > 0.25", () => expect(rateVital("cls", 0.3)).toBe("poor"));
  });

  describe("INP", () => {
    it("good ≤ 200ms", () => expect(rateVital("inp", 150)).toBe("good"));
    it("needs-improvement ≤ 500ms", () => expect(rateVital("inp", 300)).toBe("needs-improvement"));
    it("poor > 500ms", () => expect(rateVital("inp", 600)).toBe("poor"));
  });

  describe("FCP", () => {
    it("good ≤ 1800ms", () => expect(rateVital("fcp", 1000)).toBe("good"));
    it("needs-improvement ≤ 3000ms", () => expect(rateVital("fcp", 2000)).toBe("needs-improvement"));
    it("poor > 3000ms", () => expect(rateVital("fcp", 4000)).toBe("poor"));
  });

  describe("TTFB", () => {
    it("good ≤ 800ms", () => expect(rateVital("ttfb", 500)).toBe("good"));
    it("needs-improvement ≤ 1800ms", () => expect(rateVital("ttfb", 1000)).toBe("needs-improvement"));
    it("poor > 1800ms", () => expect(rateVital("ttfb", 2000)).toBe("poor"));
  });
});

describe("initPerfObserver", () => {
  it("is idempotent — safe to call twice", () => {
    // Should not throw in happy-dom (may not support PerformanceObserver)
    expect(() => {
      initPerfObserver();
      initPerfObserver();
    }).not.toThrow();
  });
});
