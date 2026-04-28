/**
 * Tests for src/core/vitals-reporter.ts (v11.0-OBS-1)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("../../../src/core/constants", () => ({
  isWorkerEnabled: vi.fn(() => true),
  WORKER_BASE_URL: "https://fdb.rajwanyair.workers.dev",
}));

vi.mock("../../../src/core/perf", () => ({
  getPerfVitals: vi.fn(() => ({
    lcp: 1200,
    cls: 0.05,
    inp: 80,
    fcp: 900,
    ttfb: 200,
    startup: 3500,
  })),
  formatVital: vi.fn((key: string, val: number) => {
    if (key === "cls") return val.toFixed(3);
    return `${Math.round(val)} ms`;
  }),
}));

const _reportedBatches: unknown[][] = [];
vi.mock("../../../src/core/error-reporter", () => ({
  reportErrors: vi.fn((batch: unknown[]) => {
    _reportedBatches.push(batch);
  }),
}));

import {
  scheduleVitalsReport,
  flushVitalsReport,
  _resetVitalsReporter,
} from "../../../src/core/vitals-reporter";
import { isWorkerEnabled } from "../../../src/core/constants";
import { getPerfVitals } from "../../../src/core/perf";
import { reportErrors } from "../../../src/core/error-reporter";

describe("vitals-reporter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _reportedBatches.length = 0;
    _resetVitalsReporter();
    vi.mocked(isWorkerEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not report before 30 s have elapsed", () => {
    scheduleVitalsReport();
    vi.advanceTimersByTime(29_999);
    expect(reportErrors).not.toHaveBeenCalled();
  });

  it("reports vitals after 30 s", () => {
    scheduleVitalsReport();
    vi.advanceTimersByTime(30_000);
    expect(reportErrors).toHaveBeenCalledOnce();
    const batch = _reportedBatches[0] as Array<{
      ts: number;
      message: string;
      source: string;
      lineno: number;
    }>;
    expect(batch).toHaveLength(1);
    expect(batch[0].source).toBe("web-vitals");
    expect(batch[0].message).toContain("lcp=");
    expect(batch[0].message).toContain("cls=");
    expect(batch[0].message).toContain("startup=");
    expect(batch[0].lineno).toBe(0);
  });

  it("only fires once even if scheduleVitalsReport is called multiple times", () => {
    scheduleVitalsReport();
    scheduleVitalsReport();
    vi.advanceTimersByTime(30_000);
    expect(reportErrors).toHaveBeenCalledOnce();
  });

  it("does not report when worker is disabled", () => {
    vi.mocked(isWorkerEnabled).mockReturnValue(false);
    scheduleVitalsReport();
    vi.advanceTimersByTime(30_000);
    expect(reportErrors).not.toHaveBeenCalled();
  });

  it("flushVitalsReport sends immediately and does not double-send", () => {
    flushVitalsReport();
    expect(reportErrors).toHaveBeenCalledOnce();
    // Second flush should be a no-op
    flushVitalsReport();
    expect(reportErrors).toHaveBeenCalledOnce();
  });

  it("flushVitalsReport prevents the scheduled report from firing", () => {
    scheduleVitalsReport();
    flushVitalsReport();
    vi.advanceTimersByTime(30_000);
    // Should still only have been called once (from flushVitalsReport)
    expect(reportErrors).toHaveBeenCalledOnce();
  });

  it("message contains all collected vitals", () => {
    flushVitalsReport();
    const batch = _reportedBatches[0] as Array<{ message: string }>;
    const msg = batch[0].message;
    expect(msg).toContain("lcp=1200 ms");
    expect(msg).toContain("cls=0.050");
    expect(msg).toContain("inp=80 ms");
    expect(msg).toContain("fcp=900 ms");
    expect(msg).toContain("ttfb=200 ms");
    expect(msg).toContain("startup=3500 ms");
  });

  it("does not report when all vitals are null (parts.length === 0)", () => {
    vi.mocked(getPerfVitals).mockReturnValueOnce({
      lcp: null,
      cls: null,
      inp: null,
      fcp: null,
      ttfb: null,
      startup: null,
    });
    flushVitalsReport();
    expect(reportErrors).not.toHaveBeenCalled();
  });

  it("reports partial vitals when only lcp is available", () => {
    vi.mocked(getPerfVitals).mockReturnValueOnce({
      lcp: 1200,
      cls: null,
      inp: null,
      fcp: null,
      ttfb: null,
      startup: null,
    });
    flushVitalsReport();
    expect(reportErrors).toHaveBeenCalledOnce();
    const batch = _reportedBatches[0] as Array<{ message: string }>;
    expect(batch[0].message).toContain("lcp=");
    expect(batch[0].message).not.toContain("cls=");
    expect(batch[0].message).not.toContain("startup=");
  });

  it("reports partial vitals when only cls is available", () => {
    vi.mocked(getPerfVitals).mockReturnValueOnce({
      lcp: null,
      cls: 0.05,
      inp: null,
      fcp: null,
      ttfb: null,
      startup: null,
    });
    flushVitalsReport();
    expect(reportErrors).toHaveBeenCalledOnce();
    const batch = _reportedBatches[0] as Array<{ message: string }>;
    expect(batch[0].message).toContain("cls=");
    expect(batch[0].message).not.toContain("lcp=");
  });

  it("does not schedule a report when worker is disabled (second call)", () => {
    vi.mocked(isWorkerEnabled).mockReturnValue(false);
    scheduleVitalsReport(); // first call blocked
    scheduleVitalsReport(); // second call also blocked
    vi.advanceTimersByTime(30_000);
    expect(reportErrors).not.toHaveBeenCalled();
  });
});
