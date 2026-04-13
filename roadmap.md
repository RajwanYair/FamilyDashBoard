# FamilyDashBoard v6.0 — Full Refactoring Roadmap

> **Constraint**: Single-file HTML, zero dependencies. No npm, no build tools.

---

## 1. Decisions Locked In

| Decision               | Choice                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **File structure**     | Single `BestDashBoard.html` + `sw.js` + `manifest.json` + `icon.svg`                                                  |
| **Language**           | Bilingual — English UI chrome, Hebrew content (dates, news, quotes)                                                   |
| **Design direction**   | Warm living room — soft colors, rounded corners, cozy feel                                                            |
| **Cards to keep (10)** | Clock+Date, Weather, News, Stocks, Currency, Google Calendar, Hebrew Calendar, Red Alerts, Motivation, Halacha Ticker |
| **Cards to drop (3)**  | Earthquakes, Air Quality (AQI), Transit                                                                               |
| **Themes**             | 5 — redesigned: `warm-dark` (default), `oled-black`, `ocean-blue`, `forest-green`, `amber-glow`                       |
| **Data sources**       | Agent picks best reliable/simple per card                                                                             |
| **Priority**           | Maximum performance for TV display                                                                                    |
| **Target displays**    | TV (1920×1080+) primary, tablet + phone responsive                                                                    |

---

## 2. Current Baseline (v5.0.0)

| Metric            | Value                                  |
| ----------------- | -------------------------------------- |
| Total lines       | 6,613                                  |
| CSS               | 1,303 lines · 150+ classes             |
| HTML body         | 526 lines                              |
| JavaScript        | 4,753 lines · 80+ functions            |
| Tests             | 1,134 / 61 suites / 0 fail             |
| ESLint            | Clean (0 warnings)                     |
| Features          | 170 across 17 sprints                  |
| APIs              | 11 services, 17 RSS feeds              |
| localStorage keys | 40+                                    |
| Themes            | 5 (black, blue, matrix, amber, purple) |

---

## 3. Target (v6.0.0)

| Metric        | Target                     | Change                |
| ------------- | -------------------------- | --------------------- |
| CSS           | ~400 lines                 | −70%                  |
| HTML body     | ~300 lines                 | −43%                  |
| JavaScript    | ~2,800 lines               | −41%                  |
| **Total app** | **~3,500 lines**           | **−47%**              |
| Tests         | 500+ / 40+ suites / 0 fail | quality over quantity |
| Features      | ~80 curated                | −53% (no bloat)       |
| ESLint        | 0 errors, 0 warnings       | strict mode           |

---

## 4. Sprint Plan

Each sprint is designed to be executed in a single conversation turn.
Mark each sprint `[x]` as you complete it.

---

### Sprint R1 — CSS Design System

> **Goal**: New warm-palette design tokens, 5 themes, responsive grid, card shell

| #     | Task                   | Details                                                                                                                                                       |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1.1  | CSS reset & base       | `box-sizing: border-box`, scrollbar, selection, body font-family                                                                                              |
| R1.2  | Design tokens          | `:root` block with all `--color-*`, `--space-*`, `--radius-*`, `--shadow-*` variables. Warm palette: cream/linen tints, muted brown/amber accents, warm grays |
| R1.3  | 5 theme definitions    | `.theme-warm-dark` (default), `.theme-oled-black`, `.theme-ocean`, `.theme-forest`, `.theme-amber` — each overrides all tokens                                |
| R1.4  | Typography scale       | `clamp()` fluid sizing: `--text-xs` through `--text-4xl`, body/mono font stacks                                                                               |
| R1.5  | Card component         | `.card`, `.card-header`, `.card-body` with soft shadow, rounded corners, subtle border, hover glow                                                            |
| R1.6  | Grid layout            | `.dashboard-grid` 3-column with named areas, `.grid-col` flex columns                                                                                         |
| R1.7  | Responsive breakpoints | `@media` rules for 1200px (2-col), 768px (1-col), 480px (compact)                                                                                             |
| R1.8  | Screen modes           | `.mode-tv`, `.mode-tablet`, `.mode-phone` overrides                                                                                                           |
| R1.9  | Animation tokens       | `--duration-fast/normal/slow`, `prefers-reduced-motion` media query                                                                                           |
| R1.10 | Print styles           | `@media print` — B&W, hide overlays, hide buttons                                                                                                             |

