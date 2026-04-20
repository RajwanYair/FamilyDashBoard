import { defineConfig, devices } from "@playwright/test";

/**
 * FamilyDashBoard — Playwright Configuration (Stream G.2)
 *
 * E2E tests live in tests/e2e/.
 * Run locally: npx playwright test
 * Run in CI:   npx playwright test --reporter=github
 *
 * Extends the shared base from MyScripts/tooling/playwright.base.ts.
 * The dev server (vite) must be available at http://localhost:5173.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "list",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // 1920×1080 — TV resolution target
    viewport: { width: 1920, height: 1080 },
    locale: "he-IL",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npx vite",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
