/**
 * Unit tests — Y: Dialog heading hierarchy
 *
 * Checks that:
 *   - Every <dialog> has aria-labelledby pointing to an element with that id
 *   - The config-overlay <div> carries role="dialog", aria-modal, and aria-labelledby
 *   - The diagnostic dialog title uses <h2>, not <h3> or <h1>
 *   - All dialog title headings are h2 (correct level within a dialog landmark)
 *   - No aria-labelledby target is missing from the DOM
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");
const HTML = readFileSync(resolve(ROOT, "src", "index.html"), "utf8");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return all values of a given attribute in the document. */
function attrValues(attr: string): string[] {
  const re = new RegExp(`${attr}="([^"]+)"`, "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(HTML)) !== null) out.push(m[1]);
  return out;
}

/** Return ids of all elements that exist in the HTML. */
function allIds(): Set<string> {
  const re = /\bid="([^"]+)"/g;
  const ids = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(HTML)) !== null) ids.add(m[1]);
  return ids;
}

// ── Config overlay ────────────────────────────────────────────────────────────

describe("config-overlay ARIA attributes (Y)", () => {
  it('has role="dialog"', () => {
    expect(HTML).toMatch(
      /id="config-overlay"[^>]*role="dialog"|role="dialog"[^>]*id="config-overlay"/,
    );
  });

  it('has aria-modal="true"', () => {
    expect(HTML).toMatch(
      /id="config-overlay"[^>]*aria-modal="true"|aria-modal="true"[^>]*id="config-overlay"/,
    );
  });

  it("has aria-labelledby pointing to cfg-panel-title", () => {
    expect(HTML).toMatch(/aria-labelledby="cfg-panel-title"/);
  });

  it("cfg-panel-title element exists in DOM", () => {
    expect(allIds()).toContain("cfg-panel-title");
  });

  it("cfg-panel-title is an h2 element", () => {
    expect(HTML).toMatch(/<h2[^>]*id="cfg-panel-title"|<h2 id="cfg-panel-title"/);
  });
});

// ── Dialog elements ───────────────────────────────────────────────────────────

describe("<dialog> elements heading hierarchy (Y)", () => {
  it("diag-overlay dialog uses h2 as title (not h3 or h1)", () => {
    // Should NOT have h3 with diag-dialog-title
    expect(HTML).not.toMatch(/<h3[^>]*id="diag-dialog-title"/);
    // Should have h2 with diag-dialog-title
    expect(HTML).toMatch(/<h2[^>]*id="diag-dialog-title"/);
  });

  it("tour-overlay dialog uses h2 as title", () => {
    expect(HTML).toMatch(/<h2[^>]*id="tour-dialog-title"|<h2 id="tour-dialog-title"/);
  });

  it("help-overlay dialog uses h2 as title", () => {
    expect(HTML).toMatch(/<h2[^>]*id="help-dialog-title"|<h2 id="help-dialog-title"/);
  });

  it("tour-overlay has aria-labelledby", () => {
    expect(HTML).toMatch(
      /id="tour-overlay"[^>]*aria-labelledby=|aria-labelledby=[^>]*id="tour-overlay"/,
    );
  });

  it("help-overlay has aria-labelledby", () => {
    expect(HTML).toMatch(
      /id="help-overlay"[^>]*aria-labelledby=|aria-labelledby=[^>]*id="help-overlay"/,
    );
  });

  it("diag-overlay has aria-labelledby", () => {
    expect(HTML).toMatch(
      /id="diag-overlay"[^>]*aria-labelledby=|aria-labelledby=[^>]*id="diag-overlay"/,
    );
  });
});

// ── aria-labelledby targets ───────────────────────────────────────────────────

describe("aria-labelledby targets exist in DOM (Y)", () => {
  const KNOWN_LABELLEDBY = [
    "tour-dialog-title",
    "help-dialog-title",
    "diag-dialog-title",
    "cfg-panel-title",
    "page-heading",
  ];

  const ids = allIds();

  for (const target of KNOWN_LABELLEDBY) {
    it(`element #${target} exists`, () => {
      expect(ids).toContain(target);
    });
  }

  it("no aria-labelledby references a missing id", () => {
    const labelledby = attrValues("aria-labelledby");
    const missingRefs = labelledby.flatMap((v) => v.split(/\s+/).filter((id) => !ids.has(id)));
    expect(missingRefs).toHaveLength(0);
  });
});

// ── Page heading ──────────────────────────────────────────────────────────────

describe("page landmark heading (Y)", () => {
  it("exactly one h1 exists on the page", () => {
    const h1Matches = HTML.match(/<h1[^>]*>/g) ?? [];
    expect(h1Matches).toHaveLength(1);
  });

  it("h1 is sr-only (visually hidden but readable)", () => {
    expect(HTML).toMatch(/<h1 class="sr-only"/);
  });
});
