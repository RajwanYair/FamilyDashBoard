/**
 * fast-check property tests — src/ui/today-pane.ts buildTodayItems 
 *
 * Properties under test:
 *  TP1. Empty inputs → empty result
 *  TP2. Active alert → critical urgency item in result
 *  TP3. Calendar event ≤6h → included
 *  TP4. Calendar event >6h → excluded
 *  TP5. Countdown ≤24h → included
 *  TP6. Stock mover ≥3% → included
 *  TP7. Stock mover <3% → excluded
 *  TP8. Result is sorted: critical → warning → normal
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildTodayItems, type TodayPaneInputs } from "@/ui/today-pane";

const NOW = Date.now();

const emptyInputs: TodayPaneInputs = {
  nowMs: NOW,
  alerts: [],
  countdownTargetMs: null,
  countdownTitle: "",
  chores: [],
  stockMovers: [],
  nextCalEvent: null,
};

// ── TP1: empty inputs → empty ────────────────────────────────────────────────

describe("today-pane — TP1: empty inputs", () => {
  it("returns empty array", () => {
    expect(buildTodayItems(emptyInputs)).toEqual([]);
  });
});

// ── TP2: active alert → critical ─────────────────────────────────────────────

describe("today-pane — TP2: active alert", () => {
  it("recent alert produces critical item", () => {
    const items = buildTodayItems({
      ...emptyInputs,
      alerts: [{
        id: 1,
        alerts: [{ cities: ["תל אביב"], threat: 3, time: Math.floor(NOW / 1000) - 60 }],
      }] as never,
    });
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]!.urgency).toBe("critical");
    expect(items[0]!.type).toBe("alert");
  });
});

// ── TP3: calendar ≤6h → included ─────────────────────────────────────────────

describe("today-pane — TP3: calendar event ≤6h", () => {
  it("event within 6 hours appears", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 360 }), // 0-6 hours in minutes
        (mins) => {
          const items = buildTodayItems({
            ...emptyInputs,
            nextCalEvent: { label: "פגישה", minutesUntil: mins },
          });
          const calItem = items.find((i) => i.type === "cal");
          expect(calItem).toBeDefined();
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── TP4: calendar >6h → excluded ─────────────────────────────────────────────

describe("today-pane — TP4: calendar event >6h", () => {
  it("event beyond 6 hours excluded", () => {
    const items = buildTodayItems({
      ...emptyInputs,
      nextCalEvent: { label: "פגישה", minutesUntil: 361 },
    });
    expect(items.find((i) => i.type === "cal")).toBeUndefined();
  });
});

// ── TP5: countdown ≤24h → included ──────────────────────────────────────────

describe("today-pane — TP5: countdown ≤24h", () => {
  it("countdown within 24h appears", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 24 * 60 * 60 * 1000 - 1 }),
        (diffMs) => {
          const items = buildTodayItems({
            ...emptyInputs,
            countdownTargetMs: NOW + diffMs,
            countdownTitle: "יום הולדת",
          });
          expect(items.find((i) => i.type === "countdown")).toBeDefined();
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── TP6: stock mover ≥3% → included ─────────────────────────────────────────

describe("today-pane — TP6: big stock mover", () => {
  it("stock with ≥3% change appears", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 3.0, max: 50, noNaN: true }),
        (pct) => {
          const items = buildTodayItems({
            ...emptyInputs,
            stockMovers: [`AAPL +${pct.toFixed(1)}%`],
          });
          expect(items.find((i) => i.type === "stocks")).toBeDefined();
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── TP7: stock mover <3% → excluded ─────────────────────────────────────────

describe("today-pane — TP7: small stock mover", () => {
  it("stock with <3% change excluded", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2.9, noNaN: true }),
        (pct) => {
          // Use toFixed(2) to avoid rounding 2.95→"3.0"
          const items = buildTodayItems({
            ...emptyInputs,
            stockMovers: [`AAPL +${pct.toFixed(2)}%`],
          });
          expect(items.find((i) => i.type === "stocks")).toBeUndefined();
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── TP8: sorted by urgency ───────────────────────────────────────────────────

describe("today-pane — TP8: urgency sort", () => {
  it("critical comes before warning, warning before normal", () => {
    const items = buildTodayItems({
      ...emptyInputs,
      alerts: [{
        id: 1,
        alerts: [{ cities: ["A"], threat: 1, time: Math.floor(NOW / 1000) - 30 }],
      }] as never,
      nextCalEvent: { label: "אירוע", minutesUntil: 15 }, // warning (≤30min)
      stockMovers: ["TSLA +5.2%"], // normal
    });
    const urgencies = items.map((i) => i.urgency);
    const order = { critical: 0, warning: 1, normal: 2 };
    for (let i = 1; i < urgencies.length; i++) {
      expect(order[urgencies[i]!]).toBeGreaterThanOrEqual(order[urgencies[i - 1]!]);
    }
  });
});
