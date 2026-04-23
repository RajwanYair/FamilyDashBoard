/**
 * FamilyDashBoard — Visual Regression Tests (Stream G.2.3)
 *
 * Captures 18 baseline screenshots: 6 themes × 3 screen modes.
 * Screenshots are stored in tests/e2e/__screenshots__/ and compared
 * on subsequent runs via Playwright's built-in snapshot comparison.
 *
 * Run locally:  npx playwright test tests/e2e/visual-regression.spec.ts
 * Update refs:  npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
 *
 * Themes: black · blue · matrix · amber · purple · rose
 * Modes:  default (normal) · compact (2-col) · focus (1-col)
 */

import { test, expect } from "@playwright/test";

// ── Constants ─────────────────────────────────────────────────────────────

const THEMES = ["black", "blue", "matrix", "amber", "purple", "rose"] as const;
const SCREEN_MODES = ["tv", "tablet", "phone"] as const;

type Theme = (typeof THEMES)[number];
type ScreenMode = (typeof SCREEN_MODES)[number];

/** localStorage key used by the dashboard for theme persistence. */
const LS_THEME_KEY = "dash_theme";
/** localStorage key used by the dashboard for the full config (screenMode lives here). */
const LS_CONFIG_KEY = "dash_v2_config";

/** How long to wait for cards to begin rendering before the screenshot. */
const SETTLE_MS = 400;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Navigate to the dashboard with a specific theme and screen mode
 * pre-seeded in localStorage so the page boots into that state.
 */
async function goWithConfig(
  page: import("@playwright/test").Page,
  theme: Theme,
  mode: ScreenMode,
): Promise<void> {
  // Seed localStorage before the page loads so first paint is correct.
  await page.addInitScript(
    ({ themeKey, configKey, themeVal, modeVal }) => {
      localStorage.setItem(themeKey, themeVal);
      try {
        const raw = localStorage.getItem(configKey);
        const config = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
        config["screenMode"] = modeVal;
        // Also align config.theme and disable autoTheme so checkAutoTheme() won't override
        config["theme"] = themeVal;
        config["autoTheme"] = false;
        localStorage.setItem(configKey, JSON.stringify(config));
      } catch {
        /* ignore */
      }
    },
    {
      themeKey: LS_THEME_KEY,
      configKey: LS_CONFIG_KEY,
      themeVal: theme,
      modeVal: mode,
    },
  );

  await page.goto("/FamilyDashBoard/", { waitUntil: "domcontentloaded" });

  // Wait for at least one card to be present in the DOM.
  // Wait until at least one card is present in the DOM.
  await page.waitForFunction(
    () => document.querySelectorAll("[data-card-id], .card-header").length > 0,
    { timeout: 12_000 },
  );

  // Brief settle for animations and deferred renders.
  await page.waitForTimeout(SETTLE_MS);
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe("FamilyDashBoard — Visual Regression Baselines", () => {
  // Run in serial to avoid parallel screenshot conflicts.
  test.describe.configure({ mode: "serial" });
  // Screenshots + settle time can easily exceed the default 30s per test.
  test.setTimeout(60_000);

  for (const theme of THEMES) {
    for (const mode of SCREEN_MODES) {
      test(`${theme} theme / ${mode} mode`, async ({ page }) => {
        await goWithConfig(page, theme, mode);

        // Ensure all fonts are fully resolved before Playwright attempts the
        // screenshot; after 30+ prior tests the browser process can be slow to
        // settle `document.fonts.ready`, which causes a false timeout.
        await page.evaluate(() => document.fonts.ready);

        // Full-page screenshot comparison (stored in __snapshots__ next to spec).
        await expect(page).toHaveScreenshot(`${theme}-${mode}.png`, {
          // Allow minor pixel-level anti-aliasing differences.
          maxDiffPixelRatio: 0.05,
          // Mask animated elements that would cause flaky diffs.
          mask: [
            page.locator(".clock, #clock, [id*='time'], [class*='time']"),
            page.locator("[class*='ticker'], [class*='marquee']"),
          ],
          // Capture the full viewport (1920×1080 set in playwright.config.ts).
          fullPage: false,
          // Fonts can take longer when the full suite runs; give extra time.
          timeout: 15_000,
        });
      });
    }
  }
});

// ── Per-theme smoke: verify class applied ─────────────────────────────────

test.describe("FamilyDashBoard — Theme CSS Class Applied", () => {
  for (const theme of THEMES) {
    test(`data-theme="${theme}" attribute is set on <html>`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");

      const html = page.locator("html");
      // The dashboard applies the theme as a data attribute or body class.
      // Accept either pattern.
      const attr = await html.getAttribute("data-theme").catch(() => null);
      const cls = await page
        .locator("body")
        .getAttribute("class")
        .catch(() => "");

      const hasTheme =
        attr === theme || (cls ?? "").split(" ").some((c) => c === `theme-${theme}` || c === theme);

      expect(hasTheme, `Expected theme "${theme}" to be applied`).toBe(true);
    });
  }
});
