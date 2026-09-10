import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../../src/cards/news/news.css"), "utf-8");

function selectorBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("news age and visited state contrast", () => {
  it("does not reduce the contrast of visited article content with opacity", () => {
    const block = selectorBlock(".rss-item.visited");

    expect(block).not.toMatch(/opacity\s*:/);
    expect(block).toContain("border-inline-end-color: var(--text-muted)");
  });

  it("uses explicit border tokens for stale article states", () => {
    expect(selectorBlock(".rss-item.stale-half")).toContain(
      "border-inline-end-color: var(--warning)",
    );
    expect(selectorBlock(".rss-item.stale-day")).toContain(
      "border-inline-end-color: var(--text-muted)",
    );
    expect(selectorBlock(".rss-item.stale-old")).toContain(
      "border-inline-end-color: var(--text-secondary)",
    );
    expect(css).not.toMatch(/\.rss-item\.stale-(?:half|day|old)\s*\{[^}]*opacity\s*:/s);
  });

  it("keeps hover-revealed article actions visible to keyboard users", () => {
    expect(css).toMatch(
      /\.news-copy:focus-visible,\s*\.news-share:focus-visible\s*\{[^}]*opacity:\s*1[^}]*outline:\s*2px\s+solid\s+var\(--accent\)/s,
    );
  });
});
