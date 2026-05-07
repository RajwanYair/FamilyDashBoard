/**
 * fast-check property tests — src/core/keymap.ts 
 *
 * Properties under test:
 *  KM1. buildHelpRows returns a fragment with exactly N children for N actions.
 *  KM2. buildHelpRows picks correct bilingual description by lang.
 *  KM3. sortKeyEntries: single-char keys always precede multi-char keys.
 *  KM4. sortKeyEntries: output length matches input length.
 *  KM5. sortKeyEntries is idempotent (sorting twice yields same order).
 *  KM6. buildHelpRows: single-char keys are uppercased in the .help-key span.
 *  KM7. sortKeyEntries: within single-char group, keys are alphabetically ordered.
 *  KM8. buildHelpRows: each row contains exactly 2 <span> children.
 *  KM9. sortKeyEntries: elements are a permutation of the input (no loss/gain).
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

// ── KM6: single-char keys uppercased in .help-key ────────────────────────────

describe("keymap — KM6: buildHelpRows uppercases single-char keys", () => {
  it(".help-key textContent is uppercase for single-char keys", () => {
    fc.assert(
      fc.property(singleCharKeyArb, (key) => {
        const action: KeyboardAction = { key, description: "test", handler: () => {} };
        const frag = buildHelpRows([action], "he");
        const keySpan = frag.firstElementChild?.querySelector(".help-key");
        expect(keySpan?.textContent).toBe(key.toUpperCase());
      }),
      { numRuns: 26 },
    );
  });
});

// ── KM7: sortKeyEntries alphabetical within single-char group ────────────────

describe("keymap — KM7: sortKeyEntries alphabetical within single-char group", () => {
  it("single-char keys appear in localeCompare order", () => {
    const singleOnlyArb = fc.array(
      fc.record({
        key: singleCharKeyArb,
        description: fc.constant("d"),
        handler: fc.constant(() => {}),
      }),
      { minLength: 2, maxLength: 10 },
    ) as fc.Arbitrary<KeyboardAction[]>;

    fc.assert(
      fc.property(singleOnlyArb, (actions) => {
        const sorted = sortKeyEntries(actions);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i - 1].key.localeCompare(sorted[i].key)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 40 },
    );
  });
});

// ── KM8: buildHelpRows — each row has exactly 2 spans ────────────────────────

describe("keymap — KM8: buildHelpRows each row has 2 <span> children", () => {
  it("every .help-row has exactly 2 spans (description + key)", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        if (actions.length === 0) return;
        const frag = buildHelpRows(actions, "en");
        for (const row of Array.from(frag.children)) {
          const spans = row.querySelectorAll("span");
          expect(spans.length).toBe(2);
        }
      }),
      { numRuns: 30 },
    );
  });
});

// ── KM9: sortKeyEntries is a permutation (no data loss) ──────────────────────

describe("keymap — KM9: sortKeyEntries is a permutation of input", () => {
  it("sorted keys multiset equals original keys multiset", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const sorted = sortKeyEntries(actions);
        const originalKeys = actions.map((a) => a.key).sort();
        const sortedKeys = sorted.map((a) => a.key).sort();
        expect(sortedKeys).toEqual(originalKeys);
      }),
      { numRuns: 40 },
    );
  });
});
