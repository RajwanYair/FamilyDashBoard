/**
 * Stryker mutation testing configuration (V12-TESTING ).
 *
 * Targets the SimHash utility and its property invariants.
 * Run with: npx stryker run scripts/stryker.config.mjs
 *
 * Install Stryker in the MyScripts parent before running:
 *   npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner
 *   (from MyScripts/ directory — never add devDeps to FamilyDashBoard/package.json)
 *
 * Score targets ( + V13 + + + + + + additions):
 *   - simhash.ts            : mutation score ≥ 85%
 *   - d1-reports.ts         : mutation score ≥ 75%
 *   - analytics.ts          : mutation score ≥ 80%
 *   - canary.ts             : mutation score ≥ 90%
 *   - error-tracker.ts      : mutation score ≥ 85%  (V13 + raised Roadmap #9)
 *   - config.ts             : mutation score ≥ 85%  (V13 + raised Roadmap #9)
 *   - error-reporter.ts     : mutation score ≥ 75%
 *   - diag.ts               : mutation score ≥ 85%  ( + raised Roadmap #9)
 *   - signals.ts            : mutation score ≥ 85%
 *   - fs-access.ts          : mutation score ≥ 75%
 *   - idle.ts               : mutation score ≥ 75%
 *   - cache.ts              : mutation score ≥ 85%  (Roadmap #9)
 *   - event-bus.ts          : mutation score ≥ 80%  (pub/sub logic)
 *   - keyboard.ts           : mutation score ≥ 80%  (keyboard shortcut dispatch)
 *   - links.ts              : mutation score ≥ 80%  (semantic link registry)
 *   - history.ts            : mutation score ≥ 80%  (sparklineSvg property-tested HP1-HP6)
 *   - sync.ts               : mutation score ≥ 80%  (backoff property-tested SYP1-SYP6)
 *   - fetch.ts              : mutation score ≥ 80%  (lock primitives property-tested FP1-FP5)
 *   - card-signal-protocol.ts : mutation score ≥ 80%  (CSP1-CSP5 property-tested)
 *   - semantic-clipboard.ts   : mutation score ≥ 80%  (SCP1-SCP5 property-tested)
 *   - provider.ts             : mutation score ≥ 80%  (PRP1-PRP6 property-tested; backoff + status logic)
 *   - utils.ts               : mutation score ≥ 80%  (UT1-UT8 property-tested; clamp, pad2, decomposeDuration, computeMoonPhase)
 *   - config-crypto.ts       : mutation score ≥ 80%  (CC1-CC8 property-tested; AES-GCM round-trip, IV uniqueness, prefix invariant)
 *   - worker-client.ts       : mutation score ≥ 75%  (worker-client-props property-tested)
 *   - nws-adapter.ts         : mutation score ≥ 75%  (NW1-NW7 property-tested)
 *   - provider-toast.ts      : mutation score ≥ 75%  (PT1-PT6 property-tested)
 *   - news-adapter.ts        : mutation score ≥ 75%
 *   - open-meteo-adapter.ts  : mutation score ≥ 75%
 *   - auto-loop-scroll.ts    : mutation score ≥ 75%
 *   - first-run-tour.ts      : mutation score ≥ 75%
 *   - offline-banner.ts      : mutation score ≥ 75%
 *   - status-bar.ts          : mutation score ≥ 75%
 *   - scroll.ts              : mutation score ≥ 75%
 *   - config-panel.ts        : mutation score ≥ 75%
 *   - config-auto-render.ts  : mutation score ≥ 75%
 *   - video-news.ts          : mutation score ≥ 75%
 *   - card-auto-scroll.ts    : mutation score ≥ 75%
 *   - card-settings-dialog.ts: mutation score ≥ 75%
 *   - diag-overlay.ts        : mutation score ≥ 75%
 *   - document-pip.ts        : mutation score ≥ 75%
 *   - layout-drag.ts         : mutation score ≥ 75%
 *   - resizer.ts             : mutation score ≥ 75%
 *   - ai-synthesis.ts        : mutation score ≥ 75%
 *   - validation.ts          : mutation score ≥ 75%
 *   - normalize-error.ts     : mutation score ≥ 75%
 *   - nws-normalize.ts       : mutation score ≥ 75%
 *   - kv.ts                  : mutation score ≥ 75%
 *   - log.ts                 : mutation score ≥ 75%
 *   - schemas.ts             : mutation score ≥ 75%
 *   - temporal.ts            : mutation score ≥ 80%  (TM1-TM10 property-tested; date abstraction layer)
 *
 * (Roadmap #9): hard break threshold raised 75 → 85.
 * error-tracker, config, diag confirmed in scope. Overall gate: ≥ 85% or CI fails.
 * extended scope to event-bus, keyboard, links (cross-card primitives).
 * extended scope to history, sync, fetch (property-tested in Sprints 307-310).
 * extended scope to card-signal-protocol + semantic-clipboard (X12/X15 core).
 * extended scope to provider.ts (PRP1-PRP6 property-tested; backoff + status machine).
 * extended scope to utils.ts, config-crypto.ts, worker-client.ts (property-tested in Sprints 470, 469).
 * extended scope to perf.ts, i18n.ts, error-boundary.ts (property-tested PF1-PF9, I18N1-I18N7, EB1-EB6 in Sprints 479-481).
 * extended scope to sw-constants.ts, trusted-types.ts (property-tested SW1-SW6, TT1-TT5 in Sprints 485, 488).
 * extended scope to idb-store.ts, keymap.ts (property-tested IDB1-IDB6, KM1-KM5).
 * extended scope to anim-level.ts, snapshot.ts (property-tested AL1-AL5, SY1-SY5); removed duplicate error-tracker.ts entry.
 * extended scope to ecb-adapter.ts, app-signals.ts, constants.ts (property-tested ECB1-ECB6, AS1-AS6, CN1-CN6).
 * extended scope to mcp-bridge.ts, countdown.ts, rss-parser.ts, analytics.ts (property-tested MB1-MB5, CD1-CD6, RSS1-RSS6, AN1-AN5).
 * extended scope to weather.ts, stocks.ts, currency.ts (property-tested WX1-WX10, ST1-ST11, CUR1-CUR8, FT1-FT8).
 * extended scope to motivation.ts, alerts.ts, hebrew-cal.ts (property-tested MO1-MO6, AL1-AL9, HC1-HC10).
 * extended scope to tasks.ts, calendar.ts, system-info.ts, video-news-adapter.ts (property-tested TK1-TK10, CAL1-CAL10, SI1-SI10, VN1-VN7).
 * extended scope to ims-adapter.ts, bg-images.ts, early-hints.ts (property-tested IMS1-IMS7, BG1-BG5, CO1-CO7); removed duplicate canary entry.
 * extended scope to allowlists.ts (property-tested AW1-AW5).
 * extended scope to currency.ts (property-tested CUR9-CUR12).
 * (v14.23.0): new property test suites (ID1-ID4 idle, VR1-VR4 vitals-reporter, SN1-SN4 snapshot,
 *   WC1-WC4 worker-client, RS1-RS3 resizer, SC1-SC4 scroll) — all modules already in scope.
 *   Threshold ratcheted: high 87 → 88, break 87 → 88.
 *   Total scope: 136 files (unchanged — all new suites target already-listed modules).
 * (v14.7.0): extended scope to news.ts, theme.ts, toast.ts, boi-adapter.ts, tase-adapter.ts.
 * (v14.8.0): extended scope to alerts-adapter.ts, calendar-adapter.ts, currency-adapter.ts, hebcal-adapter.ts, stocks-adapter.ts.
 * (v14.9.0): extended scope to nws-adapter.ts, provider-toast.ts, news-adapter.ts, open-meteo-adapter.ts, auto-loop-scroll.ts.
 * (v14.10.0): extended scope to first-run-tour.ts, offline-banner.ts, status-bar.ts, scroll.ts.
 * (v14.16.0): extended scope to config-panel.ts, config-auto-render.ts, video-news.ts,
 *   card-auto-scroll.ts, card-settings-dialog.ts, diag-overlay.ts, document-pip.ts,
 *   layout-drag.ts, resizer.ts, ai-synthesis.ts. Total scope: 107 files.
 * (v14.17.0): extended scope to 12 fdb-* web component files (per-card custom elements).
 *   Total scope: 119 files.
 * (v14.18.0): extended scope to worker validation, normalize-error, nws-normalize, kv, log, schemas.
 *   Total scope: 125 files.
 * (v14.19.0): extended scope to config-presets, worker routes (ai, cron, data, errors, feeds, reports),
 *   durable objects (alerts-orchestrator, rate-limiter-do), worker entry (index.ts).
 *   Total scope: 135 files. * (v14.22.0): extended scope to temporal.ts (CAL-T / H-T abstraction layer; TM1-TM10 property-tested).
 *   Total scope: 136 files. */

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
    // V13 expand coverage to client-side core modules
    "src/core/error-tracker.ts",
    "src/core/config.ts",
    // extend to error-reporter + diag (client-side error pipeline)
    "src/core/error-reporter.ts",
    "src/core/diag.ts",
    // extend to signals primitive, FS Access wrapper, and idle scheduler
    "src/core/signals.ts",
    "src/core/fs-access.ts",
    "src/core/idle.ts",
    // Roadmap #9: dual-layer cache primitive (high blast-radius if mutated)
    "src/core/cache.ts",
    // cross-card primitives — event-bus, keyboard, semantic links
    "src/core/event-bus.ts",
    "src/ui/keyboard.ts",
    "src/core/links.ts",
    // property-tested pure algorithms — sparklineSvg, backoff, lock primitives
    "src/core/history.ts",
    "src/core/sync.ts",
    "src/core/fetch.ts",
    // X12/X15 core — card-signal-protocol + semantic-clipboard
    "src/core/card-signal-protocol.ts",
    "src/core/semantic-clipboard.ts",
    // provider-health model — backoff policy, status state machine (PRP1-PRP6)
    "src/core/provider.ts",
    // pure-function modules fully property-tested (UT1-UT8, CC1-CC8, worker-client-props)
    "src/core/utils.ts",
    "src/core/config-crypto.ts",
    "src/core/worker-client.ts",
    // property-tested formatVital/rateVital (PF1-PF9), t() (I18N1-I18N7), withErrorBoundary (EB1-EB6)
    "src/core/perf.ts",
    "src/core/i18n.ts",
    "src/core/error-boundary.ts",
    // property-tested type-guards (SW1-SW6), TT passthrough (TT1-TT5), provider health (PV1-PV7)
    "src/core/sw-constants.ts",
    "src/core/trusted-types.ts",
    // property-tested ring buffers + semantic primitives (IDB1-IDB6, KM1-KM5)
    "src/core/idb-store.ts",
    "src/core/keymap.ts",
    // property-tested anim-level (AL1-AL5), sync backoff (SY1-SY5), snapshot export
    "src/core/anim-level.ts",
    "src/core/snapshot.ts",
    // property-tested ECB adapter (ECB1-ECB6), app-signals (AS1-AS6), constants (CN1-CN6)
    "worker/src/utils/ecb-adapter.ts",
    "src/core/app-signals.ts",
    "src/core/constants.ts",
    // property-tested mcp-bridge (MB1-MB5), countdown (CD1-CD6), rss-parser (RSS1-RSS6), analytics (AN1-AN5)
    "src/core/mcp-bridge.ts",
    "src/cards/countdown/countdown.ts",
    "worker/src/utils/rss-parser.ts",
    // property-tested weather (WX1-WX10), stocks (ST1-ST11), currency (CUR1-CUR8), fetch (FT1-FT8)
    "src/cards/weather/weather.ts",
    "src/cards/stocks/stocks.ts",
    "src/cards/currency/currency.ts",
    // property-tested motivation (MO1-MO6), alerts (AL1-AL9), hebrew-cal (HC1-HC10)
    "src/cards/motivation/motivation.ts",
    "src/cards/alerts/alerts.ts",
    "src/cards/hebrew-cal/hebrew-cal.ts",
    // property-tested tasks (TK1-TK10), calendar (CAL1-CAL10), system-info (SI1-SI10), video-news (VN1-VN7)
    "src/cards/tasks/tasks.ts",
    "src/cards/calendar/calendar.ts",
    "src/cards/system-info/system-info.ts",
    "src/cards/video-news/video-news-adapter.ts",
    // property-tested card-registry (CR1-CR6), screen-mode (SM1-SM6), api-mappers (DM1-DM10), response (WR1-WR7)
    "src/core/card-registry.ts",
    "src/ui/screen-mode.ts",
    "src/types/api.ts",
    "worker/src/utils/response.ts",
    // property-tested today-pane (TP1-TP8), theme (TH1-TH6), night-dimmer (ND1-ND7), ticker/scroll (TK1-TK6)
    "src/ui/today-pane.ts",
    "src/ui/night-dimmer.ts",
    "src/ui/ticker.ts",
    "worker/src/middleware/cors.ts",
    // property-tested maximize (MX1-MX6), d1-telemetry (DT1-DT7), rate-limit (RL1-RL7)
    "src/ui/maximize.ts",
    "worker/src/utils/d1-telemetry.ts",
    "worker/src/routes/metrics.ts",
    "worker/src/middleware/rate-limit.ts",
    // property-tested base-card (BC1-BC7), header (HD1-HD6), hardware (HW1-HW5)
    "src/cards/base-card.ts",
    "src/ui/header.ts",
    "src/core/hardware.ts",
    // property-tested ims-adapter (IMS1-IMS7), bg-images (BG1-BG5), early-hints (CO1-CO7)
    "src/cards/weather/ims-adapter.ts",
    "src/ui/bg-images.ts",
    "worker/src/middleware/early-hints.ts",
    // property-tested allowlists (AW1-AW5)
    "worker/src/utils/allowlists.ts",
    // extended property tests (CUR9-12, ST12-15, MO7-10, CS9-12)
    "src/cards/currency/currency.ts",
    // extended property tests (SIG7-10, FT9-12, NE9-12)
    "src/core/signals.ts",
    // state store (ST9-12), error-tracker (ET8-11)
    "src/core/state.ts",
    // error-tracker (ET8-11), links (LK7-10)
    "src/core/error-tracker.ts",
    // links (LK7-10), semantic-clipboard (SC7-10)
    "src/core/links.ts",
    // (v14.5.0): expanded scope — idb-cache, provider-adapter, fdb-card, vitals-reporter, sw-register
    "src/core/idb-cache.ts",
    "src/core/provider-adapter.ts",
    "src/core/fdb-card.ts",
    "src/core/vitals-reporter.ts",
    "src/core/sw-register.ts",
    // (v14.7.0): news card, theme system, toast UI, IL provider adapters
    "src/cards/news/news.ts",
    "src/ui/theme.ts",
    "src/ui/toast.ts",
    "src/cards/currency/boi-adapter.ts",
    "src/cards/stocks/tase-adapter.ts",
    // (v14.8.0): card adapter modules — alerts, calendar, currency, hebrew-cal, stocks
    "src/cards/alerts/alerts-adapter.ts",
    "src/cards/calendar/calendar-adapter.ts",
    "src/cards/currency/currency-adapter.ts",
    "src/cards/hebrew-cal/hebcal-adapter.ts",
    "src/cards/stocks/stocks-adapter.ts",
    // (v14.9.0): NWS adapter, provider-toast, news-adapter, open-meteo-adapter, auto-loop-scroll
    "src/cards/weather/nws-adapter.ts",
    "src/core/provider-toast.ts",
    "src/cards/news/news-adapter.ts",
    "src/cards/weather/open-meteo-adapter.ts",
    "src/core/auto-loop-scroll.ts",
    // (v14.10.0): first-run-tour, offline-banner, status-bar, scroll
    "src/core/first-run-tour.ts",
    "src/ui/offline-banner.ts",
    "src/ui/status-bar.ts",
    "src/ui/scroll.ts",
    // (v14.16.0): config panel, UI overlays, video-news, layout/drag, fdb-* web components
    "src/ui/config-panel.ts",
    "src/ui/config-auto-render.ts",
    "src/cards/video-news/video-news.ts",
    "src/ui/card-auto-scroll.ts",
    "src/ui/card-settings-dialog.ts",
    "src/ui/diag-overlay.ts",
    "src/ui/document-pip.ts",
    "src/ui/layout-drag.ts",
    "src/ui/resizer.ts",
    "src/cards/ai-synthesis/ai-synthesis.ts",
    // (v14.17.0): fdb-* web component per-card custom elements
    "src/cards/weather/fdb-weather.ts",
    "src/cards/hebrew-cal/fdb-hebrew-cal.ts",
    "src/cards/video-news/fdb-video-news.ts",
    "src/cards/currency/fdb-currency.ts",
    "src/cards/tasks/fdb-tasks.ts",
    "src/cards/countdown/fdb-countdown.ts",
    "src/cards/system-info/fdb-system-info.ts",
    "src/cards/alerts/fdb-alerts.ts",
    "src/cards/calendar/fdb-calendar.ts",
    "src/cards/stocks/fdb-stocks.ts",
    "src/cards/motivation/fdb-motivation.ts",
    "src/cards/news/fdb-news.ts",
    // (v14.18.0): worker route/middleware/util modules (validation, normalize, NWS, KV, log, schemas)
    "worker/src/utils/validation.ts",
    "worker/src/utils/normalize-error.ts",
    "worker/src/utils/nws-normalize.ts",
    "worker/src/utils/kv.ts",
    "worker/src/middleware/log.ts",
    "worker/src/utils/schemas.ts",
    // (v14.19.0): config-presets, worker routes, durable objects, worker entry
    "src/core/config-presets.ts",
    "worker/src/index.ts",
    "worker/src/routes/ai.ts",
    "worker/src/routes/cron.ts",
    "worker/src/routes/data.ts",
    "worker/src/routes/errors.ts",
    "worker/src/routes/feeds.ts",
    "worker/src/routes/reports.ts",
    "worker/src/durable-objects/alerts-orchestrator.ts",
    "worker/src/durable-objects/rate-limiter-do.ts",
    // (v14.22.0): temporal.ts date/time abstraction layer (CAL-T / H-T scaffold; TM1-TM10 property-tested)
    "src/core/temporal.ts",
    // Exclude generated/vendor code
    "!worker/src/**/*.d.ts",
    "!src/**/*.d.ts",
  ],
  coverageAnalysis: "perTest",
  thresholds: {
    high: 88,
    low: 82,
    break: 88,
  },
  htmlReporter: {
    // Output to temp area per project patterns (never in project dir for CI)
    fileName: "stryker-report/mutation-report.html",
  },
  timeoutMS: 60000,
  // Focus mutation tests on property test suites
  testRunnerNodeArgs: [],
};
