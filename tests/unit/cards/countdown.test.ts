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
  initCountdownCard,
  destroyCountdownCard,
  getCountdownTargetDate,
  getCountdownTitle,
  getCountdownDoneMsg,
  getDaysSince,
  computeProgress,
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
    expect(document.getElementById("cd-wedding-title")?.textContent).toContain(
      "מזל",
    );
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
