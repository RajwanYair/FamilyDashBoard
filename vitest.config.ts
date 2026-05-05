import { defineConfig } from "vitest/config";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync, mkdirSync } from "node:fs";
import { sharedVitestTestConfig, sharedVitestPoolConfig } from "./tooling/vitest/base.mjs";

const tempBase = join(tmpdir(), "fdb-dev");

// Pre-create the coverage .tmp directory to avoid a race-condition ENOENT on
// Windows when 150+ v8 workers all try to create it simultaneously.
mkdirSync(join(tempBase, "coverage", ".tmp"), { recursive: true });

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
      reporter: ["text", "lcov", "html", "json-summary"],
      reportsDirectory: join(tempBase, "coverage"),
      include: ["src/**/*.ts"],
      exclude: ["src/vite-env.d.ts", "src/**/*.d.ts", "src/preview.ts"],
      thresholds: {
        // V13-OPS/AI: calibrated after Sprint 6-7 added new worker code
        // (feeds.ts embedding pass + cron.ts weekly digest) which expanded
        // coverage surface. New tests added for cron handlers + trusted-types.
        // Sprints 11-17: encodeConnType, recurrence badge, a11y text-spacing,
        //   dialog-audit, openapi routes, SRI docs — all new paths covered.
        // Sprint 28: response.ts null-CT + rss-parser entity branches + nws night-day-order
        // Sprint 49: branches 78→79 (actual 79.16% after nws-normalize + feeds.ts coverage)
        // Sprint 59: ratchet — confirmed actuals 88.84 / 80.72 / 88.21 / 90.12
        //   New tests: calendar RFC-5545 fuzz (59 tests), tasks yearly (3), simhash (3),
        //   config-panel network-mode (4) — each adds statement + function coverage.
        // Sprint 66: measured actuals 88.81/80.65/88.21/90.06 — thresholds held at 88/80/88/90.
        //   To ratchet further, tests must cover LOW-coverage files (branches < 70%).
        // Sprint 86: actuals 88.95/81.01/88.56/90.18 — ratchet +1 per metric.
        //   New tests Sprints 77-85: calendar fuzz, NWS travel-mode, system-info,
        //   simhash, nws-normalize, config-panel, countdown, tasks addQuickChore,
        //   motivation branches, diag-overlay, theme, config resetCardConfig.
        // Target v13 final: 95/90/95/96 (multi-sprint increments, +1 per minor release)
        // Sprint 96 (v13.8.0): actuals 89.35/81.84/89.02/90.51 — ratchet to 89/81/89/90.
        //   New tests Sprints 87-96: cache IDB, weather, calendar, stocks, hebrew-cal,
        //   bg-images, diag-overlay (network tier/trend), sync animationend, card-registry
        //   countdown+video-news loadCard, legacyAdapter render fn. +66 tests = 4802 total.
        // Sprint 116 (v13.11.0): actuals 89.35/81.84/89.02/90.51 — margins too tight to ratchet
        //   (81.84 < 82, 90.51 < 91). Held at Sprint-96 values; ratchet deferred to next sprint
        //   once branch/line coverage improves by adding targeted tests.
        // Roadmap #8 (Sprint 8 of post-13.13.0 batch): actuals 89.34/81.73/89.05/90.45.
        //   Margins too tight for integer ratchet. Tightened to fractional values
        //   89.3/81.7/89/90.4 — preserves regression detection without false-fail.
        // Sprint 120 (Roadmap #8 ratchet): +69 branch tests (perf.ts + vitals-reporter.ts).
        //   Actuals: 89.33/81.89/89.05/90.43. Raised branches 81.7 → 81.8 to lock in gain.
        //   Full ratchet to 92/85/92/93 continues in subsequent sprints.
        // Sprint 129 (Roadmap #8 maintenance): Sprint 121 added app-signals.ts + _bridgeToSignals
        //   in state.ts (new async .then/.catch callbacks). Actual functions 88.98% — threshold
        //   temporarily anchored at 88.9 to unblock CI. Sprint 132 will add branch+function tests
        //   to ratchet functions back to 89.0+ alongside branches 81.8→82.0.
        // Sprint 143 (Roadmap #8 coverage): excluded src/preview.ts (dev-only, 0% cover).
        //   Added: fdb-video-news.test.ts (+12), main (+7 branch tests), diag-overlay (+1 interval)
        //   fdb-weather/news/stocks (+2 each). Actuals: 93.62/85.39/92.63/94.87.
        //   Raised thresholds to 93.5/85.0/92.5/94.7.
        // Sprint 153 (coverage ratchet batch): +16 tests across 5 files — rate-limiter-do,
        //   rss-parser, open-meteo-adapter, hebcal-adapter, ai (worker). Actuals:
        //   93.68/85.63/92.63/94.92. Raised branches 85.0 → 85.5.
        // Sprint 167 (coverage ratchet): +18 tests — tasks ArrowDown/ArrowUp, signals peek-dirty,
        //   document-pip insertBefore. Actuals: 93.82/85.75/92.76/95.08. Raised branches 85.5 → 85.7.
        // Sprint 218 (coverage calibration): measured actuals 91.82/83.83/91.05/93.19 after
        //   Sprints 213-217 added new code paths. Largest coverage gaps: ai-synthesis.ts (35%)
        //   and video-news.ts DOM-heavy initVideoNews (44%). Thresholds calibrated to actuals
        //   with 0.3% safety margin. Raise once those files gain test coverage.
        // Sprint 225 (coverage ratchet): added 8 ai-synthesis DOM-branch tests + 10 video-news
        //   initVideoNews DOM tests. Actuals: 92.64/84.26/91.79/94.05.
        //   Thresholds raised to actuals - 0.3% safety margin.
        // Sprint 235 (coverage ratchet): +8 countdown tickSecondary/initCountdownCard tests +
        //   3 ai-synthesis stale-cache/visibilitychange tests. countdown.ts branches 74.66→85.33,
        //   ai-synthesis.ts lines 98.46→100%. Actuals: 93.01/84.59/91.85/94.39.
        //   Thresholds raised to actuals - 0.3% safety margin.
        // Sprint 268 (coverage ratchet): Sprints 263-267 added fast-check property tests:
        //   TDP1-TDP5 (today-pane), LP1-LP4 (links), CAP1-CAP5 (cache), KP1-KP3 (keyboard),
        //   UP1-UP5 (utils), SV1-SV9 (news shadow-vectorize). +42 new tests.
        //   Actuals: 93.00/84.61/91.89/94.36.
        //   Ratchet: branches 84.5→84.6, functions 91.8→91.8 (no change), others unchanged.
        // Sprint 273 (coverage ratchet): added null-DOM branch tests for ai-synthesis (3 tests),
        //   snapshot localStorage-inaccessible + downloadSnapshot (2), first-run-tour cancel/throw (2),
        //   fixed NP4 getBookmarkKey whitespace property. ai-synthesis branches 82.35→97.05%.
        //   Actuals: 93.13/84.61/92.01/94.52. Ratchet: functions 91.8→92.0, lines 94.3→94.5.
        // Sprint 301 (coverage baseline — Sprints 298-300 fast-check property tests):
        //   +20 tests: KP4-KP8 (keymap), SP1-SP5 (snapshot), EB1-EB6 (event-bus).
        //   Actuals: 93.14/84.70/92.02/94.52. Margins too tight to ratchet (max 0.14%).
        //   Numeric thresholds unchanged; ratchet deferred to Sprint 305 after
        //   config-schema-props (Sprint 303) + today-pane/links props (Sprint 304).
        // Sprint 305 (coverage ratchet step 2 — Sprints 303-304 property tests):
        //   +85 new tests total this session (Sprints 298-304): CS-FC9-FC16 (+64),
        //   TDP6-TDP8 (+3), LP5-LP8 (+4), KP4-KP8 (+7), SP1-SP5 (+6), EB1-EB6 (+7).
        //   Total test count: 5957 / 175 suites / 0 failures (was 5872 in v13.30.0).
        //   Actuals post-305: 93.14/84.70/92.02/94.52. Property tests probe existing
        //   paths → no net coverage gain. Margins: Stmts +0.14, Branches +0.10,
        //   Funcs +0.02, Lines +0.02 — too tight for any safe ratchet.
        //   Thresholds held at v13.30.0 values. Next ratchet requires targeted
        //   branch/function tests on uncovered paths (e.g. service-worker, diag-overlay).
        // Sprint 311 (coverage baseline — Sprints 307-310 fast-check property tests):
        //   +23 tests: HP1-HP6 (sparklineSvg), SYP1-SYP6 (sync backoff),
        //   DP1-DP5 (diag ring-buffer), FP1-FP5 (fetch locks+network).
        //   Actuals: 93.17/84.73/92.02/94.55. Margins: Stmts +0.17, Branches +0.13,
        //   Funcs +0.02, Lines +0.05 — still too tight for safe ratchet.
        //   Thresholds held; next ratchet target: 93.1/84.7/92.0/94.5 when buffer ≥ 0.2%.
        // Sprint 421 (coverage ratchet — N-Star-UI + ecfg + buildNewsPayload tests):
        //   Added: encryptedShareSettings/openEcfgImportDialog/openEcfgDialog coverage (+4 tests),
        //   buildNewsPayload coverage via getSemanticPayload("news") (+1 test).
        //   Fixed: currency.test.ts cache pollution (beforeEach cDelete).
        //   Actuals: 93.30/84.79/92.00/94.73. Ratchet: stmts 93.0→93.2, branches 84.6→84.7,
        //   functions 92.0 (held — exactly at threshold), lines 94.5→94.6.
        // Sprint 422 (PC-1 audio recap coverage fix):
        //   Added 7 new tests covering _setSpeakBtnState(true/false), click-handler delegation,
        //   interval-callback, onstart/onend/onerror utterance events; ai-synthesis.ts now 100% funcs.
        //   Actuals: 93.32/84.81/92.08/94.76. Ratchet: funcs 92.0→92.0 (held; margin 0.08%).
        //   Next ratchet targets: 93.4/84.9/92.1/94.8 once alerts.ts + motivation.ts gaps closed.
        // Sprint 434 (coverage ratchet — alerts.ts + motivation.ts gaps closed):
        //   Added: buildAlertsPayload happy path (lines 38-41), history-btn click handler (654-658),
        //   buildMotivationPayload via semantic clipboard, updateHeartBtn via refreshHeartState,
        //   markIndexUsed localStorage-catch branch; 7 new tests across 2 files.
        //   alerts.ts funcs 89.47→92.98%; motivation.ts funcs 86.66→96.96%.
        //   Actuals: 93.43/84.96/92.19/94.86. Ratchet: stmts 93.2→93.4, branches 84.7→84.9,
        //   functions 92.0→92.1, lines 94.6→94.8.
        // Sprint 445 (coverage ratchet — Sprints 439-442 idb-store/card-registry/mcp-bridge/currency-adapter):
        //   idb-store.ts 30%→100%; card-registry.ts funcs 50%→92%; mcp-bridge.ts 88%→99%;
        //   currency-adapter.ts branches 50%→100%.
        //   Actuals: 94.07/85.29/94.45/95.49. Ratchet: stmts 93.4→93.7, branches 84.9→85.0,
        //   functions 92.1→94.1, lines 94.8→95.1.
        // Sprint 451 (coverage ratchet — Sprints 449-450 Stryker+OWASP added new coverage):
        //   Actuals post-450: 94.23/85.40/94.51/95.67 (coverage surface stable — no new uncovered code).
        //   Safety margin 0.3%: ratchet stmts 93.7→93.9, branches 85.0→85.1, funcs 94.1→94.2, lines 95.1→95.3.
        statements: 93.9,
        branches: 85.1,
        functions: 94.2,
        lines: 95.3,
      },
    },
  },
});



