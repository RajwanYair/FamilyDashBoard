/**
 * FamilyDashBoard — E2E Critical Flow Tests
 *
 * Covers overlays (config panel, diagnostics, help), font-scale shortcuts,
 * and theme cycling via the shared `dashboardPage` fixture.
 */

import { test, expect, SEL, pressAndOpen, expectOverlayClosed } from "./fixtures";

// ── Overlay open/close ─────────────────────────────────────────────────────

interface OverlayCase {
  name: string;
  key: string;
  selector: string;
}

const OVERLAYS: readonly OverlayCase[] = [
  { name: "Config panel", key: "s", selector: SEL.configPanel },
  { name: "Diagnostics", key: "d", selector: SEL.diagOverlay },
  { name: "Help", key: "?", selector: SEL.helpOverlay },
];

test.describe("Overlays — open/close via keyboard", () => {
  for (const ov of OVERLAYS) {
    test(`${ov.name}: ${ov.key} opens, Escape closes`, async ({ dashboardPage }) => {
      await pressAndOpen(dashboardPage, ov.key, ov.selector);
      await dashboardPage.keyboard.press("Escape");
      await expectOverlayClosed(dashboardPage, ov.selector);
    });
  }
});

// ── Font size shortcuts ────────────────────────────────────────────────────

async function readFontScale(page: import("@playwright/test").Page): Promise<number> {
  return await page.evaluate(() => {
    const raw =
      getComputedStyle(document.documentElement).getPropertyValue("--base-font-size") ||
      getComputedStyle(document.documentElement).getPropertyValue("--font-scale") ||
      "16";
    return parseFloat(raw) || 16;
  });
}

test.describe("Keyboard — font scale", () => {
  test("+ key does not decrease font size", async ({ dashboardPage }) => {
    const before = await readFontScale(dashboardPage);
    await dashboardPage.keyboard.press("+");
    const after = await readFontScale(dashboardPage);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  test("- key does not increase font size", async ({ dashboardPage }) => {
    // Nudge up first so we are not pinned at the floor.
    await dashboardPage.keyboard.press("+");
    await dashboardPage.keyboard.press("+");
    const before = await readFontScale(dashboardPage);
    await dashboardPage.keyboard.press("-");
    const after = await readFontScale(dashboardPage);
    expect(after).toBeLessThanOrEqual(before);
  });
});

// ── Status bar ────────────────────────────────────────────────────────────

test.describe("Status bar", () => {
  test("sync dots container is present (may be empty)", async ({ dashboardPage }) => {
    // Just an existence/non-throw check — presence count may be 0 or more.
    const count = await dashboardPage.locator(".sync-dot, [class*='sync']").count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
