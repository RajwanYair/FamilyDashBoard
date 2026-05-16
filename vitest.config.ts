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
        // Actuals: ~96.6 / ~89.8 / ~95.9 / ~97.5 — ratcheted with ~0.05% safety margin.
        // (v14.21.0): +0.1 ratchet per ROADMAP #10 — coverage ratchet → 97/90/96/98.
        statements: 96.6,
        branches: 89.8,
        functions: 95.9,
        lines: 97.5,
      },
    },
  },
});
