import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../../src/ui/header.css"), "utf-8");

describe("header notification touch target", () => {
  it("keeps the notification permission control touch-sized", () => {
    const block = css.match(/#notif-bell\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(block).toContain("min-block-size: 2.75rem");
    expect(block).toContain("touch-action: manipulation");
  });
});
