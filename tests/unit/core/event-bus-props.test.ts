/**
 * Sprint 300 — Property-based tests for src/core/event-bus.ts (EB1–EB6)
 *
 * Uses fast-check to verify structural invariants for the cross-card signal bus.
 */

import fc from "fast-check";
import { beforeEach, describe, it, expect } from "vitest";
import {
  globalSync,
  globalAlertChannel,
  globalThemeChannel,
  broadcastSync,
  broadcastAlert,
  broadcastTheme,
  _resetBusForTesting,
} from "@/core/event-bus";
import type { ThemeName } from "@/core/constants";

const SYNC_STATES = ["ok", "loading", "error"] as const;
type SyncState = (typeof SYNC_STATES)[number];

const syncStateArb = fc.constantFrom<SyncState>(...SYNC_STATES);

const cardIdArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => /^[a-zA-Z0-9_-]+$/.test(s));

const THEME_NAMES = ["black", "blue", "matrix", "amber", "purple", "rose"] as const;
const themeArb = fc.constantFrom<ThemeName>(...THEME_NAMES);

beforeEach(() => {
  _resetBusForTesting();
});

// ── EB1: globalSync aggregation — loading wins over error ─────────────────────

describe("EB1: globalSync — loading wins over error when both present", () => {
  it("globalSync is 'loading' when any card is loading, regardless of others", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(cardIdArb, syncStateArb), { minLength: 1, maxLength: 8 }),
        (pairs) => {
          // Deduplicate by cardId (last write wins per broadcastSync semantics).
          const deduped = new Map(pairs);
          _resetBusForTesting();
          for (const [id, state] of deduped) broadcastSync(id, state);
          const allStates = [...deduped.values()];
          const hasLoading = allStates.some((s) => s === "loading");
          if (hasLoading) {
            return globalSync.value === "loading";
          }
          return true; // only checking the loading case here
        };,
      ),
      { numRuns: 100 },
    );
  });
});

// ── EB2: globalSync aggregation — error shows when no loading ─────────────────

describe("EB2: globalSync — error when any error and no loading", () => {
  it("globalSync is 'error' when at least one error and no loading card", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(cardIdArb, fc.constantFrom<SyncState>("ok", "error")),
          { minLength: 1, maxLength: 8 },
        ),
        (pairs) => {
          // Deduplicate by cardId (last write wins per broadcastSync semantics)
          const deduped = new Map(pairs);
          _resetBusForTesting();
          for (const [id, state] of deduped) broadcastSync(id, state);
          const allStates = [...deduped.values()];
          const hasError = allStates.some((s) => s === "error");
          const expected = hasError ? "error" : "ok";
          return globalSync.value === expected;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── EB3: globalSync — ok when all cards ok ─────────────────────────────────────

describe("EB3: globalSync is ok when all cards report ok", () => {
  it("globalSync.value === 'ok' when every card state is 'ok'", () => {
    fc.assert(
      fc.property(
        fc.array(cardIdArb, { minLength: 1, maxLength: 10 }),
        (ids) => {
          _resetBusForTesting();
          // Deduplicate ids
          const unique = [...new Set(ids)];
          for (const id of unique) broadcastSync(id, "ok");
          return globalSync.value === "ok";
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── EB4: broadcastAlert sets and clears the channel ──────────────────────────

describe("EB4: broadcastAlert sets and clears globalAlertChannel", () => {
  it("alert channel reflects the last broadcasted event", () => {
    fc.assert(
      fc.property(
        cardIdArb,
        fc.constantFrom<"pause" | "resume">("pause", "resume"),
        (source, type) => {
          _resetBusForTesting();
          broadcastAlert({ source, type });
          const ch = globalAlertChannel.value;
          return ch?.source === source && ch?.type === type;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("passing null clears the alert channel", () => {
    fc.assert(
      fc.property(cardIdArb, (source) => {
        _resetBusForTesting();
        broadcastAlert({ source, type: "pause" });
        broadcastAlert(null);
        return globalAlertChannel.value === null;
      }),
      { numRuns: 50 },
    );
  });
});

// ── EB5: broadcastTheme sets globalThemeChannel ───────────────────────────────

describe("EB5: broadcastTheme sets globalThemeChannel", () => {
  it("globalThemeChannel.value equals the last broadcasted theme", () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        _resetBusForTesting();
        broadcastTheme(theme);
        return globalThemeChannel.value === theme;
      }),
      { numRuns: 60 },
    );
  });
});

// ── EB6: broadcastSync is idempotent for same state ───────────────────────────

describe("EB6: broadcastSync is idempotent for repeated same-state writes", () => {
  it("calling broadcastSync with same id+state twice doesn't change globalSync", () => {
    fc.assert(
      fc.property(cardIdArb, syncStateArb, (id, state) => {
        _resetBusForTesting();
        broadcastSync(id, state);
        const after1 = globalSync.value;
        broadcastSync(id, state); // same again
        const after2 = globalSync.value;
        return after1 === after2;
      }),
      { numRuns: 100 },
    );
  });
});
