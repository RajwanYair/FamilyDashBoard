/**
 * Shared Vitest base config — vendored into this repo for CI self-sufficiency.
 * Source of truth: MyScripts/tooling/vitest/base.mjs
 * Keep in sync when upgrading Vitest.
 *
 * V11-PERF-1: pool=forks with maxForks=6 targets < 30 s for 3193 tests.
 * forks is preferred over threads to avoid happy-dom global-state contamination.
 */
export const sharedVitestTestConfig = {
  environment: "happy-dom",
  globals: true,
  pool: "forks",
  poolOptions: {
    forks: {
      // 6 worker processes: enough headroom for CI (GitHub Actions 4-core runner)
      // while avoiding excessive fork overhead. Each fork gets ~530 tests.
      maxForks: 6,
      minForks: 2,
    },
  },
  testTimeout: 10000,
  hookTimeout: 10000,
  restoreMocks: true,
};
