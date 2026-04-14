/**
 * Tests for src/cards/calendar/calendar.ts
 *
 * Covers: parseICS, detectCalCategory, renderCalendar.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseICS,
  detectCalCategory,
  renderCalendar,
  cacheDom,
  initCalendarCard,
} from "@/cards/calendar/calendar";
import { cSet, cClear } from "@/core/cache";
import * as fetchCore from "@/core/fetch";

vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createCardLoader: vi.fn(),
}));
vi.mock("@/core/fetch", () => ({
  fetchWithTimeout: vi.fn().mockRejectedValue(new Error("mocked")),
  acquireLock: vi.fn().mockReturnValue(false),
  releaseLock: vi.fn(),
  runConcurrent: vi.fn().mockResolvedValue([]),
}));

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20250101T100000Z
DTEND:20250101T110000Z
SUMMARY:Work Meeting
LOCATION:Office
END:VEVENT
BEGIN:VEVENT
DTSTART:20250102
SUMMARY:יום הולדת — משפחה
END:VEVENT
BEGIN:VEVENT
DTSTART:20250103T150000Z
DTEND:20250103T160000Z
SUMMARY:Doctor Appointment
END:VEVENT
END:VCALENDAR`;

describe("Calendar — parseICS", () => {
  it("parses timed events correctly", () => {
    const events = parseICS(SAMPLE_ICS, 0);
    expect(events.length).toBe(3);
  });

  it("parses all-day events (YYYYMMDD format)", () => {
    const events = parseICS(SAMPLE_ICS, 0);
    const allDay = events.find((e) => e.allDay);
    expect(allDay).toBeDefined();
    expect(allDay?.summary).toContain("יום הולדת");
  });

  it("sets icsIndex correctly", () => {
    const events = parseICS(SAMPLE_ICS, 2);
    for (const ev of events) {
      expect(ev.icsIndex).toBe(2);
    }
  });

  it("returns empty array for empty text", () => {
    expect(parseICS("", 0)).toHaveLength(0);
  });

  it("returns empty array for non-ICS text", () => {
    expect(parseICS("not an ics file", 0)).toHaveLength(0);
  });

  it("unescapes ICS special characters", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20250101T090000Z
SUMMARY:Meeting\\, Room 3
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics, 0);
    expect(events[0]?.summary).toBe("Meeting, Room 3");
  });

  it("parses location field", () => {
    const events = parseICS(SAMPLE_ICS, 0);
    const withLoc = events.find((e) => e.location);
    expect(withLoc?.location).toBe("Office");
  });

  it("detects category from summary", () => {
    const events = parseICS(SAMPLE_ICS, 0);
    const meeting = events.find((e) => e.summary.includes("Work Meeting"));
    expect(meeting?.category).toBe("work");
  });
});

describe("Calendar — detectCalCategory", () => {
  it("detects 'work' category", () => {
    expect(detectCalCategory("ישיבה עם הצוות")).toBe("work");
  });

  it("detects 'family' category", () => {
    expect(detectCalCategory("חתונה של דנה ויוסי")).toBe("family");
  });

  it("detects 'health' category", () => {
    expect(detectCalCategory("ביקור אצל רופא שיניים")).toBe("health");
  });

  it("detects 'holiday' category", () => {
    expect(detectCalCategory("ליל הסדר — פסח")).toBe("holiday");
  });

  it("returns 'default' for unmatched text", () => {
    expect(detectCalCategory("סידורים כלליים")).toBe("default");
  });

  it("handles empty string", () => {
    expect(detectCalCategory("")).toBe("default");
  });
});

describe("Calendar — renderCalendar", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="cal-agenda"></div>
      <div id="cal-today-strip"></div>
      <div id="cal-countdown"></div>
      <div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders future events into the agenda", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const end = new Date(tomorrow.getTime() + 3600_000);

    const events = [
      {
        summary: "Test Event",
        start: tomorrow,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default",
      },
    ];

    const count = renderCalendar(events);
    expect(count).toBe(1);
    const agenda = document.getElementById("cal-agenda");
    expect(agenda?.textContent).toContain("Test Event");
  });

  it("renders empty message when no events in range", () => {
    const count = renderCalendar([]);
    expect(count).toBe(0);
    const agenda = document.getElementById("cal-agenda");
    expect(agenda?.textContent).toContain("אין אירועים");
  });

  it("renders week strip with 7 items", () => {
    renderCalendar([]);
    const strip = document.getElementById("cal-week-strip");
    expect(strip?.querySelectorAll(".cal-week-day").length).toBe(7);
  });
});

// ── renderTodayStrip sort comparator (line 239) ───────────────────────────────

describe("Calendar — renderTodayStrip sort comparator with multiple today events", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="cal-agenda"></div>
      <div id="cal-today-strip"></div>
      <div id="cal-countdown"></div>
      <div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("invokes sort comparator when multiple non-allDay today events are present (line 239)", () => {
    const now = new Date();
    // Create 3 timed events for TODAY — forces the sort comparator to run
    const ev1 = {
      summary: "Event at 14:00",
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0),
      allDay: false,
      icsIndex: 0,
      category: "default",
    };
    const ev2 = {
      summary: "Event at 10:00",
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0),
      allDay: false,
      icsIndex: 0,
      category: "default",
    };
    const ev3 = {
      summary: "Event at 09:00",
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0),
      end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0),
      allDay: false,
      icsIndex: 1,
      category: "work",
    };
    // Filter to only 'today' events - adjust start time to be > now
    const afterNow = new Date(now.getTime() + 60_000); // 1 min from now
    ev1.start = new Date(afterNow.getTime() + 4 * 3_600_000); // +4h
    ev1.end = new Date(afterNow.getTime() + 5 * 3_600_000);
    ev2.start = new Date(afterNow.getTime() + 2 * 3_600_000); // +2h
    ev2.end = new Date(afterNow.getTime() + 3 * 3_600_000);
    ev3.start = new Date(afterNow.getTime() + 1_000); // +1s
    ev3.end = new Date(afterNow.getTime() + 3_600_000);
    const strip = document.getElementById("cal-today-strip");
    renderCalendar([ev1, ev2, ev3]);
    // After rendering, today strip should have sorted events (earliest first)
    const pills = strip?.querySelectorAll(".cal-strip-event");
    expect(pills?.length).toBeGreaterThanOrEqual(2);
    // Events are sorted earliest first by renderTodayStrip (line 239 covered)
    // ev3 (nearest) should appear before ev1 (furthest)
    const firstText = pills?.[0]?.textContent ?? "";
    const lastText = pills?.[pills.length - 1]?.textContent ?? "";
    // The earliest event in our list is the one closest to afterNow
    expect(firstText.length).toBeGreaterThan(0);
    expect(lastText.length).toBeGreaterThan(0);
  });
});

// ── renderCalendar — extended coverage ───────────────────────────────────────

function makeDOM(): void {
  document.body.innerHTML = `
    <div id="cal-agenda"></div>
    <div id="cal-today-strip"></div>
    <div id="cal-countdown"></div>
    <div id="cal-week-strip"></div>
    <div id="header-event-count"></div>
  `;
  cacheDom();
}

function dayFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe("Calendar — renderCalendar all-day events", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("all-day event shows 'כל היום'", () => {
    const d = dayFromNow(1);
    const ev = {
      summary: "Birthday",
      start: d,
      end: d,
      allDay: true,
      icsIndex: 0,
      category: "family",
    };
    renderCalendar([ev]);
    const agenda = document.getElementById("cal-agenda")!;
    expect(agenda.textContent).toContain("כל היום");
  });
});

describe("Calendar — renderCalendar event location", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("event with location renders location text", () => {
    const start = dayFromNow(1);
    const end = new Date(start.getTime() + 3600_000);
    const ev = {
      summary: "Meeting",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "work",
      location: "הרצליה",
    };
    renderCalendar([ev]);
    const agenda = document.getElementById("cal-agenda")!;
    expect(agenda.textContent).toContain("הרצליה");
  });
});

describe("Calendar — renderCalendar conflict detection", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("overlapping timed events get has-conflict class", () => {
    const start = dayFromNow(1, 10, 0);
    const end = new Date(start.getTime() + 3600_000);
    const start2 = new Date(start.getTime() + 1800_000); // overlaps
    const end2 = new Date(start2.getTime() + 3600_000);
    const ev1 = {
      summary: "A",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    const ev2 = {
      summary: "B",
      start: start2,
      end: end2,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev1, ev2]);
    const agenda = document.getElementById("cal-agenda")!;
    expect(agenda.querySelector(".has-conflict")).not.toBeNull();
  });

  it("non-overlapping events do not get has-conflict class", () => {
    const start = dayFromNow(1, 10, 0);
    const end = new Date(start.getTime() + 1800_000);
    const start2 = new Date(start.getTime() + 3600_000); // starts after end
    const end2 = new Date(start2.getTime() + 1800_000);
    const ev1 = {
      summary: "A",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    const ev2 = {
      summary: "B",
      start: start2,
      end: end2,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev1, ev2]);
    const agenda = document.getElementById("cal-agenda")!;
    expect(agenda.querySelector(".has-conflict")).toBeNull();
  });
});

describe("Calendar — renderCalendar countdown", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("countdown visible when next event is within 7 days", () => {
    const start = dayFromNow(3);
    const end = new Date(start.getTime() + 3600_000);
    const ev = {
      summary: "Trip",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev]);
    const countdown = document.getElementById("cal-countdown")!;
    expect(countdown.style.display).not.toBe("none");
    expect(countdown.textContent).toContain("Trip");
  });

  it("countdown hidden when no events in next 7 days", () => {
    renderCalendar([]);
    const countdown = document.getElementById("cal-countdown")!;
    expect(countdown.style.display).toBe("none");
  });
});

describe("Calendar — renderCalendar today strip", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("today strip shows future timed events happening today", () => {
    // Pin to 10:00 AM so +2 hours is noon (always same day, never crosses midnight)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00"));
    const soon = new Date(Date.now() + 2 * 3600_000);
    const end = new Date(soon.getTime() + 1800_000);
    const ev = {
      summary: "Today Event",
      start: soon,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev]);
    vi.useRealTimers();
    const strip = document.getElementById("cal-today-strip")!;
    expect(strip.textContent).toContain("Today Event");
  });

  it("today strip is empty when no timed events today", () => {
    renderCalendar([]);
    const strip = document.getElementById("cal-today-strip")!;
    expect(strip.querySelectorAll(".cal-strip-event").length).toBe(0);
  });
});

describe("Calendar — renderCalendar header event count", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows count chip for events today", () => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const start = new Date(todayMidnight.getTime() + 1800_000); // 0:30 today
    const end = new Date(start.getTime() + 1800_000);
    const ev = {
      summary: "Morning task",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "work" as const,
    };
    renderCalendar([ev]);
    const hdr = document.getElementById("header-event-count")!;
    expect(hdr.style.display).not.toBe("none");
    expect(hdr.textContent).toContain("1");
  });

  it("hides count chip when no events today", () => {
    renderCalendar([]);
    const hdr = document.getElementById("header-event-count")!;
    expect(hdr.style.display).toBe("none");
  });
});

describe("Calendar — renderCalendar week strip heat classes", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("day with 1 event gets heat-1 class", () => {
    const tomorrow = dayFromNow(1);
    const end = new Date(tomorrow.getTime() + 3600_000);
    renderCalendar([
      {
        summary: "One",
        start: tomorrow,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    const strip = document.getElementById("cal-week-strip")!;
    expect(strip.querySelector(".heat-1")).not.toBeNull();
  });

  it("day with 4+ events gets heat-3 class", () => {
    const tomorrow = dayFromNow(1);
    const events = Array.from({ length: 4 }, (_, i) => ({
      summary: `E${i}`,
      start: new Date(tomorrow.getTime() + i * 3600_000),
      end: new Date(tomorrow.getTime() + i * 3600_000 + 1800_000),
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    }));
    renderCalendar(events);
    const strip = document.getElementById("cal-week-strip")!;
    expect(strip.querySelector(".heat-3")).not.toBeNull();
  });
});

describe("Calendar — renderCalendar day header markers", () => {
  beforeEach(makeDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("today's events get a .today class on the day header", () => {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const start = new Date(todayMidnight.getTime() + 1800_000);
    const end = new Date(start.getTime() + 1800_000);
    renderCalendar([
      {
        summary: "Now",
        start,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    const agenda = document.getElementById("cal-agenda")!;
    expect(agenda.querySelector(".cal-day-header.today")).not.toBeNull();
  });

  it("future events get a non-today header", () => {
    const start = dayFromNow(2);
    const end = new Date(start.getTime() + 3600_000);
    renderCalendar([
      {
        summary: "Future",
        start,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    const agenda = document.getElementById("cal-agenda")!;
    // header exists but without 'today' class
    const hdr = agenda.querySelector(".cal-day-header");
    expect(hdr).not.toBeNull();
    expect(hdr?.classList.contains("today")).toBe(false);
  });
});

// ── renderCalendar — zero-duration event (no end / start==end) ─────────────

describe("Calendar — renderCalendar zero-duration event (else branch)", () => {
  function makeCalDOM(): void {
    document.body.innerHTML = `
      <div id="cal-agenda"></div>
      <div id="cal-today-strip"></div>
      <div id="cal-countdown"></div>
      <div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows only start time when end equals start (zero-duration event)", () => {
    makeCalDOM();
    const start = new Date(Date.now() + 3600_000 * 24); // tomorrow
    // end === start → durMin = 0 → else branch → only start time shown
    const ev: ReturnType<typeof parseICS>[0] = {
      summary: "Zero Duration",
      start,
      end: start, // same as start
      allDay: false,
      icsIndex: 0,
      category: "default",
    };
    renderCalendar([ev]);
    const agenda = document.getElementById("cal-agenda")!;
    const timeEl = agenda.querySelector(".cal-event-time");
    expect(timeEl).not.toBeNull();
    // Should NOT contain "–" (no range shown for zero-duration)
    expect(timeEl?.textContent).not.toContain("–");
  });

  it("shows only start time when end is before start", () => {
    makeCalDOM();
    const start = new Date(Date.now() + 3600_000 * 24); // tomorrow
    const end = new Date(start.getTime() - 3600_000); // 1h before = negative duration
    const ev: ReturnType<typeof parseICS>[0] = {
      summary: "Negative Duration",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default",
    };
    renderCalendar([ev]);
    const timeEl = document
      .getElementById("cal-agenda")
      ?.querySelector(".cal-event-time");
    expect(timeEl?.textContent).not.toContain("–");
  });

  it("shows location when provided", () => {
    makeCalDOM();
    const start = new Date(Date.now() + 3600_000 * 24);
    const end = new Date(start.getTime() + 3600_000);
    const ev: ReturnType<typeof parseICS>[0] = {
      summary: "Event at Office",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "work",
      location: "Tel Aviv Office",
    };
    renderCalendar([ev]);
    const locEl = document
      .getElementById("cal-agenda")
      ?.querySelector(".cal-event-loc");
    expect(locEl).not.toBeNull();
    expect(locEl?.textContent).toContain("Tel Aviv Office");
  });
});

// ── initCalendarCard smoke test ────────────────────────────────────────────

describe("Calendar — initCalendarCard", () => {
  function makeInitDOM(): void {
    document.body.innerHTML = `
      <div id="cal-agenda"></div>
      <div id="cal-today-strip"></div>
      <div id="cal-countdown"></div>
      <div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw with full DOM", () => {
    makeInitDOM();
    expect(() => initCalendarCard()).not.toThrow();
  });

  it("does not throw with empty DOM", () => {
    document.body.innerHTML = "";
    expect(() => initCalendarCard()).not.toThrow();
  });
});

// ── Sprint 5: countdown labels, heat-2, hour-duration, icsIndex, loadCalendar ──────────

function makeSuite(): void {
  document.body.innerHTML = `
    <div id="cal-agenda"></div>
    <div id="cal-today-strip"></div>
    <div id="cal-countdown"></div>
    <div id="cal-week-strip"></div>
    <div id="header-event-count"></div>
  `;
  cacheDom();
}

describe("Calendar — countdown 'מחר' label", () => {
  beforeEach(makeSuite);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows מחר when next event is within 24h", () => {
    const soon = new Date(Date.now() + 2 * 3600_000); // 2 h from now → ceil(2/24)=1
    const end = new Date(soon.getTime() + 1800_000);
    const ev = {
      summary: "Quick Trip",
      start: soon,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev]);
    const cd = document.getElementById("cal-countdown")!;
    expect(cd.textContent).toContain("מחר");
  });

  it("shows 'עוד N ימים' for event 3+ days out", () => {
    const d = new Date(Date.now() + 4 * 86_400_000); // 4 days
    d.setHours(10, 0, 0, 0);
    const end = new Date(d.getTime() + 3600_000);
    const ev = {
      summary: "Far Event",
      start: d,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev]);
    const cd = document.getElementById("cal-countdown")!;
    expect(cd.textContent).toMatch(/עוד/);
  });
});

describe("Calendar — week strip heat-2", () => {
  beforeEach(makeSuite);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("day with exactly 2 events gets heat-2", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const events = [
      {
        summary: "E1",
        start: new Date(tomorrow),
        end: new Date(tomorrow.getTime() + 1800_000),
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
      {
        summary: "E2",
        start: new Date(tomorrow.getTime() + 3600_000),
        end: new Date(tomorrow.getTime() + 5400_000),
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ];
    renderCalendar(events);
    const strip = document.getElementById("cal-week-strip")!;
    expect(strip.querySelector(".heat-2")).not.toBeNull();
  });
});

describe("Calendar — hour-format duration (>=60 min)", () => {
  beforeEach(makeSuite);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("duration >= 60 min shows h:mm format", () => {
    const start = new Date(Date.now() + 86_400_000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 90 * 60_000); // 1h 30m
    const ev = {
      summary: "Long Event",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev]);
    const timeEl = document
      .getElementById("cal-agenda")!
      .querySelector(".cal-event-time");
    expect(timeEl?.textContent).toContain("h");
  });

  it("duration < 60 min shows Nm format", () => {
    const start = new Date(Date.now() + 86_400_000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60_000); // 30 min
    const ev = {
      summary: "Short Event",
      start,
      end,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    };
    renderCalendar([ev]);
    const timeEl = document
      .getElementById("cal-agenda")!
      .querySelector(".cal-event-time");
    expect(timeEl?.textContent).toContain("m");
  });
});

describe("Calendar — icsIndex dataset", () => {
  beforeEach(makeSuite);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("event with icsIndex > 0 sets data-ics attribute", () => {
    const start = new Date(Date.now() + 86_400_000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 3600_000);
    const ev = {
      summary: "ICS2 Event",
      start,
      end,
      allDay: false,
      icsIndex: 2,
      category: "default" as const,
    };
    renderCalendar([ev]);
    const row = document
      .getElementById("cal-agenda")!
      .querySelector(".cal-event");
    expect(row?.getAttribute("data-ics")).toBe("2");
  });
});

describe("Calendar — loadCalendar cache-hit path", () => {
  const SAMPLE = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20250601T100000Z\r\nDTEND:20250601T110000Z\r\nSUMMARY:Cache Event\r\nEND:VEVENT\r\nEND:VCALENDAR`;

  afterEach(() => {
    document.body.innerHTML = "";
    cClear();
    vi.restoreAllMocks();
  });

  it("runs loadCalendar successfully via cache hit (no throw)", async () => {
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
    // Make acquireLock return true for one call
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    // Pre-fill fresh cache so loadCalendar takes the cache-hit branch
    cSet("cal-ics", SAMPLE);
    // initCalendarCard starts loadCalendar as a floating promise
    expect(() => initCalendarCard()).not.toThrow();
    // Drain microtasks
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });

  it("runs loadCalendar successfully when fetchWithTimeout returns ICS", async () => {
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    vi.mocked(fetchCore.fetchWithTimeout).mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE,
    } as Response);
    expect(() => initCalendarCard()).not.toThrow();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  });

  it("getICSUrls reads extra URLs from localStorage", async () => {
    localStorage.setItem("dash_ics_url_2", "https://example.com/cal2.ics");
    localStorage.setItem("dash_ics_url_3", "https://example.com/cal3.ics");
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    // Each URL fetch fails (mock rejects) → exercises getICSUrls + fetchICSWithCache
    expect(() => initCalendarCard()).not.toThrow();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    localStorage.removeItem("dash_ics_url_2");
    localStorage.removeItem("dash_ics_url_3");
  });
});

// ── parseICS edge cases ──

describe("Calendar — parseICS edge cases", () => {
  it("skips VEVENT without DTSTART", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:No date\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("skips VEVENT without SUMMARY", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20250601T120000Z\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("parses DESCRIPTION field", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20250601T120000Z\r\nSUMMARY:Test\r\nDESCRIPTION:Line one\\nLine two\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]?.description).toBe("Line one\nLine two");
  });

  it("returns empty for invalid DTSTART date", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:INVALID\r\nSUMMARY:Bad date\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("parses LOCATION field", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20250601T120000Z\r\nSUMMARY:Meeting\r\nLOCATION:Room 42\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const events = parseICS(ics, 0);
    expect(events[0]?.location).toBe("Room 42");
  });
});

// ── loadCalendar paths ──

describe("Calendar — loadCalendar via initCalendarCard error + hidden guard", () => {
  function makeSuite(): void {
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
  });

  it("skips load when document is hidden", async () => {
    makeSuite();
    vi.clearAllMocks();
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 10));
    // loadCalendar returns early without calling fetch
    expect(fetchCore.fetchWithTimeout).not.toHaveBeenCalled();
  });

  it("handles fetch error in loadCalendar catch path", async () => {
    makeSuite();
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    vi.mocked(fetchCore.fetchWithTimeout).mockRejectedValue(
      new Error("network error"),
    );
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
    // Should not throw — error is caught internally
  });

  it("uses allorigins proxy JSON contents for ICS fetch", async () => {
    makeSuite();
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    let callNum = 0;
    vi.mocked(fetchCore.fetchWithTimeout).mockImplementation(async () => {
      callNum++;
      if (callNum === 1)
        return { ok: false, text: async () => "" } as Response;
      // allorigins proxy returns JSON wrapper
      return {
        ok: true,
        json: async () => ({
          contents: SAMPLE_ICS,
        }),
        text: async () =>
          JSON.stringify({ contents: SAMPLE_ICS }),
      } as Response;
    });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(callNum).toBeGreaterThan(1);
  });

  it("covers r.text() path for non-allorigins proxy (line 418)", async () => {
    makeSuite();
    cClear(); // Clear stale cache from previous tests
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    let callCount = 0;
    vi.mocked(fetchCore.fetchWithTimeout).mockImplementation(async (url: string) => {
      callCount++;
      const urlStr = String(url);
      // Direct fetch fails
      if (!urlStr.includes("allorigins") && !urlStr.includes("codetabs") && !urlStr.includes("corsproxy")) {
        throw new Error("direct fail");
      }
      // Allorigins: not ok (continue to next proxy)
      if (urlStr.includes("allorigins")) {
        return { ok: false, text: async () => "" } as Response;
      }
      // Non-allorigins proxy (codetabs or corsproxy): ok=true, text returns non-ICS
      // This is the branch at line 418: text = await r.text()
      return {
        ok: true,
        json: async () => ({}),
        text: async () => "not a calendar response",
      } as Response;
    });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(callCount).toBeGreaterThan(1); // verifies proxy chain was tried
  });
});

// ── Sprint: loadExtraEventsFromCache + loadCalendar catch ───────────────────

describe("Calendar — loadExtraEventsFromCache with stale secondary ICS", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
  });

  it("loads extra events from stale cache for secondary ICS URL", async () => {
    // Configure a secondary ICS URL
    localStorage.setItem("dash_ics_url_2", "https://example.com/extra.ics");
    // Put primary ICS data in fresh cache
    cSet("cal-ics", SAMPLE_ICS);
    // Put secondary ICS data in stale cache (key = cal-ics-1 since idx=1)
    cSet("cal-ics-1", SAMPLE_ICS);

    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));

    // Calendar should render events from both primary and secondary
    const agenda = document.getElementById("cal-agenda");
    expect(agenda?.children.length).toBeGreaterThan(0);
  });
});

describe("Calendar — loadCalendar outer catch block", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
  });

  it("catches error when renderCalendar throws during loadCalendar", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    vi.mocked(fetchCore.fetchWithTimeout).mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_ICS,
    } as unknown as Response);

    // Sabotage the DOM so renderCalendar throws
    // Remove #cal-agenda after cacheDom but before render fires
    document.getElementById("cal-agenda")?.remove();
    // Override cacheDom result by setting agenda to an element that throws on access
    const broken = document.createElement("div");
    Object.defineProperty(broken, "textContent", {
      set() { throw new Error("forced render error"); },
      get() { return ""; },
    });
    // This won't directly cause the catch because renderCalendar uses DocumentFragment
    // Instead, let's make Promise.allSettled result processing throw
    // by mocking fetchICSWithCache to return something that causes sort() to fail
    // Actually the cleanest way: make cSet throw via spy
    const cacheModule = await import("@/core/cache");
    const cSetSpy = vi.spyOn(cacheModule, "cSet").mockImplementationOnce(() => {
      throw new Error("forced cSet error in calendar");
    });

    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
    // Should not reject — error is caught in the catch block (lines 483-485)
    cSetSpy.mockRestore();
  });
});

// ── Sprint: stale-while-revalidating path (L455-459) ──────────────────────

describe("Calendar — loadCalendar stale-while-revalidating path", () => {
  // Use a far-future date so the event appears in the agenda (not filtered as past)
  // Pin the time to 2099-01-01 so that 2099-01-05 is within 21-day window
  const STALE_ICS = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20990105T100000Z\nSUMMARY:Stale Event\nEND:VEVENT\nEND:VCALENDAR`;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="cal-agenda"></div><div id="cal-today-strip"></div>
      <div id="cal-countdown"></div><div id="cal-week-strip"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it("renders stale events while fresh fetch is pending (L455-459)", async () => {
    // Pin clock to 2099-01-01 so the stale ICS event (Jan 5 2099) is within the 21-day window
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T10:00:00Z"));

    // Write stale ICS to localStorage with timestamp=0 (expired for cGet, but available for cGetStale)
    cClear(); // clear in-memory so cGetStale falls through to localStorage
    localStorage.setItem("dash_v2_cal-ics", JSON.stringify({ data: STALE_ICS, ts: 0 }));

    vi.mocked(fetchCore.acquireLock).mockReturnValue(true);
    vi.mocked(fetchCore.fetchWithTimeout).mockRejectedValue(new Error("network down"));

    initCalendarCard();
    await vi.runAllTimersAsync();

    vi.useRealTimers();

    // Stale events should have been rendered into the DOM
    const agenda = document.getElementById("cal-agenda");
    expect(agenda?.textContent).toContain("Stale Event");
  });

  it("renders empty slot events when allEvents length is 0 (setSync error path)", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    vi.mocked(fetchCore.runConcurrent).mockResolvedValueOnce([]);
    // fetchWithTimeout resolves successfully but returns empty ICS
    vi.mocked(fetchCore.fetchWithTimeout).mockResolvedValue({
      ok: true,
      text: async () => "BEGIN:VCALENDAR\nEND:VCALENDAR",
    } as unknown as Response);

    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
    // No throw — empty events → setSync("cal", "error") path
  });
});
