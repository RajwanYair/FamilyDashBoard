/**
 * fast-check property tests — src/core/error-tracker.ts 
 *
 * Properties under test:
 *  ET1. recordError circular buffer never exceeds MAX_ERRORS (20).
 *  ET2. getErrors returns entries in insertion order (oldest → newest).
 *  ET3. clearErrors empties the buffer completely.
 *  ET4. getErrorCount matches getErrors().length.
 *  ET5. formatErrorEntry contains the message string.
 *  ET6. sampleErrorTrend trend buffer never exceeds 10 samples.
 *  ET7. errorRate returns 0 when buffer is empty.
 *  ET8. recordError converts message to string (non-string inputs → coerced).
 *  ET9. After overflow, oldest entries are evicted (FIFO).
 *  ET10. formatErrorEntry includes source filename (last segment only).
 *  ET11. getErrorTrend returns a copy (mutations don't affect internal buffer).
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  recordError,
  getErrors,
  clearErrors,
  getErrorCount,
  formatErrorEntry,
  errorRate,
  sampleErrorTrend,
  getErrorTrend,
  _resetTrend,
} from "@/core/error-tracker";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearErrors();
  _resetTrend();
});

// ── ET1: buffer bounded by 20 ────────────────────────────────────────────────

describe("error-tracker — ET1: buffer never exceeds 20", () => {
  it("after N records, getErrors().length <= 20", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (n) => {
        clearErrors();
        for (let i = 0; i < n; i++) recordError(`error-${i}`);
        expect(getErrors().length).toBeLessThanOrEqual(20);
        expect(getErrors().length).toBe(Math.min(n, 20));
      }),
      { numRuns: 40 },
    );
  });
});

// ── ET2: insertion order preserved ───────────────────────────────────────────

describe("error-tracker — ET2: entries are in insertion order", () => {
  it("timestamps are non-decreasing", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 20 }), (n) => {
        clearErrors();
        for (let i = 0; i < n; i++) recordError(`error-${i}`);
        const entries = getErrors();
        for (let i = 0; i < entries.length - 1; i++) {
          expect(entries[i].ts).toBeLessThanOrEqual(entries[i + 1].ts);
        }
      }),
      { numRuns: 20 },
    );
  });
});

// ── ET3: clearErrors empties buffer ──────────────────────────────────────────

describe("error-tracker — ET3: clearErrors empties buffer", () => {
  it("getErrors returns empty after clear", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (n) => {
        clearErrors();
        for (let i = 0; i < n; i++) recordError(`error-${i}`);
        clearErrors();
        expect(getErrors()).toHaveLength(0);
      }),
      { numRuns: 20 },
    );
  });
});

// ── ET4: getErrorCount consistency ───────────────────────────────────────────

describe("error-tracker — ET4: getErrorCount === getErrors().length", () => {
  it("count always matches array length", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50 }), (n) => {
        clearErrors();
        for (let i = 0; i < n; i++) recordError(`error-${i}`);
        expect(getErrorCount()).toBe(getErrors().length);
      }),
      { numRuns: 30 },
    );
  });
});

// ── ET5: formatErrorEntry contains message ───────────────────────────────────

describe("error-tracker — ET5: formatErrorEntry includes the message", () => {
  it("output contains the original message", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("\n")),
        (msg) => {
          const entry = { ts: Date.now(), message: msg };
          const formatted = formatErrorEntry(entry);
          expect(formatted).toContain(msg);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── ET6: trend buffer bounded by 10 ─────────────────────────────────────────

describe("error-tracker — ET6: trend buffer never exceeds 10", () => {
  it("after N samples, trend length <= 10", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (n) => {
        clearErrors();
        _resetTrend();
        recordError("x"); // need at least one error for non-zero rate
        for (let i = 0; i < n; i++) sampleErrorTrend();
        expect(getErrorTrend().length).toBeLessThanOrEqual(10);
      }),
      { numRuns: 30 },
    );
  });
});

// ── ET7: errorRate 0 when empty ──────────────────────────────────────────────

describe("error-tracker — ET7: errorRate returns 0 when buffer empty", () => {
  it("returns 0 with no recorded errors", () => {
    clearErrors();
    expect(errorRate()).toBe(0);
  });
});

// ── ET8: recordError coerces message to string ───────────────────────────────

describe("error-tracker — ET8: recordError converts message to string", () => {
  it("message is always a string regardless of input type", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string({ minLength: 0, maxLength: 30 }),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
        ),
        (input) => {
          clearErrors();
          recordError(input as unknown as string);
          const entries = getErrors();
          expect(entries.length).toBe(1);
          expect(typeof entries[0].message).toBe("string");
        },
      ),
      { numRuns: 40 },
    );
  });
});

// ── ET9: FIFO eviction after overflow ────────────────────────────────────────

describe("error-tracker — ET9: oldest entries evicted on overflow", () => {
  it("after 20+N records, first entry message matches record #N", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (extra) => {
        clearErrors();
        const total = 20 + extra;
        for (let i = 0; i < total; i++) recordError(`msg-${i}`);
        const entries = getErrors();
        // The oldest surviving is msg-{extra}
        expect(entries[0].message).toBe(`msg-${extra}`);
        expect(entries[entries.length - 1].message).toBe(`msg-${total - 1}`);
      }),
      { numRuns: 30 },
    );
  });
});

// ── ET10: formatErrorEntry includes source basename ──────────────────────────

describe("error-tracker — ET10: formatErrorEntry includes source filename", () => {
  const dirArb = fc.stringMatching(/^[a-z]{1,10}$/);
  const fileArb = fc.stringMatching(/^[a-z]{1,8}\.ts$/);

  it("output contains the last path segment of source", () => {
    fc.assert(
      fc.property(dirArb, fileArb, (dir, file) => {
        const source = `${dir}/${file}`;
        const entry = { ts: Date.now(), message: "err", source };
        const formatted = formatErrorEntry(entry);
        expect(formatted).toContain(file);
      }),
      { numRuns: 30 },
    );
  });
});

// ── ET11: getErrorTrend returns a defensive copy ─────────────────────────────

describe("error-tracker — ET11: getErrorTrend returns a copy", () => {
  it("mutating returned array does not affect internal buffer", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        clearErrors();
        _resetTrend();
        recordError("x");
        for (let i = 0; i < n; i++) sampleErrorTrend();
        const trend = getErrorTrend() as number[];
        const originalLen = trend.length;
        trend.push(999);
        trend.length = 0;
        expect(getErrorTrend().length).toBe(originalLen);
      }),
      { numRuns: 20 },
    );
  });
});
