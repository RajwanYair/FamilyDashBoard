# FamilyDashBoard Roadmap

> Roadmap refresh date: 2026-04-20
> Current shipped baseline: v8.0.0
> Last committed baseline: v8.0.0 — 3053+ tests / 87 suites / 0 failures

This document is the single decision log and forward plan for FamilyDashBoard. It rethinks every major architectural, tooling, and product decision from first principles — including decisions that previously looked clean — and sets an explicit direction for reaching best-in-class quality as an always-on family information display.

---

## 1. Competitive Landscape

Before making internal decisions, we studied five top-tier open-source dashboard projects to harvest their best patterns and identify our unique strengths.

### Comparison Table

| Dimension | **FamilyDashBoard** | **Homepage** (gethomepage) | **Dashy** (Lissy93) | **Homer** (bastienwirtz) | **Homarr** (homarr-labs) |
| --- | --- | --- | --- | --- | --- |
| **Stars** | ~30 (niche) | 29.6 K | 24.7 K | 11.3 K | 7.1 K |
| **Purpose** | Family info display (TV/wall) | Service dashboard | Personal dashboard | Static homepage | Homelab management |
| **Frontend** | Vanilla TypeScript + Vite | Next.js (React) | Vue 2 → 3 | Vue 3 + Vite | Next.js + Mantine |
| **CSS** | Vanilla CSS `@layer` tokens | Tailwind CSS | SCSS + themes | SCSS + themes | Mantine component CSS |
| **Backend** | Cloudflare Worker (edge) | Node.js proxied API | Express + Node | None (static YAML) | Node.js + Drizzle ORM |
| **Database** | None (IDB + localStorage) | None (YAML config) | None (YAML / cloud KV) | None (YAML) | SQLite via Drizzle |
| **Test suite** | 3053+ tests / Vitest | Vitest | Vitest (recent) | None | Vitest |
| **TypeScript** | 100% strict TS 5.9 | JavaScript 99% | Vue 68% / JS 22% | Vue 86% / JS 5% | TypeScript 98% |
| **Runtime deps** | Zero | react, next, tailwind, etc. | vue, axios, etc. | vue, lodash, etc. | next, mantine, trpc, drizzle |
| **Themes** | 6 dark themes | CSS variables + custom | 50+ built-in | Custom YAML themes | Mantine theming |
| **i18n** | Hebrew + English (bilingual) | 40+ languages (Crowdin) | 20+ languages | YAML-based | 30+ languages (Crowdin) |
| **Docker** | N/A (static PWA) | Docker-first | Docker + bare metal | Docker + static zip | Docker-first |
| **Service integrations** | 11 live-data cards | 100+ service widgets | 50+ widgets | Smart cards (limited) | 30+ integrations |
| **Offline / PWA** | Full SW + IDB + stale cache | No | Basic PWA | Installable PWA | No |
| **RTL support** | Native Hebrew RTL-first | Partial (via i18n) | Partial | No | Partial |
| **Auth** | None (static, intentional) | Host check / reverse proxy | Keycloak + basic auth | None | OIDC / credentials |
| **Config** | UI panel + JSON export | YAML + Docker labels | YAML + UI editor | YAML | UI drag-and-drop |
| **Visual regression** | None (planned) | None | None | None | Argos CI |
| **CORS strategy** | Worker proxy (edge) | Server-side proxy | CORS proxy chain | None needed | Server-side proxy |
| **CI quality gates** | Typecheck + lint + test + bundle | Docker build + tests | Docker build | Build only | Build + tests |
| **License** | MIT | GPL-3.0 | MIT | Apache-2.0 | MIT |

### Patterns to Harvest

