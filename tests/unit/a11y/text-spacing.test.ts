/**
 * Unit tests — V13-A11Y: WCAG 1.4.12 Text Spacing CSS tokens
 *
 * WCAG 2.1 Success Criterion 1.4.12 (Text Spacing) requires that content
 * does not lose functionality when the following are applied:
 *   - Line height ≥ 1.5 × font size
 *   - Letter spacing ≥ 0.12 × font size
 *   - Word spacing ≥ 0.16 × font size
 *   - Paragraph spacing ≥ 2 × font size
 *
 * FamilyDashBoard implements these as CSS custom properties in
 * src/styles/tokens.css so they can be referenced (and optionally
 * overridden) by component CSS without hard-coding the minimum values.
 *
 * These tests verify the token values meet the WCAG AA minimums and
 * that the check-reading-level.mjs script enforces the same thresholds.
 *
 * V13-A11Y
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");

// ── Load CSS source ───────────────────────────────────────────────────────────

let tokensCss = "";

beforeAll(() => {
  tokensCss = readFileSync(resolve(ROOT, "src", "styles", "tokens.css"), "utf8");
});

// ── Token presence ────────────────────────────────────────────────────────────

describe("WCAG 1.4.12 text-spacing tokens: presence (V13-A11Y)", () => {
  it("tokens.css declares --ts-line-height", () => {
    expect(tokensCss).toMatch(/--ts-line-height\s*:/);
  });

  it("tokens.css declares --ts-letter-spacing", () => {
    expect(tokensCss).toMatch(/--ts-letter-spacing\s*:/);
  });

  it("tokens.css declares --ts-word-spacing", () => {
    expect(tokensCss).toMatch(/--ts-word-spacing\s*:/);
  });

  it("tokens.css declares --ts-paragraph-spacing", () => {
    expect(tokensCss).toMatch(/--ts-paragraph-spacing\s*:/);
  });
});

// ── Token minimum values ──────────────────────────────────────────────────────

describe("WCAG 1.4.12 text-spacing tokens: minimum values (V13-A11Y)", () => {
  /** Extract the numeric value of a CSS custom property declaration. */
  function extractTokenValue(property: string): number | null {
    // Match --property: <value>; (ignores trailing comments and semicolons)
    const re = new RegExp(`${property}\\s*:\\s*([\\d.]+)`);
    const m = tokensCss.match(re);
    return m ? parseFloat(m[1]) : null;
  }

  it("--ts-line-height is at least 1.5 (WCAG SC 1.4.12)", () => {
    const val = extractTokenValue("--ts-line-height");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThanOrEqual(1.5);
  });

  it("--ts-letter-spacing is at least 0.12 (WCAG SC 1.4.12)", () => {
    const val = extractTokenValue("--ts-letter-spacing");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThanOrEqual(0.12);
  });

  it("--ts-word-spacing is at least 0.16 (WCAG SC 1.4.12)", () => {
    const val = extractTokenValue("--ts-word-spacing");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThanOrEqual(0.16);
  });

  it("--ts-paragraph-spacing is at least 2.0 (WCAG SC 1.4.12)", () => {
    const val = extractTokenValue("--ts-paragraph-spacing");
    expect(val).not.toBeNull();
    expect(val!).toBeGreaterThanOrEqual(2.0);
  });
});

// ── Unit annotation in source ────────────────────────────────────────────────

describe("WCAG 1.4.12 text-spacing tokens: unit annotations (V13-A11Y)", () => {
  it("--ts-letter-spacing uses 'em' unit (font-relative)", () => {
    expect(tokensCss).toMatch(/--ts-letter-spacing\s*:\s*[\d.]+em/);
  });

  it("--ts-word-spacing uses 'em' unit (font-relative)", () => {
    expect(tokensCss).toMatch(/--ts-word-spacing\s*:\s*[\d.]+em/);
  });

  it("--ts-paragraph-spacing uses 'em' unit (font-relative)", () => {
    expect(tokensCss).toMatch(/--ts-paragraph-spacing\s*:\s*[\d.]+em/);
  });

  it("--ts-line-height is a unitless ratio (per CSS spec for line-height)", () => {
    // line-height: 1.5 (no unit) is the correct CSS form — do NOT use 1.5em
    expect(tokensCss).toMatch(/--ts-line-height\s*:\s*[\d.]+\s*[;/]/);
    expect(tokensCss).not.toMatch(/--ts-line-height\s*:\s*[\d.]+em/);
  });
});

// ── check-reading-level.mjs thresholds ───────────────────────────────────────

describe("check-reading-level.mjs: validates WCAG 1.4.12 thresholds (V13-A11Y)", () => {
  let scriptSrc = "";

  beforeAll(() => {
    scriptSrc = readFileSync(resolve(ROOT, "scripts", "check-reading-level.mjs"), "utf8");
  });

  it("script checks --ts-line-height with min 1.5", () => {
    expect(scriptSrc).toMatch(/--ts-line-height/);
    expect(scriptSrc).toMatch(/1\.5/);
  });

  it("script checks --ts-letter-spacing with min 0.12", () => {
    expect(scriptSrc).toMatch(/--ts-letter-spacing/);
    expect(scriptSrc).toMatch(/0\.12/);
  });

  it("script checks --ts-word-spacing with min 0.16", () => {
    expect(scriptSrc).toMatch(/--ts-word-spacing/);
    expect(scriptSrc).toMatch(/0\.16/);
  });
});
