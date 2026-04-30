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
  advanceMonthlyDate,
  getNextYomTov,
  getNextCalEventForCountdown,
  countdownConfigSchema,
  setConfetti,
} from "@/cards/countdown/countdown";
import { loadConfig } from "@/core/config";
import { cSet, cClear } from "@/core/cache";
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

  it("shows empty message when more than 7 days remain (line 187 FALSE branch)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00"));
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCardDate: "2099-12-31",
      countdownCardTime: "00:00",
    } as DashboardConfig);
    tick();
    expect(document.getElementById("cd-msg")?.textContent).toBe("");
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

  it("skips null element updates when tickSecondary elements are absent (lines 245, 249-262 FALSE)", () => {
    // Only create cd2-section — all inner elements are absent
    document.body.innerHTML = `<div id="cd2-section"></div>`;
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2099-01-01",
      countdownCard2Title: "Test",
      countdownCard2Time: "12:00",
      countdownCard2DoneMsg: "done",
    } as DashboardConfig);
    // Should not throw
    expect(() => tick2()).not.toThrow();
  });

  it("skips null element updates when event passed and elements absent (lines 249-253 FALSE branches)", () => {
    document.body.innerHTML = `<div id="cd2-section"></div>`;
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2000-01-01", // past
      countdownCard2Title: "Past",
      countdownCard2Time: "00:00",
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

  it("hides progress wrap when startDate is after target (line 273 — now < target, startMs >= targetMs)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildCD2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCard2Date: "2026-12-31",
      countdownCard2Time: "00:00",
      countdownCard2Title: "אירוע 2",
      countdownCard2DoneMsg: "done",
      countdownCard2StartDate: "2027-01-01", // startMs > targetMs → computeProgress returns null
    } as DashboardConfig);
    tick2();
    expect(document.getElementById("cd2-progress-wrap")?.style.display).toBe("none");
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

  it("hides progress wrap when startDate is after target (line 208 — now < target, startMs >= targetMs)", () => {
    vi.useFakeTimers();
    // now is BEFORE target so we don't return early, but startDate is after target
    vi.setSystemTime(new Date("2025-06-01T00:00:00"));
    buildProgressDOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2026-12-31", // target is in the future (now < target)
      countdownCardTime: "00:00",
      countdownCardTitle: "Test",
      countdownCardDoneMsg: "done",
      countdownCardStartDate: "2027-01-01", // startMs > targetMs → computeProgress returns null
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

// ── Sprint 180 / CD3: advanceMonthlyDate ─────────────────────────────────

describe("Countdown — advanceMonthlyDate (Sprint 180 CD3)", () => {
  it("returns future date unchanged", () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 2);
    const str = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-15`;
    expect(advanceMonthlyDate(str)).toBe(str);
  });

  it("advances past date by one or more months", () => {
    const result = advanceMonthlyDate("2000-01-15");
    const d = new Date(`${result}T00:00:00`);
    expect(d.getTime()).toBeGreaterThanOrEqual(Date.now());
    expect(d.getDate()).toBe(15); // same day of month preserved
  });

  it("handles invalid date string gracefully", () => {
    expect(advanceMonthlyDate("not-a-date")).toBe("not-a-date");
  });

  it("advances a date in the recent past by 1 month", () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // last month
    const pastStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const result = advanceMonthlyDate(pastStr);
    const resultDate = new Date(`${result}T00:00:00`);
    expect(resultDate.getTime()).toBeGreaterThan(Date.now() - 1);
  });
});

// ── Sprint 180 / CD1: getNextYomTov ─────────────────────────────────────

describe("Countdown — getNextYomTov (Sprint 180 CD1)", () => {
  const now = new Date("2025-09-01T12:00:00");

  it("returns null for empty items", () => {
    expect(getNextYomTov([], now)).toBeNull();
  });

  it("returns null when no holidays within maxDays", () => {
    const items = [
      { title: "Passover", date: "2025-04-13", category: "holiday", hebrew: "פסח" },
    ];
    expect(getNextYomTov(items, now)).toBeNull();
  });

  it("returns the nearest upcoming holiday", () => {
    const items = [
      { title: "Rosh Hashana", date: "2025-09-23", category: "holiday", hebrew: "ראש השנה" },
      { title: "Yom Kippur", date: "2025-10-02", category: "holiday", hebrew: "יום כיפור" },
    ];
    const result = getNextYomTov(items, now);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("ראש השנה");
    expect(result?.date).toBe("2025-09-23");
  });

  it("ignores non-holiday categories", () => {
    const items = [
      { title: "Shabbat Parshat", date: "2025-09-06", category: "parashat", hebrew: "בראשית" },
    ];
    expect(getNextYomTov(items, now)).toBeNull();
  });

  it("returns null when holiday is beyond maxDays", () => {
    const items = [
      { title: "Passover", date: "2026-04-01", category: "holiday", hebrew: "פסח" },
    ];
    expect(getNextYomTov(items, now, 90)).toBeNull();
  });
});

// ── Sprint 180 / CD2: getNextCalEventForCountdown ───────────────────────

describe("Countdown — getNextCalEventForCountdown (Sprint 180 CD2)", () => {
  it("returns null for empty ICS text", () => {
    expect(getNextCalEventForCountdown("BEGIN:VCALENDAR\nEND:VCALENDAR")).toBeNull();
  });

  it("returns null when all events are too soon (< 7 days)", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const d = tomorrow.toISOString().slice(0, 10).replace(/-/g, "");
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Near event\nDTSTART:${d}T120000\nEND:VEVENT\nEND:VCALENDAR`;
    expect(getNextCalEventForCountdown(ics, 7)).toBeNull();
  });

  it("returns the soonest event that is at least minDaysAhead away", () => {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    const d = future.toISOString().slice(0, 10).replace(/-/g, "");
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Family Trip\nDTSTART:${d}\nEND:VEVENT\nEND:VCALENDAR`;
    const result = getNextCalEventForCountdown(ics, 7);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Family Trip");
  });

  it("returns the nearer of two qualifying events", () => {
    const d1 = new Date(); d1.setDate(d1.getDate() + 10);
    const d2 = new Date(); d2.setDate(d2.getDate() + 20);
    const s1 = d1.toISOString().slice(0, 10).replace(/-/g, "");
    const s2 = d2.toISOString().slice(0, 10).replace(/-/g, "");
    const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Event B\nDTSTART:${s2}\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:Event A\nDTSTART:${s1}\nEND:VEVENT\nEND:VCALENDAR`;
    const result = getNextCalEventForCountdown(ics, 7);
    expect(result?.title).toBe("Event A");
  });
});

// ── Sprint 191 / CD4: setConfetti ────────────────────────────────────────

describe("Countdown — setConfetti (Sprint 191 CD4)", () => {
  function buildConfettiDOM(): void {
    document.body.innerHTML = `
      <div id="cd-wedding-title"></div>
      <div id="cd-days"></div>
      <div id="cd-hours"></div>
      <div id="cd-mins"></div>
      <div id="cd-secs"></div>
      <div id="cd-msg"></div>
      <div class="countdown-body"></div>
    `;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("adds cd-confetti class when active=true", () => {
    buildConfettiDOM();
    setConfetti(true);
    expect(document.querySelector(".countdown-body")?.classList.contains("cd-confetti")).toBe(true);
  });

  it("removes cd-confetti class when active=false", () => {
    buildConfettiDOM();
    const body = document.querySelector(".countdown-body") as HTMLElement;
    body.classList.add("cd-confetti");
    setConfetti(false);
    expect(body.classList.contains("cd-confetti")).toBe(false);
  });

  it("does nothing when .countdown-body element is absent", () => {
    document.body.innerHTML = "<div id='no-body'></div>";
    expect(() => setConfetti(true)).not.toThrow();
  });

  it("tick() adds cd-confetti when event is today (daysSince === 0)", () => {
    buildConfettiDOM();
    vi.useFakeTimers();
    // Set now to the exact event moment so daysSince === 0
    const eventTime = new Date("2025-07-04T12:00:00");
    vi.setSystemTime(eventTime);
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2025-07-04",
      countdownCardTime: "12:00",
      countdownCardTitle: "Test",
      countdownCardDoneMsg: "🎉",
    } as DashboardConfig);
    tick();
    expect(document.querySelector(".countdown-body")?.classList.contains("cd-confetti")).toBe(true);
  });

  it("tick() does NOT add cd-confetti when event passed days ago (daysSince > 0)", () => {
    buildConfettiDOM();
    vi.useFakeTimers();
    // Set now to 5 days after the event
    vi.setSystemTime(new Date("2025-07-09T12:00:00"));
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2025-07-04",
      countdownCardTime: "12:00",
      countdownCardTitle: "Test",
      countdownCardDoneMsg: "🎉",
    } as DashboardConfig);
    tick();
    expect(document.querySelector(".countdown-body")?.classList.contains("cd-confetti")).toBe(false);
  });

  it("tick() does NOT add cd-confetti when event is in the future", () => {
    buildConfettiDOM();
    vi.mocked(loadConfig).mockReturnValue(FUTURE_CFG);
    tick();
    expect(document.querySelector(".countdown-body")?.classList.contains("cd-confetti")).toBe(false);
  });
});