| Pattern | Source | How We Adapt It |
| --- | --- | --- |
| **Docker label auto-discovery** | Homepage | Not applicable (no Docker management), but the *plugin registry* concept is relevant: cards should self-describe their config schema, data needs, and refresh contract — which we already have via `CardRegistryEntry` + `configSchema`. Solidify this as our "service discovery." |
| **100+ widget ecosystem** | Homepage, Dashy | Our 11 cards are deep, not broad. We do not need 100 widgets. But we should make adding a new card trivially easy (template + skill + test scaffold). The `add-api` skill exists — finish it. |
| **50+ built-in themes** | Dashy | 6 themes is correct for a TV dashboard. More themes = more visual QA surface. Instead, make the 6 themes *flawless* with automated screenshot regression. |
| **Crowdin / 40+ languages** | Homepage, Homarr | Our bilingual (Hebrew + English) model is correct for a family product. Crowdin is overkill. But our i18n infrastructure should support adding a language without touching every file — which the `i18n.ts` module already enables. |
| **Visual regression (Argos CI)** | Homarr | Adopt Playwright screenshot tests. This is the single biggest quality gap versus Homarr. |
| **Database-backed config** | Homarr (Drizzle/SQLite) | We do not need a database. Our config model (localStorage + IDB + JSON export) is correct for a single-device static PWA. But we should harden import/export validation. |
| **YAML config + UI editor** | Homer, Dashy | Our UI-first config panel is *better* than YAML editing for non-technical family members. Double down on the config panel quality. |
| **Zero-install static builds** | Homer | We already have `dist.zip` + GitHub Pages. Add a "download and run" section to README for non-technical users. |
| **Cloud backup and sync** | Dashy | Consider optional encrypted config backup to a personal URL (not a third-party service). Low priority — the product is single-device. |

### Our Unique Strengths (Protect and Amplify)

1. **Zero runtime dependencies** — no supply-chain risk, instant startup, full control
2. **TV-first design at 3m** — no other dashboard optimizes for wall-mounted readability
3. **Hebrew RTL-first** — a genuine differentiator, not an afterthought
4. **Edge-first data layer** — Cloudflare Worker eliminates CORS chains in production
5. **Aggressive offline resilience** — 4-layer cache (mem → IDB → localStorage → SW)
6. **2998+ test suite** — highest test count of any dashboard project in the comparison
7. **Static PWA with no auth** — zero operational complexity for the end user

---

## 2. Product North Star

FamilyDashBoard is a best-in-class always-on family command center: fast, reliable, calm, maintainable, observable, and honest in its documentation.

### Success Metrics

| Area | Target | Current |
| --- | --- | --- |
| Time to first meaningful content | < 1.5 s on cached desktop browser | ~1.2 s (meets) |
| Empty-card rate after boot | 0 for cached sessions | ~0 (meets) |
| Upstream outage resilience | Stale or fallback for every card | Partial (some cards lack graceful degradation) |
| Production JS size | < 200 KB gzip (explicit budget) | Tracked but no formal gzip budget |
| Accessibility | Lighthouse >= 95 | Not measured in CI |
| Visual regressions | Screenshot coverage across all themes x screen modes | None |
| Documentation drift | Architecture updated in same release as structural changes | Mostly met |
| Test suite health | 0 failures, < 30 s total run time | 0 failures, ~45 s run time |

---

## 3. Decision Rethink: Every Major Choice Reopened

### 3.1 Frontend Language and Build

| Decision | Current | Verdict | Rationale |
| --- | --- | --- | --- |
| TypeScript | TS 5.9 strict | **Keep** | Highest-leverage choice. All competitors trend toward TS. |
| Vite | 8.x | **Keep** | Fast, stable, native TS. No reason to switch to Turbopack/Rspack yet. |
| Zero runtime deps | 0 deps | **Keep with exceptions** | Client stays zero-dep. Worker and build tools may adopt Zod (schema validation). |
| Vanilla CSS | `@layer` + tokens | **Keep** | Tailwind adds 50+ KB and a build step for minimal gain on a TV dashboard. Container queries and `color-mix()` give us modern capabilities. |
| No framework (React/Vue) | Vanilla DOM | **Keep** | Our rendering is imperative and card-scoped. A framework adds bundle size, complexity, and contributor friction for no product gain. See ADR-005. |

### 3.2 Frontend Architecture

