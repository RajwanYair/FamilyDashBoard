---
applyTo: "**/*.html"
description: "Use when: editing the dashboard HTML file. Provides coding standards for the single-file HTML/CSS/JS dashboard including RTL layout, CSS variables, API integration patterns, and DOM caching."
---

# Dashboard HTML Instructions

## Single-File Architecture

Everything lives in `BestDashBoard.html` — HTML structure, CSS styles, and JavaScript logic. Current version: **v4.14.0**.

## CSS Rules

- Use CSS custom properties defined in `:root` — never hardcode colors
- Available variables: `--bg-primary`, `--bg-card`, `--bg-card-header`, `--bg-card-inner`, `--bg-card-hover`, `--accent`, `--accent-bright`, `--accent-glow`, `--accent-border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--positive`, `--negative`, `--warning`, `--purple`, `--pink`, `--orange`, `--cyan`, `--border-radius`, `--card-border`, `--card-shadow`, `--bg-gradient-1/2/3`
- 5 themes override all variables: `body.theme-{black,blue,matrix,amber,purple}`
- RTL layout: `dir="rtl"`, `lang="he"` — use `border-right` for RTL accent borders
- Glassmorphism: `backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px)` on cards
- Card mouse-follow spotlight: `::after` radial gradient using `--mouse-x`/`--mouse-y` CSS custom properties
- CSS containment: `contain: layout style` on `.card`, `contain: content` on pane bodies
- `prefers-reduced-motion`: all animations disabled via `animation-duration: 0.01ms !important`
- Theme transitions: `transition: background 0.5s ease, color 0.3s ease` on major elements
- `::selection` highlight uses `var(--accent)` background

## JavaScript Rules

- Cache DOM elements in the `el` object at startup — never use repeated `getElementById`
- All API calls must use `try/catch` with `PROXIES` fallback array
- Use `fetchWithTimeout(url, ms)` (8s default via `AbortController`) for external APIs that may hang
- Cache every API response: `cSet(key, data)` / `cGet(key, TTL)` / `cGetStale(key)`
- Update sync indicators: `setSync('service', 'syncing'|'success'|'error')`
- Log fetches via `diagLog()` for the diagnostic overlay
- Use `textContent` for external API data, never `innerHTML` with unsanitized content
- All dates/times use `Asia/Jerusalem` timezone
- ES2020+: async/await, optional chaining (`?.`), nullish coalescing (`??`)
- All async loaders must be wrapped in `safeLoad()` (async-aware) for error isolation
- `init()` uses `Promise.allSettled(loaders.map(safeLoad))` — one failure doesn't block others
- Fetch locks: `acquireLock(name)` / `releaseLock(name)` prevent duplicate concurrent requests
- Page Visibility: `_pageVisible` flag pauses fetches when tab is hidden

## Fetch Pattern

```javascript
// fetchWithTimeout — prevents hanging on slow proxies
function fetchWithTimeout(url, ms = 8000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}
// fetchJSON — direct → proxy fallback with diagnostic logging
async function fetchJSON(url) {
    try { direct fetch } catch {}
    for (const proxy of PROXIES) { try { proxy fetch } catch { continue; } }
    throw new Error('All fetch attempts failed');
}
```

## Calendar Fetch Pattern

- `loadCalendar()`: direct (10s) → allorigins (12s) → codetabs (12s) → corsproxy.io (12s) → iframe fallback
- `acceptICS(icsText, source)`: validates `BEGIN:VCALENDAR`, parses events, stores in cache
- `parseICS(text)`: handles all-day (YYYYMMDD), UTC datetime, timezone params, folded lines, escaped chars
- Iframe fallback: `.cal-fallback-active` class shows Google Calendar embed when all ICS fetches fail
- Respects `_pageVisible` guard

## Scroll Loop Pattern

- News and alerts use seamless vertical scroll loops with duplicate (original + clone) items
- Clone items get CSS class `clone` — hidden in phone mode
- Dynamic keyframes injected via `<style>` element per pane
- **Stocks** use `startStocksScroll()` — **no-clone** approach: measures actual panel height, calculates real scroll distance, injects unique `@keyframes` per render without DOM cloning

## Card Animations

