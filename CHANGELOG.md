# Changelog

All notable changes to FamilyDashBoard are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [8.3.0] — 2026-04-20

> **3087 tests / 89 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Stream G.2 — Playwright E2E Setup

- **`playwright.config.ts`**: Chromium-only, 1920×1080, `he-IL` locale, dev server on port 5173, retries=2 in CI
- **`tests/e2e/smoke.spec.ts`**: 7 smoke tests — page title, RTL dir attribute, card headers visible, main grid present, load <5 s, meta/manifest presence, T-key theme cycling
- **`package.json`**: added `test:e2e` and `test:e2e:ui` scripts
- **`.gitignore`**: added `test-results/`, `playwright-report/`, `blob-report/`, `.playwright/`

### Stream SW — Per-Origin API Cache TTL

- **`src/core/sw-constants.ts`**: added `CACHE_TTL_BY_ORIGIN` typed record mapping API hostnames → TTL seconds; `CACHE_TTL_DEFAULT_S = 3600`
- **`sw.js`**: added `_ttlForOrigin()` helper + `_isFresh()` check; fetch handler now stamps `x-sw-cached-at` header and evicts stale cached responses by origin TTL (5 min for stocks/crypto, 30 min for weather/FX, 6 h for Hebcal/Sefaria)

### Stream I — Agent Modernization

- **`.github/agents/dashboard-designer.agent.md`**: added Error Playbook table (8 entries), expanded context file references (tokens/themes/components/layout/animations/a11y), added edit tools (`replace_string_in_file`, `multi_replace_string_in_file`, `create_file`), second handoff to `quality-reviewer`, three-step Verification section with dom-contract and theme-audit coverage

### Stream W — Worker Response Envelope

- **`worker/src/utils/response.ts`**: added `workerEnvelope<T>()` helper that wraps parsed upstream data in `WorkerResponse<T>` envelope (`data`, `stale`, `timestamp`, `provider`) with `Cache-Control` and CORS headers
- **`worker/src/routes/data.ts`**: weather, currency, hebcal, and hebcal-holidays routes now return `workerEnvelope()` instead of raw `proxyResponse()`; upstream failures fall back to `proxyResponse()` for SW stale-cache compatibility
- **4 new tests** in `tests/unit/worker/worker.test.ts` — `workerEnvelope` describe block (69 total)

### Stream H — Developer Experience

- **`README.md`**: added "Quick Start — Download and Run" section with 4-step no-install instructions (download dist.zip → open index.html); development setup in dedicated `### 🛠️ Development Setup` subsection
- **`.github/workflows/preview-deploy.yml`**: Cloudflare Pages preview deploy on PR open/sync/reopen; posts preview URL comment (upserts on re-push); uses `CF_API_TOKEN` + `CF_ACCOUNT_ID` secrets; `permissions: pull-requests:write, contents:read`

### Stream B2 — Card Architecture Migration

- **`src/cards/countdown/fdb-countdown.ts`**: `FdbCountdownCard extends FdbCard` — delegates to `initCountdownCard()`/`destroyCountdownCard()` + 1-second tick interval; registered as `fdb-countdown` custom element
- **`docs/card-architecture-audit.md`**: updated to v8.3.0; countdown marked ✅ Migrated; counter updated to **6 / 11 migrated**
- **3 new tests** in `tests/unit/cards/fdb-countdown.test.ts`

### Documentation & Assets

- **`.github/assets/card-lifecycle.svg`**: new — card state machine (unregistered → connecting → connected → refreshing → disconnected) with error/stale branches
- **`.github/assets/theme-cascade.svg`**: new — CSS `@layer` cascade + 6 theme override illustration
- All 10 SVG assets bumped to v8.3.0 version labels

## [8.2.0] — 2026-04-20

> **3080 tests / 88 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `b88d7e8`)

### Stream G.1 — Test Consolidation

- **`_resetForTest()` pattern established**: added to `bg-images`, `motivation`, `news`, `currency`, `fetch` modules; `vi.resetModules()` reduced from 186 to ≤11 (all remaining are legitimate module-init-path tests)
- **Stream G.1 complete**: 3080 tests / 88 suites · 0 failures — exit criteria met

### Stream I — AI Customization

- **quality-reviewer agent modernized**: added Key Context Files table, failure playbook, Mocking Conventions section, `check:bundle` quality gate

### Docs and Environment

- **CONTRIBUTING.md**: added PowerShell-only terminal table; `_resetForTest()` pattern guideline
- **SVG architecture diagrams**: `ci-cd.svg` (pipeline diagram) + `cache-layers.svg` (4-layer cache diagram)
- **Workflows README**: added permissions matrix, secrets inventory, concurrency policy

---

## [8.1.0] — 2026-07-10

> **3080 tests / 88 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Tooling, CI, Documentation and Quality Sprint

- **Stream G.1 — Shared test helpers**: `tests/helpers/index.ts` — `createCardDOM`, `cleanupDOM`, `appendToDOM`, `withFakeTimers`, `createMockFetch`, `createFailingFetch`, `createMockCache`, `createMockConfig`, `getElement`, `getDomElement`; 27 new tests in `tests/unit/core/test-helpers.test.ts`
- **Stream G.1 — useFakeTimers audit**: audited all 50+ `vi.useFakeTimers()` calls — confirmed all paired with `setSystemTime` or `advanceTimersByTime`; no removals needed
- **Stream G.1 — Vitest alias fix**: converted `resolve.alias` from object to ordered array so `@tests/helpers` resolves before `@tests`
- **Stream J — Package.json URLs**: corrected `repository.url`, `homepage`, and `bugs.url` from `ryair` to `RajwanYair`
- **Stream J — CI hardening**: added `node scripts/check-sw-version.mjs` to the `build` CI job; added SLSA build provenance attestation (`actions/attest-build-provenance@v2`) to `release.yml` with `id-token: write` + `attestations: write` permissions
- **Stream J — ADRs**: added ADR-007 (News Aggregation Strategy), ADR-008 (CSS Layer Governance), ADR-009 (Config Schema Evolution) with updated `docs/adr/README.md`
- **Stream J — Documentation**: added `docs/adding-a-card.md` (10-step contributor guide) and `docs/deployment.md` (GitHub Pages, self-host, nginx, Worker, offline mode, troubleshooting)
- **Stream J — release-report.mjs**: rewritten with quality gate pass/fail table (tsc + eslint + vitest + bundle + SW version); `--no-gates` flag for fast mode; exits 1 on any gate failure
- **Stream I — api-integrator agent**: added `replace_string_in_file`, `multi_replace_string_in_file`, `create_file`, `file_search` tools; second handoff to `quality-reviewer`; Common Failure Patterns table; Key Context Files table; updated verification with 3080+ test count
- **Stream J — .vscode tasks**: added "Vitest: Watch Mode" and "Vitest: Current File" tasks; added `vitest.explorer` extension recommendation

## [8.0.0] — 2026-04-20

> **3053+ tests / 87 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Production Readiness Release

- **Test consolidation**: Converted repetitive `it()` blocks into parameterized `it.each()` tables across stocks, hebrew-cal, and weather test suites (~227 lines removed, same assertions preserved)
- **Dead file cleanup**: Removed 10 stale tracked files (debug logs, old reports, superseded roadmap, build artifacts)
- **Hardened .gitignore**: Added patterns for test artifacts, debug logs, and build outputs to prevent future tracking
- **Config modernization**: Added SVG and TypeScript patterns to `.gitattributes` for consistent line-ending normalization
- **Version bump**: All 15 version-bearing files updated per pre-release checklist
- **SVG documentation assets**: Updated version and test counts in all `.github/assets/` diagrams

## [7.21.0] — 2026-07-07

> **3003+ tests / 87 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Stream G.1 — Shared test helpers**: `tests/unit/helpers/` (dom, mocks, timers, index) + `@tests` alias in vitest.config.ts
- **Stream G.1 — Test isolation exports**: `_resetForTest()` in `cache.ts` and `state.ts` for clean per-test state
- **Stream W — Normalized worker types**: `WorkerResponse<T>` envelope + `NormalizedWeatherData`, `NormalizedStock`, `NormalizedCurrencyRates`, `NormalizedNewsItem`, `NormalizedAlertEvent` in `types/api.ts`
- **Stream I-0 — Node tooling presets**: `node-ts-app.mjs`, `base-node.json`, `happy-dom.mjs`, `node.mjs` at `MyScripts/tooling/`
- **Stream I — Instruction files**: `.github/instructions/typescript.instructions.md` + `tests.instructions.md`
- **Stream J — Dev environment**: `.nvmrc` (Node 22), `package.json` author/repo/homepage/bugs/keywords, `.vscode/launch.json` (4 debug configs)
- **Stream I — AI automation**: `quality-reviewer.agent.md` + `test-coverage.prompt.md`, `debug-card.prompt.md`, `release-check.prompt.md`
- **Stream B2 — Card architecture audit**: `docs/card-architecture-audit.md` tracking FdbCard migration status (5/11 migrated)
- **Stream F — Card loading state**: `.card-loading`, `.card__body`, `.card__footer`, `@keyframes card-spin` in `components.css` + CSS existence tests
- **Stream SW — SW constants**: `CACHE_NAME` and `SW_VERSION_KEY` typed constants in `src/core/sw-constants.ts`

## [7.20.0] — 2026-06-22

> **2998 tests / 86 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **ROADMAP strategic overhaul**: added three new high-priority streams — G.1 (unit-test consolidation & rationalization), I-0 (shared tooling at `MyScripts/` level), and I (AI customization & `.github` documentation modernization)
- **Worker-first fetch resilience**: weather test adapted for dual-path fetch (worker URL or open-meteo fallback), ensuring CI stability under `fetchJSONWithWorker()` routing
- **Provider adapter hardening**: improved provider-adapter, i18n, and fetch modules with expanded test coverage (+40 tests / +6 suites)
- **Shared tooling foundation**: documented and structured `MyScripts/tooling/` for cross-project ESLint, TypeScript, Vitest, and Stylelint base configs

