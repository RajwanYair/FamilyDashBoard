---
applyTo: "**/*.html"
description: "Use when: editing the dashboard HTML file. Provides coding standards for the single-file HTML/CSS/JS dashboard including RTL layout, CSS variables, API integration patterns, and DOM caching."
---

# Dashboard HTML Instructions

## Single-File Architecture

Everything lives in `BestDashBoard.html` — HTML structure, CSS styles, and JavaScript logic. Current version: **v4.5**.

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

- News, stocks, alerts use seamless vertical scroll loops
- Items are duplicated (original + clone set) for seamless wrapping
- Clone items get CSS class `clone` / `stk-clone` — hidden in phone mode
- Dynamic keyframes injected via `<style>` element per pane

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
- Cards inside `.col-split` (stocks/alerts): only the sibling card hides, not the split container
- Close via: click header again, or press `Escape`
- CSS: `.card.maximized` (fixed + z-index 900 + transition), `.card.card-hidden` (opacity 0)

## Utility Functions (v4.5)

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
- **Bottom**: 4-day forecast grid with compact icons/fonts

## Font Size Guidelines (TV-first)

- Base font: 21px (body)
- Clock: 3.4em
- Card headers: 1.15em, font-weight 700, padding 5px 14px
- Stock prices: 1.2em
- Weather icon: 2em, temp: 1.3em, desc: 0.78em
- Weather details grid: 0.68em
- Forecast day name: 0.7em, icon: 0.9em, temp: 0.72em

## Error Resilience

- `safeLoad(fn)`: async-aware try/catch wrapper — one loader failure doesn't break others
- Startup self-check: validates MOTIVATIONS array, DOM refs, PROXIES, STOCK_SYMBOLS
- Global `unhandledrejection` + `error` catchers → `diagLog()` + auto-show overlay
- Diagnostic overlay (press `D`): per-pane status + rolling fetch log
- Offline banner: slides down when `navigator.onLine` is false, auto-hides on reconnect

## Alerts Toggle

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

## Stock Batch & Race Pattern

- `loadStocksBatch()`: fetches all 6 symbols in a single batch API call
- `raceProxies(url)`: `Promise.any()` across all CORS proxies for fastest response
- Adaptive refresh: 5 min during market hours, 30 min off-hours
- Market open detection: checks NYSE/NASDAQ hours in US Eastern time

## Performance Optimizations

- GPU-accelerated scroll layers: `translateZ(0)`, `backface-visibility: hidden` on scroll containers
- CPU-aware concurrency: `runConcurrent(tasks, poolSize)` with pool sized at `navigator.hardwareConcurrency * 0.6`
- `scheduleIdle(fn)`: defers non-critical work via `requestIdleCallback` (setTimeout fallback)
- DocumentFragment batch DOM writes for alerts and news items
- GPU detection via WebGL renderer string
- `will-change` CSS hint on SVG charts and scroll containers

## News Layout

- 17 RSS feeds, inline flex layout: `HH:MM כותרת מקור` (single row per item)
- Grid: 42% first column, 60/40 height split (flex 6:4 for news/weather)
