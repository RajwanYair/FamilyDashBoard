/**
 * WCAG 1.4.12 Text Spacing — Y-1
 *
 * Verifies that:
 * 1. tokens.css declares the four required text-spacing custom properties
 *    at the minimum values mandated by WCAG 2.1 SC 1.4.12 (AA).
 * 2. a11y.css contains a `.text-spacing-override` block that applies them.
 *
 * WCAG 1.4.12 minimum overrides:
 *   line-height        ≥ 1.5 × font-size
 *   letter-spacing     ≥ 0.12 × font-size
 *   word-spacing       ≥ 0.16 × font-size
 *   paragraph-spacing  ≥ 2 × font-size
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tokensCSS = readFileSync(resolve(__dirname, "../../../src/styles/tokens.css"), "utf-8");
const a11yCSS = readFileSync(resolve(__dirname, "../../../src/styles/a11y.css"), "utf-8");

// ── tokens.css — token declarations ──────────────────────────────────────────

describe("WCAG 1.4.12 — tokens.css declares text-spacing tokens", () => {
  it("declares --ts-line-height with value 1.5", () => {
    expect(tokensCSS).toMatch(/--ts-line-height\s*:\s*1\.5/);
  });

  it("declares --ts-letter-spacing with value 0.12em", () => {
    expect(tokensCSS).toMatch(/--ts-letter-spacing\s*:\s*0\.12em/);
  });

  it("declares --ts-word-spacing with value 0.16em", () => {
    expect(tokensCSS).toMatch(/--ts-word-spacing\s*:\s*0\.16em/);
  });

  it("declares --ts-paragraph-spacing with value 2em", () => {
    expect(tokensCSS).toMatch(/--ts-paragraph-spacing\s*:\s*2em/);
  });
});

// ── a11y.css — override class applies tokens ─────────────────────────────────

describe("WCAG 1.4.12 — a11y.css defines .text-spacing-override", () => {
  it("defines .text-spacing-override selector", () => {
    expect(a11yCSS).toContain(".text-spacing-override");
  });

  it("applies line-height via --ts-line-height token", () => {
    expect(a11yCSS).toMatch(/line-height\s*:\s*var\(--ts-line-height[^)]*\)/);
  });

  it("applies letter-spacing via --ts-letter-spacing token", () => {
    expect(a11yCSS).toMatch(/letter-spacing\s*:\s*var\(--ts-letter-spacing[^)]*\)/);
  });

  it("applies word-spacing via --ts-word-spacing token", () => {
    expect(a11yCSS).toMatch(/word-spacing\s*:\s*var\(--ts-word-spacing[^)]*\)/);
  });

  it("applies paragraph spacing via --ts-paragraph-spacing token", () => {
    expect(a11yCSS).toMatch(/margin-block-end\s*:\s*var\(--ts-paragraph-spacing[^)]*\)/);
  });

  it("override block is inside @layer base", () => {
    // The block must be inside a @layer base rule to respect CSS layer ordering
    expect(a11yCSS).toMatch(/@layer\s+base\s*\{[^}]*\.text-spacing-override/s);
  });
});

// ── Token numeric value assertions ────────────────────────────────────────────

describe("WCAG 1.4.12 — token values meet WCAG 2.1 SC 1.4.12 minimums", () => {
  it("line-height token ≥ 1.5", () => {
    const m = tokensCSS.match(/--ts-line-height\s*:\s*([\d.]+)/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(1.5);
  });

  it("letter-spacing token ≥ 0.12em", () => {
    const m = tokensCSS.match(/--ts-letter-spacing\s*:\s*([\d.]+)em/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(0.12);
  });

  it("word-spacing token ≥ 0.16em", () => {
    const m = tokensCSS.match(/--ts-word-spacing\s*:\s*([\d.]+)em/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(0.16);
  });

  it("paragraph-spacing token ≥ 2em", () => {
    const m = tokensCSS.match(/--ts-paragraph-spacing\s*:\s*([\d.]+)em/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(2);
  });
});

// ── WCAG 3.1.5 Reading Level ─────────────────────────────────────────────────

describe("WCAG 3.1.5 — tokens.css declares --reading-lh and a11y.css applies it", () => {
  it("tokens.css declares --reading-lh for prose reading comfort", () => {
    expect(tokensCSS).toMatch(/--reading-lh\s*:\s*[\d.]+/);
  });

  it("--reading-lh value is ≥ 1.5 (cognitively accessible for RTL prose)", () => {
    const m = tokensCSS.match(/--reading-lh\s*:\s*([\d.]+)/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeGreaterThanOrEqual(1.5);
  });

  it("a11y.css applies --reading-lh to prose selectors", () => {
    expect(a11yCSS).toMatch(/line-height\s*:\s*var\(--reading-lh[^)]*\)/);
  });

  it("a11y.css covers motivation text (.moti-text)", () => {
    expect(a11yCSS).toContain(".moti-text");
  });

  it("a11y.css covers news description (.news-desc)", () => {
    expect(a11yCSS).toContain(".news-desc");
  });

  it("a11y.css covers Hebrew calendar parasha text (.hcal-parasha-text)", () => {
    expect(a11yCSS).toContain(".hcal-parasha-text");
  });

  it("reading-lh block is inside @layer base", () => {
    expect(a11yCSS).toMatch(/@layer\s+base\s*\{[^}]*\.moti-text/s);
  });
});
