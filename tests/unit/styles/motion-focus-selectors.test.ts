/**
 * Regression coverage for keyboard-friendly auto-scroll pause behavior.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const componentsCss = readFileSync(
  resolve(__dirname, "../../../src/styles/components.css"),
  "utf-8",
);
const baseCss = readFileSync(resolve(__dirname, "../../../src/styles/base.css"), "utf-8");
const tasksCss = readFileSync(resolve(__dirname, "../../../src/cards/tasks/tasks.css"), "utf-8");

describe("auto-scroll focus pause selectors", () => {
  it("pauses news, stocks, and alert loops while a descendant has focus", () => {
    expect(componentsCss).toMatch(/\.rss-scroll:hover,\s*\.rss-scroll:focus-within\s*\{/);
    expect(componentsCss).toMatch(/\.stocks-scroll:hover,\s*\.stocks-scroll:focus-within\s*\{/);
    expect(componentsCss).toMatch(/\.alerts-scroll:hover,\s*\.alerts-scroll:focus-within\s*\{/);
  });

  it("pauses the ticker and task loops while a descendant has focus", () => {
    expect(baseCss).toMatch(/\.ticker-content:hover,\s*\.ticker-content:focus-within\s*\{/);
    expect(tasksCss).toMatch(/\.tasks-list:hover,\s*\.tasks-list:focus-within\s*\{/);
  });
});