## [7.19.1] — 2026-04-19

> **2958 tests / 80 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Tooling modernization**: refreshed VS Code, Copilot, MCP, CI, and shared toolchain integration for the current workspace and parent-install model
- **Bilingual interface foundation**: added centralized interface-language config, shared i18n helpers, and Hebrew/English UI wiring for config, header, card titles, and key toasts
- **Config and test stabilization**: preserved language during config migration, hardened i18n defaults for partial mocks, and expanded regression coverage for config, header, card registry, and i18n

## [7.19.0] — 2025-07-17

> **2931 tests / 79 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprints 128–177 — Config System, Observability, Visual Polish & Testing

- **Stocks provider adapter** (Sprint 128): `createStocksAdapter(symbol)` with market-dependent TTL
- **Calendar provider adapter** (Sprint 129): `createCalendarAdapter(icsUrl)` with ICS validation
- **FdbCard render helpers** (Sprints 130–133): `renderMetricTile()`, `renderEmpty()`, `renderError()`, `renderSkeleton()`
- **Enhanced `createShell()`** (Sprint 134): returns full `CardShell` with header/title/sync-dot/body/footer
- **Per-card `configSchema` exports** (Sprints 135–140): news, stocks, currency, alerts, calendar, hebrew-cal
- **Config accordion auto-renderer** (Sprints 141–142): `injectCardConfigSchemas()` dynamically loads card schemas
- **Config v6→v7 migration** (Sprint 143): moves alerts/calendar flat props into `cards` namespace
- **Per-card reset buttons** (Sprint 147): resets all inputs to `defaultValue` per card
- **Config dirty tracking** (Sprint 148): first close when dirty warns; second close discards
- **Stale chip CSS enhancement** (Sprint 149): positioned absolute with hover tooltip
- **Retry button CSS** (Sprint 150): accent-colored `.card-retry-btn` with 🔄 icon
- **Card badge pulse** (Sprint 151): `.card-badge-new` pulsing dot for new data
- **High contrast tokens** (Sprint 153): `@media (prefers-contrast: more)` overrides
- **Card enter/leave animations** (Sprint 154): `card-enter` + `card-leave` keyframes with reduced-motion guard
- **Scroll shadow indicators** (Sprint 155): sticky gradient shadows for `.card__body` overflow
- **Print URL footer** (Sprint 156): `body::after` shows dashboard URL in print media
- **Night mode smoothing** (Sprint 157): `brightness(0.85)` transition with reduced-motion fallback
- **Card init timing** (Sprint 158): `recordCardInitTime()` + `timedInit()` wrapper in main.ts
- **Startup waterfall** (Sprint 159): per-card init timing table in diagnostic overlay
- **Perf JSON export** (Sprint 160): `downloadPerfJSON()` exports vitals + card timings as JSON
- **Error rate trending** (Sprint 161): sparkline bar chart in diag overlay
- **Network quality history** (Sprint 162): `sampleNetworkQuality()` tracks last 10 samples
- **Provider latency histogram** (Sprint 163): `recordProviderLatency()` + per-provider latency history
- **30 configSchema completeness tests** (Sprint 168): validates shape/uniqueness/types for 6 cards
- **Config accordion tests** (Sprint 169): grouping, open-by-default, flat fields
- **Provider latency tests** (Sprint 170): 5 tests for FIFO cap, reset, multi-provider
- **Config dirty tracking tests** (Sprint 171): toast-on-dirty, second-close, gear indicator
- **Animation CSS tests** (Sprint 172): badge pulse, card enter/leave keyframes
- **Config round-trip integration** (Sprint 173): `shareConfigHash → loadConfigFromHash` + resetConfig
- **Provider lifecycle integration** (Sprint 174): success → latency → failure → backoff → recovery
- **ADR-004** (Sprint 175): per-card config namespacing strategy
- **ARCHITECTURE.md v7.19 refresh** (Sprint 176): updated module descriptions, new invariants

---

## [7.18.0] — 2025-07-14

> **2853 tests / 73 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprints 93–127 — Core Infrastructure, Observability & Polish

- **`renderProviderHealthHtml()` + `providerStatusIcon()`** (Sprint 93): exported from diag-overlay for reuse
- **`classifyFetchError()`** (Sprint 94): categorizes fetch errors as timeout/network/http-error/invalid-json/cors/unknown
- **`cAge()`** (Sprint 95): returns age in ms of a cache entry
- **`getBackoffMs()` + `shouldBackoff()`** (Sprint 96): exponential backoff policy for providers
- **News RSS adapter** (Sprint 97): `createNewsAdapter()` with dedup + sort
- **Typed per-card config** (Sprint 98): `CardConfigMap` + 7 typed config interfaces
- **Config migration v5→v6** (Sprint 99): moves flat per-card props into `cards` namespace
- **Config auto-renderer** (Sprint 100): `renderConfigField()`, `renderConfigFields()`, `readConfigValues()`
- **`validateExportPayload()`** (Sprint 101): validates config export envelope
- **Envelope-aware import** (Sprint 102): `validateImportedConfig()` auto-unwraps envelope
- **`diffConfigs()`** (Sprint 103): shallow config comparison
- **`resetCardConfig()`** (Sprint 104): per-card settings reset
- **`auditLocalStorageKeys()` + `removeOrphanedLsKeys()`** (Sprint 105): LS key hygiene
- **`filterConfigFields()`** (Sprint 107): search/filter config fields by label
- **CSS card anatomy** (Sprints 108–112): `.card__header/.card__body/.card__footer`, `.stale-chip`, `.card-error`, `.card-empty`, `.metric-tile`
- **Theme audit** (Sprint 113): 84-test suite verifying all 6 themes define required CSS variables
- **Print stylesheet improvements** (Sprint 114): card anatomy, metric tiles, tables, `@page` margins
- **TV-distance readability** (Sprint 115): min font sizes for card anatomy in TV mode
- **Maximize animation** (Sprint 116): backdrop overlay + minimize snap-back transition
- **Scroll-snap** (Sprint 117): phone mode scroll-snap for single-column layout
- **`cDelete()`** (Sprint 119): explicit single-key cache removal from all layers
- **`idbEvictStale()`** (Sprint 120): time-based IDB cleanup (7-day threshold)
- **`cacheDashboard()`** (Sprint 121): full cache stats snapshot (mem + LS entry counts)
- **Offline banner** (Sprint 122): wires `#offline-banner` show/hide on connectivity events
- **Diag cache stats** (Sprint 123): diag overlay shows mem + LS entry counts
- **`checkAllVitalBudgets()`** (Sprint 124): per-vital performance budget with Google thresholds
- **`errorRate()`** (Sprint 125): errors per minute calculation
- **Health snapshot integration test** (Sprint 126): cache + errors + vitals combined test

## [7.17.0] — 2026-06-22

> **2571 tests / 56 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint 71 — Worker Error Normalization Helper

- **`worker/src/utils/normalize-error.ts`**: `normalizeWorkerError(err, routeName)` — classifies any thrown value into `FDB-070` / `FDB-071` / `FDB-072` / `FDB-073` with correct HTTP status codes; `errorResponse()` converts to a JSON `Response`

### Sprint 72 — FdbCard.setTitle

- **`src/core/fdb-card.ts`**: `setTitle(text)` — safely sets `[data-card-title]` descendant's `textContent`; no-op on cards without a title bar

### Sprint 73 — FdbCard.setBadge

- **`src/core/fdb-card.ts`**: `setBadge(count)` — shows numeric badge on `[data-card-badge]` when count > 0; clears + sets `aria-hidden="true"` when count ≤ 0

### Sprint 74 — Worker API Documentation

- **`worker/API.md`**: Full route reference — query parameters, cache TTLs, allowed origins, CORS policy, and FDB error codes for all 8 worker routes

### Sprint 75 — Release Report Script

- **`scripts/release-report.mjs`**: Prints Markdown release summary — version, date, commit hash, branch, and CHANGELOG entry for the current version

### Sprint 76 — readFeatureFlag Helper

- **`src/core/config.ts`**: `readFeatureFlag(key, default?)` — reads a feature flag from the persisted config; safe fallback to `defaultValue` (default `false`) when flag is absent or config is corrupt

### Sprint 77 — Version Bump: CLAUDE.md + workspace instructions

- **`CLAUDE.md`**: Updated version reference to v7.17.0 and test count to 2571+
- **`.github/instructions/workspace.instructions.md`**: Updated test baseline to 2562+ / 56 suites

---

## [7.16.0] — 2026-06-22

> **2562 tests / 56 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint 61 — Bundle Trend Tracker

- **`scripts/bundle-trend.mjs`**: New script — appends gzipped JS+CSS sizes to `scripts/bundle-trend.json` after each build; tracks bundle growth over releases

### Sprint 62 — Config Migration v4→v5

- **`src/types/config.ts`**: Added `featureFlags: Record<string, boolean>` to `DashboardConfig`; `DEFAULT_CONFIG` includes `workerFetch`, `idleSchedule`, `idbCache`; `configVersion` bumped to 5; `CONFIG_VERSION = 5`
- **`src/core/config.ts`**: Added v4→v5 migration branch — seeds `featureFlags` from defaults, merges any pre-existing flags

### Sprint 63 — Config Panel Accordion Renderer

- **`src/ui/config-panel.ts`**: `buildConfigAccordion(fields, container)` — renders `CardConfigField[]` schema into `<details>/<summary>` accordion groups; flat fields for ungrouped entries; `_buildFieldRow()` private helper

### Sprint 64 — `withRetry` Generic Retry Wrapper

- **`src/core/fetch.ts`**: `withRetry<T>(fn, maxAttempts?, baseDelayMs?)` — generic async retry with exponential backoff; complements the URL-specific `fetchWithRetry(url, …)`