**Deliverable**: Complete `<style>` block. Minimal HTML skeleton with empty cards. No JS.
**Validation**: Open in browser — grid renders, themes switchable via DevTools class toggle.

---

### Sprint R2 — HTML Structure

> **Goal**: Clean semantic HTML, bilingual labels, all 10 card shells, overlays

| #     | Task                                | Details                                                                                                     |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R2.1  | `<head>` cleanup                    | Minimal meta tags, manifest link, preconnects for kept APIs only                                            |
| R2.2  | Header section                      | Clock (`#clock`), Hebrew date, English date, greeting, temp badge                                           |
| R2.3  | Halacha ticker bar                  | `.ticker-bar` > `.ticker-label` + `.ticker-track` > `.ticker-content`                                       |
| R2.4  | Card: News                          | `data-card-id="news"`, sync dot, filter bar, search input, scroll container                                 |
| R2.5  | Card: Weather                       | `data-card-id="weather"`, city tabs, current conditions, hourly chart SVG, 7-day forecast                   |
| R2.6  | Card: Hebrew Calendar               | `data-card-id="hcal"`, candles/havdalah row, holiday, parasha, zmanim grid, daf yomi, moon, countdown       |
| R2.7  | Card: Google Calendar               | `data-card-id="cal"`, today strip, week strip, agenda, iframe fallback                                      |
| R2.8  | Card: Currency                      | `data-card-id="currency"`, 5 tiles: USD, EUR, GBP, Gold, Silver                                             |
| R2.9  | Cards: Stocks + Alerts + Motivation | `data-card-id="stocks/alerts/moti"`, stock rows, alert scroll, quote display                                |
| R2.10 | Overlays & status                   | Config panel (4 tabs), help overlay, halacha overlay, diagnostic overlay, offline banner, toast, status bar |

**Deliverable**: Full HTML body between `</style>` and `<script>`. All elements have IDs for JS binding.
**Validation**: Page renders as a skeleton with card headers and empty bodies.

---

### Sprint R3 — Core JS Infrastructure

> **Goal**: All utility code — cache, fetch, DOM refs, sync dots, config, keyboard, themes

| #     | Task                   | Details                                                                                                |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| R3.1  | Version & constants    | `VERSION = '6.0.0'`, `CACHE_TTL`, `PROXIES[]`, `STOCK_SYMBOLS[]`, `NEWS_FEEDS[]`                       |
| R3.2  | Cache system           | `cGet(key, ttl)`, `cGetStale(key)`, `cSet(key, data)`, `cEvict()` — dual-layer: `Map` + `localStorage` |
| R3.3  | Fetch utilities        | `fetchJSON(url)`, `fetchText(url)`, `fetchWithTimeout(url, ms)` with proxy fallback chain              |
| R3.4  | `raceProxies(url)`     | `Promise.any()` across all proxies for fastest response                                                |
| R3.5  | DOM refs (`el` object) | Single `$()` helper, lazy `el = { clock, engDate, hebDate, ... }`                                      |
| R3.6  | Sync indicators        | `setSync(name, state)` for 'idle'/'syncing'/'success'/'error'                                          |
| R3.7  | Diagnostic logger      | `diagLog(msg)`, rolling 100-entry buffer, overlay toggle with `D` key                                  |
| R3.8  | `safeLoad(fn)`         | Async wrapper: try/catch + sync indicator + diagLog on error                                           |
| R3.9  | Concurrency pool       | `runConcurrent(tasks, limit)` — CPU-aware (`hardwareConcurrency * 0.6`)                                |
| R3.10 | Fetch locks            | `acquireLock(name)` / `releaseLock(name)` — prevent duplicate requests                                 |
| R3.11 | Page visibility        | Pause on hidden, wake-refresh after 30min, `_pageVisible` flag                                         |
| R3.12 | Network status         | Online/offline banner, `_wasOffline` auto-refresh on reconnect                                         |
| R3.13 | Theme engine           | `applyTheme(name)`, `cycleTheme()`, persist to `dash_theme`, body class swap                           |
| R3.14 | Config engine          | `saveConfig()`, `loadConfig()`, export/import JSON, all `dash_*` keys                                  |
| R3.15 | Keyboard handler       | Single `keydown` listener: T/A/S/D/N/R/P/M/F/B/H/?/+/−/Escape                                          |
| R3.16 | Toast system           | `showToast(msg, ms)` — slide-up notification                                                           |
| R3.17 | Clock & greeting       | `tickClock()`, `getGreeting()`, progress bars, 1-min interval                                          |
| R3.18 | Scroll animations      | Reusable `setupScrollLoop(container, speed)` for news/stocks/alerts                                    |

