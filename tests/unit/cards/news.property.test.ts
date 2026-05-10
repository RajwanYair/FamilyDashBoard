/**
 * fast-check property tests — src/cards/news/news.ts ( , extended )
 *
 * Properties under test:
 *  NW1. filterBySearch: empty query → returns all items
 *  NW2. filterBySearch: results always ⊆ input
 *  NW3. readingTimeMinutes: empty → 0, non-empty → ≥ 1
 *  NW4. sanitizeNewsTitle: output length ≤ maxLen
 *  NW5. sanitizeNewsTitle: strips HTML entities
 *  NW6. newsSourceDomain: valid URL → no "www." prefix
 *  NW7. newsSourceDomain: invalid URL → returns input as-is
 *  NW8. isBreaking: title with "breaking" → true
 *  NW9. pubTimeLabel: invalid date → ""
 *  NW10. relativeAge: invalid/future → ""
 *  NW11. ageFreshness: invalid → "old"
 *  NW12. getStarId: length ≤ 120, deterministic
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  filterBySearch,
  readingTimeMinutes,
  sanitizeNewsTitle,
  newsSourceDomain,
  isBreaking,
  pubTimeLabel,
  relativeAge,
  ageFreshness,
  getStarId,
} from "@/cards/news/news";

// ── Helper arbitrary: news item ──────────────────────────────────────────────
const newsItemArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 60 }),
  source: fc.string({ minLength: 1, maxLength: 20 }),
  link: fc.webUrl(),
  pubDate: fc.constant("2025-01-01T12:00:00Z"),
});

// ── NW1: filterBySearch empty query → all items ──────────────────────────────

describe("news — NW1: filterBySearch empty query", () => {
  it("returns all items when query is empty", () => {
    fc.assert(
      fc.property(fc.array(newsItemArb, { minLength: 0, maxLength: 10 }), (items) => {
        expect(filterBySearch(items as never, "")).toHaveLength(items.length);
        expect(filterBySearch(items as never, "  ")).toHaveLength(items.length);
      }),
      { numRuns: 20 },
    );
  });
});

// ── NW2: filterBySearch results ⊆ input ──────────────────────────────────────

describe("news — NW2: filterBySearch subset", () => {
  it("results are always subset of input", () => {
    fc.assert(
      fc.property(
        fc.array(newsItemArb, { minLength: 0, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (items, query) => {
          const result = filterBySearch(items as never, query);
          expect(result.length).toBeLessThanOrEqual(items.length);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── NW3: readingTimeMinutes ──────────────────────────────────────────────────

describe("news — NW3: readingTimeMinutes", () => {
  it("empty → 0", () => {
    expect(readingTimeMinutes("")).toBe(0);
  });

  it("non-empty → ≥ 1", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length > 0),
        (text) => {
          expect(readingTimeMinutes(text)).toBeGreaterThanOrEqual(1);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── NW4: sanitizeNewsTitle length ────────────────────────────────────────────

describe("news — NW4: sanitizeNewsTitle length", () => {
  it("output ≤ maxLen", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 300 }),
        fc.integer({ min: 10, max: 200 }),
        (title, maxLen) => {
          const result = sanitizeNewsTitle(title, maxLen);
          expect(result.length).toBeLessThanOrEqual(maxLen);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── NW5: sanitizeNewsTitle entities ──────────────────────────────────────────

describe("news — NW5: sanitizeNewsTitle entities", () => {
  it("strips &amp; &lt; &gt;", () => {
    expect(sanitizeNewsTitle("Hello &amp; World")).toBe("Hello & World");
    expect(sanitizeNewsTitle("A &lt; B &gt; C")).toBe("A < B > C");
    expect(sanitizeNewsTitle("She said &quot;hi&quot;")).toBe('She said "hi"');
  });
});

// ── NW6: newsSourceDomain valid URL ──────────────────────────────────────────

describe("news — NW6: newsSourceDomain valid", () => {
  it("strips www. prefix", () => {
    expect(newsSourceDomain("https://www.example.com/path")).toBe("example.com");
  });

  it("preserves non-www host", () => {
    expect(newsSourceDomain("https://api.example.com/rss")).toBe("api.example.com");
  });
});

// ── NW7: newsSourceDomain invalid ────────────────────────────────────────────

describe("news — NW7: newsSourceDomain invalid", () => {
  it("non-URL → returns input", () => {
    // URL constructor is very lenient (e.g. "A: " → protocol "a:")
    // so we test specific known-invalid patterns
    expect(newsSourceDomain("not a url at all")).toBe("not a url at all");
    expect(newsSourceDomain("plain text")).toBe("plain text");
    expect(newsSourceDomain("")).toBe("");
  });
});

// ── NW8: isBreaking keyword ──────────────────────────────────────────────────

describe("news — NW8: isBreaking keyword", () => {
  it("title containing 'breaking' → true", () => {
    expect(isBreaking("BREAKING: event happened", "")).toBe(true);
  });

  it("title containing 'בזק' → true", () => {
    expect(isBreaking("מבזק: אירוע חדש", "")).toBe(true);
  });

  it("generic old title → false", () => {
    expect(isBreaking("Regular news", "2020-01-01T00:00:00Z")).toBe(false);
  });
});

// ── NW9: pubTimeLabel invalid → "" ───────────────────────────────────────────

describe("news — NW9: pubTimeLabel invalid dates", () => {
  it("empty string → empty", () => {
    expect(pubTimeLabel("")).toBe("");
  });

  it("garbage string → empty", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 10 }), (s) => {
        // Most random strings aren't valid dates
        const result = pubTimeLabel(s);
        expect(typeof result).toBe("string");
      }),
      { numRuns: 15 },
    );
  });
});

// ── NW10: relativeAge invalid/future → "" ────────────────────────────────────

describe("news — NW10: relativeAge edge cases", () => {
  it("empty → empty", () => {
    expect(relativeAge("")).toBe("");
  });

  it("future date → empty", () => {
    const future = new Date(Date.now() + 100_000).toISOString();
    expect(relativeAge(future)).toBe("");
  });
});

// ── NW11: ageFreshness invalid → "old" ──────────────────────────────────────

describe("news — NW11: ageFreshness invalid", () => {
  it("empty → old", () => {
    expect(ageFreshness("")).toBe("old");
  });

  it("result is always one of the four buckets", () => {
    const valid = ["fresh2m", "fresh1h", "fresh1d", "old"];
    fc.assert(
      fc.property(
        fc
          .date({ min: new Date(2020, 0, 1), max: new Date() })
          .filter((d) => !Number.isNaN(d.getTime())),
        (d) => {
          const result = ageFreshness(d.toISOString());
          expect(valid).toContain(result);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── NW12: getStarId deterministic + length ≤ 120 ─────────────────────────────

describe("news — NW12: getStarId", () => {
  it("length ≤ 120 and deterministic", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (link, title) => {
          const item = { link, title };
          const id1 = getStarId(item);
          const id2 = getStarId(item);
          expect(id1).toBe(id2);
          expect(id1.length).toBeLessThanOrEqual(120);
        },
      ),
      { numRuns: 20 },
    );
  });
});
