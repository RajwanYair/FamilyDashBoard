import { defineConfig, devices } from "@playwright/test";

/**
 * FamilyDashBoard — Playwright Configuration
 *
 * E2E tests live in tests/e2e/.
 * Run locally: npx playwright test
 * Run in CI:   npx playwright test --reporter=github
 *
 * Browser strategy:
 *   - Chromium: ALL tests (full suite including visual regression)
 *   - Firefox, WebKit, Edge: smoke + a11y only (tagged @cross-browser)
 *   - Mobile Chrome (Pixel 5), Mobile Safari (iPhone 13): smoke + a11y only
 *   - Samsung Internet (Galaxy S9+): smoke + a11y only
 *   - Tablet: iPad Pro 11 (Safari) + Galaxy Tab S4 (Android): smoke + a11y only
 *
 * Visual regression baselines are Chromium-only by design — per-engine rendering
 * differences are intentional, not bugs. Cross-browser tests validate layout
 * correctness and accessibility rather than pixel-perfect output.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 25_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : 4,
  reporter: process.env["CI"] ? "github" : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // 1920×1080 — TV resolution target (overridden per project as needed)
    viewport: { width: 1920, height: 1080 },
    locale: "he-IL",
  },

  projects: [
    // ── Primary: full suite on Chromium ───────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Cross-browser: smoke + a11y on Firefox ───────────────────────
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1920, height: 1080 },
        locale: "he-IL",
      },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },

    // ── Cross-browser: smoke + a11y on WebKit (Safari) ───────────────
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1920, height: 1080 },
        locale: "he-IL",
      },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },

    // ── Cross-browser: smoke + a11y on Edge (Chromium engine) ────────
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], viewport: { width: 1920, height: 1080 }, locale: "he-IL" },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },

    // ── Mobile: smoke + a11y on Android Chrome (Pixel 5) ─────────────
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"], locale: "he-IL" },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },

    // ── Mobile: smoke + a11y on Mobile Safari (iPhone 13) ────────────
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"], locale: "he-IL" },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },

    // ── Tablet: smoke + a11y on iPad (Safari) ────────────────────────
    {
      name: "tablet-safari",
      use: { ...devices["iPad Pro 11"], locale: "he-IL" },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },
    // ── Tablet: smoke + a11y on Galaxy Tab (Android) ─────────────────────
    {
      name: "tablet-android",
      use: { ...devices["Galaxy Tab S4"], locale: "he-IL" },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },

    // ── Mobile: smoke + a11y on Galaxy S9+ (Samsung Internet) ────────────
    {
      name: "mobile-samsung",
      use: { ...devices["Galaxy S9+"], locale: "he-IL" },
      testMatch: /smoke\.spec\.ts|accessibility\.spec\.ts/,
    },
  ],

  webServer: {
    command: "npx vite",
    url: "http://localhost:3000/FamilyDashBoard/",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
