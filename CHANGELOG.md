# Changelog

All notable changes to FamilyDashBoard are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [7.1.0] — 2026-04-15

> **1554 tests / 38 suites / 0 failures · Branch coverage: 93.72% · 0 markdownlint errors**

### Added

- **Drag-and-drop card layout** (sprint v7.6): HTML5 Drag API — drag card headers to reorder between columns; layout persisted to `config.cardLayout`; ↩ reset button in config panel Cards tab
- **Coverage sprint** (sprint v7.7): +13 branch-gap tests covering stocks, news, weather, hebrew-cal, ticker, layout-drag

### Changed (infra — sprint v7.8)

- **Markdownlint**: 297 → 0 errors — fixed MD022/MD031/MD032/MD034/MD040/MD047 across 29 files
- **CI**: markdown lint step updated to `markdownlint-cli2`; `lint:md` script added to `package.json`
- **Dead files removed**: `package.v5.json`, `package.v6.json`, `BestDashBoard.html copy.bak`, `eslint_out.txt`, `eslint.config.ts`

---

## [7.0.0] — 2026-04-14

> TypeScript v7 card system · **1390 tests / 37 suites / 0 failures**

### Added (alpha2)

- **Hebrew Calendar: Shabbat countdown** (`hc-countdown`): live HH:MM:SS timer showing time until candle lighting on Friday (within 6h) and Havdalah on Saturday
- **Hebrew Calendar: Sefaria deep-link buttons** (`hc-daf-link`, `hc-parasha-link`): open Sefaria.org at the exact Daf or Parasha page
- **Hebrew Calendar: Halacha Yomit** (`hc-halacha`): daily halacha from Sefaria calendars API — zero extra network cost (same request as Daf Yomi)
- **Hebrew Calendar: School vacation indicator** (`hc-school`): shows when a major Israeli school vacation started within the past 7 days (Chagim, חנוכה, פורים, פסח, קיץ)
- **Keyboard: `A` key** toggles Tzeva Adom alerts on/off with toast confirmation
- **alerts.ts**: `toggleAlerts()` and `isAlertsEnabled()` exported for external wiring
- **Coverage tests**: 35 new tests — `toggleAlerts`/`isAlertsEnabled`, OS dark-mode matchMedia listener, `getTasksForToday`, `loadDoneMap` catch, `formatCountdown`, `startCountdown`, `renderTasksStrip`, `renderNextCalEvent` with full DOM, `markVisited` quota catch, news dedup/sort branches, logo img error handler, config-panel cards tab rendering, collectForm card visibility + size saves

### Added (alpha1 — 2026-04-14)

- **Card type system** (`src/types/card.ts`): `CardDefinition`, `CardConfigField`, `CardSlot`, `CardRegistryEntry`
- **Card registry** (`src/core/card-registry.ts`): Map-based `registerCard/getCard/listCards/loadCard`; lazy-loads all 10 cards via dynamic `import()`
- **Tasks card** (`src/cards/tasks/`): Family chore board — localStorage-persisted, daily 6AM reset, grouped by person, checkbox done-state; exports `getTasksForToday()`
- **System Info card** (`src/cards/system-info/`): Battery, network, uptime, page load timing, browser/platform info — zero network dependency
- **6th theme "Rose Night"** (`theme-rose`): Deep crimson/burgundy palette; `ThemeName` union extended
- **CSS `@layer` architecture**: `tokens → themes → base → layout → components → animations` layer order in `tokens.css`
- **CSS `@container` queries**: `container-type: inline-size` on `.card`; responsive layout at `max-width: 320px`
- **CSS `color-mix()` derived tokens**: `--accent-subtle`, `--accent-dim`, `--positive-subtle`, `--negative-subtle`, `--bg-overlay`
- **Dialog migration**: `#help-overlay` and `#diag-overlay` migrated from `<div>` to `<dialog>`; `showModal()/close()` API; `::backdrop` CSS
- **Worker-first fetch** (all cards): `fetchJSONWithWorker<T>()` primary fetch path; `fetchViaWorker` → direct/proxy fallback for all API calls
- **Card visibility UI**: "כרטיסיות" tab in config panel; per-card show/hide checkboxes; `hiddenCards` persisted in config; `applyHiddenCards()` wired on init + save
- **Card layout persistence**: `applyCardLayout()` re-parents cards per saved `cardLayout` column assignment at startup
- **Card size variants**: `data-card-size="sm|md|lg|xl"` CSS; config-panel size selector per card
- **URL hash config import**: `#cfg=<base64>` applied on startup; share button copies hash URL to clipboard
- **OS dark-mode hook**: `prefers-color-scheme` MediaQueryList listener in `theme.ts`; auto-applies ocean/dark when OS switches
- **Hebrew-cal × Tasks bridge**: `getTasksForToday()` in tasks.ts; `hc-tasks-strip` inside Hebrew Calendar card shows today's pending tasks
- **Security fix** `renderStocksShell()`: `innerHTML` → `DocumentFragment` + `createElement`
- **Shared npm model**: All dev tools at parent `MyScripts/package.json`; CI uses `.github/ci/install-tools.sh`
- **Tests**: tasks (22), card-registry (22), worker-fetch (9+) — 3+  new suites

### Changed

- hc-chore removed; replaced by Tasks card integration (roadmap v7.1)
- `hc-parasha-progress-row` and `hc-aliyot-row` removed (dead code)
- Hebrew Calendar layout: 2-column `hc-main-col` + `hc-side-col` (moon block + zmanim on physical left in RTL)
- Sefirat HaOmer null-cache bug fixed: off-season fetches no longer permanently suppress the row
- Holiday/special/event dedup: `_lastHolidayName` / `_lastSpecialNames` prevent duplicate text across rows
- ESLint: `no-explicit-any` error, `prefer-const` error, `consistent-type-imports`

