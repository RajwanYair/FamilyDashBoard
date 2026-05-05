/**
 * fast-check property tests — src/core/event-bus.ts (Sprint 461)
 *
 * Properties under test:
 *  EB1. broadcastSync idempotence — broadcasting the same state for a card
 *       twice produces the same globalSync value.
 *  EB2. globalSync is "loading" whenever at least one card state is "loading"
 *       (loading dominates over error and ok).
 *  EB3. globalSync is "error" when all registered cards are in "error" (and
 *       none in "loading").
 *  EB4. globalSync is "ok" when all registered cards are in "ok".
 *  EB5. broadcastAlert stores any AlertEvent payload verbatim in globalAlertChannel.
 *  EB6. broadcastTheme stores any ThemeName verbatim in globalThemeChannel.
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { effect } from "@/core/signals";
import {
  broadcastSync,
  broadcastAlert,
  broadcastTheme,
  globalSync,
  globalAlertChannel,
  globalThemeChannel,
  _resetBusForTesting,
  type AlertEvent,
} from "@/core/event-bus";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const syncStateArb = fc.constantFrom<"ok" | "loading" | "error">("ok", "loading", "error");

const cardIdArb = fc
  .string({ minLength: 1, maxLength: 12 })
  .filter((s) => s.trim().length > 0 && !/[\x00-\x1f]/.test(s));

const themeArb = fc.constantFrom<
  "black" | "blue" | "matrix" | "amber" | "purple" | "rose"
>("black", "blue", "matrix", "amber", "purple", "rose");

const alertTypeArb = fc.constantFrom<"pause" | "resume">("pause", "resume");

const alertEventArb: fc.Arbitrary<AlertEvent> = fc.record({
  source: cardIdArb,
  type: alertTypeArb,
});

// ── EB1: broadcastSync is idempotent ─────────────────────────────────────────

describe("event-bus — EB1: broadcastSync is idempotent", () => {
  beforeEach(() => _resetBusForTesting());

  it("broadcasting the same state twice leaves globalSync unchanged", () => {
    fc.assert(
      fc.property(cardIdArb, syncStateArb, (id, state) => {
        _resetBusForTesting();
        broadcastSync(id, state);
        const firstValue = globalSync.value;
        broadcastSync(id, state); // second identical broadcast
        expect(globalSync.value).toBe(firstValue);
      }),
      { numRuns: 80 },
    );
  });
});

// ── EB2: loading dominates ────────────────────────────────────────────────────

describe("event-bus — EB2: globalSync is 'loading' when any card is loading", () => {
  beforeEach(() => _resetBusForTesting());

  it("globalSync === 'loading' when at least one card broadcasts 'loading'", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(cardIdArb, syncStateArb), { minLength: 1, maxLength: 6 }).chain(
          (pairs) => {
            // inject exactly one "loading" entry
            const loadingIdx = fc.integer({ min: 0, max: pairs.length - 1 });
            return loadingIdx.map((i) => {
              const updated = pairs.map(([id, s], idx) =>
                idx === i ? ([id, "loading"] as [string, "ok" | "loading" | "error"]) : [id, s] as [string, "ok" | "loading" | "error"],
              );
              // Make sure there's one guaranteed unique loading card
              return [...updated, ["__loading__", "loading"] as [string, "ok" | "loading" | "error"]];
            });
          },
        ),
        (entries) => {
          _resetBusForTesting();
          for (const [id, state] of entries) {
            broadcastSync(id, state);
          }
          expect(globalSync.value).toBe("loading");
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── EB3: error when all cards errored ────────────────────────────────────────

describe("event-bus — EB3: globalSync is 'error' when all cards are 'error'", () => {
  beforeEach(() => _resetBusForTesting());

  it("globalSync === 'error' when all registered card states are 'error'", () => {
    fc.assert(
      fc.property(
        fc.array(cardIdArb, { minLength: 1, maxLength: 6 }).filter(
          // ensure unique card IDs so the map has exactly N entries
          (ids) => new Set(ids).size === ids.length,
        ),
        (ids) => {
          _resetBusForTesting();
          for (const id of ids) {
            broadcastSync(id, "error");
          }
          expect(globalSync.value).toBe("error");
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── EB4: ok when all cards ok ─────────────────────────────────────────────────

describe("event-bus — EB4: globalSync is 'ok' when all cards are 'ok'", () => {
  beforeEach(() => _resetBusForTesting());

  it("globalSync === 'ok' when all registered card states are 'ok'", () => {
    fc.assert(
      fc.property(
        fc.array(cardIdArb, { minLength: 1, maxLength: 6 }).filter(
          (ids) => new Set(ids).size === ids.length,
        ),
        (ids) => {
          _resetBusForTesting();
          for (const id of ids) {
            broadcastSync(id, "ok");
          }
          expect(globalSync.value).toBe("ok");
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── EB5: broadcastAlert stores payload verbatim ───────────────────────────────

describe("event-bus — EB5: broadcastAlert preserves payload in globalAlertChannel", () => {
  beforeEach(() => _resetBusForTesting());

  it("globalAlertChannel.value equals the AlertEvent passed to broadcastAlert", () => {
    fc.assert(
      fc.property(alertEventArb, (event) => {
        broadcastAlert(event);
        expect(globalAlertChannel.value).toEqual(event);
      }),
      { numRuns: 80 },
    );
  });

  it("broadcastAlert(null) resets globalAlertChannel to null", () => {
    fc.assert(
      fc.property(alertEventArb, (event) => {
        broadcastAlert(event);
        broadcastAlert(null);
        expect(globalAlertChannel.value).toBeNull();
      }),
      { numRuns: 60 },
    );
  });
});

// ── EB6: broadcastTheme stores theme verbatim ─────────────────────────────────

describe("event-bus — EB6: broadcastTheme preserves theme in globalThemeChannel", () => {
  beforeEach(() => _resetBusForTesting());

  it("globalThemeChannel.value equals the theme passed to broadcastTheme", () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        broadcastTheme(theme);
        expect(globalThemeChannel.value).toBe(theme);
      }),
      { numRuns: 60 },
    );
  });
});
