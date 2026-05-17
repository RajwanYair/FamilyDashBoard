/**
 * fast-check property tests — src/core/config-presets.ts
 *
 * Properties under test:
 *  CP1. getPreset(id) returns a preset whose id === the queried id, for every registered id.
 *  CP2. getPreset(arbitrary string) returns undefined for strings not in the registry.
 *  CP3. Every registered preset has a fontScale in [0.5, 2.0].
 *  CP4. Every registered preset has a nightDimLevel in [0, 100].
 *  CP5. Every registered preset has an animLevel in the valid set.
 *  CP6. All preset ids are non-empty strings with no whitespace.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { CONFIG_PRESETS, getPreset } from "@/core/config-presets";

const VALID_ANIM_LEVELS = new Set(["none", "minimal", "normal", "full"]);
const KNOWN_IDS = CONFIG_PRESETS.map((p) => p.id);

// ── CP1: getPreset returns the correct preset for each registered id ─────────

describe("config-presets — CP1: getPreset returns matching preset for registered ids", () => {
  it("getPreset(registeredId).id === registeredId for every preset", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KNOWN_IDS), (id) => {
        const preset = getPreset(id);
        expect(preset).toBeDefined();
        expect(preset!.id).toBe(id);
      }),
      { numRuns: KNOWN_IDS.length },
    );
  });
});

// ── CP2: getPreset returns undefined for unknown ids ─────────────────────────

describe("config-presets — CP2: getPreset returns undefined for unknown ids", () => {
  it("returns undefined for any string not in the registry", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !KNOWN_IDS.includes(s)),
        (unknownId) => {
          expect(getPreset(unknownId)).toBeUndefined();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── CP3: fontScale is in [0.5, 2.0] for all presets ─────────────────────────

describe("config-presets — CP3: fontScale in [0.5, 2.0]", () => {
  it("every preset overrides.fontScale is within the valid range", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CONFIG_PRESETS), (preset) => {
        if (preset.overrides.fontScale !== undefined) {
          expect(preset.overrides.fontScale).toBeGreaterThanOrEqual(0.5);
          expect(preset.overrides.fontScale).toBeLessThanOrEqual(2.0);
        }
      }),
    );
  });
});

// ── CP4: nightDimLevel is in [0, 100] for all presets ───────────────────────

describe("config-presets — CP4: nightDimLevel in [0, 100]", () => {
  it("every preset overrides.nightDimLevel is within bounds", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CONFIG_PRESETS), (preset) => {
        if (preset.overrides.nightDimLevel !== undefined) {
          expect(preset.overrides.nightDimLevel).toBeGreaterThanOrEqual(0);
          expect(preset.overrides.nightDimLevel).toBeLessThanOrEqual(100);
        }
      }),
    );
  });
});

// ── CP5: animLevel is one of the four valid values ───────────────────────────

describe("config-presets — CP5: animLevel is valid", () => {
  it("every preset overrides.animLevel is a valid anim level", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CONFIG_PRESETS), (preset) => {
        if (preset.overrides.animLevel !== undefined) {
          expect(VALID_ANIM_LEVELS).toContain(preset.overrides.animLevel);
        }
      }),
    );
  });
});

// ── CP6: ids are non-empty, no whitespace ────────────────────────────────────

describe("config-presets — CP6: preset ids are slug-like", () => {
  it("every preset id is non-empty and contains no whitespace", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CONFIG_PRESETS), (preset) => {
        expect(preset.id.length).toBeGreaterThan(0);
        expect(/\s/.test(preset.id)).toBe(false);
      }),
    );
  });
});
