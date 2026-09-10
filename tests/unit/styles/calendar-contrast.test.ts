/**
 * Calendar CSS — empty-day contrast regression (S04-01).
 *
 * Empty tiles remain visually distinct without fading their day headers or
 * weakening today's accent when today has no events.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(__dirname, "../../../src/cards/calendar/calendar.css"),
  "utf-8",
);

function extractBlock(selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) return "";
  const braceStart = css.indexOf("{", start);
  const braceEnd = css.indexOf("}", braceStart);
  return css.slice(braceStart, braceEnd + 1);
}

describe("Calendar CSS — empty-day tile contrast (S04-01)", () => {
  it("does not dim the whole empty-day tile via opacity", () => {
    const block = extractBlock(".cal-day-tile.is-empty {");
    expect(block).not.toBe("");
    expect(block).not.toMatch(/opacity\s*:/);
  });

  it("differentiates empty tiles through surface tokens", () => {
    const block = extractBlock(".cal-day-tile.is-empty {");
    expect(block).toMatch(/background/);
    expect(block).toMatch(/border-color/);
  });

  it("keeps today's accent highlight when today has no events", () => {
    const block = extractBlock(".cal-day-tile.is-today.is-empty {");
    expect(block).not.toBe("");
    expect(block).toContain("var(--accent)");
  });
});
