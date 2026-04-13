# Changelog

All notable changes to FamilyDashBoard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [6.0.0-alpha.2] — 2026-04-13

> **v6 Phase 3 — Card Modules: News, Stocks, Currency, Alerts + Main Wiring** (GH #66)
> Tests: 596 Vitest / 5 suites / 0 failures · TypeScript: 0 errors · Vite build: 37.5 KB gzip total
> Build: main-DOgTGrtu.js 2.37 KB gzip · cards-Dl5RiaYm.js 10.31 KB gzip · CSS 12.65 KB gzip

### Added

- **`src/cards/news/news.ts`**: RSS aggregator — 17 Hebrew feeds (`NEWS_FEEDS` array), concurrent fetch via `runConcurrent`, XML parsing with `DOMParser`, title-prefix dedup, sort newest-first, top 50 items. Seamless clone-scroll DOM rendering. Hebrew regex category detection → `security` | `politics` | `economy` | `sport` | `tech`. `initNewsCard()` export.
- **`src/cards/stocks/stocks.ts`**: Yahoo Finance v8 chart API via `fetchJSON` proxy chain. BTC-USD via CoinGecko direct (CORS-enabled — Yahoo crypto fails through proxies). 2-phase load: cached-first then parallel fetch of uncached symbols (≤4 concurrent). Bezier SVG mini-charts (80×28px). 3-state trend coloring (positive/negative/neutral). 52-week range bar. Gainers/losers summary bar. `initStocksCard()` export.
- **`src/cards/currency/currency.ts`**: `open.er-api.com` (ILS base) with `exchangerate-api.com` fallback. Renders 5 tiles: USD, EUR, GBP, Gold (XAU), Silver (XAG). Change indicators vs. previous fetch (per-tile thresholds). `data-fresh` animation flash on update. `initCurrencyCard()` export.
- **`src/cards/alerts/alerts.ts`**: Tzeva Adom API (`api.tzevaadom.co.il/alerts-history`) with direct → proxy chain fallback. Adaptive polling: 60s active / 5min idle / 10s realtime mode. `AudioContext` beep + browser `Notification` on new alert. Clone-scroll DOM rendering with `@keyframes alertsScroll`. `setAlertsEnabled()` / `setAlertsRealtime()` controls. `initAlertsCard()` export.
- **`src/types/api.ts`**: Added `AlertZone` interface (cities, threat, time) and corrected `AlertEvent` (alerts: `AlertZone[]`, not `string[]`). Matches actual Tzeva Adom API shape.
- **`src/cards/base-card.ts`**: `createCardLoader<T>` generic wrapper for standard card lifecycle (visibility → lock → cache → fetch → render → sync indicators).
- **`src/cards/weather/weather.ts`** + **`src/cards/motivation/motivation.ts`**: Cards now using `createCardLoader` / `scheduleCard` pattern from base-card.

### Changed

- **`src/main.ts`**: Entry point fully wired — imports all 6 card inits + 4 UI module inits + SW registration. Version bumped to `6.0.0-alpha.2`. All TODO stubs replaced with actual calls.
- **`.github/workflows/deploy.yml`**: Changed from serving root directory (`path: "."`) to Vite build + `path: "dist"`. Now runs `npm ci && npx vite build` then deploys `dist/` to GitHub Pages.
- **`vite.config.ts`**: `manualChunks.cards` updated to include all 6 card modules (was 2). Cards chunk is ~10 KB gzip.
- **`package.json`**: Version updated to `6.0.0-alpha.2`.

---

## [5.2.0-rc.1] — 2026-04-13

> **Refactoring Sprint R6 — Calendar, Alerts, Motivation + R7 verification + R8 partial**
> Tests: 1095 / 62 suites / 0 failures (was 1084 / 61; delta: +11 R6 refactoring coverage tests)

### Changed

- **R6.1 — ICS parser helpers**: Extracted `_parseICSDate()` and `_unescapeICS()` as standalone shared helpers for calendar ICS processing
- **R6.2 — Calendar loader**: Refactored `loadCalendar()` with `sources[]` direct → proxy fallback loop pattern (consistent with R5.8 CUR_APIS pattern); extracted `CAL_TTL` constant
- **R6.3 — Calendar renderer**: Extracted `_renderCalEvent()` and `_renderCalCountdown()` as standalone rendering helpers
- **R6.4 — Calendar iframe**: Extracted `_acceptICS()` validation helper for ICS content checks
- **R6.5 — Red Alerts loader**: Extracted `ALERT_URL` constant; unified direct → proxy fallback with `sources[]` loop; extracted `_notifyNewAlert()` helper (beep + desktop notification)
- **R6.6 — Alerts renderer**: Extracted `_buildAlertItem()` to module scope (was nested `buildAlertItems()` closure); replaced double function calls with `for (const isClone of [false, true])` loop
- **R6.7 — Alert toggle**: Cached `_alertsToggleSel` to eliminate duplicate `getElementById` calls; consolidated `initAlerts()` and `applyAlerts()`
- **R6.8 — Motivation**: Extracted `_setMotiContent()` (eliminated 3× text assignment duplication) and `_shareMoti()` helper for share/clipboard logic
- **R6.9 — Card maximize**: Split 64-line `toggleCardMaximize()` into `_expandCard()` + `_collapseCard()` — dispatcher is now 2 lines
- **R7 — PWA, Performance, Polish**: All 12 items (R7.1–R7.12) verified already implemented — SW v5.0.0, update flow, manifest, GPU layers, CSS contain, scroll fade masks, card entrance animations, night dimmer, background images, font scale, birthday chip, custom countdown
- **R8.8 — ESLint config**: Expanded `varsIgnorePattern` to cover refactored function prefixes (`apply`, `schedule`, `card`, `save`, `trigger`, `show`, `hide`, `reset`, `filter`, `play`, `inject`, `set[A-Z]`, `cycle`, `random`)

### Added

- **11 refactoring coverage tests**: New "Refactoring R6" test suite verifying all extracted functions (`ALERT_URL`, `_notifyNewAlert`, sources array, `_buildAlertItem`, isClone loop, `_alertsToggleSel`, `_setMotiContent`, `_shareMoti`, `_expandCard`, `_collapseCard`, `toggleCardMaximize` delegation)

### Fixed

- **Test syntax errors**: Fixed 2 pre-existing `};)` → `});` typos in test file (lines 1119, 4893)

---

## [5.1.0] — 2026-04-12

> **Refactoring Sprints R1–R5 (partial)** — CSS Design System, HTML Structure, Core JS Infrastructure, Hebrew Calendar verification + dead code removal, News/Stocks verification
> Tests: 1084 / 61 suites / 0 failures (was 1134 / 61 at v5.0.0; delta: dead code + dropped feature tests removed)

### Changed

- **Refactoring R1 — CSS Design System**: Introduced warm living-room palette as semantic CSS design tokens (`--warm-*`); standardized 5 themes; fluid typography scale; consolidated animation tokens; unified print styles
- **Refactoring R2 — HTML Structure**: Added ARIA landmarks (`role="banner"`, `role="main"`, `role="complementary"`) and `aria-label` to all 8 cards; added bilingual `title` attributes to all config inputs; updated version string v5.0.0 → v5.1.0
- **Refactoring R3 — Core JS Infrastructure**: Extracted magic numbers to named constants (`DIAG_BUFFER_SIZE = 80`, `DIAG_DISPLAY_LIMIT = 20`, `WAKE_REFRESH_MS = 30 * 60 * 1000`); extracted `cycleTheme()` standalone function from inline keydown handler; extracted `injectScrollKeyframes(styleId, keyframeName, distance)` shared helper — refactored news, stocks, and alerts scrolls to use it; removed duplicate `stockAlertsInput` block in `saveConfig()` (Sprint 14/15 merge artifact); removed unused `sync-moti` HTML + JS ref (motivation is static, never fetches)
- **Refactoring R4 — Hebrew Calendar**: Verified all 13 tasks (R4.1–R4.13) — `loadHebrewDate`, `loadHebCal`, `loadZmanim`, `updateShabbatCountdown`, `getMoonPhase`, `renderHourlyChart`, 7-day forecast, temp toggle, multi-city, weather codes, halacha ticker — all confirmed working
- **Refactoring R5 partial (R5.1–R5.4)**: Verified `loadNews` (17 RSS feeds, concurrent fetch, dedup), `renderNews` (25 items + clone, 4 age tiers, 4 action buttons), news features (search, bookmarks, visited, filter chips), `loadAllStocks` (3-phase cache strategy, `raceProxies`, BTC fallback) — all confirmed working

### Removed

- **Dead code — `loadShabbat()`**: Function targeted `id="shabbat-info"` which was removed from HTML in a prior sprint; `loadHebCal()` fully handles all Shabbat data. Removed function, all 5 call sites, `el.shabbat` ref, and `setInterval` entry (−18 lines)
- **Dead code — `loadHolidays()` + `renderHoliday()`**: Function targeted `id="holiday-info"` removed from HTML; `loadHebCal()` handles holiday countdown inline. Removed both functions and all 4 call sites (−26 lines)
- **Dropped features** (completed in R2): AQI card, Earthquake monitor, Transit card — all CSS/HTML/JS removed; 51 test blocks removed/updated

---

## [5.0.0] — 2026-04-12

> **Sprint 17 (Features 161–170)** — Corporate network proxy config, SW v5.0.0, icon.svg, manifest icons, PWA install prompt, offline fallback, VERSION_ACTIVATED broadcast, periodic SW update, release assets expansion
> Tests: 1135 / 61 suites / 0 failures (was 1112 / 60 suites / 0)

### Added

- **F161 — Custom CORS proxy for corporate/restricted networks** — `#cfg-custom-proxy` URL input in Advanced config tab; `saveConfig()` persists URL as `dash_custom_proxy`; `fetchJSON()` prepends it first in the proxy chain so corporate firewalls don’t block API calls
- **F162 — ServiceWorker v5.0.0 bump + expanded API cache origins** — `CACHE_NAME` and `CACHE_NAME_API` bumped to `familydashboard-v5.0.0`; `API_CACHE_ORIGINS` expanded to include CORS proxy hosts (`allorigins.win`, `codetabs.com`, `corsproxy.io`), Yahoo Finance, CoinGecko, tzevaadom, and Sefaria for full offline coverage
- **F163 — SVG app icon** — `icon.svg`: minimal 512×512 dashboard icon with 4-panel grid design (calendar, weather, stocks, news); included in APP_SHELL for offline pre-cache
- **F164 — manifest.json icons + display_override** — icons array populated with `icon.svg` (`purpose: any`, `purpose: maskable`); `display_override: [\"window-controls-overlay\", \"standalone\"]` added for enhanced PWA titlebar
- **F165 — PWA install prompt** — `#btn-install` button in status bar (hidden by default); `beforeinstallprompt` handler stores `_deferredInstall`; `triggerInstall()` calls `.prompt()` and cleans up on user choice; button auto-shows when browser signals installability
- **F166 — SW offline fallback page** — `OFFLINE_HTML` constant in `sw.js` returns a minimal Hebrew RTL offline message for navigation requests when both network and cache miss; prevents browser default “Cannot connect” error page
- **F167 — SW VERSION_ACTIVATED message** — On `activate`, SW posts `{type: \"VERSION_ACTIVATED\", version: CACHE_NAME}` to all clients; HTML logs activation to `diagLog` for debugging SW update cycles
- **F168 — Periodic SW update check on tab focus** — `document.visibilitychange` handler calls `reg.update()` whenever the dashboard tab becomes active, ensuring stale SWs are detected promptly without a page reload
- **F169 — Release workflow attaches all PWA assets** — `release.yml` now attaches `sw.js`, `manifest.json`, and `icon.svg` alongside `BestDashBoard.html` to every GitHub Release so users downloading a release get a fully working offline-capable PWA

---

## [4.19.0] — 2026-05-12

> **Sprint 16 (Features 151–160)** — Sefirat HaOmer row, precipitation forecast, Gold/Silver/GBP sparklines, calendar today-strip, stocks summary bar, bookmark filter, halacha overlay, weather min/max, card collapse, news font slider
> Tests: 1112 / 60 suites / 0 failures (was 1069 / 59 suites / 0)

### Added

- **F151 — Sefirat HaOmer row** — `#hc-omer-row` shows/hides inside the Hebrew Calendar card based on omer availability; `_renderOmer()` now exposes `el.hcOmerRow` to show the row only during the omer counting period (Pesach → Shavuot)
- **F152 — Daily precipitation amount in forecast** — `precipitation_sum` added to Open-Meteo daily request; each forecast day shows a 💧 N.N מ"מ badge (`.wx-fday-mm`) when precipitation ≥ 0.2 mm
- **F153 — Gold/Silver/GBP currency sparklines** — `recordCurrencyHistory()` expanded to store 5 rates (USD/EUR/Gold/Silver/GBP); `#cur-gold-spark`, `#cur-silver-spark`, `#cur-gbp-spark` SVG elements added to the three additional currency rows; `renderCurrencySparklines()` draws all 5 sparklines
- **F154 — Calendar today-strip** — `#cal-today-strip` shows the next upcoming (non-all-day) events for today as time-labelled pills; updated each time the calendar renders via `_renderCalTodayStrip(events)`
- **F155 — Stocks gainers/losers summary bar** — `#stk-summary` line shows `📈 N עולות • 📉 N יורדות • ➡️ N יציבות` by counting `.stk-up` / `.stk-down` DOM classes after each `loadStocks()` call; `updateStockSummary()` function
- **F156 — Bookmark-only news filter (B key)** — `B` key toggles `body.news-bkm-mode` which hides all non-bookmarked `.rss-item` via CSS; `#news-bkm-pill` shows "🔖 מועדפים" indicator when active; `toggleNewsBookmarkFilter()` function
- **F157 — Halacha full-text overlay** — Clicking the `.ticker-bar` opens a modal overlay (`#halacha-overlay`) showing the full Sefaria halacha text with reference; `_showHalachaOverlay()` / `_closeHalachaOverlay()`; Escape key closes it; `_halachaData` stored in `renderHalacha()` for later display
- **F158 — Weather today min/max range** — `#wx-minmax` shown between the temperature and description with today's forecast low / high `(e.g. 18° / 32°)` from `d.daily.temperature_2m_min/max[0]`
- **F159 — Card collapse toggle** — Every card header has a `▼` `.card-collapse-btn` button; clicking toggles `.card.collapsed` (hides the card body via CSS, rotates the arrow); collapse state persisted per-card via `dash_collapsed_{id}` localStorage keys; `setupCardCollapse()` called on init
- **F160 — Config Display tab: news font size slider** — `#cfg-news-fontsize` range slider (70–130%, step 5) in the Display tab controls `--news-font-scale` CSS variable applied to `.rss-item .rss-title`; value persisted as `dash_news_fontsize`; `applyNewsFontScale()` restores the scale on startup

---

## [4.18.0] — 2026-05-11

> **Sprint 15 (Features 141–150)** — Bug fixes, dew point tile, wind gusts label, news category badges, news inline expand, daily quote lock + manual next, news bookmarks, weekly weather summary, per-stock portfolio P&L row, help overlay upgrade
> Tests: 1069 / 59 suites / 0 failures (was 1045 / 58 suites / 0)

### Added

- **F142 — Dew point in weather detail** — 7th `.wx-detail` tile (`#wx-dew`) shows current dew point in the same °C/°F setting; `dew_point_2m` added to Open-Meteo hourly request; highlighted with cyan bottom border CSS
- **F143 — Wind gusts label** — `#wx-gust` sub-span inside wind tile shown only when gust > wind × 1.4 AND > 25 km/h; `wind_gusts_10m` added to Open-Meteo hourly request; colored amber with warning icon
- **F144 — News category keyword badges** — `detectNewsCategory(title)` classifies Hebrew headlines into 5 categories (security/politics/economy/sport/tech) via regex; badge `.news-cat.cat-{type}` appended inline after each title with category-specific color
- **F145 — News inline description expand** — Each `.rss-item` now contains a `.news-desc` div with up to 220-char snippet; click on the title toggles `.expanded` class showing/hiding the description in place
- **F146 — Daily quote lock + manual next** — `motiIdx` now initializes to `dayOfYear % length` so the same quote shows all day; `#moti-next-btn` button wired to call `loadMotivation()` to advance manually
- **F147 — News bookmarks** — `🔖` button per article stores/removes URL in `dash_news_bookmarks` (max 15); `_getNewsBookmarks()` / `_toggleNewsBookmark(url)` helpers; bookmarked articles float to top of the news list with highlight background
- **F148 — Weekly weather summary** — `#wx-week-summary` text div below the 7-day forecast computes average high temperature and rain probability over the coming week, outputting one of: ☀️ שבוע חם ויבש / 🌧 שבוע גשום / 🌦 שבוע עם גשמים חלקיים
- **F149 — Per-stock portfolio P&L row** — `renderStock()` appends `.stk-pos-pnl` to `.stk-vals` for each stock with a configured position (qty + cost); shows `פוז׳: +$N (±X%)` in green/red; removes the element when no position is configured
- **F150 — Help overlay upgrade** — `#help-panel` rebuilt as 2-column `.help-grid` with 18 shortcut rows; `H` key added as alternate trigger alongside `?`; footer shows "לחץ Escape / ? / H לסגירה"

### Fixed

- **F141 — Duplicate setInterval for `updateMarketBadge`** — Removed the 5-minute duplicate `setInterval(updateMarketBadge, 300000)` that was firing alongside the correct 1-minute interval
- **F141 — Duplicate keydown handlers for N and R keys** — Removed redundant event handler block for `n`/`r` keys that was registered twice in `document.addEventListener('keydown')`
- **F141 — Duplicate `updateWeatherSkyPill` call in `renderWeather()`** — Second call removed

---

## [4.17.0] — 2026-05-04

> **Sprint 14 (Features 131–140)** — Stock alert toasts, portfolio P&L header chip, calendar ICS source coloring, severe weather toast, motivation share button, news age tinting, after-hours prices, calendar conflict indicator, custom countdown chip, print mode improvements
> Tests: 1048 / 58 suites / 0 failures (was 1014 / 57 suites / 0)

### Added

- **F131 — Stock alert toast + desktop Notification** — `checkStockAlerts()` now deduplicates via `_firedStockAlerts` Set (session-scoped); fires `showToast()` and `new Notification()` with Hebrew RTL body on first crossing of above/below thresholds; clears fired key when price returns inside safe zone
- **F132 — Portfolio P&L header chip** — `<span id="header-portfolio-pl">` in header-right shows current portfolio total P&L percentage; `.pl-gain` (green) / `.pl-loss` (red) CSS classes; `updatePortfolioTotal()` now writes to chip after each stock refresh
- **F133 — Calendar ICS source color border** — `parseICS(text, icsIdx=0)` stores source index on each event; `loadCalendarExtra()` passes icsIdx 2/3; `renderCalendar()` sets `row.dataset.ics` for CSS to apply `border-right: 3px solid` in blue/green/orange per source
- **F134 — Severe weather toast on state change** — `checkSevereWeather()` tracks `_lastSevereMsg`; fires `showToast()` and desktop `Notification` only on first occurrence of a new severe weather code, not every refresh; clears state when conditions improve
- **F135 — Motivation share button** — `<button id="moti-share-btn">📤 שתף</button>` added to motivation card; `loadMotivation()` wires `onclick` after each rotation; uses `navigator.share()` on supported devices, falls back to `navigator.clipboard.writeText()` with a copy toast
- **F136 — News article age tinting** — `renderNews()` assigns `.stale-half` (>6h, opacity 0.80), `.stale-day` (>12h, opacity 0.60), `.stale-old` (>24h, opacity 0.35) CSS classes to original items (not clones) based on `pubDate` age
- **F137 — After-hours / pre-market secondary price line** — `renderStock()` appends a `<div class="stk-after-price">` to `.stk-vals` showing `postMarketPrice` or `preMarketPrice` with labeled change percentage when market is not in REGULAR state; colored green/red by direction
- **F138 — Calendar conflict indicator** — `renderCalendar()` builds a `conflictIdx` Set of overlapping timed events before the render loop; conflicting events receive `.cal-event.has-conflict` class which adds `⚠` before the title via CSS `::before` pseudo-element
- **F139 — Custom countdown chip in header** — `<span id="header-countdown">` (purple pill) shows days remaining to a user-configured event; `updateCountdownChip(now)` called every minute from `tickClock()`; configured via new "⏳ ספירה לאחור" fields in the Advanced config tab (`dash_countdown_date` + `dash_countdown_label`)
- **F140 — Print mode improvements** — `@media print` now hides `.clone`, `#toast`, `#night-dim`, `#print-datetime`, and `#config-overlay`; `<div id="print-datetime">` shows print timestamp; `initPrintDate()` wires the `beforeprint` event; called from `init()`

### Fixed

- **Corrupted duplicate block in `init()`** — A garbled duplicate of the event-listener and loader setup inside init was removed; `initPrintDate()` and `updateCountdownChip()` are now correctly called at the end of init

## [4.16.0] — 2026-04-27

> **Sprint 13 (Features 121–130)** — Toast system, UV pill, rain-% labels, calendar reminders, news translate, earthquake & halacha deeplinks, chart view toggle, search highlight, diag log toast feedback
> Tests: 1014 / 57 suites / 0 failures (was 985 / 56 suites / 0)

### Added

- **F121 — Toast notification system** — Global `showToast(msg, dur=3000)` function + `<div id="toast">` element; CSS animated `opacity`/`transform` slide-up; called by `copyDiagLog` and other actions; eliminates use of `alert()` for non-blocking feedback
- **F122 — UV index colored pill** — `renderWeather()` wraps UV value in `<span class="uv-pill uv-{level}">` with level label (נמוך / בינוני / גבוה / גבוה מאוד / קיצוני); five CSS color classes from green to purple; plain number replaced
- **F123 — Rain % labels on hourly chart** — `renderHourlyChart()` now renders `<text class="wx-hourly-rain-pct">N%</text>` above rain bars when precipitation probability ≥ 30%; also in precipitation-only view bars ≥ 20%
- **F124 — Calendar event reminder notifications** — `checkCalendarReminders()` reads cached ICS events; fires `new Notification()` for events starting within 0–16 minutes; deduplicates via `localStorage` (`dash_cal_reminded`); runs on `setInterval` every 60 s
- **F125 — News article Google Translate button** — Each news item gets a `<button class="rss-translate-btn">🌐</button>`; opens `translate.google.com/translate?sl=iw&tl=en&u=…` in a new tab; `encodeURIComponent` used on the article URL; `noopener,noreferrer` set
- **F126 — Earthquake USGS deeplink** — `loadEarthquakes()` stores `url: feat.properties?.url` in the cached info object; `_renderEarthquake()` sets `row.onclick` to open the USGS event detail page in a new tab; `#quake-row { cursor: pointer }` CSS added
- **F127 — Halacha Sefaria deeplink** — `loadHalacha()` stores `url: 'https://www.sefaria.org/' + item.url`; `renderHalacha()` sets `el.hcHalachaRow.onclick` to open Sefaria; `#hc-halacha-row { cursor: pointer }` CSS added
- **F128 — Hourly chart view toggle** — `<button id="wx-chart-toggle">🌡️ טמפ׳</button>` in weather card; `toggleHourlyChartView()` flips `_wxChartView` between `'temp'` and `'rain'`; `renderHourlyChart()` caches `_wxChartLastData` for re-render; rain view renders a full bar chart of precipitation probability with color-coded bars
- **F129 — News search keyword highlight** — `applyNewsSearch()` wraps matched text in `<mark class="rss-highlight">` using `dataset.originalText` pattern; regex special chars escaped; restored to plain `textContent` when search is cleared
- **F130 — Diag log copy toast feedback** — `copyDiagLog()` calls `showToast('📋 לוג אבחון הועתק!')` on successful clipboard write; also unified the diag copy button text encoding to readable string literals

### Fixed

- **Duplicate `refSpan.appendChild(cat)` in `renderHalacha`** — Leftover duplicate line + stray closing brace that caused a JS syntax error within `makeSet()`, preventing `scriptContent` from being fully parsed in tests

### Changed

- **CSS** — Added Sprint 13 rules: `#toast` / `.toast-show`, `.uv-pill.*` (5 levels), `.wx-hourly-rain-pct`, `.rss-translate-btn` + hover, `#quake-row` cursor + hover, `#hc-halacha-row` cursor + hover, `#wx-chart-toggle`, `.rss-highlight`

---

## [4.15.0] — 2026-05-02

> **Sprint 12 (Features 111–120)** — SW full offline shell + API cache, network-recovery pane refresh, desktop notification bell + red-alert pop-up, unread alerts badge, configurable weather cities, family member rotation in greeting, config panel section tabs, dashboard URL share
> Tests: 962 / 56 suites / 0 failures (was 942 / 55 suites / 0)

### Added

- **F111 — SW pre-cache `sw.js` itself** — `./sw.js` added to `APP_SHELL` array so the full offline shell is reliably cached on first install
- **F112 — SW offline API fallback** — New `CACHE_NAME_API = "familydashboard-api-v4.15.0"` cache; `API_CACHE_ORIGINS` list covers open-meteo, hebcal, er-api, exchangerate-api; fetch handler uses network-first strategy with SW-cache fallback when network fails; old API cache cleared on activate
- **F113 — Network recovery pane refresh** — SW tracks `_networkWasDown` flag; posts `{type:'NETWORK_BACK'}` to all clients when first successful fetch follows a failure; page `serviceWorker.message` listener re-loads Weather, HebCal, Alerts, Stocks
- **F114 — Notification permission bell chip** — `#notif-bell` amber pulsing chip in `header-right`; `initNotifBell()` shows it when `Notification.permission === 'default'`; `requestNotifPermission()` requests browser permission on click and hides the bell if granted
- **F115 — Red Alert desktop notification** — `new Notification('⚠️ צבע אדום', {body:cities, dir:'rtl', lang:'he'})` fires in `loadAlerts()` when a new alert arrives and browser permission is `granted`
- **F116 — Unread alerts badge** — `<span class="alerts-badge" id="alerts-badge-count">` in alerts card header; `_unreadAlerts` counter incremented in `renderAlerts()` on `highlightNew`; badge hidden by `resetAlertsBadge()` when alerts card is maximized/opened
- **F117 — Configurable weather city tabs** — Three `cfg-city-N` inputs (format `שם|lat|lon`) in Feeds config tab; `initWeatherCities()` reads `dash_city_1/2/3` from localStorage and updates `.wx-city-tab[data-city]` button text + data-lat/lon on startup and panel save
- **F118 — Family members list + greeting rotation** — `cfg-members` comma-separated input saved to `dash_members`; `getMembers()` function; `getGreeting()` rotates through members by day-of-month for personalised morning/evening greetings
- **F119 — Config panel section tabs** — Five tabs: `תצוגה` (Display), `לוח` (Calendar), `עדכונים` (Feeds), `התראות` (Notifications), `מתקדם` (Advanced); `switchCfgTab(tabName)` toggles `.cfg-tab.active` and `.cfg-section.active`; last tab persisted to `dash_cfg_tab`; save/close buttons always visible below tabs
- **F120 — Dashboard URL share** — `shareSettings()` encodes theme, screen-mode, geonameid, alert-zone as URL hash params; `navigator.clipboard.writeText()` + toast; `loadFromHash()` reads hash on startup, applies settings, then strips hash from URL; `🔗 שתף קישור` button in Advanced config tab

### Changed

- **CSS** — Added Sprint 12 rules: `#notif-bell` (amber pulsing chip), `.alerts-badge` (red count badge), `.cfg-tabs/.cfg-tab/.cfg-section` (config panel tab system), `#cfg-share-btn` styling
- **Config panel restructured** — All existing rows redistributed into 5 tabbed sections; export/import/share buttons moved into Advanced tab; save/close always visible below tabs

---

## [4.14.0] — 2026-04-27

> **Sprint 11 (Features 101–110)** — SW update banner, multi-ICS calendar, news search, birthday header chip, reconnect auto-refresh, halacha category colors, settings export/import, Hebrew wind direction, next Zman header, visited news tracking
> Tests: 942 / 55 suites / 0 failures (was 877 / 54 suites / 0)

### Added

- **F101 — SW Update Notification Banner** — `#sw-update-banner` (fixed, green) slides in when a new SW is waiting; `swUpdateReload()` posts `SKIP_WAITING` message; SW `message` handler calls `self.skipWaiting()` on demand instead of auto-activating
- **F102 — Second + Third ICS Calendar URLs** — `cfg-ics-url-2` and `cfg-ics-url-3` inputs in config panel; `getICSUrls()` collects all three `dash_ics_url*` keys; `loadCalendarExtra()` merges secondary ICS events with primary calendar
- **F103 — News Keyword Search Filter** — `#news-search` (RTL input with placeholder), `#news-search-clear` ✕ button, `#news-search-count` results badge; `applyNewsSearch()` toggles `search-hidden` on non-matching items; 250ms debounce; Escape clears; pauses scroll animation during search
- **F104 — Birthday Header Chip** — `#header-birthday-chip` amber pill in header-right; `checkBirthdays()` extended to show nearest birthday within 14 days with day countdown
- **F105 — Network Reconnect Auto-Refresh** — `_wasOffline` flag: when banner goes from offline→online, triggers `safeLoad()` for all five main panes after a 1.5s delay
- **F106 — Halacha Category Color Tags** — CSS classes `.hc-tag-shabbat` (gold), `.hc-tag-tefila` (teal), `.hc-tag-kashrut` (green), `.hc-tag-family` (rose), `.hc-tag-moadim` (purple); `renderHalacha()` maps Sefaria category to class via regex
- **F107 — Settings Export/Import** — `exportSettings()` collects all `dash_*` localStorage keys → JSON Blob download; `importSettings()` reads uploaded `.json`, restores keys, reloads; `#cfg-import-file` input + two buttons in config panel
- **F108 — Hebrew Wind Direction Label** — `#wx-wind-heb` span inside wind detail; `deg2hebrewDir(deg)` maps bearing to 8 Hebrew compass points (צפון/מזרח/דרום/מערב + intermediates); `renderWeather()` sets the label
- **F109 — Next Zman Header Indicator** — `#header-next-zman` accent-color pill in header-right; `_zmanimParsed[]` built by `_renderZmanim()`; `updateNextZman()` finds the next upcoming Zman; `tickClock()` updates it every minute
- **F110 — News Visited Articles Dimming** — `_getVisitedArticles()` / `_addVisitedArticle()` persist URLs in `dash_news_visited` (max 200); `renderNews()` marks items `.visited` on click and on re-render; `.rss-item.visited` dims to 45% opacity with strikethrough title

---

## [4.13.0] — 2026-04-12

> **Sprint 10 (Features 91–100)** — PWA offline, configurability (city, Hebcal, feeds, stocks, chores), transit card, drag-reorder
> Tests: 877 / 54 suites / 0 failures (was 831 / 53 suites / 0)

### Added

- **F91 — PWA `manifest.json`** — Replaced inline data-URI manifest with proper `manifest.json` file (name, short_name, display: standalone, theme_color, shortcuts)
- **F92 — ServiceWorker `sw.js`** — Stale-while-revalidate caching for HTML + manifest; registered in BestDashBoard.html; auto-updates on version change
- **F93 — Home city config** — `cfg-home-lat`/`cfg-home-lon`/`cfg-home-name` in config panel; `injectHomeCity()` adds dynamic “ביתי” weather city tab; saves to `dash_home_lat/lon/name`
- **F94 — Hebcal geonameid config** — `cfg-heb-geonameid` in config; `getGeonameid()` function; all 5 Hebcal/Zmanim API calls now use configurable city (default: 281184 = Jerusalem)
- **F95 — News feed per-source disable** — `cfg-feeds-disabled` comma-separated input; `getActiveFeeds()` filters `NEWS_FEEDS`; saves to `dash_feed_disabled`
- **F96 — Stock symbols hide config** — `cfg-stocks-hidden` input; `applyHiddenStocks()` hides `.stk` elements; `loadAllStocks()` skips hidden symbols
- **F97 — Real-time alerts (10s polling)** — `ALERT_INTERVAL_RT = 10000`; `_alertRealtime` flag saved to `dash_alert_rt`; `cfg-alert-realtime` toggle in config
- **F98 — Transit departures card** — New right-column card using Hasadna open-bus-stride API; `cfg-transit-stop` GID config; `loadTransit()` + `applyTransitState()`; 3min refresh
- **F99 — Card drag-reorder** — HTML5 drag API within each column; `data-card-id` on all 9 cards; `initCardDrag()`; order saved to `dash_card_order_{col}`; flex sizes reapplied after drag
- **F100 — Configurable chore wheel** — `cfg-chores` JSON textarea in config; `getChores()` reads `dash_chores` with fallback to `CHORES`; `updateChoreWheel()` uses `getChores()`

---

## [4.12.0] — 2026-04-12

> **Sprint 9 (Features 81–90)** — configurability, visual polish, family personalization
> Tests: 831 / 53 suites / 0 failures (was 791 / 52 suites / 0)

### Added

- **F81 — 7-day weather forecast** — extended from 4 to 7 days; `forecast_days=8` Open-Meteo; 7-column CSS grid on TV, 4 columns on phone/tablet
- **F82 — Halacha category badge** — `halachaItem.category` parsed and shown as `.ticker-halacha-cat` badge in ticker ref span
- **F83 — ICS calendar URL in config** — `#cfg-ics-url` input; saves to `dash_ics_url`; `loadCalendar()` uses `localStorage.getItem('dash_ics_url') || CAL_ICS` — families can paste their own Google Calendar ICS
- **F84 — Family name config** — `#cfg-family-name` input; `getGreeting()` reads `dash_family_name`; morning/evening greetings personalised ("בוקר טוב למשפחת X!")
- **F85 — Multi-photo background slideshow** — comma-separated URLs in bg-url field start 30s crossfade rotation; `startPhotoSlideshow()` / `stopPhotoSlideshow()` + CSS `slideshow-fade` animation
- **F86 — Alert zone filter** — `#cfg-alert-zone` config input; `filterAlertsByZone()` filters red alert cities to match comma-separated zone prefixes; `dash_alert_zone` localStorage
- **F87 — News headline description tooltip** — RSS `<description>` parsed (HTML stripped, capped 140 chars) and set as native `title` attr on `.rss-title` span
- **F88 — Night auto-dim schedule config** — `#cfg-dim-start` / `#cfg-dim-end` number inputs (0–23); `updateNightDimmer()` reads `dash_dim_start` / `dash_dim_end` with midnight wrap-around support (default 23–06)
- **F89 — Clock seconds toggle** — click `#clock` → `toggleClockSec()` shows HH:MM:SS with 1s interval; preference persisted to `dash_clockSec`; `.with-seconds` CSS class; `applyClockSec()` called on init
- **F90 — Offline banner with cache age** — `_recordOnlineTime()` stamps `dash_last_online` on every online event; `_getOfflineCacheAgeStr()` formats elapsed time; banner shows "מ-HH:MM (לפני Xד/ש)" inline

### Fixed

- `toggleConfig()` had duplicate `const stockAlertsInput` declaration — fixed (was a no-op in strict mode, swallowed silently)
- `getGreeting()` evening message used generic "למשפחה" — now uses configured family name

---

## [4.11.0] — 2025-07-12

> **Sprint 8 (Features 71–80)** — 80-feature milestone: GBP pair, heat-map calendar, favicons, sector headers, AQI sparkline, Shabbat pill, Parasha progress, chart tooltips, PWA metas
> Tests: 791 / 52 suites / 0 failures (was 746 / 51 suites / 0)
> SVG assets: all 5 updated with v4.10.0 accurate data (17 feeds, 15 stocks, 12+ APIs)

### Added

#### Currency

- **F71 — GBP / ILS tile** — 5th currency tile `#cur-gbp` / `#cur-gbp-chg`; fetched from ER-API alongside USD/EUR; inverted display (1 GBP = X ₪); el cache `curGbp` / `curGbpChg`

#### Calendar

- **F72 — Week strip heat-map** — `renderCalWeekStrip()` now applies `.heat-1/.heat-2/.heat-3` CSS classes to day cells based on event count (1 / 2–3 / 4+); blue opacity gradient; today highlight unchanged

#### News

- **F73 — Source favicon in filter chips** — `NEWS_SRC_DOMAIN` map (17 entries) provides domain per news source name; `addNewsFilterChip()` prepends `<img class="news-chip-favicon">` using Google S2 favicon API

#### Stocks

- **F74 — Sector grouping headers** — Static `<div class="stk-sector-hdr">` injected before מדדים (indices) and מניות (company stocks) groups in `#stocks-body` scroll list; CSS letter-spacing uppercase label

#### Weather / AQI

- **F75 — AQI 8-reading sparkline** — `recordAqiHistory(val)` persists last 8 AQI readings in `localStorage:dash_aqi_hist`; `renderAqiSparkline()` draws 44×14 SVG polyline (green/yellow/red); called from `_renderAQI()`
- **F79 — Weather chart hover tooltips** — Each visible data circle in `renderHourlyChart()` now includes an SVG `<title>` element showing temp°, hour, and rain% (when ≥10%); native browser tooltip on hover / touch

#### Hebrew Calendar

- **F77 — Shabbat time pill in header** — `#header-shabbat-pill` in `header-right` shows 🕯️ countdown (≤36h before candles) or ✨ remaining time (during Shabbat); `updateShabbatHeaderPill()` runs every 60s; uses `_candleDate` + `_shabbatEnd`
- **F78 — Parasha weekly progress bar** — `renderParashaProgress()` calculates `(dayOfWeek+1)/7` percent and fills `.hc-parasha-progress-fill`; shown below `#hc-parasha-row` when parasha is visible

#### PWA

- **F80 — PWA meta tags + install button** — Added `theme-color`, `mobile-web-app-capable`, `apple-mobile-web-app-*` meta tags; `#pwa-install-btn` fixed button appears when `beforeinstallprompt` fires; `pwaInstall()` calls `e.prompt()`

### Fixed

- Updated all 5 SVG documentation assets in `.github/assets/` with accurate v4.10.0 data (17 feeds, 15 stocks, 12+ APIs, correct intervals; added Sefaria + OWM AQI + USGS + CoinGecko to architecture diagram)

---

## [4.10.0] — 2026-04-12

> **Sprint 6–7 (Features 51–70)** — 70-feature milestone: polish, tools, and visual enhancements
> Tests: 746 / 51 suites / 0 failures (was 694 / 50 suites / 0)

### Added

#### Stocks & Portfolio

- **F51 — Portfolio total row** — `#stk-total-row` shows live portfolio value (sum across all held symbols) with P&L % δ; updates on every stock render via `updatePortfolioTotal()`
- **F55 — Stock price-alert system** — configure JSON threshold map in config panel (`cfg-stock-alerts`); `checkStockAlerts(sym, price)` fires `Notification` API with vibration on breach
- **F60 — TA-35 index tile** — added `^TA35.TA` to `STOCK_SYMBOLS` + `STOCK_NAMES` + `STOCK_BRAND`; shows תּ"א 35 with TASE favicon; Yahoo Finance `^TA35.TA` ticker
- **F61 — Relative-volume badge** — `getRelVolBadge(regularVol, avgVol)` returns yellow "VOL +56%" at ≥1.5× avg or orange "VOL ×3.2" at ≥2.5×; injected per-stock tile
- **F65 — Per-stock price-history sparkline** — `recordStkPrice(sym, price)` persists last 8 closes in `localStorage:dash_sph_{sym}`; `drawStkSpark(blk, sym)` renders 44×12px SVG polyline (green/red trend)

#### Weather & AQI

- **F53 — Daf Yomi Sefaria link** — Sefaria.org deeplink button next to Daf Yomi value in hc-card; opens tractate page; button wired once via `dataset.wired`
- **F56 — Precipitation bar** — 24-hour accumulation bar under the weather details row; height proportional to `precipitation_sum` from Open-Meteo daily forecast; visible when precipitation > 0
- **F64 — AQI category label + trend arrow** — `getAqiCategory(aqi)` returns Hebrew label (טוב/בינוני/מוגבר/גרוע/מסוכן); `#aqi-label` + `#aqi-trend` (↑/↓/→) updated each fetch via `_prevAqiVal`
- **F66 — Hourly rain probability overlay** — `renderHourlyChart(temps, startH, rainProbs)` renders blue `<rect>` bars at chart bottom (height ∝ precipitation_probability%); Open-Meteo URL extended with `precipitation_probability`

#### Calendar & Hebrew Life

- **F58 — Calendar event category color-dots** — `detectCalCategory(summary)` maps keywords (בר מצווה/חגיגה/חג/birthday/work → emoji + color class); colored dots appear on `#cal-week-strip` day cells
- **F63 — 7-day week activity strip** — `renderCalWeekStrip(events)` renders a compact 7-column strip (שאבגדהו) above the agenda with colored dot clusters (max 4 dots/day) and today highlight

#### News

- **F57 — Copy-to-clipboard button on news items** — 📋 clipboard button appears on hover; `navigator.clipboard.writeText(title + '\n' + link)` with 2s visual feedback
- **F62 — Web Share API share button** — 📤 share button on news items; `navigator.share({title, url})`; falls back to clipboard copy if Web Share not supported
- **F67 — News item published age** — `newsRelAge(pubDate)` returns "לפני Nד'" / "לפני Nש'" / "לפני Nי'"; `.news-age` shown next to source label

#### Earthquake

- **F52 — Earthquake magnitude color-coding** — `.quake-M3`, `.quake-M4`, `.quake-M5+` CSS classes with coloured badge; `_renderEarthquake` assigns class based on M value
- **F69 — 24-hour earthquake count badge** — `loadEarthquakes` now fetches `limit=20`; counts M3.5+ events in last 24h → `_quake24hCount`; `#quake-count-badge` shown if count > 1

#### UX & Developer Tools

- **F54 — Auto night dimmer** — `updateNightDimmer()` auto-dims to 40% brightness 22:00–07:00 IST + applies `.night-mode` body class; `toggleNightDim()` bound to `N` keyboard shortcut; intensity configurable in localStorage
- **F59 — Force-refresh button in diagnostic overlay** — `forceRefresh()` clears all `dash_v2_` cache keys + calls all loaders; wired to `#diag-force-refresh` button; `diagLog` reports each cleared key
- **F68 — NYSE market countdown chip** — `updateMarketCountdown()` uses America/New_York time; NYSE hours 9:30–16:00; shows hours/minutes to open or close; `.mkt-open` (green) / `.mkt-soon` (yellow / <30min) states; updates every 60s
- **F70 — Diagnostic overlay copy-log button** — `copyDiagLog()` reads `#diag-panes` + `#diag-log` innerText and copies via `navigator.clipboard`; `#diag-copy-btn` button added to overlay header

### Changed

- `loadEarthquakes` fetch limit raised from `limit=1` → `limit=20` to support 24h count badge (F69)
- `renderHourlyChart` signature extended: `(temps, startH)` → `(temps, startH, rainProbs)` (backward compatible — rainProbs defaults to `[]`)
- Open-Meteo `hourly` params extended with `precipitation_probability`

### Developer

- Tests: +52 cases in Suite 51 "Sprint 7 Features"; total **746 tests / 51 suites / 0 failures**
- All new HTML elements added with `id` attributes and cached in `el` object
- New localStorage keys: `dash_sph_{SYM}` (price history), `dash_stock_alerts` (JSON thresholds)

---

## [4.9.0] — 2026-04-12

> **Sprints 1–5 (Features 1–50)** — major feature batch implementing all roadmap phases v4.9–v4.11
> Tests: 694 / 50 suites / 0 failures (was 362 / 44 suites / 0 at v4.8.2)

### Added

#### Jewish Life & Hebrew Calendar Card

- **F1 — Parasha HaShavua** — `loadParasha()` fetches Hebcal parasha name + Sefaria summary; displays in hc-card with Sefaria deeplink button; 24h cache
- **F2 — Zmanim (prayer times)** — `loadZmanim()` fetches Hebcal zmanim API; renders Alot/Netz/Sof Zman Shma/Mincha Ged./Plag HaMincha/Shkia in 3-column grid (`#zmanim-grid`); 1h TTL
- **F3 — Daf Yomi** — `loadDafYomi()` fetches today's daf from Sefaria `/api/calendars`; shows tractate + daf number; 24h TTL
- **F4 — Psalm of the Day (שיר של יום)** — `loadPsalm()` fetches relevant psalm from Sefaria; day-of-week mapping for each psalm; displays first verse in hc-card; 24h TTL
- **F5 — Moon phase indicator** — `updateMoonPhase()` computes current phase from lunar cycle math; renders SVG crescent + Hebrew phase name in hc-card header
- **F6 — Shabbat countdown pill** — `updateShabbatCountdown()` shows ⏱ time remaining to Shabbat (Friday after noon) or to Havdalah (Saturday night); updates every minute
- **F21 — Parasha Aliyot** — `_loadParashaAliyot()` fetches opening verse (first ref) from Sefaria `/api/texts/`; renders italic opening phrase in `#hc-aliyot` row
- **F30 — Halacha excerpt in hc-card** — first segment of daily Halacha also shown in Hebrew Calendar card (`#hc-halacha`) alongside the full ticker

#### Weather & AQI

- **F7 — AQI card** — `loadAQI()` fetches OpenWeatherMap Air Quality Index (free, no API key required for v1); renders PM2.5, PM10, O3 value + color badge + Hebrew health recommendation; 1h TTL; `_renderAQI()` function
- **F8 — School holiday indicator** — parses Hebcal `min=on&maj=on` response; shows "חופש [name]" banner in hc-card when within a known school holiday date range; uses existing `loadHebCal` data
- **F10 — Precipitation probability bar** — hourly `precipitation_probability` from Open-Meteo rendered as a thin colored bar under weather detail row; shows 24h max accumulation
- **F26 — Feels-like temperature** — apparent temperature (`apparent_temperature`) added to weather details grid as "מורגש" cell; sourced from Open-Meteo `hourly`
- **F31 — Wind direction rose** — `deg2arrow(deg)` converts `winddirection_10m` degrees to 8-point arrow (↑↗→↘↓↙←↖); shown alongside wind speed in weather details
- **F32 — Extreme weather alert banner** — `checkSevereWeather(code)` matches WMO code 82/95/96/99 → Hebrew storm description; `#wx-alert-banner` slides in with `visible` class
- **F42 — Sky condition colour pill** — `updateWeatherSkyPill(code)` maps WMO code ranges to CSS `--sky-*` gradient + Hebrew label (☀️ יום שמשי / ⛅ מעונן חלקית / 🌧 גשום etc.); shown in clock header area

#### Stocks & Currency

- **F9 — Gold & Silver prices** — `loadCurrency()` extended to fetch `GC=F` and `SI=F` via Yahoo Finance; renders `#cur-gold` + `#cur-silver` tiles in currency card; 1h cache
- **F35 — Portfolio P&L overlay** — `updatePortfolioPnL(sym, currentPrice)` reads `dash_portfolio` JSON from localStorage (cost+qty per symbol); appends `.stk-pnl` div with `+$X (+Y%)` or loss; shown per-stock row
- **F38 — Currency sparklines** — `recordCurrencyHistory(usd, eur)` stores daily USD+EUR rates in `dash_v2_cur_hist` (7-day ring); `renderCurrencySparklines()` draws bézier 60×22px SVG lines via `_drawSparkline()` in each currency tile
- **F41 — Market pre/after-hours badge** — `updateMarketBadge()` extended to 4 states: Pre-market (04:00–09:30), Open (09:30–16:00), After-hours (16:00–20:00), Closed; shown in stocks card header chip
- **F46 — 52-week range bar** — `updateStockRange(blk, cur, low52, high52)` renders a coloured pill bar showing current price position within the 52-week range; appended per-stock tile

#### Calendar

- **F37 — Today's event count in header** — `updateTodayEventCount()` reads ICS cache, counts today's events, shows `N 📅` badge in `#header-event-count`; refreshes on each calendar load
- **F47 — Event duration label** — calendar events > 0 hours show "(Nh)' or multi-day range; computed from `event.start` / `event.end` in `renderCalendar`

#### News

- **F29 — News count badge** — shows total article count in news card header chip; updates each render
- **F39 — News source filter chips** — `initNewsFilter()` + `addNewsFilterChip(src)` build a filter bar below news header; click a source to filter, "הכל" shows all; `dataset.src` attribute per row

#### Infrastructure & UX

- **F11 — Auto night-dim mode** — `updateNightDimmer()` applies `filter:brightness(40%)` + `.night-mode` body class between 22:00–07:00; respects `dash_nightDimOff`
- **F33 — Config panel** — `toggleConfig()` / `saveConfig()`: full slide-over panel (gear icon + `S` key) with fields for background URL, auto-theme, °C/°F toggle, custom ticker announcement, stock alerts JSON, alert sound, birthday string; persists all to localStorage
- **F34 — Chore wheel** — `updateChoreWheel()` uses day-of-year mod rotation over 7 family tasks; shows `person: chore` in `#hc-chore` row in hc-card
- **F36 — Earthquake monitor** — `loadEarthquakes()` fetches USGS GeoJSON (M2.5+, 500km from Jerusalem); shows `#quake-row` only for M3.5+ events < 24h old; 1h cache; `_renderEarthquake()` renders place + magnitude badge
- **F40 — Connectivity health indicator** — `checkConnectivity()` pings `gstatic.com/generate_204`; `#conn-indicator` shows ● מהיר / ● בינוני / ● איטי with green/amber/red class
- **F43 — Alert sound toggle** — `_alertSoundEnabled` flag; Web Audio API beep `alertBeep()` plays on new צבע אדום alert; configurable in config panel (on/off)
- **F44 — Multi-city weather tabs** — `switchWxCity(key)` switches active city for weather; displayed as tab chips (`#wx-city-tabs`); cities defined in `CITIES` const with lat/lon; active city stored in `localStorage:dash_city`
- **F45 — Per-city weather fetch** — `loadWeather()` uses `CITIES[_activeCity]` coordinates for Open-Meteo API call
- **F48 — Custom ticker announcement** — prepend custom Hebrew message to the halacha ticker via config panel `cfg-ticker-msg`; loaded from `localStorage:dash_ticker_msg`
- **F49 — Font scale toggle** — `_fontScale` state; keyboard `+`/`-` adjusts `document.documentElement.style.fontSize`; persisted in `localStorage:dash_fontScale`
- **F50 — Print mode** — `@media print` CSS renders cards as full-width stacked blocks; invoked via keyboard `P` triggering `window.print()`

### Changed

- `_tempUnit` variable (`C`/`F`) toggles all temperature displays; click on any temperature element toggles unit; persisted in `localStorage:dash_tempUnit`
- Weather hourly URL extended with `apparent_temperature,precipitation_probability,winddirection_10m`
- Alerts card: `loadAlerts()` plays `alertBeep()` if new alerts detected and sound is enabled

### Developer

- Tests: Suites 45–50 added covering new HTML elements, functions, and constants; **694 tests / 50 suites / 0 failures**
- New localStorage keys: `dash_portfolio`, `dash_bgUrl`, `dash_autoTheme`, `dash_tempUnit`, `dash_ticker_msg`, `dash_alertSound`, `dash_city`, `dash_v2_cur_hist`, `dash_fontScale`, `dash_nightDimOff`
- New globals: `_tempUnit`, `_autoTheme`, `_alertSoundEnabled`, `_fontScale`, `_activeCity`, `_prevAqiVal`

---

## [4.8.0] — 2026-04-10

### Added

- **🗓️ Hebrew Calendar card (`לוח עברי`)** — new dedicated card in the middle column showing: candle lighting time + day, havdalah time, next holiday with days remaining, special items (Sefirat HaOmer, Hanukkah candles etc.), hourly rotating rabbi saying from MOTIVATIONS; driven by `loadHebCal()` with its own `sync-hebcal` indicator, 6h refresh interval
- **🎨 Brand-color stock rows** — each stock row now uses the company's primary brand color for its left border stripe and ticker symbol label; colors are defined in a new `STOCK_BRAND` constant (14 symbols including ^GSPC, ^VIX, BTC-USD, TSLA, NVDA, INTC, etc.)
- **🖼️ Reliable stock logos via Google Favicons** — logos now fetch from `https://www.google.com/s2/favicons?domain=DOMAIN&sz=64` instead of the unreliable Clearbit API; logo domain registered in `STOCK_BRAND`; old `onerror`/`display:none` cleared on first render; colored letter-badge fallback (brand-colored background, white text) if favicon also fails
- **Alphabetically sorted stocks** — `STOCK_SYMBOLS` array sorted A–Z with `^GSPC` and `^VIX` pinned first

### Changed

- **Layout restructured to 3-column full-height grid** — `.grids-area` changed from `flex-column` (main-row + bottom-row) to a single CSS `grid` with `grid-template-columns: 38fr 33fr 29fr`; `.grid-col-left` (news 65% + weather 35%), `.grid-col-mid` (heb-cal 20% + calendar 65% + currency 15%), `.grid-col-right` (stocks 33% + alerts 33% + motivation 33%)
- **Stocks and alerts are now standalone cards** — removed `.col-split` wrapper; stocks, alerts, and motivation are direct `.grid-col-right > .card` children
- **Alerts-off CSS target updated** — `body.alerts-off` now hides `.grid-col-right > .card:nth-child(2)` and expands `.card:nth-child(1)` instead of the removed `.col-split` rules
- **Card maximize updated** — `toggleCardMaximize` sibling-hide selector changed from `.main-grid > *, .bottom-grid > *` to `.grid-col > .card`
- **Phone/responsive CSS updated** — `.grids-area` collapses to single column in phone mode; `@media (max-width: 1200px)` wraps right column to full-width row; old `.main-grid`/`.bottom-grid` responsive rules removed
- **Stock scroll changed to no-clone loop** — `setupStocksLoop()` replaced by `startStocksScroll()` which measures actual panel height, calculates real scroll distance, injects a unique `@keyframes` per render, no DOM cloning

### Fixed

- **`^GSPC`/`^VIX` not updating** — `encodeURIComponent(sym)` added to Yahoo Finance v8 URL path so `.` is escaped correctly
- **Stock tiles appearing twice** — removed all clone-sync logic; `renderStock` only touches original `.stk` tiles
- **Neutral stock color** — changed from cyan `#22d3ee` to `#94a3b8` (chart) / `var(--text-secondary)` (CSS class)

### Removed

- **`.col-split` layout wrapper** — no longer exists in HTML; CSS rules cleaned up
- **Clearbit logo API** — replaced by Google favicons; no external rate-limited logo CDN dependency

### Developer

- **4 project skills added** — `.github/skills/add-api`, `release`, `debug-fetch`, `update-tests` (SKILL.md files)
- **MCP servers configured** — `.vscode/mcp.json` with `@modelcontextprotocol/server-fetch` and `@modelcontextprotocol/server-filesystem`
- **AGENTS.md updated** — skills and MCP server tables documented
- **Tests updated** — test suite updated for new layout class names, `startStocksScroll`, `sync-hebcal`, column selector changes; 362 tests / 44 suites all passing

---

## [4.8.2] — 2026-04-10

### Changed

- **Clock header slimmed** — `.time-section` padding `12px 20px → 6px 16px`, clock `3.4em → 2.9em`, greeting `0.95em → 0.82em`, hebrew-date `1.25em → 1.05em`, english-date `1em → 0.85em`, temp `1.5em → 1.2em`; frees ~30px vertical space for cards
- **Shabbat/holiday/omer removed from clock header** — `shabbat-info`, `holiday-info`, and `omer-count` divs removed from `.header-left`; only `hebrew-date` remains in header; Shabbat and holiday data lives exclusively in the Hebrew Calendar card now
- **Stock fetch overhauled** — removed dead `loadStocksBatch()` (Yahoo v6/quote returns 404); switched to per-symbol v8/chart bare URL via `raceProxies`; added CoinGecko fallback for BTC-USD (Yahoo crypto fails through CORS proxies); stock fetches now use `runConcurrent(..., 4)` instead of `Promise.allSettled`; timeout increased from 6s to 8s
- **Currency card redesigned** — changed from vertical stacking (1×2) to side-by-side (2×1) horizontal layout; each tile: flag → pair → rate → change% in a single row; flag `1.8em → 1.1em`, rate `1.3em → 0.88em`, pair `0.72em`, chg `0.62em`; used `₪` symbol; border moved from bottom to left-side accent
- **Card maximize enhanced** — maximized cards now scale font and center content per body type: news `1.35em`, stocks `1.3em`, alerts `1.35em`, currency `1.5em` centered, motivation `1.4em` centered, heb-cal `1.3em` centered, calendar `1.2em`
- **Roadmap expanded** — 6-phase roadmap (v4.9–v5.3+) with 20+ planned features; replaced flat table with phased sections in README and copilot-instructions

### Fixed

- **Page blink on load** — `init()` was called twice (both `DOMContentLoaded` listener AND `readyState` fallback fired simultaneously); changed to exclusive `if/else`
- **Auto hard-reload removed** — `setTimeout(() => location.reload())` every 1h removed entirely; was causing unexpected page resets on always-on TV
- **loadShabbat TypeError** — `el.shabbat` was `null` after `shabbat-info` removal; added `if (!el.shabbat) return;` guard
- **`[object Object]` in heb-cal saying** — MOTIVATIONS entries use `.t`/`.a` properties, not `.text`/`.author`; fixed `hcSaying` render
- **Omer sunset logic** — added sunset-aware date correction to special items fetch in `loadHebCal` (same logic as `loadOmer`)

### Developer

- **Tests updated** — 5 test assertions fixed for removed header elements (`omer-count`, `shabbat-info`, `holiday-info`) and stock fetch changes (v6 batch → v8 per-symbol + runConcurrent); 362 tests / 44 suites all passing
- **Repo memory updated** — Yahoo v6 deprecation, CoinGecko fallback, Hebcal geonameid quirk, MOTIVATIONS property names documented

---

## [4.8.1] — 2026-04-10

### Changed

- **Card headers slimmer** — `padding` reduced from `5px 14px` → `3px 14px`, `font-size` from `1.15em` → `0.95em`, `letter-spacing` from `0.5px` → `0.3px`; icon badge shrunk (`1.6em` → `1.4em`); tablet and phone mode overrides updated proportionally; frees visible height in every card
- **Per-card font density tuned** — font sizes and padding tightened per-card to match allocated screen space:
  - Currency (15% height): flag `2.8em→1.8em`, rate `1.7em→1.3em`, body/item padding halved
  - Hebrew Calendar (20%): label `0.72em→0.68em`, values `0.80em→0.76em`, saying `0.72em/lh1.45→0.66em/lh1.3`
  - Weather (35%): icon `2em→1.6em`, temp `1.3em→1.1em`, desc `0.78em→0.72em`
  - Motivation (33%): quote `1.25em→1.0em`, padding `16px→6px`, line-height `1.65→1.5`
  - News (scrolls): item font `0.96em→0.88em`, item margin/padding trimmed for tighter density

### Fixed

- **Sefirat HaOmer not visible in Hebrew Calendar card** — `hc-special-row` was always present but empty (wasting space and pushing content out when data arrived); it now starts with `display:none` and is revealed by `loadHebCal()` only when Hebcal API returns omer items
- **Shabbat candles + havdalah on separate rows** — merged into one row: `🕯️ נרות [time] | ✨ הבדלה [time]`; candle time shortened to just `HH:MM` (removed day name + Hebrew parasha text that overflowed)
- **`hc-holiday-row` hidden until data loads** — previously rendered as an empty visible row on page load; now starts `display:none`, revealed when holiday data is available

### Developer

- **README stale test-count fixed** — badge, structure, and Getting Started section updated `398→362` and `342→362`
- **README Roadmap section added** — documents planned versions (v4.9–v5.1) and release convention (HTML artifact + GitHub Pages + auto-release)
- **Roadmap persisted in `copilot-instructions.md`** — future agents know the planned roadmap

---

## [Unreleased]

---

## [4.7.0] — 2026-04-09

### Added

- **🌾 ספירת העומר (Sefirat HaOmer)** — displays the Omer count in the header next to the Hebrew date; count automatically switches to the next day at sunset using cached weather sunset time or Jerusalem approximation (19:15 IST fallback); fetches from Hebcal API (`omer=on`) with 24h cache; shows nothing outside the Omer period
- **📊 Top 10 S&P500 stocks** — expanded stock list to 14 unique symbols: INTC, ^GSPC, BTC-USD, NVDA, ^VIX, TSLA, AAPL, MSFT, AMZN, GOOGL, META, BRK-B, AVGO, JPM (no duplicates)
- **🏷️ Company logos on stock tiles** — each stock row now shows the company logo using Clearbit logo API (`https://logo.clearbit.com/{domain}?`) with `onerror` fallback that hides the logo element if unavailable; BTC uses CoinGecko asset URL

### Changed

- **Layout — bottom row** — `.bottom-grid` columns changed from `42% 28% 30%` to `50% 25% 25%`; weather card gets more space, currency and motivation shrink to 25%
- **Layout — main row** — `.main-grid` columns changed from `42% 30% 28%` to `38% 33% 29%`; calendar and stocks+alerts columns enlarged
- **Card overlap prevention** — added `overflow: hidden` to `.main-grid` and `.bottom-grid` so cards cannot bleed visually into adjacent grid cells
- **STOCK_NAMES** — extended with Hebrew descriptions for all 14 symbols: AAPL (אפל — צרכן), MSFT (מיקרוסופט — תוכנה), AMZN (אמזון — פלטפורמה), GOOGL (אלפבית — טכנולוגיה), META (מטא — רשתות), BRK-B (ברקשייר — בופט), AVGO (ברודקום — שבבים), JPM (ג.פ.מורגן — בנקאות)

### Tests

- All 398 tests passing (1 new test added: Sefirat HaOmer element; stock count updated 6→14; version assertion updated to v4.7)

## [4.6.0] — 2026-04-08

### Added

- **Auto hard-reload every 1h** — `setTimeout` self-rescheduling with visibility guard; defers in 1-min increments when tab is hidden, so the TV always picks up HTML file changes (`362ab9a`)
- **Closest sun event** — weather detail panel dynamically shows the next upcoming event: `🌅 זריחה` before sunrise and mid-morning, switches to `🌇 שקיעה` once sunrise passes, reverts to sunrise label after sunset (`d88ea03`)

### Changed

- **Row height split 65/35** — `main-grid` (news/calendar/stocks) grows to 65% of grid height; `bottom-grid` (weather/currency/motivation) shrinks to 35% (`e748027`)
- **Currency: USD + EUR only** — GBP removed; layout improved with larger padding, flag 2em→2.8em, rate font 1.3em→1.7em; change indicator placeholder fixed (`5b1b83a`)
- **News font size** — `.rss-item` base `0.82em` → `0.96em`; tablet `0.75em` → `0.86em`; small-screen `0.72em` → `0.82em` (`afca5ad`)
- **Motivation rotation** — `setInterval` changed from `14400000ms` (4h) to `120000ms` (2min) so 50 quotes cycle visibly on the always-on TV (`8ee041d`)
- **Currency/motivation max-height 30vh** — compact cards capped and centered, weather card fills full row height (`e748027`)
- **Card header emoji removed** — `🏡` and `👨‍👩‍👧‍👦` spans removed from the clock/header section for a cleaner look (`6eb3934`)
- **Alerts off by default** — `localStorage` fallback changed from `'on'` to `'off'`; `<select>` default option set to `off` (`8d377ec`)
- **Emoji refresh** — currency flags changed from inline SVG back to flag emoji (🇺🇸 🇪🇺); card badge emoji refreshed: 🗞️ 📊 🌡️ 🪙 ✨; halacha ticker 📖→📜 (`f3a8a00`)

### Fixed

- **Ticker seamless loop** — `renderHalacha` now duplicates the entire set (ref badge + all segments) as a true clone; scroll direction corrected from `translateX(-50%→0)` rightward to `0→-50%` leftward (`8ee041d`)
- **Maximized card body fill** — `.card.maximized` lifts `contain:content` and `overflow:hidden` from all inner body elements so content fills the expanded area; weather sub-panels expand too (`e748027`)
- **VS Code test runner hang** — added `package.json` with `"type":"module"`, set `--test-timeout=30000`, `--test-concurrency=4` in `.vscode/settings.json` (`c1d4116`)

### Tests

- All 397 tests passing after this session's changes (`node --test tests/dashboard.test.mjs`)
- Updated assertions: motivation interval `14400000→120000`, ticker clone structure, header emoji count, alerts default state

---

## [4.5.0] — 2026-04-09

### Added

- **🔍 Card maximize** — click any card header to expand it full-screen with smooth FLIP animation; click again or press `Escape` to collapse back
- **📊 Animated number transitions** — `animateNumber()` smoothly counts up/down on temperature, stock prices, and currency values
- **🔄 Exponential backoff** — `getBackoff()`/`recordFailure()`/`recordSuccess()` for smarter retry timing on failed API calls
- **⚡ syncBurst** — visual burst animation on sync dots after successful data refresh
- **⏱️ Uptime tracker** — displays dashboard uptime in the status bar
- **🌐 corsproxy.io** — added as 3rd CORS proxy fallback for calendar ICS fetching
- **📅 Calendar resilience** — `loadCalendar()` improved with per-step diagnostic logging, longer timeouts (10–12s), `_pageVisible` guard, and `acceptICS()` validator
- **🧪 Comprehensive test suite** — 342 tests across 44 suites covering all 7 cards + utilities (Node.js built-in test runner, zero dependencies)
  - Calendar, Weather, Stocks, Currency, Alerts, News, Motivation
  - Hebrew Date & Shabbat, Theme system, Screen modes, Cache, Diagnostics, Animations, Card maximize, and more
- **🏠 index.html** — GitHub Pages redirect to `BestDashBoard.html` for shorter URLs
- **🎨 CSS enhancements** — scroll fade masks, animated gradient borders (`@property --border-angle`), news freshness indicators (`data-age="fresh"`), stock row tinting (`.stk-up`/`.stk-down`), calendar today highlight, skeleton loading improvements, `content-visibility: auto` on bottom-grid cards
- **🖱️ RAF-throttled mousemove** — spotlight effect now uses `requestAnimationFrame` throttling for better performance
- **📁 .markdownlint.json** — markdown lint configuration (161 errors → 0)

### Changed

- Alerts display increased from 15 → 25 visible items
- News items show `relTime() + ' | ' + HH:MM` time format
- Card headers use colorful emoji icons instead of inline GIF images
- Weather card layout: flex-based height distribution (`flex: 1 1 0`) instead of fixed `calc()` percentages
- CORS proxy fallback order: direct → allorigins → codetabs → corsproxy.io
- GitHub Actions workflows: `@v6` → `@v4` for `actions/checkout` and `actions/setup-node`

### Fixed

- Weather card layout — forecast/hourly chart no longer overlaps current conditions section
- README.md — 161 markdown lint errors fixed
- `content-visibility: auto` excluded from weather card (was interfering with flex height calculation)

---

## [4.4.0] — 2026-04-07

### Added

- **🎨 5 CSS themes** — black (OLED default), blue, matrix, amber, purple — press `T` to cycle
- **📱 3 screen modes** — tv (default), tablet, phone — phone mode enables full-page scroll
- **🔍 Diagnostic overlay** — press `D` for per-pane status + rolling fetch log; auto-opens on errors
- **📶 Offline banner** — slides down when `navigator.onLine` is false, serves stale cache
- **✨ Card spotlight glow** — mouse-follow radial gradient via `::after` pseudo-element
- **🛡️ Async-safe loaders** — `safeLoad()` wrapper with `Promise.allSettled` — one failure doesn't break others
- **🔍 Startup self-check** — validates MOTIVATIONS array, DOM refs, PROXIES, STOCK_SYMBOLS
- **🎬 6 card entrance animations** — random direction per card with staggered delays + 5min attention loop
- **📰 20 Hebrew news feeds** — expanded from 10 sources
- **⚡ Faster ticker** — scroll speed increased from 80→140 px/s
- Fetch locks (`acquireLock`/`releaseLock`) prevent duplicate concurrent requests
- Page Visibility API pauses fetches when tab is hidden
- Global `unhandledrejection` + `error` catchers → diagLog + auto-show overlay

---

## [4.2.0] — 2026-04-07

- 24-hour alert count, last 15 events with city names, threat type, and relative time
- Active alerts (< 10 min) pulse red; older alerts dimmed
- 30-second refresh interval for life-safety data
- **Column split layout** — stock card and alerts card stacked vertically in the third column
- **Colorful icon badges** — each card header has a colored rounded badge (blue/green/orange/red/cyan/pink)
- **Gradient accents** — clock gradient text, rainbow header border, animated greeting shimmer
- **Per-section color coding** — unique colors per stock symbol, alternating news borders, colored weather/currency accents
- **Glow effects** — subtle text-shadow on clock, Hebrew date, Shabbat, temperature, ticker sources
- New CSS variables: `--purple`, `--pink`, `--orange`, `--cyan`

### Changed

- Progress bar fills use gradient (day: blue→cyan, year: yellow→orange)
- Motivation text uses gradient fill + diagonal card background
- Ticker label uses red-to-orange gradient
- Weather detail boxes interactive on hover (scale effect)
- Currency flags get drop-shadow depth
- Ticker enlarged by ~2px across all breakpoints

---

## [4.1.0] — 2026-03

### Added

- **Per-pane independent refresh** — each data pane refreshes on its own schedule (no full-page reload)
- **Persistent localStorage cache** — dual-layer cache survives browser restarts
  - `cGet(key, ttl)` — fresh data within TTL
  - `cGetStale(key)` — last-known-good fallback regardless of age
  - `cSet(key, data)` — writes to both memory + localStorage
- **Stale-while-revalidate** — shows cached data instantly, fetches in background
- Smart per-pane refresh intervals: Clock 1s, Market badge 1min, News 2min, Stocks 5min/30min, Weather 15min, Currency 30min, Motivation 30min, Hebrew date 1h, Shabbat 3h, Holidays 6h

### Removed

- Removed `<meta http-equiv="refresh" content="300">` (no more full-page reload)

### Fixed

- Removed duplicate JS function definitions (loadHolidays, renderHoliday, updateProgress, updateMarketBadge, relTime)

---

## [4.0.0] — 2026-03

### Added

- **🎉 Holiday countdown** — next Jewish holiday with days remaining in the header
- **📊 Progress bars** — day progress and year progress in the status bar
- **🏪 Market badge** — green "פתוח" / red "סגור" indicator for US market hours
- **⏰ Blinking clock colons** — animated separator for visual heartbeat
- **🌡️ Feels-like temperature** — apparent temperature from Open-Meteo
- **📰 Relative timestamps** — "לפני 5 דקות" on news items
- **💬 Crossfade quotes** — smooth opacity transition between motivational quotes
- Expanded motivation list to 30 curated Hebrew quotes

### Changed

- News sources expanded from RSS feeds to 10 Hebrew sources
- Stock refresh uses smart TTL (5 min during market, 30 min off-hours)

---

## [3.0.0] — 2026-02

### Changed

- **Complete UI/UX refactor** — dark glassmorphism theme
- New CSS custom property system for theming
- Responsive grid layout (45% / 30% / 25% top row, 42% / 28% / 30% bottom row)
- Glass card design with `backdrop-filter: blur(16px)`
- Animated gradient background
- Bézier SVG stock charts
- Side-by-side currency layout with flag emojis

---

## [2.0.0] — 2026-01

### Added

- Weather with hourly chart
- Stock tracker with Yahoo Finance proxy
- Currency exchange rates
- Google Calendar embed
- Auto-refresh every 5 minutes

---

## [1.0.0] — 2025-12

### Added

- Initial dashboard with clock, Hebrew date, Shabbat times
- RSS news feed
- Motivational quotes
- Basic responsive layout

---

[4.5.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v4.4.0...HEAD
[4.4.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v4.2.0...v4.4.0
[4.2.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v4.1.0...v4.2.0
[4.1.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/RajwanYair/FamilyDashBoard/releases/tag/v1.0.0