- 6 entrance keyframes: `cardSlideLeft`, `cardSlideRight`, `cardSlideUp`, `cardSlideDown`, `cardPopIn`, `cardFlipIn`
- `initCardAnimations()`: assigns random animation per card with staggered delays
- `cardAttentionLoop()`: every 5min, one random card re-animates
- Respects `prefers-reduced-motion`

## Card Maximize

- Click any `.card-header` to expand the card full-screen (covers entire grid area, clock/time-section header remains visible above)
- Uses FLIP technique: `getBoundingClientRect()` → `position: fixed` → animate to target rect
- `toggleCardMaximize(card)`: expand or collapse, hiding/showing sibling cards
- `_maximizedCard`: tracks the currently maximized card (only one at a time)
- Sibling cards hidden using `.grid-col > .card` selector (no `.col-split` wrapper)
- Close via: click header again, or press `Escape`
- CSS: `.card.maximized` (fixed + z-index 900 + transition), `.card.card-hidden` (opacity 0)

## Utility Functions (v4.6)

- `animateNumber(el, from, to, decimals, duration)`: smooth counting animation on numeric values
- `getBackoff(name)` / `recordFailure(name)` / `recordSuccess(name)`: exponential backoff for failed API retries
- `syncBurst(name)`: visual burst on sync dots after successful refresh
- `_uptimeStart` / uptime display in status bar
- RAF-throttled mousemove: spotlight effect uses `requestAnimationFrame` to avoid layout thrashing

## Screen Modes

- `tv` (default): fixed viewport, scroll loops active
- `tablet`: smaller fonts, tighter spacing
- `phone`: `overflow-y: auto`, all cards expand, scroll loops disabled, clones hidden, comprehensive CSS overrides for grids/containment/scroll-masks to prevent card overlap

## Weather Layout

- **Top row** (`wx-top-row`): horizontal flex — right half = current weather (icon + temp side-by-side in a row + desc), left half = 2×2 grid (humidity, wind, UV, sunrise)
- **Middle**: RTL hourly temperature SVG chart (max-height 48px, x-axis right-to-left)
- **Bottom**: 7-day forecast grid with compact icons/fonts (4 columns at phone breakpoint)

## Font Size Guidelines (TV-first, v4.14.0)

- Base font: 21px (body)
- Clock: **2.9em** (slimmed from 3.4em)
- Greeting: **0.82em**
- Hebrew date: **1.05em**, English date: **0.85em**
- Top temperature: **1.2em**
- Card headers: **0.95em**, font-weight 700, padding **3px 14px** (icon badge 1.4em)
- Stock prices: 1.2em (`.stk-price`)
- Weather icon: **1.6em**, temp: **1.1em**, desc: **0.72em**
- Weather details grid: 0.68em
- Forecast day name: 0.7em, icon: 0.9em, temp: 0.72em
- News item: **0.88em**, margin 2px, padding 4px 10px
- Currency flag: **1.1em**, rate: **0.88em**, pair: **0.72em**, change: **0.62em** (side-by-side 2×1 layout)
- Motivation quote: **1.0em**, line-height 1.5, padding 10px 12px
- Hebrew Calendar: label 0.68em, value 0.76em, saying 0.66em

## Error Resilience

- `safeLoad(fn)`: async-aware try/catch wrapper — one loader failure doesn't break others
- Startup self-check: validates MOTIVATIONS array, DOM refs, PROXIES, STOCK_SYMBOLS
- Global `unhandledrejection` + `error` catchers → `diagLog()` + auto-show overlay
- Diagnostic overlay (press `D`): per-pane status + rolling fetch log
- Offline banner: slides down when `navigator.onLine` is false, auto-hides on reconnect

## Alerts Toggle

## Sprint 11 Patterns (v4.14.0 — F101–F110)

### Service Worker Update Banner (F101)
- `#sw-update-banner` is `position:fixed`, `display:none`, shown by adding `.visible` class
- SW registration checks `reg.waiting` on load and listens for `updatefound` → shows banner when new SW is waiting
- `swUpdateReload()` posts `{ type: 'SKIP_WAITING' }` to SW, which calls `self.skipWaiting()` on receipt
- **Never** call `self.skipWaiting()` in the install event — always wait for explicit user confirmation