**Deliverable**: Full infrastructure JS. Clock ticking, themes cycling, config panel opening, keyboard shortcuts working. No data loading yet.
**Validation**: ESLint 0 warnings. Clock updates. `T` cycles themes. `S` opens config. `D` opens diagnostics.

---

### Sprint R4 — Weather + Hebrew Calendar

> **Goal**: Two most complex data cards fully functional

| #     | Task               | Details                                                                                                |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| R4.1  | Weather loader     | `loadWeather()` — Open-Meteo: current + hourly + 7-day forecast, multi-city                            |
| R4.2  | Weather renderer   | `renderWeather(data)` — current temp/icon/desc, detail tiles (humidity, wind, UV, sunrise, feels-like) |
| R4.3  | Hourly SVG chart   | `renderHourlyChart(temps, startH, rainProbs)` — bézier curve + rain bars                               |
| R4.4  | 7-day forecast     | Forecast grid: day name, icon, hi/lo temp                                                              |
| R4.5  | Temp unit toggle   | `_tempUnit` C/F, `toDisplayTemp()`, click header to toggle, persist                                    |
| R4.6  | Multi-city tabs    | `WX_CITIES{}`, `switchWxCity(key)`, tabs with active state                                             |
| R4.7  | Weather codes      | `WX_CODES{}` (Hebrew descriptions), `WX_EMOJI{}`                                                       |
| R4.8  | Hebrew date loader | `loadHebrewDate()` — Hebcal converter API                                                              |
| R4.9  | Shabbat + holidays | `loadHebCal()` — candle lighting, havdalah, holidays, Omer, Parasha, Daf Yomi                          |
| R4.10 | Zmanim grid        | `loadZmanim()` — prayer times from Hebcal                                                              |
| R4.11 | Shabbat countdown  | `updateShabbatCountdown()` — live countdown to candle lighting                                         |
| R4.12 | Moon phase         | `getMoonPhase()` — calculated from date (no API)                                                       |
| R4.13 | Halacha ticker     | `loadHalacha()` — Sefaria daily halacha, ticker scroll                                                 |

**Deliverable**: Weather and Hebrew Calendar cards fully rendering live data. Halacha ticker scrolling.
**Validation**: Both cards show real data. Multi-city works. Hebrew date displays. Ticker animates.

---

### Sprint R5 — News, Stocks, Currency

> **Goal**: Three data-heavy financial/information cards