| Decision | Current | Verdict | Rationale |
| --- | --- | --- | --- |
| `FdbCard` base class | Foundation exists, partial adoption | **Complete migration** | Half the cards still use `initX()` + file-scoped state. This dual model is the biggest maintainability risk. |
| Static HTML shells | `index.html` defines all cards | **Migrate to registry-driven** | `createShell()` exists. Cards should be DOM-generated from the registry, not hardcoded HTML. |
| EventTarget state store | `state.ts` (config/cache/ui) | **Keep and expand** | Simple, zero-dep, debuggable. Expand to cover card-level state. |
| Shadow DOM | Decided against (ADR-001) | **Keep decision: No Shadow DOM** | Confirmed. Shadow DOM breaks global theming, diagnostics, and TV readability at distance. |
| Service Worker | `sw.js` with APP_SHELL + API cache | **Keep, modernize** | SW code is vanilla JS. Consider migrating to TypeScript + Workbox-inspired patterns (without Workbox dependency). |
| CSS `@layer` architecture | tokens, themes, base, layout, components, animations | **Keep** | Best-in-class approach. No other dashboard project uses cascade layers. |

### 3.3 Backend and Infrastructure

| Decision | Current | Verdict | Rationale |
| --- | --- | --- | --- |
| Cloudflare Worker | Single worker, route-based | **Keep, enhance** | Edge deployment, free tier, eliminates CORS. But: needs schema validation, KV caching, and structured error responses. |
| No database | localStorage + IDB | **Keep for now** | A database (D1, KV) becomes relevant only for multi-device sync or provider health history. Not needed yet. |
| GitHub Pages deploy | Static `dist/` | **Keep** | Zero-cost, zero-ops. Perfect for this product. |
| CORS proxy chain (fallback) | allorigins, codetabs, corsproxy.io | **Deprecate in production** | `__USE_PROXIES__=false` already disables in prod builds. Remove proxy code from production bundles entirely via tree-shaking. |
| Worker response normalization | Thin proxy today | **Enhance significantly** | Worker should return normalized domain shapes, not raw upstream JSON. This is the single biggest data architecture improvement available. |

### 3.4 Data Sources and External APIs

| Provider | API | Current Approach | Verdict | Action |
| --- | --- | --- | --- | --- |
| Weather | Open-Meteo | Worker-proxied, well-structured | **Keep** | Add normalized `WeatherResponse` from worker. Add backup provider evaluation. |
| Stocks | Yahoo Finance v8 | Worker-proxied, unofficial API | **Keep behind abstraction** | High risk of breakage. Add provider adapter. Evaluate IEX Cloud or Polygon.io as backup. |
| Currency | ER-API + ExchangeRate-API | Dual upstream in worker | **Keep** | Add gold/silver from a dedicated metals API. Worker normalization. |
| News | 17 RSS feeds | Direct fetch + proxy fallback | **Move aggregation to worker** | Worker should aggregate, deduplicate, and return a single normalized news payload. Biggest change in this domain. |
| Calendar | Google ICS | Worker-proxied | **Keep** | Add ICS validation in worker. Handle recurring events better. |
| Hebrew Calendar | Hebcal | Worker-proxied | **Keep** | Normalize zmanim response. Cache holidays yearly. |
| Alerts (Tzeva Adom) | tzevaadom.co.il | Worker-proxied | **Keep** | Add health/backoff policy. Add degraded-state UX. |
| Learning (Sefaria) | Sefaria API | Worker-proxied | **Keep** | Add stronger response validation. |
| Bitcoin | CoinGecko | Direct fetch | **Move to worker** | CoinGecko rate-limits aggressively. Worker should cache and normalize. |
| Background Images | Unsplash-style (HTTPS) | Direct fetch, 30-min rotation | **Keep** | Consider adding config for custom image URLs. |

### 3.5 Testing and Quality

| Decision | Current | Verdict | Rationale |
| --- | --- | --- | --- |
| Vitest + happy-dom | 3053+ tests, 87 suites | **Keep, consolidate** | Test count is high but run time is too slow (~45 s). Consolidate per Stream G.1. |
| No E2E tests | None | **Add Playwright** | The biggest quality gap. Screenshot regression across 6 themes x 3 screen modes = 18 baseline images. |
| No Lighthouse CI | None | **Add** | Accessibility and performance budgets should be CI-enforced. |
| Coverage thresholds | 90/81/90/92 | **Keep** | Already strong. Raise branches to 85 after consolidation. |
| ESLint 10 + typescript-eslint 8 | Flat config, 0 warnings | **Keep** | Best-in-class lint setup. |
| Markdownlint | 0 errors | **Keep** | Important for doc quality. |

### 3.6 Documentation

