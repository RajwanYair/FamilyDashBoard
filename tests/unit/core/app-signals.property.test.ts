/**
 * fast-check property tests — src/core/app-signals.ts (Sprint 503)
 *
 * Properties under test:
 *  AS1. syncAppSignal("config.tempUnit", "C"|"F") updates tempUnit signal.
 *  AS2. syncAppSignal("config.tempUnit", invalid) does not change tempUnit.
 *  AS3. syncAppSignal("config.theme", ThemeName) updates appTheme signal.
 *  AS4. syncAppSignal("config.motivationInterval", number) updates motivationInterval.
 *  AS5. syncAppSignal("config.screenMode", valid) updates screenMode.
 *  AS6. syncAppSignal with unknown key is no-op (doesn't throw).
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  syncAppSignal,
  tempUnit,
  appTheme,
  motivationInterval,
  screenMode,
  alertsEnabled,
} from "@/core/app-signals";
import { THEMES, SCREEN_MODES } from "@/core/constants";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset to defaults
  tempUnit.value = "C";
  appTheme.value = "black";
  motivationInterval.value = 0;
  screenMode.value = "tv";
  alertsEnabled.value = true;
});

// ── Arbitraries ───────────────────────────────────────────────────────────────

const tempUnitArb = fc.constantFrom("C" as const, "F" as const);
const themeArb = fc.constantFrom(...THEMES);
const screenModeArb = fc.constantFrom(...SCREEN_MODES);
const positiveInt = fc.integer({ min: 0, max: 120 });

// ── AS1: syncAppSignal tempUnit valid ────────────────────────────────────────

describe("app-signals — AS1: tempUnit valid updates", () => {
  it("C or F is applied", () => {
    fc.assert(
      fc.property(tempUnitArb, (unit) => {
        syncAppSignal("config.tempUnit", unit);
        expect(tempUnit.value).toBe(unit);
      }),
      { numRuns: 10 },
    );
  });
});

// ── AS2: syncAppSignal tempUnit invalid is no-op ─────────────────────────────

describe("app-signals — AS2: tempUnit invalid is no-op", () => {
  it("garbage string does not change signal", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== "C" && s !== "F"),
        (junk) => {
          tempUnit.value = "C";
          syncAppSignal("config.tempUnit", junk);
          expect(tempUnit.value).toBe("C");
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── AS3: syncAppSignal theme updates ─────────────────────────────────────────

describe("app-signals — AS3: appTheme valid updates", () => {
  it("any valid theme name is applied", () => {
    fc.assert(
      fc.property(themeArb, (theme) => {
        syncAppSignal("config.theme", theme);
        expect(appTheme.value).toBe(theme);
      }),
      { numRuns: 10 },
    );
  });
});

// ── AS4: syncAppSignal motivationInterval ────────────────────────────────────

describe("app-signals — AS4: motivationInterval numeric update", () => {
  it("number is applied directly", () => {
    fc.assert(
      fc.property(positiveInt, (n) => {
        syncAppSignal("config.motivationInterval", n);
        expect(motivationInterval.value).toBe(n);
      }),
      { numRuns: 20 },
    );
  });

  it("non-number defaults to 0", () => {
    syncAppSignal("config.motivationInterval", "garbage");
    expect(motivationInterval.value).toBe(0);
  });
});

// ── AS5: syncAppSignal screenMode ────────────────────────────────────────────

describe("app-signals — AS5: screenMode valid updates", () => {
  it("valid screen mode is applied", () => {
    fc.assert(
      fc.property(screenModeArb, (mode) => {
        syncAppSignal("config.screenMode", mode);
        expect(screenMode.value).toBe(mode);
      }),
      { numRuns: 10 },
    );
  });
});

// ── AS6: unknown key is no-op ────────────────────────────────────────────────

describe("app-signals — AS6: unknown key is no-op", () => {
  it("does not throw for random key", () => {
    fc.assert(
      fc.property(fc.string(), (key) => {
        const prefix = `unknown.${key}`;
        expect(() => syncAppSignal(prefix, "value")).not.toThrow();
      }),
      { numRuns: 30 },
    );
  });
});
