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
  // forks pool: each OS process is killed by the OS when vitest terminates,
  // so even if a worker has lingering handles (real timers, observers) the
  // process is reaped cleanly. isolate:true (the default) gives each test
  // file a fresh module registry, so singleton timers/observers created by
  // one file cannot leak into the next file in the same fork.
  pool: "forks",
  poolOptions: {
    forks: {
      maxForks: cpuCount,
      minForks: Math.max(2, Math.floor(cpuCount / 2)),
      // isolate: true is the Vitest default — each test file gets its own
      // module registry within the fork. This prevents module-level singletons
      // (setInterval handles, PerformanceObserver instances) from leaking
      // across test files and keeping the fork process alive past teardown.
    },
  },
};

/** Spread into the `test:` block of defineConfig. */
export const sharedVitestTestConfig = {
  environment: "happy-dom",
  globals: true,
  testTimeout: 10000,
  hookTimeout: 10000,
  teardownTimeout: 5000,
  // Force-exit after tests complete — prevents happy-dom iframe/fetch handles
  // from keeping the Vite server alive indefinitely (YouTube/i24news URLs).
  forceExit: true,
  restoreMocks: true,
  // Disable happy-dom network features that cause hangs in the VS Code test
  // runner. The video-news card sets iframe.src to YouTube/i24news URLs which
  // happy-dom would otherwise fetch in the background — those sockets remain
  // open at teardown and prevent the Vite server from exiting.
  // (Iframe src loading is neutralised in tests/setup.ts via a getter override.)
  environmentOptions: {
    happyDOM: {
      settings: {
        disableJavaScriptFileLoading: true,
        disableCSSFileLoading: true,
        disableComputedStyleRendering: true,
        handleDisabledFileLoadingAsSuccess: true,
        fetch: {
          disableSameOriginPolicy: true,
        },
      },
    },
  },
};
