/**
 * Sprint 298 — Property-based tests for src/core/keymap.ts (KP4–KP8)
 *
 * Uses fast-check to verify structural invariants that hold for all possible
 * action arrays. Complements the concrete unit tests in keymap.test.ts.
 */

import fc from "fast-check";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { buildHelpRows, sortKeyEntries } from "@/core/keymap";
import type { KeyboardAction } from "@/ui/keyboard";

// ── Arbitraries ───────────────────────────────────────────────────────────────

const singleCharKey = fc.string({ minLength: 1, maxLength: 1 });
const multiCharKey = fc.string({ minLength: 2, maxLength: 12 });
const anyKey = fc.oneof(singleCharKey, multiCharKey);

const actionArb = fc.record<KeyboardAction>({
  key: anyKey,
  description: fc.string({ minLength: 1, maxLength: 60 }),
  handler: fc.constant(() => undefined),
});

const actionsArb = fc.array(actionArb, { minLength: 0, maxLength: 20 });

// ── Setup DOM container ────────────────────────────────────────────────────────

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

// ── KP4: buildHelpRows — child count = actions.length ─────────────────────────

describe("KP4: buildHelpRows fragment child count equals actions length", () => {
  it("produces exactly one .help-row per action for any array", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const div = document.createElement("div");
        const frag = buildHelpRows(actions, "he");
        div.appendChild(frag);
        return div.querySelectorAll(".help-row").length === actions.length;
      }),
      { numRuns: 100 },
    );
  });
});

// ── KP5: buildHelpRows — each .help-key never lowercase for single-char keys ──

describe("KP5: buildHelpRows single-char keys are uppercase in .help-key", () => {
  it("single-char key is toUpperCase in rendered .help-key", () => {
    fc.assert(
      fc.property(singleCharKey, fc.string({ minLength: 1 }), (key, desc) => {
        const div = document.createElement("div");
        const frag = buildHelpRows([{ key, description: desc, handler: () => undefined }], "he");
        div.appendChild(frag);
        const keyEl = div.querySelector(".help-key");
        return keyEl?.textContent === key.toUpperCase();
      }),
      { numRuns: 100 },
    );
  });

  it("multi-char key is rendered verbatim (not uppercased)", () => {
    fc.assert(
      fc.property(multiCharKey, fc.string({ minLength: 1 }), (key, desc) => {
        const div = document.createElement("div");
        const frag = buildHelpRows([{ key, description: desc, handler: () => undefined }], "he");
        div.appendChild(frag);
        const keyEl = div.querySelector(".help-key");
        return keyEl?.textContent === key;
      }),
      { numRuns: 100 },
    );
  });
});

// ── KP6: sortKeyEntries — preserves all entries (no data loss) ────────────────

describe("KP6: sortKeyEntries preserves all entries", () => {
  it("output length equals input length", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const sorted = sortKeyEntries(actions);
        return sorted.length === actions.length;
      }),
      { numRuns: 200 },
    );
  });

  it("every input key appears in output", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const sorted = sortKeyEntries(actions);
        const outKeys = sorted.map((a) => a.key);
        return actions.every((a) => outKeys.includes(a.key));
      }),
      { numRuns: 100 },
    );
  });
});

// ── KP7: sortKeyEntries — all single-char keys come before all multi-char ─────

describe("KP7: sortKeyEntries single-char keys always precede multi-char keys", () => {
  it("no multi-char key appears before any single-char key", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const sorted = sortKeyEntries(actions);
        let seenMulti = false;
        for (const a of sorted) {
          if (a.key.length > 1) {
            seenMulti = true;
          } else if (seenMulti) {
            // single-char key found after a multi-char key → violation
            return false;
          }
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});

// ── KP8: sortKeyEntries — idempotent (sorting twice = sorting once) ───────────

describe("KP8: sortKeyEntries is idempotent", () => {
  it("sortKeyEntries(sortKeyEntries(x)) deep-equals sortKeyEntries(x)", () => {
    fc.assert(
      fc.property(actionsArb, (actions) => {
        const once = sortKeyEntries(actions).map((a) => a.key);
        const twice = sortKeyEntries(sortKeyEntries(actions)).map((a) => a.key);
        return JSON.stringify(once) === JSON.stringify(twice);
      }),
      { numRuns: 100 },
    );
  });
});
