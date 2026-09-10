import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const screenModes = readFileSync(
  resolve(__dirname, "../../../src/styles/screen-modes.css"),
  "utf-8",
);
const scroll = readFileSync(resolve(__dirname, "../../../src/styles/scroll.css"), "utf-8");

describe("Screen-mode CSS selectors match the runtime body class (S04-01)", () => {
  it("targets screen-tv/tablet/phone, not the dead mode-* class", () => {
    expect(screenModes).toMatch(/body\.screen-tv\b/);
    expect(screenModes).toMatch(/body\.screen-tablet\b/);
    expect(screenModes).toMatch(/body\.screen-phone\b/);
    expect(screenModes).not.toMatch(/body\.mode-(tv|tablet|phone)\b/);
  });

  it("targets screen-phone for phone scroll-snap rules", () => {
    expect(scroll).toMatch(/body\.screen-phone \.grids-area/);
    expect(scroll).toMatch(/body\.screen-phone \.card\b/);
    expect(scroll).not.toMatch(/body\.mode-phone\b/);
  });
});
