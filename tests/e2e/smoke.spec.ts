/**
 * FamilyDashBoard — E2E Smoke Tests
 *
 * Critical-flow smoke suite: page boots cleanly, essential landmarks render,
 * RTL + theming wired. Kept intentionally small — deep interaction coverage
 * lives in `critical-flows.spec.ts`, `card-interactions.spec.ts`, etc.
 */

import { test, expect, SEL } from "./fixtures";

test.describe("Smoke — boot & landmarks", () => {
  test("page title renders", async ({ dashboardPage }) => {
    await expect(dashboardPage).toHaveTitle(/לוח משפחתי|Family Dashboard|FamilyDashBoard/);
  });

  test("<html> is RTL", async ({ dashboardPage }) => {
    const dir = await dashboardPage.evaluate(() => document.documentElement.getAttribute("dir"));
    expect(dir).toBe("rtl");
  });

  test("at least one card shell renders", async ({ dashboardPage }) => {
    const cards = dashboardPage.locator(SEL.card);
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  test("manifest + charset + viewport meta are present", async ({ dashboardPage }) => {
    for (const sel of ["link[rel='manifest']", "meta[charset]", "meta[name='viewport']"]) {
      await expect(dashboardPage.locator(sel)).toHaveCount(1);
    }
  });

  test("skip-to-main-content link is wired", async ({ dashboardPage }) => {
    const skip = dashboardPage.locator(SEL.skipLink);
    await expect(skip).toBeAttached();
    await expect(skip).toHaveAttribute("href", "#main-content");
  });
});

test.describe("Smoke — theme cycling", () => {
  test("T key mutates theme state", async ({ dashboardPage }) => {
    const before = await dashboardPage.evaluate(
      () => document.documentElement.dataset["theme"] ?? document.body.className,
    );
    await dashboardPage.keyboard.press("t");
    await dashboardPage.waitForFunction(
      (prev) =>
        (document.documentElement.dataset["theme"] ?? document.body.className) !== prev,
      before,
      { timeout: 2_000 },
    );
    const after = await dashboardPage.evaluate(
      () => document.documentElement.dataset["theme"] ?? document.body.className,
    );
    expect(after).not.toBe(before);
  });
});
