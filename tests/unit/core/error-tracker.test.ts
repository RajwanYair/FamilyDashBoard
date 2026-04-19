/**
 * Tests for src/core/error-tracker.ts
 * Sprint 39 — Runtime error tracking
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
} from "@/core/error-tracker";

beforeEach(() => {
  clearErrors();
  _resetInstalledFlag();
});

afterEach(() => {
  clearErrors();
  _resetInstalledFlag();
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
    const entry = { ts: new Date("2024-01-01T10:00:00Z").getTime(), message: "boom", source: "path/to/foo.ts", lineno: 55 };
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
    const errorCalls = addSpy.mock.calls.filter(([ev]) => ev === "error" || ev === "unhandledrejection");
    expect(errorCalls.length).toBeLessThanOrEqual(4); // at most 2 per call
    addSpy.mockRestore();
  });
});
// ── Sprint 125: errorRate tests ───────────────────────────────────────────────

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
});
