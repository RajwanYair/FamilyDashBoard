---
applyTo: "**/*.html"
description: "Use when: editing the dashboard HTML file. Coding standards for HTML/CSS/JS, API patterns, layout, and DOM caching."
---

# Dashboard HTML Instructions — v6.5.0

> Coding rules are in `copilot-instructions.md`. This file covers layout, patterns, and constants specific to the HTML entry point and legacy `BestDashBoard.html`.

## CSS Specifics

- Variables: `--bg-primary`, `--bg-card`, `--accent`, `--text-primary`, `--text-secondary`, `--positive`, `--negative`, `--warning`, `--purple`, `--pink`, `--orange`, `--cyan`, `--border-radius`, `--card-border`, `--card-shadow`
- 5 themes: `body.theme-{black,blue,matrix,amber,purple}`
- Glassmorphism: `backdrop-filter: blur(16px)` on cards
- CSS containment: `contain: layout style` on `.card`, `contain: content` on pane bodies
- `prefers-reduced-motion`: disables all animations

## Per-Pane Refresh Intervals

| Pane | Interval | Notes |
|------|----------|-------|
| Clock | 1 min | HH:MM, no seconds |
| Alerts | 60s / 5min | 60s active, 5min idle |
| Market badge | 1 min | Pre/open/after/closed |
| News | 15 min | 17 RSS feeds via proxy |
| Stocks | 5 / 30 min | 5min market open, 30min closed |
| Calendar | 15 min | ICS parse + iframe fallback |
| Weather | 30 min | Open-Meteo hourly + precip |
| Currency | 1 hour | ER-API + Gold/Silver via Yahoo |
| Hebrew Calendar | 6 hours | Hebcal (all Jewish data) |
| Halacha | 12 hours | Sefaria daily halacha |
| Motivation | 2 min | Static quotes, no network |

## UI Layout

- **Header**: Clock, Hebrew + English dates, greeting, temperature, market badge
- **Ticker bar**: Daily halacha (Sefaria, seamless loop)
- **Left column** (38%): News (65%) + Weather (35%)
- **Middle column** (33%): Hebrew Calendar (20%) + Google Calendar/ICS (65%) + Currency with sparklines (15%)
- **Right column** (29%): Stocks (33%) + Red Alerts (33%) + Motivation (33%)
- **Status bar**: Version, sync indicators, day/year progress bars

## Card Maximize

- Click `.card-header` → `toggleCardMaximize(card)`: FLIP animation, clock remains visible
- **Weather exception**: `.card.maximized .weather-body` → `overflow: hidden` (flex pinning)
- All other maximized bodies → `overflow: auto`
- Close: click header again or `Escape`

## Calendar Fetch Pattern

- `loadCalendar()`: direct (10s) → allorigins (12s) → codetabs (12s) → corsproxy.io (12s) → iframe fallback
- `parseICS(text)`: all-day, UTC datetime, timezone params, folded lines, escaped chars
- `.cal-fallback-active` shows Google Calendar embed when all ICS fetches fail

## Stock Fetch Pattern

- `loadStockSingle(sym)`: Yahoo v8/chart bare URL (no query params — causes allorigins 522)
- `raceProxies(url)`: `Promise.any()` across CORS proxies
- `runConcurrent(tasks, 4)`: limits parallel fetches
- BTC: CoinGecko fallback (Yahoo crypto fails through CORS)

## Scroll Helpers

- `injectScrollKeyframes(styleId, keyframeName, distance)` for vertical scroll loops
- News/alerts: clone-based seamless scroll (`.clone` hidden in phone mode)
- Stocks: no-clone, measures real scroll distance

## Screen Modes

| Mode | Behavior |
|------|----------|
| `tv` (default) | Fixed viewport, scroll loops active |
| `tablet` | Smaller fonts, tighter spacing |
| `phone` | `overflow-y: auto`, all cards expand, scroll loops disabled, clones hidden |

## Font Sizes (TV-first)

| Element | Size |
|---------|------|
| Body | 28px |
| Clock | 2.9em |
| Card headers | 0.95em / 700 |
| News items | 0.88em |
| Stock prices | 1em |
| Weather icon/temp | 1.6em / 1.1em |
| Motivation | 1.0em |
| Currency rate | 0.88em |

## JS Constants (v5.1.0)

- `DIAG_BUFFER_SIZE = 80`, `DIAG_DISPLAY_LIMIT = 20`, `WAKE_REFRESH_MS = 30 * 60 * 1000`

## Performance

- GPU layers: `translateZ(0)`, `backface-visibility: hidden`
- CPU pool: `runConcurrent(tasks, hardwareConcurrency * 0.6)`
- `scheduleIdle(fn)`: `requestIdleCallback` wrapper
- DocumentFragment batch writes for alerts/news
- `raceProxies()` via `Promise.any()` for fastest stock data
