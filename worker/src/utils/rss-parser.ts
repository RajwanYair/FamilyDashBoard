/**
 * FamilyDashBoard Worker — Lightweight RSS 2.0 / Atom 1.0 parser
 *
 * Uses regex-based extraction (no DOMParser — not available in CF Workers).
 * Handles:
 *   - RSS 2.0: <item>…</item> blocks with <title>, <link>, <pubDate>
 *   - Atom 1.0: <entry>…</entry> blocks with <title>, <link href>, <published>
 *   - CDATA sections in title / description
 *   - Common HTML entities
 *
 * Returns at most `limit` items per feed (default 25).
 */

export interface ParsedItem {
  title: string;
  link: string;
  pubDate: string; // raw date string (RFC 2822 or ISO 8601)
  source: string; // feed display name
  description?: string;
}

const CDATA_RE = /<!\[CDATA\[([\s\S]*?)]]>/;

/** Extract text content from an XML element, handling CDATA. */
function extractText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, "i");
  const m = block.match(re);
  if (!m || m[1] === undefined) return "";
  const inner = m[1].trim();
  const cdata = inner.match(CDATA_RE);
  const raw = cdata !== null && cdata[1] !== undefined ? cdata[1] : inner;
  return decodeEntities(raw.trim());
}

/** Extract the href attribute from an Atom <link href="…" /> element. */
function extractAtomLink(block: string): string {
  const m = block.match(/<link[^>]+href\s*=\s*["']([^"'>]+)["'][^>]*\/?>/i);
  if (!m || m[1] === undefined) return "";
  return m[1].trim();
}

/** Decode the most common XML/HTML entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([\da-fA-F]+);/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .trim();
}

/** Strip HTML tags from a description snippet. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .trim()
    .slice(0, 200);
}

/**
 * Parse RSS 2.0 or Atom 1.0 XML text into ParsedItem[].
 * @param xml   Raw XML text of the feed
 * @param src   Display name for the source (e.g. "Ynet מבזקים")
 * @param limit Max items to return per feed (default 25)
 */
export function parseRss(xml: string, src: string, limit = 25): ParsedItem[] {
  const items: ParsedItem[] = [];

  // RSS 2.0 — extract <item>…</item> blocks
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const block = m[1] ?? "";
    const title = extractText(block, "title");
    if (!title) continue;
    // <link> in RSS is text content, NOT an attribute
    const linkText = extractText(block, "link");
    const link = linkText || extractAtomLink(block);
    const pubDate = extractText(block, "pubDate") || extractText(block, "dc:date");
    const desc = extractText(block, "description");
    items.push({ title, link, pubDate, source: src, description: stripTags(desc) || undefined });
  }

  if (items.length > 0) return items;

  // Atom 1.0 — extract <entry>…</entry> blocks
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null && items.length < limit) {
    const block = m[1] ?? "";
    const title = extractText(block, "title");
    if (!title) continue;
    const link = extractAtomLink(block) || extractText(block, "link");
    const pubDate =
      extractText(block, "published") ||
      extractText(block, "updated") ||
      extractText(block, "dc:date");
    const desc = extractText(block, "summary") || extractText(block, "content");
    items.push({ title, link, pubDate, source: src, description: stripTags(desc) || undefined });
  }

  return items;
}
