# FamilyDashBoard v6.0 — Architecture Plan

> Full rewrite: Vite + TypeScript + Cloudflare Workers + Vitest
> Deployment: https://rajwanyair.github.io/FamilyDashBoard/

## Decision Record

| Decision       | Choice                                                   | Rationale                                                                |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Build tool     | **Vite 6**                                               | Fast dev server, Rollup bundler, native TS, tree-shaking, code-splitting |
| Language       | **TypeScript 5.8**                                       | Type safety, better IDE, catches bugs at build time                      |
| API proxy      | **Cloudflare Workers**                                   | Eliminates CORS chain, 100K req/day free, edge-deployed                  |
| Test framework | **Vitest + happy-dom**                                   | Vite-native, real DOM simulation, module-level tests                     |
| Deployment     | **GitHub Pages** (static) + **Cloudflare Workers** (API) |
| CSS approach   | **Vanilla CSS** with design tokens (no preprocessor)     |
| Module format  | **ES Modules** (native `import`/`export`)                |

## File Structure

```
FamilyDashBoard/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                # Lint + Test + Build on PR
│   │   ├── deploy.yml            # Build → GitHub Pages on push
│   │   ├── release.yml           # Tag → GH Release
│   │   └── worker-deploy.yml     # Deploy Cloudflare Workers
│   ├── instructions/             # Copilot instructions (updated)
│   ├── skills/                   # Copilot skills (updated)
│   └── ...                       # Existing templates, etc.
├── src/
│   ├── index.html                # Lean HTML shell (~200 lines)
│   ├── main.ts                   # App entry point
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── types/
│   │   ├── api.ts                # API response types (weather, stocks, news, etc.)
│   │   ├── config.ts             # User config schema
│   │   └── cards.ts              # Card lifecycle types
│   ├── core/
│   │   ├── constants.ts          # All magic numbers, URLs, symbols
│   │   ├── cache.ts              # Dual-layer cache (Map + localStorage)
│   │   ├── fetch.ts              # fetchWithTimeout, proxy chain, AbortController
│   │   ├── diag.ts               # Diagnostic logging + overlay
│   │   ├── config.ts             # Settings load/save/export/import
│   │   ├── sync.ts               # Sync indicators + health tracking
│   │   ├── idle.ts               # scheduleIdle, requestIdleCallback
│   │   └── sw-register.ts        # Service worker registration + update flow
│   ├── ui/
│   │   ├── theme.ts              # 5-theme system (cycle, persist, apply)
│   │   ├── keyboard.ts           # All keyboard shortcuts
│   │   ├── maximize.ts           # Card maximize/FLIP animation
│   │   ├── scroll.ts             # Scroll loop helpers + keyframe injection
│   │   ├── header.ts             # Clock, greeting, market badge, birthday chip
│   │   ├── ticker.ts             # Halacha ticker bar
│   │   ├── status-bar.ts         # Version, sync dots, progress bars
│   │   ├── night-dimmer.ts       # Night dim overlay
│   │   └── toast.ts              # Toast notification system
│   ├── cards/
│   │   ├── card.ts               # Base card lifecycle (init, refresh, interval)
│   │   ├── news/
│   │   │   ├── news.ts           # Loader + renderer
│   │   │   └── news.css          # Card-specific styles
│   │   ├── weather/
│   │   │   ├── weather.ts
│   │   │   └── weather.css
│   │   ├── stocks/
│   │   │   ├── stocks.ts
│   │   │   └── stocks.css
│   │   ├── currency/
│   │   │   ├── currency.ts
│   │   │   └── currency.css
│   │   ├── calendar/
│   │   │   ├── calendar.ts
│   │   │   └── calendar.css
│   │   ├── hebrew-cal/
│   │   │   ├── hebrew-cal.ts
│   │   │   └── hebrew-cal.css
│   │   ├── alerts/
│   │   │   ├── alerts.ts
│   │   │   └── alerts.css
│   │   └── motivation/
│   │       ├── motivation.ts
│   │       └── motivation.css
│   ├── styles/
│   │   ├── tokens.css            # Design tokens (colors, spacing, radius, shadows)
│   │   ├── themes.css            # 5 theme overrides
│   │   ├── base.css              # Reset, typography, body, scrollbar
│   │   ├── layout.css            # 3-column grid, responsive breakpoints
│   │   ├── components.css        # Cards, headers, config panel, overlays
│   │   ├── animations.css        # Keyframes, transitions, entrance effects
│   │   ├── scroll.css            # Scroll containers, GPU layers, fade masks
│   │   ├── print.css             # @media print
│   │   └── a11y.css              # prefers-reduced-motion, prefers-contrast
│   ├── sw.ts                     # Service Worker (compiled separately)
│   └── assets/
│       ├── icon.svg
│       └── manifest.webmanifest
├── worker/                        # Cloudflare Workers API proxy
│   ├── src/
│   │   ├── index.ts              # Worker entry + router
│   │   ├── routes/
│   │   │   ├── weather.ts        # /api/weather → Open-Meteo
│   │   │   ├── stocks.ts         # /api/stocks → Yahoo Finance
│   │   │   ├── news.ts           # /api/news → RSS feeds
│   │   │   ├── currency.ts       # /api/currency → ER-API + Yahoo (gold/silver)
│   │   │   ├── calendar.ts       # /api/calendar → Hebcal + Sefaria
│   │   │   └── alerts.ts         # /api/alerts → Tzeva Adom
│   │   ├── middleware/
│   │   │   ├── cors.ts           # CORS headers for dashboard origin
│   │   │   ├── cache.ts          # Cache-Control + Cloudflare cache API
│   │   │   └── rate-limit.ts     # Per-IP rate limiting
│   │   └── types.ts              # Worker types
│   ├── wrangler.toml
│   ├── tsconfig.json
│   └── package.json
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   │   ├── cache.test.ts
│   │   │   ├── fetch.test.ts
│   │   │   └── config.test.ts
│   │   ├── cards/
│   │   │   ├── news.test.ts
│   │   │   ├── weather.test.ts
│   │   │   ├── stocks.test.ts
│   │   │   └── ...
│   │   └── ui/
│   │       ├── theme.test.ts
│   │       └── keyboard.test.ts
│   ├── integration/
│   │   ├── card-lifecycle.test.ts
│   │   └── sw.test.ts
│   └── setup.ts                  # Global test setup (happy-dom env)
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── vitest.config.ts
├── eslint.config.ts
├── package.json
├── CHANGELOG.md
├── README.md
└── CLAUDE.md
```