| Decision | Current | Verdict | Rationale |
| --- | --- | --- | --- |
| ARCHITECTURE.md | Accurate, detailed | **Keep, add SVG diagrams** | Needs lifecycle, cache-layer, and CI pipeline SVGs. |
| ADR folder | 6 ADRs | **Keep, add more** | Missing ADRs for: worker normalization strategy, news aggregation, config schema evolution. |
| README | Comprehensive with SVG assets | **Keep, tighten** | Could be shorter for new users. Add quick-start copy-paste block. |
| ROADMAP.md | This document | **This is the rewrite** | Previous version had accumulated drift. |
| Inline docs | Co-located per module | **Keep** | JSDoc on exported functions, no excessive internal comments. |
| docs/ folder | ADRs + index | **Expand** | Add `docs/data-sources.md`, `docs/adding-a-card.md`, `docs/deployment.md`. |

### 3.7 Configuration and Tooling

| Decision | Current | Verdict | Rationale |
| --- | --- | --- | --- |
| Parent `MyScripts/` install | Shared `node_modules/` | **Keep, formalize** | All TS projects should extend shared configs. See Stream I-0. |
| No monorepo tool (npm workspaces, pnpm, etc.) | Flat structure | **Keep** | Node module resolution walk-up is sufficient and simpler. |
| Shared ESLint/TS/Vitest configs | `MyScripts/tooling/` | **Expand** | Other projects (BudgetManager, CrossTideWeb, Wedding) should consume shared configs. |
| VS Code as primary editor | `.vscode/` config | **Keep, complete** | Add `launch.json`, audit deprecated settings. |
| GitHub Actions CI | 6 workflows | **Keep, harden** | Add explicit `permissions`, `concurrency`, SLSA attestations. |

---

## 4. Implementation Progress

### Completed Streams

| Release | Key Deliverables |
| --- | --- |
| v7.13.0 | README rewrite, ARCHITECTURE.md, ADRs, CardRuntime, domain types, config validation |
| v7.14.0 | Domain type tests, provider health model, diag table, coldStart, migrateLsToIdb |
| v7.15.0 | createSkeleton/Empty/Error, FdbCard.withLoading, CardShell, weekday dimmer |
| v7.16.0 | bundle-trend, config v5, fetchWithRetry, FdbCard.emit, registry createShell |
| v7.17.0 | Worker normalization, FdbCard helpers, API.md, release report |
| v7.18.0 | Provider adapters, typed card config, config auto-renderer, CSS card anatomy, theme audit, offline banner |
| v7.19.0 | Per-card configSchema, config dirty tracking, observability suite, provider latency |
| v7.19.1 | Tooling modernization, bilingual interface, config migration hardening |
| v7.20.0 | ROADMAP strategic overhaul, worker-first fetch resilience, provider adapter hardening, shared tooling foundation |
| v7.21.0 | Shared test helpers, normalized worker types, node-ts-app tooling, instruction files, .nvmrc, agent/prompts, card audit, loading CSS, SW constants |
| v8.0.0 | Production readiness: test consolidation (it.each), dead file cleanup, config modernization, hardened .gitignore, full version bump across 15 files |

**Completed Streams:** A (Truth) · B (Card Architecture) · C (Data Contracts) · D (Observability)

---

## 5. Roadmap Streams

Streams are ordered by priority. Each has measurable exit criteria.

### Stream G.1: Unit Test Consolidation

Priority: **Critical — Execute First**

The test suite has 3053+ tests but takes ~45 s. The biggest drag is 186 `vi.resetModules()` calls and 300+ raw DOM rebuilds.

#### Action Plan

| Phase | Target | Approach |
| --- | --- | --- |
| Shared helpers | `tests/helpers/` | `createCardDOM()`, `cleanupDOM()`, `withFakeTimers()`, `createMockCache()`, `createMockFetch()`, `createMockConfig()` |
| Eliminate `resetModules` | Cut from 186 to 30 or fewer | Add `_resetForTest()` exports to stateful modules; replace re-imports with state resets |
| Parameterize tests | Cut count from ~2998 to ~2500 | Convert weather codes, holiday tables, currency lists to `it.each()` tables |
| DOM fixture optimization | Replace 300+ innerHTML assignments | Per-card HTML fixtures, DocumentFragment cloning, shared base shell |
| Timer mock audit | Reduce 118 `useFakeTimers` calls | Remove from tests that never call `advanceTimersByTime` |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Suite run time | 60% of current baseline (under 27 s) |
| `vi.resetModules()` calls | 30 or fewer |
| `innerHTML` raw assignments | 50 or fewer |
| Test count | 2400-2600 with same or better branch coverage |
| No test file exceeds | 500 lines |
| Shared helpers | 5 or more reusable utilities in `tests/helpers/` |