### Sprint 65 — FdbCard.emit Custom Event Helper

- **`src/core/fdb-card.ts`**: `emit<T>(type, detail?)` — dispatches a typed `CustomEvent` that bubbles and is composed; enables inter-card and host-app communication without coupling

### Sprint 66 — Registry `createShell()`

- **`src/core/card-registry.ts`**: `createShell(id)` — builds a `<section data-card-id>` + `<div class="card-body">` shell from the registry entry; throws for unknown ids

### Sprint 67 — `isValidCardSize` / `assertCardSize`

- **`src/types/card.ts`**: `isValidCardSize(value)` type guard + `assertCardSize(value)` assertion — validate raw strings as `CardSize` at import boundaries and config parsing

### Sprint 68 — ROADMAP Progress Table

- **`ROADMAP.md`**: Replaced stale header with current v7.16 snapshot — implementation progress table (v7.13–v7.16), stream status, updated baseline

---

## [7.15.0] — 2026-06-22

> **2534 tests / 56 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint 51 — Skeleton Primitive

- **`src/cards/base-card.ts`**: `createSkeleton(lines?)` — builds a `<div class="card-skeleton">` with N animated shimmer lines for initial-load placeholder state

### Sprint 52 — Empty-State Primitive

- **`src/cards/base-card.ts`**: `createEmptyState(message)` — builds a `<div class="card-empty">` with icon + safely-escaped message for no-data states (empty feeds, empty task lists, etc.)

### Sprint 53 — Error-State Primitive

- **`src/cards/base-card.ts`**: `createErrorState(message)` — builds a `<div class="card-error" role="alert">` with icon + sanitized message for unrecoverable card failures

### Sprint 54 — FdbCard.renderNodes Helper

- **`src/core/fdb-card.ts`**: `renderNodes(target, ...nodes)` — safely replaces `target` content with a DocumentFragment of Node or string values; strings become `<span textContent>` — no raw innerHTML

### Sprint 55 — FdbCard.withLoading Helper

- **`src/core/fdb-card.ts`**: `withLoading(fn)` — runs async loader with auto `aria-busy` management; delegates errors to `onError`; guarantees loading cleared on both resolve and reject

### Sprint 56 — CardShell Interface

- **`src/types/card.ts`**: `CardShell` interface — describes the minimal DOM anatomy required by every rendered card (`root`, `body`, optional `header`/`footer`)

### Sprint 57 — Night Dimmer Weekday Schedule

- **`src/ui/night-dimmer.ts`**: `autoDimCheckWeekday(startHour, endHour, weekdays?)` — extends schedule support with optional `weekdays[]` restriction (0=Sun…6=Sat); ensures dimmer turns off on non-scheduled days

### Sprint 58 — Config Panel Accordion Grouping Infra

- **`src/types/card.ts`**: `CardConfigField.group?: string` + `groupOpenByDefault?: boolean` — metadata for config panel accordion auto-generation; ungrouped fields render flat

### Sprint 59 — cOr: Null-Coalescing Cache Read

- **`src/core/cache.ts`**: `cOr<T>(key, ttl, fallback)` — returns cached value or calls `fallback()` and stores result; eliminates `cGet(...) ?? computeDefault()` + manual `cSet(...)` boilerplate

### Sprint 60 — Provider Error Classification (FDB-062)

- **`src/core/diag.ts`**: `ProviderErrorKind` union + `classifyProviderError(err, providerId)` — normalizes caught errors into `"network"` / `"parse"` / `"timeout"` / `"upstream"` / `"unknown"` and emits FDB-062 log entry

---

## [7.14.0] — 2026-06-22

> **2503 tests / 56 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint 45 — Provider Health Model

- **`src/core/provider.ts`** (new): `ProviderHealth` interface + `recordProviderSuccess(id)` + `recordProviderFailure(id)` + `getProviderHealth(id)` + `getAllProviderHealth()` — lightweight per-provider health tracking with status `ok`/`degraded`/`down` derived from consecutive failure count

### Sprint 46 — Diag Overlay Provider Health Table

- **`src/ui/diag-overlay.ts`**: `_renderProviderHealth()` function appended to stats section — green/yellow/red icons with success/failure counters and last-ok timestamps for all tracked providers

### Sprint 47 — IDB Cold-Start Helper

- **`src/core/cache.ts`**: `coldStart<T>(key, ttl, render)` — async-first page-load pattern: tries `cGetAsync` (memory + IDB), falls back to `cGetStaleAsync` (any age), calls `render(data)` once on hit; returns data or null

### Sprint 48 — Staleness Chip Helper

- **`src/cards/base-card.ts`**: `staleChip(ageMs)` — short Hebrew-language staleness label (`עכשיו` / `לפני N דק'` / `לפני שעה N` / `לפני N ימים`) for overlay badges and diagnostics

### Sprint 49 — LS-to-IDB Migration Utility

- **`src/core/idb-cache.ts`**: `migrateLsToIdb(keys[])` — migrates JSON-serialized localStorage keys to IDB in one call; removes originals on success; skips missing/corrupt entries; returns migration count

### Sprint 50 — CardRuntime Hooks in FdbCard

- **`src/core/fdb-card.ts`**: `onConfigChange(key, value)`, `onStale(ageMs)`, `onError(err)` lifecycle hooks added to `FdbCard` base — no-op defaults; `onError` defaults to `setError(err.message)`; subclasses override to implement reactive behavior

---

## [7.13.0] — 2026-06-22

> **2469 tests / 55 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint 31 — README v7 Rewrite

- **README.md**: Full v7.13.0 refresh — updated version badges, Getting Started rewritten for Vite dev server, added data sources table, architecture section updated to "Modular TypeScript Architecture", project structure updated to show `src/` layout, roadmap table updated to v7.13–v8.0

### Sprint 32 — ARCHITECTURE.md Refresh

- **ARCHITECTURE.md**: Version bumped to v7.13; added invariants 18-21: normalized domain types, `CardRuntime` interface, provider health model, config import validation

### Sprint 33 — Architecture Decision Records

- **`docs/adr/`**: Created ADR-001 (no Shadow DOM), ADR-002 (zero client-side deps), ADR-003 (worker-first API path), plus `docs/adr/README.md` index

### Sprint 34 — CONTRIBUTING.md Upgrades

- **`.github/CONTRIBUTING.md`**: Node.js requirement 20+ → 22+; coverage thresholds updated 75/70/75/75 → 90/81/90/92

### Sprint 35 — CardRuntime Interface

- **`src/types/card.ts`**: New `CardRuntime` interface with `connect()`, `disconnect()`, `refresh()`, and optional `onConfigChange(key, value)`, `onStale(ageMs)`, `onError(err)` hooks

### Sprint 36 — WeatherDomain Type

- **`src/types/api.ts`**: `WeatherDomain` normalized type + `mapToWeatherDomain()` mapper for decoupling card rendering from raw API shape

### Sprint 37 — StockDomain Type

- **`src/types/api.ts`**: `StockDomain` normalized type + `mapToStockDomain()` mapper; null-safe with empty-result guard

### Sprint 38 — Config Import Validation

- **`src/core/config.ts`**: `ConfigImportResult` interface + `validateImportedConfig(raw)` — rejects null, arrays, non-objects, future schema versions, and invalid enum values; runs `migrate` + `sanitize` on success

### Sprint 39 — Config Export Envelope

- **`src/core/config.ts`**: `ConfigExportEnvelope` interface + `buildExportEnvelope(config)` + `serializeConfigExport(config)` — wraps exported config with `appVersion`, `configSchemaVersion`, `exportedAt` ISO timestamp

### Sprint 40 — Perf Budget Checker

- **`src/core/perf.ts`**: `PerfBudgetResult` interface + `checkPerfBudget(limitMs?)` — compares startup waterfall against 3 s budget (default); emits FDB-059 warning when exceeded; returns `{status, measuredMs, limitMs}`

### Additional Domain Types (Sprints 41-44 foundations)

- **`src/types/api.ts`**: `CurrencyDomain` + `mapToCurrencyDomain()`, `NewsDomainItem` + `rssItemToDomain()`, `AlertsDomain`/`AlertZoneDomain` + `mapToAlertsDomain()`, `HebcalDomain`/`HebcalDomainItem` + `mapToHebcalDomain()`, `CalendarDomainEvent` + `mapToCalendarDomainEvent()`

---

## [7.12.0] — 2026-06-15

> **2405 tests / 55 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `7c19e1a`)

### Sprint 21 — Priority Fetch Queue

- **`enqueueFetch(fn, priority)`**: high/normal/low priority queue with `_QUEUE_CONCURRENCY = 3` concurrency cap; `getFetchQueueDepth()` + `getFetchQueueRunning()` inspection helpers

### Sprint 22 — Countdown 3rd Event Slot

- **3rd countdown event**: added `countdownCard3Title/Date/Time/DoneMsg` config fields, `tick3()` function, `cd3-section` DOM, and config panel inputs

### Sprint 23 — Motivation Category System

- **`MotivationCategory`**: 5 categories (morning/shabbat/family/success/general), `MOTIVATIONS` expanded to 20 quotes with categories, `setMotivationCategory()` / `getMotivationCategory()` / `getQuotesByCategory()` API

### Sprint 24 — Currency 7-day Rate History

- **`storeCurrencyHistory()`**: rolling 7-day IDB history per currency; `get7DayTrend()` returns `{ pct, arrow }` — `↑`/`↓`/`→` trend shown when no intra-session change

### Sprint 25 — Calendar Days-Until Label

- **`calDaysUntilLabel(date)`**: day headers in the agenda now show `"מחר"` (tomorrow) or `"עוד N ימים"` beside the date

### Sprint 26 — Night Dimmer Idle Auto-Dim

