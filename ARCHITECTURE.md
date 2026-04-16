# FamilyDashBoard — Architecture (v7.4)

> Deployment: <https://rajwanyair.github.io/FamilyDashBoard/>
> Worker: <https://fdb.rajwanyair.workers.dev>

![Architecture diagram](.github/assets/architecture.svg)

## Stack

| Decision       | Choice                                                          | Rationale                                                       |
| -------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| Build tool     | **Vite 8**                                                      | Fast dev server, Rollup bundler, native TS, tree-shaking        |
| Language       | **TypeScript 5.9**                                              | Type safety, type-aware ESLint, strict null checks              |
| Test framework | **Vitest 4 + happy-dom**                                        | Vite-native, real DOM simulation, 1738+ tests / 39 suites       |
| Lint           | **ESLint 10 + typescript-eslint 8**                             | Flat config, type-aware rules, 0 errors / 0 warnings enforced   |
| API proxy      | **Cloudflare Workers**                                          | Eliminates CORS chain, 100 K req/day free, edge-deployed        |
| Deployment     | **GitHub Pages** (static) + **Cloudflare Workers** (API)        |                                                                 |
| CSS approach   | **Vanilla CSS** with `@layer`, design tokens, `color-mix()`     | No preprocessor; cascade-aware; container queries               |
| Module format  | **ES Modules** native `import`/`export`                         |                                                                 |
| npm model      | Tools installed at parent **`MyScripts/`**; no local lock file  | Single-root install for all scripts in the monorepo             |
| CI             | `.github/ci/install-tools.sh` — no `npm ci` or lock file needed |                                                                 |

## File Structure

```text
src/
├── index.html                  # App shell HTML (RTL, Hebrew)
├── main.ts                     # Startup: safeLoad wrappers, Promise.allSettled, intervals
├── types/
│   ├── api.ts                  # API response shapes (weather, stocks, news…)
│   ├── config.ts               # User config schema + defaults
│   └── card.ts                 # CardDefinition, CardSlot, CardRegistryEntry (v7)
├── core/
│   ├── constants.ts            # URLs, symbols, intervals, WORKER_BASE_URL
│   ├── cache.ts                # cGet/cSet/cGetStale — in-memory Map + localStorage (dash_v2_*)
│   ├── fetch.ts                # fetchWithTimeout · proxy chain · fetchViaWorker · fetchWithRetry (backoff) · network state tracker
│   ├── card-registry.ts        # Map-based card registry, lazy dynamic import() (v7)
│   ├── diag.ts                 # diagLog() + diagnostic overlay
│   ├── config.ts               # Settings load/save/export/import — migrateConfig() · sanitize() (v7.4)
│   ├── sync.ts                 # setSync(id, state) — sync dots + health
│   ├── idle.ts                 # scheduleIdle(), requestIdleCallback wrapper
│   └── sw-register.ts          # SW registration + SKIP_WAITING + VERSION_ACTIVATED
├── ui/
│   ├── theme.ts                # 6-theme system: dark·ocean·forest·warm·high-contrast·rose
│   ├── keyboard.ts             # All keyboard shortcuts (T/D/A/S/N/+/-/P/B/H/C/Esc)
│   ├── maximize.ts             # Card maximize/FLIP + collapse (startViewTransition)
│   ├── scroll.ts               # Scroll loop helpers + GPU keyframe injection
│   ├── header.ts               # Clock, greeting, market badge, birthday/countdown chips
│   ├── ticker.ts               # Halacha/Daf ticker bar
│   ├── status-bar.ts           # Version, sync dots, progress bars
│   ├── night-dimmer.ts         # Night dim overlay with schedule (dash_v2_dim_start/end)
│   ├── bg-images.ts            # Background image rotation (HTTPS-only, 30-min crossfade)
│   ├── config-panel.ts         # Settings panel (save, export, import, shareSettings)
│   ├── diag-overlay.ts         # Diagnostics <dialog> (migrated from <div>, v7)
│   ├── screen-mode.ts          # Screen mode manager (normal/compact/theater)
│   └── toast.ts                # Toast notification system
├── cards/
│   ├── base-card.ts            # createCardLoader() + scheduleCard() — shared lifecycle
│   ├── news/news.ts            # RSS feeds + search + bookmarks + stale tinting
│   ├── weather/weather.ts      # Open-Meteo, multi-city tabs, UV, sky, precipitation
│   ├── stocks/stocks.ts        # Yahoo Finance, portfolio P&L, alerts, market countdown
│   ├── currency/currency.ts    # Exchange rates + gold/silver
│   ├── calendar/calendar.ts    # ICS parser + week strip + countdown
│   ├── hebrew-cal/hebrew-cal.ts # Hebcal API, Zmanim, moon phase, psalm, chores
│   ├── alerts/alerts.ts        # Tzeva Adom (Red Alert), realtime mode
│   ├── motivation/motivation.ts # Rotating quotes with share
│   ├── tasks/tasks.ts          # Family chore board (v7, localStorage, daily reset)
│   └── system-info/system-info.ts # Battery, network, timing, browser info (v7)
├── styles/
│   ├── tokens.css              # @layer tokens: design tokens, @layer order declaration
│   ├── themes.css              # 6 theme overrides + auto-theme hooks
│   ├── base.css                # Reset, typography, body, scrollbar
│   ├── layout.css              # 3-column grid, @container queries
│   ├── components.css          # Cards, headers, badges, config panel, dialogs
│   ├── animations.css          # Keyframes, transitions, entrance effects
│   ├── scroll.css              # Scroll containers, GPU layers, fade masks
│   ├── maximize.css            # Card maximize + collapse animations
│   ├── screen-modes.css        # Compact / theater mode overrides
│   ├── print.css               # @media print
│   ├── sprints.css             # Global additions from feature sprints
│   └── a11y.css                # prefers-reduced-motion, prefers-contrast
worker/
├── src/
│   ├── index.ts                # Worker entry + router (50 lines, v7.4)
│   ├── routes/
│   │   ├── data.ts             # weather · currency · hebcal · hebcal/holidays
│   │   └── feeds.ts            # stocks · news · alerts · calendar · sefaria
│   ├── utils/
│   │   ├── response.ts         # jsonResponse() · proxyResponse() · CORS_HEADERS
│   │   └── allowlists.ts       # ALLOWED_NEWS_ORIGINS · ALLOWED_CALENDAR_ORIGINS
│   └── middleware/             # (planned: cors · cache · rate-limit)
├── wrangler.toml
└── package.json
tests/unit/
├── core/                       # cache · fetch · config · constants · diag · sync · sw
├── cards/                      # all 10 card modules
├── ui/                         # theme · header · keyboard · maximize · night-dimmer …
└── html/dom-contract.test.ts   # Element ID existence contract tests
```

