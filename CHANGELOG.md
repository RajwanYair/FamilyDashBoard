# Changelog

All notable changes to FamilyDashBoard are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

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