- **`setIdleAutoDimMinutes(n)`**: auto-activates dimmer after N minutes of mouse/keyboard inactivity; `resetIdleTimer()` deactivates on user activity; `nightDimIdleMinutes` config field added

### Sprint 27 — News Reading-Time Badge

- **`readingTimeMinutes(text)`**: wired into `renderNews()` — articles with a description show `~N דק׳` badge estimating reading time at 200 wpm

### Sprint 28 — Alerts Threat Icons + Age Badge

- **`alertThreatIcon(threat)`**: 🔴 rockets · 🟡 aircraft · 🟠 unknown; plus `alertAgeLabel(ageMin)` adds `"לפני Nד׳"` / `"לפני Nש׳"` to each alert row

### Sprint 29 — System-Info JS Heap + GPU Tiles

- **`formatHeapMb(used, limit)`** + **`gpuShortName(renderer)`**: two new sysinfo-tiles — `🧮 Heap JS` and `🎮 GPU` rendered via `performance.memory` and `WEBGL_debug_renderer_info`

### Sprint 30 — Tasks Priority Emoji Icons

- **`taskPriorityIcon(priority)`**: task priority badges upgraded from `!!`/`!`/`·` to `🔴`/`🟡`/`🔵` for better TV readability

---

## [7.11.0] — 2026-06-12

> **2332 tests / 55 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `b32f9d1`)

### Sprint 10–11 — Config Panel & Maximize Layout

- **Config panel width**: `max-width` raised from 420 px → `min(94vw, 860px)`; 2-column CSS grid for all tabs; input fields widened to 180 px; `max-height` 80 vh → 88 vh
- **Maximize container queries**: all 11 cards gain `@container card (min-width: 900px)` rules that enlarge internal tiles when a card is maximized (weather, currency, stocks, countdown, motivation, news, tasks, alerts, hebrew-cal, calendar, system-info)

### Sprint 12–14 — Coverage, State & Reactivity

- **Coverage thresholds** raised to 90 / 81 / 90 / 92 (statements / branches / functions / lines) in `vitest.config.ts`
- **State store wired to config**: `saveConfig()` and `dispatchConfigChange()` now call `state.seedConfig(config)` so UI subscriptions stay in sync without full reloads
- **Weather reactive subscription**: `initWeatherCard()` subscribes `state.on('config.tempUnit', ...)` to re-render on °C/°F toggle without a manual save-and-reload

### Sprint 15 — Structured Error Codes

- **FDB-023 → FDB-057**: `diagLog()` calls in all 11 card `.ts` files now carry structured error codes — enables faster triage in the diagnostic overlay (`D` key)

### Sprint 16 — Startup Waterfall Timing

- **`perf.ts`**: `markDomReady()` / `markStartupComplete()` added; `PerfVitals.startup` field (ms) tracks DOMContentLoaded → last card init waterfall; rated good ≤ 3 000 ms
- **Diag overlay**: new **INIT** metric row appears when `D` key is pressed (FDB-058)

### Sprint 17 — Per-Card Config Accordion

- **Config panel Cards tab**: per-card settings moved from Display tab into `<details>` collapsible accordion groups per card (weather / news / stocks / tasks / system-info); 6 previously config-only settings now have UI: `weatherShowDetails`, `newsMaxItems`, `stocksShowPortfolio`, `tasksShowDone`, `tasksShowCategories`, `sysInfoShowRtt`

### Sprint 18 — FdbCard Web Component Base Class

- **`src/core/fdb-card.ts`** (new): `FdbCard extends HTMLElement` — vanilla Web Component base with `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`, `scheduleRefresh()`, `setLoading()`, `setError()`, `cardId`/`cardSize` getters; zero Shadow DOM (uses global CSS); foundation for v8.0 card migration
- **`tests/unit/core/fdb-card.test.ts`** (new): 13 tests covering all lifecycle methods and helpers

### Sprint 19 — Enhanced API Type Guards

- **4 new guards** in `src/types/api.ts`: `isYahooChartResponse`, `isHebcalResponse`, `isCoinGeckoResponse`, `isCalendarEvent`
- **Strengthened guards**: `isNewsItem` now requires `pubDate` string; `isCurrencyResponse` now requires `time_last_update_utc` string
- **59 tests** in `tests/unit/core/api-validators.test.ts` (was 40)

---

## [7.10.0] — 2026-04-17

> **2287 tests / 54 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `2572344`)

### Hardware Adaptive Performance

- **`src/core/hardware.ts`** (new): `getHardwareProfile()` — scores CPU cores + RAM (`navigator.deviceMemory`) + GPU tier (WebGL `WEBGL_debug_renderer_info`) into `"high"` / `"mid"` / `"low"` composite tier; `optimalConcurrency = floor(cores * 0.6)` capped 2–8; `applyHardwareTier()` sets `data-hw-tier` on `<html>` + `--hw-concurrency` CSS custom property at startup
- **`src/styles/animations.css`**: hardware-adaptive CSS gated on `[data-hw-tier]` — `contain:layout` reflow isolation (high/mid), `will-change:transform` on card rows (high), `content-visibility:auto` on all cards (mid/low), disabled animations + compressed duration tokens on low tier
- **`src/main.ts`**: `applyHardwareTier()` called before `init()`
- **`src/ui/diag-overlay.ts`**: hardware profile row shown in diagnostics panel (`D` key)
- **`tests/unit/core/hardware.test.ts`** (new): 23 tests — CPU defaults, 60% concurrency math, composite tier scoring, profile caching, `formatHardwareProfile`, DOM integration

### Sprint 1 — SW Cleanup + IDB Async Tier

- **`sw.js`**: APP_SHELL now caches `./index.html` (was `BestDashBoard.html`); header bumped to v7.10.0
- **`manifest.json`**: `start_url` and shortcut URL corrected to `./index.html`
- **`src/core/cache.ts`**: `cGetAsync<T>` and `cGetStaleAsync<T>` — async IDB L2 cache read helpers
- **`src/main.ts`**: Card init order reordered by priority (weather/news/alerts first, motivation/sysinfo last)
- **`diagLog()`** calls: FDB-001..FDB-022 structured error codes across main.ts, fetch.ts, alerts.ts

### Sprint 2 — Coverage Thresholds

- **`vitest.config.ts`**: Thresholds raised from 75/70/75/75 → 89/80/89/90
- **`tests/unit/core/cache.test.ts`**: +16 tests for `cGetAsync` and `cGetStaleAsync`

### Sprint 3 — Reactive State Store

- **`src/core/state.ts`** (new): EventTarget-based pub/sub state store — `state.get/set/on/off/seedConfig/snapshot`; `config`/`cache`/`ui` slices; `window.__FDB_STATE__` DevTools hook in DEV builds
- **`tests/unit/core/state.test.ts`** (new): 17 tests

### Sprint 4 — Production Build Flag + Dynamic Import Cleanup

- **`vite.config.ts`**: Callback form — `__USE_PROXIES__ = false` in production (GitHub Pages); `true` in dev/local
- **`src/core/fetch.ts`**: `__USE_PROXIES__` gate before proxy chain; static imports of `cGet/cSet/cGetStale` (removed dynamic `await import`)
- **`src/core/cache.ts`**: Static import of `idbDel` (removed dynamic import from `cEvictIdb`)

### Sprints 5+6 — Worker CI Gate + IDB LRU Eviction

- **`.github/workflows/ci.yml`**: `worker-tests` job gates `build` on worker test suite passing
- **`src/core/idb-cache.ts`**: `idbEstimateSize()` (StorageManager API), `idbEvictLRU(maxBytes)` (LRU eviction), `IDB_MAX_BYTES = 50 MB`
- **`src/ui/diag-overlay.ts`**: IDB storage size shown async in diagnostics panel; fixed vitals HTML ordering bug
- **`tests/unit/core/idb-cache.test.ts`**: +16 new tests for size/eviction functions

### Sprint 7 — Config v4 Namespaced Per-Card Settings

- **`src/types/config.ts`**: `CardConfig` interface (`size?`, `settings?: Record<string, boolean|number|string>`); `cards: Record<string, CardConfig>` on `DashboardConfig`; `CONFIG_VERSION` 3→4
- **`src/core/config.ts`**: v3→v4 migration populates `cards.weather/news/stocks/tasks/system-info` from flat per-card props
- **`tests/unit/core/config.test.ts`**: Updated v3 assertions to v4; +11 new v4 migration tests

### Sprint 8 — Error Reporter + Worker POST /api/errors

- **`src/core/error-reporter.ts`** (new): `reportErrors()` batches + debounces (5 s) → POST /api/errors; `flushErrorReport()` for immediate flush on page unload
- **`worker/src/routes/errors.ts`** (new): `POST /api/errors` validates payload (max 20, 500-char messages), logs to CF console, returns 204
- **`worker/src/utils/response.ts`**: Added POST to CORS Allow-Methods
- **`worker/src/index.ts`**: Wired POST /api/errors route
- **`tests/unit/worker/worker.test.ts`**: +12 tests for errors handler (51→63)
- **`tests/unit/core/error-reporter.test.ts`** (new): 22 tests

### Sprint 9 — ARCHITECTURE.md v7.10

- Updated version header, test counts (2264/53), cache tiers (L3 IDB + L4 SW), new core files, fetch chain `__USE_PROXIES__` note, Worker errors route, test directories, and invariants (#16 state, #17 telemetry)

## [7.9.0] — 2025-06-15

> **2182 tests / 51 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `d2ef433`)

### Sprint 39 — Runtime Error Tracking

- **`src/core/diag.ts`**: `initErrorTracking()` captures unhandled errors and rejections, stores up to 20 entries in `_errorLog`, exposed via `getErrorLog()`; `getErrorSummary()` returns compact diagnostic string

### Sprint 40 — Bundle CI Fix

- **`.github/workflows/ci.yml`**: bundle size gate uses `exit 1` (was `::warning::`) on violation; single unified workflow replacing deprecated `ci-v6.yml`

