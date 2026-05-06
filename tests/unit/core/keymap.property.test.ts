/**
 * fast-check property tests — src/core/keymap.ts (Sprint 492)
 *
 * Properties under test:
 *  KM1. buildHelpRows returns a fragment with exactly N children for N actions.
 *  KM2. buildHelpRows picks correct bilingual description by lang.
 *  KM3. sortKeyEntries: single-char keys always precede multi-char keys.
 *  KM4. sortKeyEntries: output length matches input length.
 *  KM5. sortKeyEntries is idempotent (sorting twice yields same order).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildHelpRows, sortKeyEntries } from "@/core/keymap";
import type { KeyboardAction } from "@/ui/keyboard";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const singleCharKeyArb = fc.stringMatching(/^[a-z]$/);
const multiCharKeyArb = fc.constantFrom("Escape", "ArrowUp", "ArrowDown", "Enter", "Tab");

const actionArb: fc.Arbitrary<KeyboardAction> = fc.record({
  key: fc.oneof(singleCharKeyArb, multiCharKeyArb),
  description: fc.oneof(
    fc.string({ minLength: 1, maxLength: 30 }),
    // bilingual format: "english / עברית"
    fc.tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 20 }),
    ).map(([en, he]) => `${en} / ${he}`),
  ),
  handler: fc.constant(() => {}),
});

const actionsArb = fc.array(actionArb, { minLength: 0, maxLength: 15 });

// ── KM1: buildHelpRows returns correct child count ───────────────────────────

describe("keymap — KM1: buildHelpRows returns N children for N actions", () => {
  it("fragment childElementCount matches actions length", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const frag = buildHelpRows(actions, "he");
        expect(frag.childElementCount).toBe(actions.length);
      }),
      { numRuns: 30 },
    );
  });
});

// ── KM2: bilingual description picking ──────────────────────────────────────

describe("keymap — KM2: buildHelpRows picks correct bilingual side", () => {
  it("lang=en picks first part, lang=he picks second part", () => {
    const bilingualAction: KeyboardAction = {
      key: "h",
      description: "Help / עזרה",
      handler: () => {},
    };
    const fragEn = buildHelpRows([bilingualAction], "en");
    const fragHe = buildHelpRows([bilingualAction], "he");
    const enText = (fragEn.firstElementChild as HTMLElement).querySelector("span")?.textContent;
    const heText = (fragHe.firstElementChild as HTMLElement).querySelector("span")?.textContent;
    expect(enText).toBe("Help");
    expect(heText).toBe("עזרה");
  });
});

// ── KM3: sortKeyEntries — singles before multis ──────────────────────────────

describe("keymap — KM3: sortKeyEntries puts single-char keys first", () => {
  it("all single-char keys precede all multi-char keys", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const sorted = sortKeyEntries(actions);
        let seenMulti = false;
        for (const a of sorted) {
          if (a.key.length > 1) seenMulti = true;
          else if (seenMulti) {
            // single-char after multi-char = violation
            expect.fail("Single-char key found after multi-char key");
          }
        }
      }),
      { numRuns: 50 },
    );
  });
});

// ── KM4: sortKeyEntries preserves length ─────────────────────────────────────

describe("keymap — KM4: sortKeyEntries preserves length", () => {
  it("output length === input length", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        expect(sortKeyEntries(actions).length).toBe(actions.length);
      }),
      { numRuns: 30 },
    );
  });
});

// ── KM5: sortKeyEntries is idempotent ────────────────────────────────────────

describe("keymap — KM5: sortKeyEntries is idempotent", () => {
  it("sorting twice yields same result", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const once = sortKeyEntries(actions);
        const twice = sortKeyEntries(once);
        expect(twice.map((a) => a.key)).toEqual(once.map((a) => a.key));
      }),
      { numRuns: 30 },
    );
  });
});
