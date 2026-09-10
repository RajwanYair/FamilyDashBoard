import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const componentsCss = readFileSync(
  resolve(__dirname, "../../../src/styles/components.css"),
  "utf-8",
);
const scrollCss = readFileSync(resolve(__dirname, "../../../src/styles/scroll.css"), "utf-8");

describe("CSS performance contracts", () => {
  it("does not promote static chart content with will-change: contents", () => {
    expect(componentsCss).not.toMatch(/\.wx-hourly-chart\s*\{[^}]*will-change\s*:/s);
    expect(scrollCss).not.toMatch(/\.stk-chart\s+svg\s*\{[^}]*will-change\s*:/s);
    expect(scrollCss).not.toContain("will-change: contents");
  });
});
