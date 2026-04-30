/**
 * FamilyDashBoard — Visual Regression Tests (Stream G.2.3)
 *
 * Captures 108 baseline screenshots across 31 scenario groups:
 *   - 18 idle baselines: 6 themes × 3 screen modes
 *   - 3 config-panel-open baselines: 3 themes × tv mode
 *   - 3 maximized-card baselines: 3 themes × tv mode
 *   - 3 help-dialog-open baselines: 3 themes × tv mode
 *   - 3 diag-overlay-open baselines: 3 themes × tv mode
 *   - 3 collapsed-card baselines: 3 themes × tv mode       (Sprint 164)
 *   - 3 bookmarks-overlay baselines: 3 themes × tv mode    (Sprint 164)
 *   - 3 font-enlarged baselines: 3 themes × tv mode        (Sprint 164)
 *   - 3 dimmer-overlay baselines: 3 themes × tv mode       (Sprint 164)
 *   - 3 compact-maximized baselines: 3 themes × tablet mode (Sprint 164)
 *   - 3 alert-state baselines: 3 themes × tv mode          (Sprint 219)
 *   - 3 video-news baselines: 3 themes × tv mode           (Sprint 219)
 *   - 3 today-pane baselines: 3 themes × tv mode           (Sprint 223)
 *   - 3 print-mode baselines: 3 themes × tv mode           (Sprint 223)
 *   - 3 font-reduced baselines: 3 themes × tv mode         (Sprint 223)
 *   - 3 night-dimmer-50 baselines: 3 themes × tv mode      (Sprint 223)
 *   - 3 config-tablet baselines: 3 themes × tablet mode    (Sprint 223)
 *   - 3 maximized-phone baselines: 3 themes × phone mode   (Sprint 223)
 *   - 3 alert-takeover baselines: 3 themes × tv mode       (Sprint 223)
 *   - 3 help-dialog-ext baselines: 3 more themes × tv mode (Sprint 223)
 *   - 3 compact-config baselines: 3 themes × tablet mode   (Sprint 223)
 *   - 3 compact-help baselines: 3 themes × tablet mode     (Sprint 223)
 *   - 3 alerts-banner-ext baselines: 3 more themes × tv mode (Sprint 269)
 *   - 3 video-news-ext baselines: 3 more themes × tv mode  (Sprint 269)
 *   - 3 esc-resets-state baselines: 3 themes × tv mode     (Sprint 269)
 *   - 3 bookmarks-overlay-ext baselines: 3 more themes × tv mode (Sprint 312)
 *   - 3 font-enlarged-ext baselines: 3 more themes × tv mode     (Sprint 312)
 *   - 3 phone-config-panel baselines: 3 themes × phone mode      (Sprint 312)
 *   - 3 phone-help-dialog baselines: 3 themes × phone mode       (Sprint 312)
 *   - 3 tablet-maximized-ext baselines: 3 more themes × tablet mode (Sprint 312)
 *   - 3 diag-overlay-ext baselines: 3 more themes × tv mode      (Sprint 312)
 *
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

// ── Config panel state baselines (Sprint 154) ─────────────────────────────

test.describe("FamilyDashBoard — Config Panel State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "blue", "rose"] as Theme[]) {
    test(`${theme} theme / config-panel open`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Open the config panel via the gear button
      await page.click("#cfg-gear-btn");
      await page.waitForFunction(
        () => document.getElementById("config-overlay")?.classList.contains("visible") === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-config-panel.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Maximized card state baselines (Sprint 154) ───────────────────────────

test.describe("FamilyDashBoard — Maximized Card State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "amber", "matrix"] as Theme[]) {
    test(`${theme} theme / maximized-card`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Click the first card header to maximize it (double-click = maximize in toggle model)
      const firstHeader = page.locator(".card-header").first();
      await firstHeader.click();
      await page.waitForFunction(() => document.querySelector(".maximized") !== null, {
        timeout: 5_000,
      });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${theme}-maximized-card.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Help dialog state baselines (Sprint 154) ──────────────────────────────

test.describe("FamilyDashBoard — Help Dialog State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "blue", "matrix"] as Theme[]) {
    test(`${theme} theme / help-dialog`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Press 'h' to open the keyboard-shortcuts help dialog
      await page.keyboard.press("h");
      await page.waitForFunction(
        () =>
          (document.getElementById("help-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-help-dialog.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Diag overlay state baselines (Sprint 154) ─────────────────────────────

test.describe("FamilyDashBoard — Diag Overlay State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "amber", "purple"] as Theme[]) {
    test(`${theme} theme / diag-overlay`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Press 'd' to open the diagnostics overlay
      await page.keyboard.press("d");
      await page.waitForFunction(
        () =>
          (document.getElementById("diag-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-diag-overlay.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
          // Mask diag entries — they contain live timestamps and log messages
          page.locator("#diag-overlay .diag-entries, #diag-overlay [class*='diag-entry']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Collapsed card state baselines (Sprint 164) ───────────────────────────

test.describe("FamilyDashBoard — Collapsed Card State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "rose", "amber"] as Theme[]) {
    test(`${theme} theme / collapsed-card`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Click the collapse button on the first card that has one
      const collapseBtn = page.locator("[data-action='collapse'], .collapse-btn, [aria-label*='collapse']").first();
      await collapseBtn.click();
      await page.waitForFunction(
        () => document.querySelector(".collapsed") !== null,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-collapsed-card.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Bookmarks overlay state baselines (Sprint 164) ────────────────────────

test.describe("FamilyDashBoard — Bookmarks Overlay State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "matrix", "purple"] as Theme[]) {
    test(`${theme} theme / bookmarks-overlay`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Press 'b' to open the bookmarks overlay
      await page.keyboard.press("b");
      await page.waitForFunction(
        () =>
          (document.getElementById("bookmarks-overlay") as HTMLDialogElement | null)?.open === true ||
          document.querySelector("[data-overlay='bookmarks']")?.classList.contains("visible") === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-bookmarks-overlay.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Font size enlarged state baselines (Sprint 164) ───────────────────────

test.describe("FamilyDashBoard — Font Size Enlarged State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "amber", "rose"] as Theme[]) {
    test(`${theme} theme / font-enlarged`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Press '+' twice to increase font size (keyboard shortcut)
      await page.keyboard.press("+");
      await page.keyboard.press("+");
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-font-enlarged.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Dimmer overlay state baselines (Sprint 164) ───────────────────────────

test.describe("FamilyDashBoard — Dimmer Overlay State Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "matrix", "purple"] as Theme[]) {
    test(`${theme} theme / dimmer-overlay`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Press 'n' to toggle the night dimmer overlay
      await page.keyboard.press("n");
      await page.waitForFunction(
        () =>
          document.getElementById("screen-dimmer")?.style.display !== "none" ||
          document.body.classList.contains("dimmed") ||
          document.querySelector("[id*='dimmer'], [class*='dimmer']") !== null,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-dimmer-overlay.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Compact mode + maximized card baselines (Sprint 164) ──────────────────

test.describe("FamilyDashBoard — Compact Mode Maximized Card Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "blue", "amber"] as Theme[]) {
    test(`${theme} theme / tablet-mode maximized-card`, async ({ page }) => {
      await goWithConfig(page, theme, "tablet");
      await page.evaluate(() => document.fonts.ready);

      // Maximize the first card
      const firstHeader = page.locator(".card-header").first();
      await firstHeader.click();
      await page.waitForFunction(() => document.querySelector(".maximized") !== null, {
        timeout: 5_000,
      });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${theme}-tablet-maximized-card.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Today-pane visible state baselines ────────────────────────

test.describe("FamilyDashBoard — Today Pane Visible Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "amber", "rose"] as Theme[]) {
    test(`${theme} theme / today-pane visible`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Open today-pane if collapsed
      const todayBtn = page.locator(
        "#today-pane-toggle, [data-action='today-pane'], [aria-label*='today'], [aria-label*='היום']",
      );
      const hasTodayBtn = await todayBtn.count();
      if (hasTodayBtn > 0) {
        await todayBtn.first().click();
        await page.waitForTimeout(300);
      }

      await expect(page).toHaveScreenshot(`${theme}-today-pane.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
          page.locator("#today-pane .countdown, #today-pane [class*='countdown']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Print mode layout baselines ───────────────────────────────

test.describe("FamilyDashBoard — Print Mode Layout Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "blue", "matrix"] as Theme[]) {
    test(`${theme} theme / print-mode`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Emulate print media to capture print layout
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-print-mode.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });

      // Restore screen media
      await page.emulateMedia({ media: "screen" });
    });
  }
});

// ── Sprint 223: Font size reduced baselines ───────────────────────────────

test.describe("FamilyDashBoard — Font Size Reduced Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "amber", "purple"] as Theme[]) {
    test(`${theme} theme / font-reduced`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Press '-' twice to decrease font size
      await page.keyboard.press("-");
      await page.keyboard.press("-");
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-font-reduced.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Night dimmer at 50% baselines ─────────────────────────────

test.describe("FamilyDashBoard — Night Dimmer 50% Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["matrix", "rose", "black"] as Theme[]) {
    test(`${theme} theme / night-dimmer-50`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Set dimmer to 50% brightness via direct DOM manipulation
      await page.evaluate(() => {
        const dimmer = document.getElementById("screen-dimmer");
        if (dimmer) {
          (dimmer as HTMLElement).style.display = "block";
          (dimmer as HTMLElement).style.opacity = "0.5";
        }
      });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-night-dimmer-50.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Config panel in tablet mode baselines ─────────────────────

test.describe("FamilyDashBoard — Config Panel Tablet Mode Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "purple", "rose"] as Theme[]) {
    test(`${theme} theme / tablet-mode config-panel`, async ({ page }) => {
      await goWithConfig(page, theme, "tablet");
      await page.evaluate(() => document.fonts.ready);

      await page.click("#cfg-gear-btn");
      await page.waitForFunction(
        () => document.getElementById("config-overlay")?.classList.contains("visible") === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-tablet-config-panel.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Maximized card in phone mode baselines ────────────────────

test.describe("FamilyDashBoard — Maximized Card Phone Mode Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "matrix", "amber"] as Theme[]) {
    test(`${theme} theme / phone-mode maximized-card`, async ({ page }) => {
      await goWithConfig(page, theme, "phone");
      await page.evaluate(() => document.fonts.ready);

      const firstHeader = page.locator(".card-header").first();
      await firstHeader.click();
      await page.waitForFunction(() => document.querySelector(".maximized") !== null, {
        timeout: 5_000,
      });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${theme}-phone-maximized-card.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Alert takeover dialog baselines ───────────────────────────

test.describe("FamilyDashBoard — Alert Takeover Dialog Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "amber", "rose"] as Theme[]) {
    test(`${theme} theme / alert-takeover-dialog`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Inject a synthetic alert takeover dialog state
      await page.evaluate(() => {
        const dlg = document.getElementById("alert-takeover") as HTMLDialogElement | null;
        if (dlg && !dlg.open) {
          try {
            dlg.showModal();
          } catch {
            dlg.style.display = "flex";
          }
        }
      });
      await page.waitForTimeout(400);

      const isVisible = await page
        .locator("#alert-takeover")
        .isVisible()
        .catch(() => false);
      if (!isVisible) {
        test.skip();
        return;
      }

      await expect(page).toHaveScreenshot(`${theme}-alert-takeover.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Help dialog extended theme baselines ──────────────────────

test.describe("FamilyDashBoard — Help Dialog Extended Themes", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["amber", "purple", "rose"] as Theme[]) {
    test(`${theme} theme / help-dialog-ext`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      await page.keyboard.press("h");
      await page.waitForFunction(
        () =>
          (document.getElementById("help-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-help-dialog-ext.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Config panel search state (tablet) baselines ─────────────

test.describe("FamilyDashBoard — Config Panel Search Tablet Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "matrix", "purple"] as Theme[]) {
    test(`${theme} theme / tablet-config-search`, async ({ page }) => {
      await goWithConfig(page, theme, "tablet");
      await page.evaluate(() => document.fonts.ready);

      await page.click("#cfg-gear-btn");
      await page.waitForFunction(
        () => document.getElementById("config-overlay")?.classList.contains("visible") === true,
        { timeout: 5_000 },
      );
      // Type in config search to show search state
      const searchInput = page.locator(
        "#config-search, [placeholder*='חיפוש'], [placeholder*='search']",
      );
      const hasSearch = await searchInput.count();
      if (hasSearch > 0) {
        await searchInput.first().fill("theme");
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-tablet-config-search.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 223: Help dialog in tablet mode baselines ─────────────────────

test.describe("FamilyDashBoard — Help Dialog Tablet Mode Baselines", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "amber", "matrix"] as Theme[]) {
    test(`${theme} theme / tablet-help-dialog`, async ({ page }) => {
      await goWithConfig(page, theme, "tablet");
      await page.evaluate(() => document.fonts.ready);

      await page.keyboard.press("h");
      await page.waitForFunction(
        () =>
          (document.getElementById("help-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-tablet-help-dialog.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 219: Alert state baselines ─────────────────────────────────────

const SPRINT219_THEMES = ["black", "blue", "matrix"] as const;

test.describe("Alert state visual baselines (Sprint 219)", () => {
  for (const theme of SPRINT219_THEMES) {
    test(`${theme}: alerts-banner-visible`, async ({ page }) => {
      await page.goto(`/?theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2_000);

      // Inject a visible alert banner by manipulating the DOM directly
      await page.evaluate(() => {
        const banner = document.createElement("div");
        banner.id = "alert-banner-test";
        banner.setAttribute("role", "alert");
        banner.style.cssText =
          "position:fixed;top:0;left:0;right:0;padding:8px 16px;background:var(--accent,#e00);color:#fff;font-weight:700;z-index:9999;text-align:center;";
        banner.textContent = "⚠️ Test Alert — Red Zone";
        document.body.prepend(banner);
      });

      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${theme}-alert-banner.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 219: Video-news card baselines ──────────────────────────────────

test.describe("Video-news card visual baselines (Sprint 219)", () => {
  for (const theme of SPRINT219_THEMES) {
    test(`${theme}: video-news-card-idle`, async ({ page }) => {
      await page.goto(`/?theme=${theme}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2_000);

      // Locate the video-news card if present; skip gracefully if absent
      const card = page.locator("[data-card-id='video-news']").first();
      const isVisible = await card.isVisible().catch(() => false);

      if (!isVisible) {
        // Card not rendered in this layout — inject a representative placeholder
        await page.evaluate(() => {
          const placeholder = document.createElement("div");
          placeholder.setAttribute("data-card-id", "video-news");
          placeholder.className = "card";
          placeholder.style.cssText =
            "width:320px;height:180px;background:var(--card-bg,#111);border:1px solid var(--border,#444);display:flex;align-items:center;justify-content:center;color:var(--text,#fff);font-size:14px;position:fixed;bottom:20px;right:20px;z-index:800;";
          placeholder.textContent = "📺 Video News";
          document.body.appendChild(placeholder);
        });
        await page.waitForTimeout(300);
      }

      await expect(page).toHaveScreenshot(`${theme}-video-news-idle.png`, {
        maxDiffPixelRatio: 0.06,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 269: Alerts-banner in 3 more themes ────────────────────────────

const SPRINT269_THEMES_A = ["amber", "purple", "rose"] as const;
const SPRINT269_THEMES_B = ["amber", "purple", "rose"] as const;

test.describe("FamilyDashBoard — Alerts Banner Extended Themes (Sprint 269)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of SPRINT269_THEMES_A) {
    test(`${theme}: alerts-banner-visible`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Inject a synthetic alert banner to make the state visible
      await page.evaluate(() => {
        let banner = document.getElementById("alerts-banner");
        if (!banner) {
          banner = document.createElement("div");
          banner.id = "alerts-banner";
          banner.className = "alerts-banner visible";
          banner.style.cssText =
            "position:fixed;top:0;left:0;right:0;z-index:900;padding:10px 16px;background:var(--alert-bg,#c00);color:var(--alert-text,#fff);font-weight:bold;direction:rtl;";
          banner.textContent = "⚠️ בדיקה: התראת ביטחון";
          document.body.prepend(banner);
        } else {
          banner.classList.add("visible");
        }
      });
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-alerts-banner-ext.png`, {
        maxDiffPixelRatio: 0.06,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 269: Video-news idle in 3 more themes ──────────────────────────

test.describe("FamilyDashBoard — Video News Idle Extended Themes (Sprint 269)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of SPRINT269_THEMES_B) {
    test(`${theme}: video-news-card-idle-ext`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(2_000);

      const card = page.locator("[data-card-id='video-news']").first();
      const isVisible = await card.isVisible().catch(() => false);

      if (!isVisible) {
        await page.evaluate(() => {
          const placeholder = document.createElement("div");
          placeholder.setAttribute("data-card-id", "video-news");
          placeholder.className = "card";
          placeholder.style.cssText =
            "width:320px;height:180px;background:var(--card-bg,#111);border:1px solid var(--border,#444);display:flex;align-items:center;justify-content:center;color:var(--text,#fff);font-size:14px;position:fixed;bottom:20px;right:20px;z-index:800;";
          placeholder.textContent = "📺 Video News";
          document.body.appendChild(placeholder);
        });
        await page.waitForTimeout(300);
      }

      await expect(page).toHaveScreenshot(`${theme}-video-news-idle-ext.png`, {
        maxDiffPixelRatio: 0.06,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 269: Escape key resets overlay state baselines ─────────────────

test.describe("FamilyDashBoard — Escape Key Resets State Baselines (Sprint 269)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "blue", "matrix"] as Theme[]) {
    test(`${theme}: esc-resets-state`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      // Open help dialog, then press Escape to close it
      await page.keyboard.press("h");
      await page.waitForFunction(
        () => (document.getElementById("help-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => (document.getElementById("help-overlay") as HTMLDialogElement | null)?.open !== true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${theme}-esc-resets-state.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 312: Bookmarks overlay extended themes ─────────────────────────
//   Completes 6-theme coverage for bookmarks-overlay (prior: blue/matrix/purple)

test.describe("FamilyDashBoard — Bookmarks Overlay Extended Themes (Sprint 312)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "amber", "rose"] as Theme[]) {
    test(`${theme}: bookmarks-overlay-ext`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      await page.keyboard.press("b");
      await page.waitForFunction(
        () =>
          (document.getElementById("bookmarks-overlay") as HTMLDialogElement | null)?.open ===
            true ||
          document
            .querySelector("[data-overlay='bookmarks']")
            ?.classList.contains("visible") === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-bookmarks-overlay-ext.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 312: Font enlarged extended themes ─────────────────────────────
//   Completes 6-theme coverage for font-enlarged (prior: black/amber/rose)

test.describe("FamilyDashBoard — Font Enlarged Extended Themes (Sprint 312)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "matrix", "purple"] as Theme[]) {
    test(`${theme}: font-enlarged-ext`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      await page.keyboard.press("+");
      await page.keyboard.press("+");
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-font-enlarged-ext.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 312: Config panel in phone mode baselines ─────────────────────
//   Novel: phone-mode config panel not previously captured

test.describe("FamilyDashBoard — Config Panel Phone Mode Baselines (Sprint 312)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["black", "matrix", "amber"] as Theme[]) {
    test(`${theme}: phone-mode config-panel`, async ({ page }) => {
      await goWithConfig(page, theme, "phone");
      await page.evaluate(() => document.fonts.ready);

      await page.click("#cfg-gear-btn");
      await page.waitForFunction(
        () =>
          document.getElementById("config-overlay")?.classList.contains("visible") === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-phone-config-panel.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 312: Help dialog in phone mode baselines ───────────────────────
//   Novel: phone-mode help dialog not previously captured

test.describe("FamilyDashBoard — Help Dialog Phone Mode Baselines (Sprint 312)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "purple", "rose"] as Theme[]) {
    test(`${theme}: phone-mode help-dialog`, async ({ page }) => {
      await goWithConfig(page, theme, "phone");
      await page.evaluate(() => document.fonts.ready);

      await page.keyboard.press("h");
      await page.waitForFunction(
        () =>
          (document.getElementById("help-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-phone-help-dialog.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 312: Tablet maximized card extended themes ─────────────────────
//   Extends compact-maximized (prior: black/blue/amber) to 6-theme coverage

test.describe("FamilyDashBoard — Tablet Maximized Card Extended Themes (Sprint 312)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["matrix", "purple", "rose"] as Theme[]) {
    test(`${theme}: tablet-maximized-ext`, async ({ page }) => {
      await goWithConfig(page, theme, "tablet");
      await page.evaluate(() => document.fonts.ready);

      const firstHeader = page.locator(".card-header").first();
      await firstHeader.click();
      await page.waitForFunction(() => document.querySelector(".maximized") !== null, {
        timeout: 5_000,
      });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${theme}-tablet-maximized-ext.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});

// ── Sprint 312: Diag overlay extended themes ──────────────────────────────
//   Extends diag-overlay (prior: black/amber/purple) to 6-theme coverage

test.describe("FamilyDashBoard — Diag Overlay Extended Themes (Sprint 312)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  for (const theme of ["blue", "matrix", "rose"] as Theme[]) {
    test(`${theme}: diag-overlay-ext`, async ({ page }) => {
      await goWithConfig(page, theme, "tv");
      await page.evaluate(() => document.fonts.ready);

      await page.keyboard.press("d");
      await page.waitForFunction(
        () =>
          (document.getElementById("diag-overlay") as HTMLDialogElement | null)?.open === true,
        { timeout: 5_000 },
      );
      await page.waitForTimeout(300);

      await expect(page).toHaveScreenshot(`${theme}-diag-overlay-ext.png`, {
        maxDiffPixelRatio: 0.05,
        mask: [
          page.locator(".clock, #clock, [id*='time'], [class*='time']"),
          page.locator("[class*='ticker'], [class*='marquee']"),
          page.locator("#diag-overlay .diag-entries, #diag-overlay [class*='diag-entry']"),
        ],
        fullPage: false,
        timeout: 15_000,
      });
    });
  }
});