---

### Stream G.2: E2E and Visual Regression

Priority: **Critical — Execute After G.1**

No other dashboard project in the comparison table has automated visual regression except Homarr (Argos CI). This is our chance to leapfrog.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Playwright setup | Install, configure for 6 themes x 3 screen modes = 18 baseline screenshots |
| Critical-flow suite | Load, render, config panel, theme switch, card maximize, keyboard shortcuts |
| Lighthouse CI | Accessibility >= 95, performance >= 90, bundle budget enforcement |
| CI integration | Screenshot comparison in PR checks, Lighthouse budget in CI gate |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Screenshot baselines | 18 (6 themes x 3 modes) |
| Playwright test count | 15 or more critical-flow tests |
| Lighthouse accessibility | 95 or higher in CI |
| Lighthouse performance | 90 or higher in CI |
| Visual regressions caught | Automated in PR workflow |

---

### Stream I-0: Shared Tooling — MyScripts Level

Priority: **High — Execute Before Feature Work**

All common development tools live under `MyScripts/`. Individual workspaces keep only project-specific overrides.

#### Current State

Already shared: ESLint factory, TypeScript base, Vitest base, Stylelint base, EditorConfig, markdownlint, Python tooling.

Not yet shared: BudgetManager, CrossTideWeb, Wedding each maintain independent configs.

#### Action Plan

| Phase | Target |
| --- | --- |
| Expand presets | Create `node-ts-app.mjs` (ESLint), `js-browser-app.mjs`, `base-node.json` (tsconfig), `happy-dom.mjs` + `node.mjs` (Vitest) |
| Migrate BudgetManager | Extend shared factory + base configs |
| Migrate CrossTideWeb | Same pattern |
| Migrate Wedding | JS-only variant, move devDeps to parent |
| Worker config alignment | `worker/tsconfig.json` extends `base-node.json` |
| Documentation | `tooling/README.md` + templates |

#### Architecture

```text
MyScripts/                              <- SHARED LEVEL
  package.json                          <- All devDependencies
  node_modules/                         <- Resolved once for all projects
  tooling/
    eslint/web-ts-app.mjs               <- Browser TS apps
    eslint/node-ts-app.mjs              <- Node/Worker TS (NEW)
    eslint/js-browser-app.mjs           <- JS-only browser (NEW)
    tsconfig/base-typescript.json       <- Strict TS base
    tsconfig/base-node.json             <- Node target (NEW)
    vitest/base.mjs                     <- Shared defaults
    vitest/happy-dom.mjs                <- DOM preset (NEW)
    vitest/node.mjs                     <- Node preset (NEW)
    stylelint/base.json                 <- CSS rules

  FamilyDashBoard/                      <- Only overrides
    eslint.config.mjs                   <- imports factory + project paths
    tsconfig.json                       <- extends base + local paths/lib
    vitest.config.ts                    <- imports preset + aliases/coverage
    vite.config.ts                      <- project-specific build plugins
```

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| TS projects extending shared tsconfig | 4/4 |
| TS projects using shared ESLint factory | 4/4 |
| Zero duplicated rule definitions | Only overrides in project configs |
| All migrated projects pass full suite | Green per project |
| `tooling/README.md` | Accurate + templates |

---

### Stream I: AI Customization and .github Modernization

Priority: **High**

