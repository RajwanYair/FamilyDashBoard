/**
 * Tests for src/cards/countdown/countdown.ts
 *
 * Covers: getTimeComponents, tick (ongoing/past/days variations),
 * initCountdownCard, destroyCountdownCard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTimeComponents,
  tick,
  initCountdownCard,
  destroyCountdownCard,
  COUNTDOWN_TARGET,
  COUNTDOWN_TITLE,
} from "@/cards/countdown/countdown";

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
    const now = Date.now();
    const targetMs = now + 1 * 86400 * 1000 + 2 * 3600 * 1000 + 3 * 60 * 1000 + 4 * 1000;
    const result = getTimeComponents(targetMs);
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
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("populates all tile elements with numeric values", () => {
    // Mock Date.now to be far in the past relative to target (2 days away)
    const futureTarget = Date.now() + 2 * 86400 * 1000 + 3600 * 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(futureTarget);
    tick();
    expect(document.getElementById("cd-days")?.textContent).toMatch(/\d+/);
    expect(document.getElementById("cd-hours")?.textContent).toMatch(/\d{2}/);
    expect(document.getElementById("cd-mins")?.textContent).toMatch(/\d{2}/);
    expect(document.getElementById("cd-secs")?.textContent).toMatch(/\d{2}/);
  });

  it("sets title to COUNTDOWN_TITLE when event is in the future", () => {
    const futureTarget = Date.now() + 10 * 86400 * 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(futureTarget);
    tick();
    expect(document.getElementById("cd-wedding-title")?.textContent).toBe(
      COUNTDOWN_TITLE
    );
  });

  it("pads hours/mins/secs to 2 digits", () => {
    // 1 day + 1 hour + 1 min + 1 sec = just enough to be past day=1
    const futureTarget =
      Date.now() + 1 * 86400 * 1000 + 1 * 3600 * 1000 + 1 * 60 * 1000 + 1 * 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(futureTarget);
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
  beforeEach(() => buildDOM());
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows mazel tov message when target is in the past", () => {
    const pastTarget = Date.now() - 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(pastTarget);
    tick();
    expect(document.getElementById("cd-wedding-title")?.textContent).toContain("מזל");
    expect(document.getElementById("cd-msg")?.textContent).toContain("מזל טוב");
  });

  it("resets all digits to 0 when target has passed", () => {
    const pastTarget = Date.now() - 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(pastTarget);
    tick();
    expect(document.getElementById("cd-days")?.textContent).toBe("0");
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
  });

  it("shows today message when less than 1 day remains", () => {
    const soonTarget = Date.now() + 30 * 60 * 1000; // 30 minutes
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(soonTarget);
    tick();
    expect(document.getElementById("cd-msg")?.textContent).toContain("היום");
  });

  it("shows 1 day message when exactly 1 day remains", () => {
    const oneDayTarget = Date.now() + 1 * 86400 * 1000 + 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(oneDayTarget);
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
  beforeEach(() => buildDOM());
  afterEach(() => {
    destroyCountdownCard();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("populates the DOM on init", () => {
    const futureTarget = Date.now() + 10 * 86400 * 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(futureTarget);
    initCountdownCard();
    expect(document.getElementById("cd-days")?.textContent).toMatch(/\d+/);
    destroyCountdownCard();
  });

  it("destroy clears the interval without throwing", () => {
    const futureTarget = Date.now() + 10 * 86400 * 1000;
    vi.spyOn(COUNTDOWN_TARGET, "getTime").mockReturnValue(futureTarget);
    initCountdownCard();
    expect(() => destroyCountdownCard()).not.toThrow();
  });

  it("double-destroy does not throw", () => {
    destroyCountdownCard();
    expect(() => destroyCountdownCard()).not.toThrow();
  });
});

// ── constants ──────────────────────────────────────────────────────────────

describe("countdown constants", () => {
  it("COUNTDOWN_TARGET is a valid future date", () => {
    // May 7 2026 should be after test run date
    expect(COUNTDOWN_TARGET instanceof Date).toBe(true);
    expect(COUNTDOWN_TARGET.getFullYear()).toBe(2026);
    expect(COUNTDOWN_TARGET.getMonth()).toBe(4); // 0-based May
    expect(COUNTDOWN_TARGET.getDate()).toBe(7);
    expect(COUNTDOWN_TARGET.getHours()).toBe(18);
  });

  it("COUNTDOWN_TITLE contains expected Hebrew text", () => {
    expect(COUNTDOWN_TITLE).toContain("חתונת");
    expect(COUNTDOWN_TITLE).toContain("אליאור");
    expect(COUNTDOWN_TITLE).toContain("טובה");
  });
});
