/**
 * FamilyDashBoard — E2E Smoke Tests (Stream G.2)
 *
 * Critical-flow smoke suite:
 *   - Page loads within budget
 *   - Required DOM landmarks are present
 *   - Title is set correctly
 *   - At least one card header is visible
 *   - No uncaught JS errors on load
 *
 * These tests run against `vite dev` at http://localhost:5173.
 * For visual regression baselines, run: npx playwright test --update-snapshots
 */

import { test, expect } from "@playwright/test";

test.describe("FamilyDashBoard — Smoke", () => {
  test.beforeEach(async ({ page }) => {
    // Capture any uncaught errors
    page.on("pageerror", (err) => {
      throw new Error(`Uncaught JS error: ${err.message}`);
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  test("page title is correct", async ({ page }) => {
    await expect(page).toHaveTitle(/לוח משפחתי|FamilyDashBoard/);
  });

  test("body element has RTL direction", async ({ page }) => {
    const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
    expect(dir).toBe("rtl");
  });

  test("at least one card header renders", async ({ page }) => {
    const headers = page.locator(".card-header");
    await expect(headers.first()).toBeVisible({ timeout: 8_000 });
    const count = await headers.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("main grid container is present", async ({ page }) => {
    // The 3-column grid — layout.css .main-grid or similar wrapper
    const grid = page.locator(".dashboard-grid, .main-grid, [class*='grid']").first();
    await expect(grid).toBeAttached({ timeout: 5_000 });
  });

  test("page loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {
      // networkidle can be flaky with live API calls — tolerate it
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5_000);
  });

  test("no critical meta-tag or manifest is missing", async ({ page }) => {
    // Manifest link
    const manifest = await page.$("link[rel='manifest']");
    expect(manifest).not.toBeNull();
    // Charset meta
    const charset = await page.$("meta[charset]");
    expect(charset).not.toBeNull();
    // Viewport meta
    const viewport = await page.$("meta[name='viewport']");
    expect(viewport).not.toBeNull();
  });
});

test.describe("FamilyDashBoard — Theme switching", () => {
  test("T key cycles the theme class on body", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for any card to render (signals JS is running)
    await page.waitForSelector(".card-header", { timeout: 8_000 });

    const beforeClass = await page.evaluate(() => document.body.className);
    await page.keyboard.press("t");
    const afterClass = await page.evaluate(() => document.body.className);

    // Theme class should have changed
    expect(afterClass).not.toBe(beforeClass);
  });
});
