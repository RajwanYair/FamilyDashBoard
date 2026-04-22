/**
 * Integration: Theme ↔ Config round-trip
 *
 * Tests cross-module behaviour: saving a theme via config, reloading config,
 * and confirming applyTheme() correctly reflects the persisted value.
 * Per-theme class assertions are already covered in tests/unit/ui/theme.test.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme } from "@/ui/theme";
import { saveConfig, loadConfig } from "@/core/config";

describe("Theme ↔ Config integration", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("saved theme is restored and applied via applyTheme", () => {
    const cfg = loadConfig();
    saveConfig({ ...cfg, theme: "amber" });
    const reloaded = loadConfig();
    applyTheme(reloaded.theme);
    expect(document.body.classList.contains("theme-amber")).toBe(true);
  });

  it("switching theme updates config and re-applies correctly", () => {
    const cfg = loadConfig();
    saveConfig({ ...cfg, theme: "rose" });
    applyTheme(loadConfig().theme);
    expect(document.body.classList.contains("theme-rose")).toBe(true);

    saveConfig({ ...loadConfig(), theme: "matrix" });
    applyTheme(loadConfig().theme);
    expect(document.body.classList.contains("theme-matrix")).toBe(true);
  });
});
