import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPanel = readFileSync(resolve(__dirname, "../../../src/ui/config-panel.css"), "utf-8");

describe("Settings tab touch-target CSS contract", () => {
  it("keeps tabs keyboard and touch reachable at the minimum target size", () => {
    expect(configPanel).toMatch(
      /\.cfg-tab\s*\{[^}]*min-block-size:\s*2\.75rem[^}]*touch-action:\s*manipulation/s,
    );
    expect(configPanel).toMatch(
      /\.cfg-details-summary\s*\{[^}]*min-block-size:\s*2\.75rem[^}]*touch-action:\s*manipulation/s,
    );
    expect(configPanel).toMatch(
      /\.cfg-search-input\s*\{[^}]*min-block-size:\s*2\.75rem[^}]*touch-action:\s*manipulation/s,
    );
    expect(configPanel).toMatch(
      /\.cfg-card-label\s*\{[^}]*min-block-size:\s*2\.75rem[^}]*touch-action:\s*manipulation/s,
    );
  });
});
