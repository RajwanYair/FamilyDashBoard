/**
 * Tests for src/cards/countdown/countdown.ts
 *
 * Covers: getTimeComponents, tick (ongoing/past/days variations),
 * initCountdownCard, destroyCountdownCard,
 * getCountdownTargetDate, getCountdownTitle, getCountdownDoneMsg.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTimeComponents,
  tick,
  tick2,
  tick3,
  initCountdownCard,
  destroyCountdownCard,
  getCountdownTargetDate,
  getCountdownTitle,
  getCountdownDoneMsg,
  getDaysSince,
  computeProgress,
  urgencyClass,
  hebrewDayOfWeek,
  daysLabel,
  advanceAnnualDate,
  countdownConfigSchema,
} from "@/cards/countdown/countdown";
import { loadConfig } from "@/core/config";
import type { DashboardConfig } from "@/types/config";

vi.mock("@/core/config", () => ({
  loadConfig: vi.fn(),
}));

// Default mock configs
const FUTURE_CFG: DashboardConfig = {
  countdownCardDate: "2099-12-31",
  countdownCardTime: "23:59",
  countdownCardTitle: "חתונת אליאור וטובה",
  countdownCardDoneMsg: "🎉 מזל טוב לאליאור ולטובה!",
} as DashboardConfig;

const PAST_CFG: DashboardConfig = {
  countdownCardDate: "2000-01-01",
  countdownCardTime: "00:00",
  countdownCardTitle: "חתונת אליאור וטובה",
  countdownCardDoneMsg: "🎉 מזל טוב לאליאור ולטובה!",
} as DashboardConfig;

// ── DOM helpers ────────────────────────────────────────────────────────────

function buildDOM(): void {
  document.body.innerHTML = `
    <div id="cd-wedding-title"></div>
    <div id="cd-days"></div>
    <div id="cd-hours"></div>
    <div id="cd-mins"></div>
    <div id="cd-secs"></div>
    <div id="cd-msg"></div>
  `;
}

// ── getTimeComponents ──────────────────────────────────────────────────────

describe("getTimeComponents", () => {
  it("breaks a future ms value into days/hours/minutes/seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T12:00:00.000Z"));
    const now = Date.now();
    const targetMs = now + 1 * 86400 * 1000 + 2 * 3600 * 1000 + 3 * 60 * 1000 + 4 * 1000;
    const result = getTimeComponents(targetMs);
    vi.useRealTimers();
    expect(result.days).toBe(1);
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(3);
    expect(result.seconds).toBe(4);
  });

  it("returns zeros when target is in the past", () => {
    const past = Date.now() - 10_000;
    const result = getTimeComponents(past);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });

  it("returns zeros when target equals now", () => {
    const result = getTimeComponents(Date.now());
    expect(result.days).toBe(0);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
  });
});

// ── tick — ongoing countdown ───────────────────────────────────────────────

describe("tick — ongoing countdown", () => {
  beforeEach(() => {
    buildDOM();
    vi.mocked(loadConfig).mockReturnValue(FUTURE_CFG);
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("populates all tile elements with numeric values", () => {
    tick();
    expect(document.getElementById("cd-days")?.textContent).toMatch(/\d+/);
    expect(document.getElementById("cd-hours")?.textContent).toMatch(/\d{2}/);
    expect(document.getElementById("cd-mins")?.textContent).toMatch(/\d{2}/);
    expect(document.getElementById("cd-secs")?.textContent).toMatch(/\d{2}/);
  });

  it("sets title to config title when event is in the future", () => {
    tick();
    expect(document.getElementById("cd-wedding-title")?.textContent).toBe(
      FUTURE_CFG.countdownCardTitle,
    );
  });

  it("pads hours/mins/secs to 2 digits", () => {
    tick();
    const hours = document.getElementById("cd-hours")?.textContent ?? "";
    const mins = document.getElementById("cd-mins")?.textContent ?? "";
    const secs = document.getElementById("cd-secs")?.textContent ?? "";
    expect(hours.length).toBeGreaterThanOrEqual(2);
    expect(mins.length).toBeGreaterThanOrEqual(2);
    expect(secs.length).toBeGreaterThanOrEqual(2);
  });
});

// ── tick — event has passed ────────────────────────────────────────────────

describe("tick — event has passed", () => {
  beforeEach(() => {
    buildDOM();
    vi.mocked(loadConfig).mockReturnValue(PAST_CFG);
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows mazel tov message when target is in the past", () => {
    tick();
    expect(document.getElementById("cd-wedding-title")?.textContent).toContain("מזל");
    expect(document.getElementById("cd-msg")?.textContent).toContain("מזל טוב");
  });

  it("shows days-since and zeroes hours/mins/secs when target has passed", () => {
    tick();
    // cd-days now shows days elapsed since the event (getDaysSince)
    expect(document.getElementById("cd-days")?.textContent).toMatch(/^\d+$/);
    expect(document.getElementById("cd-hours")?.textContent).toBe("00");
    expect(document.getElementById("cd-mins")?.textContent).toBe("00");
    expect(document.getElementById("cd-secs")?.textContent).toBe("00");
  });
});

// ── tick — near-term messaging ─────────────────────────────────────────────

describe("tick — proximity messages", () => {
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows today message when less than 1 day remains", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-12-30T23:30:00"));
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCardDate: "2099-12-31",
      countdownCardTime: "00:00",
    } as DashboardConfig);
    tick();
    expect(document.getElementById("cd-msg")?.textContent).toContain("היום");
  });

  it("shows 1 day message when exactly 1 day remains", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-12-30T00:00:00"));
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCardDate: "2099-12-31",
      countdownCardTime: "00:01",
    } as DashboardConfig);
    tick();
    expect(document.getElementById("cd-msg")?.textContent).toContain("יום");
  });
});

// ── tick — no DOM ──────────────────────────────────────────────────────────

describe("tick — missing DOM", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when DOM elements are absent", () => {
    document.body.innerHTML = "";
    expect(() => tick()).not.toThrow();
  });
});

// ── initCountdownCard / destroyCountdownCard ───────────────────────────────

describe("initCountdownCard / destroyCountdownCard", () => {
  beforeEach(() => {
    buildDOM();
    vi.mocked(loadConfig).mockReturnValue(FUTURE_CFG);
  });
  afterEach(() => {
    destroyCountdownCard();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("populates the DOM on init", () => {
    initCountdownCard();
    expect(document.getElementById("cd-days")?.textContent).toMatch(/\d+/);
    destroyCountdownCard();
  });

  it("destroy clears the interval without throwing", () => {
    initCountdownCard();
    expect(() => destroyCountdownCard()).not.toThrow();
  });

  it("double-destroy does not throw", () => {
    destroyCountdownCard();
    expect(() => destroyCountdownCard()).not.toThrow();
  });
});

// ── config helper functions ────────────────────────────────────────────────

describe("config helper functions", () => {
  it("getCountdownTargetDate returns a Date from config", () => {
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCardDate: "2026-05-07",
      countdownCardTime: "18:00",
    } as DashboardConfig);
    const d = getCountdownTargetDate();
    expect(d instanceof Date).toBe(true);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-based May
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(18);
  });

  it("getCountdownTitle returns config title", () => {
    vi.mocked(loadConfig).mockReturnValue(FUTURE_CFG);
    const title = getCountdownTitle();
    expect(title).toContain("חתונת");
    expect(title).toContain("אליאור");
    expect(title).toContain("טובה");
  });

  it("getCountdownDoneMsg returns config done message", () => {
    vi.mocked(loadConfig).mockReturnValue(FUTURE_CFG);
    const msg = getCountdownDoneMsg();
    expect(msg).toContain("מזל טוב");
  });

  it("getCountdownTargetDate falls back to defaults when config is empty", () => {
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "",
      countdownCardTime: "",
      countdownCardTitle: "",
      countdownCardDoneMsg: "",
    } as DashboardConfig);
    const d = getCountdownTargetDate();
    expect(d instanceof Date).toBe(true);
    expect(d.getFullYear()).toBe(2026);
  });
});

// ── Sprint v7.11: getDaysSince + tick past-event days-since display ──

describe("Countdown — getDaysSince", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 0 when targetMs is now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    expect(getDaysSince(1_000_000_000_000)).toBe(0);
  });

  it("returns 1 when one day (86_400_000 ms) has elapsed", () => {
    vi.useFakeTimers();
    const target = 1_000_000_000_000;
    vi.setSystemTime(target + 86_400_000);
    expect(getDaysSince(target)).toBe(1);
  });

  it("returns 5 when five days have elapsed", () => {
    vi.useFakeTimers();
    const target = 1_000_000_000_000;
    vi.setSystemTime(target + 5 * 86_400_000);
    expect(getDaysSince(target)).toBe(5);
  });
});

describe("Countdown — tick shows daysSince when event has passed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="cd-wedding-title"></div>
      <div id="cd-days"></div>
      <div id="cd-hours"></div>
      <div id="cd-mins"></div>
      <div id="cd-secs"></div>
      <div id="cd-msg"></div>`;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("shows daysSince count of 3 in daysEl when 3 days past the event", () => {
    const PAST_CFG_LOCAL = {
      countdownCardDate: "2020-01-01",
      countdownCardTime: "00:00",
      countdownCardTitle: "test",
      countdownCardDoneMsg: "🎉 מזל טוב",
    } as DashboardConfig;
    vi.mocked(loadConfig).mockReturnValue(PAST_CFG_LOCAL);
    // Set now to 3 days + 1 hour after target
    const target = new Date("2020-01-01T00:00:00").getTime();
    vi.setSystemTime(target + 3 * 86_400_000 + 3_600_000);
    // initCountdownCard refreshes els cache so tick() writes to the current DOM
    initCountdownCard();
    destroyCountdownCard();
    const daysEl = document.getElementById("cd-days");
    expect(daysEl?.textContent).toBe("3");
    const msgEl = document.getElementById("cd-msg");
    expect(msgEl?.textContent).toContain("יום 3");
  });
});

// ── Sprint v7.13: tick() clears _cdInterval when event is past on second tick (lines 119-120) ──

describe("Countdown — tick() clears interval on second tick when event is past (lines 119-120)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <div id="cd-wedding-title"></div>
      <div id="cd-days"></div>
      <div id="cd-hours"></div>
      <div id="cd-mins"></div>
      <div id="cd-secs"></div>
      <div id="cd-msg"></div>`;
  });

  afterEach(() => {
    destroyCountdownCard();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("clears the interval when tick fires a second time with a past event (lines 119-120)", () => {
    vi.mocked(loadConfig).mockReturnValue(PAST_CFG);
    // Position now 1 day after the 2000-01-01 target
    vi.setSystemTime(new Date("2000-01-02T12:00:00"));
    initCountdownCard(); // first tick runs synchronously (_cdInterval still null → lines 119-120 NOT hit yet)
    // Advance clock 1001ms: interval fires tick() again; now _cdInterval !== null → lines 119-120 HIT
    vi.advanceTimersByTime(1001);
    // destroyCountdownCard now operates on the already-nulled _cdInterval — should not throw
    expect(() => destroyCountdownCard()).not.toThrow();
    const msgEl = document.getElementById("cd-msg");
    expect(msgEl?.textContent).toContain("מזל טוב");
  });
});

// ── computeProgress (sprint v7.1.7) ──────────────────────────────────────────

describe("Countdown — computeProgress", () => {
  it("returns null when startMs >= targetMs (invalid range)", () => {
    const target = new Date("2026-06-01").getTime();
    expect(computeProgress(target, target)).toBeNull();
    expect(computeProgress(target + 1000, target)).toBeNull();
  });

  it("returns 0 when now is exactly at the start date", () => {
    vi.useFakeTimers();
    const start = Date.now();
    const target = start + 10_000_000;
    expect(computeProgress(start, target)).toBe(0);
    vi.useRealTimers();
  });

  it("returns 1 (clamped) when now is past the target date", () => {
    const target = Date.now() - 1000;
    const start = target - 10_000_000;
    expect(computeProgress(start, target)).toBe(1);
  });

  it("returns a value between 0 and 1 for an in-progress countdown", () => {
    const start = Date.now() - 5_000_000;
    const target = Date.now() + 5_000_000;
    const progress = computeProgress(start, target);
    expect(progress).not.toBeNull();
    if (progress !== null) {
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    }
  });
});
// ── F8 (v7.2): tick2 — 2nd event ─────────────────────────────────────────

describe("Countdown — tick2 (F8 v7.2)", () => {
  function build2DOM(): void {
    document.body.innerHTML = `
      <div id="cd2-section"></div>
      <div id="cd2-title"></div>
      <div id="cd2-days"></div>
      <div id="cd2-hours"></div>
      <div id="cd2-mins"></div>
      <div id="cd2-secs"></div>
      <div id="cd2-msg"></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("hides #cd2-section when no date is configured", () => {
    build2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "",
      countdownCard2Title: "",
      countdownCard2Time: "18:00",
      countdownCard2DoneMsg: "🎉",
    } as DashboardConfig);
    tick2();
    expect(document.getElementById("cd2-section")?.style.display).toBe("none");
  });

  it("shows #cd2-section and renders title when date is set", () => {
    build2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2099-12-31",
      countdownCard2Title: "אירוע מיוחד",
      countdownCard2Time: "18:00",
      countdownCard2DoneMsg: "🎉",
    } as DashboardConfig);
    tick2();
    expect(document.getElementById("cd2-section")?.style.display).not.toBe("none");
    expect(document.getElementById("cd2-title")?.textContent).toBe("אירוע מיוחד");
  });

  it("shows done message when event date is in the past", () => {
    build2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2000-01-01",
      countdownCard2Title: "אירוע עבר",
      countdownCard2Time: "00:00",
      countdownCard2DoneMsg: "🎉 מזל טוב!",
    } as DashboardConfig);
    tick2();
    expect(document.getElementById("cd2-msg")?.textContent).toContain("מזל טוב");
  });

  it("does not throw when #cd2-section is absent", () => {
    document.body.innerHTML = "";
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2099-01-01",
      countdownCard2Title: "Test",
      countdownCard2Time: "12:00",
      countdownCard2DoneMsg: "done",
    } as DashboardConfig);
    expect(() => tick2()).not.toThrow();
  });
});

// ── Sprint 23: urgencyClass ──────────────────────────────────────────────────

describe("Countdown — urgencyClass", () => {
  it("returns 'cd-urgent-pulse' when days = 0", () => {
    expect(urgencyClass(0)).toBe("cd-urgent-pulse");
  });

  it("returns 'cd-urgent-pulse' when days = 1", () => {
    expect(urgencyClass(1)).toBe("cd-urgent-pulse");
  });

  it("returns 'cd-urgent-amber' when days = 2", () => {
    expect(urgencyClass(2)).toBe("cd-urgent-amber");
  });

  it("returns 'cd-urgent-amber' when days = 7", () => {
    expect(urgencyClass(7)).toBe("cd-urgent-amber");
  });

  it("returns empty string when days = 8", () => {
    expect(urgencyClass(8)).toBe("");
  });

  it("returns empty string for large day counts", () => {
    expect(urgencyClass(100)).toBe("");
  });
});

// ── Sprint 23: hebrewDayOfWeek ────────────────────────────────────────────────

describe("Countdown — hebrewDayOfWeek", () => {
  it("returns a non-empty Hebrew string", () => {
    const name = hebrewDayOfWeek(new Date("2024-01-07")); // Sunday
    expect(typeof name).toBe("string");
    expect(name.length).toBeGreaterThan(0);
  });

  it("returns a different name for different days", () => {
    const sun = hebrewDayOfWeek(new Date("2024-01-07")); // Sunday
    const mon = hebrewDayOfWeek(new Date("2024-01-08")); // Monday
    expect(sun).not.toBe(mon);
  });
});

// ── Sprint 23: daysLabel ─────────────────────────────────────────────────────

describe("Countdown — daysLabel", () => {
  it("returns 'היום! 🎉' when days = 0", () => {
    expect(daysLabel(0)).toBe("היום! 🎉");
  });

  it("returns 'מחר' when days = 1", () => {
    expect(daysLabel(1)).toBe("מחר");
  });

  it("returns 'N ימים' for other counts", () => {
    expect(daysLabel(5)).toBe("5 ימים");
    expect(daysLabel(30)).toBe("30 ימים");
  });
});

// ── Sprint 23: advanceAnnualDate ─────────────────────────────────────────────

describe("Countdown — advanceAnnualDate", () => {
  it("returns the same date string when date is in the future", () => {
    const futureDate = "2099-12-31";
    expect(advanceAnnualDate(futureDate)).toBe(futureDate);
  });

  it("advances a past date to next occurrence", () => {
    const pastDate = "2000-06-15";
    const result = advanceAnnualDate(pastDate);
    const resultDate = new Date(result);
    expect(resultDate.getTime()).toBeGreaterThan(Date.now());
    // Verify same month and day
    const parts = result.split("-");
    expect(parts[1]).toBe("06");
    expect(parts[2]).toBe("15");
  });

  it("returns the input unchanged for invalid date strings", () => {
    expect(advanceAnnualDate("bad")).toBe("bad");
  });
});

// ── Sprint 22: tick3 — 3rd event ─────────────────────────────────────────

describe("Countdown — tick3 (Sprint 22)", () => {
  function build3DOM(): void {
    document.body.innerHTML = `
      <div id="cd3-section"></div>
      <div id="cd3-title"></div>
      <div id="cd3-days"></div>
      <div id="cd3-hours"></div>
      <div id="cd3-mins"></div>
      <div id="cd3-secs"></div>
      <div id="cd3-msg"></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("hides #cd3-section when no date is configured", () => {
    build3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "",
      countdownCard3Title: "",
      countdownCard3Time: "18:00",
      countdownCard3DoneMsg: "🎉",
    } as DashboardConfig);
    tick3();
    expect(document.getElementById("cd3-section")?.style.display).toBe("none");
  });

  it("shows #cd3-section and renders title when date is set", () => {
    build3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2099-12-31",
      countdownCard3Title: "אירוע שלישי",
      countdownCard3Time: "18:00",
      countdownCard3DoneMsg: "🎉",
    } as DashboardConfig);
    tick3();
    expect(document.getElementById("cd3-section")?.style.display).not.toBe("none");
    expect(document.getElementById("cd3-title")?.textContent).toBe("אירוע שלישי");
  });

  it("shows done message when event date is in the past", () => {
    build3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2000-01-01",
      countdownCard3Title: "אירוע עבר",
      countdownCard3Time: "00:00",
      countdownCard3DoneMsg: "🎉 גמרנו!",
    } as DashboardConfig);
    tick3();
    expect(document.getElementById("cd3-msg")?.textContent).toContain("גמרנו");
  });

  it("falls back to default title 'אירוע 3' when title is empty", () => {
    build3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2099-06-01",
      countdownCard3Title: "",
      countdownCard3Time: "10:00",
      countdownCard3DoneMsg: "",
    } as DashboardConfig);
    tick3();
    expect(document.getElementById("cd3-title")?.textContent).toBe("אירוע 3");
  });

  it("does not throw when #cd3-section is absent", () => {
    document.body.innerHTML = "";
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2099-01-01",
      countdownCard3Title: "Test",
      countdownCard3Time: "12:00",
      countdownCard3DoneMsg: "done",
    } as DashboardConfig);
    expect(() => tick3()).not.toThrow();
  });
});

// ── Sprint 31: CD2 + CD3 progress bars ────────────────────────────────────

describe("Countdown — tick2 progress bar (Sprint 31)", () => {
  function buildCD2DOM(): void {
    document.body.innerHTML = `
      <div id="cd2-section"></div>
      <div id="cd2-title"></div>
      <div id="cd2-days"></div><div id="cd2-hours"></div>
      <div id="cd2-mins"></div><div id="cd2-secs"></div>
      <div id="cd2-msg"></div>
      <div id="cd2-progress-wrap" style="display:none"><div id="cd2-progress-bar"></div></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows progress bar when start date is set and event is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildCD2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2025-12-31",
      countdownCard2Time: "00:00",
      countdownCard2Title: "אירוע 2",
      countdownCard2DoneMsg: "done",
      countdownCard2StartDate: "2025-01-01",
    } as DashboardConfig);
    tick2();
    expect(document.getElementById("cd2-progress-wrap")?.style.display).toBe("");
    const bar = document.getElementById("cd2-progress-bar") as HTMLElement;
    expect(bar.style.width).toMatch(/^\d+%$/);
  });

  it("hides progress bar when no start date is set", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildCD2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2025-12-31",
      countdownCard2Time: "00:00",
      countdownCard2Title: "אירוע 2",
      countdownCard2DoneMsg: "done",
      countdownCard2StartDate: "",
    } as DashboardConfig);
    tick2();
    expect(document.getElementById("cd2-progress-wrap")?.style.display).toBe("none");
  });

  it("shows 50% progress when midpoint is reached", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-07-01T00:00:00")); // midpoint of Jan–Dec
    buildCD2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2026-01-01",
      countdownCard2Time: "00:00",
      countdownCard2Title: "אירוע 2",
      countdownCard2DoneMsg: "done",
      countdownCard2StartDate: "2025-01-01",
    } as DashboardConfig);
    tick2();
    const bar = document.getElementById("cd2-progress-bar") as HTMLElement;
    const pct = parseInt(bar.style.width, 10);
    expect(pct).toBeGreaterThan(30);
    expect(pct).toBeLessThan(70);
  });
});

describe("Countdown — tick3 progress bar (Sprint 31)", () => {
  function buildCD3DOM(): void {
    document.body.innerHTML = `
      <div id="cd3-section"></div>
      <div id="cd3-title"></div>
      <div id="cd3-days"></div><div id="cd3-hours"></div>
      <div id="cd3-mins"></div><div id="cd3-secs"></div>
      <div id="cd3-msg"></div>
      <div id="cd3-progress-wrap" style="display:none"><div id="cd3-progress-bar"></div></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows progress bar when start date is set and event is in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildCD3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2025-12-31",
      countdownCard3Time: "00:00",
      countdownCard3Title: "אירוע 3",
      countdownCard3DoneMsg: "done",
      countdownCard3StartDate: "2025-01-01",
    } as DashboardConfig);
    tick3();
    expect(document.getElementById("cd3-progress-wrap")?.style.display).toBe("");
    const bar = document.getElementById("cd3-progress-bar") as HTMLElement;
    expect(bar.style.width).toMatch(/^\d+%$/);
  });

  it("hides progress bar when no start date configured", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildCD3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2025-12-31",
      countdownCard3Time: "00:00",
      countdownCard3Title: "אירוע 3",
      countdownCard3DoneMsg: "done",
      countdownCard3StartDate: "",
    } as DashboardConfig);
    tick3();
    expect(document.getElementById("cd3-progress-wrap")?.style.display).toBe("none");
  });

  it("does not throw when progress DOM absent with start date set", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    document.body.innerHTML = `
      <div id="cd3-section"></div><div id="cd3-title"></div>
      <div id="cd3-days"></div><div id="cd3-hours"></div>
      <div id="cd3-mins"></div><div id="cd3-secs"></div><div id="cd3-msg"></div>
    `;
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard3Date: "2025-12-31",
      countdownCard3Time: "00:00",
      countdownCard3Title: "Test",
      countdownCard3DoneMsg: "done",
      countdownCard3StartDate: "2025-01-01",
    } as DashboardConfig);
    expect(() => tick3()).not.toThrow();
  });
});

// ── Sprint 82: configSchema ─────────────────────────────────────────────

describe("Countdown — configSchema (Sprint 82)", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(countdownConfigSchema)).toBe(true);
    expect(countdownConfigSchema.length).toBeGreaterThan(0);
  });

  it("includes primary event fields", () => {
    const keys = countdownConfigSchema.map((f) => f.key);
    expect(keys).toContain("countdownCardTitle");
    expect(keys).toContain("countdownCardDate");
    expect(keys).toContain("countdownCardTime");
    expect(keys).toContain("countdownCardDoneMsg");
  });

  it("includes event 2 and event 3 fields", () => {
    const keys = countdownConfigSchema.map((f) => f.key);
    expect(keys).toContain("countdownCard2Title");
    expect(keys).toContain("countdownCard3Title");
  });

  it("all fields have required properties", () => {
    for (const f of countdownConfigSchema) {
      expect(f.key).toBeTruthy();
      expect(f.labelHe).toBeTruthy();
      expect(f.labelEn).toBeTruthy();
      expect(f.type).toBeTruthy();
      expect(f.defaultValue).toBeDefined();
    }
  });
});

// ── tick() primary progress bar (lines 201-211) ──────────────────────────────

describe("Countdown — tick() primary progress bar", () => {
  function buildProgressDOM(): void {
    document.body.innerHTML = `
      <div id="cd-wedding-title"></div>
      <div id="cd-days"></div>
      <div id="cd-hours"></div>
      <div id="cd-mins"></div>
      <div id="cd-secs"></div>
      <div id="cd-msg"></div>
      <div id="cd-progress-wrap" style="display:none"><div id="cd-progress-bar"></div></div>
    `;
  }

  afterEach(() => {
    destroyCountdownCard();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("shows progress bar and sets width when startDate is configured (lines 202-205)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildProgressDOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2025-12-31",
      countdownCardTime: "00:00",
      countdownCardTitle: "Test",
      countdownCardDoneMsg: "done",
      countdownCardStartDate: "2025-01-01",
    } as DashboardConfig);
    tick();
    expect(document.getElementById("cd-progress-wrap")?.style.display).toBe("");
    const bar = document.getElementById("cd-progress-bar") as HTMLElement;
    expect(bar.style.width).toMatch(/^\d+%$/);
  });

  it("hides progress wrap when no startDate is configured (line 210-211)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildProgressDOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2025-12-31",
      countdownCardTime: "00:00",
      countdownCardTitle: "Test",
      countdownCardDoneMsg: "done",
      countdownCardStartDate: "",
    } as DashboardConfig);
    tick();
    expect(document.getElementById("cd-progress-wrap")?.style.display).toBe("none");
  });

  it("hides progress wrap when computeProgress returns null (startMs >= targetMs, line 206-208)", () => {
    vi.useFakeTimers();
    // Set now to be after the target date so start > target
    vi.setSystemTime(new Date("2025-12-31T00:00:00"));
    buildProgressDOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2025-01-01",
      countdownCardTime: "00:00",
      countdownCardTitle: "Test",
      countdownCardDoneMsg: "done",
      countdownCardStartDate: "2025-12-01", // start > target → computeProgress returns null
    } as DashboardConfig);
    tick();
    expect(document.getElementById("cd-progress-wrap")?.style.display).toBe("none");
  });
});

// ── Sprint 83: computeProgress edge cases ─────────────────────────────────

describe("Countdown — computeProgress edge cases (Sprint 83)", () => {
  it("clamps to 0 when elapsed is negative (start in the future)", () => {
    const now = Date.now();
    const start = now + 100_000; // start in future
    const target = now + 1_000_000;
    const result = computeProgress(start, target);
    // start < target so not null, but elapsed (now - start) is negative → clamps to 0
    expect(result).toBe(0);
  });

  it("clamps to 1 when elapsed exceeds total (event is past target)", () => {
    const now = Date.now();
    const start = now - 2_000_000;
    const target = now - 100_000; // target in the past
    const result = computeProgress(start, target);
    // elapsed > total → progress should be 1 (100% complete, clamped)
    expect(result).toBe(1);
  });

  it("returns exactly 0 when start === now", () => {
    // freeze time
    vi.useFakeTimers();
    const now = new Date("2029-01-01T12:00:00").getTime();
    vi.setSystemTime(now);
    const target = now + 10_000_000;
    const result = computeProgress(now, target);
    expect(result).toBe(0);
    vi.useRealTimers();
  });
});

// ── Sprint 83: getDaysSince — future targets clamp to 0 ──────────────────

describe("Countdown — getDaysSince future target clamp (Sprint 83)", () => {
  it("returns 0 when targetMs is in the future", () => {
    const future = Date.now() + 24 * 60 * 60 * 1000;
    expect(getDaysSince(future)).toBe(0);
  });

  it("returns 0 when targetMs is exactly now", () => {
    expect(getDaysSince(Date.now())).toBe(0);
  });
});
