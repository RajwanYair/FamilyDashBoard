/**
 * fast-check property tests for src/core/error-tracker.ts
 */
import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import {
  clearErrors,
  formatErrorEntry,
  getErrorCount,
  getErrors,
  getErrorTrend,
  recordError,
  sampleErrorTrend,
  _resetTrend,
} from "@/core/error-tracker";

describe("error-tracker — fast-check properties (ETP1-ETP5 )", () => {
  beforeEach(() => {
    clearErrors();
    _resetTrend();
  });

  it("ETP1: error buffer never exceeds capacity (20) regardless of insert count", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 60 }), (msgs) => {
        clearErrors();
        for (const m of msgs) recordError(m);
        expect(getErrorCount()).toBeLessThanOrEqual(20);
        expect(getErrorCount()).toBe(Math.min(msgs.length, 20));
      }),
      { numRuns: 30 },
    );
  });

  it("ETP2: when more than 20 errors are recorded, getErrors returns the LAST 20 in arrival order", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 21, maxLength: 50 }),
        (msgs) => {
          clearErrors();
          for (const m of msgs) recordError(m);
          const stored = getErrors().map((e) => e.message);
          expect(stored).toEqual(msgs.slice(-20));
        },
      ),
      { numRuns: 20 },
    );
  });

  it("ETP3: clearErrors resets count to 0 and getErrors returns []", () => {
    fc.assert(
      fc.property(fc.array(fc.string(), { maxLength: 30 }), (msgs) => {
        clearErrors();
        for (const m of msgs) recordError(m);
        clearErrors();
        expect(getErrorCount()).toBe(0);
        expect(getErrors()).toEqual([]);
      }),
      { numRuns: 20 },
    );
  });

  it("ETP4: formatErrorEntry yields a string containing the message text and a HH:MM:SS.mmm prefix", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
        fc.option(fc.integer({ min: 1, max: 99_999 }), { nil: undefined }),
        (msg, source, lineno) => {
          clearErrors();
          recordError(msg, source, lineno);
          const [entry] = getErrors();
          expect(entry).toBeDefined();
          if (!entry) return;
          const formatted = formatErrorEntry(entry);
          expect(formatted).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
          expect(formatted).toContain(msg);
          if (lineno !== undefined) expect(formatted).toContain(`:${lineno}`);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("ETP5: error trend buffer is a ring buffer of capacity 10, last-N preserved", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 25 }), (samples) => {
        clearErrors();
        _resetTrend();
        for (let i = 0; i < samples; i++) {
          recordError(`e${i}`);
          sampleErrorTrend();
        }
        const trend = getErrorTrend();
        expect(trend.length).toBeLessThanOrEqual(10);
        expect(trend.length).toBe(Math.min(samples, 10));
        // Each sample is a non-negative finite number rounded to 0.01
        for (const v of trend) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(Math.round(v * 100) / 100).toBe(v);
        }
      }),
      { numRuns: 20 },
    );
  });
});