Every `.github/` markdown file should exploit the full capability surface of VS Code Copilot, Claude, and MCP tooling.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Agent modernization | Full frontmatter: `tools`, `handoffs`, `applyTo`, `#file` context refs, error playbooks. Add `quality-reviewer` agent. |
| Instruction expansion | New `typescript.instructions.md` (`src/**/*.ts`), `tests.instructions.md` (`tests/**`). Tighten 4 existing files. |
| Prompt enhancement | Context variables, tool restrictions. Add `/test-coverage`, `/debug-card`, `/release-check` prompts. |
| Skill hardening | Machine-verifiable "Verification" sections for all 4 skills. |
| MCP and config cleanup | Evaluate legacy `config.json`, add `.vscode/mcp.json` examples, server capability matrix. |
| Workflow docs | Permissions matrix, secrets inventory, concurrency policy, branch protection alignment. |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Agent files with full spec | All agents |
| Instruction files | 6 or more covering all file categories |
| Prompt files | 6 or more with context variables |
| Skills with verification | All 4 |
| Workflow README | Complete permissions/secrets/concurrency tables |

---

### Stream J: Configuration, Documentation and Environment Standards

Priority: **High**

Every config file, doc asset, and environment descriptor conforms to latest VS Code and GitHub platform standards.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Environment alignment | `.nvmrc`, `package.json` metadata (repository, homepage, bugs, author), Prettier decision |
| VS Code config | `launch.json` (3 debug configs), deprecated keys audit, problem matchers on tasks |
| GitHub community | Issue/discussion template spec audit, CONTRIBUTING prerequisites, SECURITY versions table |
| Actions hardening | Explicit `permissions` on every workflow, `concurrency` groups, SLSA attestations |
| Root config audit | tsconfig/eslint/vite/vitest against latest tool versions, 0 deprecated options |
| SVG documentation | 5 new diagrams (card lifecycle, cache layers, config pipeline, CI/CD, theme cascade) + audit 6 existing |
| Doc cross-references | Embed SVGs in README, ARCHITECTURE, workflows README |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| SVG documentation assets | 10 or more total |
| VS Code `launch.json` | 3 or more debug configs |
| `package.json` metadata | All standard fields present |
| GitHub Actions permissions | Explicit on every workflow |
| Root config deprecated options | 0 |
| All checks pass | `npm run check` green |

---

### Stream W: Worker Normalization and Data Architecture

Priority: **High**

This is the single biggest data architecture improvement available. The worker should return normalized domain shapes, not raw upstream JSON.

#### Current Problem

Cards parse raw upstream API responses on the client. When an upstream API changes its JSON structure, the card breaks. This couples cards tightly to provider quirks.

#### Target Architecture

```text
Client Card                    Worker
----------                     ------
Requests: /api/weather     --> Fetches upstream: api.open-meteo.com
Receives: NormalizedWeather <-- Normalizes, validates, caches in KV
Renders domain model
```

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Define domain contracts | `NormalizedWeather`, `NormalizedStocks`, `NormalizedCurrency`, `NormalizedNews`, `NormalizedAlerts`, `NormalizedHebcal`, `NormalizedCalendar` TypeScript interfaces shared between client and worker |
| Worker normalization | Each route handler normalizes upstream response into domain contract before returning |
| Zod validation | Add Zod in worker for upstream response validation (first worker dependency) |
| Client simplification | Cards receive and render domain models only — remove upstream parsing from client code |
| News aggregation | Worker aggregates 17 RSS feeds into a single `NormalizedNews` response with deduplication |
| Fallback responses | When upstream fails, worker returns last-known KV value with `stale: true` flag |
| Shared types package | `src/types/api.ts` becomes the shared contract between client and worker |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Worker routes returning normalized responses | All 10 routes |
| Zod schemas for all upstream inputs | All providers |
| Client parsing of raw upstream JSON | 0 (all on worker) |
| News aggregation | Worker returns single deduped feed |
| KV-backed stale fallback | 3 or more routes (weather, currency, news) |

---

### Stream D2: Storage and Offline Architecture

Priority: **High**

#### Goals

Make IndexedDB the real persistent cache. Reduce localStorage pressure.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Async-first cache | Standardize `cGetAsync`/`cSetAsync` for all network-backed cards |
| LS to IDB migration | Complete migration policy, cleanup legacy `dash_v2_*` keys |
| Worker KV cache | Add Cloudflare KV for shared edge caching (weather, currency, news) |
| Stale rendering | Consistent stale-chip + retry-button patterns across all cards |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Network-backed cards on IDB | All 11 |
| localStorage usage | Config + flags only |
| Worker KV endpoints | 3 or more (weather, currency, news) |
| Stale-state UX | Consistent across all cards |

---

### Stream E: Config and Personalization

