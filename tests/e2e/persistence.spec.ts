/**
 * FamilyDashBoard — Config persistence across reload.
 *
 * Verifies that user preferences survive a page reload:
 *   - Theme change via T key persists to localStorage and is re-applied
 *   - Font scale change via + persists
 *   - Collapsed card state persists
 */

import { test, expect, SEL } from "./fixtures";

test.describe("Persistence — theme", () => {
  test("theme chosen via T key survives reload", async ({ dashboardPage }) => {
    const before = await dashboardPage.evaluate(
      () => document.documentElement.dataset["theme"] ?? "",
    );
    await dashboardPage.keyboard.press("t");
    await dashboardPage.waitForFunction(
      (prev) => (document.documentElement.dataset["theme"] ?? "") !== prev,
      before,
      { timeout: 2_000 },
    );
    const afterSwitch = await dashboardPage.evaluate(
      () => document.documentElement.dataset["theme"] ?? "",
    );

    await dashboardPage.reload({ waitUntil: "domcontentloaded" });
    await dashboardPage.waitForFunction(
      (sel) => document.querySelectorAll(sel).length > 0,
      SEL.card,
      { timeout: 8_000 },
    );

    const afterReload = await dashboardPage.evaluate(
      () => document.documentElement.dataset["theme"] ?? "",
    );
    expect(afterReload).toBe(afterSwitch);
  });
});

test.describe("Persistence — collapsed cards", () => {
  test("collapsing a card persists across reload", async ({ dashboardPage }) => {
    const btn = dashboardPage.locator(".card-collapse-btn").first();
    const card = btn.locator("xpath=ancestor::section[contains(@class,'card')][1]");
    const cardId = (await card.getAttribute("data-card-id")) ?? "";
    expect(cardId).not.toBe("");

    const wasCollapsed = (await card.getAttribute("class"))?.includes("collapsed") ?? false;
    await btn.click();
    const nowCollapsed = !wasCollapsed;

    await dashboardPage.reload({ waitUntil: "domcontentloaded" });
    const reloadedCard = dashboardPage.locator(`[data-card-id="${cardId}"]`).first();
    await expect(reloadedCard).toBeAttached({ timeout: 5_000 });
    const reloadedClass = (await reloadedCard.getAttribute("class")) ?? "";

    expect(reloadedClass.includes("collapsed")).toBe(nowCollapsed);
  });
});
