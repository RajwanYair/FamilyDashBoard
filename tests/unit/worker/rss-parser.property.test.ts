/**
 * fast-check property tests — worker/src/utils/rss-parser.ts (Sprint 508)
 *
 * Properties under test:
 *  RSS1. parseRss returns at most `limit` items.
 *  RSS2. Each item has non-empty title.
 *  RSS3. Source field equals the provided src string.
 *  RSS4. Empty/malformed XML returns empty array (no throws).
 *  RSS5. CDATA content is correctly extracted.
 *  RSS6. HTML entities are decoded (&amp; → &, etc.).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseRss } from "../../../worker/src/utils/rss-parser";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildRssXml(items: Array<{ title: string; link?: string; pubDate?: string }>): string {
  const itemsXml = items
    .map(
      (i) =>
        `<item><title>${i.title}</title><link>${i.link ?? "https://example.com"}</link><pubDate>${i.pubDate ?? "Mon, 01 Jan 2024 00:00:00 GMT"}</pubDate></item>`,
    )
    .join("\n");
  return `<?xml version="1.0"?><rss version="2.0"><channel>${itemsXml}</channel></rss>`;
}

// ── Arbitraries ───────────────────────────────────────────────────────────────

const titleArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !s.includes("<") && !s.includes(">") && s.trim().length > 0);
const srcArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

// ── RSS1: max limit items ────────────────────────────────────────────────────

describe("rss-parser — RSS1: respects limit", () => {
  it("returns at most limit items", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.array(titleArb, { minLength: 1, maxLength: 15 }),
        (limit, titles) => {
          const xml = buildRssXml(titles.map((t) => ({ title: t })));
          const items = parseRss(xml, "test", limit);
          expect(items.length).toBeLessThanOrEqual(limit);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── RSS2: non-empty title ────────────────────────────────────────────────────

describe("rss-parser — RSS2: items have non-empty title", () => {
  it("all parsed items have title", () => {
    fc.assert(
      fc.property(fc.array(titleArb, { minLength: 1, maxLength: 5 }), (titles) => {
        const xml = buildRssXml(titles.map((t) => ({ title: t })));
        const items = parseRss(xml, "src");
        for (const item of items) {
          expect(item.title.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 20 },
    );
  });
});

// ── RSS3: source matches provided src ────────────────────────────────────────

describe("rss-parser — RSS3: source equals provided src", () => {
  it("all items carry the provided source", () => {
    fc.assert(
      fc.property(srcArb, (src) => {
        const xml = buildRssXml([{ title: "Test" }]);
        const items = parseRss(xml, src);
        for (const item of items) {
          expect(item.source).toBe(src);
        }
      }),
      { numRuns: 15 },
    );
  });
});

// ── RSS4: empty/malformed XML → empty array ──────────────────────────────────

describe("rss-parser — RSS4: malformed XML returns empty", () => {
  it("never throws, returns []", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("<item") && !s.includes("<entry")),
        (junk) => {
          const result = parseRss(junk, "src");
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ── RSS5: CDATA extraction ───────────────────────────────────────────────────

describe("rss-parser — RSS5: CDATA content is extracted", () => {
  it("unwraps CDATA from title", () => {
    const xml = buildRssXml([{ title: "<![CDATA[Hello World]]>" }]);
    const items = parseRss(xml, "src");
    expect(items[0]!.title).toBe("Hello World");
  });
});

// ── RSS6: entity decoding ────────────────────────────────────────────────────

describe("rss-parser — RSS6: HTML entities decoded", () => {
  it("decodes &amp; &lt; &gt; &quot;", () => {
    const xml = buildRssXml([{ title: "A &amp; B &lt;C&gt;" }]);
    const items = parseRss(xml, "src");
    expect(items[0]!.title).toBe("A & B <C>");
  });
});