### Sprint 41 — Web Vitals in Diagnostics

- **`src/core/diag.ts`**: `initWebVitals()` observes `largest-contentful-paint`, `first-input`, `layout-shift` via PerformanceObserver; stores up to 5 entries; `getWebVitalsSummary()` returns formatted string; wired into diagnostics overlay

### Sprint 42 — Config v3 Per-Card Settings

- **`src/types/config.ts`**: 7 new boolean fields (`weatherShowHourly`, `weatherShowWind`, `weatherShowSunrise`, `stocksGroupBySector`, `tasksShowCategories`, `newsShowSource`, `sysInfoShowRtt`); `CONFIG_VERSION` 2→3
- **`src/core/config.ts`**: v2→v3 migration block + sanitization for all 7 new fields
- **`src/ui/config-panel.ts`**: 5 new `<select>` rows wired to populate/collect

### Sprint 43 — IndexedDB Cache Tier

- **`src/core/idb-cache.ts`** (new): async IDB wrapper — `idbGet<T>`, `idbSet`, `idbDel`, `idbClear`, `idbKeys`, `isIdbAvailable`, `_resetIdb`; graceful fallback when IDB unavailable

### Sprint 44 — SW TypeScript Types

- **`src/core/sw-constants.ts`** (new): typed SW message unions, `SW_MSG_SKIP_WAITING`, `SW_MSG_VERSION_ACTIVATED`, `isVersionActivatedMsg()`, `isSkipWaitingMsg()`, `postMessageToSW()`
- **`src/core/sw-register.ts`**: uses typed constants and guards; bug fixed (extra `postMessageToSW` call removed)

### Sprint 45 — Accessibility Phase 2

- **`src/index.html`**: `role="tablist/tab/tabpanel"` + `aria-selected/controls` on config tabs
- **`src/ui/config-panel.ts`**: `initTabKeyboard()` — Arrow/Home/End navigation; `switchCfgTab()` updates `aria-selected`
- **`src/core/sync.ts`**: `setSync()` sets `aria-busy` on nearest `.card` ancestor
- **`src/main.ts`**: `aria-label` on all `.card-collapse-btn` at init

### Sprint 46 — Weather Hourly Strip

- **`src/cards/weather/weather.ts`**: `renderHourlyStrip()` shows next 6 hours as tiles (time, emoji, temp, precip%); gated by `cfg.weatherShowHourly`
- **`src/cards/weather/weather.css`**: `.wx-hourly-strip` + `.wx-h-tile` responsive tile styles

### Sprint 47 — Tasks Enhancements

- **`src/cards/tasks/tasks.ts`**: `isDueToday()` export; `.due-today` CSS class on row + chip; `tasksShowCategories` gates person group headers
- **`src/cards/tasks/tasks.css`**: `.tasks-due-today` + `.tasks-row.due-today` yellow warning styling

### Sprint 48 — News Enhancements

- **`src/cards/news/news.ts`**: `.rss-source` hidden when `cfg.newsShowSource = false`; pulsing `.news-breaking-badge` for `isBreaking()` items
- **`src/cards/news/news.css`**: `.news-breaking-badge` + `newsBreakingPulse` animation

### Sprint 49 — Stocks Enhancements

- **`src/cards/stocks/stocks.ts`**: `renderStocksShell()` gates `.stk-sector-hdr` on `cfg.stocksGroupBySector`; flat list when `false`

---

## [7.8.0] — 2025-01-30

> **2056 tests / 47 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `5b8aa62`)

### Sprint 31 — Architecture Documentation

- **ARCHITECTURE.md**: Updated from v7.4 to v7.7 — test count, CSS co-location section, Worker section, 3 new invariants, fetch chain
- **ROADMAP.md**: All v7.4 + v7.5 checkboxes marked done with notes

### Sprint 32 — CSS Co-location (UI Components)

- **7 new CSS files**: `config-panel.css`, `toast.css`, `night-dimmer.css`, `header.css`, `ticker.css`, `diag-overlay.css`, `status-bar.css` — each imported in its owning TS module
- **sprints.css**: Stripped ~95 lines of migrated rules; retains only 7 cross-cutting globals

### Sprint 33 — Config v2 Schema

- **7 new config fields**: `newsMaxItems`, `weatherShowDetails`, `tasksShowDone`, `stocksShowPortfolio`, `nightDimScheduleEnabled`, `nightDimStartHour`, `nightDimEndHour`
- **CONFIG_VERSION**: 1 → 2 with v1→v2 migration in `migrateConfig()`
- **6 new type guards**: `isValidAlertVolume`, `isValidNightDimLevel`, `isValidNewsMaxItems`, `isValidTickerSpeed`, `isValidHour`
- **`resetConfig()`**: resets to `DEFAULT_CONFIG` and persists
- **`dispatchConfigChange(config)`**: fires `CustomEvent<DashboardConfig>('configchange')` on document

### Sprint 34 — Fetch Resilience

- **`fetchJSONDeduped<T>(url)`**: promise-based request deduplication — concurrent callers for same URL share one in-flight Promise
- **`getInflightCount()`**: diagnostic helper for in-flight dedup requests
- **`getNetworkQualityTier()`**: returns `"ok"|"slow"|"bad"|"unknown"` using Network Information API + consecutive failure tracking
- **`clearFetchLocks()`**: test/reset utility for the fetch lock Set
- **`fetchJSON` proxy failure logging**: now includes HTTP status code + first 60 chars of error message
- **`fetchWithRetry`**: calls `recordFetchFailure()` on each failed attempt

### Sprint 35 — ARIA & Accessibility

- **`a11y.css`**: Comprehensive `:focus-visible` rules — 3px accent ring + glow for cards; rules for buttons, inputs, selects, textareas
- **7 sync dots**: added `role="status" + aria-label` for screen reader announcement of sync state
- **Currency body**: `aria-live="polite" + role="region" + aria-label`
- **Alerts scroll**: `aria-live="assertive" + role="log" + aria-label`
- **Motivation text**: `aria-live="polite"` — announces new quotes

### Sprint 36 — Test Coverage (+28 tests)

- **`fetchJSONDeduped` tests**: deduplication, different-URL non-dedup, return value
- **`getInflightCount`/`clearFetchLocks`/`acquireLock`**: 5 new tests
- **`getNetworkQualityTier`**: 7 tests including Network Info API stubs
- **`resetConfig`/`dispatchConfigChange`**: 6 tests
- **New type guards** (`isValidAlertVolume/NightDimLevel/NewsMaxItems/TickerSpeed/Hour`): 18 tests
- **`isValidHour`**: hardened with `Number.isInteger()` to reject floats

### Sprint 37 — Night Dimmer Schedule + Cache Diagnostics

- **`initNightDimmer(level, scheduleEnabled, startHour, endHour)`**: wires config v2 schedule fields; auto-dim only fires when `scheduleEnabled=true`
- **`main.ts`**: passes `nightDimScheduleEnabled`, `nightDimStartHour`, `nightDimEndHour` from config to dimmer
- **Diag overlay stats**: now shows cache hit/miss/hit-rate, oldest cache age, network quality tier + consecutive failure count

---

## [7.7.0] — 2026-06-14

> **2027 tests / 47 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `5a3b937`)

### Sprint 21 — Runtime API Type Guards

- **`isWeatherResponse()`**: validate Open-Meteo shape before rendering
- **`isNewsItem()`**: validate RSS/feed item structure
- **`isCurrencyResponse()`**: validate ECB currency payload
- **`isAlertEvent()`**: filter malformed Home Front Command events
- **`createCardLoader` validate param**: optional 4th arg wires type guard into the cache loader

### Sprint 22 — Weather UX Improvements

- **`humidityLabel(rh)`**: comfort label ("יבש/נוח/לח/מאוד לח") shown in humidity tile
- **`moonPhase(date)`**: synodic phase glyph + Hebrew name in sunrise/sunset row
- **`precipSummaryLabel(pp)`**: today's rain likelihood text in precip tile
- **`LS_CHART_MODE`**: hourly chart view persisted across refreshes

### Sprint 23 — Countdown Enhancements

- **`urgencyClass(days)`**: applies `cd-urgent-pulse`/`cd-urgent-amber` CSS to countdown
- **`hebrewDayOfWeek(date)`**: Hebrew day-of-week string
- **`daysLabel(days)`**: "היום! 🎉" / "מחר" / "N ימים" for any countdown
- **`advanceAnnualDate(dateStr)`**: auto-advance past annual dates to next occurrence
- **Countdown CSS**: `@keyframes cd-pulse` + urgency tier classes

### Sprint 24 — Tasks Improvements

- **`parseTaskPriority(chore)`**: parse `[H]/[M]/[L]` prefix → badge classes
- **`parseTaskDueDate(chore)`**: parse `@YYYY-MM-DD` suffix → due date chip
- **`isOverdue(dueDateStr)`**: boolean check for past due dates
- **`formatTaskDueDate(dueDateStr)`**: Hebrew-locale date string
- **`taskCompletionRatio(chores, doneMap)`**: `{done, total, pct}` progress
- **Tasks CSS**: priority badge + overdue tint + due-date chip styles

### Sprint 25 — Stocks Enhancements

- **`formatVolume(vol)`**: K/M/B suffix volume formatting
- **`priceInRange52w(price, low, high)`**: 0–1 position in 52-week range
- **`sectorEmoji(sym)`**: emoji by sector for 30+ ticker symbols
- **`portfolioChange(quotes)`**: aggregate portfolio % change
- **`marketStatusLabel()`**: Hebrew market status string

### Sprint 26 — News Card Improvements

- **`readingTimeMinutes(text)`**: estimate reading time at 200 wpm
- **`isBreaking(title, pubDate)`**: detect breaking news by keyword or recency (<30 min)
- **`newsSourceDomain(url)`**: extract clean domain from article URL
- **`sanitizeNewsTitle(title, maxLen)`**: strip HTML entities + truncate