## Phases

### Phase 1: Scaffold (this session)

- [x] Architecture plan
- [ ] Vite 6 + TypeScript 5.8 config
- [ ] Directory structure created
- [ ] `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- [ ] `src/index.html` — lean HTML shell
- [ ] CSS modules split from monolith
- [ ] Core TS modules: `constants.ts`, `cache.ts`, `fetch.ts`
- [ ] `package.json` with all dependencies
- [ ] Dev server working locally

### Phase 2: Core Infrastructure

- [ ] `types/api.ts` — all API response types
- [ ] `core/diag.ts` — diagnostic overlay
- [ ] `core/config.ts` — settings system
- [ ] `core/sync.ts` — sync indicators
- [ ] `core/sw-register.ts` — SW registration
- [ ] `sw.ts` — updated service worker
- [ ] `ui/theme.ts` — 5 theme system
- [ ] `ui/keyboard.ts` — all shortcuts
- [ ] `ui/header.ts` — clock, greeting, market badge

### Phase 3: Card Components

- [ ] `cards/card.ts` — base lifecycle
- [ ] Each card module (8 cards)
- [ ] Card-specific CSS
- [ ] `main.ts` — wire everything together
- [ ] Full app boots in dev server

### Phase 4: Cloudflare Workers

- [ ] Worker project setup (wrangler)
- [ ] Route handlers per API
- [ ] CORS middleware
- [ ] Cache middleware
- [ ] Rate limiting
- [ ] Deploy to `api.familydashboard.workers.dev`

### Phase 5: Test Migration

- [ ] Vitest config + happy-dom
- [ ] Unit tests per core module
- [ ] Unit tests per card
- [ ] Integration tests
- [ ] Coverage reporting

### Phase 6: CI/CD Update

- [ ] Updated `ci.yml` (lint + test + build)
- [ ] Updated `deploy.yml` (Vite build → GH Pages)
- [ ] `worker-deploy.yml` (deploy Workers)
- [ ] CodeQL security scanning
- [ ] Lighthouse CI

### Phase 7: Polish + Migration

- [ ] Remove old `BestDashBoard.html`
- [ ] Update all documentation
- [ ] Update Copilot instructions
- [ ] Performance audit
- [ ] Security audit (CSP, SRI, etc.)
- [ ] Tag `v6.0.0`

## Security Enhancements

| Area         | Current              | v6.0                                                          |
| ------------ | -------------------- | ------------------------------------------------------------- |
| CSP          | None                 | Strict `<meta>` CSP — `default-src 'self'; script-src 'self'` |
| XSS          | Manual textContent   | TypeScript + ESLint enforce no innerHTML                      |
| CORS         | 3 public proxy chain | Dedicated Cloudflare Worker (no CORS)                         |
| API keys     | N/A (all free APIs)  | Worker-side env vars if needed                                |
| Secrets scan | GH Actions grep      | CodeQL + `gitleaks` in CI                                     |
| Dependencies | Zero                 | npm audit + Dependabot (Vite + Vitest only)                   |
| HTTPS        | GH Pages default     | Enforced via canonical                                        |
| SRI          | None                 | Auto-generated hashes in build                                |

## Performance Budget

| Metric           | Target             |
| ---------------- | ------------------ |
| LCP              | < 1.5s             |
| FID              | < 100ms            |
| CLS              | < 0.05             |
| Bundle (JS)      | < 60KB gzip        |
| Bundle (CSS)     | < 15KB gzip        |
| HTML shell       | < 5KB              |
| Service Worker   | < 10KB             |
| Lighthouse score | 95+ all categories |

## API Proxy Design (Cloudflare Workers)

```
Dashboard → https://api.familydashboard.workers.dev/
           ├── /api/weather?lat=X&lon=Y      → api.open-meteo.com
           ├── /api/stocks?symbols=AAPL,MSFT  → query1.finance.yahoo.com
           ├── /api/news                      → RSS feeds (server-parsed)
           ├── /api/currency                  → open.er-api.com + Yahoo
           ├── /api/calendar                  → hebcal.com + sefaria.org
           ├── /api/alerts                    → tzevaadom.co.il
           └── /api/health                    → Status of all upstreams
```

Benefits:

- **Zero CORS issues** — Worker fetches server-side
- **Response caching** — Cloudflare edge cache + Cache API
- **RSS pre-parsing** — return JSON instead of XML
- **Rate limiting** — protect upstream APIs
- **Health endpoint** — monitor all API upstreams
- **A/B proxy** — if one upstream fails, try alternatives
