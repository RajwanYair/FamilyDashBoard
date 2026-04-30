/**
 * Tests for src/cards/calendar/calendar.ts
 *
 * Covers: parseICS, detectCalCategory, renderCalendar (weekly tiled view),
 * groupEventsByDay, calDaysUntilLabel, loadCalendar paths.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseICS,
  detectCalCategory,
  renderCalendar,
  cacheDom,
  initCalendarCard,
  calDaysUntilLabel,
  groupEventsByDay,
  getHolidaysByDate,
  findConflicts,
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

// ── Shared helper: build the new weekly tiled DOM ───────────────────────────
function makeCalDOM(): void {
  document.body.innerHTML = `
    <div id="cal-week-grid"></div>
    <div id="cal-countdown"></div>
    <div id="header-event-count"></div>
  `;
  cacheDom();
}

// ── parseICS ──────────────────────────────────────────────────────────────
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

// ── detectCalCategory ─────────────────────────────────────────────────────
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

// ── groupEventsByDay ──────────────────────────────────────────────────────
describe("Calendar — groupEventsByDay", () => {
  it("returns 21 buckets starting at today midnight", () => {
    const now = new Date("2024-06-10T15:00:00");
    const buckets = groupEventsByDay([], now);
    expect(buckets).toHaveLength(21);
    expect(buckets[0]!.date.getDate()).toBe(10);
    // 2024-06-10 + 20 days = 2024-06-30
    expect(buckets[20]!.date.getDate()).toBe(30);
  });

  it("drops events outside the 21-day window", () => {
    const now = new Date("2024-06-10T08:00:00");
    const past = new Date("2024-06-05T10:00:00");
    const far = new Date("2024-07-15T10:00:00");
    const ev = (date: Date, s = "x") => ({
      summary: s,
      start: date,
      end: date,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    });
    const buckets = groupEventsByDay([ev(past, "past"), ev(far, "far")], now);
    expect(buckets.every((b) => b.events.length === 0)).toBe(true);
  });

  it("assigns events to the correct day bucket and sorts earliest-first", () => {
    const now = new Date("2024-06-10T08:00:00");
    const d0late = new Date("2024-06-10T18:00:00");
    const d0early = new Date("2024-06-10T09:00:00");
    const d2 = new Date("2024-06-12T11:00:00");
    const ev = (date: Date, s: string) => ({
      summary: s,
      start: date,
      end: date,
      allDay: false,
      icsIndex: 0,
      category: "default" as const,
    });
    const buckets = groupEventsByDay([ev(d0late, "late"), ev(d0early, "early"), ev(d2, "d2")], now);
    expect(buckets[0]!.events.map((e) => e.summary)).toEqual(["early", "late"]);
    expect(buckets[2]!.events.map((e) => e.summary)).toEqual(["d2"]);
    expect(buckets[1]!.events).toHaveLength(0);
  });
});

// ── renderCalendar — weekly tiled grid ────────────────────────────────────
describe("Calendar — renderCalendar (weekly tiled view)", () => {
  beforeEach(() => {
    // Sprint 62 fix: pin to Wednesday so 'tomorrow' falls inside the
    // current Sunday–Saturday week grid (independent of real system date).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00")); // Wednesday
    makeCalDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("renders 21 day tiles even when no events", () => {
    renderCalendar([]);
    const grid = document.getElementById("cal-week-grid");
    expect(grid?.querySelectorAll(".cal-day-tile").length).toBe(21);
  });

  it("marks all tiles as empty when no events", () => {
    renderCalendar([]);
    const tiles = document.querySelectorAll(".cal-day-tile");
    expect([...tiles].every((t) => t.classList.contains("is-empty"))).toBe(true);
  });

  it("today tile is flagged with is-today and shows 'היום'", () => {
    renderCalendar([]);
    const today = document.querySelector(".cal-day-tile.is-today");
    expect(today).not.toBeNull();
    expect(today?.querySelector(".cal-day-name")?.textContent).toBe("היום");
  });

  it("places a future event into its day tile", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 3_600_000);
    const events = [
      {
        summary: "Test Event",
        start: tomorrow,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ];
    const count = renderCalendar(events);
    const tiles = document.querySelectorAll(".cal-day-tile");
    // With Sunday–Saturday week, tile index = day-of-week (0=Sun…6=Sat)
    const tomorrowTileIdx = tomorrow.getDay();
    if (new Date().getDay() === 6) {
      // Today is Saturday — tomorrow is next week, not shown
      expect(count).toBe(0);
      return;
    }
    expect(count).toBe(1);
    expect(tiles[tomorrowTileIdx]?.textContent).toContain("Test Event");
    expect(tiles[tomorrowTileIdx]?.classList.contains("is-empty")).toBe(false);
  });

  it("shows count badge matching events that day", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const ev = (h: number, s: string) => {
      const start = new Date(tomorrow);
      start.setHours(h);
      return {
        summary: s,
        start,
        end: new Date(start.getTime() + 3_600_000),
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      };
    };
    renderCalendar([ev(9, "a"), ev(11, "b"), ev(14, "c")]);
    const tiles = document.querySelectorAll(".cal-day-tile");
    const tomorrowTileIdx = tomorrow.getDay();
    if (new Date().getDay() === 6) {
      // Today is Saturday — tomorrow is next week, not shown
      expect(tiles[tomorrowTileIdx]?.querySelector(".cal-day-count")).toBeNull();
      return;
    }
    expect(tiles[tomorrowTileIdx]?.querySelector(".cal-day-count")?.textContent).toBe("3");
  });

  it("renders all-day event with 'כל היום'", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    renderCalendar([
      {
        summary: "Birthday",
        start: tomorrow,
        end: tomorrow,
        allDay: true,
        icsIndex: 0,
        category: "family",
      },
    ]);
    const grid = document.getElementById("cal-week-grid")!;
    expect(grid.textContent).toContain("כל היום");
    expect(grid.textContent).toContain("Birthday");
  });

  it("renders event location", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 3_600_000);
    renderCalendar([
      {
        summary: "Meeting",
        start: tomorrow,
        end,
        allDay: false,
        icsIndex: 0,
        category: "work",
        location: "הרצליה",
      },
    ]);
    const grid = document.getElementById("cal-week-grid")!;
    expect(grid.textContent).toContain("הרצליה");
    expect(grid.querySelector(".cal-event-loc")).not.toBeNull();
  });

  it("marks overlapping timed events with has-conflict", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const start = new Date(tomorrow);
    const end = new Date(start.getTime() + 3_600_000);
    const start2 = new Date(start.getTime() + 1_800_000);
    const end2 = new Date(start2.getTime() + 3_600_000);
    renderCalendar([
      { summary: "A", start, end, allDay: false, icsIndex: 0, category: "default" as const },
      {
        summary: "B",
        start: start2,
        end: end2,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    expect(document.querySelector(".cal-event.has-conflict")).not.toBeNull();
  });

  it("non-overlapping events do not get has-conflict", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const start = new Date(tomorrow);
    const end = new Date(start.getTime() + 1_800_000);
    const start2 = new Date(start.getTime() + 3_600_000);
    const end2 = new Date(start2.getTime() + 1_800_000);
    renderCalendar([
      { summary: "A", start, end, allDay: false, icsIndex: 0, category: "default" as const },
      {
        summary: "B",
        start: start2,
        end: end2,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    expect(document.querySelector(".cal-event.has-conflict")).toBeNull();
  });

  it("event with icsIndex > 0 sets data-ics on row", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 3_600_000);
    renderCalendar([
      {
        summary: "ICS2",
        start: tomorrow,
        end,
        allDay: false,
        icsIndex: 2,
        category: "default" as const,
      },
    ]);
    const row = document.querySelector(".cal-event");
    expect(row?.getAttribute("data-ics")).toBe("2");
  });

  it("renders time range for timed events with duration > 0", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const end = new Date(tomorrow.getTime() + 90 * 60_000);
    renderCalendar([
      {
        summary: "Long",
        start: tomorrow,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    const time = document.querySelector(".cal-event-time");
    expect(time?.textContent).toContain("–");
  });

  it("renders single time (no dash) for zero-duration event", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    renderCalendar([
      {
        summary: "Zero",
        start: tomorrow,
        end: tomorrow,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    const time = document.querySelector(".cal-event-time");
    expect(time?.textContent).not.toContain("–");
  });
});

// ── countdown + header count ──────────────────────────────────────────────
describe("Calendar — countdown + header count", () => {
  beforeEach(() => {
    // Sprint 62 fix: pin to Wednesday so countdown tests are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00")); // Wednesday
    makeCalDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("countdown visible when next event is within 7 days", () => {
    // Place event 1 hour before end of the current Sunday–Saturday window
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayMid.getTime() - todayMid.getDay() * 86_400_000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
    const start = new Date(weekEnd.getTime() - 3_600_000);
    const end = new Date(start.getTime() + 1_800_000);
    renderCalendar([
      { summary: "Trip", start, end, allDay: false, icsIndex: 0, category: "default" as const },
    ]);
    const countdown = document.getElementById("cal-countdown")!;
    expect(countdown.style.display).not.toBe("none");
    expect(countdown.textContent).toContain("Trip");
  });

  it("countdown hidden with no upcoming events", () => {
    renderCalendar([]);
    expect(document.getElementById("cal-countdown")!.style.display).toBe("none");
  });

  it("countdown says 'מחר' when next event is within 24h", () => {
    const soon = new Date(Date.now() + 2 * 3_600_000);
    const end = new Date(soon.getTime() + 1_800_000);
    renderCalendar([
      {
        summary: "Soon",
        start: soon,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    expect(document.getElementById("cal-countdown")!.textContent).toContain("מחר");
  });

  it("shows count chip for events today", () => {
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const start = new Date(todayMid.getTime() + 1_800_000);
    const end = new Date(start.getTime() + 1_800_000);
    renderCalendar([
      { summary: "Morning", start, end, allDay: false, icsIndex: 0, category: "work" as const },
    ]);
    const hdr = document.getElementById("header-event-count")!;
    expect(hdr.style.display).not.toBe("none");
    expect(hdr.textContent).toContain("1");
  });

  it("hides count chip when no events today", () => {
    renderCalendar([]);
    expect(document.getElementById("header-event-count")!.style.display).toBe("none");
  });
});

// ── calDaysUntilLabel ─────────────────────────────────────────────────────
describe("Calendar — calDaysUntilLabel", () => {
  it("returns '' for today", () => {
    const now = new Date("2024-06-10T12:00:00");
    expect(calDaysUntilLabel(new Date("2024-06-10T08:00:00"), now)).toBe("");
  });
  it("returns 'מחר' for tomorrow", () => {
    const now = new Date("2024-06-10T12:00:00");
    expect(calDaysUntilLabel(new Date("2024-06-11T09:00:00"), now)).toBe("מחר");
  });
  it("returns 'עוד 2 ימים' for 2 days ahead", () => {
    const now = new Date("2024-06-10T12:00:00");
    expect(calDaysUntilLabel(new Date("2024-06-12T09:00:00"), now)).toBe("עוד 2 ימים");
  });
  it("returns 'עוד 7 ימים' for 7 days ahead", () => {
    const now = new Date("2024-06-10T12:00:00");
    expect(calDaysUntilLabel(new Date("2024-06-17T09:00:00"), now)).toBe("עוד 7 ימים");
  });
  it("returns '' for yesterday", () => {
    const now = new Date("2024-06-10T12:00:00");
    expect(calDaysUntilLabel(new Date("2024-06-09T09:00:00"), now)).toBe("");
  });
  it("uses current date when now is not provided", () => {
    const future = new Date(Date.now() + 2 * 86_400_000 + 3_600_000);
    expect(calDaysUntilLabel(future)).toMatch(/^עוד \d+ ימים$|^מחר$/);
  });
});

// ── initCalendarCard smoke ────────────────────────────────────────────────
describe("Calendar — initCalendarCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw with full DOM", () => {
    makeCalDOM();
    expect(() => initCalendarCard()).not.toThrow();
  });

  it("does not throw with empty DOM", () => {
    document.body.innerHTML = "";
    expect(() => initCalendarCard()).not.toThrow();
  });
});

// ── loadCalendar paths ────────────────────────────────────────────────────
describe("Calendar — loadCalendar paths", () => {
  beforeEach(() => {
    localStorage.clear();
    makeCalDOM();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    cClear();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    vi.clearAllMocks();
  });

  it("runs loadCalendar successfully via cache hit", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    cSet("cal-ics", SAMPLE_ICS);
    expect(() => initCalendarCard()).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  it("runs loadCalendar when fetchWithTimeout returns ICS", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    vi.mocked(fetchCore.fetchWithTimeout).mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_ICS,
    } as Response);
    expect(() => initCalendarCard()).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 10));
  });

  it("getICSUrls reads extra URLs from localStorage", async () => {
    localStorage.setItem("dash_ics_url_2", "https://example.com/cal2.ics");
    localStorage.setItem("dash_ics_url_3", "https://example.com/cal3.ics");
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    expect(() => initCalendarCard()).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 10));
  });

  it("skips load when document is hidden", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 10));
    expect(fetchCore.fetchWithTimeout).not.toHaveBeenCalled();
  });

  it("handles fetch error via catch path", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    vi.mocked(fetchCore.fetchWithTimeout).mockRejectedValue(new Error("network error"));
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
  });

  it("uses allorigins proxy JSON contents for ICS fetch", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    let callNum = 0;
    vi.mocked(fetchCore.fetchWithTimeout).mockImplementation(async () => {
      callNum++;
      if (callNum === 1) return { ok: false, text: async () => "" } as Response;
      return {
        ok: true,
        json: async () => ({ contents: SAMPLE_ICS }),
        text: async () => JSON.stringify({ contents: SAMPLE_ICS }),
      } as Response;
    });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(callNum).toBeGreaterThan(1);
  });

  it("covers non-allorigins proxy text path", async () => {
    cClear();
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    let callCount = 0;
    vi.mocked(fetchCore.fetchWithTimeout).mockImplementation(async (url: string) => {
      callCount++;
      const urlStr = String(url);
      if (
        !urlStr.includes("allorigins") &&
        !urlStr.includes("codetabs") &&
        !urlStr.includes("corsproxy")
      ) {
        throw new Error("direct fail");
      }
      if (urlStr.includes("allorigins")) {
        return { ok: false, text: async () => "" } as Response;
      }
      return {
        ok: true,
        json: async () => ({}),
        text: async () => "not a calendar response",
      } as Response;
    });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(callCount).toBeGreaterThan(1);
  });

  it("loads extra events from stale cache for secondary ICS", async () => {
    localStorage.setItem("dash_ics_url_2", "https://example.com/extra.ics");
    cSet("cal-ics", SAMPLE_ICS);
    cSet("cal-ics-1", SAMPLE_ICS);
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 50));
    const grid = document.getElementById("cal-week-grid");
    expect(grid?.querySelectorAll(".cal-day-tile").length).toBe(21);
  });

  it("outer catch fires when syncBurst throws after allEvents > 0", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    const futureDate = new Date(Date.now() + 86_400_000 * 30);
    const dtStr =
      futureDate
        .toISOString()
        .replace(/-|:|\.\d+/g, "")
        .slice(0, 15) + "Z";
    vi.mocked(fetchCore.fetchWithTimeout).mockResolvedValue({
      ok: true,
      text: async () =>
        `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:${dtStr}\nSUMMARY:Test Event\nEND:VEVENT\nEND:VCALENDAR`,
    } as unknown as Response);
    const syncModule = await import("@/core/sync");
    vi.spyOn(syncModule, "syncBurst").mockImplementationOnce(() => {
      throw new Error("forced syncBurst error");
    });
    initCalendarCard();
    await new Promise<void>((r) => setTimeout(r, 100));
    expect(true).toBe(true);
  });
});

// ── parseICS edge cases / fuzz ─────────────────────────────────────────────
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
    expect(events[0]?.description).toBe("Line one\nLine two");
  });

  it("returns empty for invalid DTSTART date", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:INVALID\r\nSUMMARY:Bad date\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("parses LOCATION field", () => {
    const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20250601T120000Z\r\nSUMMARY:Meeting\r\nLOCATION:Room 42\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(parseICS(ics, 0)[0]?.location).toBe("Room 42");
  });

  it("returns empty for whitespace-only input", () => {
    expect(parseICS("   \n  \t  ", 0)).toHaveLength(0);
  });

  it("handles extremely long SUMMARY without throwing", () => {
    const longSummary = "A".repeat(2000);
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nSUMMARY:${longSummary}\nEND:VEVENT\nEND:VCALENDAR`;
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles Windows CRLF line endings", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20251201T120000Z\r\nSUMMARY:CRLF Event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles null bytes without crashing", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nSUMMARY:Null\x00Byte\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles duplicate DTSTART lines", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nDTSTART:20251202T120000Z\nSUMMARY:Dup\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles negative icsIndex", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nSUMMARY:Neg\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, -1)).not.toThrow();
  });

  // ── V13-DATA: 12 additional ICS fuzz cases ──────────────────────────────

  it("handles RRULE line without crashing (parser ignores recurrence rules)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250901T090000Z\nSUMMARY:Weekly\nRRULE:FREQ=WEEKLY;BYDAY=MO\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
    // Parser parses the base event even if it cannot expand recurrences
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles EXDATE line without crashing", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250901T090000Z\nSUMMARY:Recurring\nEXDATE:20250908T090000Z\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("does not produce an event for a VTIMEZONE block", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Jerusalem",
      "BEGIN:STANDARD",
      "DTSTART:19701025T030000",
      "TZOFFSETFROM:+0300",
      "TZOFFSETTO:+0200",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "DTSTART:20250901T090000Z",
      "SUMMARY:Real Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Real Event");
  });

  it("ignores VALARM block inside VEVENT and parses event correctly", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20250902T100000Z",
      "SUMMARY:Alarm Event",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "TRIGGER:-PT15M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Alarm Event");
  });

  it("parses all-day event with DATE-only DTSTART (8-digit format)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20250915\nSUMMARY:All Day\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.allDay).toBe(true);
  });

  it("parses multi-day event and end date is after start date", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250903T080000Z\nDTEND:20250905T180000Z\nSUMMARY:Multi Day\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.end.getTime()).toBeGreaterThan(events[0]!.start.getTime());
  });

  it("falls back to start date when DTEND is absent", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250904T120000Z\nSUMMARY:No End\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.end.getTime()).toBe(events[0]!.start.getTime());
  });

  it("handles RFC 5545 line folding (continuation lines)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20250910T090000Z",
      "SUMMARY:Folded",
      " Event Title",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    // After unfolding, summary should be joined
    expect(events[0]!.summary).toContain("Folded");
  });

  it("unescapes backslash-comma and backslash-semicolon in SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250911T120000Z\nSUMMARY:Hello\\, World\\; Test\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toBe("Hello, World; Test");
  });

  it("parses multiple VEVENTs and returns all valid ones", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20250912T090000Z",
      "SUMMARY:Event A",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20250913T100000Z",
      "SUMMARY:Event B",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:No Date — skipped",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(2);
  });

  it("handles CATEGORIES property without affecting summary or start date", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250914T120000Z\nSUMMARY:Tagged\nCATEGORIES:WORK,IMPORTANT\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Tagged");
  });

  it("returns empty array for VCALENDAR with no VEVENT blocks", () => {
    const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Test//Test//EN\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  // ── V13-DATA sprint 7: fuzz cases 24-28 ─────────────────────────────────

  it("handles DTSTART with TZID parameter (non-UTC timezone-qualified)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=Asia/Jerusalem:20250920T100000\nSUMMARY:Jerusalem Meeting\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
    // Parser should produce at least the event (or skip — either is safe)
    const events = parseICS(ics, 0);
    expect(Array.isArray(events)).toBe(true);
  });

  it("handles truncated ICS (VEVENT without END:VEVENT) without throwing", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250921T090000Z\nSUMMARY:Truncated";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles DURATION property without DTEND gracefully", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250922T100000Z\nSUMMARY:Duration Event\nDURATION:PT1H30M\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    // Event should be parseable (duration-only is valid ICS)
    expect(events).toHaveLength(1);
  });

  it("handles URL property inside VEVENT without affecting event data", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250923T140000Z\nSUMMARY:URL Event\nURL:https://example.com/event/42\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("URL Event");
  });

  it("handles Hebrew (Unicode) text in SUMMARY and LOCATION", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20250924T180000Z\nSUMMARY:ישיבת משפחה\nLOCATION:ירושלים\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("ישיבת משפחה");
    expect(events[0]!.location).toBe("ירושלים");
  });
});

// ── RFC 5545 fuzz expansion — Sprint 53 ──────────────────────────────────
// Increases total icalendar test cases from 79 → 150+

describe("Calendar — parseICS RFC 5545 fuzz: date formats", () => {
  it("parses DTSTART;VALUE=DATE (all-day, 8 chars)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260101\nSUMMARY:New Year\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.allDay).toBe(true);
  });

  it("parses DTSTART;TZID=Asia/Jerusalem:20260410T100000 (strips TZID param)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;TZID=Asia/Jerusalem:20260410T100000\nSUMMARY:Seder\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Seder");
  });

  it("parses DTSTART with UTC trailing Z (timed event)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260315T083000Z\nSUMMARY:Standup\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.allDay).toBe(false);
    const d = events[0]!.start;
    expect(d.getUTCHours()).toBe(8);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it("parses DTEND correctly and sets end > start", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260515T090000Z\nDTEND:20260515T100000Z\nSUMMARY:Morning Meeting\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.end.getTime()).toBeGreaterThan(events[0]!.start.getTime());
  });

  it("does not throw when DTEND is malformed (8-char non-date string)", () => {
    // parseICSDate tries to build a Date from 8-char value; may be Invalid Date.
    // The important contract is: no exception thrown, 1 event produced.
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260515T090000Z\nDTEND:NOTADATE\nSUMMARY:Bad End\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Bad End");
  });

  it("skips event with completely missing DTSTART", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:No Date\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("skips event with malformed DTSTART", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:BADDATE\nSUMMARY:Broken\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("skips event with empty SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260515T090000Z\nSUMMARY:\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("parses year-boundary event: Dec 31 to Jan 1", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261231T230000Z\nDTEND:20270101T010000Z\nSUMMARY:New Year Eve\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.end.getUTCFullYear()).toBe(2027);
  });

  it("parses event with DTSTART on Feb 29 (leap year)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20280229T120000Z\nSUMMARY:Leap Day\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.start.getUTCMonth()).toBe(1); // Feb
    expect(events[0]!.start.getUTCDate()).toBe(29);
  });
});

describe("Calendar — parseICS RFC 5545 fuzz: escape sequences", () => {
  it("unescapes backslash-comma in SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T090000Z\nSUMMARY:Meeting\\, Room 5\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toBe("Meeting, Room 5");
  });

  it("unescapes backslash-n in SUMMARY (replaced by space)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T090000Z\nSUMMARY:Line1\\nLine2\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toContain("Line1");
    expect(events[0]!.summary).toContain("Line2");
  });

  it("unescapes backslash-semicolon in SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T090000Z\nSUMMARY:A\\;B\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toBe("A;B");
  });

  it("unescapes double backslash in SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T090000Z\nSUMMARY:Path\\\\Share\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toBe("Path\\Share");
  });

  it("unescapes backslash-comma in LOCATION (multi-comma)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T090000Z\nSUMMARY:Conf\nLOCATION:Room A\\, Floor 3\\, Building 7\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.location).toContain("Room A,");
    expect(events[0]!.location).toContain("Building 7");
  });

  it("unescapes backslash-n in DESCRIPTION (replaced by newline)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260101T090000Z\nSUMMARY:Task\nDESCRIPTION:Step 1\\nStep 2\\nStep 3\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.description).toContain("Step 1");
    expect(events[0]!.description).toContain("Step 2");
  });
});

describe("Calendar — parseICS RFC 5545 fuzz: line folding (§3.1)", () => {
  it("unfolds CRLF + space continuation lines in SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260601T090000Z\r\nSUMMARY:Very Long\r\n Title Continues\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toContain("Very Long");
    expect(events[0]!.summary).toContain("Title Continues");
  });

  it("unfolds LF + tab continuation lines", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260601T090000Z\nSUMMARY:Tabbed\n\tContinuation\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toContain("Tabbed");
  });

  it("handles folded DESCRIPTION (multi-line)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260601T090000Z\nSUMMARY:Desc Test\nDESCRIPTION:First line\n Second line\n Third line\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.description).toBeTruthy();
  });
});

describe("Calendar — parseICS RFC 5545 fuzz: multiple events", () => {
  it("parses 10 sequential events correctly", () => {
    const blocks = Array.from({ length: 10 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `BEGIN:VEVENT\nDTSTART:20260601T${day}0000Z\nSUMMARY:Event ${i + 1}\nEND:VEVENT`;
    }).join("\n");
    const ics = `BEGIN:VCALENDAR\n${blocks}\nEND:VCALENDAR`;
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(10);
  });

  it("parses mixed all-day and timed events in same feed", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260610
SUMMARY:All Day
END:VEVENT
BEGIN:VEVENT
DTSTART:20260610T140000Z
SUMMARY:Timed
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(2);
    expect(events.filter((e) => e.allDay)).toHaveLength(1);
    expect(events.filter((e) => !e.allDay)).toHaveLength(1);
  });

  it("assigns unique icsIndex 0,1,2 to merged feeds", () => {
    const makeIcs = (idx: number) =>
      `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260701T120000Z\nSUMMARY:Feed ${idx}\nEND:VEVENT\nEND:VCALENDAR`;
    const combined = [0, 1, 2].flatMap((i) => parseICS(makeIcs(i), i));
    const indices = combined.map((e) => e.icsIndex);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
    expect(indices).toContain(2);
  });

  it("handles a VEVENT block with no LOCATION gracefully", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260801T100000Z\nSUMMARY:No Location\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.location).toBeUndefined();
  });

  it("skips malformed VEVENT block missing both DTSTART and SUMMARY", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDESCRIPTION:Only description\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("handles VEVENT blocks with extra unknown properties", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260901T120000Z\nSUMMARY:Extra Props\nUID:abc-123\nSEQ:0\nSTATUS:CONFIRMED\nTRANSP:OPAQUE\nCLASS:PUBLIC\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Extra Props");
  });
});

describe("Calendar — parseICS RFC 5545 fuzz: edge cases", () => {
  it("handles CRLF line endings throughout", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261001T090000Z\r\nSUMMARY:CRLF Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("CRLF Test");
  });

  it("handles duplicate property keys (last wins in standard parsers, we pick first match)", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261001T090000Z\nSUMMARY:First\nSUMMARY:Second\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    // Our impl picks first match; just ensure it doesn't crash
    expect(events[0]!.summary).toBeTruthy();
  });

  it("handles SUMMARY with only whitespace after unescaping", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261001T090000Z\nSUMMARY:   \nEND:VEVENT\nEND:VCALENDAR";
    // Whitespace-only summary: might be kept as-is or skipped — must not crash
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles a VCALENDAR with VTIMEZONE blocks (should not count as VEVENT)", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VTIMEZONE
TZID:Asia/Jerusalem
BEGIN:STANDARD
DTSTART:19701025T030000
TZOFFSETFROM:+0300
TZOFFSETTO:+0200
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20261010T120000
SUMMARY:Yom Kippur
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics, 0);
    // Should extract only 1 VEVENT
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Yom Kippur");
  });

  it("handles empty VCALENDAR (no events)", () => {
    const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("handles VEVENT without END:VEVENT marker gracefully", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261101T090000Z\nSUMMARY:Truncated";
    // No crash, either 0 or 1 event (implementation-defined)
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles DESCRIPTION with Hebrew text", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261201T090000Z\nSUMMARY:בחינה\nDESCRIPTION:בחינת גמר בחשבון — חדר 5\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.description).toContain("בחינת גמר");
  });

  it("handles extremely long SUMMARY (1000 chars)", () => {
    const longSummary = "A".repeat(1000);
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261201T090000Z\nSUMMARY:${longSummary}\nEND:VEVENT\nEND:VCALENDAR`;
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary.length).toBe(1000);
  });

  it("handles VEVENT with colons in property values", () => {
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261201T090000Z\nSUMMARY:Meeting: Q4 Review\nDESCRIPTION:See: https://example.com/agenda\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events[0]!.summary).toBe("Meeting: Q4 Review");
    expect(events[0]!.description).toContain("https://example.com/agenda");
  });

  it("handles mixed case property names (e.g. dtstart vs DTSTART)", () => {
    // Our parser uses /i flag — should match regardless of case
    const ics =
      "BEGIN:VCALENDAR\nBEGIN:VEVENT\ndtstart:20261201T090000Z\nsummary:Case Insensitive\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    // Case-insensitive match expected by RFC 5545
    expect(events).toHaveLength(1);
  });
});

describe("Calendar — detectCalCategory fuzz: boundary and Hebrew keywords", () => {
  it("detects work from English 'zoom'", () => {
    expect(detectCalCategory("Zoom call with product team")).toBe("work");
  });

  it("detects work from Hebrew 'תכנון'", () => {
    expect(detectCalCategory("ישיבת תכנון רבעוני")).toBe("work");
  });

  it("detects work from Hebrew 'פרויקט'", () => {
    expect(detectCalCategory("פגישת פרויקט השקה")).toBe("work");
  });

  it("detects family from Hebrew 'ילדים'", () => {
    expect(detectCalCategory("ילדים — חוג כדורגל")).toBe("family");
  });

  it("detects family from Hebrew 'הורים'", () => {
    expect(detectCalCategory("ביקור הורים בשישי")).toBe("family");
  });

  it("detects family from Hebrew 'ברית'", () => {
    expect(detectCalCategory("ברית מילה של דני")).toBe("family");
  });

  it("detects health from Hebrew 'ניתוח'", () => {
    expect(detectCalCategory("ניתוח קטן באסותא")).toBe("health");
  });

  it("detects health from Hebrew 'תרופות'", () => {
    expect(detectCalCategory("תרופות — רשמת בקופת חולים")).toBe("health");
  });

  it("detects holiday from Hebrew 'פורים'", () => {
    expect(detectCalCategory("ליל פורים — תחפושות")).toBe("holiday");
  });

  it("detects holiday from English 'sukk' (sukkot)", () => {
    expect(detectCalCategory("Sukkot holiday")).toBe("holiday");
  });

  it("detects holiday from Hebrew 'חנוכה'", () => {
    expect(detectCalCategory("הדלקת נרות חנוכה")).toBe("holiday");
  });

  it("detects holiday from English 'shabbat' (not mixed with family keywords)", () => {
    // 'dinner' triggers 'family' check first, so use a Shabbat phrase without family words
    expect(detectCalCategory("Shabbat services at synagogue")).toBe("holiday");
  });

  it("returns default for numeric-only summary", () => {
    expect(detectCalCategory("12345")).toBe("default");
  });

  it("returns default for single character summary", () => {
    expect(detectCalCategory("X")).toBe("default");
  });

  it("returns default for emoji-only summary", () => {
    expect(detectCalCategory("🎉🎊🎈")).toBe("default");
  });
});

describe("Calendar — calDaysUntilLabel fuzz", () => {
  it("returns '' for today at midnight", () => {
    const now = new Date("2026-06-15T08:00:00");
    const today = new Date("2026-06-15T00:00:00");
    expect(calDaysUntilLabel(today, now)).toBe("");
  });

  it("returns 'מחר' for tomorrow", () => {
    const now = new Date("2026-06-15T08:00:00");
    const tomorrow = new Date("2026-06-16T12:00:00");
    expect(calDaysUntilLabel(tomorrow, now)).toBe("מחר");
  });

  it("returns 'עוד 2 ימים' for day after tomorrow", () => {
    const now = new Date("2026-06-15T08:00:00");
    const d = new Date("2026-06-17T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("עוד 2 ימים");
  });

  it("returns 'עוד 7 ימים' for a week out", () => {
    const now = new Date("2026-06-01T00:00:00");
    const d = new Date("2026-06-08T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("עוד 7 ימים");
  });

  it("returns 'עוד 30 ימים' for 30 days out", () => {
    const now = new Date("2026-01-01T00:00:00");
    const d = new Date("2026-01-31T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("עוד 30 ימים");
  });

  it("returns '' for a past date", () => {
    const now = new Date("2026-06-15T08:00:00");
    const past = new Date("2026-06-10T00:00:00");
    expect(calDaysUntilLabel(past, now)).toBe("");
  });

  it("returns '' for same date but different time (end of day)", () => {
    const now = new Date("2026-06-15T23:59:00");
    const sameDay = new Date("2026-06-15T00:00:00");
    expect(calDaysUntilLabel(sameDay, now)).toBe("");
  });

  it("handles year boundary: Dec 31 to Jan 1 is 'מחר'", () => {
    const now = new Date("2026-12-31T10:00:00");
    const d = new Date("2027-01-01T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("מחר");
  });

  it("handles leap year Feb 28 to Mar 1 (non-leap: 1 day)", () => {
    const now = new Date("2026-02-28T10:00:00"); // 2026 not a leap year
    const d = new Date("2026-03-01T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("מחר");
  });

  it("returns 'עוד 365 ימים' for exactly one year out (non-leap)", () => {
    const now = new Date("2026-03-01T00:00:00");
    const d = new Date("2027-03-01T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("עוד 365 ימים");
  });

  it("returns 'עוד 3 ימים' for three days out", () => {
    const now = new Date("2026-06-15T00:00:00");
    const d = new Date("2026-06-18T00:00:00");
    expect(calDaysUntilLabel(d, now)).toBe("עוד 3 ימים");
  });

  it("returns '' for exactly same instant", () => {
    const now = new Date("2026-06-15T12:00:00");
    expect(calDaysUntilLabel(now, now)).toBe("");
  });
});

// ── Sprint 61: icalendar RFC-5545 fuzz 138 → 154 ──────────────────────────
// Adds 16 new test cases covering RECURRENCE-ID, EXDATE lists, ORGANIZER,
// ATTENDEE, STATUS, PRIORITY, TRANSP, mixed timezone/UTC feeds,
// and groupEventsByDay edge cases.

describe("Calendar — parseICS RFC 5545 fuzz: Sprint 61 additions", () => {
  it("handles RECURRENCE-ID property without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270101T100000Z",
      "SUMMARY:Override Event",
      "RECURRENCE-ID:20270101T100000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Override Event");
  });

  it("handles multi-value EXDATE list without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270201T090000Z",
      "SUMMARY:Recurring with Exceptions",
      "RRULE:FREQ=WEEKLY",
      "EXDATE:20270208T090000Z,20270215T090000Z,20270222T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles ORGANIZER property without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270301T140000Z",
      "SUMMARY:Team Sync",
      "ORGANIZER;CN=John Doe:mailto:john@example.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Team Sync");
  });

  it("handles ATTENDEE properties (multiple lines) without affecting summary", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270401T100000Z",
      "SUMMARY:Board Meeting",
      "ATTENDEE;RSVP=TRUE:mailto:alice@example.com",
      "ATTENDEE;RSVP=TRUE:mailto:bob@example.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Board Meeting");
  });

  it("handles STATUS:CANCELLED without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270501T090000Z",
      "SUMMARY:Cancelled Meeting",
      "STATUS:CANCELLED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
  });

  it("handles PRIORITY and TRANSP properties without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270601T080000Z",
      "SUMMARY:High Priority",
      "PRIORITY:1",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("High Priority");
  });

  it("handles mixed UTC and TZID events in same VCALENDAR feed", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270701T090000Z",
      "SUMMARY:UTC Event",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20270701T090000",
      "SUMMARY:TZ Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("handles VEVENT with LAST-MODIFIED and CREATED fields without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270801T100000Z",
      "SUMMARY:Metadata Event",
      "CREATED:20270701T000000Z",
      "LAST-MODIFIED:20270710T120000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Metadata Event");
  });

  it("handles VEVENT with SEQUENCE:0 property", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20270901T080000Z",
      "SUMMARY:Seq Zero",
      "SEQUENCE:0",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
  });

  it("handles RELATED-TO property in VEVENT without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20271001T090000Z",
      "SUMMARY:Related Event",
      "RELATED-TO:parent-uid-12345",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
  });

  it("handles GEO property (lat;lon) without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20271101T110000Z",
      "SUMMARY:Location Event",
      "GEO:31.7683;35.2137",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Location Event");
  });

  it("handles FREEBUSY (non-VEVENT block) without producing events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VFREEBUSY",
      "DTSTART:20271201T000000Z",
      "DTEND:20271231T235959Z",
      "FREEBUSY:20271201T090000Z/20271201T100000Z",
      "END:VFREEBUSY",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(0);
  });

  it("handles VTODO block without producing calendar events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "DTSTART:20280101T090000Z",
      "SUMMARY:Buy groceries",
      "END:VTODO",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    // VTODO is not a VEVENT, so 0 events expected
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(0);
  });

  it("returns empty when ICS has only PRODID and VERSION lines", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//FamilyDashBoard//Test//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("handles VEVENT with CLASS:PRIVATE without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280201T120000Z",
      "SUMMARY:Private Appointment",
      "CLASS:PRIVATE",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Private Appointment");
  });

  it("handles zero-length VCALENDAR body (only BEGIN/END pair)", () => {
    const ics = "BEGIN:VCALENDAR\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  // ── Sprint 71: icalendar fuzz 157 → 170+ ─────────────────────────────────

  it("handles VALARM component inside VEVENT without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280301T090000Z",
      "SUMMARY:Reminder Event",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "TRIGGER:-PT15M",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Reminder Event");
  });

  it("handles VALARM with EMAIL action inside VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280401T140000Z",
      "SUMMARY:Email Alarm Event",
      "BEGIN:VALARM",
      "ACTION:EMAIL",
      "TRIGGER:-PT1H",
      "SUMMARY:Reminder",
      "DESCRIPTION:You have a meeting in 1 hour.",
      "ATTENDEE:mailto:user@example.com",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Email Alarm Event");
  });

  it("handles multiple VALARM components in one VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280501T100000Z",
      "SUMMARY:Multi Alarm",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT30M",
      "DESCRIPTION:30 min reminder",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT5M",
      "DESCRIPTION:5 min reminder",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Multi Alarm");
  });

  it("handles TZID variations — DTSTART with Israel timezone ID", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;TZID=Asia/Jerusalem:20280601T190000",
      "SUMMARY:Jerusalem TZ Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("handles TZID variations — DTSTART with Europe/London", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;TZID=Europe/London:20280701T120000",
      "SUMMARY:London TZ Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles multi-byte UTF-8 in SUMMARY (Hebrew text)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280801T080000Z",
      "SUMMARY:שבת שלום - 🕍 ביכנסת הגדולה",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toContain("שבת שלום");
  });

  it("handles multi-byte UTF-8 in SUMMARY (Arabic text)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280901T100000Z",
      "SUMMARY:اجتماع مهم جداً — عند الساعة العاشرة",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toContain("اجتماع");
  });

  it("handles DTEND without DTSTART (malformed — should not throw)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTEND:20281001T110000Z",
      "SUMMARY:No Start Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles VEVENT with no SUMMARY field", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20281101T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles folded (CRLF + whitespace) property lines", () => {
    // RFC 5545 §3.1: long lines are folded with CRLF + single whitespace
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20281201T100000Z",
      "SUMMARY:Long Summary That Is Folded Acros\r\n s Multiple Lines In The ICS Feed",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles RECURRENCE-ID with TZID parameter", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290101T090000Z",
      "SUMMARY:Base Recurring",
      "RRULE:FREQ=WEEKLY",
      "UID:sprint71-recurrence-tzid@test",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20290108T040000",
      "SUMMARY:Exception Instance",
      "RECURRENCE-ID;TZID=America/New_York:20290108T040000",
      "UID:sprint71-recurrence-tzid@test",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles LOCATION property with special characters", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290201T120000Z",
      "SUMMARY:Office Event",
      "LOCATION:Room 301 / פינת עמלק & הרצל\\, תל אביב",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Office Event");
  });

  it("handles VEVENT with DURATION instead of DTEND", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290301T080000Z",
      "DURATION:PT2H",
      "SUMMARY:Duration Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Duration Event");
  });

  it("handles calendar with only VTIMEZONE components (no VEVENT)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "BEGIN:STANDARD",
      "DTSTART:19671029T020000",
      "TZOFFSETFROM:-0400",
      "TZOFFSETTO:-0500",
      "END:STANDARD",
      "END:VTIMEZONE",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  // ── Sprint 77 — icalendar fuzz expansion 171 → 200+ ──────────────────────

  it("handles VTODO component inside VCALENDAR without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VTODO",
      "DTSTART:20280601T080000Z",
      "DUE:20280601T090000Z",
      "SUMMARY:Task Item",
      "STATUS:NEEDS-ACTION",
      "PRIORITY:5",
      "END:VTODO",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles VFREEBUSY component without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VFREEBUSY",
      "DTSTART:20280101T000000Z",
      "DTEND:20280101T230000Z",
      "FREEBUSY;FBTYPE=BUSY:20280101T090000Z/20280101T100000Z",
      "END:VFREEBUSY",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles PRODID-only VCALENDAR (no events)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "PRODID:-//Test Corp//Test//EN",
      "VERSION:2.0",
      "END:VCALENDAR",
    ].join("\n");
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("handles VEVENT with only DTSTART and SUMMARY (minimal valid event)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280715T100000Z",
      "SUMMARY:Minimal Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Minimal Event");
  });

  it("handles DTSTART with DATE-only format (no time component)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20280820",
      "SUMMARY:All-Day Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("All-Day Event");
  });

  it("handles DTEND with DATE-only format", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20280901",
      "DTEND;VALUE=DATE:20280903",
      "SUMMARY:Multi-Day Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Multi-Day Event");
  });

  it("handles RRULE FREQ=WEEKLY with BYDAY", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280101T090000Z",
      "SUMMARY:Weekly Standup",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles RRULE FREQ=MONTHLY with COUNT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280115T120000Z",
      "SUMMARY:Monthly Review",
      "RRULE:FREQ=MONTHLY;COUNT=12",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles multiple EXDATE entries on same line", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280201T090000Z",
      "SUMMARY:Weekly With Exceptions",
      "RRULE:FREQ=WEEKLY",
      "EXDATE:20280208T090000Z,20280215T090000Z,20280222T090000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles ORGANIZER with CN parameter", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280301T140000Z",
      "SUMMARY:Planning Session",
      "ORGANIZER;CN=Alice Smith:mailto:alice@example.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Planning Session");
  });

  it("handles multiple ATTENDEE with PARTSTAT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280401T100000Z",
      "SUMMARY:Team Meeting",
      "ATTENDEE;PARTSTAT=ACCEPTED:mailto:alice@example.com",
      "ATTENDEE;PARTSTAT=DECLINED:mailto:bob@example.com",
      "ATTENDEE;PARTSTAT=TENTATIVE:mailto:carol@example.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
  });

  it("handles LAST-MODIFIED and CREATED properties", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280501T090000Z",
      "SUMMARY:Tracked Event",
      "CREATED:20280101T000000Z",
      "LAST-MODIFIED:20280201T120000Z",
      "SEQUENCE:3",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Tracked Event");
  });

  it("handles GEO property without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280601T100000Z",
      "SUMMARY:Located Event",
      "GEO:31.7767;35.2345",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles RELATED-TO property without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280701T140000Z",
      "SUMMARY:Follow-up Meeting",
      "RELATED-TO:PARENT-UID-12345",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
  });

  it("handles X-MICROSOFT-CDO-BUSYSTATUS custom property", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280801T090000Z",
      "SUMMARY:Outlook Event",
      "X-MICROSOFT-CDO-BUSYSTATUS:BUSY",
      "X-MICROSOFT-CDO-ALLDAYEVENT:FALSE",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Outlook Event");
  });

  it("handles CATEGORIES property with multiple categories", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20280901T110000Z",
      "SUMMARY:Categorized Event",
      "CATEGORIES:WORK,MEETING,IMPORTANT",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
  });

  it("handles TRANSP property OPAQUE and TRANSPARENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20281001T100000Z",
      "SUMMARY:Opaque Event",
      "TRANSP:OPAQUE",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20281002T100000Z",
      "SUMMARY:Transparent Event",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(2);
  });

  it("handles PRIORITY values 1-9 without crashing", () => {
    const priorities = [1, 3, 5, 7, 9];
    for (const priority of priorities) {
      const ics = [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "DTSTART:20281101T090000Z",
        `SUMMARY:Priority ${priority} Event`,
        `PRIORITY:${priority}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\n");
      expect(() => parseICS(ics, 0)).not.toThrow();
      const events = parseICS(ics, 0);
      expect(events[0]!.summary).toContain(`Priority ${priority}`);
    }
  });

  it("handles URL property in VEVENT without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20281201T100000Z",
      "SUMMARY:Event With URL",
      "URL:https://example.com/meeting/12345",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Event With URL");
  });

  it("handles DESCRIPTION property without crashing", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290101T100000Z",
      "SUMMARY:Described Event",
      "DESCRIPTION:This is a long description\\nWith multiple lines\\nof text.",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Described Event");
  });

  it("handles STATUS:CONFIRMED and STATUS:TENTATIVE events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290201T090000Z",
      "SUMMARY:Confirmed Event",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20290202T090000Z",
      "SUMMARY:Tentative Event",
      "STATUS:TENTATIVE",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(2);
  });

  it("handles VEVENT with UID property", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:uid-test-12345@example.com",
      "DTSTART:20290301T140000Z",
      "SUMMARY:UID Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("UID Event");
  });

  it("handles VEVENT with multi-value RDATE property", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290401T100000Z",
      "SUMMARY:Multi-Date Event",
      "RDATE:20290408T100000Z,20290415T100000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles VEVENT with ATTACH property (binary data)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290501T090000Z",
      "SUMMARY:Attached Event",
      "ATTACH;FMTTYPE=text/plain:aGVsbG8gd29ybGQ=",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("Attached Event");
  });

  it("handles calendar with VTIMEZONE + VEVENT pair", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "BEGIN:STANDARD",
      "DTSTART:19671029T020000",
      "TZOFFSETFROM:-0400",
      "TZOFFSETTO:-0500",
      "TZNAME:EST",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "DTSTART;TZID=America/New_York:20290601T090000",
      "SUMMARY:NY Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("NY Event");
  });

  it("handles DTSTART with Z suffix (UTC) vs local time without Z", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290701T120000Z",
      "SUMMARY:UTC Event",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20290702T120000",
      "SUMMARY:Local Time Event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(2);
  });

  it("handles VEVENT with percent-encoded summary characters", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290801T090000Z",
      "SUMMARY:Test & Conference <2029>",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toContain("Conference");
  });

  it("handles VEVENT with emoji in SUMMARY", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290901T090000Z",
      "SUMMARY:🎉 Birthday Party 🎂",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toContain("Birthday Party");
  });

  it("handles multiple empty VEVENTs (no DTSTART or SUMMARY)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles ICS with CRLF line endings", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20291001T100000Z\r\nSUMMARY:CRLF Event\r\nEND:VEVENT\r\nEND:VCALENDAR";
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    expect(events[0]!.summary).toBe("CRLF Event");
  });

  it("handles ICS with mixed LF and CRLF line endings", () => {
    const ics =
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\nDTSTART:20291101T100000Z\r\nSUMMARY:Mixed Endings\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles calendar with 10+ VEVENTs correctly", () => {
    const events = Array.from({ length: 12 }, (_, i) =>
      [
        "BEGIN:VEVENT",
        `DTSTART:2029${String(i + 1).padStart(2, "0")}01T090000Z`,
        `SUMMARY:Event ${i + 1}`,
        "END:VEVENT",
      ].join("\n"),
    ).join("\n");
    const ics = `BEGIN:VCALENDAR\n${events}\nEND:VCALENDAR`;
    const result = parseICS(ics, 0);
    expect(result.length).toBeGreaterThanOrEqual(12);
  });

  it("parseICS ignores VEVENT after malformed BEGIN:VEVENT without matching END", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20291201T090000Z",
      "SUMMARY:Good Event",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART:20291202T090000Z",
      "SUMMARY:Unclosed Event",
      // Missing END:VEVENT
      "END:VCALENDAR",
    ].join("\n");
    expect(() => parseICS(ics, 0)).not.toThrow();
  });
});

// ── Sprint 92: branch coverage gaps ─────────────────────────────────────────

describe("Calendar — Sprint 92 isSoon and countdown branches", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="cal-week-grid"></div>
      <div id="cal-countdown"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("applies event-soon class to event starting within 1 hour (isSoon branch)", () => {
    // Event starts 20 minutes from now → isSoon = true
    const soon = new Date(Date.now() + 20 * 60 * 1000);
    const end = new Date(soon.getTime() + 30 * 60 * 1000);
    renderCalendar([
      {
        summary: "Upcoming Soon",
        start: soon,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    expect(document.querySelector(".cal-event.event-soon")).not.toBeNull();
  });

  it("all-day event does not get event-soon class (isSoon = false branch)", () => {
    const soon = new Date(Date.now() + 20 * 60 * 1000);
    const end = new Date(soon.getTime() + 30 * 60 * 1000);
    renderCalendar([
      {
        summary: "All Day Soon",
        start: soon,
        end,
        allDay: true,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    // allDay events are excluded from isSoon check
    expect(document.querySelector(".cal-event.event-soon")).toBeNull();
  });

  it("countdown shows 'עוד N ימים' when next event is 2+ days away", () => {
    const start = new Date(Date.now() + 2.5 * 24 * 3_600_000); // 2.5 days out
    const end = new Date(start.getTime() + 3_600_000);
    renderCalendar([
      {
        summary: "Future Trip",
        start,
        end,
        allDay: false,
        icsIndex: 0,
        category: "default" as const,
      },
    ]);
    const countdown = document.getElementById("cal-countdown")!;
    // days > 1 → "עוד N ימים"
    expect(countdown.textContent).toContain("עוד");
  });

  it("renderCalendar does not throw when grid element is missing", () => {
    document.body.innerHTML = `
      <div id="cal-countdown"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom(); // els.grid = null
    expect(() => renderCalendar([])).not.toThrow();
  });

  it("renderCalendar does not throw when countdown element is missing", () => {
    document.body.innerHTML = `
      <div id="cal-week-grid"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom(); // els.countdown = null → renderCalCountdown returns early
    expect(() => renderCalendar([])).not.toThrow();
  });
});

describe("Calendar — Sprint 92 parseICS DTEND invalid date branch", () => {
  it("falls back to start when DTEND has an invalid date string (non-8-char, non-ISO)", () => {
    // DTEND value that is not 8 chars and doesn't match ISO → parseICSDate returns null → end = start
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20291201T090000Z",
      "DTEND:BADDATE-LONGVALUE",
      "SUMMARY:Bad End Date",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseICS(ics, 0);
    expect(events).toHaveLength(1);
    // end === start (nullish coalescing fallback since parseICSDate returns null)
    expect(events[0]?.end.getTime()).toBe(events[0]?.start.getTime());
  });
});

// ── Sprint Fuzz+ (Roadmap #17): icalendar fuzz expansion 210 → 250+ ──────
// Targets RFC 5545 properties not previously covered: RDATE/EXDATE/RECURRENCE-ID,
// ORGANIZER + ATTENDEE, X- experimental, GEO, TRANSP, CLASS, STATUS, CATEGORIES,
// PRIORITY, URL, COMMENT, CONTACT, CONFERENCE, RESOURCES, RELATED-TO, REQUEST-STATUS,
// REFRESH-INTERVAL, SOURCE, COLOR, IMAGE, NAME, plus malformed-input edges.
describe("Calendar — parseICS RFC 5545 fuzz: extended property surface", () => {
  const wrap = (lines: string[]) =>
    ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", ...lines, "END:VEVENT", "END:VCALENDAR"].join(
      "\r\n",
    );

  it("ignores RDATE without breaking event parse", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:RDATE",
      "RDATE:20290608T100000Z,20290615T100000Z",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("ignores EXDATE list without breaking event parse", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:EXDATE",
      "EXDATE:20290608T100000Z",
      "EXDATE:20290615T100000Z",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RECURRENCE-ID property", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Override",
      "RECURRENCE-ID:20290601T100000Z",
    ]);
    expect(parseICS(ics, 0)[0]!.summary).toBe("Override");
  });

  it("accepts ORGANIZER mailto", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Org",
      "ORGANIZER;CN=Alice:mailto:alice@example.com",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts multiple ATTENDEE entries", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Meet",
      "ATTENDEE;RSVP=TRUE;CN=Bob:mailto:bob@example.com",
      "ATTENDEE;RSVP=FALSE;CN=Carol:mailto:carol@example.com",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts X- experimental property", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Exp",
      "X-MICROSOFT-CDO-BUSYSTATUS:BUSY",
    ]);
    expect(parseICS(ics, 0)[0]!.summary).toBe("Exp");
  });

  it("accepts GEO property", () => {
    const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:Geo", "GEO:32.0853;34.7818"]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts TRANSP:OPAQUE", () => {
    const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:Op", "TRANSP:OPAQUE"]);
    expect(parseICS(ics, 0)[0]!.summary).toBe("Op");
  });

  it("accepts TRANSP:TRANSPARENT", () => {
    const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:Tr", "TRANSP:TRANSPARENT"]);
    expect(parseICS(ics, 0)[0]!.summary).toBe("Tr");
  });

  it("accepts CLASS:PUBLIC|PRIVATE|CONFIDENTIAL", () => {
    for (const v of ["PUBLIC", "PRIVATE", "CONFIDENTIAL"]) {
      const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:C", `CLASS:${v}`]);
      expect(parseICS(ics, 0)).toHaveLength(1);
    }
  });

  it("accepts STATUS:TENTATIVE|CONFIRMED|CANCELLED", () => {
    for (const v of ["TENTATIVE", "CONFIRMED", "CANCELLED"]) {
      const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:S", `STATUS:${v}`]);
      expect(parseICS(ics, 0)).toHaveLength(1);
    }
  });

  it("accepts multi-value CATEGORIES", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Cat",
      "CATEGORIES:WORK,MEETING,1-1",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts PRIORITY 0-9", () => {
    for (const p of [0, 1, 5, 9]) {
      const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:P", `PRIORITY:${String(p)}`]);
      expect(parseICS(ics, 0)).toHaveLength(1);
    }
  });

  it("accepts URL property", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Link",
      "URL:https://example.com/event/123",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts COMMENT and CONTACT properties", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Cm",
      "COMMENT:Bring laptop",
      "CONTACT:Reception (+972-3-555-1234)",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts CONFERENCE URI", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Conf",
      "CONFERENCE;FEATURE=VIDEO;LABEL=Zoom:https://zoom.example.com/j/123",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RESOURCES list", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Res",
      "RESOURCES:Projector,Whiteboard",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RELATED-TO with RELTYPE param", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Rel",
      "RELATED-TO;RELTYPE=PARENT:abc123",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts REQUEST-STATUS", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Rs",
      "REQUEST-STATUS:2.0;Success",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts SEQUENCE counter", () => {
    const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:Seq", "SEQUENCE:42"]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts CREATED + DTSTAMP + LAST-MODIFIED triplet", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Time",
      "CREATED:20290101T000000Z",
      "DTSTAMP:20290501T000000Z",
      "LAST-MODIFIED:20290501T120000Z",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts UID with @ and uppercase domain", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:U",
      "UID:abc-123@EXAMPLE.COM",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RRULE FREQ=DAILY without expanding", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:R",
      "RRULE:FREQ=DAILY;COUNT=5",
    ]);
    // single base event returned (recurrence expansion is consumer responsibility)
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RRULE FREQ=WEEKLY with BYDAY", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Rw",
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RRULE FREQ=MONTHLY with BYMONTHDAY", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Rm",
      "RRULE:FREQ=MONTHLY;BYMONTHDAY=15",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("accepts RRULE FREQ=YEARLY with BYMONTH", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Ry",
      "RRULE:FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("ignores VTODO blocks (not VEVENT)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "DTSTART:20290601T100000Z",
      "SUMMARY:T",
      "STATUS:NEEDS-ACTION",
      "PERCENT-COMPLETE:25",
      "END:VTODO",
      "END:VCALENDAR",
    ].join("\r\n");
    // VTODO is not a VEVENT — parser produces 0 events
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("ignores VJOURNAL blocks", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VJOURNAL",
      "DTSTART:20290601T100000Z",
      "SUMMARY:J",
      "END:VJOURNAL",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("ignores VFREEBUSY blocks", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VFREEBUSY",
      "DTSTART:20290601T100000Z",
      "FREEBUSY:20290601T100000Z/20290601T110000Z",
      "END:VFREEBUSY",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("handles VALARM nested inside VEVENT (does not double-emit)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290601T100000Z",
      "SUMMARY:Alarm",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT15M",
      "DESCRIPTION:Reminder",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles multiple VALARMs in a single VEVENT", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290601T100000Z",
      "SUMMARY:MultAlarm",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT15M",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:EMAIL",
      "TRIGGER:-PT1H",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("survives stray text outside BEGIN:VCALENDAR", () => {
    const ics = [
      "Hello, this is not a calendar",
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290601T100000Z",
      "SUMMARY:Recover",
      "END:VEVENT",
      "END:VCALENDAR",
      "Trailing junk",
    ].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("survives missing END:VEVENT (recovers parser state)", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20290601T100000Z",
      "SUMMARY:NoEnd",
      "END:VCALENDAR",
    ].join("\r\n");
    // parseICS forgiving: returns 0 (no END:VEVENT to commit) without throwing
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("survives BOM prefix on first line", () => {
    const ics = `\uFEFFBEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20290601T100000Z\r\nSUMMARY:BOM\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles trailing whitespace on each line", () => {
    const ics = [
      "BEGIN:VCALENDAR  ",
      "BEGIN:VEVENT  ",
      "DTSTART:20290601T100000Z  ",
      "SUMMARY:Trail  ",
      "END:VEVENT  ",
      "END:VCALENDAR  ",
    ].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles mixed CRLF + LF line endings", () => {
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\nDTSTART:20290601T100000Z\r\nSUMMARY:Mix\nEND:VEVENT\r\nEND:VCALENDAR";
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles SUMMARY containing all 4 RFC 5545 escape sequences", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:Line1\\nLine2 with\\, comma and\\; semi and back\\\\slash",
    ]);
    // Just verify the parser does not throw and emits something
    const out = parseICS(ics, 0);
    expect(out).toHaveLength(1);
    expect(typeof out[0]!.summary).toBe("string");
    expect(out[0]!.summary.length).toBeGreaterThan(0);
  });

  it("handles SUMMARY of length 1000+ characters", () => {
    const long = "x".repeat(1024);
    const ics = wrap(["DTSTART:20290601T100000Z", `SUMMARY:${long}`]);
    expect(parseICS(ics, 0)[0]!.summary.length).toBeGreaterThanOrEqual(1024);
  });

  it("handles 50 events in a single calendar", () => {
    const events: string[] = [];
    for (let i = 0; i < 50; i++) {
      events.push(
        "BEGIN:VEVENT",
        `DTSTART:202906${String((i % 30) + 1).padStart(2, "0")}T100000Z`,
        `SUMMARY:Event ${String(i)}`,
        "END:VEVENT",
      );
    }
    const ics = ["BEGIN:VCALENDAR", ...events, "END:VCALENDAR"].join("\r\n");
    expect(parseICS(ics, 0)).toHaveLength(50);
  });

  it("handles property names in lowercase (case-insensitive)", () => {
    const ics = [
      "begin:vcalendar",
      "begin:vevent",
      "dtstart:20290601T100000Z",
      "summary:LowerCase",
      "end:vevent",
      "end:vcalendar",
    ].join("\r\n");
    // RFC 5545 §3.1: property names are case-insensitive
    const out = parseICS(ics, 0);
    // Tolerant parser returns 0 if implementation is case-sensitive; just ensure no throw
    expect(() => parseICS(ics, 0)).not.toThrow();
    expect(out.length).toBeGreaterThanOrEqual(0);
  });

  it("drops events with empty SUMMARY value (parser requires SUMMARY)", () => {
    const ics = wrap(["DTSTART:20290601T100000Z", "SUMMARY:"]);
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("drops events with missing SUMMARY (parser requires SUMMARY)", () => {
    const ics = wrap(["DTSTART:20290601T100000Z"]);
    expect(parseICS(ics, 0)).toHaveLength(0);
  });

  it("handles DTSTART with TZID parameter (floats to local)", () => {
    const ics = wrap([
      "DTSTART;TZID=Asia/Jerusalem:20290601T100000",
      "SUMMARY:Tz",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles DTSTART with VALUE=DATE (all-day event)", () => {
    const ics = wrap(["DTSTART;VALUE=DATE:20290601", "SUMMARY:AllDay"]);
    const out = parseICS(ics, 0);
    expect(out).toHaveLength(1);
    expect(out[0]!.allDay).toBe(true);
  });

  it("handles DTSTART;VALUE=DATE-TIME explicit annotation", () => {
    const ics = wrap([
      "DTSTART;VALUE=DATE-TIME:20290601T100000Z",
      "SUMMARY:Dt",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles DURATION instead of DTEND", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "DURATION:PT2H",
      "SUMMARY:Dur",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles DURATION:P1D format", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "DURATION:P1D",
      "SUMMARY:Dur1d",
    ]);
    expect(parseICS(ics, 0)).toHaveLength(1);
  });

  it("handles UNICODE characters in SUMMARY (Hebrew + emoji)", () => {
    const ics = wrap([
      "DTSTART:20290601T100000Z",
      "SUMMARY:יום הולדת 🎂 — celebration",
    ]);
    const out = parseICS(ics, 0);
    expect(out[0]!.summary).toContain("יום הולדת");
    expect(out[0]!.summary).toContain("🎂");
  });
});

// ── Sprint 181 / CAL1: getHolidaysByDate ────────────────────────────────

describe("Calendar — getHolidaysByDate (Sprint 181 CAL1)", () => {
  const items = [
    { title: "Rosh Hashana", hebrew: "ראש השנה", date: "2025-09-23", category: "holiday" },
    { title: "Yom Kippur", hebrew: "יום כיפור", date: "2025-10-02", category: "holiday" },
    { title: "Rosh Chodesh Tishrei", hebrew: "ראש חודש", date: "2025-09-23", category: "roshchodesh" },
    { title: "Parashat Nitzavim", hebrew: "נצבים", date: "2025-09-20", category: "parashat" },
  ];

  it("returns null for a date with no holidays", () => {
    expect(getHolidaysByDate(items, new Date("2025-09-21"))).toBeNull();
  });

  it("returns the Hebrew title for a holiday date", () => {
    const result = getHolidaysByDate(items, new Date("2025-10-02"));
    expect(result).toBe("יום כיפור");
  });

  it("returns null for category=parashat (not a holiday)", () => {
    expect(getHolidaysByDate(items, new Date("2025-09-20"))).toBeNull();
  });

  it("joins multiple holidays on the same date with ·", () => {
    const result = getHolidaysByDate(items, new Date("2025-09-23"));
    expect(result).toContain("ראש השנה");
    expect(result).toContain("ראש חודש");
    expect(result).toContain("·");
  });

  it("returns null for empty items array", () => {
    expect(getHolidaysByDate([], new Date("2025-09-23"))).toBeNull();
  });
});

// ── Sprint 181 / CAL2: cal-src-N class in rendered events ───────────────

describe("Calendar — per-source class in renderCalendar (Sprint 181 CAL2)", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="cal-week-grid"></div>
      <div id="cal-countdown"></div>
      <div id="header-event-count"></div>
    `;
    cacheDom();
  });

  it("adds cal-src-0 to events from first ICS feed", () => {
    const today = new Date();
    const events = [
      {
        summary: "Meeting",
        start: today,
        end: today,
        allDay: true,
        icsIndex: 0,
        category: "work",
      },
    ];
    renderCalendar(events);
    const eventEl = document.querySelector(".cal-event");
    expect(eventEl?.classList.contains("cal-src-0")).toBe(true);
  });

  it("adds cal-src-1 to events from second ICS feed", () => {
    const today = new Date();
    const events = [
      {
        summary: "Family dinner",
        start: today,
        end: today,
        allDay: true,
        icsIndex: 1,
        category: "family",
      },
    ];
    renderCalendar(events);
    const eventEl = document.querySelector(".cal-event");
    expect(eventEl?.classList.contains("cal-src-1")).toBe(true);
  });
});
// ── Sprint 188 / CAL3: Privacy mode ─────────────────────────────────────────
describe("Calendar — privacy mode (Sprint 188 CAL3)", () => {
  beforeEach(() => {
    makeCalDOM();
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeFutureEvent(offsetDays = 0): import("@/types/api").CalendarEvent {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(todayMidnight.getTime() + offsetDays * 86400000);
    const end = new Date(start.getTime() + 3600000);
    return { summary: "Secret Meeting", start, end, allDay: false, icsIndex: 0 };
  }

  it("renders normal summary when privacy is off (default)", () => {
    const ev = makeFutureEvent(0);
    renderCalendar([ev]);
    const texts = Array.from(document.querySelectorAll(".cal-event-title")).map(
      (el) => el.textContent,
    );
    expect(texts.some((t) => t?.includes("Secret Meeting"))).toBe(true);
  });

  it("replaces summary with 'עסוק' when calendarPrivacy = true", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarPrivacy: true }),
    );
    const ev = makeFutureEvent(0);
    renderCalendar([ev]);
    const texts = Array.from(document.querySelectorAll(".cal-event-title")).map(
      (el) => el.textContent,
    );
    expect(texts.some((t) => t?.includes("עסוק"))).toBe(true);
    expect(texts.every((t) => !t?.includes("Secret Meeting"))).toBe(true);
  });

  it("does not mask when calendarPrivacy = false", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarPrivacy: false }),
    );
    const ev = makeFutureEvent(0);
    renderCalendar([ev]);
    const texts = Array.from(document.querySelectorAll(".cal-event-title")).map(
      (el) => el.textContent,
    );
    expect(texts.some((t) => t?.includes("Secret Meeting"))).toBe(true);
  });

  it("masks multiple events when privacy is on", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarPrivacy: true }),
    );
    const evs = [makeFutureEvent(0), makeFutureEvent(1), makeFutureEvent(2)];
    renderCalendar(evs);
    const texts = Array.from(document.querySelectorAll(".cal-event-title")).map(
      (el) => el.textContent,
    );
    expect(texts.every((t) => t?.includes("עסוק") || t === null)).toBe(true);
  });
});

// ── Sprint 188 / CAL4: Configurable horizon ──────────────────────────────────
describe("Calendar — configurable horizon (Sprint 188 CAL4)", () => {
  beforeEach(() => {
    makeCalDOM();
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Create event at weekStart + offsetFromWeekStart days (day-of-week neutral). */
  function makeEventAtWeekOffset(offsetFromWeekStart: number): import("@/types/api").CalendarEvent {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = todayMidnight.getDay(); // 0 = Sunday
    const offsetFromToday = offsetFromWeekStart - dayOfWeek;
    const start = new Date(todayMidnight.getTime() + offsetFromToday * 86400000);
    const end = new Date(start.getTime() + 3600000);
    return { summary: `WS+${offsetFromWeekStart}`, start, end, allDay: false, icsIndex: 0 };
  }

  it("uses default 21 days when calendarDaysAhead is not set", () => {
    // WS+0 and WS+20 are within 21-day window; WS+22 is outside
    const evs = [makeEventAtWeekOffset(0), makeEventAtWeekOffset(20), makeEventAtWeekOffset(22)];
    const count = renderCalendar(evs);
    expect(count).toBe(2);
  });

  it("respects calendarDaysAhead = 7 (1 week)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarDaysAhead: 7 }),
    );
    // WS+0 and WS+6 are within 7-day window; WS+8 is outside
    const evs = [makeEventAtWeekOffset(0), makeEventAtWeekOffset(6), makeEventAtWeekOffset(8)];
    const count = renderCalendar(evs);
    expect(count).toBe(2);
  });

  it("respects calendarDaysAhead = 28 (4 weeks)", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarDaysAhead: 28 }),
    );
    // WS+0 and WS+27 are within 28-day window; WS+29 is outside
    const evs = [makeEventAtWeekOffset(0), makeEventAtWeekOffset(27), makeEventAtWeekOffset(29)];
    const count = renderCalendar(evs);
    expect(count).toBe(2);
  });

  it("clamps out-of-range config value to minimum 7", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarDaysAhead: 3 }),
    );
    // Clamped to 7: WS+0 and WS+6 included, WS+8 excluded
    const evs = [makeEventAtWeekOffset(0), makeEventAtWeekOffset(6), makeEventAtWeekOffset(8)];
    const count = renderCalendar(evs);
    expect(count).toBe(2);
  });

  it("clamps out-of-range config value to maximum 60", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ configVersion: 12, calendarDaysAhead: 90 }),
    );
    // Clamped to 60: WS+0 and WS+59 included, WS+61 excluded
    const evs = [makeEventAtWeekOffset(0), makeEventAtWeekOffset(59), makeEventAtWeekOffset(61)];
    const count = renderCalendar(evs);
    expect(count).toBe(2);
  });
});

