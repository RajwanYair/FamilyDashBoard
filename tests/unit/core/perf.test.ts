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
  markDomReady,
  markStartupComplete,
  checkPerfBudget,
  checkAllVitalBudgets,
  VITAL_BUDGETS,
  recordCardInitTime,
  getCardTimings,
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
    it("needs-improvement ≤ 4000ms", () =>
      expect(rateVital("lcp", 3000)).toBe("needs-improvement"));
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
    it("needs-improvement ≤ 3000ms", () =>
      expect(rateVital("fcp", 2000)).toBe("needs-improvement"));
    it("poor > 3000ms", () => expect(rateVital("fcp", 4000)).toBe("poor"));
  });

  describe("TTFB", () => {
    it("good ≤ 800ms", () => expect(rateVital("ttfb", 500)).toBe("good"));
    it("needs-improvement ≤ 1800ms", () =>
      expect(rateVital("ttfb", 1000)).toBe("needs-improvement"));
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

// ── Sprint 40 (v7.13): checkPerfBudget ────────────────────────────────────────

describe("checkPerfBudget (Sprint 40)", () => {
  it("returns pending when startup has not been recorded", () => {
    const result = checkPerfBudget(3000);
    expect(result.status).toBe("pending");
    expect(result.measuredMs).toBeNull();
    expect(result.limitMs).toBe(3000);
  });

  it("returns pass when startup is within budget", () => {
    markDomReady();
    markStartupComplete();
    const startup = getPerfVitals().startup;
    if (startup !== null) {
      const result = checkPerfBudget(startup + 1000); // budget = measured + 1s → always pass
      expect(result.status).toBe("pass");
      expect(result.measuredMs).toBe(startup);
    }
  });

  it("returns fail when startup exceeds budget", () => {
    markDomReady();
    markStartupComplete();
    const startup = getPerfVitals().startup;
    if (startup !== null) {
      // Set budget to 0 → always fail
      const result = checkPerfBudget(0);
      expect(result.status).toBe("fail");
    }
  });

  it("uses default 3000ms budget when no argument is passed", () => {
    const result = checkPerfBudget();
    expect(result.limitMs).toBe(3000);
  });

  it("returns correct limitMs", () => {
    const result = checkPerfBudget(5000);
    expect(result.limitMs).toBe(5000);
  });
});

// ── Sprint 124: checkAllVitalBudgets tests ────────────────────────────────────

describe("checkAllVitalBudgets", () => {
  it("returns pending for all vitals on fresh state", () => {
    const results = checkAllVitalBudgets();
    expect(results.length).toBe(6); // lcp, cls, inp, fcp, ttfb, startup
    for (const r of results) {
      expect(r.status).toBe("pending");
    }
  });

  it("VITAL_BUDGETS has expected default keys", () => {
    expect(VITAL_BUDGETS.lcp).toBe(2500);
    expect(VITAL_BUDGETS.cls).toBe(0.1);
    expect(VITAL_BUDGETS.inp).toBe(200);
  });

  it("marks startup as pass when within budget", () => {
    markDomReady();
    markStartupComplete();
    const results = checkAllVitalBudgets({ startup: 99999 });
    const entry = results.find((r) => r.key === "startup");
    expect(entry?.status).toBe("pass");
  });

  it("marks startup as fail when startup exceeds budget", () => {
    markDomReady();
    markStartupComplete();
    const results = checkAllVitalBudgets({ startup: 0 }); // budget=0 → always fail
    const entry = results.find((r) => r.key === "startup");
    expect(entry?.status).toBe("fail");
    expect(entry?.measured).not.toBeNull();
  });

  it("VITAL_BUDGETS has fcp and ttfb and startup defaults", () => {
    expect(VITAL_BUDGETS.fcp).toBe(1800);
    expect(VITAL_BUDGETS.ttfb).toBe(800);
    expect(VITAL_BUDGETS.startup).toBe(3000);
  });
});

// ── rateVital — startup key (Sprint 120) ─────────────────────────────────────

describe("rateVital — startup key", () => {
  it("good ≤ 3000ms", () => expect(rateVital("startup", 2000)).toBe("good"));
  it("good at exactly 3000ms", () => expect(rateVital("startup", 3000)).toBe("good"));
  it("needs-improvement ≤ 6000ms", () => expect(rateVital("startup", 4000)).toBe("needs-improvement"));
  it("poor > 6000ms", () => expect(rateVital("startup", 7000)).toBe("poor"));
});

// ── markStartupComplete — idempotency (Sprint 120) ────────────────────────────

describe("markStartupComplete — idempotency", () => {
  it("does not overwrite startup if already measured", () => {
    markDomReady();
    markStartupComplete();
    const first = getPerfVitals().startup;
    markStartupComplete(); // second call — must be a no-op
    expect(getPerfVitals().startup).toBe(first);
  });
});

// ── recordCardInitTime + getCardTimings (Sprint 120) ─────────────────────────

describe("recordCardInitTime + getCardTimings", () => {
  it("records a card timing and retrieves it", () => {
    recordCardInitTime("weather", 123.456);
    expect(getCardTimings().get("weather")).toBe(123.46);
  });

  it("rounds duration to 2 decimal places", () => {
    recordCardInitTime("news", 99.999);
    expect(getCardTimings().get("news")).toBe(100);
  });

  it("overwrites an existing timing for the same card", () => {
    recordCardInitTime("clock", 50.0);
    recordCardInitTime("clock", 75.555);
    expect(getCardTimings().get("clock")).toBe(75.56);
  });
});