// ── Sprint 235: tickSecondary progress bar branches & initCountdownCard auto-populate ─
describe("Countdown — Sprint 235 coverage: tickSecondary + initCountdownCard", () => {
  function buildCd2DOM() {
    const section = document.createElement("div");
    section.id = "cd2-section";
    const title = document.createElement("div");
    title.id = "cd2-title";
    const days = document.createElement("div");
    days.id = "cd2-days";
    const hours = document.createElement("div");
    hours.id = "cd2-hours";
    const mins = document.createElement("div");
    mins.id = "cd2-mins";
    const secs = document.createElement("div");
    secs.id = "cd2-secs";
    const msg = document.createElement("div");
    msg.id = "cd2-msg";
    const progressWrap = document.createElement("div");
    progressWrap.id = "cd2-progress-wrap";
    const progressBar = document.createElement("div");
    progressBar.id = "cd2-progress-bar";
    section.append(title, days, hours, mins, secs, msg, progressWrap, progressBar);
    document.body.appendChild(section);
    return section;
  }

  function buildCd3DOM() {
    const section = document.createElement("div");
    section.id = "cd3-section";
    const title = document.createElement("div");
    title.id = "cd3-title";
    const days = document.createElement("div");
    days.id = "cd3-days";
    const hours = document.createElement("div");
    hours.id = "cd3-hours";
    const mins = document.createElement("div");
    mins.id = "cd3-mins";
    const secs = document.createElement("div");
    secs.id = "cd3-secs";
    const msg = document.createElement("div");
    msg.id = "cd3-msg";
    section.append(title, days, hours, mins, secs, msg);
    document.body.appendChild(section);
    return section;
  }

  function buildMainDOM() {
    const days = document.createElement("div");
    days.id = "cd-days";
    document.body.appendChild(days);
    return days;
  }

  beforeEach(() => {
    cClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cClear();
    document.body.innerHTML = "";
  });

  it("tick2() renders progress bar when startDate is set and section DOM present", () => {
    const section = buildCd2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2099-12-31",
      countdownCardTime: "23:59",
      countdownCardTitle: "T",
      countdownCardDoneMsg: "D",
      countdownCard2Date: "2099-06-01",
      countdownCard2Time: "18:00",
      countdownCard2Title: "אירוע 2",
      countdownCard2DoneMsg: "🎉",
      countdownCard2StartDate: "2020-01-01",
    } as DashboardConfig);
    tick2();
    const pw = document.getElementById("cd2-progress-wrap");
    expect(section.style.display).not.toBe("none");
    // Progress wrap should be displayed
    expect(pw?.style.display).not.toBe("none");
  });

  it("tick2() hides section when no date configured", () => {
    const section = buildCd2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCard2Date: undefined,
    } as DashboardConfig);
    tick2();
    expect(section.style.display).toBe("none");
  });

  it("tick2() renders past-event path (daysSince >= 0)", () => {
    const section = buildCd2DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2099-12-31",
      countdownCardTime: "23:59",
      countdownCardTitle: "T",
      countdownCardDoneMsg: "D",
      countdownCard2Date: "2000-01-01",
      countdownCard2Time: "00:00",
      countdownCard2Title: "עבר",
      countdownCard2DoneMsg: "נגמר",
    } as DashboardConfig);
    tick2();
    const days = document.getElementById("cd2-days");
    expect(section.style.display).not.toBe("none");
    expect(days?.textContent).toMatch(/^\d+$/);
  });

  it("tick3() renders future event", () => {
    buildMainDOM();
    const section = buildCd3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      countdownCardDate: "2099-12-31",
      countdownCardTime: "23:59",
      countdownCardTitle: "T",
      countdownCardDoneMsg: "D",
      countdownCard3Date: "2099-07-01",
      countdownCard3Time: "18:00",
      countdownCard3Title: "אירוע 3",
      countdownCard3DoneMsg: "🎉",
    } as DashboardConfig);
    tick3();
    expect(section.style.display).not.toBe("none");
  });

  it("initCountdownCard auto-populates slot 2 from Yom Tov when countdownCard2Date unset", () => {
    buildMainDOM();
    buildCd2DOM();
    buildCd3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCard2Date: undefined,
      countdownCard3Date: undefined,
    } as DashboardConfig);
    // Seed holiday cache (CD1 key pattern: holidays-YYYY-M)
    const now = new Date();
    const holKey = `holidays-${now.getFullYear()}-${now.getMonth()}`;
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}-${String(futureDate.getDate()).padStart(2, "0")}`;
    cSet(holKey, {
      items: [
        { title: "Rosh Hashana", hebrew: "ראש השנה", date: dateStr, category: "holiday" },
      ],
    });
    initCountdownCard();
    const title2 = document.getElementById("cd2-title");
    expect(title2?.textContent).toBe("ראש השנה");
  });

  it("initCountdownCard auto-populates slot 3 from ICS cache when countdownCard3Date unset", () => {
    buildMainDOM();
    buildCd2DOM();
    buildCd3DOM();
    vi.mocked(loadConfig).mockReturnValue({
      ...FUTURE_CFG,
      countdownCard2Date: "2099-01-01", // already set so CD1 is skipped
      countdownCard3Date: undefined,
    } as DashboardConfig);
    // Seed ICS cache (key: cal-ics) with a future event (>= 7 days)
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const y = futureDate.getFullYear();
    const mo = String(futureDate.getMonth() + 1).padStart(2, "0");
    const d = String(futureDate.getDate()).padStart(2, "0");
    const icsText = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      `DTSTART:${y}${mo}${d}T180000Z`,
      "SUMMARY:טיול משפחתי",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    cSet("cal-ics", icsText);
    initCountdownCard();
    const title3 = document.getElementById("cd3-title");
    expect(title3?.textContent).toBe("טיול משפחתי");
  });
});
