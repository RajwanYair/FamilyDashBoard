import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readCss(relativePath: string): string {
  return readFileSync(resolve(__dirname, "../../../src", relativePath), "utf-8");
}

function selectorBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("card secondary text contrast", () => {
  it("does not fade alert status text", () => {
    const css = readCss("cards/alerts/alerts.css");

    expect(selectorBlock(css, ".alerts-takeover-threat")).not.toMatch(/opacity\s*:/);
    expect(selectorBlock(css, ".alerts-takeover-countdown")).not.toMatch(/opacity\s*:/);
    expect(selectorBlock(css, ".alert-age")).not.toMatch(/opacity\s*:/);
  });

  it("does not fade task hierarchy text", () => {
    const css = readCss("cards/tasks/tasks.css");

    expect(selectorBlock(css, ".tasks-subtask")).not.toMatch(/opacity\s*:/);
    const doneBlock = selectorBlock(css, ".tasks-row.done .tasks-chore");
    expect(doneBlock).not.toMatch(/opacity\s*:/);
    expect(doneBlock).toContain("color: var(--text-muted)");
  });

  it("does not fade stock context labels", () => {
    const css = readCss("cards/stocks/stocks.css");

    expect(selectorBlock(css, ".stk-sector-hdr")).not.toMatch(/opacity\s*:/);
    expect(selectorBlock(css, ".stk-after-price .after-lbl")).not.toMatch(/opacity\s*:/);
  });
});
