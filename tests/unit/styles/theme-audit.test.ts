/**
 * Sprint 113 — Theme audit: verify all 6 themes define required CSS properties
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { THEMES } from "@/core/constants";

const css = readFileSync(resolve(__dirname, "../../../src/styles/themes.css"), "utf-8");
const tokensCss = readFileSync(resolve(__dirname, "../../../src/styles/tokens.css"), "utf-8");

/** CSS custom properties every theme MUST define. */
const REQUIRED_PROPS = [
  "--bg-primary",
  "--bg-card",
  "--bg-card-header",
  "--bg-card-inner",
  "--bg-card-hover",
  "--accent",
  "--accent-bright",
  "--accent-glow",
  "--accent-border",
  "--card-border",
  "--bg-gradient-1",
  "--bg-gradient-2",
  "--bg-gradient-3",
  // Semantic status tokens — required for stock/weather colouring
  "--positive",
  "--negative",
  "--warning",
  "--text-muted",
];

function extractThemeBlock(theme: string): string {
  const selector = `body.theme-${theme}`;
  const start = css.indexOf(selector);
  if (start === -1) return "";
  // Find the matching closing brace
  let depth = 0;
  let blockStart = -1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(blockStart, i + 1);
    }
  }
  return "";
}

describe("Theme audit (Sprint 113)", () => {
  for (const theme of THEMES) {
    describe(`theme-${theme}`, () => {
      const block = extractThemeBlock(theme);

      it("exists in themes.css", () => {
        expect(block.length).toBeGreaterThan(0);
      });

      for (const prop of REQUIRED_PROPS) {
        it(`defines ${prop}`, () => {
          expect(block).toContain(prop);
        });
      }
    });
  }
});

// ── V13-DATA: @property registrations + color-scheme ─────────────────────────

describe("tokens.css — @property registrations (V13-DATA)", () => {
  const REGISTERED_PROPS = [
    "--duration-fast",
    "--duration-normal",
    "--duration-slow",
    "--accent",
    "--bg-primary",
    "--bg-card",
    "--text-primary",
    "--text-secondary",
    "--positive",
    "--negative",
    "--bg-card-header",
    "--bg-card-inner",
    "--bg-card-hover",
    "--text-muted",
    "--warning",
    "--accent-bright",
  ];

  for (const prop of REGISTERED_PROPS) {
    it(`registers ${prop} via @property`, () => {
      expect(tokensCss).toContain(`@property ${prop}`);
    });
  }

  it("all @property blocks have syntax, inherits, and initial-value", () => {
    const blocks = tokensCss.match(/@property\s+--[\w-]+\s*\{[^}]+\}/g) ?? [];
    for (const block of blocks) {
      expect(block, `@property block missing syntax: ${block}`).toContain("syntax:");
      expect(block, `@property block missing inherits: ${block}`).toContain("inherits:");
      expect(block, `@property block missing initial-value: ${block}`).toContain("initial-value:");
    }
  });

  it(":root declares color-scheme: dark light", () => {
    expect(tokensCss).toContain("color-scheme: dark light");
  });

  it(":root uses light-dark() for key color tokens (F11)", () => {
    expect(tokensCss).toContain("light-dark(");
    expect(tokensCss).toContain("--bg-primary: light-dark(");
    expect(tokensCss).toContain("--text-primary: light-dark(");
    expect(tokensCss).toContain("--accent: light-dark(");
  });

  it("themes.css locks explicit themes to color-scheme: dark (F11)", () => {
    const themeClasses = ["theme-black", "theme-blue", "theme-matrix", "theme-amber", "theme-purple", "theme-rose"];
    for (const cls of themeClasses) {
      expect(css, `${cls} should be present in themes.css`).toContain(`body.${cls}`);
    }
    // Each theme body block should contain color-scheme: dark
    const blocks = css.match(/body\.theme-\w+\s*\{[^}]+\}/gs) ?? [];
    for (const block of blocks) {
      expect(block, `Theme block missing color-scheme: dark: ${block.slice(0, 80)}`).toContain("color-scheme: dark");
    }
  });
});