| #     | Task              | Details                                                                                        |
| ----- | ----------------- | ---------------------------------------------------------------------------------------------- |
| R5.1  | News loader       | `loadNews()` — 17 RSS feeds via proxy, XML parse, deduplicate, sort by time                    |
| R5.2  | News renderer     | `renderNews(items)` — scroll list with source badge, age, bookmark button                      |
| R5.3  | News features     | Source filter chips, keyword search (`#news-search`), visited dimming, bookmark mode (`B` key) |
| R5.4  | Stock loader      | `loadAllStocks()` — Yahoo Finance v8/chart per-symbol + CoinGecko BTC fallback                 |
| R5.5  | Stock renderer    | `renderStock(el, data, sym)` — logo, symbol, price, change %, sparkline SVG                    |
| R5.6  | Market status     | `updateMarketBadge()` — pre/open/after/closed states + countdown                               |
| R5.7  | Stock brands      | `STOCK_BRAND{}` mapping symbol → color + favicon domain                                        |
| R5.8  | Currency loader   | `loadCurrency()` — ER-API for USD/EUR/GBP + Yahoo Finance for Gold/Silver                      |
| R5.9  | Currency renderer | `renderCurrency(rates)` — 5 tiles: flag, pair, rate, change %, sparkline                       |
| R5.10 | Sparkline utility | `renderSparkline(svgEl, dataPoints, color)` — shared across stocks + currency                  |

**Deliverable**: News, Stocks, Currency cards fully functional with live data.
**Validation**: All 3 cards loading. News scrolling, stocks updating, currency showing rates.

---

### Sprint R6 — Calendar, Alerts, Motivation

> **Goal**: Remaining 3 cards + scroll animations + card maximize

| #     | Task              | Details                                                                             |
| ----- | ----------------- | ----------------------------------------------------------------------------------- |
| R6.1  | ICS parser        | `parseICS(text)` — extract VEVENT blocks from ICS text                              |
| R6.2  | Calendar loader   | `loadCalendar()` — direct fetch → proxy chain fallback, multi-ICS support           |
| R6.3  | Calendar renderer | Week strip + today strip + agenda view. Day headers, event rows                     |
| R6.4  | Calendar iframe   | Google Calendar embed fallback when ICS fails                                       |
| R6.5  | Red Alerts loader | `loadAlerts()` — tzevaadom.co.il, zone filtering from config                        |
| R6.6  | Alerts renderer   | `renderAlerts(data)` — active/past styling, live dot, alert count                   |
| R6.7  | Alert toggle      | `A` key, config panel on/off, body class `alerts-off`                               |
| R6.8  | Motivation        | `MOTIVATIONS[]` (50 Hebrew quotes), `loadMotivation()`, daily rotation, next button |
| R6.9  | Card maximize     | `toggleCardMaximize(card)` — FLIP animation, fixed position, Escape to close        |
| R6.10 | Scroll setup      | Wire `setupScrollLoop()` for news, stocks, alerts containers                        |

**Deliverable**: All 10 cards functional. Card maximize working. Full dashboard operational.
**Validation**: Every card shows data. Click header to maximize. Escape to close.

---

### Sprint R7 — PWA, Performance, Polish

> **Goal**: Service worker, offline, performance optimizations, UX polish

| #     | Task                    | Details                                                                   |
| ----- | ----------------------- | ------------------------------------------------------------------------- |
| R7.1  | Service Worker          | Rewrite `sw.js` — APP_SHELL cache + API cache + offline fallback HTML     |
| R7.2  | SW update flow          | `SKIP_WAITING` message pattern, update banner, `controllerchange` reload  |
| R7.3  | Manifest update         | New theme-color, bilingual name, correct icons                            |
| R7.4  | GPU layers              | `will-change: transform` + `translateZ(0)` on scroll containers           |
| R7.5  | CSS `contain`           | `contain: layout style` on `.card`, `contain: content` on card bodies     |
| R7.6  | Scroll fade masks       | Top/bottom `mask-image` gradient on news/stocks/alerts                    |
| R7.7  | Card entrance animation | 4 variants (slide-left/right/up/pop), staggered delays, random assignment |
| R7.8  | Night dimmer            | `#night-dim` overlay, configurable hours, `N` key toggle                  |
| R7.9  | Background images       | `BG_IMAGES[]`, 30-min rotation, smooth opacity crossfade                  |
| R7.10 | Font scale              | `+`/`-` keys, persist to `dash_fontScale`, indicator toast                |
| R7.11 | Birthday chip           | Parse `dash_birthday`, show header chip within 14 days                    |
| R7.12 | Custom countdown        | Configurable event countdown chip from config panel                       |

