/**
 * CSS @scope isolation audit — FamilyDashBoard (ADR-022)
 *
 * Verifies that scope.css:
 *  1. Contains exactly one @scope block per registered card ID
 *  2. Uses the canonical `data-card-id` attribute selector form
 *  3. Does not double-declare any card scope
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../../../src/styles/scope.css");
const css = readFileSync(ROOT, "utf-8");

/** All canonical card IDs as defined by the card registry. */
const CARD_IDS = [
  "news",
  "weather",
  "stocks",
  "currency",
  "hebrew-cal",
  "calendar",
  "alerts",
  "motivation",
  "tasks",
  "countdown",
  "system-info",
] as const;

/** Strip block comments from CSS source. */
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Extract every @scope selector from the file (comments stripped first). */
function extractScopeSelectors(source: string): string[] {
  const stripped = stripBlockComments(source);
  const re = /@scope\s*\(\s*([^)]+)\s*\)/g;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

describe("CSS @scope coverage (ADR-022)", () => {
  const selectors = extractScopeSelectors(css);

  it("file exists and is non-empty", () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it("extracts at least one @scope rule", () => {
    expect(selectors.length).toBeGreaterThan(0);
  });

  for (const id of CARD_IDS) {
    const expected = `[data-card-id="${id}"]`;

    it(`has @scope block for card "${id}"`, () => {
      expect(selectors).toContain(expected);
    });
  }

  it("uses data-card-id attribute selector form exclusively", () => {
    for (const sel of selectors) {
      expect(sel).toMatch(/^\[data-card-id="[a-z-]+"\]$/);
    }
  });

  it("does not declare any card scope more than once", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const sel of selectors) {
      if (seen.has(sel)) duplicates.push(sel);
      seen.add(sel);
    }
    expect(duplicates).toEqual([]);
  });

  it("all @scope blocks are inside @layer components", () => {
    // Crude structural check: every @scope must appear after '@layer components {'
    const stripped = stripBlockComments(css);
    const layerIdx = stripped.indexOf("@layer components {");
    expect(layerIdx).toBeGreaterThan(-1);
    for (const sel of selectors) {
      const scopeIdx = stripped.indexOf(`@scope (${sel})`);
      expect(scopeIdx).toBeGreaterThan(layerIdx);
    }
  });
});
