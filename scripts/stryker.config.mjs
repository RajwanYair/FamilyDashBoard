/**
 * Stryker mutation testing configuration (V12-TESTING, Sprint 33).
 *
 * Targets the SimHash utility and its property invariants.
 * Run with: npx stryker run scripts/stryker.config.mjs
 *
 * Install Stryker in the MyScripts parent before running:
 *   npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner
 *   (from MyScripts/ directory — never add devDeps to FamilyDashBoard/package.json)
 *
 * Score targets (Sprint 33 + V13 Sprint 12 + Sprint 72 + Sprint 114 additions):
 *   - simhash.ts            : mutation score ≥ 85%
 *   - d1-reports.ts         : mutation score ≥ 75%
 *   - analytics.ts          : mutation score ≥ 80%
 *   - canary.ts             : mutation score ≥ 90%
 *   - error-tracker.ts      : mutation score ≥ 80%  (V13)
 *   - config.ts             : mutation score ≥ 75%  (V13)
 *   - error-reporter.ts     : mutation score ≥ 75%  (Sprint 72)
 *   - diag.ts               : mutation score ≥ 70%  (Sprint 72)
 *   - signals.ts            : mutation score ≥ 85%  (Sprint 114)
 *   - fs-access.ts          : mutation score ≥ 75%  (Sprint 114)
 *   - idle.ts               : mutation score ≥ 75%  (Sprint 114)
 */

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  mutate: [
    // Core worker utilities targeted for mutation testing
    "worker/src/utils/simhash.ts",
    "worker/src/utils/analytics.ts",
    "worker/src/utils/d1-reports.ts",
    "worker/src/middleware/canary.ts",
    // V13 Sprint 12: expand coverage to client-side core modules
    "src/core/error-tracker.ts",
    "src/core/config.ts",
    // Sprint 72: extend to error-reporter + diag (client-side error pipeline)
    "src/core/error-reporter.ts",
    "src/core/diag.ts",
    // Sprint 114: extend to signals primitive, FS Access wrapper, and idle scheduler
    "src/core/signals.ts",
    "src/core/fs-access.ts",
    "src/core/idle.ts",
    // Exclude generated/vendor code
    "!worker/src/**/*.d.ts",
    "!src/**/*.d.ts",
  ],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 85,
    low: 70,
    break: 60,
  },
  htmlReporter: {
    // Output to temp area per project patterns (never in project dir for CI)
    fileName: "stryker-report/mutation-report.html",
  },
  timeoutMS: 60000,
  // Focus mutation tests on Sprint 33 property test suites
  testRunnerNodeArgs: [],
};
