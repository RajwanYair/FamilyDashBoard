/**
 * FamilyDashBoard — @vitest/browser config
 *
 * Sprint 145 (v13.16.0): activated browser-mode testing with real Chromium.
 * Tests in tests/browser/ run in headless Chromium via @vitest/browser-playwright.
 *
 * Requirements (installed in MyScripts/package.json):
 *   @vitest/browser@^4.1.5   @vitest/browser-playwright@^4.1.5
 *   npx playwright install chromium
 *
 * Run: npx vitest --config vitest.browser.config.ts
 */

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: resolve(__dirname, "src") }],
  },
  test: {
    // Browser mode — requires @vitest/browser + @vitest/browser-playwright
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium", launch: { headless: true } }],
    },
    include: ["tests/browser/**/*.spec.ts"],
    // No coverage — browser mode uses different instrumentation
    reporters: ["verbose"],
    testTimeout: 15_000,
  },
});