**Deliverable**: PWA installable. Offline shell works. Smooth animations. All polish features.
**Validation**: Lighthouse PWA audit. Disconnect network — stale data shown. Animations respect `prefers-reduced-motion`.

---

### Sprint R8 — Tests, Lint, Documentation

> **Goal**: Full test suite, 0 warnings, updated docs

| #     | Task                    | Details                                                                       |
| ----- | ----------------------- | ----------------------------------------------------------------------------- |
| R8.1  | Test file structure     | New `tests/dashboard.test.mjs` — organized by component, not sprint           |
| R8.2  | HTML structure tests    | DOCTYPE, lang, charset, grid, 10 cards, sync dots, ARIA, overlays             |
| R8.3  | CSS system tests        | Design tokens present, 5 themes defined, responsive breakpoints, print styles |
| R8.4  | JS infrastructure tests | Cache API, fetch helpers, safeLoad, concurrency, config, keyboard             |
| R8.5  | Card-specific tests     | Each card: loader function exists, renderer function exists, key DOM elements |
| R8.6  | Feature tests           | Theme cycle, font scale, card maximize, news search, market badge             |
| R8.7  | SW tests                | Cache name = v6.0.0, APP_SHELL entries, API origins, offline HTML             |
| R8.8  | ESLint config           | Update `eslint.config.mjs` — ES2022, strict rules, 0 warnings target          |
| R8.9  | Update package.json     | Version → 6.0.0                                                               |
| R8.10 | Update CHANGELOG.md     | Full v6.0.0 entry documenting refactoring                                     |
| R8.11 | Update README.md        | New description, structure, badge                                             |
| R8.12 | Final validation        | `node --test` = 0 fail 0 skip, `npx eslint` = 0 warn, tag `v6.0.0`            |

**Deliverable**: ≥500 tests, 0 failures, 0 lint warnings. All docs updated. Ready for release.
**Validation**: `node --test tests/dashboard.test.mjs` → 0 fail. `npx eslint` → clean. Git tag ready.

---

## 5. Execution Protocol

For each sprint, follow this exact sequence:

1. **Read** this roadmap to recall context
2. **Implement** all tasks in the sprint
3. **Extract JS** and run `node --check` to verify syntax
4. **Run ESLint** on extracted JS — target 0 warnings
5. **Run tests** — `node --test tests/dashboard.test.mjs` — target 0 fail
6. **Open in browser** — visual smoke-test (TV mode)
7. **Mark sprint done** — update this file, commit

### Command cheat-sheet

```powershell
# Syntax check (extract JS → node --check)
$h = Get-Content BestDashBoard.html -Raw; $s=$h.IndexOf('<script>'); $e=$h.LastIndexOf('</script>'); $h.Substring($s+8,$e-$s-8) | Set-Content dash_tmp.js; node --check dash_tmp.js; Remove-Item dash_tmp.js

# ESLint
$h = Get-Content BestDashBoard.html -Raw; $s=$h.IndexOf('<script>'); $e=$h.LastIndexOf('</script>'); $h.Substring($s+8,$e-$s-8) | Set-Content dash_tmp.js -Encoding UTF8; npx eslint dash_tmp.js --no-color; Remove-Item dash_tmp.js

# Tests
node --test tests/dashboard.test.mjs

# Line count
(Get-Content BestDashBoard.html).Count
```

---

## 6. Sprint Status Tracker

| Sprint                            | Status                 | Lines After | Tests After |
| --------------------------------- | ---------------------- | ----------- | ----------- |
| Baseline v5.0.0                   | ✅ Done                | 6,613       | 1,134 / 61  |
| R1 — CSS Design System            | ✅ Complete            | 6,711       | 1,134 / 61  |
| R2 — HTML Structure               | ✅ Complete            | 6,455       | 1,083 / 61  |
| R3 — Core JS Infrastructure       | ✅ Complete            | 6,449       | 1,088 / 61  |
| R4 — Weather + Hebrew Cal         | ✅ Complete            | 6,405       | 1,084 / 61  |
| R5 — News, Stocks, Currency       | ✅ Complete             | 6,405       | 1,084 / 61  |
| R6 — Calendar, Alerts, Motivation | ✅ Complete (R6.1-R6.9) | —           | 1,084 / 61  |
| R7 — PWA, Performance, Polish     | ✅ Complete (verified)  | —           | 1,084 / 61  |
| R8 — Tests, Lint, Docs            | 🔄 Partial (R8.1-R8.5, R8.8-R8.11) | —          | 1,184 / 66  |
| **v6.0.0 Release**                | ⬜                     | **~3,500**  | **500+**    |

