# GitHub Copilot Instructions — FamilyDashBoard

> 📺 Single-file TV dashboard · 🇮🇱 Hebrew RTL · 🎨 5 Themes (OLED default) · 🚫 Zero Dependencies

## Project Overview

Single-page family dashboard (`BestDashBoard.html`) designed for always-on TV display in the family living room. Current version: **v4.5**.

## Technical Stack

- **Language**: HTML5, vanilla CSS3, vanilla JavaScript (ES2020+)
- **No build tools**: Zero dependencies — open the HTML file directly in a browser
- **APIs consumed**: Open-Meteo (weather + UV + hourly), Hebcal (Hebrew dates + Shabbat + holidays), Yahoo Finance (stocks via proxy), ER-API + exchangerate-api (currency), 20 Hebrew RSS feeds (news), Google Translate, Google Calendar ICS (native parser + iframe fallback), tzevaadom.co.il (red alerts)
- **CORS proxies**: `allorigins.win`, `codetabs.com`, `corsproxy.io` (const array, direct fetch tried first)
- **Design system**: Dark glassmorphism with 5 CSS-variable themes, animated background, bézier SVG charts, 6 card entrance animations, card maximize (FLIP animation)
- **Tests**: 342 tests / 44 suites — `node --test tests/dashboard.test.mjs` (zero dependencies, Node.js built-in runner)

## Architecture

### Single-File Dashboard

- Everything lives in `BestDashBoard.html` — HTML + CSS + JS in one file
- No external JS/CSS frameworks (no React, no Tailwind, no jQuery)
- Data fetched client-side with `fetch()`, dual-layer cache: in-memory `Map` + `localStorage` (prefix `dash_v2_`, 7-day eviction)
- Per-pane independent refresh via `setInterval` — no full-page reload
- All times use `Asia/Jerusalem` timezone

### Themes & Screen Modes

- **5 themes**: `black` (OLED default), `blue`, `matrix`, `amber`, `purple` — stored in `localStorage` as `dash_theme`
- **3 screen modes**: `tv` (default), `tablet`, `phone` — stored as `dash_screenMode`
- **Phone mode**: full-page scroll, all card content visible, scroll-loop animations disabled, clone items hidden
- **Keyboard shortcuts**: `T` = cycle themes, `D` = toggle diagnostic overlay, `Escape` = close maximized card

### UI Layout

- **Header**: Clock (HH:MM, 60s tick), Hebrew + English dates, greeting, temperature, Shabbat times, holiday countdown, market badge, GIFs
- **Ticker bar**: Horizontal scrolling news headlines (140px/s)
- **Top row** (3 columns — 45/30/25%): News RSS | Google Calendar (native ICS) | Stocks (6 symbols) + Red Alerts
- **Bottom row** (3 columns — 42/28/30%): Weather (split-panel: current + 2×2 details + hourly chart + 4-day forecast) | Currency exchange | Motivation (50 static Hebrew quotes)
- **Status bar**: Version, day/year progress bars, last refresh time

### Cache Architecture

```javascript
// ✅ Versioned dual-layer cache (memory + localStorage)
const fresh = cGet(key, TTL);      // returns data if within TTL
const stale = cGetStale(key);      // returns data regardless of age
cSet(key, data);                   // stores in both layers with timestamp
cEvict();                          // removes entries older than 7 days on startup
```

### Fetch Pattern

```javascript
// ✅ Direct → proxy fallback with diagnostic logging
async function fetchJSON(url) {
  try { direct fetch } catch {}
  for (const proxy of PROXIES) { try { proxy fetch } catch { continue; } }
  throw new Error('All fetch attempts failed');
}
// ✅ Timeout wrapper for slow proxies (used by stock fetches)
function fetchWithTimeout(url, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}
```

### Error Resilience

