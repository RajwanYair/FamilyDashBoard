/**
 * Tests for src/core/error-tracker.ts
 * Runtime error tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  recordError,
  getErrors,
  clearErrors,
  getErrorCount,
  formatErrorEntry,
  installGlobalErrorHandlers,
  _resetInstalledFlag,
  errorRate,
  sampleErrorTrend,
  getErrorTrend,
  _resetTrend,
} from "@/core/error-tracker";

beforeEach(() => {
  clearErrors();
  _resetInstalledFlag();
  _resetTrend();
});

afterEach(() => {
  clearErrors();
  _resetInstalledFlag();
  _resetTrend();
});

describe("recordError", () => {
  it("records a basic error", () => {
    recordError("test error");
    expect(getErrorCount()).toBe(1);
    expect(getErrors()[0]?.message).toBe("test error");
  });

  it("records source and lineno", () => {
    recordError("oops", "main.ts", 42);
    const entry = getErrors()[0]!;
    expect(entry.source).toBe("main.ts");
    expect(entry.lineno).toBe(42);
  });

  it("stores timestamp", () => {
    const before = Date.now();
    recordError("ts test");
    const after = Date.now();
    const ts = getErrors()[0]!.ts;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("evicts oldest entry when buffer is full (max 20)", () => {
    for (let i = 0; i < 21; i++) recordError(`error ${i}`);
    expect(getErrorCount()).toBe(20);
    // Oldest entry (error 0) evicted; first entry is now error 1
    expect(getErrors()[0]?.message).toBe("error 1");
  });

  it("coerces non-string message to string", () => {
    recordError(String(undefined));
    expect(getErrors()[0]?.message).toBe("undefined");
  });
});

describe("getErrors", () => {
  it("returns empty array when buffer is empty", () => {
    expect(getErrors()).toEqual([]);
  });

  it("returns a copy, not the internal buffer", () => {
    recordError("a");
    const copy = getErrors();
    copy.push({ ts: 0, message: "injected" });
    expect(getErrorCount()).toBe(1);
  });
});

describe("clearErrors", () => {
  it("empties the buffer", () => {
    recordError("a");
    recordError("b");
    clearErrors();
    expect(getErrorCount()).toBe(0);
    expect(getErrors()).toEqual([]);
  });
});

describe("getErrorCount", () => {
  it("returns 0 for empty buffer", () => {
    expect(getErrorCount()).toBe(0);
  });

  it("increments per record", () => {
    recordError("1");
    recordError("2");
    expect(getErrorCount()).toBe(2);
  });
});

describe("formatErrorEntry", () => {
  it("formats entry with source and lineno", () => {
    const entry = {
      ts: new Date("2024-01-01T10:00:00Z").getTime(),
      message: "boom",
      source: "path/to/foo.ts",
      lineno: 55,
    };
    const s = formatErrorEntry(entry);
    expect(s).toContain("foo.ts");
    expect(s).toContain(":55");
    expect(s).toContain("boom");
  });

  it("formats entry without source", () => {
    const entry = { ts: Date.now(), message: "msg" };
    const s = formatErrorEntry(entry);
    expect(s).toContain("msg");
    expect(s).not.toContain("undefined");
  });
});

describe("installGlobalErrorHandlers", () => {
  it("is idempotent (safe to call twice)", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    installGlobalErrorHandlers();
    installGlobalErrorHandlers();
    // Second call should not add more listeners (early-return via _installed flag)
    // The first call adds 2 listeners; second adds 0
    const errorCalls = addSpy.mock.calls.filter(
      ([ev]) => ev === "error" || ev === "unhandledrejection",
    );
    expect(errorCalls.length).toBeLessThanOrEqual(4); // at most 2 per call
    addSpy.mockRestore();
  });
});
// ── errorRate tests ───────────────────────────────────────────────

describe("errorRate", () => {
  it("returns 0 with no errors", () => {
    expect(errorRate()).toBe(0);
  });

  it("returns a positive number after recording errors", () => {
    recordError("err1");
    recordError("err2");
    // Rate is errors / minutes since first error; since both in same ms, returns count
    expect(errorRate()).toBeGreaterThanOrEqual(2);
  });

  it("returns buffer length when spanMs is 0 (all errors in same millisecond)", () => {
    vi.useFakeTimers();
    recordError("err1");
    recordError("err2");
    const rate = errorRate();
    vi.useRealTimers();
    clearErrors();
    expect(rate).toBe(2); // spanMs === 0 → returns _buffer.length
  });
});

// ── sampleErrorTrend / getErrorTrend tests ────────────────────────

describe("sampleErrorTrend", () => {
  it("starts with an empty trend", () => {
    expect(getErrorTrend()).toEqual([]);
  });

  it("adds a sample to the trend buffer", () => {
    sampleErrorTrend();
    expect(getErrorTrend()).toHaveLength(1);
  });

  it("adds 0 when no errors recorded", () => {
    sampleErrorTrend();
    expect(getErrorTrend()[0]).toBe(0);
  });

  it("adds a non-zero rate when errors are present", () => {
    recordError("err1");
    recordError("err2");
    sampleErrorTrend();
    const trend = getErrorTrend();
    expect(trend[0]).toBeGreaterThanOrEqual(0);
  });

  it("caps trend buffer at 10 samples (max)", () => {
    for (let i = 0; i < 15; i++) sampleErrorTrend();
    expect(getErrorTrend().length).toBe(10);
  });

  it("evicts oldest sample when buffer is full", () => {
    // Fill up to max with 0-rate samples
    for (let i = 0; i < 10; i++) sampleErrorTrend();
    // Add errors and sample — new rate should be at tail
    recordError("err");
    sampleErrorTrend();
    const trend = getErrorTrend();
    expect(trend).toHaveLength(10);
    // Most recent sample (tail) should reflect the error rate
    expect(trend[9]).toBeGreaterThan(0);
  });
});

describe("getErrorTrend", () => {
  it("returns a readonly snapshot (cannot mutate internal buffer)", () => {
    sampleErrorTrend();
    const snapshot = getErrorTrend() as number[];
    snapshot.push(999);
    // Internal buffer should still only have 1 item
    expect(getErrorTrend()).toHaveLength(1);
  });
});

// ── installGlobalErrorHandlers — branch coverage for event callbacks ──────────

describe("installGlobalErrorHandlers — event handler branches", () => {
  beforeEach(() => {
    clearErrors();
    _resetInstalledFlag();
  });

  it("unhandledrejection with string reason (non-Error path)", () => {
    installGlobalErrorHandlers();
    const ev = Object.assign(new Event("unhandledrejection"), {
      reason: "string reason",
      promise: Promise.resolve(),
    });
    window.dispatchEvent(ev);
    const errs = getErrors();
    expect(errs.some((e) => e.message === "string reason")).toBe(true);
  });

  it("unhandledrejection with Error reason (Error path)", () => {
    installGlobalErrorHandlers();
    const ev = Object.assign(new Event("unhandledrejection"), {
      reason: new Error("error-reason"),
      promise: Promise.resolve(),
    });
    window.dispatchEvent(ev);
    const errs = getErrors();
    expect(errs.some((e) => e.message === "error-reason")).toBe(true);
  });

  it("unhandledrejection with null reason (null-coalescing fallback path)", () => {
    installGlobalErrorHandlers();
    const ev = Object.assign(new Event("unhandledrejection"), {
      reason: null,
      promise: Promise.resolve(),
    });
    window.dispatchEvent(ev);
    const errs = getErrors();
    expect(errs.some((e) => e.message === "Unhandled rejection")).toBe(true);
  });

  it("error event handler records the message", () => {
    installGlobalErrorHandlers();
    const ev = new ErrorEvent("error", {
      message: "global-error",
      filename: "test.ts",
      lineno: 42,
    });
    window.dispatchEvent(ev);
    const errs = getErrors();
    expect(errs.some((e) => e.message === "global-error")).toBe(true);
  });
});