Priority: **High**

#### Goals

Stop growing a single flat config bag. Make per-card settings maintainable.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Namespaced config | Complete migration to `cards: Record<string, CardConfig>` for all cards |
| Config panel | Card-specific accordion groups (already started), per-card reset |
| Import/export | Schema-aware validation on import, versioned export format |
| URL sharing | `loadConfigFromHash()` for sharing config via URL fragment |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Cards with namespaced config | 11/11 |
| Config migration is localized | Per-card, not monolithic |
| Import validation | Schema + version check on every import |

---

### Stream F: Visual System and UX Quality

Priority: **High**

#### Goals

Turn a strong-looking dashboard into a coherent visual system. Improve consistency, density, and TV readability.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Card shell primitives | Formal `card__header`, `card__body`, `card__footer` anatomy with shared CSS |
| Shared UI patterns | Skeleton, empty, stale, error states as reusable CSS classes |
| Theme audit | All 6 themes verified across all 11 cards, no broken tokens |
| TV readability | Font sizes audited for 3m reading distance, contrast ratios checked |
| Design density | Card grid optimized for 1920x1080 with no wasted space |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Cards using formal shell anatomy | 11/11 |
| Shared UI pattern classes | 5 or more (skeleton, empty, stale, error, loading) |
| Theme x card matrix | All 66 combinations verified |
| Contrast ratio | WCAG AA on all text |

---

### Stream B2: Card Architecture Completion

Priority: **Medium-High**

Complete the migration from `initX()` to `FdbCard` instance pattern.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Audit | Catalog which cards still use `initX()` vs `FdbCard` |
| Migration | Convert remaining cards to `FdbCard` instances with `CardRuntime` contract |
| Registry-driven DOM | Replace static HTML card shells in `index.html` with `createShell()` calls |
| Instance lifecycle | Cards own their refresh schedule, DOM cache, and subscriptions |
| Cleanup | Remove dead `initX()` exports, dead HTML IDs, dead CSS selectors |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Cards on FdbCard pattern | 11/11 |
| Static HTML card shells | 0 (all registry-generated) |
| File-scoped mutable state | 0 (all instance state) |
| Dead HTML IDs | 0 |

---

### Stream H: Infrastructure and Release Engineering

Priority: **Medium**

#### Goals

Make shipping boring and safe.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| Version alignment | TypeScript, Node, and all tool versions aligned across app and worker |
| Contributor setup | Documented install story: `cd MyScripts && npm install` then all tools available |
| Release automation | `release:report` script validates all gates, produces pass/fail summary |
| Preview deploys | PR-triggered preview deploys for visual review (Cloudflare Pages or Netlify) |
| SLSA provenance | Add `actions/attest-build-provenance` to release workflow |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Contributor setup | Documented and unsurprising |
| Release gates | Automated pass/fail report |
| Preview deploys | Available on PRs |

---

### Stream SW: Service Worker Modernization

Priority: **Medium**

The Service Worker is vanilla JS with `__APP_VERSION__` replacement at build time. It works but is hard to test and type-check.

#### Action Plan

| Phase | Deliverables |
| --- | --- |
| TypeScript migration | `sw.ts` compiled to `sw.js` at build time via Vite plugin |
| Shared constants | Import `SW_VERSION`, `CACHE_NAME` from `src/core/sw-constants.ts` (already exists) |
| Precache manifest | Auto-generated from Vite build output instead of hardcoded `APP_SHELL` array |
| API cache strategy | Configurable per-origin TTL (weather: 30 min, news: 15 min, hebcal: 6 h) |
| Background sync | Queue failed `POST /api/errors` for retry when online |

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| SW in TypeScript | Compiled, type-checked in CI |
| Precache manifest | Auto-generated from build |
| Per-origin TTL | Configurable, not hardcoded |

---

## 6. Release Plan

### v8.0 — Architecture Convergence

The next major release consolidates the v7 transition and completes every half-finished migration.

**Required outcomes:**

- Test suite consolidated (Stream G.1): under 27 s run time, 30 or fewer `resetModules` calls
- Playwright visual regression (Stream G.2): 18 baseline screenshots in CI
- Worker normalization (Stream W): all routes return domain contracts, Zod validation
- FdbCard migration (Stream B2): all 11 cards on instance pattern
- Shared tooling (Stream I-0): all 4 TS projects on shared configs
- Config fully namespaced (Stream E): all cards migrated
- Documentation (Streams I, J): full SVG diagrams, .github modernization, environment standards

