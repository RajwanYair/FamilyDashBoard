import { defineConfig } from "vitest/config";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { sharedVitestTestConfig, sharedVitestPoolConfig } from "./tooling/vitest/base.mjs";

const tempBase = join(tmpdir(), "fdb-dev");

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
        // V11-DX-2: raised from 90/81/90/92 → 92/85/92/94
        statements: 92,
        branches: 85,
        functions: 92,
        lines: 94,
      },
    },
  },
});
