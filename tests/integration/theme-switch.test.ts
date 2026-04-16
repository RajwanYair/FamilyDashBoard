/**
 * Integration: Theme apply → CSS class on document.documentElement
 *
 * Tests that applyTheme() sets the correct data-theme attribute and
 * that the computed class reflects the applied theme name.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { applyTheme, currentTheme } from "@/ui/theme";
import { saveConfig, loadConfig } from "@/core/config";

describe("Theme — applyTheme sets class on body element", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("applyTheme sets theme-blue class on body", () => {
    applyTheme("blue");
    expect(document.body.classList.contains("theme-blue")).toBe(true);
  });

  it("applyTheme 'black' sets theme-black on body", () => {
    applyTheme("black");
    expect(document.body.classList.contains("theme-black")).toBe(true);
  });

  it("applyTheme 'matrix' sets theme-matrix on body", () => {
    applyTheme("matrix");
    expect(document.body.classList.contains("theme-matrix")).toBe(true);
  });

  it("applyTheme 'amber' sets theme-amber on body", () => {
    applyTheme("amber");
    expect(document.body.classList.contains("theme-amber")).toBe(true);
  });

  it("applyTheme 'purple' sets theme-purple on body", () => {
    applyTheme("purple");
    expect(document.body.classList.contains("theme-purple")).toBe(true);
  });

  it("applyTheme 'rose' sets theme-rose on body", () => {
    applyTheme("rose");
    expect(document.body.classList.contains("theme-rose")).toBe(true);
  });

  it("currentTheme returns the current theme after applyTheme", () => {
    applyTheme("matrix");
    expect(currentTheme()).toBe("matrix");
  });

  it("theme integrates with config — saved theme is restored via applyTheme", () => {
    const cfg = loadConfig();
    saveConfig({ ...cfg, theme: "amber" });
    const reloaded = loadConfig();
    applyTheme(reloaded.theme);
    expect(document.body.classList.contains("theme-amber")).toBe(true);
  });
});