- **`safeLoad(fn)`**: async-aware try/catch wrapper for each loader — one failure doesn't break others
- **Startup self-check**: validates MOTIVATIONS array, DOM refs, PROXIES, STOCK_SYMBOLS; auto-opens diagnostic overlay on failure
- **Global error catchers**: `unhandledrejection` + `error` events → diagLog + auto-show overlay
- **Diagnostic overlay** (press `D`): per-pane status + rolling fetch log
- **Offline banner**: slides down when `navigator.onLine` is false

### Card Animations

- 6 entrance keyframes: `cardSlideLeft`, `cardSlideRight`, `cardSlideUp`, `cardSlideDown`, `cardPopIn`, `cardFlipIn`
- On startup: each card gets a random animation with staggered delays
- Every 5 minutes: one random card re-animates for attention
- Respects `prefers-reduced-motion`

### Card Maximize

- Click any card header to expand it `position: fixed` over the grid area (FLIP animation)
- `toggleCardMaximize(card)`: records `getBoundingClientRect()`, sets fixed position at original rect, animates to target rect
- `_maximizedCard`: tracks the single expanded card
- Cards inside `.col-split` (stocks/alerts): only the sibling hides, not the container
- Close: click header again or press `Escape`
- CSS: `.card.maximized` (z-index 900, transitions), `.card.card-hidden` (opacity 0)

## Coding Standards

### HTML/CSS/JS

- **Indentation**: 2 spaces for HTML/CSS/JS
- **CSS**: Use CSS custom properties (`:root { --accent: ... }`) — never hardcode colors
- **CSS containment**: `contain: layout style` on `.card`, `contain: content` on pane bodies
- **JavaScript**: Modern ES2020+ syntax (async/await, optional chaining, nullish coalescing)
- **DOM**: Cache element references in `el` object at startup — no repeated `getElementById`
- **Encoding**: UTF-8, RTL direction (`dir="rtl"`, `lang="he"`)
- **No inline event handlers**: Use `addEventListener` in JS

### API Integration

- Always wrap fetch calls in try/catch with proxy fallback
- Use `cSet(key, data)` / `cGet(key, TTL)` / `cGetStale(key)` for every API response
- Use `setSync(id, 'syncing'|'success'|'error')` for sync indicators
- Log fetch attempts via `diagLog()` for diagnostic visibility
- Sanitize any user-facing content from external APIs

### Per-Pane Refresh Intervals

| Pane | Interval | Notes |
|------|----------|-------|
| Clock | 1 min | HH:MM only, no seconds |
| Alerts | 60s / 5min | 60s when active, 5min idle |
| Market badge | 5 min | |
| News | 15 min | 20 RSS feeds via CORS proxy |
| Stocks | 10 min | 30min off-hours, batch of 3, 8s timeout |
| Calendar | 15 min | ICS parse, iframe fallback |
| Weather | 30 min | Open-Meteo |
| Currency | 1 hour | ER-API + fallback |
| Motivation | 4 hours | Static quotes, no network |
| Hebrew date | 3 hours | Hebcal |
| Shabbat | 6 hours | Hebcal |
| Holidays | 12 hours | Hebcal |

### Performance

- Lazy-load images (`loading="lazy"`)
- Stagger stock API calls in batches of 3 to avoid rate limits
- `fetchWithTimeout()` with 8s AbortController prevents hanging on dead proxies
- `will-change` CSS hint for SVG charts
- CSS `contain` for paint optimization
- `prefers-reduced-motion` disables all animations
- Fetch locks prevent duplicate concurrent requests per pane
- Page Visibility API pauses fetches when tab is hidden

## What NOT To Do

- Do NOT add npm/node/build tools — this is a zero-dependency project
- Do NOT use external CSS/JS libraries or CDNs for frameworks
- Do NOT hardcode API keys in the HTML file
- Do NOT remove the CORS proxy fallback mechanism
- Do NOT break the RTL layout
- Do NOT use `innerHTML` with unsanitized external data
- Do NOT remove the diagnostic overlay or self-check system
- Do NOT use synchronous try/catch around async loader functions (use `await`)
