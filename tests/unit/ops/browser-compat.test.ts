/**
 * Unit tests — Browser Compatibility
 *
 * Validates that:
 * 1. .browserslistrc covers all required browser families
 * 2. The Playwright config includes projects for all target platforms
 * 3. CSS features used are compatible with declared browser targets
 * 4. No accidental removal of essential browser targets
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");
const BROWSERSLIST = readFileSync(resolve(ROOT, ".browserslistrc"), "utf-8");
const PLAYWRIGHT_CONFIG = readFileSync(resolve(ROOT, "playwright.config.ts"), "utf-8");

/** Extract non-comment, non-blank lines from .browserslistrc */
function getBrowserTargets(): string[] {
  return BROWSERSLIST.split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l && !l.startsWith("#"));
}

describe(".browserslistrc — required browser families", () => {
  const targets = getBrowserTargets();

  const REQUIRED_FAMILIES = [
    "Chrome",
    "Edge",
    "Firefox",
    "Safari",
    "Opera",
    "Samsung",
    "iOS",
    "Android",
    "ChromeAndroid",
    "FirefoxAndroid",
    "OperaMobile",
  ] as const;

  for (const family of REQUIRED_FAMILIES) {
    it(`includes ${family} target`, () => {
      const found = targets.some((t) => t.toLowerCase().startsWith(family.toLowerCase()));
      expect(found, `Missing browser family: ${family}`).toBe(true);
    });
  }

  it("includes Firefox ESR for enterprise/long-term support", () => {
    expect(targets.some((t) => t.includes("Firefox ESR"))).toBe(true);
  });

  it("has at least 12 browser targets (desktop + mobile + embedded)", () => {
    expect(targets.length).toBeGreaterThanOrEqual(12);
  });
});

describe("Playwright config — cross-browser coverage", () => {
  const REQUIRED_PROJECTS = [
    "chromium",
    "firefox",
    "webkit",
    "edge",
    "mobile-chrome",
    "mobile-safari",
    "tablet-safari",
    "tablet-android",
    "mobile-samsung",
    "mobile-pixel7",
    "tablet-ipad-mini",
  ] as const;

  for (const project of REQUIRED_PROJECTS) {
    it(`defines "${project}" project`, () => {
      expect(PLAYWRIGHT_CONFIG).toContain(`name: "${project}"`);
    });
  }

  it("smoke tests run on all cross-browser projects", () => {
    const smokeMatches = PLAYWRIGHT_CONFIG.match(/smoke\\?\.spec\\?\.ts/g);
    // At least 10 projects reference smoke (all cross-browser + primary)
    expect(smokeMatches?.length ?? 0).toBeGreaterThanOrEqual(10);
  });

  it("accessibility tests run on all cross-browser projects", () => {
    const a11yMatches = PLAYWRIGHT_CONFIG.match(/accessibility\\?\.spec\\?\.ts/g);
    expect(a11yMatches?.length ?? 0).toBeGreaterThanOrEqual(10);
  });
});

describe(".browserslistrc — version sanity", () => {
  const targets = getBrowserTargets();

  it("Chrome version is >= 114 (required for @layer + @property)", () => {
    const chrome = targets.find((t) => /^Chrome\s*>=?\s*\d+$/i.test(t));
    const version = chrome?.match(/\d+/)?.[0];
    expect(Number(version)).toBeGreaterThanOrEqual(114);
  });

  it("Firefox version is >= 128 (required for @scope + light-dark())", () => {
    const ff = targets.find((t) => /^Firefox\s*>=?\s*\d+$/i.test(t));
    const version = ff?.match(/\d+/)?.[0];
    expect(Number(version)).toBeGreaterThanOrEqual(128);
  });

  it("Safari version is >= 17.4 (required for View Transitions)", () => {
    const safari = targets.find((t) => /^Safari\s*>=?\s*[\d.]+$/i.test(t));
    const version = safari?.match(/[\d.]+/)?.[0];
    expect(Number(version)).toBeGreaterThanOrEqual(17.4);
  });

  it("Samsung Internet version is >= 23", () => {
    const samsung = targets.find((t) => /^Samsung\s*>=?\s*\d+$/i.test(t));
    const version = samsung?.match(/\d+/)?.[0];
    expect(Number(version)).toBeGreaterThanOrEqual(23);
  });
});

describe(".browserslistrc — implicit Chromium/WebKit coverage", () => {
  it("documents Chromium-based browsers (Brave, Vivaldi, Arc, Yandex)", () => {
    expect(BROWSERSLIST).toContain("Chromium-based");
  });

  it("documents WebKit-based browsers (UC Browser, QQ Browser)", () => {
    expect(BROWSERSLIST).toContain("WebKit-based");
  });
});

describe(".hintrc — browserslist sync", () => {
  const HINTRC = readFileSync(resolve(ROOT, ".hintrc"), "utf-8");

  it("includes android chrome (and_chr) target", () => {
    expect(HINTRC).toContain("and_chr >= 114");
  });

  it("includes android firefox (and_ff) target", () => {
    expect(HINTRC).toContain("and_ff >= 128");
  });

  it("includes android webview target", () => {
    expect(HINTRC).toContain("android >= 114");
  });
});
