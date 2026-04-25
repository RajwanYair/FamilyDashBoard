import { defineConfig } from "vitest/config";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, mkdirSync } from "node:fs";
import { sharedVitestTestConfig, sharedVitestPoolConfig } from "./tooling/vitest/base.mjs";

const tempBase = join(tmpdir(), "fdb-dev");

// Pre-create the coverage .tmp directory to avoid a race-condition ENOENT on
// Windows when 150+ v8 workers all try to create it simultaneously.
mkdirSync(join(tempBase, "coverage", ".tmp"), { recursive: true });

const appVersion: string = (
  JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as {
    version: string;
  }
).version;

/**
 * Vitest configuration — separate from vite.config.ts so test-only settings
 * don't bleed into the production build and vice versa.
 */
export default defineConfig({
  // Vitest 4: pool and poolOptions must be top-level (not under test:)
  ...sharedVitestPoolConfig,
  resolve: {
    alias: [
      { find: "@tests/helpers", replacement: resolve(__dirname, "tests/helpers/index.ts") },
      {
        find: "@tests/worker-helpers",
        replacement: resolve(__dirname, "tests/helpers/worker.ts"),
      },
      { find: "@tests", replacement: resolve(__dirname, "tests/unit") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify("test-build"),
    __USE_PROXIES__: JSON.stringify(true),
  },
  cacheDir: join(tempBase, ".vitest"),
  test: {
    include: ["tests/**/*.test.ts"],
    ...sharedVitestTestConfig,

    setupFiles: ["tests/setup.ts"],

    // CI: stop on first failure to surface errors quickly without spinning all
    // 94 suites.  Locally keep bail=0 so watch mode always shows full status.
    bail: process.env["CI"] ? 1 : 0,

    // CI: annotate failing files as GitHub check annotations.
    // Locally: default reporter (compact, colour output).
    reporters: process.env["CI"] ? ["github-actions", "default"] : ["default"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: join(tempBase, "coverage"),
      include: ["src/**/*.ts"],
      exclude: ["src/vite-env.d.ts", "src/**/*.d.ts"],
      thresholds: {
        // V13-OPS/AI: calibrated after Sprint 6-7 added new worker code
        // (feeds.ts embedding pass + cron.ts weekly digest) which expanded
        // coverage surface. New tests added for cron handlers + trusted-types.
        // Sprints 11-17: encodeConnType, recurrence badge, a11y text-spacing,
        //   dialog-audit, openapi routes, SRI docs — all new paths covered.
        // Sprint 28: response.ts null-CT + rss-parser entity branches + nws night-day-order
        // Sprint 49: branches 78→79 (actual 79.16% after nws-normalize + feeds.ts coverage)
        // Sprint 59: ratchet — confirmed actuals 88.84 / 80.72 / 88.21 / 90.12
        //   New tests: calendar RFC-5545 fuzz (59 tests), tasks yearly (3), simhash (3),
        //   config-panel network-mode (4) — each adds statement + function coverage.
        // Sprint 66: measured actuals 88.81/80.65/88.21/90.06 — thresholds held at 88/80/88/90.
        //   To ratchet further, tests must cover LOW-coverage files (branches < 70%).
        // Target v13 final: 95/90/95/96 (multi-sprint increments, +1 per minor release)
        statements: 88,
        branches: 80,
        functions: 88,
        lines: 90,
      },
    },
  },
});
