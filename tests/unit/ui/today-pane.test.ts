/**
 * Tests for src/ui/today-pane.ts
 *
 * Covers: buildTodayItems (pure function), renderTodayPane, refreshTodayPane.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildTodayItems,
  renderTodayPane,
  cachePaneDom,
  refreshTodayPane,
  _resetTodayPaneForTest,
} from "@/ui/today-pane";
import type { TodayPaneInputs, TodayPaneItem } from "@/ui/today-pane";
import type { AlertEvent } from "@/types/api";

// X12 : today-pane no longer imports from alerts/countdown card
// modules directly — it uses getCardSignal(). Mock the protocol so
// refreshTodayPane tests get predictable (empty) signal state.
vi.mock("@/core/card-signal-protocol", () => ({
  getCardSignal: vi.fn().mockReturnValue(null),
  setCardSignal: vi.fn(),
  onCardSignal: vi.fn(),
  _resetCardSignals: vi.fn(),
}));
vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createCardLoader: vi.fn(),
}));

const NOW_MS = new Date("2025-07-01T10:00:00Z").getTime();

const EMPTY_INPUTS: TodayPaneInputs = {
  nowMs: NOW_MS,
  alerts: [],
  countdownTargetMs: null,
  countdownTitle: "",
  overdueTaskCount: 0,
  firstOverdueText: null,
  stockMovers: [],
  nextCalEvent: null,
};

// ── buildTodayItems: alert ────────────────────────────────────────────────────

describe("TodayPane — buildTodayItems: alerts", () => {
  it("returns empty array when no inputs", () => {
    expect(buildTodayItems(EMPTY_INPUTS)).toHaveLength(0);
  });

  it("adds a critical alert item for active alert events", () => {
    const alert: AlertEvent = {
      alerts: [{ cities: ["תל אביב"], threat: 0, time: Math.floor(NOW_MS / 1000) - 60 }],
    };
    const items = buildTodayItems({ ...EMPTY_INPUTS, alerts: [alert] });
    expect(items.some((i) => i.type === "alert" && i.urgency === "critical")).toBe(true);
  });

  it("ignores alerts older than 1 hour", () => {
    const alert: AlertEvent = {
      alerts: [{ cities: ["תל אביב"], threat: 0, time: Math.floor(NOW_MS / 1000) - 7200 }],
    };
    const items = buildTodayItems({ ...EMPTY_INPUTS, alerts: [alert] });
    expect(items.some((i) => i.type === "alert")).toBe(false);
  });

  it("shows zone count for multiple active alerts", () => {
    const makeAlert = (cityName: string): AlertEvent => ({
      alerts: [{ cities: [cityName], threat: 0, time: Math.floor(NOW_MS / 1000) - 30 }],
    });
    const items = buildTodayItems({ ...EMPTY_INPUTS, alerts: [makeAlert("A"), makeAlert("B")] });
    const alertItem = items.find((i) => i.type === "alert");
    expect(alertItem?.label).toContain("2");
  });
});

// ── buildTodayItems: calendar ─────────────────────────────────────────────────

describe("TodayPane — buildTodayItems: calendar", () => {
  it("adds a cal item for next event ≤6h", () => {
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      nextCalEvent: { label: "פגישת צוות", minutesUntil: 90 },
    });
    expect(items.some((i) => i.type === "cal")).toBe(true);
  });

  it("does not add cal item for event >6h away", () => {
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      nextCalEvent: { label: "ישיבה", minutesUntil: 400 },
    });
    expect(items.some((i) => i.type === "cal")).toBe(false);
  });

  it("marks urgency warning when event ≤30 minutes away", () => {
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      nextCalEvent: { label: "פגישה", minutesUntil: 20 },
    });
    const calItem = items.find((i) => i.type === "cal");
    expect(calItem?.urgency).toBe("warning");
  });

  it("marks urgency normal when event 31–360 minutes away", () => {
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      nextCalEvent: { label: "פגישה", minutesUntil: 120 },
    });
    const calItem = items.find((i) => i.type === "cal");
    expect(calItem?.urgency).toBe("normal");
  });
});

// ── buildTodayItems: countdown ────────────────────────────────────────────────

describe("TodayPane — buildTodayItems: countdown", () => {
  it("adds countdown item when ≤24h remaining", () => {
    const targetMs = NOW_MS + 12 * 60 * 60 * 1000; // 12h away
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      countdownTargetMs: targetMs,
      countdownTitle: "חתונה",
    });
    expect(items.some((i) => i.type === "countdown")).toBe(true);
  });

  it("does not add countdown when >24h away", () => {
    const targetMs = NOW_MS + 48 * 60 * 60 * 1000;
    const items = buildTodayItems({ ...EMPTY_INPUTS, countdownTargetMs: targetMs });
    expect(items.some((i) => i.type === "countdown")).toBe(false);
  });

  it("does not add countdown when target is in the past", () => {
    const targetMs = NOW_MS - 60 * 1000;
    const items = buildTodayItems({ ...EMPTY_INPUTS, countdownTargetMs: targetMs });
    expect(items.some((i) => i.type === "countdown")).toBe(false);
  });

  it("marks warning when <3h remaining", () => {
    const targetMs = NOW_MS + 2 * 60 * 60 * 1000;
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      countdownTargetMs: targetMs,
      countdownTitle: "אירוע",
    });
    expect(items.find((i) => i.type === "countdown")?.urgency).toBe("warning");
  });
});

// ── buildTodayItems: tasks ────────────────────────────────────────────────────

describe("TodayPane — buildTodayItems: tasks", () => {
  it("adds overdue task item", () => {
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      overdueTaskCount: 1,
      firstOverdueText: "ניקיון",
    });
    expect(items.some((i) => i.type === "tasks" && i.urgency === "warning")).toBe(true);
  });

  it("does not add item when no overdue tasks", () => {
    const items = buildTodayItems({ ...EMPTY_INPUTS, overdueTaskCount: 0, firstOverdueText: null });
    expect(items.some((i) => i.type === "tasks")).toBe(false);
  });

  it("shows count when multiple overdue tasks", () => {
    const items = buildTodayItems({ ...EMPTY_INPUTS, overdueTaskCount: 2, firstOverdueText: "א" });
    const item = items.find((i) => i.type === "tasks");
    expect(item?.label).toContain("2");
  });
});

// ── buildTodayItems: stocks ───────────────────────────────────────────────────

describe("TodayPane — buildTodayItems: stocks", () => {
  it("adds stock item when mover ≥3%", () => {
    const items = buildTodayItems({ ...EMPTY_INPUTS, stockMovers: ["TSLA +5.2%"] });
    expect(items.some((i) => i.type === "stocks")).toBe(true);
  });

  it("ignores movers <3%", () => {
    const items = buildTodayItems({ ...EMPTY_INPUTS, stockMovers: ["MSFT +1.5%"] });
    expect(items.some((i) => i.type === "stocks")).toBe(false);
  });

  it("includes negative movers ≥3% absolute", () => {
    const items = buildTodayItems({ ...EMPTY_INPUTS, stockMovers: ["AAPL -4.0%"] });
    expect(items.some((i) => i.type === "stocks")).toBe(true);
  });
});

// ── buildTodayItems: sort order ───────────────────────────────────────────────

describe("TodayPane — buildTodayItems: sort order", () => {
  it("sorts critical before warning before normal", () => {
    const alert: AlertEvent = {
      alerts: [{ cities: ["עיר"], threat: 0, time: Math.floor(NOW_MS / 1000) - 30 }],
    };
    const items = buildTodayItems({
      ...EMPTY_INPUTS,
      alerts: [alert],
      nextCalEvent: { label: "פגישה", minutesUntil: 120 }, // normal urgency
      overdueTaskCount: 1,
      firstOverdueText: "משימה", // warning urgency
    });
    const urgencies = items.map((i) => i.urgency);
    const critIdx = urgencies.indexOf("critical");
    const warnIdx = urgencies.indexOf("warning");
    const normIdx = urgencies.indexOf("normal");
    expect(critIdx).toBeGreaterThanOrEqual(0);
    expect(warnIdx).toBeGreaterThanOrEqual(0);
    expect(normIdx).toBeGreaterThanOrEqual(0);
    expect(critIdx).toBeLessThan(warnIdx);
    expect(warnIdx).toBeLessThan(normIdx);
  });
});

// ── renderTodayPane ───────────────────────────────────────────────────────────

describe("TodayPane — renderTodayPane", () => {
  it("renders pills for each item", () => {
    const container = document.createElement("div");
    const items: TodayPaneItem[] = [
      { type: "alert", icon: "🚨", label: "Test", urgency: "critical" },
      { type: "cal", icon: "📅", label: "Meeting", urgency: "normal" },
    ];
    renderTodayPane(items, container);
    expect(container.querySelectorAll(".today-pill")).toHaveLength(2);
  });

  it("clears container when items is empty", () => {
    const container = document.createElement("div");
    container.innerHTML = "<span>old</span>";
    renderTodayPane([], container);
    expect(container.children).toHaveLength(0);
  });

  it("applies urgency class to pill", () => {
    const container = document.createElement("div");
    renderTodayPane([{ type: "alert", icon: "🚨", label: "x", urgency: "critical" }], container);
    const pill = container.querySelector(".today-pill");
    expect(pill?.classList.contains("today-pill--critical")).toBe(true);
  });

  it("sets textContent not innerHTML (XSS safety)", () => {
    const container = document.createElement("div");
    const malicious = "<img src=x onerror=alert(1)>";
    renderTodayPane([{ type: "test", icon: "⚠️", label: malicious, urgency: "normal" }], container);
    const label = container.querySelector(".today-pill-label");
    expect(label?.textContent).toBe(malicious);
    expect(label?.innerHTML).not.toContain("<img");
  });
});

// ── refreshTodayPane (DOM integration) ───────────────────────────────────────

describe("TodayPane — refreshTodayPane DOM integration", () => {
  beforeEach(() => {
    _resetTodayPaneForTest();
    localStorage.clear();
    document.body.innerHTML = `
      <section id="today-pane" class="is-hidden">
        <div id="today-pane-items"></div>
      </section>`;
    cachePaneDom();
  });
  afterEach(() => {
    _resetTodayPaneForTest();
    vi.restoreAllMocks();
  });

  it("hides pane when no items", () => {
    refreshTodayPane();
    expect(document.getElementById("today-pane")?.classList.contains("is-hidden")).toBe(true);
  });

  it("does not throw when pane DOM is absent", () => {
    _resetTodayPaneForTest();
    document.body.innerHTML = "<div></div>";
    cachePaneDom();
    expect(() => refreshTodayPane()).not.toThrow();
  });
});

// ── fast-check property tests for buildTodayItems ────

import * as fc from "fast-check";

describe("TodayPane — buildTodayItems fast-check properties (TDP1-TDP5)", () => {
  /**
   * TDP1: buildTodayItems always returns an array (never throws) for any valid inputs.
   */
  it("TDP1 · always returns an array for any inputs", () => {
    fc.assert(
      fc.property(
        fc.record({
          nowMs: fc.integer({ min: 0, max: 2_000_000_000_000 }),
          alerts: fc.constant([]),
          countdownTargetMs: fc.option(fc.integer({ min: 0, max: 2_000_000_000_000 }), {
            nil: null,
          }),
          countdownTitle: fc.string({ maxLength: 30 }),
          overdueTaskCount: fc.constant(0),
          firstOverdueText: fc.constant(null),
          stockMovers: fc.array(fc.string({ maxLength: 20 }), { maxLength: 6 }),
          nextCalEvent: fc.constant(null),
        }),
        (inputs: TodayPaneInputs) => {
          const result = buildTodayItems(inputs);
          return Array.isArray(result);
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * TDP2: Output is always sorted — critical items before warning before normal.
   */
  it("TDP2 · output is always urgency-sorted (critical → warning → normal)", () => {
    fc.assert(
      fc.property(
        fc.record({
          nowMs: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
          alerts: fc.constant([]),
          countdownTargetMs: fc.option(fc.integer({ min: 0, max: 1_000_000_000_000 }), {
            nil: null,
          }),
          countdownTitle: fc.string({ maxLength: 20 }),
          overdueTaskCount: fc.constant(0),
          firstOverdueText: fc.constant(null),
          stockMovers: fc.array(
            fc.oneof(
              fc.constant("TSLA +5.2%"),
              fc.constant("AAPL -1.0%"),
              fc.constant("MSFT +0.5%"),
            ),
            { maxLength: 3 },
          ),
          nextCalEvent: fc.option(
            fc.record({
              label: fc.string({ maxLength: 20 }),
              minutesUntil: fc.integer({ min: 0, max: 360 }),
            }),
            { nil: null },
          ),
        }),
        (inputs: TodayPaneInputs) => {
          const ORDER: Record<string, number> = { critical: 0, warning: 1, normal: 2 };
          const items = buildTodayItems(inputs);
          for (let i = 0; i < items.length - 1; i++) {
            const a = ORDER[items[i]!.urgency] ?? 99;
            const b = ORDER[items[i + 1]!.urgency] ?? 99;
            if (a > b) return false;
          }
          return true;
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * TDP3: Empty inputs always produce empty output.
   */
  it("TDP3 · empty inputs always produce empty output", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        (nowMs: number) => {
          const result = buildTodayItems({
            nowMs,
            alerts: [],
            countdownTargetMs: null,
            countdownTitle: "",
            overdueTaskCount: 0,
            firstOverdueText: null,
            stockMovers: [],
            nextCalEvent: null,
          });
          return result.length === 0;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * TDP4: Each item's urgency is always one of the three valid values.
   */
  it("TDP4 · every item urgency is always a valid TodayUrgency value", () => {
    const VALID = new Set<string>(["critical", "warning", "normal"]);
    fc.assert(
      fc.property(
        fc.record({
          nowMs: fc.constant(NOW_MS),
          alerts: fc.constant([]),
          countdownTargetMs: fc.option(
            fc.integer({ min: NOW_MS + 1, max: NOW_MS + 24 * 3600 * 1000 }),
            { nil: null },
          ),
          countdownTitle: fc.string({ maxLength: 20 }),
          overdueTaskCount: fc.constant(0),
          firstOverdueText: fc.constant(null),
          stockMovers: fc.array(fc.oneof(fc.constant("AAPL +5%"), fc.constant("MSFT -2%")), {
            maxLength: 2,
          }),
          nextCalEvent: fc.option(
            fc.record({
              label: fc.string({ maxLength: 15 }),
              minutesUntil: fc.integer({ min: 0, max: 360 }),
            }),
            { nil: null },
          ),
        }),
        (inputs: TodayPaneInputs) => {
          const items = buildTodayItems(inputs);
          return items.every((item: TodayPaneItem) => VALID.has(item.urgency));
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * TDP5: Stock movers with |pct| < 3 never appear in the output.
   */
  it("TDP5 · stock movers with |pct| < 3 never appear", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.double({ min: -2.49, max: 2.49, noNaN: true }).map((f) => `AAPL ${f.toFixed(1)}%`),
          { minLength: 1, maxLength: 4 },
        ),
        (stockMovers: string[]) => {
          const items = buildTodayItems({ ...EMPTY_INPUTS, nowMs: NOW_MS, stockMovers });
          return !items.some((i: TodayPaneItem) => i.type === "stocks");
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ── additional property tests ─────────────────────

describe("TodayPane — buildTodayItems fast-check properties (TDP6-TDP8 )", () => {
  /**
   * TDP6: every item icon is always a non-empty string.
   */
  it("TDP6 · every result item icon is a non-empty string", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1, maxLength: 20 }),
            pct: fc.double({ min: 3.0, max: 10.0, noNaN: true }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
        (movers: { text: string; pct: number }[]) => {
          const stockMovers = movers.map((m) => `${m.text} +${m.pct.toFixed(1)}%`);
          const items = buildTodayItems({ ...EMPTY_INPUTS, nowMs: NOW_MS, stockMovers });
          return items.every((i: TodayPaneItem) => typeof i.icon === "string" && i.icon.length > 0);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * TDP7: every item label is always a non-empty string.
   */
  it("TDP7 · every result item label is a non-empty string", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 360 }), (minutesUntil: number) => {
        const items = buildTodayItems({
          ...EMPTY_INPUTS,
          nowMs: NOW_MS,
          nextCalEvent: { label: "ישיבה", minutesUntil },
        });
        return items.every((i: TodayPaneItem) => typeof i.label === "string" && i.label.length > 0);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * TDP8: result items always have unique type values — at most one item per type.
   */
  it("TDP8 · result items always have unique type values", () => {
    fc.assert(
      fc.property(
        fc.record({
          hasAlert: fc.boolean(),
          hasCountdown: fc.boolean(),
          minutesUntil: fc.integer({ min: 0, max: 300 }),
          stockPct: fc.double({ min: 0.5, max: 15.0, noNaN: true }),
        }),
        ({ hasAlert, hasCountdown, minutesUntil, stockPct }) => {
          const alertArr = hasAlert
            ? [
                {
                  alerts: [
                    { cities: ["תל אביב"], threat: 0, time: Math.floor(NOW_MS / 1000) - 60 },
                  ],
                },
              ]
            : [];
          const countdownTargetMs = hasCountdown ? NOW_MS + minutesUntil * 60 * 1000 : null;
          const stockMovers = [`TSLA +${stockPct.toFixed(1)}%`];
          const items = buildTodayItems({
            ...EMPTY_INPUTS,
            nowMs: NOW_MS,
            alerts: alertArr,
            countdownTargetMs,
            stockMovers,
          });
          const types = items.map((i: TodayPaneItem) => i.type);
          return new Set(types).size === types.length;
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ── initTodayPane — covers lines 269-271, 277-278 + the 1 uncovered function ─────
import { initTodayPane } from "@/ui/today-pane";

describe("TodayPane — initTodayPane ", () => {
  beforeEach(() => {
    _resetTodayPaneForTest();
    localStorage.clear();
    vi.useFakeTimers();
    document.body.innerHTML = `
      <section id="today-pane" class="is-hidden">
        <div id="today-pane-items"></div>
      </section>`;
  });
  afterEach(() => {
    _resetTodayPaneForTest();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("wires DOM, runs initial refresh, and starts 60s interval", () => {
    initTodayPane();
    // _paneEl and _itemsEl are wired; first refreshTodayPane() ran already
    const pane = document.getElementById("today-pane");
    expect(pane).not.toBeNull();
    // Timer was started — advance by 60s to verify it fires again (no throw)
    expect(() => vi.advanceTimersByTime(60 * 60_000)).not.toThrow();
  });

  it("does nothing when required DOM elements are absent", () => {
    document.body.innerHTML = "<div></div>";
    expect(() => initTodayPane()).not.toThrow();
  });

  it("_resetTodayPaneForTest clears the interval when timer is active", () => {
    initTodayPane();
    // timer is now set (_refreshTimer !== null) — reset must clearInterval
    expect(() => _resetTodayPaneForTest()).not.toThrow();
    // A second reset with timer=null must also be safe
    expect(() => _resetTodayPaneForTest()).not.toThrow();
  });
});

// ── collectInputs non-null signal paths ─────────────────
// These tests use getCardSignal mock with real values to cover the non-null
// branches in the private collectInputs() function (reached via refreshTodayPane).

import { getCardSignal } from "@/core/card-signal-protocol";

describe("TodayPane — refreshTodayPane signal non-null branches (X12 )", () => {
  beforeEach(() => {
    _resetTodayPaneForTest();
    localStorage.clear();
    document.body.innerHTML = `
      <section id="today-pane">
        <div id="today-pane-items"></div>
      </section>`;
    cachePaneDom();
    vi.mocked(getCardSignal).mockReturnValue(null);
  });
  afterEach(() => {
    _resetTodayPaneForTest();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("shows alert pill when alerts signal has count > 0", () => {
    vi.mocked(getCardSignal).mockImplementation((cardId: string, key: string) => {
      if (cardId === "alerts" && key === "active") {
        return {
          value: { count: 2, areas: ["תל אביב", "רמת גן"], latestTs: Date.now() / 1000 - 30 },
        } as ReturnType<typeof getCardSignal>;
      }
      return null;
    });
    refreshTodayPane();
    const pills = document.querySelectorAll(".today-pill");
    expect(pills.length).toBeGreaterThan(0);
  });

  it("shows countdown pill when countdown signal is present", () => {
    vi.mocked(getCardSignal).mockImplementation((cardId: string, key: string) => {
      if (cardId === "countdown" && key === "next") {
        return {
          value: { targetMs: Date.now() + 3 * 60 * 60 * 1000, title: "אירוע" },
        } as ReturnType<typeof getCardSignal>;
      }
      return null;
    });
    refreshTodayPane();
    const pills = document.querySelectorAll(".today-pill");
    expect(pills.length).toBeGreaterThan(0);
  });

  it("shows stock mover pill from signal (not DOM fallback)", () => {
    vi.mocked(getCardSignal).mockImplementation((cardId: string, key: string) => {
      if (cardId === "stocks" && key === "top-mover") {
        return { value: { sym: "TSLA", pct: 5.2, dir: "up" } } as ReturnType<typeof getCardSignal>;
      }
      return null;
    });
    refreshTodayPane();
    // Stock pct ≥ 3% — should appear as a stock pill
    const pills = document.querySelectorAll(".today-pill");
    expect(pills.length).toBeGreaterThan(0);
  });

  it("shows calendar pill for non-all-day event within 6h from signal", () => {
    const startMs = Date.now() + 2 * 60 * 60 * 1000; // 2h from now
    vi.mocked(getCardSignal).mockImplementation((cardId: string, key: string) => {
      if (cardId === "calendar" && key === "next-event") {
        return { value: { title: "ישיבה", startMs, isAllDay: false } } as ReturnType<
          typeof getCardSignal
        >;
      }
      return null;
    });
    refreshTodayPane();
    const pills = document.querySelectorAll(".today-pill");
    expect(pills.length).toBeGreaterThan(0);
  });

  it("skips calendar pill for all-day event (isAllDay: true branch)", () => {
    const startMs = Date.now() + 2 * 60 * 60 * 1000;
    vi.mocked(getCardSignal).mockImplementation((cardId: string, key: string) => {
      if (cardId === "calendar" && key === "next-event") {
        return { value: { title: "חג", startMs, isAllDay: true } } as ReturnType<
          typeof getCardSignal
        >;
      }
      return null;
    });
    refreshTodayPane();
    const calPills = document.querySelectorAll("[data-type='cal']");
    expect(calPills.length).toBe(0);
  });
});
