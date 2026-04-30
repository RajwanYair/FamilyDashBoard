/**
 * Tests for src/core/links.ts — Sprint 216 / X3 semantic-link service.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerLink, getLinks, clearLinks } from "@/core/links";

vi.mock("@/core/config", () => ({
  loadConfig: vi.fn(() => ({ semanticLinksEnabled: true })),
}));
import { loadConfig } from "@/core/config";

describe("Semantic links — registerLink / getLinks (Sprint 216 / X3)", () => {
  beforeEach(() => {
    clearLinks();
    vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: true } as never);
  });

  it("getLinks returns empty array when no links registered", () => {
    expect(getLinks("stocks")).toEqual([]);
  });

  it("registerLink + getLinks returns the registered link", () => {
    const resolver = () => "stocks→weather";
    registerLink("stocks", "weather", resolver);
    const links = getLinks("stocks");
    expect(links).toHaveLength(1);
    expect(links[0]?.fromCardId).toBe("stocks");
    expect(links[0]?.toCardId).toBe("weather");
    expect(links[0]?.resolver).toBe(resolver);
  });

  it("getLinks only returns links from the requested cardId", () => {
    registerLink("stocks", "weather", () => null);
    registerLink("news", "weather", () => null);
    expect(getLinks("stocks")).toHaveLength(1);
    expect(getLinks("news")).toHaveLength(1);
    expect(getLinks("weather")).toHaveLength(0);
  });

  it("re-registering same direction replaces the resolver", () => {
    const res1 = () => "v1";
    const res2 = () => "v2";
    registerLink("stocks", "weather", res1);
    registerLink("stocks", "weather", res2);
    const links = getLinks("stocks");
    expect(links).toHaveLength(1);
    expect(links[0]?.resolver).toBe(res2);
  });

  it("clearLinks removes all registered links", () => {
    registerLink("stocks", "weather", () => null);
    registerLink("news", "calendar", () => null);
    clearLinks();
    expect(getLinks("stocks")).toEqual([]);
    expect(getLinks("news")).toEqual([]);
  });

  it("getLinks returns empty array when semanticLinksEnabled is false", () => {
    vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: false } as never);
    registerLink("stocks", "weather", () => "data");
    expect(getLinks("stocks")).toEqual([]);
  });

  it("resolver is callable and returns expected value", () => {
    registerLink("stocks", "weather", () => "sunny");
    const links = getLinks("stocks");
    expect(links[0]?.resolver()).toBe("sunny");
  });

  it("multiple links from the same card are all returned", () => {
    registerLink("stocks", "weather", () => null);
    registerLink("stocks", "calendar", () => null);
    registerLink("stocks", "news", () => null);
    expect(getLinks("stocks")).toHaveLength(3);
  });
});

// ── Sprint 264 / LP1-LP4: fast-check property tests for links invariants ──────

import * as fc from "fast-check";

describe("Semantic links — fast-check properties (LP1-LP4, Sprint 264)", () => {
  beforeEach(() => {
    clearLinks();
    vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: true } as never);
  });

  /**
   * LP1: registerLink + getLinks always returns array containing the link.
   * For any valid (fromCardId, toCardId) string pair, the registered link appears.
   */
  it("LP1 · registered link always appears in getLinks result (enabled)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (from: string, to: string) => {
          clearLinks();
          const resolver = () => "payload";
          registerLink(from, to, resolver);
          const links = getLinks(from);
          return links.length >= 1 && links.some((l) => l.fromCardId === from && l.toCardId === to);
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * LP2: Re-registering the same (from, to) pair always keeps exactly one entry.
   */
  it("LP2 · re-registering same direction always yields exactly one entry", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 2, max: 5 }),
        (from: string, to: string, times: number) => {
          clearLinks();
          for (let i = 0; i < times; i++) {
            registerLink(from, to, () => `v${String(i)}`);
          }
          return getLinks(from).length === 1;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * LP3: clearLinks always makes getLinks return empty array for any fromCardId.
   */
  it("LP3 · clearLinks always empties the registry for any fromCardId", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.string({ minLength: 1, maxLength: 15 }),
            fc.string({ minLength: 1, maxLength: 15 }),
          ),
          { minLength: 1, maxLength: 5 },
        ),
        fc.string({ minLength: 1, maxLength: 15 }),
        (pairs: [string, string][], queryFrom: string) => {
          clearLinks();
          for (const [from, to] of pairs) {
            registerLink(from, to, () => null);
          }
          clearLinks();
          return getLinks(queryFrom).length === 0;
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * LP4: When semanticLinksEnabled=false, getLinks always returns [].
   */
  it("LP4 · getLinks always returns [] when semanticLinksEnabled=false", () => {
    vi.mocked(loadConfig).mockReturnValue({ semanticLinksEnabled: false } as never);
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (from: string, to: string, queryFrom: string) => {
          clearLinks();
          registerLink(from, to, () => "data");
          return getLinks(queryFrom).length === 0;
        },
      ),
      { numRuns: 200 },
    );
  });
});
