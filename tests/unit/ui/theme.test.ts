/**
 * Tests for src/ui/theme.ts — Theme System
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyTheme,
  cycleTheme,
  currentTheme,
  initTheme,
  THEMES,
} from "@/ui/theme";

describe("Theme System", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<select id="theme-select"><option value="black">Black</option><option value="blue">Blue</option></select>';
    document.body.className = "";
  });

  it("applies a valid theme class to body", () => {
    applyTheme("blue");
    expect(document.body.classList.contains("theme-blue")).toBe(true);
  });

  it("removes previous theme class when switching", () => {
    applyTheme("blue");
    applyTheme("amber");
    expect(document.body.classList.contains("theme-blue")).toBe(false);
    expect(document.body.classList.contains("theme-amber")).toBe(true);
  });

  it("falls back to black for invalid theme names", () => {
    applyTheme("invalid-theme");
    expect(document.body.classList.contains("theme-black")).toBe(true);
  });

  it("persists theme to localStorage", () => {
    applyTheme("purple");
    expect(localStorage.getItem("dash_theme")).toBe("purple");
  });

  it("syncs the dropdown value", () => {
    applyTheme("blue");
    const sel = document.getElementById("theme-select") as HTMLSelectElement;
    expect(sel.value).toBe("blue");
  });

  it("cycles through all themes", () => {
    applyTheme("black");
    cycleTheme();
    expect(currentTheme()).toBe("blue");
    cycleTheme();
    expect(currentTheme()).toBe("matrix");
  });

  it("wraps around to first theme after last", () => {
    applyTheme("purple");
    cycleTheme();
    expect(currentTheme()).toBe("black");
  });

  it("currentTheme returns the active theme", () => {
    applyTheme("matrix");
    expect(currentTheme()).toBe("matrix");
  });

  it("initTheme loads from localStorage", () => {
    localStorage.setItem("dash_theme", "amber");
    initTheme();
    expect(currentTheme()).toBe("amber");
  });

  it("has exactly 5 themes", () => {
    expect(THEMES.length).toBe(5);
  });
});
