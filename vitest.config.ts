import { defineConfig } from "vitest/config";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, mkdirSync } from "node:fs";
import { sharedVitestTestConfig, sharedVitestPoolConfig } from "./tooling/vitest/base.mjs";

const root = import.meta.dirname;
const tempBase = join(tmpdir(), "fdb-dev");

// Pre-create the coverage .tmp directory to avoid a race-condition ENOENT on
// Windows when 150+ v8 workers all try to create it simultaneously.
mkdirSync(join(tempBase, "coverage", ".tmp"), { recursive: true });

const appVersion: string = (
  JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8")) as {
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
      { find: "@tests/helpers", replacement: resolve(root, "tests/helpers/index.ts") },
      {
        find: "@tests/worker-helpers",
        replacement: resolve(root, "tests/helpers/worker.ts"),
      },
      { find: "@tests", replacement: resolve(root, "tests/unit") },
      { find: "@", replacement: resolve(root, "src") },
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
      reporter: ["text", "lcov", "html", "json-summary"],
      reportsDirectory: join(tempBase, "coverage"),
      include: ["src/**/*.ts"],
      exclude: ["src/vite-env.d.ts", "src/**/*.d.ts", "src/preview.ts"],
      thresholds: {
        // Actuals (v14.23.0 run): 96.48 / 89.75 / 95.81 / 97.47 — 0.08% safety margin.
        // (v14.19.0): ratchet after config-presets (100% covered) + high-contrast tests.
        // (v14.21.0): coverage ratchet to 97/90/96/98 deferred — actuals sit exactly at
        // those numbers in CI, leaving zero safety margin. Will land in v15 with
        // additional under-tested modules brought up first.
        // (v14.23.0): statements lowered 96.5→96.4 (actual 96.48 was below threshold);
        //             lines ratcheted 97.4→97.45 (actual 97.47).
        // (v14.24.0): lines lowered 97.45→97.40 (actual 97.41–97.42 — slight dip after
        //             S1-S3 property suites; OTel telemetry.ts adds uncovered lines);
        //             branches held at 89.7 (actual exactly 89.70, no ratchet room).
        // (v14.26.0): ratchet all four after motivation/base-card/currency/calendar branch
        //             tests (Sprints 2-3) — actuals: 96.56 / 89.83 / 95.93 / 97.55.
        // (v14.27.0): Sprint 2 — zman-next + _lastSpecialNames.some() fix → 90.02% branches.
        //             actuals: 96.68 / 90.02 / 96.14 / 97.68.
        // (v14.27.0): Sprint 4 — cSetAsync quota + cEvictIdb stale + pressure error paths.
        //             actuals: 96.76 / 90.04 / 96.19 / 97.77.
        // (v14.27.0): Sprint 5 — config sanitize + migrate v6→v7 + i18n + fdb-card + RTT sparkline.
        //             actuals: 96.91 / 90.32 / 96.24 / 97.94.
        statements: 96.9,
        branches: 90.3,
        functions: 96.2,
        lines: 97.9,
      },
    },
  },
});
