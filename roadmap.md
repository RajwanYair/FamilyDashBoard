# FamilyDashBoard — Roadmap

> Always-on family TV dashboard · Hebrew RTL · 1920×1080+ · TypeScript · Vite · Cloudflare Workers

![Roadmap timeline](.github/assets/roadmap.svg)

---

## Table of Contents

1. [Version History](#version-history)
2. [Strategic Analysis — What We Got Right](#strategic-analysis--what-we-got-right)
3. [Critical Reassessment — What Needs Rethinking](#critical-reassessment--what-needs-rethinking)
4. [Released Milestones](#released-milestones) (v7.4–v7.9)
5. [v7.10 — Quality Gate & Technical Debt](#v710--quality-gate--technical-debt)
6. [v8.0 — Component Architecture & Reactive State](#v80--component-architecture--reactive-state)
7. [v8.1 — Data Layer & Offline-First Persistence](#v81--data-layer--offline-first-persistence)
8. [v8.2 — Observability, Performance & Visual QA](#v82--observability-performance--visual-qa)
9. [v9.0 — Multi-Device & Cloud Sync](#v90--multi-device--cloud-sync)
10. [v10.0 — Smart Integrations & Accessibility](#v100--smart-integrations--accessibility)
11. [Long-Term Vision](#long-term-vision)
12. [Decision Log](#decision-log)
13. [Design Principles](#design-principles)

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
| v7.3      | ✅ Released | 1723 Vitest / 39 suites    | Diag clear, storage estimate, remove-done tasks, live theme preview, SW version chip, motivation auto-advance, person filter chips, RTT tile, dynamic help |
| v7.4      | ✅ Released | 1755 Vitest / 39 suites    | Coverage thresholds, Renovate, configVersion, migrateConfig, SW auto-version, isValidFontScale, worker SSRF allowlist, worker route split, fetchWithRetry, network state tracker |
| v7.5      | ✅ Released | 1850 Vitest / 45 suites    | Worker-first migration, Cloudflare Worker routes/middleware split, per-card CSS co-location, integration tests |
| v7.6      | ✅ Released | 1850 Vitest / 45 suites    | Moon phase, Daf Yomi/Halacha, Psalm of day, Zmanim grid, bookmarks overlay, PWA install prompt, hebrew-cal refactor |
| v7.7      | ✅ Released | 2027 Vitest / 47 suites    | Runtime API type guards, weather UX, countdown urgency, tasks priority/due-date, stocks sector emoji, hebrew-cal utils, core utils (debounce/throttle/clamp) |
| v7.8      | ✅ Released | 2056 Vitest / 47 suites    | Architecture doc update, CSS co-location for UI, config v2 schema, fetch resilience (dedup/network quality), ARIA accessibility, night dim schedule |
| **v7.9**  | ✅ Released | **2182 Vitest / 51 suites** | Error tracking, web vitals, config v3 per-card settings, IndexedDB cache tier, SW TypeScript types, ARIA tab keyboard nav, weather hourly strip, tasks enhancements, news/stocks enhancements |
| **v7.10** | ✅ Released | **2264 Vitest / 53 suites** | IDB LRU eviction (50 MB cap), IDB size in diagnostics, ReactiveState store (EventTarget pub/sub), Config v4 namespaced per-card CardConfig, Worker POST /api/errors telemetry, error-reporter.ts client, __USE_PROXIES__ production gate, Worker CI gate, ARCHITECTURE.md v7.10 |

---

## Strategic Analysis — What We Got Right

These decisions were strong and should be **preserved and doubled down on**:

| Decision | Why It Works | Confidence |
| -------- | ------------ | ---------- |
| **Zero runtime dependencies** | No CDN outages, no supply-chain risk, sub-100 KB gzipped JS, instant load. Eliminates an entire class of security vulnerabilities (npm supply chain). | 🟢 Keep |
| **TypeScript strict mode** | Caught hundreds of bugs during the v5→v6 migration. `noUncheckedIndexedAccess` is especially valuable for API data. `verbatimModuleSyntax` ensures clean import hygiene. | 🟢 Keep |
| **Vitest + happy-dom** | 2182 tests in ~4 s; `pool=forks` isolates DOM state. Vite-native means zero config overhead. Coverage thresholds (75/70/75/75) enforce discipline. | 🟢 Keep |
| **CSS @layer architecture** | Eliminated specificity wars. Themes, components, and animations compose cleanly. `color-mix()` tokens reduce duplication to near-zero. | 🟢 Keep |
| **Vanilla CSS custom properties** | No preprocessor build step; theme switching is instant; 6 themes with zero duplication. Container queries give per-card responsive behavior. | 🟢 Keep |
| **`cGet`/`cSet`/`cGetStale` dual-layer cache** | Graceful offline: memory → localStorage → SW cache. Stale-while-revalidate keeps the display warm. Cache stats (v7.8) give diagnostic visibility. | 🟢 Keep + extend to IDB |
| **Proxy fallback chain** | 4-tier fetch (direct → allorigins → codetabs → corsproxy.io → Worker) gives ~99.9% data availability. `fetchWithRetry()` adds exponential backoff (v7.4). | 🟡 Keep but simplify — Worker should be primary, proxies dev-only |
| **Card registry + lazy import** | Decoupled card lifecycle; new cards don't touch `main.ts` startup; tree-shaking works per-card. `createCardLoader()` standardizes lifecycle. | 🟢 Keep — evolve to Web Components |
| **`safeLoad()` + `Promise.allSettled`** | One failing card never takes down the whole dashboard. Combined with `fetchWithStale()`, the UI is never empty. | 🟢 Keep |
| **SW offline fallback** | App shell pre-cache + API cache + offline HTML fallback = dashboard works without network. `VERSION_ACTIVATED` broadcast keeps UI in sync. | 🟡 Keep — rewrite in TypeScript |
| **Cloudflare Worker** | Edge-deployed, SSRF-hardened, 100K req/day free. Eliminates CORS entirely. Rate limiting (120/min) + allowlists provide security. | 🟢 Keep + evolve (KV, Durable Objects) |
| **0-warning ESLint + markdownlint** | Enforced consistently; no `eslint-disable`, no `@ts-ignore`; CI gates guard quality. Flat config (v10) is maintainable. | 🟢 Keep |
| **Hebrew RTL-first design** | `dir=rtl` on `<html>`, logical CSS properties, RTL-aware flex. Serves the target audience without i18n overhead. | 🟢 Keep |
| **`<dialog>` + `showModal()`** | Native accessibility (ESC close, focus trap, inert backdrop) for free. Every overlay uses this consistently. | 🟢 Keep |
| **Config versioned migration** | Forward-compatible: v0→v1→v2→v3 migration chain runs automatically. `sanitize()` + type guards protect against corruption. | 🟢 Keep — namespace per card |
| **Per-card CSS co-location** (v7.5+) | Each card/UI component imports its own `.css` file. Eliminates the monolithic `sprints.css` anti-pattern. | 🟢 Keep — evolve to scoped styles |
| **`fetchJSONDeduped()`** (v7.8) | Promise-based coalescing prevents duplicate concurrent requests. Simple, zero-dep implementation. | 🟢 Keep |

---

## Critical Reassessment — What Needs Rethinking

> This section re-evaluates **every major architectural decision** — even ones that seemed clean.

### 1. Frontend Architecture

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **No component encapsulation** | Each card = exported functions + CSS. No Shadow DOM, no style scoping, no lifecycle boundary | Style leaks are theoretically possible; card testing requires mocking module internals; no way to render a card in isolation | 🟡 Medium | **v8.0**: Adopt native Web Components (`<fdb-weather>`, `<fdb-news>`, etc.). Shadow DOM scopes CSS per card. `connectedCallback`/`disconnectedCallback` replace manual init/cleanup. **No library needed** — vanilla `HTMLElement` subclass fits the zero-dep constraint. |
| **State scattered in module closures** | `_filterPerson`, `_pageVisible`, `_tempUnit`, etc. are file-scoped `let` vars invisible to DevTools | State changes are invisible; no reactive update mechanism; tests must import internal symbols | 🟡 Medium | **v8.0**: Centralize in a reactive store. **Recommendation: vanilla `EventTarget`-based pub/sub** (zero-dep, ~50 lines). Each card subscribes to its slice. Signals are appealing but add a dependency — revisit when TC39 Signals proposal ships natively. |
| **HTML is static, not registry-driven** | 11 cards hardcoded in `index.html`; registry exists but doesn't generate DOM | Adding/removing cards requires HTML edits; dead `data-card-id` slots aren't auto-detected | 🟡 Medium | **v8.0**: `card-registry.ts` renders card shells dynamically. `index.html` becomes a skeleton with only `<div id="dashboard">` + header/footer. |
| **Config is a flat bag** | `DashboardConfig` has 50+ fields, growing every sprint | Hard to validate holistically, hard to version-migrate, card settings bleed across concerns | 🟡 Medium | **v8.1**: Namespace per card: `config.cards.weather.tempUnit`, `config.cards.stocks.hidden`. Flat fields auto-migrated via `migrateV3toV4()`. |
| **Monolithic `main.ts` init** | All card inits run in parallel with `Promise.allSettled`. No cancellation, no priority, no progressive loading | On slow networks, all 11 cards compete for bandwidth. Visible-first would improve perceived performance | 🟢 Low | **v8.0**: Priority-based init — visible cards first (above fold), then hidden/collapsed. `IntersectionObserver` gates deferred cards. |
| **No request prioritization** | All fetches enter the same `runConcurrent(4)` pool | Weather and news (user-visible) compete with system-info and motivation (low priority) | 🟢 Low | **v8.0**: Priority queue for fetch pool — `"high"` (weather, news, alerts), `"normal"` (stocks, calendar), `"low"` (motivation, system-info). |

### 2. Backend / Worker Architecture

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **Rate limiting is per-isolate** | In-memory `Map` resets per Cloudflare Worker instance | Scaling defeats rate limiting; coordinated abuse splits across isolates | 🟡 Medium | **v8.1**: Migrate to Cloudflare KV-backed rate limiting (read-after-write consistency is acceptable for rate limits). Or use Durable Objects if real-time accuracy matters. |
| **No request validation library** | Each route handler does manual `parseInt`/regex; inconsistent error shapes | DRY violation; some edge cases (NaN, empty string) not caught | 🟡 Medium | **v8.0**: Add `zod` (13 KB) for request validation. Single dependency, massive type safety gains. Generates TypeScript types from schemas. **Decision: accept this one dependency** — the security/reliability benefit outweighs the zero-dep purity for the Worker (which is separate from the client). |
| **No persistent caching strategy** | Worker proxies to upstream APIs on every request; only Cloudflare's default edge cache (5 min TTL) applies | Unnecessary upstream load; API rate limits consumed faster than needed | 🟡 Medium | **v8.1**: Add Cloudflare KV as a server-side cache. Weather cached 15 min, currency 1 h, Hebcal 6 h. Client gets instant responses from KV even if upstream is down. |
| **SSRF allowlists are hardcoded** | `ALLOWED_NEWS_ORIGINS` and `ALLOWED_CALENDAR_ORIGINS` are const arrays in source | Adding a news source requires a Worker redeploy | 🟢 Low | **v9.0**: Store allowlists in KV; update via admin API. Not urgent — news sources change rarely. |
| **Worker not tested in CI** | Unit tests exist locally but aren't in the GitHub Actions pipeline | Worker regressions deployed without CI gate | 🟡 Medium | **v7.10**: Add Worker test step to `ci.yml` — `cd worker && npx vitest run`. |

### 3. Data, APIs & External Sources

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **Yahoo Finance v8 is unofficial** | Scraping `query1.finance.yahoo.com/v8/finance/chart` — no API key, no SLA, legally gray | Breaks without warning; rate-limited; could be blocked permanently | 🔴 High | **v8.0**: **Primary recommendation: Yahoo Finance v8 through Worker proxy** (current approach, with aggressive caching). **Backup plan**: Evaluate [Twelve Data](https://twelvedata.com/) free tier (800 req/day, 8 symbols) or [Financial Modeling Prep](https://site.financialmodelingprep.com/) (250 req/day). **Decision**: Yahoo Finance via Worker with 15-min KV cache reduces requests to ~96/day for 15 symbols — well within tolerance. Keep proxy as primary; add FMP as automatic fallback. |
| **CORS proxies still shipped in client** | 3 hardcoded proxies (allorigins, codetabs, corsproxy.io) + custom proxy slot | Proxies are unreliable (weekly outages), security surface, bloat (~1 KB of URLs) | 🟡 Medium | **v8.0**: Production build (`__USE_PROXIES__ = false`) removes proxy chain entirely. Worker is sole data path. Proxies retained only for `file://` local development. |
| **No API response schema validation** | Raw `as T` casts on all JSON responses; type guards exist for 4 APIs but not all | Malformed API data silently renders garbage; `undefined` runtime crashes | 🟡 Medium | **v8.0**: Zod schemas at the fetch boundary for all 11 data sources. Invalid data → log error + fall back to `cGetStale()`. Generate TypeScript types with `z.infer<>` — eliminate hand-written `api.ts` interfaces. |
| **Open-Meteo has no paid fallback** | Single free API; no backup weather provider | If Open-Meteo goes down, weather card is blank (stale cache helps but only for hours) | 🟢 Low | **v9.0**: Add [OpenWeatherMap](https://openweathermap.org/api) free tier (1000 req/day) as automatic fallback if Open-Meteo returns 5xx. Not urgent — Open-Meteo has excellent uptime. |
| **Sefaria API has no fallback** | If Sefaria is down, halacha/daf/psalm tiles are blank | Lost content; no static fallback beyond `cGetStale()` | 🟢 Low | **Already mitigated** (v7.4): `fetchWithStale()` + static fallback quotes. Sufficient for now. |
| **17 RSS feeds are fetched individually** | Each RSS feed is a separate HTTP request, all via Worker | 17 concurrent requests on each 5-min refresh cycle. Worker handles it but it's chatty | 🟢 Low | **v8.1**: Batch endpoint — Worker aggregates all RSS feeds into one response. Client makes 1 request instead of 17. Reduces client complexity and network overhead. |
| **Currency API has limited history** | ER-API returns only current rates; 7-day sparkline is built client-side from localStorage history | Losing localStorage (cache clear, new device) loses sparkline history | 🟢 Low | **v8.1**: Store currency history in IDB (persists across cache clears). Or add a Worker endpoint that queries historical rates from a free provider. |

### 4. Cache & Storage

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **localStorage approaching 5 MB limit** | ~40 keys + cache entries with 7-day eviction. Heavy cards (news, stocks) store large payloads | On some browsers (Safari/iOS), `dash_v2_*` entries can exceed quota, causing silent write failures | 🟡 Medium | **v8.1**: Promote `idb-cache.ts` (Sprint 43) to primary cache tier. Move all `dash_v2_*` data to IndexedDB. Keep `localStorage` only for config (~2 KB) + small flags. Migration: first load copies LS→IDB, then deletes LS cache keys. |
| **IDB cache tier exists but isn't wired in** | `idb-cache.ts` has full CRUD API but `cGet`/`cSet` still use localStorage | The IndexedDB investment (Sprint 43) provides no value until the cache layer is integrated | 🟡 Medium | **v7.10**: Wire `idbGet`/`idbSet` into `cGet`/`cSet` as L2 (between memory and localStorage). Priority: memory → IDB → localStorage. Graceful degradation if IDB unavailable. |
| **No cache invalidation signals** | Caches expire only via TTL or manual `cEvict()` | If an API response changes immediately (e.g., breaking alert), stale data shows for up to TTL duration | 🟢 Low | **v9.0**: SW-mediated cache invalidation — Worker broadcasts `CACHE_INVALIDATE(key)` when it detects data changes. Cards react by re-fetching immediately. |
| **Cache key collisions with legacy dashboard** | Both `BestDashBoard.html` and the modular app use `dash_v2_*` prefix | Running both in the same browser creates cache corruption | 🟢 Low | Accepted risk — legacy dashboard is archived and unlikely to be used simultaneously. |

### 5. Service Worker

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **SW is plain JavaScript** | `sw.js` is 180 lines of vanilla JS; not type-checked, not bundled by Vite | Bugs can't be caught at compile time; no shared constants with main app (only `__APP_VERSION__` injected) | 🟡 Medium | **v8.1**: Convert to `src/sw.ts`. Compile with Vite's `worker` plugin. Import `sw-constants.ts` directly instead of duplicating. Type-check in CI alongside main app. |
| **No cache size limits** | API cache grows unbounded; only version change triggers full wipe | Long-running devices (always-on TV) accumulate months of stale API responses | 🟡 Medium | **v8.1**: Add cache size limit (50 MB). Implement LRU eviction — when cache exceeds limit, delete oldest entries. |
| **APP_SHELL still references BestDashBoard.html** | Pre-cache list includes legacy single-file dashboard | Unnecessary bytes in SW cache; confusing for new contributors | 🟢 Low | **v7.10**: Remove `BestDashBoard.html` from APP_SHELL. Add all `dist/assets/*.js` and `dist/assets/*.css` instead. |
| **No background sync** | SW has no `sync` event handler; failed writes (config export to URL) can't retry | Low impact today (no write operations), but blocks cloud sync in v9.0 | 🟢 Low | **v9.0**: Add `BackgroundSyncManager` for config sync writes. |

### 6. Testing & Quality

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **No E2E tests** | `tests/integration/` has 4 lightweight integration tests; no browser-level E2E | Card interactions (config panel ↔ theme ↔ cards), keyboard shortcuts, drag-drop are untested in a real browser | 🟡 Medium | **v8.2**: Playwright tests for 10 critical flows: theme switch, config save/load, card maximize, keyboard shortcuts, night dimmer toggle, drag-drop, alert toggle, PWA install, offline mode, print mode. |
| **No visual regression tests** | CSS changes verified manually | Theme changes or layout shifts go undetected across 6 themes × 3 screen modes = 18 visual states | 🟡 Medium | **v8.2**: Playwright screenshot comparison for each theme × screen mode. CI fails on pixel diff > 0.5%. |
| **Coverage thresholds could be higher** | 75% statements / 70% branches / 75% functions / 75% lines | Allows ~25% untested code. Actual coverage is likely 80%+ — thresholds should track reality | 🟢 Low | **v7.10**: Raise to 80/75/80/80. Run coverage report to determine actual numbers and set thresholds 2–3% below actual. |
| **No mutation testing** | Tests pass but may not catch real logic bugs (e.g., off-by-one in TTL check) | False confidence in test effectiveness | 🟢 Low | **v9.0**: Evaluate Stryker.js for mutation testing on `src/core/` modules (cache, fetch, config). Target 70% mutation score. |
| **Worker tests not in CI** | Worker tests exist locally but aren't gated in GitHub Actions | Regressions can be deployed to production without test verification | 🟡 Medium | **v7.10**: Add `worker-test` job to `ci.yml`. |

### 7. Build, Deploy & DevOps

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **Shared `MyScripts/node_modules`** | All deps installed at parent dir; no lockfile in project. CI uses `install-tools.sh` | Non-standard for contributors; `npm ci` doesn't work in isolation; Renovate can't update deps properly | 🟡 Medium | **v8.0**: Migrate to **npm workspaces** monorepo. `MyScripts/package.json` declares `"workspaces": ["FamilyDashBoard", "FamilyDashBoard/worker"]`. Each project gets its own `package.json` with `devDependencies`. Shared lockfile at root. **Why not Turborepo/Nx?** Overkill for 2 packages. npm workspaces is zero-dep and standard. |
| **No preview deployments** | Only `main` branch deployed to GitHub Pages | PR changes can't be previewed visually before merge | 🟡 Medium | **v8.2**: Cloudflare Pages for PR preview deploys. GitHub Actions posts preview URL as PR comment. Free tier is sufficient. |
| **No Lighthouse CI budgets** | Performance/accessibility not tracked over time | Regressions in LCP/CLS/accessibility go unnoticed until someone checks manually | 🟡 Medium | **v8.2**: Add [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) to pipeline. Budgets: LCP < 2.5s, CLS < 0.1, TBT < 200ms, Accessibility ≥ 95. |
| **Bundle size checked but not tracked** | `check-bundle-size.mjs` runs in CI, but no trend visualization | Can't see if bundle is growing sprint over sprint | 🟢 Low | **v8.2**: Track bundle size in CI artifacts; add `bundlesize` comment to PRs showing diff. |
| **Vite IIFE build for `file://` is a workaround** | `removeCrossOrigin` plugin strips CSP, converts `type="module"` → plain `<script>`, patches paths | Fragile; any Vite update can break the transform; IIFE build can't tree-shake effectively | 🟢 Low | Accepted trade-off. The `file://` use case (Raspberry Pi without a web server) is real. Keep the plugin but add integration tests that verify the built HTML loads correctly. |

### 8. Documentation & Developer Experience

| Issue | Current State | Impact | Severity | Recommendation |
| ----- | ------------- | ------ | -------- | -------------- |
| **Too many instruction files** | `copilot-instructions.md` + `CLAUDE.md` + 4× `.instructions.md` + skills + agents + this roadmap | Rules are duplicated and sometimes contradictory. Maintenance burden scales with sprint count | 🟡 Medium | **v7.10**: Consolidate to 3 files: (1) `CONTRIBUTING.md` (human developers), (2) `copilot-instructions.md` (AI assistants — single source of truth), (3) `CLAUDE.md` (lean pointer to `copilot-instructions.md`). Scoped `.instructions.md` files remain for CI/release-specific rules. Delete overlapping content. |
| **ARCHITECTURE.md says v7.7** | Doesn't cover v7.8 (fetch resilience, config v2) or v7.9 (IDB, error tracking, web vitals) | Misleading for contributors examining current architecture | 🟢 Low | **v7.10**: Update to v7.9 — add IDB cache tier, error tracking, web vitals sections. |
| **No OpenAPI spec for Worker** | `worker/openapi.yaml` exists but is incomplete | No external reference for the API contract; clients are loosely coupled to route shapes | 🟢 Low | **v8.0**: Complete OpenAPI 3.1 spec for all 11 Worker routes. Auto-generate with `@hono/zod-openapi` if Hono is adopted (see D12). |
| **Stale inventory file** | `/memories/repo/fdb-complete-inventory.md` references v5 `BestDashBoard.html` | AI agents get confused about current architecture if they read this first | 🟢 Low | **v7.10**: Archive or delete the v5 inventory. `ARCHITECTURE.md` is the canonical reference. |

### 9. Code Language & Tooling Versions

| Tool | Current | Latest Stable | Assessment |
| ---- | ------- | ------------- | ---------- |
| **TypeScript** | 5.9 | 5.9 | ✅ Current. No action needed. |
| **Vite** | 8 | 8 | ✅ Current. Monitor for Rolldown migration (Vite 8's Rust-based bundler). |
| **Vitest** | 4 | 4 | ✅ Current. |
| **ESLint** | 10 | 10 | ✅ Current. Flat config adopted. |
| **typescript-eslint** | 8 | 8 | ✅ Current. |
| **Node.js** | ≥22.0.0 | 24 LTS | 🟡 **v8.0**: Bump minimum to `>=22.12.0` (latest 22 LTS). Test Node 24 compatibility. |
| **Wrangler** | 4.0.0 | 4.x | ✅ Current. |
| **happy-dom** | (inherited) | latest | ✅ Managed by parent. Renovate handles updates. |
| **Cloudflare Workers Types** | 4.20250410.0 | latest | ✅ Current. |

---

## Released Milestones

<details>
<summary><strong>v7.4 — Architecture Hardening</strong> ✅</summary>

- [x] Registry-driven HTML: `card-registry.ts` wires cards dynamically
- [x] Per-card CSS co-location started (tasks, system-info, countdown)
- [x] Restored exponential backoff: `fetchWithRetry()` + `recordFetchSuccess/Failure()`
- [x] Stale fallback for all APIs: `fetchWithStale()` + static fallback data for Sefaria
- [x] Raised coverage thresholds: 75/70/75/75
- [x] Auto-generate SW version from `package.json` via Vite `define`
- [x] Added Renovate for automated dependency updates
- [x] ESLint strict: `no-floating-promises`, `no-misused-promises`
- [x] Updated ARCHITECTURE.md, consolidated AI instructions, created CONTRIBUTING.md

</details>

<details>
<summary><strong>v7.5 — Worker-First Migration</strong> ✅</summary>

- [x] Split `worker/src/index.ts` into `routes/data.ts` + `routes/feeds.ts`
- [x] Added middleware layer: rate-limit, CORS, cache-control
- [x] News feed SSRF lockdown: `ALLOWED_NEWS_ORIGINS` allowlist
- [x] Worker test suite via Vitest
- [x] Worker-first fetch: `fetchViaWorker()` primary path when `isWorkerEnabled()`
- [x] Build-time flag `__USE_PROXIES__` controls proxy chain inclusion
- [x] Per-card CSS co-location completed for all UI components
- [x] Integration tests: config-save, sync-dots, cache-stale, theme-switch

</details>

<details>
<summary><strong>v7.6 — Hebrew Calendar Expansion</strong> ✅</summary>

- [x] Moon phase in weather card
- [x] Daf Yomi, Halacha, Psalm of the Day tiles
- [x] Zmanim grid (prayer times)
- [x] Next calendar event chip
- [x] Bookmarks overlay
- [x] PWA install prompt
- [x] Hebrew-cal full refactor

</details>

<details>
<summary><strong>v7.7 — Runtime Safety & UX Polish</strong> ✅</summary>

- [x] Runtime API type guards: `isWeatherResponse()`, `isNewsItem()`, `isCurrencyResponse()`, `isAlertEvent()`
- [x] Weather UX: humidity labels, moon phase glyph, precipitation summary
- [x] Countdown urgency classes, tasks priority/due-date, stocks sector emoji
- [x] Core utils: `debounce()`, `throttle()`, `clamp()`, `cacheStats()`

</details>

<details>
<summary><strong>v7.8 — Resilience & Accessibility</strong> ✅</summary>

- [x] CSS co-location for 7 UI components
- [x] Config v2: 7 new fields, v1→v2 migration, `resetConfig()`, `dispatchConfigChange()`
- [x] Fetch resilience: `fetchJSONDeduped()`, `getNetworkQualityTier()`, `clearFetchLocks()`
- [x] ARIA: `:focus-visible` rings, `role="status"` on sync dots, `aria-live` on dynamic content
- [x] Night dimmer schedule + cache diagnostic stats in overlay

</details>

<details>
<summary><strong>v7.9 — Deep Instrumentation</strong> ✅</summary>

- [x] Error tracking: `initErrorTracking()`, `getErrorLog()`, `getErrorSummary()`
- [x] Web Vitals: LCP, FID, CLS via PerformanceObserver in diagnostics
- [x] Config v3: 7 per-card boolean toggles, v2→v3 migration
- [x] IndexedDB cache tier: `idb-cache.ts` with full CRUD API
- [x] SW TypeScript types: `sw-constants.ts` with typed message unions
- [x] Accessibility phase 2: ARIA tab keyboard navigation
- [x] Weather hourly strip, tasks due-today, news breaking badge, stocks group toggle

</details>

---

## v7.10 — Quality Gate & Technical Debt

> Focus: wire in existing unused infrastructure, raise quality bars, eliminate stale artifacts.

### Cache Integration

- [ ] **Wire IDB into cache flow**: `cGet()` checks memory → IDB → localStorage. `cSet()` writes to memory + IDB. localStorage retains only config. Graceful fallback when IDB unavailable.
- [ ] **Migration on first load**: copy all `dash_v2_*` entries from localStorage → IDB, then delete LS cache keys. Keep `dash_v2_config` in LS for sync startup access.
- [ ] **`cEvict()` for IDB**: add TTL-based eviction for IDB entries (7-day max age, matching localStorage behavior).

### Quality

- [ ] **Raise coverage thresholds**: run `npx vitest run --coverage`, read actual numbers, set thresholds to actual minus 3%. Target: 80/75/80/80 minimum.
- [ ] **Worker tests in CI**: add `worker-test` job to `.github/workflows/ci.yml` — `cd worker && npx vitest run`.
- [ ] **ESLint import ordering**: add `eslint-plugin-import-x` or `@stylistic/eslint-plugin` for consistent import grouping (builtins → external → internal → relative).

### Cleanup

- [ ] **Remove `BestDashBoard.html` from SW APP_SHELL**: update pre-cache list to include only `index.html`, `manifest.webmanifest`, `icon.svg`.
- [ ] **Update ARCHITECTURE.md to v7.9**: add IDB cache tier diagram, error tracking, web vitals, config v3.
- [ ] **Consolidate doc files**: merge overlapping content between `copilot-instructions.md`, `CLAUDE.md`, and `.instructions.md` files. Single source of truth per topic.
- [ ] **Archive v5 inventory**: delete or archive `/memories/repo/fdb-complete-inventory.md`.

### Minor Improvements

- [ ] **Structured error codes**: `diagLog()` messages get error codes (`FDB-001: fetch timeout`, `FDB-002: cache miss`) for easier debugging.
- [ ] **`main.ts` init priority**: reorder `safeLoad()` calls — weather, news, alerts first (visible, high-value); system-info, motivation last (low priority).

---

## v8.0 — Component Architecture & Reactive State

> Focus: proper component model, reactive state management, type-safe API boundaries, modern tooling. **This is the biggest architectural shift since v6.0.**

### Web Components Migration

- [ ] **Card base class**: `FdbCard extends HTMLElement` with `connectedCallback()`, `disconnectedCallback()`, `attributeChangedCallback()`. Shadow DOM for CSS scoping. Slots for header/body/footer.

  ```text
  <fdb-weather data-card-id="weather" data-size="md">
    #shadow-root
      <style>@import './weather.css'</style>
      <div class="card">...</div>
  </fdb-weather>
  ```

- [ ] **Migrate all 11 cards**: each card becomes a custom element. `card-registry.ts` maps IDs to element constructors. `document.createElement('fdb-weather')` replaces static HTML.
- [ ] **Dynamic card rendering**: `index.html` contains only `<div id="dashboard"></div>`. Registry creates card elements on init based on `cardLayout` config.
- [ ] **Card lifecycle**: `connectedCallback` replaces `init*()` functions. `disconnectedCallback` clears intervals (auto-cleanup). `attributeChangedCallback` for config reactivity.
- [ ] **Why not Lit or Preact?** Lit adds 5 KB but provides reactive templates. Preact adds 4 KB with JSX. **Decision**: Start with vanilla Web Components. If template verbosity becomes painful after migrating 3 cards, re-evaluate Lit. The zero-dep constraint applies to the client; the Worker already has Wrangler as a dev dependency.

### Reactive State Store

- [ ] **`EventTarget`-based store**: ~50 lines, zero dependencies. `state.get('config.tempUnit')`, `state.set('config.tempUnit', 'F')`, `state.on('config.tempUnit', callback)`.
- [ ] **State slices**: `config` (persisted), `cache` (ephemeral API data), `ui` (theme, overlay, maximize — transient).
- [ ] **DevTools integration**: state is inspectable via `window.__FDB_STATE__` in development builds.
- [ ] **Cards subscribe**: each card's `connectedCallback` subscribes to its config slice. State change → automatic re-render of affected tiles only.

### API Schema Validation

- [ ] **Zod schemas for all API responses**: `src/schemas/weather.ts`, `stocks.ts`, `news.ts`, etc. Validation at the fetch boundary. Invalid data → `diagLog()` error + stale cache fallback.
- [ ] **Generate TypeScript types from schemas**: `z.infer<typeof WeatherResponseSchema>` replaces hand-written `api.ts` interfaces. Single source of truth.
- [ ] **Worker request validation**: Worker routes validate query params with Zod. Type-safe handlers.
- [ ] **Why Zod?** 13 KB, zero transitive deps, works in browsers and Workers, generates TS types. Only runtime dependency added to the project — justified by the security and reliability gains at every API boundary.

### Monorepo Migration

- [ ] **npm workspaces**: `MyScripts/package.json` declares `"workspaces": ["FamilyDashBoard", "FamilyDashBoard/worker"]`.
- [ ] **Per-project `package.json`**: `FamilyDashBoard/package.json` gets `devDependencies` (vite, vitest, eslint, typescript). `FamilyDashBoard/worker/package.json` gets worker-specific deps (wrangler, @cloudflare/workers-types).
- [ ] **Shared lockfile**: single `package-lock.json` at `MyScripts/` root. `npm ci` works from root.
- [ ] **Shared config**: `packages/shared/` for types, constants, schemas used by both client and worker.

### Proxy Chain Simplification

- [ ] **Production build removes proxy chain**: `__USE_PROXIES__ = false` in production. Worker is the sole data path.
- [ ] **Dev build retains proxies**: `__USE_PROXIES__ = true` for `file://` and localhost development.
- [ ] **Dead code elimination**: Vite tree-shakes proxy-related code from production bundle. Estimated savings: ~1–2 KB.

### E2E Test Foundation

- [ ] **Playwright setup**: `playwright.config.ts` with Chromium + Firefox. Tests in `tests/e2e/`.
- [ ] **10 critical flow tests**: theme switch, config save/load, card maximize, keyboard shortcuts, night dimmer, drag-drop, alert toggle, PWA install, offline mode, print mode.
- [ ] **CI integration**: Playwright runs in GitHub Actions on every PR.

---

## v8.1 — Data Layer & Offline-First Persistence

> Focus: robust offline-first data layer, server-side caching, SW modernization.

### IndexedDB as Primary Cache

- [ ] **Full IDB migration**: `cGet()` → memory → IDB (async) → stale LS (sync fallback). `cSet()` → memory + IDB. localStorage holds only `DashboardConfig` + small flags.
- [ ] **Migration script**: on first v8.1 load, copies all `dash_v2_*` from LS to IDB, then removes from LS. Toast: "Cache upgraded — offline performance improved."
- [ ] **Cache size management**: IDB cache capped at 50 MB. LRU eviction when cap reached. Diagnostic overlay shows cache size.
- [ ] **Structured cache keys**: `idb:weather:jerusalem`, `idb:stocks:AAPL`, `idb:news:ynet` — queryable by card, enabling per-card cache clear.

### Config v4 — Per-Card Namespacing

- [ ] **Namespaced config**: `config.cards.weather = { tempUnit, cities, showHourly, showWind, showSunrise }`. `config.cards.stocks = { hidden, showPortfolio, groupBySector }`. Etc.
- [ ] **v3→v4 migration**: flat fields map to their card namespace. `config.tempUnit` → `config.cards.weather.tempUnit`.
- [ ] **Card-level config UI**: config panel groups settings by card. Each card tab shows only that card's settings.
- [ ] **Config export/import**: namespaced structure serializes cleanly; enables per-card config sharing.

### Server-Side Caching (Worker KV)

- [ ] **Cloudflare KV cache**: Worker stores upstream API responses in KV with TTL. Weather: 15 min. Currency: 1 h. Hebcal: 6 h. Stocks: 5 min (market hours) / 30 min (closed).
- [ ] **Cache-first strategy**: Worker checks KV before upstream. If KV hit, return immediately (< 5 ms latency). If miss, fetch upstream, store in KV, return.
- [ ] **KV namespace**: `FDB_CACHE`. Keys: `weather:32.0853:34.7818`, `stocks:AAPL`, `hebcal:281184`.
- [ ] **Benefit**: Client gets instant responses even during upstream outages. Reduces upstream API consumption by ~90%.

### RSS Feed Aggregation

- [ ] **Batch RSS endpoint**: `GET /api/news/batch` — Worker fetches all 17 RSS feeds in parallel, aggregates into one JSON response. Client makes 1 request per refresh cycle (was 17).
- [ ] **Server-side dedup**: Worker deduplicates news items by URL across all sources.
- [ ] **KV-backed RSS cache**: Each feed cached individually in KV (5 min TTL). Batch endpoint assembles from cache — no upstream hit if all feeds are fresh.

### Service Worker TypeScript Rewrite

- [ ] **`src/sw.ts`**: TypeScript source, compiled by Vite's `worker` plugin. Imports `sw-constants.ts` directly (no `__APP_VERSION__` text replacement).
- [ ] **Shared types**: SW imports `SWMessage`, `isVersionActivatedMsg()`, `isSkipWaitingMsg()` from `sw-constants.ts` — type-safe message passing.
- [ ] **Cache size limit**: API cache capped at 50 MB. LRU eviction policy. Log evictions via `diagLog()`.
- [ ] **Workbox evaluation**: If SW complexity grows beyond 300 lines, evaluate Workbox's `workbox-precaching` + `workbox-strategies`. **Decision**: defer unless complexity justifies it.

---

## v8.2 — Observability, Performance & Visual QA

> Focus: know when things break before users notice; measure performance continuously; prevent visual regressions.

### Lighthouse CI

- [ ] **`lhci` in GitHub Actions**: run on every PR against the built `dist/` output.
- [ ] **Budgets**: LCP < 2.5s, CLS < 0.1, TBT < 200ms, Accessibility ≥ 95, Best Practices ≥ 95.
- [ ] **Trend tracking**: store Lighthouse reports as CI artifacts. Dashboard in GitHub Pages for historical LCP/CLS/accessibility trends.

### Visual Regression Testing

- [ ] **Playwright screenshots**: 6 themes × 3 screen modes = 18 baseline screenshots. CI fails on pixel diff > 0.5%.
- [ ] **Update workflow**: `npx playwright test --update-snapshots` regenerates baselines after intentional CSS changes.
- [ ] **Dark mode contrast check**: automated WCAG AA contrast ratio verification for all 6 themes using a CI script.

### Error Reporting

- [ ] **Lightweight error reporter**: `src/core/error-reporter.ts` — sends error summaries to Worker `POST /api/errors`. Worker stores in KV (last 100 errors per device). **No external service required** — self-hosted.
- [ ] **Dashboard error view**: admin route `GET /api/errors?familyId=X` returns recent errors. Diagnostic overlay fetches and displays.
- [ ] **Why not Sentry?** Sentry free tier is excellent (10K events/month), but adds an external dependency and data leaves the family's infrastructure. Self-hosted approach fits the project's philosophy. Re-evaluate if error volume justifies Sentry.

### Performance Monitoring

- [ ] **Web Vitals tracking** (in-place): `web-vitals` data (LCP, CLS, INP) already collected via `initWebVitals()` (v7.9 Sprint 41). Wire into error reporter for longitudinal tracking.
- [ ] **Bundle size CI comment**: PR comment shows bundle size diff. Fail if JS gzipped > 100 KB or CSS gzipped > 25 KB.
- [ ] **Startup waterfall**: measure time from `DOMContentLoaded` to "all cards rendered" (last card's `setSync(id, 'ok')`). Log in diagnostics + report to Worker.

### Preview Deployments

- [ ] **Cloudflare Pages**: PR branches auto-deploy to `pr-123.fdb.pages.dev`. GitHub Actions posts preview URL as PR comment.
- [ ] **Teardown**: preview deleted when PR is closed/merged.

---

## v9.0 — Multi-Device & Cloud Sync

> Focus: use the dashboard on multiple screens with shared configuration and state.

### Cloud Sync via Cloudflare KV

- [ ] **Device ID**: UUID generated per device, stored in `localStorage dash_device_id`.
- [ ] **Family ID**: 6-character code entered once in config. Worker uses `family:{code}` as KV partition key.
- [ ] **Sync protocol**: on config save → `PUT /api/sync/:familyId` with JSON payload → Worker writes to KV. On load → `GET /api/sync/:familyId` → latest config. Conflict resolution: **last-write-wins with timestamp** (simple, works for family use).
- [ ] **Selective sync**: sync config + card layout + hidden cards + theme. Do NOT sync cache or transient UI state.
- [ ] **No auth required**: family code is a shared secret. Acceptable for a family dashboard with no sensitive data. Rate-limited to prevent brute-force enumeration.

### Multi-Display Roles

- [ ] **Screen roles**: configure each device as:
  - **"Living Room"** — full dashboard, all cards
  - **"Kitchen"** — weather + calendar + tasks only
  - **"Bedroom"** — minimal + permanent night dimmer
  - **"Custom"** — user-defined card selection
- [ ] **Role config**: `config.screenRole = "living-room" | "kitchen" | "bedroom" | "custom"`. Roles map to `hiddenCards` presets.
- [ ] **Sync-aware**: role is per-device (not synced). Card visibility derived from role.

### Real-Time Sync (Stretch Goal)

- [ ] **Durable Objects**: Worker uses Durable Objects for WebSocket-based real-time config push. When one device changes theme, all devices update within 1 second.
- [ ] **Fallback**: if WebSocket unavailable, poll `GET /api/sync/:familyId` every 5 minutes.
- [ ] **Cost consideration**: Durable Objects have per-request costs. Evaluate if polling is sufficient for the family use case.

---

## v10.0 — Smart Integrations & Accessibility

> Focus: turn the dashboard into a smart home control surface; full accessibility.

### Voice Control

- [ ] **Web Speech API**: Hebrew speech recognition ("מה מזג האוויר?", "הצג חדשות", "עבור לנושא הבא").
- [ ] **Command mapping**: 10 voice commands → existing keyboard shortcuts. No AI/LLM required — pattern matching on Hebrew keywords.
- [ ] **Wake word**: "משפחה" (family) or always-listening mode (configurable).
- [ ] **Privacy**: all processing on-device. No audio sent to any server.

### Full Accessibility

- [ ] **Screen reader audit**: NVDA + VoiceOver testing for all 11 cards. Fix all ARIA violations.
- [ ] **High-contrast theme**: 7th theme designed for low-vision users (WCAG AAA contrast). Black-on-white option.
- [ ] **Keyboard-only navigation**: Tab order through all interactive elements. Focus visible on every control.
- [ ] **Reduced motion**: `prefers-reduced-motion` already handled in `a11y.css`. Verify all animations respect it.

### Smart Home Integration

- [ ] **Home Assistant card**: new card showing entity states (lights, temperature sensors, door locks) via HA WebSocket API.
- [ ] **Direct device control**: toggle Shelly/Tuya switches from dashboard tiles.
- [ ] **Waze commute tile**: real-time commute ETA from home to configurable destinations.
- [ ] **Grocery list card**: shared family grocery list with completion sync (via Cloudflare KV).

### AI Briefing (Experimental)

- [ ] **Morning summary**: on-device LLM (via WebLLM or Ollama) generates a Hebrew morning brief combining weather, calendar, and news highlights.
- [ ] **No cloud AI dependency**: all inference runs locally. No data leaves the device.
- [ ] **Fallback**: if LLM unavailable, show a structured text summary (no AI) as the default.

---

## Long-Term Vision

### v11.0+ — Platform & Community

- [ ] **Card plugin system**: community-submitted card definitions loaded at runtime. JSON manifest defines card metadata, data source, refresh interval, CSS.
- [ ] **Internationalization (i18n)**: if community demand exists, add `i18next` with Hebrew as default locale. Support English, Arabic, Russian (common in Israel).
- [ ] **Mobile companion app**: Capacitor wrapper for iOS/Android push notifications (red alerts, calendar reminders).
- [ ] **E-ink display support**: high-contrast, minimal-refresh mode for e-ink screens (Kindle, BOOX).
- [ ] **Open data export**: dashboard data exportable as JSON/CSV for personal analytics.

---

## Decision Log

Key architectural decisions and their rationale, for future reference.

| # | Date | Decision | Alternatives Considered | Rationale | Status |
| - | ---- | -------- | ----------------------- | --------- | ------ |
| D1 | 2024 | TypeScript + Vite (no framework) | React, Vue, Svelte, Angular | Zero-dep constraint; Vite gives fast dev + optimal bundle; TS catches bugs at compile time. Framework overhead unjustified for a read-heavy dashboard. | ✅ Validated |
| D2 | 2024 | Vitest + happy-dom (not jsdom) | Jest, Mocha, jsdom | Vite-native; happy-dom is 2–3× faster than jsdom; `pool=forks` isolates DOM state. | ✅ Validated |
| D3 | 2024 | Vanilla CSS + @layer (no Tailwind/Sass) | Tailwind, Sass, CSS-in-JS | Zero build overhead; @layer ordering > BEM cascades; CSS custom properties give theme switching for free. | ✅ Validated |
| D4 | 2024 | Cloudflare Workers (not Vercel/Netlify) | Vercel, Netlify, AWS Lambda | 100K req/day free; edge-deployed; Wrangler CLI; KV + Durable Objects for future sync. | ✅ Validated |
| D5 | 2024 | PWA + SW (not Electron/Tauri) | Electron, Tauri, native app | Runs in browser tab on TV/Raspberry Pi; PWA gives offline + installable without app store. | ✅ Validated |
| D6 | 2024 | localStorage + Map (not IndexedDB) | IndexedDB, SQLite via wasm | Simple, sync, sufficient for config + short-lived cache. | 🟡 **Revisiting in v7.10/v8.1** — IDB tier added in v7.9, full migration planned. |
| D7 | 2024 | No auth / static-only | Firebase Auth, Auth0, Clerk | Local family display, no user accounts, no sensitive writes. Auth adds complexity with zero value. | ✅ Valid until v9.0 (cloud sync may need family-code auth). |
| D8 | 2024 | Hebrew RTL-first (no i18n) | i18next, multi-language | Target audience is Hebrew-speaking Israeli families. i18n for one language is wasted complexity. | ✅ Valid. Revisit only if international demand emerges. |
| D9 | 2026-Q2 | **Web Components (vanilla)** for card model | Lit, Preact, Solid, stay vanilla | Shadow DOM gives CSS scoping for free. No dep. Lit evaluated as fallback if template verbosity hurts. | 🕐 Planned for v8.0 |
| D10 | 2026 | Yahoo Finance via Worker + KV cache | Twelve Data, Polygon.io, FMP, Alpha Vantage | Yahoo v8 through Worker proxy with KV caching reduces to ~96 req/day. FMP as automatic fallback. | 🕐 In progress |
| D11 | 2026 | Zod for API validation (sole runtime dep) | io-ts, superstruct, Ajv, manual guards | 13 KB, zero transitive deps, generates TS types. Security/reliability gain justifies breaking zero-dep purity for data validation. | 🕐 Planned for v8.0 |
| D12 | TBD | Worker framework | Stay vanilla, Hono, itty-router | Current vanilla router (switch/case) works for 11 routes. **If routes grow beyond 20**, migrate to Hono (14 KB, built for CF Workers, Zod OpenAPI plugin). Not needed yet. | 🔵 Deferred |
| D13 | TBD | npm workspaces monorepo | Turborepo, Nx, Lerna, stay shared | npm workspaces is zero-dep and standard. Turborepo/Nx are overkill for 2-3 packages. | 🕐 Planned for v8.0 |
| D14 | TBD | Client reactive state | Preact Signals, TC39 Signals, MobX, Redux | Vanilla `EventTarget` pub/sub is zero-dep and sufficient. **Re-evaluate** when TC39 Signals ships natively in browsers (earliest 2027). | 🕐 Planned for v8.0 |

---

## Design Principles

| Principle | Rule |
| --------- | ---- |
| **Zero client dependencies** | No external JS/CSS libraries or CDNs at runtime. Zod is the sole exception (API boundary validation). |
| **Hebrew RTL** | Always `dir="rtl"` in HTML; CSS logical properties where possible. |
| **TV-first** | 1920×1080 primary; readable from 3 m; no hover-only affordances. |
| **Offline-first** | Three-tier cache (memory + IDB + SW). Dashboard is useful without network. |
| **0 lint errors** | `npx eslint . --max-warnings 0` must pass on every commit. |
| **0 TS errors** | `npx tsc -b --noEmit` must pass on every commit. |
| **No suppressions** | Zero `eslint-disable` / `@ts-ignore` / `@ts-expect-error` allowed. |
| **Worker-first fetch** | Production: all API calls go through Cloudflare Worker. Proxy chain is dev-only fallback. |
| **Progressive enhancement** | Cards render with stale data instantly; fresh data replaces when available. Never show an empty card. |
| **Self-hosted observability** | Error tracking, performance metrics, and health checks use own Worker infrastructure. No third-party telemetry. |

---

<!-- Last updated: v7.10.0 — April 2026 -->
