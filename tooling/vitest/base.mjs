/**
 * Shared Vitest base config — vendored into this repo for CI self-sufficiency.
 * Source of truth: MyScripts/tooling/vitest/base.mjs
 * Keep in sync when upgrading Vitest.
 *
 * pool=forks with dynamic fork count targets < 30 s for 3265 tests.
 * forks is preferred over threads to avoid happy-dom global-state contamination.
 *
 * NOTE: In Vitest 4, `pool` and `poolOptions` are top-level config options.
 * They MUST NOT be placed inside the `test:` block. This shared object is
 * meant to be spread into `test:` — pool/poolOptions are exported separately.
 */
import { availableParallelism } from "node:os";

// Use all available logical CPUs, capped at 8 to avoid excessive fork overhead.
const cpuCount = Math.min(availableParallelism(), 8);

/** Spread into top-level defineConfig (NOT into test:). */
export const sharedVitestPoolConfig = {
  pool: "forks",
  poolOptions: {
    forks: {
      maxForks: cpuCount,
      minForks: Math.max(2, Math.floor(cpuCount / 2)),
      // Re-use the module registry across files in the same fork.
      // Each suite still runs in its own JS context (isolate: false only
      // removes the per-file module re-import overhead, not the test isolation).
      // Tests that mutate global state must use beforeEach/afterEach reset.
      isolate: false,
    },
  },
};

/** Spread into the `test:` block of defineConfig. */
export const sharedVitestTestConfig = {
  environment: "happy-dom",
  globals: true,
  testTimeout: 10000,
  hookTimeout: 10000,
  teardownTimeout: 3000,
  restoreMocks: true,
};
