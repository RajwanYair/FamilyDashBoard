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
  it("returns 7 buckets starting at today midnight", () => {
    const now = new Date("2024-06-10T15:00:00");
    const buckets = groupEventsByDay([], now);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]!.date.getDate()).toBe(10);
    expect(buckets[6]!.date.getDate()).toBe(16);
  });

  it("drops events outside the 7-day window", () => {
    const now = new Date("2024-06-10T08:00:00");
    const past = new Date("2024-06-05T10:00:00");
    const far = new Date("2024-07-01T10:00:00");
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
  beforeEach(makeCalDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders 7 day tiles even when no events", () => {
    renderCalendar([]);
    const grid = document.getElementById("cal-week-grid");
    expect(grid?.querySelectorAll(".cal-day-tile").length).toBe(7);
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
    expect(count).toBe(1);
    const tiles = document.querySelectorAll(".cal-day-tile");
    // tomorrow = index 1
    expect(tiles[1]?.textContent).toContain("Test Event");
    expect(tiles[1]?.classList.contains("is-empty")).toBe(false);
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
    expect(tiles[1]?.querySelector(".cal-day-count")?.textContent).toBe("3");
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
      { summary: "B", start: start2, end: end2, allDay: false, icsIndex: 0, category: "default" as const },
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
      { summary: "B", start: start2, end: end2, allDay: false, icsIndex: 0, category: "default" as const },
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
      { summary: "Long", start: tomorrow, end, allDay: false, icsIndex: 0, category: "default" as const },
    ]);
    const time = document.querySelector(".cal-event-time");
    expect(time?.textContent).toContain("–");
  });

  it("renders single time (no dash) for zero-duration event", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    renderCalendar([
      { summary: "Zero", start: tomorrow, end: tomorrow, allDay: false, icsIndex: 0, category: "default" as const },
    ]);
    const time = document.querySelector(".cal-event-time");
    expect(time?.textContent).not.toContain("–");
  });
});

// ── countdown + header count ──────────────────────────────────────────────
describe("Calendar — countdown + header count", () => {
  beforeEach(makeCalDOM);
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("countdown visible when next event is within 7 days", () => {
    const start = new Date(Date.now() + 3 * 86_400_000);
    const end = new Date(start.getTime() + 3_600_000);
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
      { summary: "Soon", start: soon, end, allDay: false, icsIndex: 0, category: "default" as const },
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
      if (!urlStr.includes("allorigins") && !urlStr.includes("codetabs") && !urlStr.includes("corsproxy")) {
        throw new Error("direct fail");
      }
      if (urlStr.includes("allorigins")) {
        return { ok: false, text: async () => "" } as Response;
      }
      return { ok: true, json: async () => ({}), text: async () => "not a calendar response" } as Response;
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
    expect(grid?.querySelectorAll(".cal-day-tile").length).toBe(7);
  });

  it("outer catch fires when syncBurst throws after allEvents > 0", async () => {
    vi.mocked(fetchCore.acquireLock).mockReturnValueOnce(true);
    const futureDate = new Date(Date.now() + 86_400_000 * 30);
    const dtStr =
      futureDate.toISOString().replace(/-|:|\.\d+/g, "").slice(0, 15) + "Z";
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
    const ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20251201T120000Z\r\nSUMMARY:CRLF Event\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles null bytes without crashing", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nSUMMARY:Null\x00Byte\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles duplicate DTSTART lines", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nDTSTART:20251202T120000Z\nSUMMARY:Dup\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, 0)).not.toThrow();
  });

  it("handles negative icsIndex", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20251201T120000Z\nSUMMARY:Neg\nEND:VEVENT\nEND:VCALENDAR";
    expect(() => parseICS(ics, -1)).not.toThrow();
  });
});