### Sprint 27 — Hebrew-Cal Enhancements

- **`isShabbat(candlesMs?, havdalaMs?)`**: detect current Shabbat window; fallback heuristic
- **`nextHolidayName(items, now?)`**: find next upcoming holiday Hebrew name
- **`hebrewMonthName(date?)`**: current Hebrew month via `Intl.DateTimeFormat`
- **`getParashat(items)`**: extract weekly parasha name from Hebcal items
- **`zmanimTimeLabel(isoOrTime)`**: format zmanim timestamp to 24h display

### Sprint 28 — System-Info Expansion

- **`getConnectionInfo()`**: read `navigator.connection.effectiveType` safely
- **`getViewportSize()`**: return `{width, height, dpr}` from `window`
- **`formatBytes(bytes)`**: format byte counts to B/KB/MB/GB
- **`getPageLoadTime()`**: elapsed ms since module capture
- **`categorizeDevice()`**: classify tv/desktop/tablet/mobile by viewport width

### Sprint 29 — Integration & Quality Utilities

- **`debounce<T>(fn, wait)`**: trailing-edge debounce with timer reset — `src/core/utils.ts`
- **`throttle<T>(fn, wait)`**: leading-edge throttle with window suppression — `src/core/utils.ts`
- **`clamp(value, min, max)`**: numeric range clamping — `src/core/utils.ts`
- **`cacheStats()`**: expose hit/miss counts + hitRate from `cGet` calls
- **`resetCacheStats()`**: reset stats counters (test helper)

---

## [7.6.0] — 2026-06-14

> **1850 tests / 45 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `98c4184`)

### Sprint 11 — Worker OpenAPI + Sefaria Route

- **OpenAPI spec**: `worker/src/routes/openapi.ts` — `handleOpenApi()` serves the spec at `GET /api/openapi`
- **`/api/sefaria/text`**: New worker route returning Daf Yomi text from Sefaria API
- **Rate-limit headers**: `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` on all responses
- **Worker unit tests**: 51 tests covering all 11 worker routes

### Sprint 12 — CSS Co-location

- **`currency/currency.css`**: Per-card stylesheet with `@layer components` rules extracted from `sprints.css`
- **`alerts/alerts.css`**: Same pattern for alerts card
- **`motivation/motivation.css`**: Same pattern for motivation card

### Sprint 13 — Integration Tests

- **`config-save.test.ts`** (7 tests): config round-trip for all fields
- **`sync-dots.test.ts`** (6 tests): sync dot state transitions
- **`cache-stale.test.ts`** (6 tests): TTL and stale cache behavior
- **`theme-switch.test.ts`** (8 tests): `applyTheme` body class mutations
- **`backoff-sequence.test.ts`** (6 tests): failure/success backoff sequencing

### Sprint 14 — Card Improvements

- **Calendar `event-soon`**: Events within 60 minutes get amber highlight + border via `.event-soon` CSS class
- **Hebrew-cal `zman-next`**: Next upcoming zman gets amber outline; `nextItem.classList.add("zman-next")`
- **Stocks `data-stale`**: Stale cached rows get `data-stale="true"` attribute; removed on fresh fetch
- **Tasks keyboard nav**: ArrowUp/ArrowDown moves focus between task rows (`tabIndex=0`)

### Sprint 15 — Accessibility + ARIA

- **`role="timer"` on `#clock`**: Screen readers announce time updates
- **`aria-live="polite"` on `#wx-forecast` and `#stocks-body`**: Live region announcements
- **`aria-expanded` on collapse buttons**: Set by `initCardCollapse()`, toggled by `doToggle()`
- **`role="status"` on sync dots**: Set by `registerSyncDot()`; `aria-label` updated by `setSync()`

### Sprint 16 — Config Panel Improvements

- **Auto-focus**: First text input auto-focuses when config panel opens (50ms delay)
- **Dirty indicator**: Input/change events set gear button to `⚙️*`; cleared on save/close
- **Import toast**: Shows `"✅ ייבאו N שדות הגדרה"` after successful import
- **JSON live validation**: `cfg-chores` and `cfg-portfolio` textareas get red outline on invalid JSON
- **Ctrl+S shortcut**: Submits config panel without mouse

### Sprint 17 — Diagnostics Monitoring

- **`getFailedPanes()`**: Exported from `sync.ts`; returns panes with `>0` backoff failures
- **`renderStats()`**: Added to diag overlay — shows localStorage KB, worker status, failed panes, version, build time
- **Auto-refresh**: Diag overlay refreshes stats every 5 seconds; timer cleared on close

### Sprint 18 — Card Enhancements

- **Alerts page title**: `document.title` updated with `⚠️ (N)` prefix when unread count `> 0`
- **Alerts badge click**: Clicking the badge clears the unread count and hides the badge
- **Stale stocks CSS**: `[data-stale="true"] .stk-price/.stk-chg` dimmed (opacity 0.5, italic); `⏱` suffix
- **Zman tooltip**: `zman-next` item gets `title="בעוד N דק׳"` showing minutes until the next zman
- **News scroll reset**: `elRssScroll.scrollTop = 0` on every fresh render

### Sprint 19 — Test Coverage Expansion

- **Alerts tests** (+3): `clearUnreadAlerts`, badge hide, `document.title` mutation
- **Diag overlay tests** (+3): `renderStats` populates `#diag-panes`, auto-refresh timer cleanup
- **Maximize tests** (+3): `initCardCollapse` `aria-expanded` initial + toggle behavior
- **Config panel tests** (+2): dirty indicator set on input, cleared on close

---

## [7.5.0] — 2026-05-11

> **1762 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `e1fd6ab`)

### Sprint 1 — Worker Middleware Layer

- **CORS middleware**: `worker/src/middleware/cors.ts` — `isPreflight()` / `handlePreflight()` (204 + headers)
- **Rate-limit middleware**: `worker/src/middleware/rate-limit.ts` — 120 req/min sliding window per IP, 429 response
- **Request logger**: `worker/src/middleware/log.ts` — structured console log for `wrangler tail`
- **Worker pipeline**: `index.ts` wired as `preflight → rate-limit → route → log`
- **CORS module refactor**: routes import from middleware, no inline CORS_HEADERS duplication

### Sprint 2 — Worker Validation Helpers

- **`ValidationError` class**: `worker/src/utils/validation.ts` with typed `param` field
- **Validation helpers**: `requireLat/Lon/Year/GeoId/Symbol/HttpsUrl/Param` with 400 error bodies
- **Route hardening**: `data.ts` and `feeds.ts` refactored to use validation helpers; consistent `{error,param}` shape

### Sprint 3 — ESLint Rule Expansion

- **`no-misused-promises`**: `checksVoidReturn.attributes: false` — catches forgotten `await` in event handlers
- **`require-await`**: Flags async functions with no `await` — fixed `loadMotivation()` (was bodyless async)

### Sprint 4 — Documentation

- **`CONTRIBUTING.md`**: Full setup/dev/test/PR guide with architecture overview
- **`worker/README.md`**: API reference for all 10 worker routes (params, errors, cache TTLs, rate limiting)
- **Issue templates**: `bug_report.md` and `feature_request.md` in `.github/ISSUE_TEMPLATE/`
- **ROADMAP.md**: v7.4 row added to Version History table

### Sprint 5 — Static Fallbacks + Stale Cache Utility

- **`fetchWithStale<T>()`**: `src/core/fetch.ts` utility — fresh → stale optimistic → fetch fresh → error keeps stale/fallback
- **`DAF_STATIC_FALLBACK`**: Exported constant from `hebrew-cal.ts`; shown in `loadDafYomi` when both cache and network fail

### Sprint 6 — Build Flags + Prod Hardening

- **`__BUILD_TIME__`**: ISO timestamp injected by Vite at build time; shown in diagnostics overlay
- **`__USE_PROXIES__`**: Boolean env flag (`VITE_NO_PROXIES` disables proxy chain)
- **`scripts/check-bundle-size.mjs`**: CI guard — JS ≤ 100 KB gzip, CSS ≤ 25 KB gzip; exits 1 on violation
- **`check:bundle` script**: Added to `package.json`

### Sprint 7 — Worker-First Cards

- **Weather card**: `fetchJSON` → `fetchJSONWithWorker` (worker proxy, fallback to direct)
- **Currency card**: `fetchJSON` → `fetchJSONWithWorker`
- **Alerts card**: Tries `WORKER_BASE_URL/api/alerts` first, falls back to direct + proxy chain
- **`isWorkerEnabled()` caching**: Caches static conditions (`protocol` + URL length); `navigator.onLine` re-checked each call
- **`resetWorkerEnabledCache()`**: Exported for tests and network-change scenarios

### Sprint 8 — UI Polish

- **Toast progress bar**: `::after` shrink animation; `--toast-dur` CSS custom property drives duration
- **Toast `.visible` fix**: CSS now defines `#toast.visible` (was only `.toast-show`)
- **Refresh age display**: `updateRefreshAge()` appends `(Nm)` to refresh stamp after 1 min; runs on 60s interval
- **`--dimmer-warm-color`**: Design token in `tokens.css`; night-dimmer uses `setProperty` instead of hardcoded `#8B4513`

### Sprint 9 — Card Improvements

- **Tasks completion %**: Badge now shows `N / M ✓ (XX%)` in both render paths
- **Holiday countdown**: `renderHoliday()` now shows Gregorian date + proximity colouring (red ≤ 7d, amber ≤ 30d)

### Sprint 10 — Tests + Release

- **`fetchWithStale` tests**: 4 cases covering fresh hit, stale+fetch, fallback-on-failure, optimistic fallback
- **`DAF_STATIC_FALLBACK` tests**: Type and pattern validation for the fallback constant
- **`resetWorkerEnabledCache` test**: Verifies cache reset re-evaluates after stub changes

