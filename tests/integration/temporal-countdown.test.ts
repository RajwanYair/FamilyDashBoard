/**
 * Integration: Temporal helpers × Countdown card date logic
 *
 * Tests that the new temporal utility functions (addDays, diffDays, isSameDay,
 * daysUntil) integrate correctly with the patterns used in countdown/calendar
 * cards for computing remaining days to events.
 *
 * Verifies:
 * - diffDays round-trip with addDays
 * - daysUntil zero-crossing (today)
 * - startOfDayMs + diffDays consistency
 * - isSameDay consistency with startOfDayMs equality
 * - toISODateString + parsePlainDateMs round-trip through diffDays
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  addDays,
  diffDays,
  isSameDay,
  daysUntil,
  startOfDayMs,
  toISODateString,
  parsePlainDateMs,
} from "@/core/temporal";

describe("Integration: temporal × countdown date patterns", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to 2024-06-15 10:30:00 local time
    vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("daysUntil matches diffDays(today, target)", () => {
    const target = new Date(2024, 5, 20); // Jun 20
    expect(daysUntil(target)).toBe(diffDays(new Date(), target));
  });

  it("addDays(today, n) → daysUntil === n", () => {
    const n = 10;
    const future = addDays(new Date(), n);
    expect(daysUntil(future)).toBe(n);
  });

  it("isSameDay matches startOfDayMs equality", () => {
    const a = new Date(2024, 5, 15, 3, 0);
    const b = new Date(2024, 5, 15, 23, 59);
    expect(isSameDay(a, b)).toBe(startOfDayMs(a) === startOfDayMs(b));
  });

  it("toISODateString → parsePlainDateMs → diffDays produces correct result", () => {
    const iso = toISODateString(2024, 6, 25); // "2024-06-25"
    const target = new Date(parsePlainDateMs(iso));
    const now = new Date(2024, 5, 15); // Jun 15 (month 0-indexed)
    expect(diffDays(now, target)).toBe(10);
  });

  it("diffDays returns 0 for times within the same calendar day", () => {
    const morning = new Date(2024, 5, 15, 6, 0);
    const evening = new Date(2024, 5, 15, 22, 0);
    expect(diffDays(morning, evening)).toBe(0);
  });

  it("addDays negative goes to past, daysUntil returns negative", () => {
    const past = addDays(new Date(), -5);
    expect(daysUntil(past)).toBe(-5);
  });

  it("countdown event tomorrow: isSameDay false, diffDays 1", () => {
    const today = new Date();
    const tomorrow = addDays(today, 1);
    expect(isSameDay(today, tomorrow)).toBe(false);
    expect(diffDays(today, tomorrow)).toBe(1);
  });
});
