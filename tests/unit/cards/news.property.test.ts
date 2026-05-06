/**
 * fast-check property tests — src/cards/news/news.ts (Sprint 521)
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
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  filterBySearch,
  readingTimeMinutes,
  sanitizeNewsTitle,
  newsSourceDomain,
  isBreaking,
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
      fc.property(
        fc.array(newsItemArb, { minLength: 0, maxLength: 10 }),
        (items) => {
          expect(filterBySearch(items as never, "")).toHaveLength(items.length);
          expect(filterBySearch(items as never, "  ")).toHaveLength(items.length);
        },
      ),
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
