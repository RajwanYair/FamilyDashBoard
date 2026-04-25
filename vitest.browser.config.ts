/**
 * FamilyDashBoard — @vitest/browser scaffold config
 *
 * Sprint 69 (v13.6.0): skeleton configuration for browser-mode testing.
 * Purpose: test FLIP/drag-card animations, maximize-card transitions,
 * and other DOM behaviours that require a real browser (not happy-dom).
 *
 * To run:  npx vitest --config vitest.browser.config.ts
 *
 * Requirements (not yet in MyScripts/package.json — add before activating):
 *   npm install -D @vitest/browser playwright
 *   npx playwright install chromium
 *
 * Until those packages are installed this config is intentionally kept
 * import-free from @vitest/browser so the file typechecks without it.
 */

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
  test: {
    // Browser mode — requires @vitest/browser + playwright to be installed
    browser: {
      enabled: true,
      name: "chromium",
      provider: "playwright",
      headless: true,
    },
    include: ["tests/browser/**/*.spec.ts"],
    // No coverage — browser mode uses different instrumentation
    reporters: ["verbose"],
    testTimeout: 15_000,
  },
});
