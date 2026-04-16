# Changelog

All notable changes to FamilyDashBoard are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

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
