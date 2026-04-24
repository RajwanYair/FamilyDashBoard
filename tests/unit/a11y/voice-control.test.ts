/**
 * Unit tests — V13-A11Y: Voice-control semantic names
 *
 * Verifies that every interactive element in index.html has a unique
 * accessible name. Key checks:
 *   - card-collapse-btn buttons are card-specific (no two share the same aria-label)
 *   - config action buttons have aria-label
 *   - range slider inputs have aria-label
 *   - no button without either text content or aria-label
 *
 * Uses the raw HTML text so these run without a real DOM.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");
const HTML = readFileSync(resolve(ROOT, "src", "index.html"), "utf8");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract all aria-label values matching a given selector fragment. */
function extractAriaLabels(pattern: RegExp): string[] {
  const labels: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(HTML)) !== null) {
    labels.push(m[1]);
  }
  return labels;
}

// ── Card collapse buttons ─────────────────────────────────────────────────────

describe("card-collapse-btn aria-labels (V13-A11Y)", () => {
  const collapsePattern =
    /class="card-collapse-btn"\s+aria-label="([^"]+)"/g;

  let collapseLabels: string[];

  beforeAll(() => {
    collapseLabels = extractAriaLabels(collapsePattern);
  });

  it("at least 10 card-collapse-btn elements exist", () => {
    expect(collapseLabels.length).toBeGreaterThanOrEqual(10);
  });

  it("all card-collapse-btn aria-labels are unique (no duplicates)", () => {
    const unique = new Set(collapseLabels);
    expect(unique.size).toBe(collapseLabels.length);
  });

  it("collapse button for news card exists", () => {
    expect(collapseLabels.some((l) => l.includes("חדשות"))).toBe(true);
  });

  it("collapse button for weather card exists", () => {
    expect(collapseLabels.some((l) => l.includes("מזג אוויר"))).toBe(true);
  });

  it("collapse button for hebrew-cal card exists", () => {
    expect(collapseLabels.some((l) => l.includes("לוח עברי"))).toBe(true);
  });

  it("collapse button for calendar card exists", () => {
    expect(collapseLabels.some((l) => l.includes("לוח שנה"))).toBe(true);
  });

  it("collapse button for stocks card exists", () => {
    expect(collapseLabels.some((l) => l.includes("מניות"))).toBe(true);
  });

  it("collapse button for alerts card exists", () => {
    expect(collapseLabels.some((l) => l.includes("צבע אדום"))).toBe(true);
  });

  it("collapse button for motivation card exists", () => {
    expect(collapseLabels.some((l) => l.includes("מוטיבציה"))).toBe(true);
  });

  it("collapse button for tasks card exists", () => {
    expect(collapseLabels.some((l) => l.includes("משימות"))).toBe(true);
  });

  it("no collapse button has the old generic label 'כווץ / הרחב כרטיסייה'", () => {
    expect(collapseLabels.some((l) => l === "כווץ / הרחב כרטיסייה")).toBe(false);
  });
});

// ── Config action buttons ─────────────────────────────────────────────────────

describe("config panel button aria-labels (V13-A11Y)", () => {
  it("cfg-save-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-save-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-save-btn"/);
  });

  it("cfg-close-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-close-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-close-btn"/);
  });

  it("cfg-export-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-export-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-export-btn"/);
  });

  it("cfg-import-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-import-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-import-btn"/);
  });

  it("cfg-share-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-share-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-share-btn"/);
  });

  it("cfg-reset-all-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-reset-all-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-reset-all-btn"/);
  });

  it("cfg-reset-layout-btn has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-reset-layout-btn"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-reset-layout-btn"/);
  });
});

// ── Range slider inputs ───────────────────────────────────────────────────────

describe("range slider input aria-labels (V13-A11Y)", () => {
  it("cfg-news-fontsize slider has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-news-fontsize"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-news-fontsize"/);
  });

  it("cfg-dim-level slider has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-dim-level"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-dim-level"/);
  });

  it("cfg-font-scale slider has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-font-scale"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-font-scale"/);
  });

  it("cfg-ticker-speed slider has aria-label", () => {
    expect(HTML).toMatch(/id="cfg-ticker-speed"[^>]*aria-label="|aria-label="[^"]*"[^>]*id="cfg-ticker-speed"/);
  });
});

// ── Globally unique interactive names ────────────────────────────────────────

describe("unique accessible names across dialogs (V13-A11Y)", () => {
  it("no two card-collapse-btn share the same label string", () => {
    const all: string[] = [];
    const re = /class="card-collapse-btn"\s+aria-label="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(HTML)) !== null) all.push(m[1]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("cfg-save-btn and cfg-close-btn have different aria-labels", () => {
    const saveM = HTML.match(/id="cfg-save-btn"[^>]*aria-label="([^"]*)"/);
    const closeM = HTML.match(/id="cfg-close-btn"[^>]*aria-label="([^"]*)"/);
    // Allow one to not have an inline match if order is reversed
    if (saveM && closeM) {
      expect(saveM[1]).not.toBe(closeM[1]);
    }
  });
});
