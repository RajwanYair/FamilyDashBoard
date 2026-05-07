/**
 * fast-check property tests for src/core/card-registry.ts 
 *
 * Verifies invariants of registerCard / getCard / listCards over arbitrary
 * id sequences. The registry is a plain Map so these properties exercise:
 *  - last-write-wins on duplicate ids
 *  - sort stability of listCards by titleHe
 *  - getCard ↔ registerCard round-trip identity
 *  - listCards length never exceeds unique-id count
 *  - loadCard rejects on unregistered ids
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";
import { registerCard, getCard, listCards, loadCard } from "@/core/card-registry";
import type { CardDefinition, CardRegistryEntry } from "@/types/card";

function makeEntry(id: string, titleHe: string): CardRegistryEntry {
  const def: CardDefinition = {
    id,
    icon: "🧪",
    titleHe,
    titleEn: id,
    defaultSlot: { col: 0, order: 0, flexGrow: 20, hidden: false },
    defaultSize: "md",
    render: () => document.createElement("section"),
    init: vi.fn(),
  };
  return {
    id,
    icon: "🧪",
    titleHe,
    titleEn: id,
    load: vi.fn().mockResolvedValue(def),
  };
}

// Reset the registry by overwriting any ids that the property test might
// have inserted. We can't clear the Map directly, but using unique prefixed
// ids per test guarantees no cross-test contamination.
let testIdCounter = 0;
function uniquePrefix(): string {
  testIdCounter += 1;
  return `crp-${testIdCounter}-`;
}

describe("Card registry — fast-check properties (CRP1-CRP5 )", () => {
  beforeEach(() => {
    // No-op — each property uses a unique id prefix to avoid collision.
  });

  it("CRP1: getCard(id) returns exactly the entry passed to registerCard(id) (round-trip)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }).filter((s) => /^[a-z0-9-]+$/i.test(s)),
        fc.string({ minLength: 1, maxLength: 20 }),
        (suffix, titleHe) => {
          const id = `${uniquePrefix()}${suffix}`;
          const entry = makeEntry(id, titleHe);
          registerCard(entry);
          const got = getCard(id);
          expect(got).toBe(entry);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("CRP2: registering the same id multiple times is last-write-wins", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => /^[a-z]+$/i.test(s)),
        fc.array(fc.string({ minLength: 1, maxLength: 16 }), { minLength: 2, maxLength: 6 }),
        (suffix, titles) => {
          const id = `${uniquePrefix()}${suffix}`;
          let last: CardRegistryEntry | null = null;
          for (const titleHe of titles) {
            last = makeEntry(id, titleHe);
            registerCard(last);
          }
          expect(getCard(id)).toBe(last);
        },
      ),
      { numRuns: 25 },
    );
  });

  it("CRP3: listCards is sorted by titleHe (he locale, ascending)", () => {
    const prefix = uniquePrefix();
    const titles = ["זברה", "אריה", "חתול", "במבי"];
    titles.forEach((t, i) => registerCard(makeEntry(`${prefix}${i}`, t)));
    const list = listCards()
      .filter((e) => e.id.startsWith(prefix))
      .map((e) => e.titleHe);
    // Expected order via the same comparator used in listCards
    const expected = [...titles].sort((a, b) => a.localeCompare(b, "he"));
    expect(list).toEqual(expected);
  });

  it("CRP4: listCards length matches the number of unique ids registered with a given fresh prefix", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 6 }).filter((s) => /^[a-z]+$/i.test(s)), {
          minLength: 1,
          maxLength: 8,
        }),
        (suffixes) => {
          // Fresh prefix per iteration — fast-check reuses the same describe scope
          // across all runs, and the registry has no clear() API. A unique prefix
          // per iteration isolates the assertion to ids registered just now.
          const prefix = uniquePrefix();
          const ids = new Set<string>();
          for (const s of suffixes) {
            const id = `${prefix}${s}`;
            ids.add(id);
            registerCard(makeEntry(id, s));
          }
          const filtered = listCards().filter((e) => e.id.startsWith(prefix));
          expect(filtered.length).toBe(ids.size);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("CRP5: loadCard rejects with a descriptive error for any unregistered id", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 4, maxLength: 16 }).filter((s) => /^[a-z]+$/i.test(s)),
        async (s) => {
          const id = `crp-missing-${s}-${Math.random().toString(36).slice(2)}`;
          await expect(loadCard(id)).rejects.toThrow(/not registered/i);
        },
      ),
      { numRuns: 15 },
    );
  });
});
