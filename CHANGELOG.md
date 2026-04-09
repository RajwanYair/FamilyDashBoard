# Changelog

All notable changes to FamilyDashBoard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- Weather card CSS: reduced all component sizes to prevent overlap (icon 3em→2em, temp 1.8em→1.3em, current layout column→row)
- Weather hourly chart capped at `max-height: 48px` to leave room for forecast

### Fixed
- Card maximize: clock/time-section header now stays visible above maximized cards (`e6b436c`)
- SVG documentation assets updated to match v4.5 project state — intervals, API counts, CORS proxy chain, stock symbols, version (`3268ff5`)

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