---

## [7.4.0] — 2026-04-16

> **1755 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `d3ebc66`)

### Sprint 1 — Quality Gates & Tooling

- **Coverage thresholds**: Vitest coverage minimums set to 75/70/75/75 (statements/branches/functions/lines)
- **Renovate**: `.github/renovate.json5` added with grouped dependency update rules
- **`configVersion`**: `CONFIG_VERSION = 1` constant + `configVersion` field in `DashboardConfig`
- **`migrateConfig()`**: Exported from `src/core/config.ts`; handles forward migration from older config shapes
- **`sanitize()`**: Applies `isValidTheme`, `isValidScreenMode`, `isValidTempUnit` type guards on load
- **SW version check**: `scripts/check-sw-version.mjs` added; wired into `npm run check` pipeline

### Sprint 2 — SW Auto-Version & Config Hardening

- **`__APP_VERSION__`**: Vite + Vitest `define` reads `package.json` version at build time; declared in `vite-env.d.ts`
- **`injectSwVersion` plugin**: Vite plugin replaces `__APP_VERSION__` placeholder in `dist/sw.js` post-build
- **SW placeholder**: `sw.js` cache names now use `"familydashboard-v__APP_VERSION__"` — no manual version bumps needed
- **`main.ts` VERSION**: `export const VERSION = __APP_VERSION__` replaces hardcoded string
- **`isValidFontScale()`**: Type guard (0.5–2.0) added to `src/types/config.ts`; applied in `sanitize()`

### Sprint 3 — Worker Security Hardening

- **News SSRF allowlist**: `ALLOWED_NEWS_ORIGINS` (19 RSS origins) enforced in `handleNews`
- **`/health` endpoint**: Worker responds `{ status: "ok" }` at `GET /health`

### Sprint 4 — Worker Route Split

- **`worker/src/utils/response.ts`**: Shared `CORS_HEADERS`, `jsonResponse()`, `proxyResponse()`
- **`worker/src/utils/allowlists.ts`**: `ALLOWED_CALENDAR_ORIGINS` + `ALLOWED_NEWS_ORIGINS`
- **`worker/src/routes/data.ts`**: `handleWeather`, `handleCurrency`, `handleHebcal`, `handleHebcalHolidays`
- **`worker/src/routes/feeds.ts`**: `handleStocks`, `handleNews`, `handleAlerts`, `handleCalendar`, `handleSefariaCalendar`
- **`worker/src/index.ts`**: Refactored to 50-line router importing from extracted modules

### Sprint 5 — CSS Architecture Cleanup

- **`sprints.css` layering**: All `@keyframes` moved into `@layer animations {}`; all component rules into `@layer components {}`

### Sprint 6 — Fetch Backoff & Network State

- **`fetchWithRetry<T>()`**: Exponential backoff with configurable `maxAttempts` (default 3) and `baseDelayMs` (default 1000ms)
- **Network state tracker**: `recordFetchSuccess()`, `recordFetchFailure()`, `isNetworkOffline()`, `getConsecutiveFailures()`
- **`fetchJSON()` integration**: Wires `recordFetchSuccess`/`recordFetchFailure` on all success/failure paths

### Sprint 7 — ESLint Strict

- **`prefer-optional-chain`**: Enforced as error; 8 violations fixed across stocks, diag-overlay, night-dimmer, toast, config-panel
- **`no-import-type-side-effects`**: Enforced as error
- **`no-console`**: Enforced as warning; no `console.*` in `src/`

### Sprint 8 — Documentation

- **`ARCHITECTURE.md`**: Updated to v7.4 — worker split structure, fetch chain with backoff, updated test count, 2 new key invariants

### Sprint 9 — Tests

- **`fetch.test.ts`**: +8 tests for `fetchWithRetry` (success, retry, exhaustion) and network state tracker
- **`config.test.ts`**: +9 tests for `isValidFontScale` (valid range, out-of-range, NaN/Infinity/string)
- **Total**: 1748 tests / 39 suites / 0 failures (up from 1723)

---

## [7.3.0] — 2026-04-16

> **1723 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint: 10-Feature Sprint (F1–F10)

- **F1 — Diag clear log button**: `#diag-clear-btn` in diagnostics overlay wired via `initDiagOverlay()` → calls `clearDiag()`, `renderLog()`, then `diagLog("[diag] Log cleared")`
- **F2 — Storage estimate tile**: `#sysinfo-storage` tile in system-info card shows `usedMb / quotaMb MB` from `navigator.storage.estimate()` (StorageManager API)
- **F3 — Remove done tasks button**: `removeDoneTasks()` exported from `tasks.ts`; `#tasks-remove-done-btn` permanently removes completed items from `dash_chores` localStorage and clears done-map
- **F4 — Config panel live theme preview**: `#theme-select` change event calls `applyTheme()` immediately for live preview before saving config
- **F5 — SW version chip in status bar**: `#sw-version` span listens for `VERSION_ACTIVATED` SW message → displays SW cache version with `hidden=false`
- **F7 — Motivation auto-advance timer**: `setMotivationInterval(minutes)` exported from `motivation.ts`; `#cfg-moti-interval` input (0–60) in config panel; 0 = disabled, >0 = auto-rotate quotes every N minutes
- **F8 — Tasks person-filter chips**: `renderFilterChips()` in `tasks.ts` builds `.tasks-person-chip` buttons in `#tasks-filter-bar` when >1 unique person; clicking toggles `_filterPerson` and re-renders filtered tasks
- **F9 — System info RTT tile**: `#sysinfo-rtt` tile shows network round-trip time from Connection API (`navigator.connection.rtt`) with fallback to `PerformanceNavigationTiming`
- **F10 — Dynamic help overlay shortcuts**: `getKeyboardActions()` populates `#help-dynamic-keys` with registered shortcut count when help dialog opens
- **Tests**: 17 new tests covering F1 clear button, F2 storage estimate, F3 removeDoneTasks, F7 setMotivationInterval, F8 person filter chips, F9 RTT tile, F10 dynamic help
- **Version**: bumped to `7.3.0` in `package.json`, `sw.js`, README badge, docs, SVG assets

---

## [7.2.0] — 2026-04-17

> **1706 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

### Sprint: 10-Feature Sprint (F1–F10)

- **F1 — Precipitation chip**: `#wx-precip` tile in weather card shows today's max precipitation probability (`%`) from Open-Meteo `daily.precipitation_probability_max[0]`
- **F2 — Alert beep volume**: `setAlertVolume(vol)` / `getAlertVolume()` exported from `alerts.ts`; range slider `#cfg-alert-volume` in Alerts config tab; saved in `config.alertVolume`; applied on startup and config save; live-preview value label
- **F3 — Night dimmer warm tint**: `setWarmTint(on)` / `isWarmTint()` in `night-dimmer.ts`; `#cfg-dim-warm` toggle in Display tab; applies `.warm-tint` CSS class (`background: #6B3A1F`) when dimmer is active; saved in `config.dimWarmTint`
- **F4 — Reset all to defaults**: `#cfg-reset-all-btn` red danger button in Advanced tab; clears all `dash_*` localStorage keys after confirmation prompt, then reloads
- **F5 — SW CLEAR_API_CACHE**: Service Worker message handler for `{ type: "CLEAR_API_CACHE" }` deletes `CACHE_NAME_API` and broadcasts `API_CACHE_CLEARED` to all clients; SW version bumped to `v7.2.0`
- **F6 — Cache staleness chip**: `getOldestCacheAgeMinutes()` exported from `cache.ts` scans all `dash_v2_*` localStorage entries for oldest `ts`; `#cache-age` span in status bar shows `⏱ Nm` updated every 60 s
- **F7 — Tasks quick-add form**: `#tasks-quick-add` form with person + chore text inputs and add button; `addQuickChore(person, chore)` appends to `dash_chores` localStorage JSON and re-renders; wired in `initTasksCard()`
- **F8 — Countdown 2nd event**: `tick2()` exported from `countdown.ts`; reads `countdownCard2{Title,Date,Time,DoneMsg}` from config; shows/hides `#cd2-section`; 4 config inputs in Advanced tab under "אירוע 2"
- **F9 — News source filter chips**: `renderSourceFilterChips()` exported from `news.ts`; populates `#news-filter-bar` with one `.news-src-chip` per `NEWS_FEEDS` entry with Google favicon; called in `initNewsCard()`
- **F10 — L key warm tint toggle**: `L` key registered in `main.ts` calls `setWarmTint(!isWarmTint())`; description "גוון חם לדימר לילה" in help overlay
- **ESLint**: `coverage/**` added to ignore list in `eslint.config.mjs` (removes false warnings from generated coverage artifacts)
- **Tests**: 20 new tests covering F2 alert volume, F3 warm tint, F6 cache age, F8 tick2, F9 filter chips, F10 L-key registration
- **Version**: bumped to `7.2.0` in `package.json`, `src/main.ts`, `src/ui/status-bar.ts`, `sw.js`

---

## [7.1.7] — 2026-04-16

> **1686 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Config save toast**: shows "✅ הגדרות נשמרו בהצלחה" confirmation toast after saving settings panel
- **Maximize ARIA**: `aria-expanded` attribute set/cleared on card expand/collapse for accessibility
- **Keyboard V**: `V` key opens config panel directly to the Cards visibility tab
- **System-info uptime**: reformatted from `H:MM שעות` to `HH:MM:SS` for clarity
- **Countdown progress bar**: visual `cd-progress-bar` driven by new `countdownCardStartDate` config field; start date input in Advanced tab
- **Ticker speed**: configurable 1–5 speed slider in Display tab; `applyTickerSpeed()` sets `--ticker-duration` CSS var and updates running animation
- **Tasks badge**: shows `N / M ✓` done-counter format (previously hid when all done)
- **Test coverage — stale-SW cleanup**: 3 tests for unregistering wrong-scope SW, skipping correct-scope SW, and deleting old version caches
- **Test coverage — countdown `computeProgress`**: 4 tests for null on invalid range, 0 at start, 1 past target, and in-range interpolation
- **Test coverage — maximize `aria-expanded`**: 2 tests confirming attribute set on expand and cleared on collapse
- **Test coverage — tasks N/M badge**: 3 tests for initial render, single-check update, and all-done display
- **Test coverage — ticker `applyTickerSpeed`**: 4 tests for speed 1/3/5 and out-of-range clamping

