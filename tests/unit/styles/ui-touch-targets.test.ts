import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readCss(relativePath: string): string {
  return readFileSync(resolve(__dirname, "../../../src", relativePath), "utf-8");
}

function selectorBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g")))
    .map((match) => match[1] ?? "")
    .join("\n");
}

describe("utility UI touch-target contracts", () => {
  it("keeps PWA installation and update actions touch-sized", () => {
    const statusBar = readCss("ui/status-bar.css");
    const components = readCss("styles/components.css");

    expect(selectorBlock(statusBar, "#pwa-install-btn")).toContain("min-block-size: 2.75rem");
    expect(selectorBlock(statusBar, "#pwa-install-btn")).toContain("touch-action: manipulation");
    expect(selectorBlock(components, "#sw-update-reload-btn")).toContain("min-block-size: 2.75rem");
    expect(selectorBlock(components, "#sw-update-reload-btn")).toContain(
      "touch-action: manipulation",
    );
  });
});
