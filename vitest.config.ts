import { defineConfig } from "vitest/config";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";

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
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify("test-build"),
    __USE_PROXIES__: JSON.stringify(true),
  },
  cacheDir: join(tempBase, ".vitest"),
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    globals: true,

    // Isolate each test file in its own worker to prevent DOM state leakage
    // between suites (fixes the intermittent full-suite hang).
    pool: "forks",
    maxForks: 4,

    // Generous timeouts for SW + fetch tests
    testTimeout: 10000,
    hookTimeout: 10000,

    setupFiles: ["tests/setup.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: join(tempBase, "coverage"),
      include: ["src/**/*.ts"],
      exclude: ["src/vite-env.d.ts", "src/**/*.d.ts"],
      thresholds: {
        statements: 90,
        branches: 81,
        functions: 90,
        lines: 92,
      },
    },
  },
});
