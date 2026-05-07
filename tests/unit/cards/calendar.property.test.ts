/**
 * fast-check property tests — src/cards/calendar/calendar.ts ( , extended )
 *
 * Properties under test:
 *  CAL1. detectCalCategory: always returns one of known categories
 *  CAL2. detectCalCategory: work keywords → "work"
 *  CAL3. detectCalCategory: family keywords → "family"
 *  CAL4. detectCalCategory: health keywords → "health"
 *  CAL5. calDaysUntilLabel: same day → ""
 *  CAL6. calDaysUntilLabel: tomorrow → "מחר"
 *  CAL7. calDaysUntilLabel: >1 day → "עוד N ימים"
 *  CAL8. findConflicts: non-overlapping → empty set
 *  CAL9. findConflicts: overlapping pair → both in set
 *  CAL10. parseICS: empty string → empty array
 *  CAL11. groupEventsByDay: returns 21 buckets (CAL_WEEK_DAYS)
 *  CAL12. groupEventsByDay: events sorted within each bucket
 *  CAL13. getHolidaysByDate: returns null for empty items
 *  CAL14. getHolidaysByDate: matching items → non-null string
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  detectCalCategory,
  groupEventsByDay,
  getHolidaysByDate,
  calDaysUntilLabel,
  findConflicts,
  parseICS,
} from "@/cards/calendar/calendar";

const VALID_CATEGORIES = ["work", "family", "health", "holiday", "default"];

// ── CAL1: detectCalCategory returns known category ───────────────────────────

describe("calendar — CAL1: detectCalCategory valid", () => {
  it("always returns a known category", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (s) => {
        expect(VALID_CATEGORIES).toContain(detectCalCategory(s));
      }),
      { numRuns: 30 },
    );
  });
});

// ── CAL2: work keywords ──────────────────────────────────────────────────────

describe("calendar — CAL2: work keywords", () => {
  it("classifies work terms correctly", () => {
    const workTerms = ["meeting", "פגישה", "office", "zoom", "ישיבה", "עבודה"];
    for (const term of workTerms) {
      expect(detectCalCategory(term)).toBe("work");
    }
  });
});

// ── CAL3: family keywords ────────────────────────────────────────────────────

describe("calendar — CAL3: family keywords", () => {
  it("classifies family terms correctly", () => {
    const familyTerms = ["family", "משפחה", "ילדים", "הורים", "dinner"];
    for (const term of familyTerms) {
      expect(detectCalCategory(term)).toBe("family");
    }
  });
});

// ── CAL4: health keywords ────────────────────────────────────────────────────

describe("calendar — CAL4: health keywords", () => {
  it("classifies health terms correctly", () => {
    const healthTerms = ["doctor", "רופא", "medical", "clinic", "שיניים"];
    for (const term of healthTerms) {
      expect(detectCalCategory(term)).toBe("health");
    }
  });
});

// ── CAL5: same day → "" ──────────────────────────────────────────────────────

describe("calendar — CAL5: calDaysUntilLabel same day", () => {
  it("returns empty for today", () => {
    const now = new Date(2025, 0, 15, 10, 0, 0);
    const sameDay = new Date(2025, 0, 15, 20, 0, 0);
    expect(calDaysUntilLabel(sameDay, now)).toBe("");
  });
});

// ── CAL6: tomorrow → "מחר" ───────────────────────────────────────────────────

describe("calendar — CAL6: calDaysUntilLabel tomorrow", () => {
  it("returns 'מחר' for next day", () => {
    const now = new Date(2025, 0, 15);
    const tomorrow = new Date(2025, 0, 16);
    expect(calDaysUntilLabel(tomorrow, now)).toBe("מחר");
  });
});

// ── CAL7: >1 day → "עוד N ימים" ─────────────────────────────────────────────

describe("calendar — CAL7: calDaysUntilLabel N days", () => {
  it("returns correct day count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 30 }), (days) => {
        const now = new Date(2025, 0, 1);
        const future = new Date(2025, 0, 1 + days);
        expect(calDaysUntilLabel(future, now)).toBe(`עוד ${days} ימים`);
      }),
      { numRuns: 15 },
    );
  });
});

// ── CAL8: findConflicts non-overlapping → empty ──────────────────────────────

describe("calendar — CAL8: findConflicts non-overlapping", () => {
  it("no conflicts when events are sequential", () => {
    const events = [
      { summary: "A", start: new Date(2025, 0, 1, 9, 0), end: new Date(2025, 0, 1, 10, 0), allDay: false, icsIndex: 0, category: "default" },
      { summary: "B", start: new Date(2025, 0, 1, 10, 0), end: new Date(2025, 0, 1, 11, 0), allDay: false, icsIndex: 0, category: "default" },
      { summary: "C", start: new Date(2025, 0, 1, 11, 0), end: new Date(2025, 0, 1, 12, 0), allDay: false, icsIndex: 0, category: "default" },
    ];
    expect(findConflicts(events).size).toBe(0);
  });
});

// ── CAL9: findConflicts overlapping pair ─────────────────────────────────────

describe("calendar — CAL9: findConflicts overlapping", () => {
  it("detects overlapping pair", () => {
    const events = [
      { summary: "A", start: new Date(2025, 0, 1, 9, 0), end: new Date(2025, 0, 1, 10, 30), allDay: false, icsIndex: 0, category: "default" },
      { summary: "B", start: new Date(2025, 0, 1, 10, 0), end: new Date(2025, 0, 1, 11, 0), allDay: false, icsIndex: 0, category: "default" },
    ];
    const conflicts = findConflicts(events);
    expect(conflicts.size).toBe(2);
  });
});

// ── CAL10: parseICS empty → [] ───────────────────────────────────────────────

describe("calendar — CAL10: parseICS empty", () => {
  it("returns empty for empty string", () => {
    expect(parseICS("")).toEqual([]);
  });

  it("returns empty for no VEVENT blocks", () => {
    expect(parseICS("BEGIN:VCALENDAR\nEND:VCALENDAR")).toEqual([]);
  });
});

// ── CAL11: groupEventsByDay returns 7 buckets ────────────────────────────────

describe("calendar — CAL11: groupEventsByDay bucket count", () => {
  it("always returns 7 day buckets", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1) }),
        (now) => {
          const result = groupEventsByDay([], now);
          expect(result.length).toBe(21);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── CAL12: groupEventsByDay events sorted within bucket ──────────────────────

describe("calendar — CAL12: groupEventsByDay sorted", () => {
  it("events within each bucket are in chronological order", () => {
    const now = new Date(2025, 5, 15);
    const events = [
      { summary: "B", start: new Date(2025, 5, 15, 14, 0), end: new Date(2025, 5, 15, 15, 0), allDay: false, icsIndex: 0 },
      { summary: "A", start: new Date(2025, 5, 15, 9, 0), end: new Date(2025, 5, 15, 10, 0), allDay: false, icsIndex: 0 },
    ];
    const result = groupEventsByDay(events, now);
    const todayBucket = result[0]!;
    expect(todayBucket.events.length).toBe(2);
    expect(todayBucket.events[0]!.summary).toBe("A");
    expect(todayBucket.events[1]!.summary).toBe("B");
  });
});

// ── CAL13: getHolidaysByDate empty → null ────────────────────────────────────

describe("calendar — CAL13: getHolidaysByDate empty", () => {
  it("returns null for empty items array", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 0, 1) }),
        (d) => {
          expect(getHolidaysByDate([], d)).toBeNull();
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ── CAL14: getHolidaysByDate matching → non-null ─────────────────────────────

describe("calendar — CAL14: getHolidaysByDate match", () => {
  it("returns non-null string when items match the date", () => {
    const d = new Date(2025, 5, 15);
    const items = [
      { title: "Shabbat", hebrew: "שבת", date: "2025-06-15", category: "holiday" as const },
    ];
    const result = getHolidaysByDate(items, d);
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
  });
});
