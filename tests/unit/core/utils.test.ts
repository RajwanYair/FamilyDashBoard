/**
 * Tests for src/core/utils.ts — debounce, throttle, clamp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce, throttle, clamp } from "@/core/utils";

// ── debounce ──────────────────────────────────────────────────────────────────

describe("debounce", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does not call fn immediately", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls fn after wait ms", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets timer on successive calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments through", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    debounced("hello", 42);
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith("hello", 42);
  });
});

// ── throttle ──────────────────────────────────────────────────────────────────

describe("throttle", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("calls fn on first invocation", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("suppresses calls within the window", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("allows second call after window expires", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled();
    vi.advanceTimersByTime(101);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("passes arguments through", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled("x", 1);
    expect(fn).toHaveBeenCalledWith("x", 1);
  });
});

// ── clamp ─────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns min when value is below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("returns max when value exceeds max", () => {
    expect(clamp(20, 0, 10)).toBe(10);
  });

  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("handles equal min and max", () => {
    expect(clamp(7, 5, 5)).toBe(5);
  });

  it("handles negative range", () => {
    expect(clamp(-3, -10, -1)).toBe(-3);
  });
});
