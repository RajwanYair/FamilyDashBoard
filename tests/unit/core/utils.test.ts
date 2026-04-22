/**
 * Tests for src/core/utils.ts — debounce, throttle, clamp, pad2, decomposeDuration, computeMoonPhase
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce, throttle, clamp, pad2, decomposeDuration, computeMoonPhase } from "@/core/utils";

// ── debounce ──────────────────────────────────────────────────────────────────

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

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

// ── pad2 ──────────────────────────────────────────────────────────────────────

describe("pad2", () => {
  it("pads single digit to 2 chars", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(5)).toBe("05");
    expect(pad2(9)).toBe("09");
  });

  it("does not pad double-digit numbers", () => {
    expect(pad2(10)).toBe("10");
    expect(pad2(59)).toBe("59");
  });

  it("handles triple-digit numbers", () => {
    expect(pad2(100)).toBe("100");
  });
});

// ── decomposeDuration ─────────────────────────────────────────────────────────

describe("decomposeDuration", () => {
  it("decomposes 0 ms", () => {
    expect(decomposeDuration(0)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("decomposes 90_061_000 ms (1d 1h 1m 1s)", () => {
    const ms = (86_400 + 3_600 + 60 + 1) * 1000;
    expect(decomposeDuration(ms)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
  });

  it("decomposes partial seconds (floor)", () => {
    expect(decomposeDuration(1_500)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 1 });
  });

  it("clamps negative to zero", () => {
    expect(decomposeDuration(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("decomposes 3661 seconds", () => {
    expect(decomposeDuration(3_661_000)).toEqual({ days: 0, hours: 1, minutes: 1, seconds: 1 });
  });
});

// ── computeMoonPhase ──────────────────────────────────────────────────────────

describe("computeMoonPhase", () => {
  it("returns new moon for reference date (2000-01-06T18:14:00Z)", () => {
    const result = computeMoonPhase(new Date("2000-01-06T18:14:00Z"));
    expect(result.emoji).toBe("🌑");
    expect(result.label).toBe("ירח חדש");
  });

  it("returns full moon for known full moon date (2025-03-14)", () => {
    const result = computeMoonPhase(new Date("2025-03-14T12:00:00Z"));
    expect(result.emoji).toBe("🌕");
  });

  it("returns first quarter on day ~7 after new moon", () => {
    const result = computeMoonPhase(new Date("2025-04-05T12:00:00Z"));
    expect(result.emoji).toBe("🌓");
  });

  it("returns an emoji and label for any date", () => {
    const result = computeMoonPhase(new Date());
    expect(result.emoji).toMatch(/^[\u{1F311}-\u{1F318}]$/u);
    expect(result.label.length).toBeGreaterThan(1);
  });

  it("defaults to today when no argument is passed", () => {
    const result = computeMoonPhase();
    expect(result.emoji).toMatch(/^[\u{1F311}-\u{1F318}]$/u);
  });
});
