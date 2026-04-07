# Changelog

All notable changes to FamilyDashBoard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [4.2.0] — 2026-04-07

### Added
- **🚨 Red Alerts panel** — live rocket/UAV alerts from the Home Front Command via [tzevaadom.co.il](https://www.tzevaadom.co.il/)
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

[4.2.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v4.1.0...HEAD
[4.1.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/RajwanYair/FamilyDashBoard/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/RajwanYair/FamilyDashBoard/releases/tag/v1.0.0