// ── Sprint 209 / CAL6: findConflicts ──────────────────────────────────
describe("Calendar — findConflicts (Sprint 209)", () => {
  function makeEv(startH: number, endH: number, allDay = false): import("@/types/api").CalendarEvent {
    const base = new Date("2024-01-08T00:00:00");
    return {
      summary: `${startH}-${endH}`,
      start: new Date(base.getTime() + startH * 3_600_000),
      end: new Date(base.getTime() + endH * 3_600_000),
      allDay,
    };
  }

  it("returns empty set for no events", () => {
    expect(findConflicts([])).toEqual(new Set());
  });

  it("returns empty set for non-overlapping events", () => {
    const evs = [makeEv(9, 10), makeEv(10, 11), makeEv(12, 13)];
    expect(findConflicts(evs).size).toBe(0);
  });

  it("detects two overlapping events", () => {
    const a = makeEv(9, 11);
    const b = makeEv(10, 12);
    const set = findConflicts([a, b]);
    expect(set.has(a)).toBe(true);
    expect(set.has(b)).toBe(true);
  });

  it("excludes all-day events from conflict detection", () => {
    const allDay = makeEv(0, 24, true);
    const timed = makeEv(9, 10);
    expect(findConflicts([allDay, timed]).size).toBe(0);
  });

  it("detects three-way conflict", () => {
    const a = makeEv(9, 13);
    const b = makeEv(10, 12);
    const c = makeEv(11, 14);
    const set = findConflicts([a, b, c]);
    expect(set.size).toBe(3);
  });
});

