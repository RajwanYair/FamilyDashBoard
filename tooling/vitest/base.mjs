/**
 * Shared Vitest base config — vendored into this repo for CI self-sufficiency.
 * Source of truth: MyScripts/tooling/vitest/base.mjs
 * Keep in sync when upgrading Vitest.
 */
export const sharedVitestTestConfig = {
  environment: "happy-dom",
  globals: true,
  pool: "forks",
  maxForks: 4,
  testTimeout: 10000,
  hookTimeout: 10000,
  restoreMocks: true,
};
