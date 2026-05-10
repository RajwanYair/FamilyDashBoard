/**
 * fast-check property tests — src/core/links.ts
 *
 * Properties under test:
 *  LK1. Registration count: after N distinct direction registrations
 *       getLinks returns exactly the count for the specified fromCardId.
 *  LK2. Idempotence: re-registering the same (from, to) direction replaces
 *       rather than duplicates — getLinks length stays 1 per direction.
 *  LK3. Direction isolation: registering A→B does not affect getLinks("C").
 *  LK4. clearLinks resets: getLinks returns [] for any cardId after clearLinks().
 *  LK5. Resolver identity: the registered resolver is returned verbatim
 *       (reference-equal) via getLinks.
 *  LK6. Feature-gate: when semanticLinksEnabled is false getLinks always
 *       returns [] regardless of how many links are registered.
 *  LK7. getLinks returns entries whose toCardId matches the registered target.
 *  LK8. Resolver invocation: calling resolver() returns expected payload.
 *  LK9. Removal of one direction does not affect other registered directions.
 *  LK10. getLinks for a fresh cardId always returns [] (no leakage).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";
import { registerLink, getLinks, clearLinks } from "@/core/links";

// Mock the config to control semanticLinksEnabled
vi.mock("@/core/config", () => ({
  loadConfig: vi.fn(() => ({ semanticLinksEnabled: true })),
}));
import { loadConfig } from "@/core/config";

// ── Arbitraries ───────────────────────────────────────────────────────────────

/** Simple alphanumeric card ID, no special chars */
const cardIdArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,14}$/);

/** A pair of distinct card IDs */
const distinctPairArb = fc.tuple(cardIdArb, cardIdArb).filter(([a, b]) => a !== b);

/** N distinct (from, to) pairs — N ∈ [1, 6] */
const distinctLinksArb = fc
  .uniqueArray(distinctPairArb, {
    minLength: 1,
    maxLength: 6,
    comparator: ([a, b], [c, d]) => a === c && b === d,
  })
  .filter((pairs) => pairs.length >= 1);

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearLinks();
  vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: true } as never);
});

// ── LK1: Registration count ───────────────────────────────────────────────────

describe("links — LK1: getLinks count matches registrations for fromCardId", () => {
  it("N distinct A→Bi registrations → getLinks(A) returns N links", () => {
    fc.assert(
      fc.property(
        cardIdArb,
        fc.uniqueArray(cardIdArb, { minLength: 1, maxLength: 6 }),
        (from, tos) => {
          clearLinks();
          const uniqueTos = [...new Set(tos)].filter((t) => t !== from);
          if (uniqueTos.length === 0) return; // skip degenerate case
          for (const to of uniqueTos) {
            registerLink(from, to, () => `${from}→${to}`);
          }
          const links = getLinks(from);
          expect(links.length).toBe(uniqueTos.length);
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── LK2: Idempotence — re-register replaces, not duplicates ──────────────────

describe("links — LK2: re-registering same direction replaces previous resolver", () => {
  it("double registerLink(A, B, …) → getLinks(A) still has length 1", () => {
    fc.assert(
      fc.property(distinctPairArb, ([from, to]) => {
        clearLinks();
        const r1 = () => "first";
        const r2 = () => "second";
        registerLink(from, to, r1);
        registerLink(from, to, r2);
        const links = getLinks(from);
        expect(links).toHaveLength(1);
        // The resolver must be the latest one
        expect(links[0]?.resolver).toBe(r2);
      }),
      { numRuns: 80 },
    );
  });
});

// ── LK3: Direction isolation ──────────────────────────────────────────────────

describe("links — LK3: registering A→B does not affect getLinks(C) for C ≠ A", () => {
  it("unrelated card C still returns [] after A→B registration", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(cardIdArb, cardIdArb, cardIdArb)
          .filter(([a, b, c]) => a !== b && b !== c && a !== c),
        ([from, to, other]) => {
          clearLinks();
          registerLink(from, to, () => "link");
          const links = getLinks(other);
          expect(links).toEqual([]);
        },
      ),
      { numRuns: 80 },
    );
  });
});

// ── LK4: clearLinks resets all ────────────────────────────────────────────────

describe("links — LK4: clearLinks() resets — getLinks returns [] for any cardId", () => {
  it("all registrations gone after clearLinks()", () => {
    fc.assert(
      fc.property(distinctLinksArb, cardIdArb, (pairs, queryCard) => {
        // Register all links
        for (const [from, to] of pairs) {
          registerLink(from, to, () => `${from}→${to}`);
        }
        clearLinks();
        // After clear, any cardId query returns []
        expect(getLinks(queryCard)).toEqual([]);
      }),
      { numRuns: 60 },
    );
  });
});

// ── LK5: Resolver identity ────────────────────────────────────────────────────

describe("links — LK5: registered resolver is returned reference-equal", () => {
  it("getLinks()[0].resolver === the exact function passed to registerLink", () => {
    fc.assert(
      fc.property(distinctPairArb, ([from, to]) => {
        clearLinks();
        const resolver = () => "payload";
        registerLink(from, to, resolver);
        const links = getLinks(from);
        expect(links[0]?.resolver).toBe(resolver);
      }),
      { numRuns: 80 },
    );
  });
});

// ── LK6: Feature-gate — disabled config returns [] ───────────────────────────

describe("links — LK6: semanticLinksEnabled=false → getLinks always returns []", () => {
  it("returns [] for any cardId when feature is disabled", () => {
    fc.assert(
      fc.property(distinctLinksArb, cardIdArb, (pairs, queryCard) => {
        clearLinks();
        // Register some links
        for (const [from, to] of pairs) {
          registerLink(from, to, () => "link");
        }
        // Disable the feature
        vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: false } as never);
        expect(getLinks(queryCard)).toEqual([]);
        // Re-enable for next test
        vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: true } as never);
      }),
      { numRuns: 60 },
    );
  });
});

