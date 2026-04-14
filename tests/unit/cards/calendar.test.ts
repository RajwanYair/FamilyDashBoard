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
    // Use a time 2 hours from now so it's "today" and in the future
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
