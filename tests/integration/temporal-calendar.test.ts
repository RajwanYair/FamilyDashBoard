/**
 * Integration: Temporal helpers × Calendar card date logic
 *
 * Tests that calDaysUntilLabel and groupEventsByDay integrate correctly
 * with the temporal module's diffDays/addDays functions across timezone
 * edge cases, DST transitions, and month boundaries.
 *
 * Verifies:
 * - calDaysUntilLabel matches diffDays semantics
 * - groupEventsByDay bucket placement matches diffDays
 * - DST spring-forward/fall-back does not break day counting
 * - Month-boundary events route to correct buckets
 * - Multi-day sequences produce consistent labels
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { diffDays, addDays } from "@/core/temporal";
import { calDaysUntilLabel, groupEventsByDay } from "@/cards/calendar/calendar";
import type { CalendarEvent } from "@/types/api";

function makeEvent(start: Date, summary = "Test"): CalendarEvent {
  return {
    summary,
    start,
    end: new Date(start.getTime() + 3600000),
    allDay: false,
    icsIndex: 0,
    category: "default",
  };
}

describe("Integration: temporal × calendar card", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 2, 15, 10, 0, 0)); // Mar 15, 2025 10:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calDaysUntilLabel agrees with diffDays for a range of offsets", () => {
    const now = new Date();
    for (let offset = 0; offset <= 14; offset++) {
      const target = addDays(now, offset);
      const label = calDaysUntilLabel(target, now);
      const diff = diffDays(now, target);
      if (diff <= 0) expect(label).toBe("");
      else if (diff === 1) expect(label).toBe("מחר");
      else expect(label).toBe(`עוד ${diff} ימים`);
    }
  });

  it("groupEventsByDay places event at correct bucket index via diffDays", () => {
    const now = new Date(2025, 2, 15);
    const event = makeEvent(new Date(2025, 2, 18, 14, 0), "Day-3 event");
    const buckets = groupEventsByDay([event], now);
    const expectedIdx = diffDays(now, event.start);
    expect(expectedIdx).toBe(3);
    expect(buckets[expectedIdx]!.events).toHaveLength(1);
    expect(buckets[expectedIdx]!.events[0]!.summary).toBe("Day-3 event");
  });

  it("month boundary: event on Apr 1 when now is Mar 15 lands in bucket 17", () => {
    const now = new Date(2025, 2, 15);
    const apr1 = new Date(2025, 3, 1, 9, 0);
    const expected = diffDays(now, apr1); // 17
    const buckets = groupEventsByDay([makeEvent(apr1, "Apr 1")], now);
    expect(expected).toBe(17);
    expect(buckets[expected]!.events).toHaveLength(1);
  });

  it("events at midnight boundary are assigned to the correct day", () => {
    const now = new Date(2025, 2, 15);
    const justBeforeMidnight = new Date(2025, 2, 15, 23, 59, 59);
    const justAfterMidnight = new Date(2025, 2, 16, 0, 0, 1);
    const buckets = groupEventsByDay(
      [makeEvent(justBeforeMidnight, "Tonight"), makeEvent(justAfterMidnight, "Tomorrow")],
      now,
    );
    expect(buckets[0]!.events).toHaveLength(1);
    expect(buckets[0]!.events[0]!.summary).toBe("Tonight");
    expect(buckets[1]!.events).toHaveLength(1);
    expect(buckets[1]!.events[0]!.summary).toBe("Tomorrow");
  });

  it("calDaysUntilLabel returns empty for past dates", () => {
    const now = new Date(2025, 2, 15);
    const yesterday = addDays(now, -1);
    expect(calDaysUntilLabel(yesterday, now)).toBe("");
    expect(diffDays(now, yesterday)).toBe(-1);
  });

  it("21-day range: all events within range land in buckets", () => {
    const now = new Date(2025, 2, 15);
    const events: CalendarEvent[] = [];
    for (let i = 0; i < 21; i++) {
      events.push(makeEvent(new Date(2025, 2, 15 + i, 12, 0), `Day ${i}`));
    }
    const buckets = groupEventsByDay(events, now);
    for (let i = 0; i < 21; i++) {
      expect(buckets[i]!.events).toHaveLength(1);
      expect(buckets[i]!.events[0]!.summary).toBe(`Day ${i}`);
    }
  });

  it("events outside the 21-day window are excluded", () => {
    const now = new Date(2025, 2, 15);
    const tooFar = makeEvent(new Date(2025, 3, 10, 12, 0), "Too far");
    const buckets = groupEventsByDay([tooFar], now);
    const total = buckets.reduce((sum, b) => sum + b.events.length, 0);
    expect(total).toBe(0);
  });
});
