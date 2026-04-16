# FamilyDashBoard — Roadmap

> Always-on family TV dashboard · Hebrew RTL · 1920×1080+ · TypeScript · Vite · Cloudflare Workers

![Roadmap timeline](.github/assets/roadmap.svg)

---

## Table of Contents

1. [Version History](#version-history)
2. [Strategic Analysis — What We Got Right](#strategic-analysis--what-we-got-right)
3. [Critical Assessment — What Needs Rethinking](#critical-assessment--what-needs-rethinking)
4. [v7.4 — Architecture Hardening](#v74--architecture-hardening) ✅ Released
5. [v7.5 — Worker-First Migration](#v75--worker-first-migration) ✅ Released
6. [v8.0 — Modern Frontend Rewrite](#v80--modern-frontend-rewrite)
7. [v8.1 — Data Layer & Persistence](#v81--data-layer--persistence)
8. [v8.2 — Observability & Reliability](#v82--observability--reliability)
9. [v9.0 — Multi-Device & Cloud Sync](#v90--multi-device--cloud-sync)
10. [Long-Term Vision](#long-term-vision)
11. [Decision Log](#decision-log)

---

## Version History

| Version   | Status     | Tests                      | Highlights |
| --------- | ---------- | -------------------------- | ---------- |
| v5.x      | ✅ Archived | 1084 Mocha / 61 suites     | Single-file HTML era (`BestDashBoard.html`) |
| v6.0      | ✅ Released | 510 Vitest / 29 suites     | Full TypeScript modular rewrite (Vite + TS) |
| v6.1      | ✅ Released | 574 Vitest / 30 suites     | Birthday chip, bookmarks, market badge, BG rotation |
| v6.2      | ✅ Released | 849 Vitest / 31 suites     | Portfolio, alerts, weather tabs, news search, 50+ features |
| v6.3–6.5  | ✅ Released | → 1240 Vitest / 33 suites  | Coverage sprints: cache 100%, base-card 100%, motivation 100% |
| v7.0      | ✅ Released | 1390 Vitest / 37 suites    | Card registry, tasks/system-info cards, CSS @layer, dialog migration, 6 themes |
| v7.1.x    | ✅ Released | → 1686 Vitest / 39 suites  | Countdown card, drag-drop layout, ticker speed, V/W/L/1/2/3 keys, unified CI |
| v7.2      | ✅ Released | 1706 Vitest / 39 suites    | Precipitation chip, alert volume, warm tint, reset-all, cache staleness, tasks quick-add, countdown 2nd event, news filter chips |
| **v7.3**  | ✅ Released | **1723 Vitest / 39 suites** | Diag clear, storage estimate, remove-done tasks, live theme preview, SW version chip, motivation auto-advance, person filter chips, RTT tile, dynamic help |
| **v7.4**  | ✅ Released | **1755 Vitest / 39 suites** | Coverage thresholds, Renovate, configVersion, migrateConfig, SW auto-version, isValidFontScale, worker SSRF allowlist, worker route split, sprints.css @layer, fetchWithRetry, network state tracker, ESLint strict rules |
| **v7.5**  | ✅ Released | **1850 Vitest / 45 suites** | Worker-first migration, Cloudflare Worker routes/middleware split, per-card CSS co-location, integration tests (config-save, sync-dots, cache-stale, theme-switch) |
| **v7.6**  | ✅ Released | **1850 Vitest / 45 suites** | Moon phase in weather, Daf Yomi/Halacha, Psalm of day, Zmanim grid, Next calendar event, bookmarks overlay, PWA install prompt, hebrew-cal full refactor |
| **v7.7**  | ✅ Released | **2027 Vitest / 47 suites** | Runtime API type guards, weather UX (humidity/moon/precip), countdown urgency, tasks priority/due-date, stocks sector emoji, news reading time/breaking detection, hebrew-cal utilities, system-info expansion, core utils (debounce/throttle/clamp/cacheStats) |

---

## Strategic Analysis — What We Got Right

These decisions were strong and should be *preserved and doubled down on*:

| Decision | Why It Works |
| -------- | ------------ |
| **Zero runtime dependencies** | No CDN outages, no supply-chain risk, sub-100 KB gzipped JS, instant load |
| **TypeScript strict mode** | Caught hundreds of bugs during the v5→v6 migration; `noUncheckedIndexedAccess` is especially valuable for API data |
| **Vitest + happy-dom** | 1723 tests in ~4 s; pool=forks isolates DOM state; coverage thresholds enforce discipline |
| **CSS @layer architecture** | Eliminated specificity wars; themes, components, and animations compose cleanly |
| **Vanilla CSS custom properties** | No preprocessor build step; theme switching is instant; 6 themes with zero duplication |
| **`cGet`/`cSet`/`cGetStale` dual-layer cache** | Graceful offline: memory → localStorage → SW cache. Stale-while-revalidate keeps the display warm even with network failures |
| **Proxy fallback chain** | 4-tier fetch (direct → allorigins → codetabs → corsproxy.io → Worker) gives ~99.9% data availability |
| **Card registry + lazy import** | Decoupled card lifecycle; new cards don't touch main.ts startup; tree-shaking works per-card |
| **`safeLoad()` + `Promise.allSettled`** | One failing card never takes down the whole dashboard |
| **SW offline fallback** | App shell pre-cache + API cache + offline HTML = the dashboard works without network |
| **Cloudflare Worker** | Routes are fast (edge-deployed), SSRF-hardened, and eliminate CORS entirely for production |
| **0-warning ESLint + markdownlint** | Enforced consistently; no `eslint-disable`, no `@ts-ignore`; CI gates guard quality |
| **Hebrew RTL-first design** | `dir=rtl` on `<html>`, logical CSS properties, RTL-aware flex — works correctly for the target audience |
| **`<dialog>` + `showModal()`** | Native accessibility (ESC close, focus trap, inert backdrop) for free |

---

## Critical Assessment — What Needs Rethinking

### 1. Frontend Architecture

| Issue | Current State | Impact | Recommendation |
| ----- | ------------- | ------ | -------------- |
| **HTML is static, not registry-driven** | 11 cards are hardcoded in `index.html`; registry exists but doesn't generate DOM | Dead `data-card-id` slots aren't auto-detected; adding/removing cards requires HTML edits | **v7.4**: registry renders card shells → HTML becomes a skeleton with `<div id="dashboard">` only |
| **No component abstraction** | Each card is a collection of exported functions + CSS; no encapsulation boundary | Style leaks between cards; hard to test card rendering in isolation | **v8.0**: adopt Web Components (native `<family-card>` custom element) or a lightweight reactive library (Lit, Preact) |
| **State scattered in module closures** | `_filterPerson`, `_pageVisible`, `_tempUnit` etc. are file-scoped `let` vars | State is invisible to DevTools; no event when state changes; tests must mock module internals | **v8.0**: centralize state in a reactive store (Signals or lightweight pub/sub) |
| **Config is a flat bag** | `DashboardConfig` has 40+ fields, growing every sprint | Hard to validate, hard to version-migrate, collides on cloud sync | **v8.1**: namespace config per card (`config.cards.weather.tempUnit`, `config.cards.stocks.hidden`) |
| **CSS files growing via `sprints.css`** | Sprint additions land in a catch-all file | Violates the @layer architecture; hard to attribute styles to features | **v7.4**: each card owns its CSS (already started with tasks/system-info/countdown); delete `sprints.css` |

### 2. Backend / Worker Architecture

| Issue | Current State | Impact | Recommendation |
| ----- | ------------- | ------ | -------------- |
| **Worker is a single 250-line file** | All routes in `index.ts`; `routes/` and `middleware/` dirs are empty | Hard to test; no rate limiting; no per-route caching strategy | **v7.5**: split into `routes/*.ts` + `middleware/*.ts`; add Vitest worker tests |
| **No input validation library** | Each handler does manual `parseInt`/regex; inconsistent error shapes | Security risk; DRY violation | **v7.5**: use `zod` for request validation (single dep, 13 KB) |
| **No Worker tests** | Zero test coverage for the Cloudflare Worker | Regressions are caught only in production | **v7.5**: add `vitest` suite for worker (miniflare env) |
| **News feed SSRF not fully locked** | `handleNews()` accepts any HTTPS URL — no origin allowlist | Could be used to probe internal HTTPS services | **v7.5**: add RSS origin allowlist (like `ALLOWED_CALENDAR_ORIGINS`) |
| **Client still has full proxy chain fallback** | Even with Worker, the client carries 3 CORS proxy URLs | Bloat; proxies are unreliable; security surface | **v8.0**: Worker-only fetch for production; proxy chain as dev-only fallback |

### 3. Data & API Layer

| Issue | Current State | Impact | Recommendation |
| ----- | ------------- | ------ | -------------- |
| **Yahoo Finance v8 is unofficial** | No API key; scraping `query1.finance.yahoo.com` | Breaks without warning; rate-limited; legally gray | **v7.5**: migrate to Yahoo Finance v2 with API key, or evaluate Twelve Data / Polygon.io / Alpha Vantage free tier |
| **CORS proxies are single points of failure** | allorigins, codetabs, corsproxy.io — all free, all unreliable | Proxies go down weekly; each outage triggers timeout cascades | **v7.5**: complete Worker migration so proxies are fallback-only; add health checks |
| **No API response schema validation** | Raw `as T` casts on all JSON responses | Malformed API data silently renders garbage in the UI | **v8.0**: validate API responses with `zod` schemas at the boundary; fall back to stale cache on schema mismatch |
| **localStorage is approaching its 5 MB limit** | ~40 keys + cache entries with 7-day eviction | On some Safari/iOS devices, `dash_v2_*` entries can exceed quota | **v8.1**: migrate cache to IndexedDB (via `idb-keyval`, 1 KB); keep `localStorage` for config only |
| **No API rate-limit tracking** | Exponential backoff exists in BestDashBoard.html but was lost in the v6 rewrite | Rapid failures can hammer APIs and get the IP banned | **v7.4**: restore `recordFailure()`/`recordSuccess()` backoff in `fetch.ts` |
| **Sefaria API has no fallback** | If Sefaria is down, halacha/daf/psalm are blank | Lost content with no cache fallback | **v7.4**: ensure `cGetStale()` is always checked; add static fallback quotes |

### 4. Testing & Quality

| Issue | Current State | Impact | Recommendation |
| ----- | ------------- | ------ | -------------- |
| **No integration tests** | `tests/integration/` dir exists but is empty | Card interactions (e.g., config panel ↔ theme ↔ cards) are untested end-to-end | **v8.0**: add Playwright component tests for critical flows |
| **No visual regression tests** | CSS changes are verified manually | Theme changes or layout shifts go undetected | **v8.2**: Playwright screenshot comparison for each theme |
| **Coverage thresholds are low** | 60% statements / 55% branches | Allows significant dead/untested code | **v7.4**: raise to 75%/70%/75%/75% (current actual coverage is likely higher) |
| **No mutation testing** | Tests pass but may not catch real bugs | False confidence in test quality | **v9.0**: evaluate Stryker.js for mutation testing on core modules |
| **Worker has zero tests** | Handlers are untested | Every Worker change is deployed blind | **v7.5**: add Miniflare-based test suite |

### 5. Build, Deploy & DevOps

| Issue | Current State | Impact | Recommendation |
| ----- | ------------- | ------ | -------------- |
| **Shared `MyScripts/node_modules`** | All deps installed at parent dir; no lockfile in project | CI uses `install-tools.sh` which is fragile; non-standard for contributors | **v8.0**: move to a proper monorepo tool (npm workspaces or Turborepo); each project gets its own lockfile |
| **No preview deployments** | Only `main` is deployed to GitHub Pages | PR changes can't be previewed visually | **v8.0**: add Cloudflare Pages preview deploys per PR |
| **SW version is manually synced** | `sw.js` version string updated by hand each release | Easy to forget; stale SW version in production | **v7.4**: generate SW version from `package.json` at build time (Vite define plugin) |
| **No Lighthouse CI** | Performance/accessibility not tracked over time | Regressions in LCP/CLS/a11y go unnoticed | **v8.2**: add Lighthouse CI to the CI pipeline with budgets |
| **No dependency update automation** | No Dependabot or Renovate configured | Deps grow stale silently | **v7.4**: add Renovate config for automated PRs |

### 6. Documentation

| Issue | Current State | Impact | Recommendation |
| ----- | ------------- | ------ | -------------- |
| **ARCHITECTURE.md says "v6.5 / v7.0-alpha"** | Outdated header; doesn't cover v7.3 features | Misleading for contributors | **v7.4**: update to v7.3; add Worker architecture section |
| **No API documentation** | Worker routes are documented only in code comments | No external reference for the API contract | **v7.5**: add OpenAPI spec or `worker/README.md` with request/response examples |
| **Too many instruction files** | 4 `.instructions.md` + `copilot-instructions.md` + `CLAUDE.md` + skills overlap | Contradictions between files; maintenance burden | **v7.4**: consolidate into 2 files: `CONTRIBUTING.md` (human) + `copilot-instructions.md` (AI) |
| **Inventory file is v5-era** | `/memories/repo/fdb-complete-inventory.md` still references `BestDashBoard.html` | AI agents get confused about current architecture | **v7.4**: update or archive; point to `ARCHITECTURE.md` |

---

## v7.4 — Architecture Hardening

> Focus: clean up debt, raise quality gates, prepare for the Worker-first migration.

### Code Quality

- [x] **Registry-driven HTML**: card-registry.ts wires cards dynamically; static shells remain in `index.html` for HTML contract tests.
- [x] **Delete `sprints.css`**: per-card CSS co-located in each card’s own `.css` file. `sprints.css` retained only for cross-cutting global styles (season tints, header chips, overlay primitives).
- [x] **Restore exponential backoff**: `fetchWithRetry()` + `recordFetchSuccess/Failure()` in `fetch.ts`. Applied via `fetchJSON` wrapper.
- [x] **Stale fallback for all APIs**: `fetchWithStale()` pattern + `cGetStale()` fallback in all card loaders; static fallback data for Sefaria (motivation quotes, daf placeholder).
- [x] **Raise coverage thresholds**: statements 75%, branches 70%, functions 75%, lines 75% — enforced in `vitest.config.ts`.

### Build & Config

- [x] **Auto-generate SW version**: `__APP_VERSION__` injected from `package.json` via `vite.config.ts` `define` plugin; `sw.js` reads `__APP_VERSION__` at install time.
- [x] **Add Renovate**: `.github/renovate.json5` configured for automated dependency update PRs.
- [x] **ESLint strict plugin additions**: `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises` enabled in `eslint.config.mjs`.

### Documentation

- [x] **Update ARCHITECTURE.md to v7.7**: updated with Worker architecture, CSS co-location guide, key invariants, fetch chain diagram.
- [x] **Consolidate AI instructions**: `copilot-instructions.md` is primary AI source of truth; `workspace.instructions.md` / `CLAUDE.md` provide additive context.
- [x] **Create CONTRIBUTING.md**: complete guide at `CONTRIBUTING.md` (setup, testing, code style, PR workflow).

---

## v7.5 — Worker-First Migration

> Focus: harden the Cloudflare Worker; make it the primary data path; add API validation.

### Worker Refactor

- [x] **Split `worker/src/index.ts`**: extracted into `worker/src/routes/data.ts` (weather, currency, hebcal) and `feeds.ts` (stocks, news, alerts, calendar, sefaria). Shared helpers in `worker/src/utils/`.
- [x] **Add middleware layer**: `worker/src/middleware/` directory with rate-limit, CORS, and cache-control middleware.
- [ ] **Add request validation**: `zod` for query param validation — deferred (adds external dep; manual validation is in place).
- [x] **News feed SSRF lockdown**: `ALLOWED_NEWS_ORIGINS` allowlist added in `worker/src/utils/allowlists.ts`. Unknown origins rejected with 403.
- [x] **Worker test suite**: `worker/src/` covered by unit tests via Vitest; routes tested with mock `Request` objects.
- [ ] **OpenAPI spec**: `worker/openapi.yaml` — deferred to v8.0 tooling sprint.

### Stock API Migration

- [ ] **Evaluate alternatives**: Yahoo Finance v8 remains primary (no key needed, reliable enough); formal evaluation of Twelve Data / Polygon.io deferred to v8.0.
- [ ] **Decision**: Yahoo Finance + Worker SSRF guard is current strategy.
- [ ] **API key management**: not required with current Yahoo Finance approach.

### Client Migration

- [x] **Worker-first for all cards**: `fetchViaWorker()` called first when `isWorkerEnabled()`; proxy chain is fallback-only. Full chain documented in `ARCHITECTURE.md`.
- [x] **Build-time flag `__USE_PROXIES__`**: injected via `vite.config.ts` `define`; production build with Worker enabled skips proxy chain.

---

## v8.0 — Modern Frontend Rewrite

> Focus: proper component model, reactive state, type-safe API boundary, modern tooling.

### Component Architecture

- [ ] **Evaluate: Web Components vs Lit vs Preact**
  - **Web Components (native)**: zero deps, works today, Shadow DOM isolates card styles. Downside: verbose, no reactive templating.
  - **Lit** (5 KB gzipped): thin layer over Web Components, reactive properties, fast templates. Recommended if we stay "close to the platform."
  - **Preact** (4 KB gzipped): JSX/TSX, hooks, familiar React mental model. Better ecosystem. Recommended if we want faster iteration speed.
  - **Decision criteria**: bundle size (must stay under 100 KB gzipped), RTL support, test ergonomics.
- [ ] **Implement card base class**: whether native CE or Lit, each card becomes `<fdb-weather>`, `<fdb-news>`, etc. with lifecycle hooks (`connectedCallback`, `disconnectedCallback`).
- [ ] **Scoped card CSS**: each card's CSS is co-located and scoped (Shadow DOM or CSS modules via Vite plugin).

### Reactive State

- [ ] **Centralized store**: implement a Signals-based store (TC39 proposal, or Preact signals — 1.5 KB).
  - `state.config` — user configuration (persisted)
  - `state.cache` — API data cache (ephemeral)
  - `state.ui` — transient UI state (theme, overlay, maximize)
- [ ] **Config namespaced per card**: `config.cards.weather = { tempUnit, cities, ... }`. Migration function auto-converts flat config to namespaced on first load.
- [ ] **Reactive UI updates**: cards subscribe to their slice of state; no manual DOM updates via `textContent` assignment. The reactive layer diffs and patches.

### API Boundary

- [ ] **Zod schemas for all API responses**: `src/types/schemas/{weather,stocks,news,...}.ts`. Each schema validates at the fetch boundary. Invalid data → stale cache fallback.
- [ ] **Generated TypeScript types from schemas**: `z.infer<typeof WeatherSchema>` replaces hand-written `api.ts` interfaces.

### Tooling

- [ ] **Monorepo migration**: npm workspaces with `packages/dashboard` + `packages/worker` + `packages/shared`. Each package has its own `package.json` and lockfile.
- [ ] **E2E tests**: Playwright for critical user flows (theme switch, config save, card maximize, keyboard shortcuts).
- [ ] **Preview deployments**: Cloudflare Pages for PR previews; GitHub Actions publishes preview URL as PR comment.

---

## v8.1 — Data Layer & Persistence

> Focus: robust offline-first data layer, cloud-ready persistence.

### IndexedDB Migration

- [ ] **Replace localStorage cache with IndexedDB**: use `idb-keyval` (1 KB) for the `dash_v2_*` cache. Benefits: no 5 MB limit, structured clone (stores objects directly), async API.
- [ ] **Keep localStorage for config only**: `DashboardConfig` stays in localStorage (small, sync access needed on startup).
- [ ] **Migration path**: on first load, copy all `dash_v2_*` from localStorage to IndexedDB, then delete from localStorage.

### Config Versioning

- [ ] **Add `configVersion` field**: `DashboardConfig.version = 3`. On load, run migration functions (`migrateV1toV2`, `migrateV2toV3`) to transform old config shapes.
- [ ] **Per-card config namespace**: `config.cards = { weather: {...}, stocks: {...}, ... }`. Flat fields become namespaced. Old flat keys are auto-migrated.
- [ ] **JSON Schema validation**: validate config on load; reject corrupt data and reset to defaults with a toast.

### Service Worker Rewrite

- [ ] **Convert `sw.js` to TypeScript**: `src/sw.ts` compiled by Vite's `worker` option. Imports constants and version from shared code.
- [ ] **Workbox**: evaluate replacing hand-written SW with Workbox (code-generated strategies). Benefits: precache manifest auto-generated, stale-while-revalidate built-in, cache expiration policies.
- [ ] **Background sync**: queue failed API writes (e.g., config sync) for retry when online.

---

## v8.2 — Observability & Reliability

> Focus: know when things break before users notice; measure performance continuously.

### Error Reporting

- [ ] **Client error reporting**: integrate a lightweight error tracker (Sentry free tier — 10K events/month, or self-hosted GlitchTip). Capture unhandled rejections, fetch failures, and `diagLog()` errors.
- [ ] **Worker error reporting**: Cloudflare Workers analytics + Sentry for server-side errors.

### Performance Monitoring

- [ ] **Lighthouse CI**: add `lhci` to GitHub Actions. Set budgets: LCP < 2.5s, CLS < 0.1, TBT < 200ms, accessibility 95+.
- [ ] **Web Vitals tracking**: add `web-vitals` (1.5 KB) to report CLS, LCP, FID/INP to the diagnostics overlay.
- [ ] **Bundle size tracking**: CI reports bundle size diff on every PR; fail if JS gzipped > 100 KB or CSS gzipped > 25 KB.

### Visual Regression

- [ ] **Playwright screenshot tests**: capture each theme × normal/compact/cinema screen mode = 18 screenshots. Run on CI; fail on pixel diff > 0.1%.
- [ ] **Theme contrast checker**: automated WCAG contrast ratio check for all 6 themes using `color-contrast()` or a CI script.

### Health Dashboard

- [ ] **Status page**: simple self-hosted status page (Upptime or Gatus) monitoring Worker health, GitHub Pages, and upstream APIs (Hebcal, Open-Meteo, etc.).
- [ ] **Alerting**: PagerDuty/email/Telegram alert when critical APIs are down for > 5 min.

---

## v9.0 — Multi-Device & Cloud Sync

> Focus: use the dashboard on multiple screens with shared configuration and state.

### Cloud Sync via Cloudflare KV

- [ ] **Device ID**: generate a UUID per device; store in `localStorage dash_device_id`.
- [ ] **Family ID**: shared family code entered once in config; stored in Worker KV as the partition key.
- [ ] **Sync protocol**: on config save → `PUT /api/sync/:familyId` with JSON payload; Worker writes to KV. On load → `GET /api/sync/:familyId` returns latest config. Conflict resolution: last-write-wins with timestamp.
- [ ] **Selective sync**: sync config + card layout + hidden cards. Do NOT sync cache or transient UI state.

### Multi-User Profiles

- [ ] **Profile switcher**: header shows current family member name; dropdown to switch profiles.
- [ ] **Per-profile config**: each member can have different hidden cards, theme, font scale. Stored as `config.profiles[memberName]`.
- [ ] **Profile-aware tasks**: task completion state is per-person; filter chips use the active profile.

### Multi-Display

- [ ] **Screen roles**: configure each device as "kitchen display" (weather + calendar), "living room" (full), "bedroom" (minimal + dimmer). Roles map to card visibility presets.
- [ ] **WebSocket real-time sync**: Worker uses Durable Objects for real-time config push. When one device changes theme, all devices update instantly.

---

## Long-Term Vision

### v10.0 — Voice & Accessibility

- [ ] **Voice control**: Web Speech API for Hebrew ("מה מזג האוויר?", "הצג חדשות").
- [ ] **Screen reader full support**: ARIA live regions for updating data, landmark roles, skip-to-content.
- [ ] **High-contrast mode**: 7th theme designed for low-vision users (WCAG AAA contrast).
- [ ] **Touch gestures**: swipe between screen modes on tablet; pinch to zoom cards.

### v10.1 — Smart Integrations

- [ ] **Home Assistant integration**: card showing entity states (lights, sensors, cameras) via HA WebSocket API.
- [ ] **Shelly / Tuya / Sonoff**: direct device control tiles for smart switches.
- [ ] **Waze traffic tile**: commute time from home to work via Waze API.
- [ ] **Package tracking**: 17track or AfterShip API integration for delivery status.
- [ ] **Grocery list**: shared family grocery list with completion sync.

### v10.2 — AI Enhancements

- [ ] **Daily briefing**: AI-generated Hebrew morning summary combining weather, calendar, news highlights, and Hebrew calendar events.
- [ ] **Smart notifications**: ML model predicts which alerts/news are important based on user interaction history.
- [ ] **Photo memories**: Google Photos API or local NAS integration showing "this day N years ago" photos.

---

## Decision Log

Key architectural decisions and their rationale, for future reference.

| # | Date | Decision | Alternatives Considered | Rationale |
| - | ---- | -------- | ----------------------- | --------- |
| D1 | 2026-04 | TypeScript + Vite (no framework) | React, Vue, Svelte, Angular | Zero-dep constraint; Vite gives fast dev + optimal bundle; TS catches bugs at compile time. Framework overhead unjustified for a read-heavy dashboard. |
| D2 | 2026-04 | Vitest + happy-dom (not jsdom) | Jest, Mocha, jsdom | Vite-native; happy-dom is 2–3× faster than jsdom; pool=forks prevents DOM leakage. |
| D3 | 2026-04 | Vanilla CSS + @layer (no Tailwind/Sass) | Tailwind, Sass, CSS-in-JS, styled-components | Zero build overhead; @layer ordering is more maintainable than BEM cascades; CSS custom properties give theme switching for free. |
| D4 | 2026-04 | Cloudflare Workers (not Vercel/Netlify Functions) | Vercel, Netlify, AWS Lambda, self-hosted | 100K req/day free; edge-deployed = low latency; Wrangler CLI is excellent; KV for future sync. |
| D5 | 2026-04 | PWA + SW (not Electron/Tauri) | Electron, Tauri, native app | Dashboard runs in a browser tab on a TV/Raspberry Pi; PWA gives offline + installable without app store distribution. |
| D6 | 2026-04 | localStorage + in-memory Map (not IndexedDB) | IndexedDB, SQLite via wasm | Simple, synchronous, sufficient for config + short-lived cache. **Revisit in v8.1** when cache exceeds 5 MB. |
| D7 | 2026-04 | No auth / static-only | Firebase Auth, Auth0, Clerk | This is a local family display with no user accounts and no sensitive write operations. Auth adds complexity with zero value. **Revisit in v9.0** if cloud sync requires identity. |
| D8 | 2026-04 | Hebrew RTL-first | i18n library (i18next), multi-language | Target audience is Hebrew-speaking Israeli families. Adding i18n infrastructure for one language is wasted complexity. **Revisit** only if international users become a real audience. |
| D9 | TBD | Component model (Web Components vs Lit vs Preact) | Stay vanilla | **Pending v8.0 evaluation**. Current vanilla approach works but doesn't scale well for card isolation and reactive updates. |
| D10 | TBD | Stock data provider | Yahoo Finance (current), Twelve Data, Polygon.io, Alpha Vantage | **Pending v7.5 evaluation**. Yahoo Finance v8 is unofficial and brittle. Need a provider with: free tier ≥ 15 symbols, official API, JSON response, reasonable rate limits. |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) (planned for v7.4) for setup, development workflow, and PR guidelines.

Run the full quality gate before every PR:

```bash
npm run check    # typecheck + lint + markdownlint + vitest
```

---

<!-- Last updated: v7.7.0 — April 2026 -->

- Multi-user profiles (family members, each with own config)
- Cloudflare KV sync (sync config across devices)
- Push notifications via Web Push API + Service Worker
- Offline-first data pre-seeding via SW install event
- Card templates marketplace (community-submitted card definitions)

---

## Design Principles

| Principle | Rule |
| --------- | ---- |
| Zero dependencies | No external JS/CSS libraries or CDNs at runtime |
| Hebrew RTL | Always `dir="rtl"` in HTML; CSS logical properties where possible |
| TV-first | 1920×1080 primary; readable from 3 m; no hover-only affordances |
| Cache everything | Dual-layer (memory + localStorage); stale-while-revalidate |
| 0 lint errors | `npx eslint src tests --max-warnings 0` must pass on every commit |
| 0 TS errors | `npx tsc --noEmit` must pass on every commit |
| No suppressions | Zero `eslint-disable` / `@ts-ignore` / `@ts-expect-error` allowed |
