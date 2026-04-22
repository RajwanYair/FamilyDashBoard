/**
 * Sprint 113 — Theme audit: verify all 6 themes define required CSS properties
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { THEMES } from "@/core/constants";

const css = readFileSync(resolve(__dirname, "../../../src/styles/themes.css"), "utf-8");

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
