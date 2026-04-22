/**
 * Shared Vitest base config — vendored into this repo for CI self-sufficiency.
 * Source of truth: MyScripts/tooling/vitest/base.mjs
 * Keep in sync when upgrading Vitest.
 *
 * V11-PERF-1: pool=forks with dynamic fork count targets < 30 s for 3265 tests.
 * forks is preferred over threads to avoid happy-dom global-state contamination.
 */
import { availableParallelism } from "node:os";

// Use all available logical CPUs, capped at 8 to avoid excessive fork overhead.
// On a 4-core CI runner this yields 4; on a dev machine typically 6-8.
const cpuCount = Math.min(availableParallelism(), 8);

export const sharedVitestTestConfig = {
  environment: "happy-dom",
  globals: true,
  pool: "forks",
  poolOptions: {
    forks: {
      maxForks: cpuCount,
      minForks: Math.max(2, Math.floor(cpuCount / 2)),
    },
  },
  testTimeout: 10000,
  hookTimeout: 10000,
  restoreMocks: true,
};
