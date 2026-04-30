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

  // ── Cover all 8 phase bins explicitly ──────────────────────────────────
  // Reference new moon: 2000-01-06T18:14:00Z (KNOWN_NEW_MOON_MS).
  // Phases offset by N days from that anchor.

  it("phase 1 — waxing crescent (day 3 after new moon)", () => {
    // frac ≈ 0.1016 → MOON_PHASES[1]
    const result = computeMoonPhase(new Date("2000-01-09T18:14:00Z"));
    expect(result.emoji).toBe("🌒");
    expect(result.label).toBe("ירח גדל");
  });

  it("phase 3 — waxing gibbous (day 11 after new moon)", () => {
    // frac ≈ 0.3725 → MOON_PHASES[3]
    const result = computeMoonPhase(new Date("2000-01-17T18:14:00Z"));
    expect(result.emoji).toBe("🌔");
    expect(result.label).toBe("ירח כמעט מלא");
  });

  it("phase 5 — waning gibbous (day 18 after new moon)", () => {
    // frac ≈ 0.6095 → MOON_PHASES[5]
    const result = computeMoonPhase(new Date("2000-01-24T18:14:00Z"));
    expect(result.emoji).toBe("🌖");
    expect(result.label).toBe("ירח פוחת");
  });

  it("phase 6 — last quarter (day 22 after new moon)", () => {
    // frac ≈ 0.7451 → MOON_PHASES[6]
    const result = computeMoonPhase(new Date("2000-01-28T18:14:00Z"));
    expect(result.emoji).toBe("🌗");
    expect(result.label).toBe("רבע אחרון");
  });

  it("phase 7 — waning crescent (day 26 after new moon)", () => {
    // frac ≈ 0.8804 → MOON_PHASES[7]
    const result = computeMoonPhase(new Date("2000-02-01T18:14:00Z"));
    expect(result.emoji).toBe("🌘");
    expect(result.label).toBe("ירח דועך");
  });

  it("wrap-around — new moon again (day 28.5 after, frac ≥ 0.9375)", () => {
    // frac ≈ 0.9651 → falls back to MOON_PHASES[0] (new moon)
    const result = computeMoonPhase(new Date("2000-02-04T09:14:00Z"));
    expect(result.emoji).toBe("🌑");
    expect(result.label).toBe("ירח חדש");
  });
});

// ── Sprint 266 / UP1-UP5: fast-check property tests for utils pure functions ──

import * as fc from "fast-check";

describe("Utils — fast-check properties (UP1-UP5, Sprint 266)", () => {
  /**
   * UP1: clamp(value, min, max) always returns a value in [min, max].
   */
  it("UP1 · clamp always returns result in [min, max]", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (a: number, b: number, value: number) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const result = clamp(value, lo, hi);
          return result >= lo && result <= hi;
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * UP2: pad2(n) always returns a string of length ≥ 2.
   */
  it("UP2 · pad2 always returns a string of length ≥ 2", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999 }),
        (n: number) => {
          return pad2(n).length >= 2;
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * UP3: decomposeDuration always yields non-negative integer parts.
   */
  it("UP3 · decomposeDuration parts are always non-negative integers", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (ms: number) => {
          const { days, hours, minutes, seconds } = decomposeDuration(ms);
          return (
            Number.isInteger(days) && days >= 0 &&
            Number.isInteger(hours) && hours >= 0 &&
            Number.isInteger(minutes) && minutes >= 0 &&
            Number.isInteger(seconds) && seconds >= 0
          );
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * UP4: decomposeDuration hours/minutes/seconds are always < their unit ceiling.
   */
  it("UP4 · decomposeDuration parts are within unit bounds", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e12, noNaN: true, noDefaultInfinity: true }),
        (ms: number) => {
          const { hours, minutes, seconds } = decomposeDuration(ms);
          return hours < 24 && minutes < 60 && seconds < 60;
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * UP5: computeMoonPhase always returns an object with non-empty emoji and label.
   */
  it("UP5 · computeMoonPhase always returns non-empty emoji and label", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2000-01-01"), max: new Date("2040-01-01") }),
        (d: Date) => {
          fc.pre(isFinite(d.getTime()));
          const { emoji, label } = computeMoonPhase(d);
          return typeof emoji === "string" && emoji.length > 0 &&
                 typeof label === "string" && label.length > 0;
        },
      ),
      { numRuns: 300 },
    );
  });
});