### Multi-ICS Calendar (F102)
- `getICSUrls()` returns array of active ICS URLs from `dash_ics_url`, `dash_ics_url_2`, `dash_ics_url_3`
- `loadCalendarExtra()` must guard with `if (!_pageVisible) return;`
- Config panel has 3 ICS URL inputs; `saveConfig()` persists all three + calls `loadCalendarExtra()` if any secondary URL exists

### News Search (F103)
- `applyNewsSearch(kw)` toggles `.search-hidden` on each `.rss-item` (case-insensitive match against title text)
- Updates `#news-search-count` with result count; pauses scroll animation (`animationPlayState`) during active search
- 250ms debounce on input; Escape key clears; `_newsKeyword` tracks current keyword so `renderNews()` can re-apply after refresh

### Reconnect Auto-Refresh (F105)
- `_wasOffline = false` at top of script; set `true` when `updateNetworkBanner()` detects offline
- On reconnect: reset `_wasOffline = false`, start 1500ms timeout, then `safeLoad()` for 5 panes (weather, news, stocks, currency, hebcal)

### Hebrew Wind Direction (F108)
- `deg2hebrewDir(deg)`: 8-item array `['צפון','צ-מ','מזרח','ד-מ','דרום','ד-מ','מערב','צ-מ']`; index = `Math.round(((deg%360)+360)%360/45)%8`
- `#wx-wind-heb` span lives inside the wind detail row; set via `el.wxWindHeb.textContent`

### Next Zman Header (F109)
- `_zmanimParsed`: array of `{ label, time }` objects built by `_renderZmanim()` each time zmanim are fetched
- `updateNextZman()`: `_zmanimParsed.find(z => z.time > Date.now())` → format `HH:MM` in Jerusalem timezone → set `#header-next-zman`
- **Must** call `updateNextZman()` at end of `tickClock()` so the chip updates each minute

### Visited News (F110)
- `dash_news_visited` stores a JSON array of article URLs (max 200, oldest evicted)
- `renderNews()` must: (1) read visited set and pre-apply `.visited` class to already-viewed items, (2) on click → `_addVisitedArticle(url)` then add `.visited` class, (3) re-apply `applyNewsSearch(_newsKeyword)` after render

- `#alerts-toggle` dropdown in Stocks/Alerts card header: show/hide red alerts pane
- Keyboard shortcut `A`: toggles alerts on/off
- `_alertsOn` boolean + `dash_alerts` localStorage for persistence
- `applyAlerts(on)`: toggles `.alerts-hidden` CSS class on alerts container
- `initAlerts()`: reads localStorage, binds dropdown + keyboard handler

## Daily Halacha Ticker

- Replaced news ticker with Sefaria.org daily halacha content
- `loadHalacha()`: two-step API — fetch today's calendar → fetch halacha text from Sefaria
- `renderHalacha(data)`: reference badge + numbered segments, seamless scroll loop
- 12-hour cache (`cSet`/`cGet` with 12h TTL)

## Stock Per-Symbol Fetch & Race Pattern

- `loadStockSingle(sym)`: fetches one symbol at a time via Yahoo v8/chart bare URL (no query params — adding params causes allorigins 522)
- `raceProxies(url)`: `Promise.any()` across all CORS proxies for fastest response
- `runConcurrent(tasks, 4)`: limits parallel fetches to 4 at a time to avoid rate limiting
- BTC-USD: CoinGecko fallback (`api.coingecko.com/api/v3/simple/price`) — Yahoo crypto fails through CORS proxies
- Adaptive refresh: 5 min during market hours, 30 min off-hours
- Market open detection: checks NYSE/NASDAQ hours in US Eastern time
- Timeout: 8000ms via `fetchWithTimeout`

## Performance Optimizations

- GPU-accelerated scroll layers: `translateZ(0)`, `backface-visibility: hidden` on scroll containers
- CPU-aware concurrency: `runConcurrent(tasks, poolSize)` with pool sized at `navigator.hardwareConcurrency * 0.6`
- `scheduleIdle(fn)`: defers non-critical work via `requestIdleCallback` (setTimeout fallback)
- DocumentFragment batch DOM writes for alerts and news items
- GPU detection via WebGL renderer string
- `will-change` CSS hint on SVG charts and scroll containers

## News Layout

- 17 RSS feeds, inline flex layout: `HH:MM כותרת מקור` (single row per item)
- Left column (38% of 3-col grid): News (65% height) + Weather (35% height)
