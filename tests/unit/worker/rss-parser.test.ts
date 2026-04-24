/**
 * Tests for worker/src/utils/rss-parser.ts (v11.0-DATA-1)
 */

import { describe, it, expect } from "vitest";
import { parseRss } from "../../../worker/src/utils/rss-parser";

const RSS2_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>First Article Title</title>
      <link>https://example.com/1</link>
      <pubDate>Mon, 01 Apr 2026 10:00:00 +0200</pubDate>
      <description>&lt;p&gt;Short description here&lt;/p&gt;</description>
    </item>
    <item>
      <title><![CDATA[Second Article & Entities]]></title>
      <link>https://example.com/2</link>
      <pubDate>Mon, 01 Apr 2026 09:00:00 +0200</pubDate>
    </item>
    <item>
      <title>Third Article</title>
      <link>https://example.com/3</link>
      <pubDate>Sun, 31 Mar 2026 08:00:00 +0200</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Entry One</title>
    <link href="https://example.com/atom/1" rel="alternate"/>
    <published>2026-04-01T10:00:00Z</published>
    <summary>Summary text here</summary>
  </entry>
  <entry>
    <title>Atom Entry Two</title>
    <link href="https://example.com/atom/2" rel="alternate"/>
    <updated>2026-04-01T09:00:00Z</updated>
  </entry>
</feed>`;

describe("parseRss — RSS 2.0", () => {
  it("parses all 3 items", () => {
    const items = parseRss(RSS2_XML, "Test Feed");
    expect(items).toHaveLength(3);
  });

  it("extracts title, link, pubDate, source", () => {
    const [first] = parseRss(RSS2_XML, "My Source");
    expect(first.title).toBe("First Article Title");
    expect(first.link).toBe("https://example.com/1");
    expect(first.pubDate).toContain("Apr 2026");
    expect(first.source).toBe("My Source");
  });

  it("handles CDATA in title", () => {
    const items = parseRss(RSS2_XML, "Test Feed");
    expect(items[1].title).toBe("Second Article & Entities");
  });

  it("decodes HTML entities in description", () => {
    const [first] = parseRss(RSS2_XML, "Test Feed");
    // description with <p> stripped
    expect(first.description).toContain("Short description here");
    expect(first.description).not.toContain("<p>");
  });

  it("respects the limit parameter", () => {
    const items = parseRss(RSS2_XML, "Test Feed", 2);
    expect(items).toHaveLength(2);
  });

  it("returns [] for empty XML", () => {
    expect(parseRss("", "Test")).toHaveLength(0);
  });

  it("returns [] for non-RSS XML", () => {
    expect(parseRss("<root><data>hello</data></root>", "Test")).toHaveLength(0);
  });
});

describe("parseRss — Atom 1.0", () => {
  it("parses atom entries when no <item> elements are found", () => {
    const items = parseRss(ATOM_XML, "Atom Feed");
    expect(items).toHaveLength(2);
  });

  it("extracts href from atom link element", () => {
    const [first] = parseRss(ATOM_XML, "Atom Feed");
    expect(first.link).toBe("https://example.com/atom/1");
    expect(first.title).toBe("Atom Entry One");
  });

  it("uses published date for atom entries", () => {
    const [first] = parseRss(ATOM_XML, "Atom Feed");
    expect(first.pubDate).toContain("2026-04-01");
  });

  it("uses updated date when published is absent", () => {
    const items = parseRss(ATOM_XML, "Atom Feed");
    expect(items[1].pubDate).toContain("2026-04-01T09");
  });

  it("extracts summary as description", () => {
    const [first] = parseRss(ATOM_XML, "Atom Feed");
    expect(first.description).toContain("Summary text here");
  });
});

describe("parseRss — entity decoding", () => {
  const ENTITY_XML = `<rss><channel><item>
    <title>A &amp; B &lt;test&gt; &quot;quoted&quot; &#39;apos&#39;</title>
    <link>https://example.com</link><pubDate></pubDate>
  </item></channel></rss>`;

  it("decodes all common entities", () => {
    const [item] = parseRss(ENTITY_XML, "Test");
    expect(item.title).toBe(`A & B <test> "quoted" 'apos'`);
  });

  it("decodes &nbsp; entity to a space", () => {
    const xml = `<rss><channel><item>
      <title>Hello&nbsp;World</title>
      <link>https://example.com</link>
    </item></channel></rss>`;
    const [item] = parseRss(xml, "Test");
    expect(item.title).toBe("Hello World");
  });

  it("decodes numeric decimal entities like &#65; (= A)", () => {
    const xml = `<rss><channel><item>
      <title>&#72;&#101;&#108;&#108;&#111;</title>
      <link>https://example.com</link>
    </item></channel></rss>`;
    const [item] = parseRss(xml, "Test");
    expect(item.title).toBe("Hello");
  });

  it("decodes numeric hex entities like &#x41; (= A)", () => {
    const xml = `<rss><channel><item>
      <title>&#x48;&#x65;&#x6C;&#x6C;&#x6F;</title>
      <link>https://example.com</link>
    </item></channel></rss>`;
    const [item] = parseRss(xml, "Test");
    expect(item.title).toBe("Hello");
  });
});
