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
 * Score targets (Sprint 33 + V13 Sprint 12 + Sprint 72 + Sprint 114 + Sprint 126 + Sprint 226 + Sprint 314 + Sprint 449 additions):
 *   - simhash.ts            : mutation score ≥ 85%
 *   - d1-reports.ts         : mutation score ≥ 75%
 *   - analytics.ts          : mutation score ≥ 80%
 *   - canary.ts             : mutation score ≥ 90%
 *   - error-tracker.ts      : mutation score ≥ 85%  (V13 + raised Sprint 126 Roadmap #9)
 *   - config.ts             : mutation score ≥ 85%  (V13 + raised Sprint 126 Roadmap #9)
 *   - error-reporter.ts     : mutation score ≥ 75%  (Sprint 72)
 *   - diag.ts               : mutation score ≥ 85%  (Sprint 72 + raised Sprint 126 Roadmap #9)
 *   - signals.ts            : mutation score ≥ 85%  (Sprint 114)
 *   - fs-access.ts          : mutation score ≥ 75%  (Sprint 114)
 *   - idle.ts               : mutation score ≥ 75%  (Sprint 114)
 *   - cache.ts              : mutation score ≥ 85%  (Roadmap #9)
 *   - event-bus.ts          : mutation score ≥ 80%  (Sprint 226 — pub/sub logic)
 *   - keyboard.ts           : mutation score ≥ 80%  (Sprint 226 — keyboard shortcut dispatch)
 *   - links.ts              : mutation score ≥ 80%  (Sprint 226 — semantic link registry)
 *   - history.ts            : mutation score ≥ 80%  (Sprint 314 — sparklineSvg property-tested HP1-HP6)
 *   - sync.ts               : mutation score ≥ 80%  (Sprint 314 — backoff property-tested SYP1-SYP6)
 *   - fetch.ts              : mutation score ≥ 80%  (Sprint 314 — lock primitives property-tested FP1-FP5)
 *   - card-signal-protocol.ts : mutation score ≥ 80%  (Sprint 432 — CSP1-CSP5 property-tested)
 *   - semantic-clipboard.ts   : mutation score ≥ 80%  (Sprint 432 — SCP1-SCP5 property-tested)
 *   - provider.ts             : mutation score ≥ 80%  (Sprint 449 — PRP1-PRP6 property-tested; backoff + status logic)
 *   - utils.ts               : mutation score ≥ 80%  (Sprint 472 — UT1-UT8 property-tested; clamp, pad2, decomposeDuration, computeMoonPhase)
 *   - config-crypto.ts       : mutation score ≥ 80%  (Sprint 472 — CC1-CC8 property-tested; AES-GCM round-trip, IV uniqueness, prefix invariant)
 *   - worker-client.ts       : mutation score ≥ 75%  (Sprint 472 — worker-client-props property-tested)
 *
 * Sprint 126 (Roadmap #9): hard break threshold raised 75 → 85.
 * error-tracker, config, diag confirmed in scope. Overall gate: ≥ 85% or CI fails.
 * Sprint 226: extended scope to event-bus, keyboard, links (cross-card primitives).
 * Sprint 314: extended scope to history, sync, fetch (property-tested in Sprints 307-310).
 * Sprint 432: extended scope to card-signal-protocol + semantic-clipboard (X12/X15 core).
 * Sprint 449: extended scope to provider.ts (PRP1-PRP6 property-tested; backoff + status machine).
 * Sprint 472: extended scope to utils.ts, config-crypto.ts, worker-client.ts (property-tested in Sprints 470, 469).
 * Sprint 483: extended scope to perf.ts, i18n.ts, error-boundary.ts (property-tested PF1-PF9, I18N1-I18N7, EB1-EB6 in Sprints 479-481).
 * Sprint 490: extended scope to sw-constants.ts, trusted-types.ts (property-tested SW1-SW6, TT1-TT5 in Sprints 485, 488).
 * Sprint 497: extended scope to error-tracker.ts, idb-store.ts, keymap.ts (property-tested ET1-ET7, IDB1-IDB6, KM1-KM5).
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
    // Roadmap #9: dual-layer cache primitive (high blast-radius if mutated)
    "src/core/cache.ts",
    // Sprint 226: cross-card primitives — event-bus, keyboard, semantic links
    "src/core/event-bus.ts",
    "src/ui/keyboard.ts",
    "src/core/links.ts",
    // Sprint 314: property-tested pure algorithms — sparklineSvg, backoff, lock primitives
    "src/core/history.ts",
    "src/core/sync.ts",
    "src/core/fetch.ts",
    // Sprint 432: X12/X15 core — card-signal-protocol + semantic-clipboard
    "src/core/card-signal-protocol.ts",
    "src/core/semantic-clipboard.ts",
    // Sprint 449: provider-health model — backoff policy, status state machine (PRP1-PRP6)
    "src/core/provider.ts",
    // Sprint 472: pure-function modules fully property-tested (UT1-UT8, CC1-CC8, worker-client-props)
    "src/core/utils.ts",
    "src/core/config-crypto.ts",
    "src/core/worker-client.ts",
    // Sprint 483: property-tested formatVital/rateVital (PF1-PF9), t() (I18N1-I18N7), withErrorBoundary (EB1-EB6)
    "src/core/perf.ts",
    "src/core/i18n.ts",
    "src/core/error-boundary.ts",
    // Sprint 490: property-tested type-guards (SW1-SW6), TT passthrough (TT1-TT5), provider health (PV1-PV7)
    "src/core/sw-constants.ts",
    "src/core/trusted-types.ts",
    // Sprint 497: property-tested ring buffers + semantic primitives (DG1-DG7, IDB1-IDB6, ET1-ET7, CSP1-CSP6, SC1-SC6, KM1-KM5)
    "src/core/error-tracker.ts",
    "src/core/idb-store.ts",
    "src/core/keymap.ts",
    // Exclude generated/vendor code
    "!worker/src/**/*.d.ts",
    "!src/**/*.d.ts",
  ],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 85,
    low: 80,
    break: 85,
  },
  htmlReporter: {
    // Output to temp area per project patterns (never in project dir for CI)
    fileName: "stryker-report/mutation-report.html",
  },
  timeoutMS: 60000,
  // Focus mutation tests on Sprint 33 property test suites
  testRunnerNodeArgs: [],
};
