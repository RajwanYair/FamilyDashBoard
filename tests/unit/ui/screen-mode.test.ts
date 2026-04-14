/**
 * Tests for src/ui/screen-mode.ts
 *
 * Covers: applyScreenMode, applyFontScale, stepFontScale, initScreenMode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  applyScreenMode,
  applyFontScale,
  stepFontScale,
  initScreenMode,
} from "@/ui/screen-mode";

describe("Screen Mode — applyScreenMode", () => {
  beforeEach(() => {
    document.body.className = "";
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("adds screen-tv class", () => {
    applyScreenMode("tv");
    expect(document.body.classList.contains("screen-tv")).toBe(true);
  });

  it("adds screen-tablet class", () => {
    applyScreenMode("tablet");
    expect(document.body.classList.contains("screen-tablet")).toBe(true);
  });

  it("adds screen-phone class", () => {
    applyScreenMode("phone");
    expect(document.body.classList.contains("screen-phone")).toBe(true);
  });

  it("removes previous screen class when switching", () => {
    applyScreenMode("tv");
    applyScreenMode("tablet");
    expect(document.body.classList.contains("screen-tv")).toBe(false);
    expect(document.body.classList.contains("screen-tablet")).toBe(true);
  });

  it("only has one screen class at a time", () => {
    applyScreenMode("phone");
    applyScreenMode("tv");
    const screenClasses = [...document.body.classList].filter((c) =>
      c.startsWith("screen-"),
    );
    expect(screenClasses).toHaveLength(1);
  });
});

describe("Screen Mode — applyFontScale", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--font-scale");
  });

  it("sets --font-scale CSS property", () => {
    applyFontScale(1.2);
    expect(
      document.documentElement.style.getPropertyValue("--font-scale"),
    ).toBe("1.2");
  });

  it("clamps to minimum 0.7", () => {
    applyFontScale(0.3);
    expect(
      document.documentElement.style.getPropertyValue("--font-scale"),
    ).toBe("0.7");
  });

  it("clamps to maximum 1.5", () => {
    applyFontScale(2.0);
    expect(
      document.documentElement.style.getPropertyValue("--font-scale"),
    ).toBe("1.5");
  });

  it("rounds to 2 decimal places", () => {
    applyFontScale(1.123456);
    const val = parseFloat(
      document.documentElement.style.getPropertyValue("--font-scale"),
    );
    expect(val).toBeCloseTo(1.12, 2);
  });
});

describe("Screen Mode — stepFontScale", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--font-scale");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty("--font-scale");
  });

  it("increments font scale by 0.05", () => {
    // Default fontScale is 1
    stepFontScale(1);
    const val = parseFloat(
      document.documentElement.style.getPropertyValue("--font-scale") || "0",
    );
    expect(val).toBeCloseTo(1.05, 2);
  });

  it("decrements font scale by 0.05", () => {
    stepFontScale(-1);
    const val = parseFloat(
      document.documentElement.style.getPropertyValue("--font-scale") || "0",
    );
    expect(val).toBeCloseTo(0.95, 2);
  });

  it("persists new scale to config", () => {
    stepFontScale(1);
    const config = JSON.parse(
      localStorage.getItem("dash_v2_config") ?? "{}",
    ) as { fontScale?: number };
    expect(config.fontScale).toBeCloseTo(1.05, 2);
  });

  it("does not go below 0.7", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ fontScale: 0.71 }));
    stepFontScale(-1);
    const val = parseFloat(
      document.documentElement.style.getPropertyValue("--font-scale") || "1",
    );
    expect(val).toBeGreaterThanOrEqual(0.7);
  });

  it("does not go above 1.5", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ fontScale: 1.49 }));
    stepFontScale(1);
    const val = parseFloat(
      document.documentElement.style.getPropertyValue("--font-scale") || "0",
    );
    expect(val).toBeLessThanOrEqual(1.5);
  });
});

describe("Screen Mode — initScreenMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.documentElement.style.removeProperty("--font-scale");
    document.body.innerHTML =
      '<select id="screen-mode-select"><option value="tv">TV</option><option value="tablet">Tablet</option></select>';
  });

  afterEach(() => {
    localStorage.clear();
    document.body.className = "";
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--font-scale");
  });

  it("applies saved screen mode on init", () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ screenMode: "tablet" }),
    );
    initScreenMode();
    expect(document.body.classList.contains("screen-tablet")).toBe(true);
  });

  it("applies default tv mode when no config saved", () => {
    initScreenMode();
    expect(document.body.classList.contains("screen-tv")).toBe(true);
  });

  it("applies saved font scale on init", () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ fontScale: 1.15 }));
    initScreenMode();
    const val = parseFloat(
      document.documentElement.style.getPropertyValue("--font-scale") || "0",
    );
    expect(val).toBeCloseTo(1.15, 2);
  });

  it("wires screen-mode dropdown change", () => {
    initScreenMode();
    const sel = document.getElementById(
      "screen-mode-select",
    ) as HTMLSelectElement;
    sel.value = "tablet";
    sel.dispatchEvent(new Event("change"));
    expect(document.body.classList.contains("screen-tablet")).toBe(true);
  });

  it("works without #screen-mode-select element", () => {
    document.body.innerHTML = "";
    initScreenMode();
    expect(document.body.classList.contains("screen-tv")).toBe(true);
  });
});