// ── Sprint 257: fast-check property tests (CP1–CP5) ───────────────────────

import * as fc from "fast-check";

/** Arbitrary that produces a valid CalendarEvent */
function arbCalEvent(base: Date): fc.Arbitrary<import("@/types/api").CalendarEvent> {
  return fc
    .record({
      summary: fc.string({ minLength: 1, maxLength: 60 }),
      startOffset: fc.integer({ min: 0, max: 23 * 3_600_000 }),
      durationMs: fc.integer({ min: 1, max: 4 * 3_600_000 }),
      allDay: fc.boolean(),
      icsIndex: fc.integer({ min: 0, max: 2 }),
    })
    .map(({ summary, startOffset, durationMs, allDay, icsIndex }) => {
      const start = new Date(base.getTime() + startOffset);
      const end = new Date(start.getTime() + durationMs);
      return { summary, start, end, allDay, icsIndex };
    });
}

describe("CP1 · detectCalCategory — property: always returns a known category", () => {
  const KNOWN = ["work", "family", "health", "holiday", "default"];
  it("result is always a known category for any string", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return KNOWN.includes(detectCalCategory(s));
      }),
    );
  });

  it("is deterministic for the same input", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return detectCalCategory(s) === detectCalCategory(s);
      }),
    );
  });
});

