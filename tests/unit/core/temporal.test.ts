/**
 * Tests for src/core/temporal.ts — Date/time abstraction layer (CAL-T / H-T scaffold)
 *
 * Critical behaviours verified:
 *   • nowMs() reflects Date.now() within a small delta
 *   • today() returns a Date whose day/month/year match Date.now()
 *   • startOfDayMs() is non-mutating, returns local midnight
 *   • parsePlainDateMs() returns LOCAL midnight (UTC-midnight bug fix)
 *   • parsePlainDateTime() round-trips ISO date-time strings
 *   • addYears() / addMonths() are non-mutating
 *   • toISODateString() formats with 1-indexed month and zero-padded fields
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  nowMs,
  today,
  startOfDayMs,
  parsePlainDateMs,
  parsePlainDateTime,
  addYears,
  addMonths,
  toISODateString,
  addDays,
  diffDays,
  isSameDay,
  daysUntil,
} from "@/core/temporal";

// ── nowMs ─────────────────────────────────────────────────────────────────────

describe("nowMs", () => {
  it("returns a number close to Date.now()", () => {
    const before = Date.now();
    const result = nowMs();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns the faked time when vi.useFakeTimers is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    expect(nowMs()).toBe(new Date("2024-06-15T12:00:00Z").getTime());
    vi.useRealTimers();
  });
});

// ── today ─────────────────────────────────────────────────────────────────────

describe("today", () => {
  it("returns a Date instance", () => {
    expect(today()).toBeInstanceOf(Date);
  });

  it("returns the faked date when vi.useFakeTimers is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-07-04T08:00:00Z"));
    const d = today();
    expect(d.getUTCFullYear()).toBe(2024);
    vi.useRealTimers();
  });
});

// ── startOfDayMs ──────────────────────────────────────────────────────────────

describe("startOfDayMs", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns midnight (00:00:00.000) in local time for given date", () => {
    const d = new Date(2024, 0, 15, 14, 30, 0); // 2024-01-15 14:30
    const ms = startOfDayMs(d);
    const result = new Date(ms);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getFullYear()).toBe(2024);
  });

  it("does NOT mutate the input Date", () => {
    const original = new Date(2024, 5, 10, 18, 0, 0); // 2024-06-10 18:00
    const originalTime = original.getTime();
    startOfDayMs(original);
    expect(original.getTime()).toBe(originalTime);
  });

  it("uses current time when no argument given", () => {
    vi.setSystemTime(new Date(2024, 3, 20, 9, 0, 0)); // 2024-04-20 09:00 local
    const ms = startOfDayMs();
    const result = new Date(ms);
    expect(result.getDate()).toBe(20);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getHours()).toBe(0);
  });
});

// ── parsePlainDateMs ──────────────────────────────────────────────────────────

describe("parsePlainDateMs", () => {
  it("returns local midnight for a YYYY-MM-DD string", () => {
    const ms = parsePlainDateMs("2024-03-15");
    const result = new Date(ms);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(2); // March (0-indexed)
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("differs from UTC-midnight new Date(iso) in non-UTC zones", () => {
    // new Date("2024-03-15") gives UTC midnight = possibly "yesterday" in UTC+N
    // parsePlainDateMs should give local midnight regardless
    const localMs = parsePlainDateMs("2024-03-15");
    const localDate = new Date(localMs);
    // The calendar day must be 15, not 14 (the UTC-midnight bug)
    expect(localDate.getDate()).toBe(15);
  });

  it("parses January (month 01) correctly — 1-indexed ISO to 0-indexed Date", () => {
    const ms = parsePlainDateMs("2024-01-01");
    const result = new Date(ms);
    expect(result.getMonth()).toBe(0); // January = 0 in Date
    expect(result.getDate()).toBe(1);
  });

  it("parses December (month 12) correctly", () => {
    const ms = parsePlainDateMs("2024-12-31");
    const result = new Date(ms);
    expect(result.getMonth()).toBe(11); // December = 11 in Date
    expect(result.getDate()).toBe(31);
  });

  it("returns the same value as startOfDayMs for same calendar date", () => {
    const isoDate = "2024-06-20";
    const localMidnight = new Date(2024, 5, 20, 0, 0, 0, 0); // local midnight
    expect(parsePlainDateMs(isoDate)).toBe(startOfDayMs(localMidnight));
  });
});

// ── parsePlainDateTime ────────────────────────────────────────────────────────

describe("parsePlainDateTime", () => {
  it("returns a Date instance", () => {
    expect(parsePlainDateTime("2024-01-15T10:30:00")).toBeInstanceOf(Date);
  });

  it("round-trips an ISO datetime string", () => {
    const iso = "2024-06-15T14:00:00.000Z";
    const d = parsePlainDateTime(iso);
    expect(d.getTime()).toBe(new Date(iso).getTime());
  });

  it("returns an invalid Date for malformed input", () => {
    const d = parsePlainDateTime("not-a-date");
    expect(isNaN(d.getTime())).toBe(true);
  });
});

// ── addYears ──────────────────────────────────────────────────────────────────

describe("addYears", () => {
  it("advances by positive years", () => {
    const d = new Date(2020, 0, 1);
    const result = addYears(d, 5);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it("reverses by negative years", () => {
    const d = new Date(2024, 5, 15);
    const result = addYears(d, -3);
    expect(result.getFullYear()).toBe(2021);
  });

  it("does NOT mutate the input Date", () => {
    const d = new Date(2022, 3, 10);
    const original = d.getTime();
    addYears(d, 1);
    expect(d.getTime()).toBe(original);
  });
});

// ── addMonths ─────────────────────────────────────────────────────────────────

describe("addMonths", () => {
  it("advances by positive months", () => {
    const d = new Date(2024, 0, 15); // Jan 15
    const result = addMonths(d, 3);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(15);
  });

  it("rolls over year boundary", () => {
    const d = new Date(2023, 11, 1); // Dec 2023
    const result = addMonths(d, 2);
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(1); // Feb
  });

  it("handles negative months", () => {
    const d = new Date(2024, 2, 1); // Mar 2024
    const result = addMonths(d, -2);
    expect(result.getMonth()).toBe(0); // Jan
  });

  it("does NOT mutate the input Date", () => {
    const d = new Date(2024, 6, 20);
    const original = d.getTime();
    addMonths(d, 1);
    expect(d.getTime()).toBe(original);
  });
});

// ── toISODateString ───────────────────────────────────────────────────────────

describe("toISODateString", () => {
  it("formats year, 1-indexed month, and day with zero-padding", () => {
    expect(toISODateString(2024, 3, 7)).toBe("2024-03-07");
  });

  it("formats December (month 12) without overflow", () => {
    expect(toISODateString(2024, 12, 31)).toBe("2024-12-31");
  });

  it("formats January (month 1) correctly", () => {
    expect(toISODateString(2025, 1, 1)).toBe("2025-01-01");
  });

  it("zero-pads day < 10", () => {
    expect(toISODateString(2024, 6, 5)).toBe("2024-06-05");
  });

  it("does not zero-pad year", () => {
    expect(toISODateString(2024, 10, 20)).toMatch(/^2024-/);
  });
});

// ── addDays ───────────────────────────────────────────────────────────────────

describe("addDays", () => {
  it("advances by positive days", () => {
    const d = new Date(2024, 0, 30); // Jan 30
    const result = addDays(d, 3);
    expect(result.getDate()).toBe(2); // Feb 2
    expect(result.getMonth()).toBe(1);
  });

  it("goes backward with negative days", () => {
    const d = new Date(2024, 0, 5); // Jan 5
    const result = addDays(d, -10);
    expect(result.getMonth()).toBe(11); // Dec
    expect(result.getFullYear()).toBe(2023);
  });

  it("does not mutate input", () => {
    const d = new Date(2024, 5, 15);
    const before = d.getTime();
    addDays(d, 7);
    expect(d.getTime()).toBe(before);
  });
});

// ── diffDays ──────────────────────────────────────────────────────────────────

describe("diffDays", () => {
  it("returns 0 for same day", () => {
    const d = new Date(2024, 3, 10, 8, 30);
    const d2 = new Date(2024, 3, 10, 22, 0);
    expect(diffDays(d, d2)).toBe(0);
  });

  it("returns positive when b is later", () => {
    const a = new Date(2024, 0, 1);
    const b = new Date(2024, 0, 8);
    expect(diffDays(a, b)).toBe(7);
  });

  it("returns negative when b is earlier", () => {
    const a = new Date(2024, 0, 10);
    const b = new Date(2024, 0, 3);
    expect(diffDays(a, b)).toBe(-7);
  });
});

// ── isSameDay ─────────────────────────────────────────────────────────────────

describe("isSameDay", () => {
  it("returns true for same day different times", () => {
    const a = new Date(2024, 5, 15, 0, 0);
    const b = new Date(2024, 5, 15, 23, 59);
    expect(isSameDay(a, b)).toBe(true);
  });

  it("returns false for different days", () => {
    const a = new Date(2024, 5, 14);
    const b = new Date(2024, 5, 15);
    expect(isSameDay(a, b)).toBe(false);
  });

  it("returns false for same day different months", () => {
    const a = new Date(2024, 4, 15);
    const b = new Date(2024, 5, 15);
    expect(isSameDay(a, b)).toBe(false);
  });
});

// ── daysUntil ─────────────────────────────────────────────────────────────────

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    expect(daysUntil(new Date())).toBe(0);
  });

  it("returns positive for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(daysUntil(future)).toBe(5);
  });

  it("returns negative for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(daysUntil(past)).toBe(-3);
  });
});