---

## [6.5.0] — 2026-04-14

> Coverage sprint series · 932 → **1240 tests** / 33 suites / 0 failures

- Coverage sprint — `cache.ts`: 72% → 100% stmts, 65% → 94% branches (+8 tests; `cGetStale`, `cSet` quota evict, `cEvict` edge cases)
- Coverage sprint — `base-card.ts`: 80% → 100% stmts, 73% → 100% branches (new file, 10 tests; all `createCardLoader` + `scheduleCard` paths)
- Coverage sprint — `motivation.ts`: 88% → 100% stmts (+7 tests; fade, share, button click handlers)
- Coverage sprint — `alerts.ts`: 78% → 91% stmts (+9 tests; both interval branches, page-hidden path)
- Coverage sprint — `calendar.ts`: 75% → 95% stmts (+11 tests; countdown labels, heat-2 strip, ICS extra URLs)
- Coverage sprint — `maximize.ts`: 72% → 82% branches (+4 tests; `startViewTransition` guard, orphan header guard)
- Fixed flaky `hebrew-cal.test.ts` — `vi.setSystemTime()` freeze prevents `days=0` filter race

---

## [6.4.0] — 2026-04-14

> Coverage sprints · 932 tests / 32 suites / 0 failures

- Coverage sprint — `stocks.ts`: 69.9% → 84.76% stmts (+15 tests; NaN/negative trend, midnight paths)
- Coverage sprint — `hebrew-cal.ts`: 75.66% → 83.4% stmts (+13 tests; candles, holiday, omer, parasha, daf yomi)
- Coverage sprint — `ticker.ts`: 80.23% → 91.27% stmts (+3 tests; null calData, proxy chains)
- Coverage sprint — `calendar.ts`: 72.62% → 75.4% stmts (+5 tests; zero-duration event, location field)

---

## [6.3.0] — 2026-04-14

> Coverage sprints · 896 tests / 31 suites / 0 failures

- Coverage sprint — `news.ts`: 81% → 95% stmts, 78% → 93% branches (+27 tests; stale tinting, age badge, search highlight, DOMParser)
- Coverage sprint — `alerts.ts` (+8 tests), `bg-images.ts` (+4 tests; Image.onload crossfade), `config-panel.ts` (+8 tests; export/import)

---

## [6.2.0] — 2026-04-14

> 50+ feature completion sprints · 574 → 849 tests / 31 suites / 0 failures

- Stock alerts (`checkStockAlerts`, `>/<`/`>=/<=` operators, session dedup); Portfolio P&L (`renderPortfolioRow`, `#header-portfolio-pl` chip)
- Market countdown (`updateMarketCountdown`, state text + minutes); relative volume badge; hidden symbols (`applyHiddenStocks`)
- Weather multi-city tabs (3 localStorage slots); feels-like, precipitation bar, 7-day summary pill
- UV index pill; sky condition pill (`getSkyCategory`, all WMO codes); electricity peak badge; seasonal body class
- News keyword highlight (`highlightTitle` — DOM-safe); search + visited articles; stale tinting; count badge; font size; age badge
- Hebrew calendar: Psalm of Day, moon phase, Zmanim API, next calendar event, chores display
- Night dimmer schedule; auto-theme; clock seconds toggle (`C` key); real-time alerts config
- Card collapse (`initCardCollapse`, persist localStorage); motivation share/next buttons; custom ticker message
- Network reconnect handler (offline/online + SW `NETWORK_BACK` → reload after 2.5 s)
- ESLint rewrite (`tseslint.config()`, type-aware rules); CSS card co-location; `renderStocksShell()` dynamic generation

---

## [6.1.0] — 2026-04-13

> Birthday/countdown chips, bookmarks, market badge, background rotation · 574 tests / 30 suites

- Birthday chip (`updateBirthdayChip`, within 14 days); countdown chip (`updateCountdownChip`)
- Background image rotation (`initBgImages`, HTTPS-only, 2 crossfading layers, 30-min interval)
- News bookmarks (B key, `dash_bookmarks` localStorage, `#news-bkm-pill`)
- Market badge (`getMarketStatus`, `getMinutesToNextTransition`, `updateMarketBadge`)

---

## [6.0.0] — 2026-04-12

> Full TypeScript modular rewrite — Vite 8 + Vitest + Cloudflare Worker · 510 tests / 29 suites

- Complete rewrite: single `BestDashBoard.html` → modular `src/` TypeScript with Vite build
- `src/core/`: cache, fetch, diag, config, sync, idle, sw-register, constants
- `src/ui/`: theme (5 themes), keyboard, maximize, scroll, header, ticker, status-bar, night-dimmer, toast
- `src/cards/`: news, weather, stocks, currency, calendar, hebrew-cal, alerts, motivation — each with own `.css`
- ServiceWorker v6.0.0: APP_SHELL pre-cache, API cache (7 origins), offline HTML fallback
- CI: `ci-v6.yml` (typecheck + lint + tests + build + size guard), `deploy.yml`, `release.yml`, `deploy-worker.yml`
- Dual-layer cache (in-memory Map + localStorage `dash_v2_*`, 7-day eviction)
- Fetch chain: direct → allorigins → codetabs → corsproxy.io with `fetchWithTimeout(8000)`

---

## [5.x.x] — Legacy Single-File Era (archived)

> `BestDashBoard.html` — 1084 mocha tests / 61 suites. Preserved as `BestDashBoard.html copy.bak`.
> Not actively maintained. All development continues in `src/` (v6+).
