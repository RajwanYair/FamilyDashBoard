/**
 * FamilyDashBoard — Playwright shared fixtures & helpers.
 *
 * Eliminates boilerplate across e2e specs:
 *   - `dashboardPage` fixture: navigates to the dashboard, waits for cards,
 *     captures uncaught errors (except benign View Transition skips), and
 *     optionally pre-seeds localStorage (theme, screen mode) before first paint.
 *   - Stable selectors in one place (SEL) so HTML refactors update a single file.
 *   - Tiny helpers to wait for a dialog/overlay to open or close by id.
 *
 * Import usage:
 *   import { test, expect, SEL } from "./fixtures";
 *   test("...", async ({ dashboardPage }) => { ... });
 */

import { test as base, expect, type Page } from "@playwright/test";

// ── Stable selectors ──────────────────────────────────────────────────────

export const SEL = {
  card: "[data-card-id]",
  cardHeader: ".card-header",
  configPanel: "#config-panel",
  diagOverlay: "#diag-overlay",
  helpOverlay: "#help-overlay",
  halachaOverlay: "#halacha-overlay",
  halachaOverlayText: "#halacha-overlay-text",
  halachaTicker: "#halacha-ticker",
  hcHalachaRow: "#hc-halacha-row",
  skipLink: ".skip-link",
} as const;

// ── Config seeding ─────────────────────────────────────────────────────────

/** localStorage keys the dashboard reads at boot. */
const LS_THEME_KEY = "dash_theme";
const LS_CONFIG_KEY = "dash_v2_config";

export type Theme = "black" | "blue" | "matrix" | "amber" | "purple" | "rose";
export type ScreenMode = "tv" | "tablet" | "phone";

export interface SeedConfig {
  theme?: Theme;
  screenMode?: ScreenMode;
}

/** Install a pre-navigation init script that seeds theme + screenMode. */
async function seedConfigBeforeBoot(page: Page, seed: SeedConfig): Promise<void> {
  await page.addInitScript(
    ({ themeKey, configKey, theme, mode }) => {
      try {
        if (theme) localStorage.setItem(themeKey, theme);
        const raw = localStorage.getItem(configKey);
        const config = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
        if (theme) {
          config["theme"] = theme;
          config["autoTheme"] = false;
        }
        if (mode) config["screenMode"] = mode;
        localStorage.setItem(configKey, JSON.stringify(config));
      } catch {
        /* quota / JSON errors in test env — non-fatal */
      }
    },
    {
      themeKey: LS_THEME_KEY,
      configKey: LS_CONFIG_KEY,
      theme: seed.theme ?? null,
      mode: seed.screenMode ?? null,
    },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Wait for at least one card shell to be present in the DOM. */
export async function waitForCards(page: Page, timeout = 8_000): Promise<void> {
  await page.waitForFunction(
    () => document.querySelectorAll("[data-card-id], .card-header").length > 0,
    { timeout },
  );
}

/**
 * Assert that a native `<dialog>` or element with `.visible` class is open.
 * Supports both `<dialog open>` and overlay `.visible` patterns used in the app.
 */
export async function expectOverlayOpen(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible({ timeout: 3_000 });
}

/** Assert overlay is closed (hidden, or not in DOM). */
export async function expectOverlayClosed(page: Page, selector: string): Promise<void> {
  const el = page.locator(selector).first();
  await expect(el).not.toBeVisible({ timeout: 3_000 });
}

/**
 * Press `key`, wait for the `selector` overlay to become visible. Returns the
 * locator for chaining.
 */
export async function pressAndOpen(
  page: Page,
  key: string,
  selector: string,
): Promise<ReturnType<Page["locator"]>> {
  await page.keyboard.press(key);
  await expectOverlayOpen(page, selector);
  return page.locator(selector).first();
}

// ── Fixture ──────────────────────────────────────────────────────────────

interface DashboardFixtures {
  /**
   * A `Page` already navigated to the dashboard and past first card render.
   * Uncaught JS errors (except benign View Transition skips) fail the test.
   */
  dashboardPage: Page;
}

export const test = base.extend<DashboardFixtures>({
  dashboardPage: async ({ page }, use) => {
    page.on("pageerror", (err) => {
      if (err.message.includes("Transition was skipped")) return;
      throw new Error(`Uncaught JS error: ${err.message}`);
    });
    await page.goto("/FamilyDashBoard/", { waitUntil: "domcontentloaded" });
    await waitForCards(page);
    await use(page);
  },
});

export { expect };

/**
 * Convenience: navigate with a pre-seeded theme/screenMode (for visual
 * regression or multi-mode suites). Prefer the `dashboardPage` fixture for
 * normal tests.
 */
export async function gotoWithSeed(page: Page, seed: SeedConfig): Promise<void> {
  await seedConfigBeforeBoot(page, seed);
  await page.goto("/FamilyDashBoard/", { waitUntil: "domcontentloaded" });
  await waitForCards(page, 12_000);
}
