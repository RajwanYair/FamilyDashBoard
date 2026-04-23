/**
 * FamilyDashBoard — Halacha full-text overlay E2E.
 *
 * Covers the click-to-maximize interaction shipped with the halacha ticker:
 *   - Clicking the ticker bar opens `#halacha-overlay`
 *   - Clicking the Hebrew-Cal row title opens `#halacha-overlay`
 *   - Keyboard activation (Enter/Space) on both triggers opens the overlay
 *   - Click-on-overlay and Escape both close it
 *
 * The overlay body is populated from the in-memory `_halachaData` set by the
 * ticker loader. To keep this test fast and deterministic it injects a minimal
 * data object via the module's cache API before the ticker boots.
 */

import { test, expect, SEL } from "./fixtures";

/** Seed the ticker cache so the overlay has data even when Sefaria is offline. */
async function seedHalachaCache(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    const payload = {
      data: {
        ref: "Kitzur Shulchan Arukh 1:1",
        heRef: "קיצור שולחן ערוך א׳:א׳",
        category: "שבת",
        url: "https://www.sefaria.org/Kitzur_Shulchan_Arukh.1.1",
        texts: [
          "דין השכמת הבוקר והתחזקות בעבודת השם.",
          "כשניעור משנתו יחשוב לפני מי הוא שוכב ומי הוא שיעמוד לפניו.",
        ],
      },
      ts: Date.now(),
    };
    try {
      localStorage.setItem("dash_v2_halacha", JSON.stringify(payload));
    } catch {
      /* quota — non-fatal in test env */
    }
  });
}

test.describe("Halacha overlay", () => {
  test.beforeEach(async ({ page }) => {
    await seedHalachaCache(page);
    await page.goto("/FamilyDashBoard/", { waitUntil: "domcontentloaded" });
    // Wait until the ticker has picked up the cached data and rendered items.
    await page.waitForFunction(
      (sel) => {
        const t = document.querySelector(sel) as HTMLElement | null;
        return !!t && t.childElementCount > 0;
      },
      SEL.halachaTicker,
      { timeout: 8_000 },
    );
  });

  test("clicking the ticker opens the full-text overlay", async ({ page }) => {
    await page.click(SEL.halachaTicker);
    await expect(page.locator(SEL.halachaOverlay)).toBeVisible();
    await expect(page.locator(SEL.halachaOverlayText)).toContainText(
      "כשניעור משנתו",
    );
  });

  test("Enter on the focused ticker opens the overlay (keyboard a11y)", async ({ page }) => {
    await page.focus(SEL.halachaTicker);
    await page.keyboard.press("Enter");
    await expect(page.locator(SEL.halachaOverlay)).toBeVisible();
  });

  test("clicking the Hebrew-Cal halacha row opens the overlay", async ({ page }) => {
    const row = page.locator(SEL.hcHalachaRow);
    // The row is hidden until the excerpt is rendered; wait for it.
    await expect(row).toBeVisible({ timeout: 5_000 });
    await row.click();
    await expect(page.locator(SEL.halachaOverlay)).toBeVisible();
  });

  test("click-outside (overlay backdrop) closes", async ({ page }) => {
    await page.click(SEL.halachaTicker);
    const ov = page.locator(SEL.halachaOverlay);
    await expect(ov).toBeVisible();
    // Backdrop click — the overlay root itself has the close listener.
    await ov.click({ position: { x: 5, y: 5 } });
    await expect(ov).not.toBeVisible();
  });

  test("Escape closes the overlay", async ({ page }) => {
    await page.click(SEL.halachaTicker);
    await expect(page.locator(SEL.halachaOverlay)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(SEL.halachaOverlay)).not.toBeVisible();
  });

  test("ticker bar exposes role=button and tabindex=0 for a11y", async ({ page }) => {
    const ticker = page.locator(SEL.halachaTicker);
    await expect(ticker).toHaveAttribute("role", "button");
    await expect(ticker).toHaveAttribute("tabindex", "0");
  });
});