// ── LK7: toCardId correctness ────────────────────────────────────────────────

describe("links — LK7: getLinks entries have correct toCardId", () => {
  it("each returned link's toCardId matches the registered target", () => {
    fc.assert(
      fc.property(
        cardIdArb,
        fc.uniqueArray(cardIdArb, { minLength: 1, maxLength: 5 }),
        (from, targets) => {
          clearLinks();
          const uniqueTargets = [...new Set(targets)].filter((t) => t !== from);
          if (uniqueTargets.length === 0) return;
          for (const to of uniqueTargets) {
            registerLink(from, to, () => to);
          }
          const links = getLinks(from);
          const returnedTos = links.map((l) => l.toCardId).sort();
          expect(returnedTos).toEqual([...uniqueTargets].sort());
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── LK8: Resolver invocation returns expected payload ────────────────────────

describe("links — LK8: resolver() returns registered payload", () => {
  it("calling resolver produces the expected string", () => {
    fc.assert(
      fc.property(
        distinctPairArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        ([from, to], payload) => {
          clearLinks();
          registerLink(from, to, () => payload);
          const links = getLinks(from);
          expect(links[0]?.resolver()).toBe(payload);
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── LK9: clearLinks for re-register one doesn't affect others ────────────────

describe("links — LK9: replacing one direction preserves other directions", () => {
  it("re-registering A→B with new resolver leaves A→C intact", () => {
    fc.assert(
      fc.property(
        fc
          .tuple(cardIdArb, cardIdArb, cardIdArb)
          .filter(([a, b, c]) => a !== b && a !== c && b !== c),
        ([from, to1, to2]) => {
          clearLinks();
          const r1 = () => "r1";
          const r2 = () => "r2";
          registerLink(from, to1, r1);
          registerLink(from, to2, r2);
          // Replace the first resolver
          const r1New = () => "r1-new";
          registerLink(from, to1, r1New);
          const links = getLinks(from);
          // Both directions still present
          expect(links.length).toBe(2);
          const link2 = links.find((l) => l.toCardId === to2);
          expect(link2?.resolver).toBe(r2);
        },
      ),
      { numRuns: 60 },
    );
  });
});

// ── LK10: fresh cardId returns [] (no leakage) ──────────────────────────────

describe("links — LK10: unregistered cardId returns empty array", () => {
  it("cardId with no links returns [] even when registry has other entries", () => {
    fc.assert(
      fc.property(
        distinctPairArb,
        cardIdArb.filter((id) => id.length > 5),
        ([from, to], fresh) => {
          clearLinks();
          registerLink(from, to, () => "x");
          if (fresh === from) return; // skip collision
          expect(getLinks(fresh)).toEqual([]);
        },
      ),
      { numRuns: 60 },
    );
  });
});
