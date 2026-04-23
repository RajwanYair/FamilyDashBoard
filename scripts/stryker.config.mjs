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
 * Score targets (Sprint 33):
 *   - simhash.ts            : mutation score ≥ 85%
 *   - d1-reports.ts         : mutation score ≥ 75%
 *   - analytics.ts          : mutation score ≥ 80%
 *   - canary.ts             : mutation score ≥ 90%
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
    // Exclude generated/vendor code
    "!worker/src/**/*.d.ts",
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
