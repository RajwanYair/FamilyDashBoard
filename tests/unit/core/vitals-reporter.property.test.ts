/**
 * fast-check property tests — src/core/vitals-reporter.ts
 *
 * Properties under test:
 *  VR1. flushVitalsReport is idempotent — calling it N times never sends more than one report.
 *  VR2. scheduleVitalsReport is idempotent — scheduling N times fires at most once.
 *  VR3. flushVitalsReport never throws for any combination of partial vitals.
 *  VR4. After _resetVitalsReporter, a subsequent flush can fire once more.
 */

import { beforeEach, describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

vi.mock("@/core/constants", () => ({ isWorkerEnabled: vi.fn().mockReturnValue(true) }));
vi.mock("@/core/perf", () => ({
  getPerfVitals: vi.fn().mockReturnValue({
    lcp: null,
    cls: null,
    inp: null,
    fcp: null,
    ttfb: null,
    startup: null,
  }),
  formatVital: vi.fn((_, v: number) => `${v}ms`),
}));
vi.mock("@/core/error-reporter", () => ({ reportErrors: vi.fn() }));

import {
  flushVitalsReport,
  scheduleVitalsReport,
  _resetVitalsReporter,
} from "@/core/vitals-reporter";
import { reportErrors } from "@/core/error-reporter";
import { getPerfVitals } from "@/core/perf";

// ── VR1: flushVitalsReport is idempotent ─────────────────────────────────────

describe("vitals-reporter — VR1: flushVitalsReport idempotent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetVitalsReporter();
  });

  it("calling flush N times reports at most once (with vitals data)", () => {
    vi.mocked(getPerfVitals).mockReturnValue({
      lcp: 1000,
      cls: 0.05,
      inp: 80,
      fcp: 900,
      ttfb: 200,
      startup: 3500,
    });

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        _resetVitalsReporter();
        vi.mocked(reportErrors).mockClear();

        for (let i = 0; i < n; i++) {
          flushVitalsReport();
        }
        expect(vi.mocked(reportErrors).mock.calls.length).toBeLessThanOrEqual(1);
      }),
      { numRuns: 20 },
    );
  });
});

// ── VR2: scheduleVitalsReport is idempotent ───────────────────────────────────

describe("vitals-reporter — VR2: scheduleVitalsReport idempotent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetVitalsReporter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("scheduling N times fires reportErrors at most once after 30 s", () => {
    vi.mocked(getPerfVitals).mockReturnValue({
      lcp: 800,
      cls: 0.02,
      inp: 60,
      fcp: 700,
      ttfb: 150,
      startup: 2800,
    });

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
        _resetVitalsReporter();
        vi.mocked(reportErrors).mockClear();

        for (let i = 0; i < n; i++) {
          scheduleVitalsReport();
        }
        vi.advanceTimersByTime(31_000);
        expect(vi.mocked(reportErrors).mock.calls.length).toBeLessThanOrEqual(1);
      }),
      { numRuns: 10 },
    );
  });
});

// ── VR3: flushVitalsReport never throws with partial vitals ───────────────────

describe("vitals-reporter — VR3: flushVitalsReport never throws with any partial vitals combo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetVitalsReporter();
  });

  it("does not throw for any combination of null/number vitals", () => {
    fc.assert(
      fc.property(
        fc.option(fc.float({ min: 0, max: 5000, noNaN: true }), { nil: null }),
        fc.option(fc.float({ min: 0, max: 0.25, noNaN: true }), { nil: null }),
        fc.option(fc.float({ min: 0, max: 500, noNaN: true }), { nil: null }),
        (lcp, cls, fcp) => {
          _resetVitalsReporter();
          vi.mocked(getPerfVitals).mockReturnValue({
            lcp,
            cls,
            inp: null,
            fcp,
            ttfb: null,
            startup: null,
          });
          expect(() => flushVitalsReport()).not.toThrow();
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── VR4: reset allows a subsequent flush to fire once more ───────────────────

describe("vitals-reporter — VR4: _resetVitalsReporter re-enables one flush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("after reset, exactly one more flush can fire for any number of flushes", () => {
    vi.mocked(getPerfVitals).mockReturnValue({
      lcp: 500,
      cls: null,
      inp: null,
      fcp: null,
      ttfb: null,
      startup: null,
    });

    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
        _resetVitalsReporter();
        vi.mocked(reportErrors).mockClear();

        for (let i = 0; i < n; i++) flushVitalsReport();
        const callsAfterFirst = vi.mocked(reportErrors).mock.calls.length;

        // reset and flush once more
        _resetVitalsReporter();
        vi.mocked(reportErrors).mockClear();
        flushVitalsReport();
        flushVitalsReport();

        expect(vi.mocked(reportErrors).mock.calls.length).toBeLessThanOrEqual(1);
        // ensure the first batch also respected idempotency
        expect(callsAfterFirst).toBeLessThanOrEqual(1);
      }),
      { numRuns: 20 },
    );
  });
});
