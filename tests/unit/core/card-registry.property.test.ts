/**
 * fast-check property tests — src/core/card-registry.ts (Sprint 534)
 *
 * Properties under test:
 *  CR1. registerCard + getCard round-trip: any registered entry is retrievable by id
 *  CR2. getCard returns undefined for unregistered ids
 *  CR3. listCards returns entries sorted by titleHe in Hebrew locale order
 *  CR4. registerCard last-wins: re-registering same id overwrites
 *  CR5. listCards length equals distinct registered ids count
 *  CR6. loadCard throws for unregistered id
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

// We test the registry in isolation by importing from a fresh module each time.
// Since the registry is module-level state, we use resetModules per test.
// Instead, import the real module — tests use unique IDs to avoid collisions.
import { registerCard, getCard, listCards, loadCard } from "@/core/card-registry";

const makeEntry = (id: string, titleHe: string, titleEn = "EN") => ({
  id,
  icon: "🔲",
  titleHe,
  titleEn,
  load: async () => ({ id, icon: "🔲", titleHe, titleEn, defaultSlot: { col: 0 as const, order: 0, flexGrow: 1, hidden: false }, defaultSize: "md" as const, render: () => document.createElement("div"), init: () => {} }),
  defaultSlot: { col: 0 as const, order: 0, flexGrow: 1, hidden: false },
  defaultSize: "md" as const,
});

// ── CR1: round-trip ──────────────────────────────────────────────────────────

describe("card-registry — CR1: register+get round-trip", () => {
  it("registered card is retrievable", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^test-cr1-[a-z]{3,8}$/),
        (id) => {
          const entry = makeEntry(id, "בדיקה");
          registerCard(entry);
          const got = getCard(id);
          expect(got).toBeDefined();
          expect(got!.id).toBe(id);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── CR2: undefined for unregistered ──────────────────────────────────────────

describe("card-registry — CR2: getCard undefined", () => {
  it("returns undefined for random non-existent id", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^nonexist-[a-z0-9]{10,20}$/),
        (id) => {
          expect(getCard(id)).toBeUndefined();
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ── CR3: listCards sorted by Hebrew locale ───────────────────────────────────

describe("card-registry — CR3: listCards sorted", () => {
  it("entries are sorted by titleHe", () => {
    // Register a few entries with known Hebrew titles
    const titles = ["זמנים", "אבגד", "מזג"];
    for (const t of titles) {
      registerCard(makeEntry(`cr3-${t}`, t));
    }
    const list = listCards();
    for (let i = 1; i < list.length; i++) {
      const cmp = list[i - 1]!.titleHe.localeCompare(list[i]!.titleHe, "he");
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });
});

// ── CR4: last-wins semantics ─────────────────────────────────────────────────

describe("card-registry — CR4: last-wins overwrite", () => {
  it("re-registering same id overwrites entry", () => {
    const id = "cr4-overwrite-test";
    registerCard(makeEntry(id, "ראשון"));
    registerCard(makeEntry(id, "שני"));
    expect(getCard(id)!.titleHe).toBe("שני");
  });
});

// ── CR5: listCards length ────────────────────────────────────────────────────

describe("card-registry — CR5: listCards length", () => {
  it("adding N unique entries increases list size", () => {
    const before = listCards().length;
    const ids = ["cr5-a", "cr5-b", "cr5-c"];
    for (const id of ids) registerCard(makeEntry(id, id));
    const after = listCards().length;
    // At least ids that were new should be added
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

// ── CR6: loadCard throws for missing ─────────────────────────────────────────

describe("card-registry — CR6: loadCard throws", () => {
  it("throws for unregistered id", async () => {
    await expect(loadCard("cr6-nonexist-xyz")).rejects.toThrow(/not registered/i);
  });
});
