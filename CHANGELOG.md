# Changelog

All notable changes to FamilyDashBoard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
