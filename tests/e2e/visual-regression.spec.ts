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
const SCREEN_MODES = ["normal", "compact", "focus"] as const;

type Theme = (typeof THEMES)[number];
type ScreenMode = (typeof SCREEN_MODES)[number];

/** localStorage key used by the dashboard for theme persistence. */
const LS_THEME_KEY = "dash_theme";
/** localStorage key used by the dashboard for screen-mode persistence. */
const LS_MODE_KEY = "dash_screen_mode";

/** How long to wait for cards to begin rendering before the screenshot. */
const SETTLE_MS = 1_500;

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
    ({ themeKey, modeKey, themeVal, modeVal }) => {
      localStorage.setItem(themeKey, themeVal);
      localStorage.setItem(modeKey, modeVal);
    },
    {
      themeKey: LS_THEME_KEY,
      modeKey: LS_MODE_KEY,
      themeVal: theme,
      modeVal: mode,
    },
  );

  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Wait for at least one card to be present in the DOM.
  await page.waitForSelector("[data-card-id], .card-header", {
    timeout: 15_000,
  });

  // Allow cards time to render their content.
  await page.waitForTimeout(SETTLE_MS);
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe("FamilyDashBoard — Visual Regression Baselines", () => {
  // Run in serial to avoid parallel screenshot conflicts.
  test.describe.configure({ mode: "serial" });

  for (const theme of THEMES) {
    for (const mode of SCREEN_MODES) {
      test(`${theme} theme / ${mode} mode`, async ({ page }) => {
        await goWithConfig(page, theme, mode);

        // Full-page screenshot comparison (stored in __snapshots__ next to spec).
        await expect(page).toHaveScreenshot(`${theme}-${mode}.png`, {
          // Allow minor pixel-level anti-aliasing differences.
          maxDiffPixelRatio: 0.02,
          // Mask animated elements that would cause flaky diffs.
          mask: [
            page.locator(".clock, #clock, [id*='time'], [class*='time']"),
            page.locator("[class*='ticker'], [class*='marquee']"),
          ],
          // Capture the full viewport (1920×1080 set in playwright.config.ts).
          fullPage: false,
        });
      });
    }
  }
});

// ── Per-theme smoke: verify class applied ─────────────────────────────────

test.describe("FamilyDashBoard — Theme CSS Class Applied", () => {
  for (const theme of THEMES) {
    test(`data-theme="${theme}" attribute is set on <html>`, async ({ page }) => {
      await goWithConfig(page, theme, "normal");

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