---

## 7. APIs Kept

| Card             | API                 | Base URL                                           | Auth |
| ---------------- | ------------------- | -------------------------------------------------- | ---- |
| Weather          | Open-Meteo          | `api.open-meteo.com/v1/forecast`                   | None |
| Hebrew Date      | Hebcal Converter    | `www.hebcal.com/converter`                         | None |
| Shabbat/Holidays | Hebcal              | `www.hebcal.com/shabbat` + `hebcal`                | None |
| Halacha          | Sefaria             | `www.sefaria.org/api/calendars` + `/api/v3/texts/` | None |
| News             | 17 Hebrew RSS       | Various (via CORS proxy)                           | None |
| Stocks           | Yahoo Finance v8    | `query1.finance.yahoo.com/v8/finance/chart/`       | None |
| Stocks (BTC)     | CoinGecko           | `api.coingecko.com/api/v3/simple/price`            | None |
| Currency         | ExchangeRate-API    | `open.er-api.com/v6/latest/ILS`                    | None |
| Calendar         | Google Calendar ICS | User-configured URL                                | None |
| Red Alerts       | Tzeva Adom          | `api.tzevaadom.co.il/alerts-history`               | None |

**CORS Proxies** (fallback chain): `allorigins.win` → `codetabs.com` → `corsproxy.io`

---

## 8. Keyboard Shortcuts (v6.0)

| Key       | Action                         |
| --------- | ------------------------------ |
| `T`       | Cycle themes                   |
| `A`       | Toggle alerts on/off           |
| `S`       | Settings panel                 |
| `D`       | Diagnostic overlay             |
| `N`       | Night dimmer toggle            |
| `R`       | Force refresh all panes        |
| `P`       | Print mode                     |
| `M`       | Mute/unmute alert sound        |
| `F`       | Toggle fullscreen              |
| `B`       | News bookmarks filter          |
| `H` / `?` | Help overlay                   |
| `+` / `-` | Font scale up/down             |
| `Escape`  | Close maximized card / overlay |

---

## 9. Card Layout (v6.0)

```text
┌─────────────────────────────────────────────────────────────┐
│  [Halacha Ticker Bar]                                       │
├─────────────────────────────────────────────────────────────┤
│  [Header: Hebrew Date | Clock | English Date · Temp]        │
├──────────────┬───────────────┬──────────────────────────────┤
│  News  (65%) │ Heb Cal (20%) │  Stocks          (40%)      │
│              │               │                              │
│              ├───────────────┤                              │
│              │ Calendar(65%) ├──────────────────────────────┤
│──────────────│               │  Red Alerts      (30%)      │
│  Weather(35%)├───────────────┤                              │
│              │ Currency(15%) ├──────────────────────────────┤
│              │               │  Motivation      (30%)      │
└──────────────┴───────────────┴──────────────────────────────┘
Left: 38fr        Mid: 33fr        Right: 29fr
```

---

## 10. Files Modified Per Sprint

| Sprint | Files                                                                                        |
| ------ | -------------------------------------------------------------------------------------------- |
| R1-R3  | `BestDashBoard.html`                                                                         |
| R4-R6  | `BestDashBoard.html`                                                                         |
| R7     | `BestDashBoard.html`, `sw.js`, `manifest.json`                                               |
| R8     | `tests/dashboard.test.mjs`, `eslint.config.mjs`, `package.json`, `CHANGELOG.md`, `README.md` |
