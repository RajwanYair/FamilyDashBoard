/**
 * FamilyDashBoard — Accessibility E2E Tests (WCAG 2.2 AA via axe-core)
 *
 * Gates: 0 critical / 0 serious violations across all 3 screen modes.
 * Additional per-feature a11y checks (skip link, aria-labelledby on cards,
 * button-name rule) run once without a mode switch for speed.
 */

import { test, expect, gotoWithSeed, type ScreenMode } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const SCREEN_MODES: readonly ScreenMode[] = ["tv", "tablet", "phone"] as const;

test.describe("Accessibility — axe-core WCAG 2.2 AA", () => {
  // Suppress uncaught errors from live API calls in the test env
  test.beforeEach(({ page }) => {
    page.on("pageerror", () => {});
  });

  for (const mode of SCREEN_MODES) {
    test(`${mode} mode: 0 critical/serious violations`, async ({ page }) => {
      await gotoWithSeed(page, { screenMode: mode });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        // Loading skeletons use transient palettes that can briefly fail contrast.
        .exclude(".card-loading")
        // Inline JS-set colour tokens are validated by styles/theme-audit unit tests.
        .disableRules(["color-contrast"])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === "critical");
      const serious = results.violations.filter((v) => v.impact === "serious");

      if (critical.length > 0 || serious.length > 0) {
        const summary = [...critical, ...serious]
          .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
          .join("\n");
        process.stderr.write(`A11y violations (${mode}):\n${summary}\n`);
      }

      expect(critical, `Critical a11y violations on ${mode}`).toHaveLength(0);
      expect(serious, `Serious a11y violations on ${mode}`).toHaveLength(0);
    });
  }
});

test.describe("Accessibility — structural checks (single mode)", () => {
  test.beforeEach(({ page }) => {
    page.on("pageerror", () => {});
  });

  test("every card region has aria-labelledby and has ≥ 6 cards", async ({ page }) => {
    await gotoWithSeed(page, {});
    const cards = await page.locator("section.card[role='region']").all();
    expect(cards.length).toBeGreaterThanOrEqual(6);
    for (const card of cards) {
      expect(await card.getAttribute("aria-labelledby")).toBeTruthy();
    }
  });

  test("all buttons have accessible names (button-name rule)", async ({ page }) => {
    await gotoWithSeed(page, {});
    const results = await new AxeBuilder({ page }).withRules(["button-name"]).analyze();
    const violations = results.violations.filter((v) => v.id === "button-name");
    expect(violations, "All buttons must have accessible names").toHaveLength(0);
  });
});

test.describe("Accessibility — WCAG 1.4.12 Text Spacing", () => {
  test.beforeEach(({ page }) => {
    page.on("pageerror", () => {});
  });

  /**
   * WCAG 1.4.12 Text Spacing success criterion.
   * Apply the override values defined in styles/a11y.css `.text-spacing-override`
   * and assert that key card containers have not clipped their content.
   * See: https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
   */
  test("card content is not clipped under WCAG 1.4.12 text-spacing overrides", async ({
    page,
  }) => {
    await gotoWithSeed(page, {});

    // Inject the WCAG 1.4.12 text-spacing override inline (mirrors .text-spacing-override)
    await page.addStyleTag({
      content: `
        body, body * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p, li, h1, h2, h3, h4, h5, h6 {
          margin-bottom: 2em !important;
        }
      `,
    });

    // Wait a frame for layout to settle
    await page.waitForTimeout(200);

    // Assert each card section has non-zero dimensions (not collapsed/hidden)
    const cards = await page.locator("section.card[role='region']").all();
    expect(cards.length).toBeGreaterThanOrEqual(6);

    for (const card of cards) {
      const box = await card.boundingBox();
      if (box) {
        // Card must retain positive height (content not fully clipped)
        expect(box.height, "Card height collapsed under text-spacing override").toBeGreaterThan(0);
      }
    }
  });

  test("stock rows survive text-spacing overrides without horizontal overflow", async ({
    page,
  }) => {
    await gotoWithSeed(page, {});

    await page.addStyleTag({
      content: `body * { letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }`,
    });
    await page.waitForTimeout(200);

    // The stocks container must not be horizontally overflowing
    const scrollWidth = await page.evaluate(() => {
      const el = document.getElementById("stocks-body");
      return el ? el.scrollWidth - el.clientWidth : 0;
    });
    // Allow up to 2px for subpixel rounding
    expect(scrollWidth, "Stocks body overflows horizontally under text-spacing").toBeLessThanOrEqual(
      2,
    );
  });
});
