/**
 * FamilyDashBoard — Card interaction E2E.
 *
 * Covers the core UX affordances on card shells:
 *   - Click on `.card-header` maximizes the card (adds `.maximized`)
 *   - Clicking the header again collapses it (removes `.maximized`)
 *   - `.card-collapse-btn` toggles the `.collapsed` class
 *   - Collapsed state persists to localStorage under `LS_COLLAPSED`
 */

import { test, expect, SEL } from "./fixtures";

test.describe("Card interactions — maximize", () => {
  test("clicking a card header toggles .maximized", async ({ dashboardPage }) => {
    const header = dashboardPage.locator(SEL.cardHeader).first();
    const card = header.locator("xpath=ancestor::section[contains(@class,'card')][1]");

    await expect(card).not.toHaveClass(/maximized/);
    await header.click();
    await expect(card).toHaveClass(/maximized/);
    // Click again to collapse.
    await header.click();
    await expect(card).not.toHaveClass(/maximized/);
  });
});

test.describe("Card interactions — collapse", () => {
  test("collapse button toggles the `.collapsed` class and persists", async ({ dashboardPage }) => {
    const btn = dashboardPage.locator(".card-collapse-btn").first();
    const card = btn.locator("xpath=ancestor::section[contains(@class,'card')][1]");
    const cardId = await card.getAttribute("data-card-id");
    expect(cardId).toBeTruthy();

    const wasCollapsed = (await card.getAttribute("class"))?.includes("collapsed") ?? false;
    await btn.click();
    // Expect the class to have flipped.
    if (wasCollapsed) {
      await expect(card).not.toHaveClass(/collapsed/);
    } else {
      await expect(card).toHaveClass(/collapsed/);
    }

    // Verify persistence shape: localStorage LS_COLLAPSED is a JSON array of ids.
    const persisted = await dashboardPage.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem("dash_v2_collapsed_cards") ?? "[]") as string[];
      } catch {
        return [] as string[];
      }
    });
    const nowCollapsed = (await card.getAttribute("class"))?.includes("collapsed") ?? false;
    expect(persisted.includes(cardId!)).toBe(nowCollapsed);
  });
});
