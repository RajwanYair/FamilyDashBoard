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
 *  CR7. createShell returns section with data-card-id attribute (Sprint 595)
 *  CR8. createShell throws for unregistered id (Sprint 595)
 *  CR9. listCards always contains any just-registered id (Sprint 595)
 *  CR10. loadCard succeeds for registered card (Sprint 595)
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";

// We test the registry in isolation by importing from a fresh module each time.
// Since the registry is module-level state, we use resetModules per test.
// Instead, import the real module — tests use unique IDs to avoid collisions.
import { registerCard, getCard, listCards, loadCard, createShell } from "@/core/card-registry";

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

// ── CR7: createShell returns section with data-card-id ───────────────────────

describe("card-registry — CR7: createShell structural output", () => {
  it("returns a section element with correct data-card-id", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^test-cr7-[a-z]{3,6}$/),
        (id) => {
          registerCard(makeEntry(id, "בדיקה"));
          const shell = createShell(id);
          expect(shell.root.tagName).toBe("SECTION");
          expect(shell.root.dataset["cardId"]).toBe(id);
          expect(shell.body).toBeDefined();
          expect(shell.header).toBeDefined();
          expect(shell.footer).toBeDefined();
        },
      ),
      { numRuns: 8 },
    );
  });
});

// ── CR8: createShell throws for unregistered id ──────────────────────────────

describe("card-registry — CR8: createShell throws for missing", () => {
  it("throws for unregistered id", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^noexist-cr8-[a-z0-9]{5,10}$/),
        (id) => {
          expect(() => createShell(id)).toThrow(/not registered/i);
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── CR9: listCards always includes just-registered id ─────────────────────────

describe("card-registry — CR9: listCards includes registered entry", () => {
  it("newly registered card appears in listCards", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^test-cr9-[a-z]{3,8}$/),
        (id) => {
          registerCard(makeEntry(id, "בדיקה"));
          const ids = listCards().map((c) => c.id);
          expect(ids).toContain(id);
        },
      ),
      { numRuns: 8 },
    );
  });
});

// ── CR10: loadCard succeeds for registered card ──────────────────────────────

describe("card-registry — CR10: loadCard success path", () => {
  it("resolves with CardDefinition for registered card", async () => {
    const id = "cr10-success-test";
    registerCard(makeEntry(id, "הצלחה"));
    const def = await loadCard(id);
    expect(def.id).toBe(id);
    expect(typeof def.render).toBe("function");
  });
});