### v8.1 — Storage and Edge Cache

- IDB-first persistent cache (Stream D2)
- Worker KV for high-value providers
- LS cleanup: config + flags only
- Stronger stale-state and degraded-state UX

### v8.2 — Visual and Accessibility Quality

- Theme x card audit complete (Stream F)
- Lighthouse CI: accessibility >= 95, performance >= 90
- Card shell primitives formalized
- Contrast ratios meet WCAG AA

### v9.0 — Advanced Features (Optional)

Only pursue if justified by real product need:

- News aggregation on worker (17 RSS to single normalized feed)
- Encrypted config backup/restore to personal URL
- Multi-device config sync via Cloudflare KV
- Widget marketplace (allow third-party card plugins)

---

## 7. Architecture Principles

All future work follows these principles:

1. **Product truth over roadmap neatness** — only plan what we will actually build
2. **Incremental convergence over grand rewrites** — finish half-done migrations before starting new ones
3. **Normalized data contracts over provider leakage** — cards render domain models, not upstream JSON
4. **Instance-owned lifecycle over file-owned mutable state** — FdbCard owns refresh, DOM, subscriptions
5. **TV readability over flashy UI tricks** — legible at 3 meters in a dark room
6. **Client simplicity over framework fashion** — vanilla TS with zero deps stays
7. **Edge-first data over client-side CORS hacks** — worker normalizes, validates, caches
8. **Documentation matches runtime reality** — no aspirational docs
9. **Observability as a feature** — diagnostics, health tracking, perf measurement are first-class
10. **No new persistence layer without product need** — localStorage to IDB to KV progression only when justified
11. **Protect unique strengths** — zero deps, RTL-first, TV design, offline resilience, massive test suite

---

## 8. Immediate Next Actions

After this roadmap is committed, execute in this order:

1. **Stream G.1** — Test consolidation (biggest developer-experience win, unblocks fast iteration)
2. **Stream W** — Worker normalization (biggest data architecture improvement, enables Stream D2)
3. **Stream I-0** — Shared tooling (unblocks other projects, reduces config drift)
4. **Stream G.2** — Playwright visual regression (biggest quality gap vs competitors)
5. **Stream B2** — FdbCard migration completion (resolves dual-architecture tension)
6. **Stream I + J** — .github modernization + environment standards (configuration debt)
7. **Stream E + F** — Config namespacing + visual system (product polish)
8. **Stream D2** — Storage migration (infrastructure hardening)
9. **Stream H** — Release engineering (process maturity)
10. **Stream SW** — Service Worker modernization (tech debt)

---

## 9. Consolidated Legacy Items

Items from the old roadmap, resolved to final status:

| Old Item | Final Status |
| --- | --- |
| EventTarget state store | Done. Keep and extend. |
| FdbCard base class | Foundation done. Complete adoption in Stream B2. |
| Shadow DOM migration | De-scoped (ADR-001). Never revisit unless hard encapsulation need emerges. |
| Worker tests in CI | Done. Maintain. |
| IDB cache support | Foundation done. Complete operational model in Stream D2. |
| localStorage to IDB migration | Partially done. Complete in Stream D2. |
| Dynamic registry-driven layout | Foundation exists (`createShell`). Complete in Stream B2. |
| Config namespacing | v5 schema started. Complete in Stream E. |
| Proxy removal in production | `__USE_PROXIES__=false` in prod builds. Consider removing proxy code entirely. |
| OpenAPI completeness | `worker/openapi.yaml` exists. Expand alongside Stream W normalization. |
| Playwright / visual regression | New: Stream G.2. |
| Lighthouse CI | New: Stream G.2. |
| Monorepo/workspaces migration | Rejected. Flat structure with Node walk-up is simpler. |
| Doc consolidation | Streams I + J. |
| React/Next.js rewrite | Rejected (ADR-005). Never revisit. |
| Authentication | Rejected. Static PWA, no auth. |
| Relational database | Deferred until multi-device sync need is real. |
| Framework rewrite | Rejected. Vanilla TS stays. |