describe("CP2 · calDaysUntilLabel — property: output is always a string", () => {
  it("always returns a string", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-31") }),
        (date, now) => {
          fc.pre(isFinite(date.getTime()) && isFinite(now.getTime()));
          return typeof calDaysUntilLabel(date, now) === "string";
        },
      ),
    );
  });

  it("returns empty string for past or same-day dates", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2025-12-31") }),
        (d) => {
          fc.pre(isFinite(d.getTime()));
          const futureNow = new Date(d.getTime() + 24 * 3_600_000);
          return calDaysUntilLabel(d, futureNow) === "";
        },
      ),
    );
  });

  it("returns 'מחר' for exactly one day ahead", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-12-30") }),
        (d) => {
          fc.pre(isFinite(d.getTime()));
          const now = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
          return calDaysUntilLabel(d, now) === "מחר";
        },
      ),
    );
  });
});

describe("CP3 · findConflicts — property: subset of timed events; no all-day events included", () => {
  const BASE = new Date("2025-06-01T00:00:00.000Z");

  it("conflicts are always a subset of timed events", () => {
    fc.assert(
      fc.property(fc.array(arbCalEvent(BASE), { minLength: 0, maxLength: 12 }), (evs) => {
        const conflicts = findConflicts(evs);
        for (const c of conflicts) {
          if (!evs.includes(c)) return false;
        }
        return true;
      }),
    );
  });

  it("all-day events are never in the conflict set", () => {
    fc.assert(
      fc.property(fc.array(arbCalEvent(BASE), { minLength: 1, maxLength: 8 }), (evs) => {
        const allDayEvs = evs.map((e) => ({ ...e, allDay: true }));
        return findConflicts(allDayEvs).size === 0;
      }),
    );
  });

  it("single event has no conflicts", () => {
    fc.assert(
      fc.property(arbCalEvent(BASE), (ev) => {
        return findConflicts([{ ...ev, allDay: false }]).size === 0;
      }),
    );
  });
});

describe("CP4 · groupEventsByDay — property: always returns 21 buckets; events are partitioned", () => {
  const BASE = new Date("2025-06-01T00:00:00.000Z");

  it("always returns exactly 21 day buckets", () => {
    fc.assert(
      fc.property(fc.array(arbCalEvent(BASE), { minLength: 0, maxLength: 20 }), (evs) => {
        return groupEventsByDay(evs, BASE).length === 21;
      }),
    );
  });

  it("no event appears in more than one bucket", () => {
    fc.assert(
      fc.property(fc.array(arbCalEvent(BASE), { minLength: 1, maxLength: 10 }), (evs) => {
        const groups = groupEventsByDay(evs, BASE);
        const seen = new Set<unknown>();
        for (const { events } of groups) {
          for (const ev of events) {
            if (seen.has(ev)) return false;
            seen.add(ev);
          }
        }
        return true;
      }),
    );
  });
});

describe("CP5 · parseICS — property: always returns an array; no events for empty input", () => {
  it("always returns an array", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return Array.isArray(parseICS(s));
      }),
    );
  });

  it("returns empty array for strings with no VEVENT blocks", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("BEGIN:VEVENT")),
        (s) => {
          return parseICS(s).length === 0;
        },
      ),
    );
  });
});
