---
applyTo: "**/*.html"
description: "Use when: editing the dashboard HTML file. Provides coding standards for the single-file HTML/CSS/JS dashboard including RTL layout, CSS variables, API integration patterns, and DOM caching."
---

# Dashboard HTML Instructions

## Single-File Architecture

Everything lives in `BestDashBoard.html` — HTML structure, CSS styles, and JavaScript logic. Current version: **v4.4**.

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

## Screen Modes

- `tv` (default): fixed viewport, scroll loops active
- `tablet`: smaller fonts, tighter spacing
- `phone`: `overflow-y: auto`, all cards expand, scroll loops disabled, clones hidden

## Weather Layout

- **Top row** (`wx-top-row`): horizontal flex — right half = current weather (icon + temp + desc), left half = 2×2 grid (humidity, wind, UV, sunrise)
- **Middle**: hourly temperature SVG chart
- **Bottom**: 4-day forecast grid with larger icons/fonts

## Font Size Guidelines (TV-first)

- Base font: 21px (body)
- Clock: 3.4em
- Card headers: 1.15em, font-weight 700, padding 5px 14px
- Stock prices: 1.2em
- Weather icon: 3em, temp: 1.8em
- Forecast day name: 0.82em, icon: 1.4em, temp: 0.9em

## Error Resilience

- `safeLoad(fn)`: async-aware try/catch wrapper — one loader failure doesn't break others
- Startup self-check: validates MOTIVATIONS array, DOM refs, PROXIES, STOCK_SYMBOLS
- Global `unhandledrejection` + `error` catchers → `diagLog()` + auto-show overlay
- Diagnostic overlay (press `D`): per-pane status + rolling fetch log
- Offline banner: slides down when `navigator.onLine` is false, auto-hides on reconnect