## Runtime Architecture

```text
Browser
 ├─ main.ts ─── safeLoad(each card) ──► Promise.allSettled
 │               └── setInterval per card (TTL-based refresh)
 ├─ sw.js ────── APP_SHELL pre-cache ─► offline HTML fallback
 │               └── API cache (7 origins, 7-day TTL stale-while-revalidate)
 └─ card-registry.ts (v7)
     └── dynamic import() per card ──► lazy load + init

Fetch chain (per request):
  cGet(key, TTL) → hit: return cached
                 → miss: fetchWithRetry(url)   ← exponential backoff (v7.4)
                       → inner chain: fetchWithTimeout(direct)
                       → fallback: allorigins proxy
                       → fallback: codetabs proxy
                       → fallback: corsproxy.io
                       → fallback: fetchViaWorker (Cloudflare, v7)
                 → cSet(key, data)
                 → recordFetchSuccess / recordFetchFailure (network state, v7.4)

Cache layers:
  L1: in-memory Map (process lifetime)
  L2: localStorage (dash_v2_*, 7-day eviction)
  L3: Service Worker cache (API endpoints, stale-while-revalidate)
```

## CSS Architecture (v7)

```css
@layer tokens, themes, base, layout, components, animations;
/* Declared in tokens.css — explicit layer ordering prevents specificity wars */

/* Derived tokens using color-mix() */
--accent-subtle: color-mix(in oklch, var(--accent) 20%, transparent);
--bg-overlay: color-mix(in oklch, var(--bg-card) 85%, transparent);

/* Container queries on cards */
.card { container-type: inline-size; }
@container (max-width: 320px) { .card-title { font-size: 0.85rem; } }
```

## Key Invariants

1. **No external JS/CSS libraries** — zero runtime CDN dependencies
2. **No hardcoded colors** — all via CSS custom properties (`--accent`, `--bg-card`, etc.)
3. **No `innerHTML` with unsanitized data** — use `textContent` or `createElement`
4. **All async loaders**: `safeLoad()` + `if (!_pageVisible) return;` guard
5. **All fetches**: try/catch + proxy chain (`PROXIES`) + `diagLog()` + network state tracking
6. **All API data**: `cSet`/`cGet`/`cGetStale` dual-layer cache
7. **DOM refs in `el` object** — no repeated `getElementById`
8. **0 ESLint errors/warnings** enforced on every commit (CI gate)
9. **0 TypeScript errors** enforced (`tsc --noEmit` in CI)
10. **No `eslint-disable` / `@ts-ignore` suppressions** — violations must be fixed
11. **Config validated on load** — `migrateConfig()` + `sanitize()` via type guards (v7.4)
12. **`__APP_VERSION__`** injected from `package.json` at build time — version is single source of truth