---

## [7.1.6] — 2026-04-16

> **1663 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Test coverage — status-bar online/offline**: 3 tests for `window` `online`/`offline` event callbacks updating `#conn-indicator`
- **Test coverage — night-dimmer chip**: 3 tests for `updateDimIndicator()` when `#dim-indicator` chip element is present (active/inactive/absent)
- **Test coverage — bg-images crossfade**: 3 tests for `rotateBgImage()` `img.onload` crossfade, empty-validImages early-return, and null-layers early-return; also fixed orphaned stray code from previous session
- **Test coverage — layout-drag branches**: 2 tests for `readCurrentLayout()` when columns absent (line 28 `??` fallback) and drop-after-midpoint `insertBefore(card, target.nextSibling)` (line 118)
- **Test coverage — tasks checkbox handler**: 2 tests for badge hide (`badge.style.display="none"`) and `#tasks-all-done-msg` show when last checkbox is checked via `change` event (lines 146, 150)
- **Test coverage — countdown clearInterval**: 1 test for `tick()` clearing `_cdInterval` when interval fires on a past event (lines 119-120); uses `vi.advanceTimersByTime`
- **Test coverage — stocks `_statusMarketChip`**: 2 tests for `updateMarketBadge()` updating `#status-market-chip` textContent and className (lines 151-152)
- **Test coverage — config-panel sliders**: 1 combined test for `dim-level` and `font-scale` range slider `input` events updating their display spans (with correct `max="150"` for font-scale)

---

## [7.1.5] — 2026-04-15

> **1648 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Test coverage — system-info tiles**: 6 new tests for `sysinfo-memory` ("X GB" / "—"), `sysinfo-cpu` ("×N ליבות" / "—"), `sysinfo-viewport` (DPR suffix variants) added in v7.10
- **Test coverage — tasks-all-done-msg**: 5 new tests covering show (all done), hide (pending), hide (no chores), `markAllDone()`, and `resetDoneToday()` state transitions
- **Test coverage — keyboard shortcuts**: 10 new tests for `w` / `1` / `2` / `3` / `m` key registrations and city-tab handler no-throw behavior
- **Test coverage — cfg-clock-seconds**: 4 new tests for `populateForm` ("on"/"off") and `collectForm` (`true`/`false`) for the clock-seconds toggle

---

## [7.1.4] — 2026-04-15

> **1623 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Countdown — `getDaysSince()`**: exported helper; `tick()` now shows elapsed days in `#cd-days` when the event has passed; `#cd-msg` appends `· יום N`
- **Keyboard — `1/2/3` shortcuts**: switch screen mode directly (compact / normal / cinema) without cycling
- **Alerts — `buildAlertItem()` tests**: full branch coverage for threat-level, link-wrapping, missing-description paths
- **Config panel — portfolio editor tests**: save path, invalid-JSON toast path, `tasksResetHour` clamp, NaN-preserves-default
- **Test stability**: fixed `countdown.test.ts` stale `els` cache (use `initCountdownCard()` to refresh); fixed flaky `getTimeComponents` race with `vi.useFakeTimers()`

---

## [7.1.3] — 2026-04-16

> **1605 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Weather — dew point**: `#wx-dew` now populated from `dew_point_2m` (Open-Meteo `current=`); shown in °C or °F per user setting
- **Weather — wind gust**: `#wx-gust` shows gust speed only when gust > sustained wind + 5 km/h; hidden otherwise
- **Config panel — portfolio editor**: `cfg-portfolio` textarea in Advanced tab lets user edit stock portfolio JSON; validates on save, calls `renderPortfolioRow()` immediately
- **Tasks — configurable reset hour**: `tasksResetHour` field in `DashboardConfig` (default: 6); configurable via `cfg-tasks-reset-hour` number input (0–23) in Advanced tab
- **Keyboard — W key**: `W` toggles °C/°F temperature unit (same as clicking the temperature); help overlay updated
- **System info — Memory tile**: `#sysinfo-memory` shows device RAM via `navigator.deviceMemory` (e.g. `8 GB`)
- **System info — CPU tile**: `#sysinfo-cpu` shows logical core count via `navigator.hardwareConcurrency` (e.g. `×16 ליבות`)
- **Test stability**: fixed flaky `countdown.test.ts` `getTimeComponents` race condition using `vi.useFakeTimers()`

## [7.1.2] — 2026-04-15

> **1574 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint

- **Markdown lint**: fixed `MD032/blanks-around-lists` in `pre-release.instructions.md` — all 26 markdown files now 0 errors
- **Test count**: corrected to 1574 tests (4 additional tests counted; was 1570 in badges/docs)

---

## [7.1.1] — 2026-04-15

> **1570 tests / 39 suites / 0 failures** · 0 ESLint · 0 TS · 0 markdownlint (commit `aee6b84`)

- **CI unified**: merged `ci-v6.yml` into a single `ci.yml` (typecheck → lint → markdownlint → vitest matrix → security → build); `actions/checkout@v4` + `setup-node@v4` (were broken `@v6`); bundle size violations now `exit 1`
- **Countdown card** (11th card): animated tile grid counting to חתונת אליאור וטובה — 7 May 2026 18:00 · 16 new tests (commit `0ca3e4f`)
- **Hebrew date header**: fixed stuck "טוען תאריך עברי…" via `Intl.DateTimeFormat('he-u-ca-hebrew')`
- **Favicon**: fixed browser-default icon — moved to `src/public/` (Vite static dir); manifest `start_url` corrected
- **News scroll**: fixed summary text overlapping headlines — `overflow:hidden` flex wrapper
- **Hebrew Cal + Tasks**: refactored to bordered tile/grid layout
- **Docs consolidated**: `copilot-instructions.md`, `workspace.instructions.md`, `cicd.instructions.md`, `CLAUDE.md`, `release/SKILL.md` all updated to v7.1 / 1570 tests

---

## [7.1.0] — 2026-04-15

> **1554 tests / 38 suites / 0 failures** · 0 markdownlint errors (commit `5f0f73d`)

- **Drag-and-drop card layout**: HTML5 Drag API — reorder cards between columns; layout persisted to `config.cardLayout`; ↩ reset in config panel
- **Coverage sprint**: +13 branch-gap tests across stocks, news, weather, hebrew-cal, ticker, layout-drag
- **Markdownlint**: 297 → 0 errors across 29 files; `lint:md` script added; dead files removed

---

## [7.0.0] — 2026-04-14

> TypeScript v7 card system · **1390 tests / 37 suites / 0 failures** (commit `alpha2`)

- **Hebrew Calendar enhancements**: Shabbat countdown timer, Sefaria deep-links (Daf + Parasha), Halacha Yomit, school vacation indicator
- **Tasks card** + **System Info card**: new cards with localStorage persistence and zero network dependency
- **Card type system + registry**: `CardDefinition`, `registerCard/getCard`, lazy `import()` for all 10 cards
- **6th theme "Rose Night"**: deep crimson/burgundy palette
- **CSS `@layer` architecture**: `tokens → themes → base → layout → components → animations`, `@container` queries, `color-mix()` tokens
- **Dialog migration**: `#help-overlay` + `#diag-overlay` → `<dialog>` + `showModal()/close()`
- **Worker-first fetch**: `fetchJSONWithWorker<T>()` primary; proxy-chain fallback; card visibility/size UI
- **URL hash config import**: `#cfg=<base64>` on startup; share button copies hash URL
- **Shared npm model**: all dev tools at parent `MyScripts/`; CI via `install-tools.sh`

---

## [6.5.0] — 2026-04-14

> 932 → **1240 tests** / 33 suites / 0 failures

- Coverage sprints: `cache.ts` 72%→100%, `base-card.ts` 80%→100%, `motivation.ts` 88%→100%, `alerts.ts` 78%→91%, `calendar.ts` 75%→95%, `maximize.ts` 72%→82%
- Fixed flaky `hebrew-cal.test.ts` — `vi.setSystemTime()` freeze

---

## [6.4.0] — 2026-04-14

> 932 tests / 32 suites — coverage sprints: stocks 70%→85%, hebrew-cal 76%→83%, ticker 80%→91%, calendar 73%→75%

---

## [6.3.0] — 2026-04-14

> Coverage sprints: news 81%→95%/78%→93% (+27 tests), alerts +8, bg-images +4, config-panel +8

---

## [6.2.0] — 2026-04-14

> 574 → 849 tests — Stock alerts/P&L, weather multi-city, UV/sky/peak badges, news highlight/search/bookmarks, Hebrew cal zmanim/psalm/moon, night dimmer, card collapse, ESLint rewrite

---

## [6.1.0] — 2026-04-13

> 574 tests — Birthday chip, countdown chip, background rotation, bookmarks (`B` key), market badge

---

## [6.0.0] — 2026-04-12

> Full TypeScript modular rewrite — Vite 8 + Vitest + Cloudflare Worker · 510 tests / 29 suites

- Single `BestDashBoard.html` → modular `src/` TypeScript with Vite build; `src/core/`, `src/ui/`, `src/cards/` (8 cards)
- ServiceWorker v6.0.0, dual-layer cache, fetch chain, CI pipeline (`deploy.yml`, `release.yml`, `deploy-worker.yml`)

---

## [5.x.x] — Legacy Single-File Era (archived)

> `BestDashBoard.html` — 1084 mocha tests. Preserved read-only. All development continues in `src/` (v6+).
