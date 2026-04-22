# FamilyDashBoard — Strategic Roadmap

> Roadmap refresh date: 2026-04-22
> Shipped baseline: **v10.0.0** — 3193 tests / 94 suites / 0 failures · 0 ESLint warnings · 0 TS errors · 0 Prettier issues · 0 runtime deps
> This document reopens every major architecture decision — including those that previously looked clean — and sets the explicit path to best-in-class as an always-on family information display.

---

## 0. Executive Summary

FamilyDashBoard is a **zero-dependency, TypeScript, Hebrew-RTL, TV-optimised family information dashboard** with an edge-proxied data plane (Cloudflare Workers) and a four-tier offline cache (in-memory → localStorage → IndexedDB → Service Worker).

At **v10.0.0** the foundations are extraordinarily solid:

- 100% strict TypeScript, zero runtime deps, `@layer`-governed CSS
- Full offline PWA with auto-generated precache manifest and per-origin TTL
- Edge API proxy with Zod validation and KV stale-fallback
- 3193 unit tests, Playwright E2E + visual regression, Lighthouse CI
- 15 ADRs, comprehensive instruction/skill/prompt AI customisation

The gaps toward **best-in-class** are now about **depth of product, rigour of observability, and breadth of the data plane** — not foundational architecture. This roadmap defines the next three major releases (v11, v12, v13) and rejects work that would dilute our unique strengths.

---

## 1. Competitive Landscape (refreshed)

Five top open-source dashboard projects studied. None share our exact product niche (always-on TV family display with Hebrew RTL) but each has patterns worth harvesting.

### 1.1 Comparison Table

| Dimension              | **FamilyDashBoard v10.0.0** | **Homepage** (gethomepage) | **Dashy** (Lissy93)    | **Homer** (bastienwirtz) | **Homarr** (homarr-labs) | **Glance** (glanceapp)  |
| ---------------------- | --------------------------- | -------------------------- | ---------------------- | ------------------------ | ------------------------ | ----------------------- |
| GitHub stars (approx)  | ~30                         | 29.6 K                     | 24.7 K                 | 11.3 K                   | 7.1 K                    | 14.2 K                  |
| Purpose                | Family TV/wall display      | Service dashboard          | Personal dashboard     | Static homepage          | Homelab management       | News + feeds dashboard  |
| Frontend               | **Vanilla TS + Vite 8**     | Next.js (React)            | Vue 3                  | Vue 3 + Vite             | Next.js + Mantine        | Go-rendered HTML        |
| CSS                    | **Vanilla `@layer` tokens** | Tailwind                   | SCSS + themes          | SCSS + themes            | Mantine CSS-in-JS        | Custom CSS              |
| Backend                | **Cloudflare Worker**       | Node reverse-proxy         | Express                | None (static)            | Node + Drizzle ORM       | Go server               |
| Database               | **None** (IDB + LS)         | None (YAML)                | None (YAML / cloud KV) | None (YAML)              | SQLite (Drizzle)         | None (YAML)             |
| Tests                  | **3193 + Playwright**       | Vitest partial             | Vitest partial         | None                     | Vitest partial           | Go tests                |
| TypeScript coverage    | **100% strict**             | ~1 % JS-dominant           | Vue 68 / TS 22         | Vue 86 / JS 5            | 98 %                     | N/A (Go)                |
| Runtime deps           | **0**                       | react, next, tailwind, …   | vue, axios, …          | vue, lodash, …           | next, mantine, trpc, …   | 0 (single Go binary)    |
| Themes                 | **6 dark, auditable**       | CSS vars                   | 50 + built-in          | YAML custom              | Mantine                  | 1 (custom via CSS)      |
| i18n                   | **Hebrew + English**        | 40 + languages             | 20 + languages         | YAML-based               | 30 + languages           | English-only            |
| Deployment             | **Static PWA + Pages**      | Docker-first               | Docker + metal         | Docker + static zip      | Docker-first             | Single Go binary        |
| Live-data integrations | **11 deep cards**           | 100 + widgets (shallow)    | 50 + widgets           | Smart cards (limited)    | 30 + integrations        | 12 feed types           |
| Offline / PWA          | **Full SW + 4-tier cache**  | No                         | Basic PWA              | Installable PWA          | No                       | No                      |
| RTL                    | **Native, Hebrew-first**    | Partial                    | Partial                | No                       | Partial                  | No                      |
| Auth                   | **None (intentional)**      | Host check / rev-proxy     | Keycloak + basic       | None                     | OIDC / credentials       | None (self-hosted)      |
| Config model           | **UI panel + JSON**         | YAML + Docker labels       | YAML + UI              | YAML                     | UI drag-drop             | YAML                    |
| Visual regression      | **Playwright screenshots**  | None                       | None                   | None                     | Argos CI                 | None                    |
| Edge proxy / CORS      | **Worker KV + Zod**         | Server proxy               | Proxy chain            | N/A                      | Server proxy             | N/A (server-rendered)   |
| CI gates               | **tsc+eslint+vitest+LH+VR** | Docker + tests             | Docker build           | Build only               | Build + tests            | Go build + test         |
| License                | MIT                         | GPL-3.0                    | MIT                    | Apache-2.0               | MIT                      | AGPL-3.0                |
| Release cadence        | Sprint-based (30+ in v7-10) | Weekly                     | Monthly                | Quarterly                | Weekly                   | Monthly                 |
| Supply-chain risk      | **Zero (0 runtime deps)**   | Medium (react/next churn)  | Medium (vue ecosystem) | Low                      | High (next + mantine)    | Zero (single Go binary) |

### 1.2 What to Harvest (and what to reject)

| Pattern from a competitor                                  | Source                 | Our verdict                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Docker label auto-discovery**                            | Homepage               | **Reject** — we are not a homelab launcher. However the underlying idea (self-describing service registry) already exists via `CardRegistryEntry` + `configSchema`. Make that contract a first-class feature. |
| **100 + widgets**                                          | Homepage, Dashy        | **Reject** — breadth at the cost of shallowness. Our 11 cards are deep (multi-source, offline-capable, provider-adapted). Make adding a new card trivially easy via skill + templates (keep scope narrow).    |
| **50 + themes**                                            | Dashy                  | **Reject** — a TV dashboard is watched passively. 6 hand-tuned dark themes is the right number. Instead, **raise theme quality** with automated screenshot regression per theme × screen mode.                |
| **40 + languages (Crowdin)**                               | Homepage, Homarr       | **Reject** — family product scope does not need this. `i18n.ts` infrastructure supports adding a language without touching every file, so the door stays open without paying the ongoing cost.                |
| **Visual regression (Argos CI)**                           | Homarr                 | **Adopt (DONE in v8.5.0)** — Playwright screenshots in CI. Next step: extend to config panel, diagnostic overlay, maximised-card views.                                                                       |
| **SQLite + Drizzle ORM**                                   | Homarr                 | **Reject** — introduces a database where none is needed. Our config lives in localStorage + IDB and is user-owned. A DB would create multi-device sync expectations we do not want to meet.                   |
| **OIDC / auth**                                            | Homarr                 | **Reject** — static PWA, single household device, auth adds zero value and infinite attack surface.                                                                                                           |
| **Zero runtime deps in backend (Go binary)**               | Glance                 | **Reconsider for worker** — could we replace Zod with hand-written type guards to get back to zero deps? See §5.1 re-open.                                                                                    |
| **YAML config + UI editor**                                | Homer, Dashy           | **Reject YAML** — families edit with a pointer, not an editor. Our UI-first config panel is superior. Keep JSON export for power-user backup.                                                                 |
| **Lighthouse CI in PRs**                                   | Many                   | **Adopt (DONE in v8.4.0)** — `.lighthouserc.json` exists. Next: tighten thresholds (acc ≥ 98, perf ≥ 95) after v11 quality sprint.                                                                            |
| **Web Components via Lit**                                 | Many modern dashboards | **Reopen** — we build FdbCard as a class but not a Web Component. Lit would give us encapsulation without a VDOM penalty. Weighed in §5.2.                                                                    |
| **Cloudflare Web Analytics (cookie-less RUM)**             | None of the above      | **Adopt (proposed v11)** — privacy-preserving, free, gives us real page-load and error metrics in production.                                                                                                 |
| **Sentry-class error tracking**                            | Most production SaaS   | **Reject SaaS Sentry** — privacy + dependency. **Adopt** our worker `/api/errors` route with KV storage and a diagnostic export. Already wired; expand storage & dashboarding in v11.                         |
| **Sub-resource Integrity (SRI) on third-party scripts**    | Security best-practice | **N/A** — zero third-party scripts. SRI not applicable. Document the decision.                                                                                                                                |
| **Content-Security-Policy meta + `connect-src` allowlist** | Security best-practice | **Adopt (proposed v11)** — strict CSP in `index.html` meta + HTTP header via GitHub Pages. Zero deps to add; significant security posture boost.                                                              |
| **Cross-Origin-Opener-Policy / COEP / COOP headers**       | Security best-practice | **Adopt (proposed v11)** — unlocks `performance.measureUserAgentSpecificMemory()` and high-resolution timers for profiling.                                                                                   |
| **Durable Objects for shared rate-limit state**            | Cloudflare ecosystem   | **Defer** — current 100 K req/day free tier + KV cache + per-client back-off is enough. Revisit when real data shows hot-spots.                                                                               |
| **PWA install + custom icon + splash**                     | Every PWA              | **Adopt** — manifest exists; polish v11: adaptive icon, splash screens, iOS + Android install prompts, first-run tour.                                                                                        |
| **Background sync for failed error reports**               | PWA best-practice      | **Adopt (DONE in v8.6.0)** — `_queueErrorReport` + `_flushErrorQueue` exists. Extend to any failed POST in v11.                                                                                               |

### 1.3 Our Unique Strengths (protect and amplify)

1. **Zero runtime deps** — no supply-chain risk, instant startup, total bundle control (~75 KB gzip today)
2. **TV-first design at 3 metres** — no other dashboard optimises for wall-mounted readability at distance
3. **Hebrew RTL-first** — genuine differentiator; bidi + zmanim + Hebcal + Sefaria integrated
4. **Edge-first data layer** — Cloudflare Worker kills CORS chains and adds KV stale fallback
5. **4-tier offline resilience** — mem → LS → IDB → SW; always renders something even with zero connectivity
6. **3193 tests — highest test density of any project in the comparison** — plus Playwright E2E + visual regression + Lighthouse CI
7. **Static PWA, no auth, no DB** — zero operational complexity for the end user
8. **Shared-monorepo toolchain** — tools resolve from parent `MyScripts/`, configs vendored into `tooling/`, CI is fully self-contained

---

## 2. Product North Star

FamilyDashBoard is a best-in-class always-on family command centre: **fast, calm, honest, offline-resilient, and TV-beautiful**.

### 2.1 Success Metrics — v10.0.0 status

| Area                                       | Target                                         | v10.0.0 status                   |
| ------------------------------------------ | ---------------------------------------------- | -------------------------------- |
| Time to first meaningful content           | < 1.5 s on cached desktop                      | ~1.2 s ✅                        |
| Empty-card rate after boot                 | 0 on cached sessions                           | ~0 ✅                            |
| Upstream outage resilience                 | Stale OR fallback for every card               | 8/11 cards ⚠ (see §5.4)          |
| Production JS size                         | < 200 KB gzip                                  | ~75 KB gzip ✅                   |
| Accessibility                              | Lighthouse ≥ 95                                | 97 in CI ✅                      |
| Performance                                | Lighthouse ≥ 90                                | 94 in CI ✅                      |
| Visual regressions caught                  | Screenshot coverage all themes × screen modes  | 18 baselines ✅ (need expansion) |
| Documentation drift                        | Docs refreshed in same release as code changes | Met for v9 + v10 ✅              |
| Test suite health                          | 0 failures, < 30 s total                       | 0 failures, ~35 s ⚠              |
| Real-user monitoring (RUM)                 | Privacy-preserving metrics in production       | ❌ Missing (planned v11)         |
| Security posture                           | Strict CSP, COOP/COEP, no third-party scripts  | ❌ Missing (planned v11)         |
| `@media (prefers-reduced-motion)` honoured | All transitions ≥ 200 ms respect the setting   | Partial ⚠                        |

### 2.2 What "best-in-class" means here

Not "most features" or "most stars" — but:

1. **Zero surprise** on cold boot, stale network, or broken upstream
2. **Zero regression** on any theme, language, screen mode, or cached state
3. **Zero drift** between docs, ADRs, runtime behaviour, and release notes
4. **Zero ongoing cost** to operate (no DB, no paid tier, no SaaS dependency)
5. **Zero attack surface** expansion with each release

---

## 3. First-Principles Rethink — every major decision reopened

Every decision below was re-examined against what would maximise the product mission **today in 2026**, not what was true when the decision was first made. We deliberately reopened decisions that seemed settled.

### 3.1 Frontend Language & Framework

| Decision                                     | Current                   | Reopened — verdict                                   | Rationale                                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                                   | TS 6.0.3 strict           | **Keep**                                             | All competitors are converging on strict TS. Our 100 % coverage with `verbatimModuleSyntax` + `noUnusedLocals` is exemplary.                                                                                  |
| Build tool                                   | Vite 8 + Rollup           | **Keep for v11**, monitor Rolldown/Rspack            | Vite 8 is fast, stable, SSR-capable. Rolldown (Rust-based replacement) is alpha; Rspack is production-ready but not Vite-compatible at feature parity. Re-evaluate in v12.                                    |
| Runtime framework                            | Vanilla DOM + FdbCard     | **Keep — reconfirm ADR-005**                         | Rendering is imperative and card-scoped. React/Vue would add 40–120 KB, a hydration story, and contributor friction for zero product gain at our scale. Revisit only if the app grows past 30 cards.          |
| **Web Components via Lit**                   | Not used                  | **Reject**                                           | Lit would add ~5 KB and encapsulation. We already get 90 % of the benefit via `FdbCard` + CSS `@layer`. Shadow DOM breaks global theming (ADR-001). Not worth the runtime dep.                                |
| **Preact (10-KB React)**                     | Not used                  | **Reject**                                           | Any VDOM adds cost. We render in < 1.2 s with zero VDOM today. No re-entry point for this debate unless a card family requires heavy reactive composition.                                                    |
| Module format                                | ES Modules native         | **Keep**                                             | Correct forever for this scale.                                                                                                                                                                               |
| Zero runtime deps                            | 0 deps                    | **Keep in client** · **Allow exactly one in worker** | Worker uses Zod (validation) — a justified exception. Client stays at 0. Any new client dep requires an ADR and a rejected-alternatives section.                                                              |
| CSS methodology                              | Vanilla `@layer` + tokens | **Keep**                                             | Tailwind adds ~50 KB and a build step; CSS-in-JS adds runtime cost. Our `@layer tokens, themes, base, layout, components, animations` stack with design tokens and `color-mix()` is modern and cascade-aware. |
| **Lightning CSS / Parcel CSS at build time** | Not used                  | **Adopt in v11**                                     | Tree-shake unused CSS, autoprefix, minify better than PostCSS. Vite has first-party support. Low risk, high value.                                                                                            |
| State management                             | `state.ts` EventTarget    | **Keep and extend**                                  | 70-line pub/sub, zero deps, debuggable via `window.__FDB_STATE__`. Signals (TC39 proposal) could replace it but the proposal is still stage-1. Revisit in v13.                                                |

### 3.2 Card & Component Architecture

| Decision                 | Current                                 | Reopened — verdict                      | Rationale                                                                                                                                       |
| ------------------------ | --------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `FdbCard` base class     | 11/11 cards migrated (v8.4.0)           | **Consolidate — prune `initX()` paths** | B2 stream is done but some dead `initX()` exports remain alongside new FdbCard instances. Remove them in v11.                                   |
| Registry-driven DOM      | `createShell()` exists, partly wired    | **Complete in v11**                     | `index.html` still contains some hard-coded card shells. DOM-generate 11/11 from the registry so adding a card never touches `index.html`.      |
| Async card loaders       | 11/11 on `createAsyncCardLoader`        | **Keep**                                | IDB-first with stale chip, network refresh in background. Best-in-class pattern.                                                                |
| Provider adapters        | 7/10 providers behind an adapter        | **Complete in v11**                     | Every upstream API goes through a `ProviderAdapter<T>` that returns a normalised domain type. No raw upstream JSON reaches card rendering code. |
| Error boundaries         | Per-card try/catch + `showError()`      | **Keep, standardise**                   | Add a `withErrorBoundary()` wrapper that unifies all 11 cards' error presentation and telemetry hook.                                           |
| Accessibility landmarks  | `<section>` per card                    | **Expand**                              | Add explicit `role="region" aria-labelledby="…"`, keyboard focus order, `aria-live="polite"` for refreshing data (v11).                         |
| `prefers-reduced-motion` | Partially honoured                      | **Complete audit (v11)**                | Every animation ≥ 200 ms must short-circuit under the media query. Currently ~60 % coverage.                                                    |
| `<dialog>` overlays      | Diagnostics, config both use `<dialog>` | **Keep**                                | Correct modal pattern. No third-party modal library needed ever.                                                                                |

### 3.3 Backend & Infrastructure

| Decision                   | Current                      | Reopened — verdict                             | Rationale                                                                                                                                                                                          |
| -------------------------- | ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker          | Single worker, route-based   | **Keep — harden**                              | Free tier is generous (100 K req/day). Alternative (Deno Deploy, Bun deploy, Netlify edge) would introduce vendor migration cost for zero gain. Lock-in risk is mitigated by our adapter pattern.  |
| **Vendor-neutral runtime** | `workerd` specific           | **Reject as current target**                   | Would force dropping `workers-types`, KV, Durable Objects. Not worth it until we actually need to migrate.                                                                                         |
| KV stale cache             | stocks, crypto, alerts (W.9) | **Expand to every route**                      | v11: add weather, currency, news, hebcal, sefaria, calendar — every outbound call has a KV fallback with per-origin TTL.                                                                           |
| Zod in worker              | Upstream response validation | **Keep**                                       | Justified runtime dep. Alternative: hand-written type guards to get to zero-dep worker — costs ~400 LoC, saves ~12 KB. Revisit in v12.                                                             |
| Database                   | **None**                     | **Reject adding DB**                           | No product need. Config is user-owned. Provider health and error telemetry can live in KV (key-per-day aggregates). A real DB would open multi-device-sync expectations we do not want to promise. |
| Deployment                 | GitHub Pages + CF Workers    | **Keep**                                       | Zero cost, zero ops. Perfect for this product.                                                                                                                                                     |
| CORS proxy chain           | Tree-shaken out of prod      | **Keep dev-only fallback**                     | `__USE_PROXIES__=false` in prod builds strips proxy code entirely. Confirmed via bundle analyzer. Keep the dev-mode chain for working offline from non-Cloudflare machines.                        |
| Rate-limit strategy        | Per-IP in worker             | **Extend with Durable Objects (defer to v12)** | Current in-memory rate-limit is fine for 100 K req/day. DOs would let us do per-client adaptive back-off when upstream returns 429. Nice-to-have, not must-have.                                   |
| **CDN caching headers**    | Basic `Cache-Control` set    | **Audit and tighten in v11**                   | `immutable` on fingerprinted assets; `stale-while-revalidate` on the HTML shell; `no-store` on the worker root. Some mis-set today.                                                                |

### 3.4 Data Sources & External APIs

| Provider              | Current                             | Reopened — verdict             | Action (planned release)                                                                                       |
| --------------------- | ----------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Weather (Open-Meteo)  | Worker-proxied, Zod-validated       | **Keep**                       | v11: add `api.met.no` as backup provider behind the same `WeatherAdapter`.                                     |
| Stocks (Yahoo v8)     | Worker + KV stale                   | **Hedge — high breakage risk** | v11: add Finnhub (free tier 60 req/min) as backup. Yahoo v8 is unofficial and has broken twice historically.   |
| Currency              | ER-API + ExchangeRate dual          | **Keep**                       | v11: add metals provider for gold/silver (today hardcoded from weekly fetch).                                  |
| News (17 RSS)         | Client-aggregated, proxy-fallbacked | **Move aggregation to worker** | v11 priority: `/api/news` returns one deduplicated normalized feed. Saves ~200 ms boot and ~40 KB client JSON. |
| Calendar (Google ICS) | Worker proxy                        | **Keep, harden ICS parsing**   | v11: recurring-event expansion on worker side; exception handling for malformed VEVENTs.                       |
| Hebrew Cal (Hebcal)   | Worker + KV stale (W.3)             | **Keep**                       | v11: annual pre-warm of next year's holidays at New Year's.                                                    |
| Alerts (Tzeva Adom)   | Worker + KV stale (W.9)             | **Keep**                       | v12: adaptive polling (fast during alert window, slow otherwise).                                              |
| Sefaria               | Worker-proxied                      | **Keep**                       | v11: Zod validation of Sefaria response shape (uncaught today).                                                |
| Bitcoin (CoinGecko)   | Worker `/api/crypto` (W.7)          | **Keep**                       | Already moved off direct fetch.                                                                                |
| Background images     | Direct HTTPS, 30-min rotate         | **Keep**                       | v12: optional user-provided URL list instead of curated default.                                               |

### 3.5 Testing & Quality

| Decision             | Current                           | Reopened — verdict                      | Rationale                                                                                                                                   |
| -------------------- | --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest + happy-dom   | 3193 tests / 94 suites            | **Keep, optimise run-time**             | Happy-dom is 3x faster than JSDOM. Move the ~15 slowest suites to isolated worker threads in v11 to drop run-time under 30 s.               |
| Playwright E2E       | Smoke + critical-flows + VR       | **Extend coverage**                     | v11: add flows for config import/export, maximise-return, alert banner, night dimmer toggle, keyboard shortcut matrix.                      |
| Visual regression    | 18 baselines (6 themes × 3 modes) | **Expand to overlays**                  | v11: add VR for config panel, diagnostic overlay, update banner, maximised card, alert banner. Target 30 baselines.                         |
| Lighthouse CI        | acc ≥ 95, perf ≥ 90               | **Tighten**                             | v11: acc ≥ 98, perf ≥ 95, best-practices ≥ 95, seo ≥ 90.                                                                                    |
| Mutation testing     | None                              | **Reject as ongoing practice**          | Stryker is slow (2–4× test run time) and our branch coverage of 81 % suggests limited payback. Consider a one-off audit in v12 as evidence. |
| Property-based tests | None                              | **Adopt fast-check for cache + config** | v11: `fastcheck` property tests for `cGet/cSet` expiry logic, config migration, ICS parsing edge cases.                                     |
| Coverage thresholds  | 90 / 81 / 90 / 92                 | **Raise after G.1**                     | v11 target: 92 / 85 / 92 / 94. Already within reach without test additions.                                                                 |
| A11y testing         | Lighthouse only                   | **Add axe-core in Playwright**          | v11: axe-core run per screen mode in CI, 0 serious/critical violations gate.                                                                |

### 3.6 Documentation

| Decision          | Current                            | Reopened — verdict        | Rationale                                                                                                                                   |
| ----------------- | ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md` | v10.0.0 accurate                   | **Keep, add flow charts** | Already has Mermaid flow + sequence diagrams. Add: error-reporting pipeline, SW install/activate/fetch timing, card mount/unmount sequence. |
| ADR folder        | 15 ADRs                            | **Add 3 in v11**          | ADR-016 error-reporting contract · ADR-017 Lightning CSS adoption · ADR-018 CSP + COOP/COEP posture.                                        |
| README            | Comprehensive + badges             | **Keep, tighten install** | Add one-screen quick-start block; link to `docs/local-dev.md`.                                                                              |
| ROADMAP.md        | This document                      | **This is the rewrite**   | Replaces accumulated sprint tables with a single compact historical log + forward-looking streams.                                          |
| OpenAPI           | `worker/openapi.yaml`              | **Extend**                | Document every worker route, error envelope, KV stale flag, rate-limit response in v11.                                                     |
| `docs/` folder    | 5 guides + 15 ADRs                 | **Keep**                  | Add `docs/security.md` in v11 alongside CSP work.                                                                                           |
| AI customisation  | agents/skills/prompts/instructions | **Polish in v12**         | Tighten frontmatter, standardise on MCP server capability matrix, add `release-check.prompt` triggered in release workflow.                 |

### 3.7 Tooling, CI, and Supply Chain

| Decision                    | Current                                                    | Reopened — verdict                              | Rationale                                                                                              |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Parent `MyScripts/` install | Shared `node_modules` + `tooling/` presets                 | **Keep**                                        | Monorepo walk-up resolution is simpler than pnpm/Yarn workspaces and has zero config.                  |
| Shared configs              | tsconfig base, ESLint factory, Vitest base, Stylelint base | **Expand usage**                                | Migrate BudgetManager + CrossTideWeb + Wedding to the same presets in v12 (cross-project work).        |
| GitHub Actions              | 8 workflows                                                | **Harden in v11**                               | Every workflow: explicit `permissions: read-all` + job-level writes, `concurrency` group, pinned SHAs. |
| SLSA build provenance       | Attached to release artifact                               | **Keep**                                        | Already generates SLSA Level 2. Evaluate Level 3 (hermetic build) in v12.                              |
| Dependency review           | Dependabot monthly                                         | **Add `actions/dependency-review` on every PR** | Zero-config, catches Dependabot lag. v11.                                                              |
| npm audit                   | In CI                                                      | **Keep**                                        | `audit-level=high` fails CI. Current: 0 high+. Good.                                                   |
| Secret scanning             | GitHub-native                                              | **Keep**                                        | No self-hosted secret store; nothing to rotate.                                                        |
| **Pinned action SHAs**      | Mixed (some `@v4`, some SHA)                               | **Standardise on SHAs in v11**                  | Trivial to automate via Dependabot rewriting.                                                          |

### 3.8 Observability

| Decision             | Current                                     | Reopened — verdict                      | Rationale                                                                                                   |
| -------------------- | ------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Client diagnostics   | `diagLog()` + `D` overlay + provider health | **Keep, add export**                    | v11: `ctrl+shift+E` to export diagnostic snapshot as JSON for user support.                                 |
| Error telemetry      | `error-reporter.ts` → `/api/errors`         | **Extend — add KV storage + dashboard** | v11: worker stores last 1000 errors in KV with 7-day TTL. Public read endpoint behind a simple token.       |
| Real-user monitoring | None                                        | **Add Cloudflare Web Analytics**        | v11: cookie-less, privacy-preserving, free. Drops into `<head>` with zero runtime cost.                     |
| Performance budgets  | Bundle-size script                          | **Extend with Vite bundle-visualiser**  | v12: track per-card JS/CSS contribution, alert on 10 % growth.                                              |
| Web Vitals           | Not measured in field                       | **Add `web-vitals` inline (~1 KB)**     | v11: vendor (not npm) the 40 LoC needed for CLS/LCP/FID/INP. Report to `/api/errors` with the same batcher. |

### 3.9 Security & Privacy

| Decision           | Current                      | Reopened — verdict          | Rationale                                                                                                                 |
| ------------------ | ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Authentication     | None                         | **Reject adding auth**      | Single-household display, not a multi-tenant SaaS. Auth would be the largest attack surface in the app.                   |
| Privacy            | No telemetry without consent | **Keep, document**          | Add `docs/privacy.md` in v11 explaining: no cookies, no PII, no tracking, user opts into error reports.                   |
| CSP                | None                         | **Adopt strict CSP in v11** | `default-src 'self'; img-src 'self' https: data:; connect-src 'self' fdb.rajwanyair.workers.dev api.*; script-src 'self'` |
| COOP / COEP / CORP | None                         | **Adopt in v11**            | Enables high-res timers and memory profiling; no runtime cost.                                                            |
| HSTS + preload     | GH Pages default HSTS        | **Document**                | Pages sets a reasonable HSTS; preload requires domain apex control — N/A for `*.github.io`.                               |
| SRI                | N/A                          | **Document decision**       | Zero third-party scripts. Decision already recorded — make explicit in `docs/security.md`.                                |
| Secret handling    | No app secrets               | **Keep**                    | Worker uses `ERROR_REPORTING_TOKEN`; rotated via `wrangler secret put`. Nothing stored in repo.                           |

### 3.10 Developer Experience

| Decision              | Current                                            | Reopened — verdict                       | Rationale                                                                                                       |
| --------------------- | -------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| VS Code config        | settings/tasks/launch + MCP                        | **Keep, expand MCP**                     | v11: add GitKraken usage guide + Azure/GitHub MCP server matrix in `.github/copilot/MCP_SERVERS.md`.            |
| Copilot customisation | 15 instructions + 4 skills + 14 prompts + 2 agents | **Keep, tighten**                        | v11: reduce duplication between instruction and skill files; standardise frontmatter on all agents.             |
| Local dev workflow    | `docs/local-dev.md`                                | **Keep (new in v10)**                    | Document is 12-point verification checklist. Good baseline.                                                     |
| Pre-commit hooks      | None                                               | **Reject for now**                       | Full `npm run check` is ~40 s. Run in editor via tasks + CI. Pre-commit would add friction with little payback. |
| Commit linting        | None                                               | **Consider Conventional Commits in v12** | Would enable automated CHANGELOG. Low priority until release cadence stabilises.                                |

---

## 4. Strategic Streams (v11 → v13+)

Each stream has an owner concept, deliverables, and explicit exit criteria. Streams are ordered by **value × feasibility / cost**.

### 4.1 Stream V11-SEC — Security Posture (v11.0 — TOP PRIORITY)

Close the largest remaining gap vs best-in-class: security headers and observable field health.

| Deliverable                                                     | Status |
| --------------------------------------------------------------- | ------ |
| Strict CSP meta tag + HTTP header via Pages                     | [x]    |
| COOP / COEP / CORP headers                                      | [x]    |
| `docs/security.md` with threat model + decisions                | [x]    |
| `docs/privacy.md` with user-visible promises                    | [x]    |
| `dependency-review` Action on every PR                          | [x]    |
| All Actions pinned to SHA (Dependabot auto-rotation configured) | [x]    |
| ADR-018: CSP + COOP/COEP + CORP decision record                 | [x]    |

Exit: browser DevTools "Security" panel shows no warnings on production; Observatory grade ≥ A+.

### 4.2 Stream V11-OBS — Observability (v11.0)

| Deliverable                                                                 | Status |
| --------------------------------------------------------------------------- | ------ |
| Cloudflare Web Analytics in `<head>` (cookie-less, privacy-preserving)      | [x]    |
| Web Vitals (CLS / LCP / INP) reported to `/api/errors` via same batcher     | [x]    |
| Worker stores last 1000 error reports in KV with 7-day TTL                  | [ ]    |
| Public (token-gated) `/api/errors/export` endpoint + `docs/error-viewer.md` | [ ]    |
| `Ctrl+Shift+E` exports local diagnostic snapshot as JSON                    | [x]    |
| ADR-016: Error reporting contract + KV storage model                        | [x]    |

Exit: first error in production surfaces in the worker KV within 60 s; user can email a diagnostic JSON snapshot.

### 4.3 Stream V11-A11Y — Accessibility Rigour (v11.0)

| Deliverable                                                             | Status |
| ----------------------------------------------------------------------- | ------ |
| axe-core run per screen mode in Playwright CI (0 serious/critical gate) | [x]    |
| `prefers-reduced-motion` honoured by every animation ≥ 200 ms           | [ ]    |
| Explicit landmarks (`role="region" aria-labelledby`) on all 11 cards    | [x]    |
| `aria-live="polite"` for refreshing cards                               | [x]    |
| Keyboard focus-order audit + visible focus ring tokens                  | [ ]    |
| Screen-reader manual test (NVDA desktop + VoiceOver mobile) + write-up  | [ ]    |
| Lighthouse accessibility ≥ 98 in CI                                     | [ ]    |

Exit: WCAG 2.2 AA compliant on all 6 themes × 3 screen modes; axe-core reports 0 serious/critical.

### 4.4 Stream V11-DATA — Worker Data Plane (v11.0)

| Deliverable                                                                                                                                  | Status |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `/api/news` aggregates 17 RSS feeds, deduplicates, returns one normalized JSON                                                               | [x]    |
| KV stale-fallback extended to weather, currency, hebcal, sefaria, calendar                                                                   | [x]    |
| Every worker route returns `WorkerResponse<T>` envelope (done ✅) and Zod-validated upstream (done ✅ for 7/10 routes; complete remaining 3) | [ ]    |
| Backup providers behind adapter: `met.no` (weather), Finnhub (stocks), second metals source                                                  | [ ]    |
| Worker OpenAPI `openapi.yaml` documents every route, envelope, and stale flag                                                                | [ ]    |
| ADR updates: expand ADR-011 (normalization contract) to cover news aggregation + news dedup algorithm                                        | [ ]    |

Exit: client never parses raw upstream JSON; every provider has a documented backup; no worker route blocks on unbounded upstream time.

### 4.5 Stream V11-PERF — Performance Sharpening (v11.0)

| Deliverable                                                                   | Status |
| ----------------------------------------------------------------------------- | ------ |
| Lightning CSS at Vite build time (autoprefix, minify, tree-shake)             | [x]    |
| Lighthouse performance ≥ 95 in CI (current 94)                                | [ ]    |
| TTI < 1.0 s on cached desktop (current ~1.2 s)                                | [ ]    |
| Drop Vitest run time below 30 s (isolate slowest 15 suites in worker threads) | [ ]    |
| Bundle-size budget alert at 10 % growth                                       | [ ]    |

Exit: CI-enforced perf budgets; no card adds > 5 KB gzip without an ADR.

### 4.6 Stream V11-PWA — Polish (v11.0)

| Deliverable                                                           | Status |
| --------------------------------------------------------------------- | ------ |
| Adaptive icons (iOS mask + Android maskable)                          | [x]    |
| Splash screens for each install target                                | [ ]    |
| First-run tour (keyboard shortcuts + card explanation) — dismissable  | [x]    |
| In-place SW update UX (progress bar, no forced reload where possible) | [ ]    |

Exit: installable PWA passes Chrome install checklist; iOS add-to-home-screen experience is polished.

### 4.7 Stream V11-DX — Developer Experience (v11.0)

| Deliverable                                                                                  | Status |
| -------------------------------------------------------------------------------------------- | ------ |
| Property-based tests (`fast-check` dev dep in parent) for cache + config + ICS parser        | [x]    |
| Coverage raised to 92 / 85 / 92 / 94                                                         | [x]    |
| Instruction & skill frontmatter linter (custom script in `scripts/`)                         | [ ]    |
| Removal of dead `initX()` exports alongside FdbCard                                          | [ ]    |
| Registry-driven DOM: 11/11 cards mounted via `createShell()` (index.html has no card shells) | [ ]    |
| ADR-017: Lightning CSS adoption                                                              | [ ]    |

### 4.8 Stream V12-FOUND — Foundation Modernisation (v12.0)

| Deliverable                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- |
| Evaluate Rolldown / Rspack as Vite bundler replacement                                                              |
| Signals-based state (TC39 stage advances) or refined EventTarget                                                    |
| Vendor-neutrality audit: `worker/src` runs on Deno Deploy & Bun (as side-migration exercise, not production switch) |
| Durable Objects for adaptive per-client rate-limit on alerts                                                        |
| Hand-written type guards vs Zod in worker — revisit zero-dep worker                                                 |
| Mutation testing one-off audit (Stryker)                                                                            |
| SLSA Level 3 (hermetic build) evaluation                                                                            |

### 4.9 Stream V12-X — Cross-Project Harmonisation (v12.0)

| Deliverable                                                                                    |
| ---------------------------------------------------------------------------------------------- |
| BudgetManager adopts `tooling/eslint/web-ts-app.mjs` + `tooling/tsconfig/base-typescript.json` |
| CrossTideWeb adopts `tooling/eslint/web-ts-app.mjs`                                            |
| Wedding adopts `tooling/eslint/js-browser-app.mjs`                                             |
| `tooling/README.md` becomes the cross-project developer handbook                               |

### 4.10 Stream V13+ — Optional Evolution (only if justified)

| Candidate                                  | Gate                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Encrypted config backup to user-chosen URL | Only if families request multi-device setup                                           |
| Plugin card registry (third-party cards)   | Only if > 5 external contributors want it                                             |
| Alexa / Google Home voice intents          | Only if passive display is not enough                                                 |
| AI summary card (local Hebrew LLM)         | Only if a quantised open-weight Hebrew model fits in < 20 MB and runs at useful speed |
| Multi-household deployment                 | Never — out of scope                                                                  |

---

### 4.11 Stream V11-CARD-VIDEO — Video News Card (`video-news`)

Priority: **High — target v11.1** · Owner card: new 12th card in the registry · First integration: **C14 live stream** from `https://www.c14.co.il/live`.

Introduces the first **video-content card** to the dashboard. Unlike the 11 existing data cards, this one renders a live media stream — so the design must solve autoplay policy, mute-by-default, HLS fallback, CSP implications, and graceful offline degradation without breaking the rest of the dashboard.

#### Product Goals

- A **muted, auto-playing, low-interaction live news window** visible from 3 m on the wall-display
- **Channel-selectable** in v11.1 (C14 first; i24news, Now14, Arutz 7 live as follow-ups — all Israeli news channels with public live streams)
- **Zero impact** on the rest of the dashboard when the stream is unreachable (graceful fall-back to a still image + "stream unavailable" state)
- **User-controlled** audio via `M` keyboard shortcut (mute toggle) and `V` shortcut (channel switch); no audio by default
- Respects `prefers-reduced-motion` (pause video when user prefers reduced motion; show a still frame instead)

#### Research Phase — Source Discovery (v11.1-sprint-1)

C14 embeds its player on `/live` via Next.js. The actual stream URL must be discovered — it is **not** a simple iframe copy-paste. Research deliverables:

| Task                                                         | Output                                                                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Inspect `https://www.c14.co.il/live` in DevTools Network tab | Document whether it is YouTube Live iframe, Kaltura, JW Player, Brightcove, or native HLS `.m3u8`                       |
| Capture manifest / embed URL                                 | Record the stream URL, its `referer` / `origin` requirements, any auth token, expiry behaviour                          |
| Verify CORS policy                                           | If HLS, note whether `Access-Control-Allow-Origin` permits `https://rajwanyair.github.io`                               |
| Evaluate `<iframe>` embed vs direct `<video>` playback       | Decide integration mode (see §Integration Modes below)                                                                  |
| Check Terms of Service                                       | Confirm re-embedding on a private family display is within C14 ToS (personal/non-commercial use is typically permitted) |
| Rate-limit and abuse risk                                    | Note hot-link protection, geographic blocks, expected refresh cadence                                                   |

**Security constraint:** any decision must not relax our strict-CSP posture being introduced in v11.0 (Stream V11-SEC). The new card contributes a new `connect-src` / `media-src` / `frame-src` entry, which is explicitly allow-listed in `index.html` meta-CSP and documented in `docs/security.md`.

#### Integration Modes (decision tree)

| Mode                                         | When to choose                                                                      | Pros                                                                                 | Cons                                                                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Native `<video>` + HLS**                | The `.m3u8` stream is CORS-permitted OR the worker can proxy it                     | Zero runtime dep; full autoplay/mute control; lightest bundle; muted poster possible | Requires HLS playback; Safari does HLS natively, Chrome/Firefox need a JS player                                                                                     |
| **B. Worker-proxied HLS (`/api/video/c14`)** | CORS blocks direct playback                                                         | Works for any HLS source; our standard adapter pattern; KV-cacheable manifests       | Adds worker egress bandwidth; Cloudflare free tier allows 10 GB/day egress which is plenty                                                                           |
| **C. `<iframe>` embed of provider player**   | The provider publishes an official embed (e.g. YouTube Live `/embed/<id>`)          | Zero integration cost; provider handles player logic and ads                         | Breaks our zero-runtime-dep rule indirectly (provider loads ~500 KB player code); CSP needs `frame-src <provider>`; RTL chrome leaks; no mute control across origins |
| **D. Vendored HLS player (`hls.js`)**        | Native `<video>` + HLS insufficient (Chrome/Firefox playback on non-Safari clients) | Full control over autoplay/mute/recovery; mature library; ~30 KB gzip                | First client-side runtime dep — requires ADR-019 + mitigation (vendor, not npm)                                                                                      |

**Recommended default: Mode A → fallback Mode B → last resort Mode C.** Mode D only if Mode A+B cannot deliver on Chromium. If Mode D is required, vendor `hls.js` into `src/vendor/hls.min.js` (not an npm dep) and document as a justified exception in an ADR.

#### Architecture

```text
src/cards/video-news/
├── fdb-video-news.ts            # FdbCard subclass
├── video-news.ts                # Channel switcher, player wiring, mute/unmute, error state
├── video-news.css               # Aspect-ratio box, poster, overlay controls, RTL caption strip
├── video-news-adapter.ts        # Per-channel provider: returns normalised StreamDescriptor
└── __tests__/                   # Unit tests (via tests/unit/cards/video-news.test.ts)

src/types/api.ts
  + interface StreamDescriptor {
      id: 'c14' | 'i24' | 'now14' | 'arutz7';
      title: string;                 // he+en
      mode: 'hls' | 'iframe' | 'worker-hls';
      url: string;                   // Playback URL OR iframe src OR worker route
      poster?: string;               // Fallback still image
      refererRequired?: boolean;
      cspHosts: {                    // Contributed to global CSP allowlist
        connect?: string[];
        media?: string[];
        frame?: string[];
      };
    }

worker/src/routes/video.ts         # Only if Mode B selected
  /api/video/c14/manifest.m3u8    # Proxies + rewrites HLS manifest (fixes segment URLs)
  /api/video/c14/segment/*        # Proxies individual TS segments; sets Cache-Control
  KV: video:c14:healthcheck       # Last successful ping + timestamp
```

#### Card Configuration Schema (joins existing config panel)

```typescript
// types/config.ts additions
interface VideoNewsConfig {
  enabled: boolean; // Default: false (opt-in)
  channel: "c14" | "i24" | "now14" | "arutz7"; // Default: 'c14'
  autoplay: boolean; // Default: true
  defaultMuted: boolean; // Default: true (browser autoplay policy)
  showOverlay: boolean; // Default: true (RTL caption strip with channel name + time)
  pauseOnReducedMotion: boolean; // Default: true (WCAG)
  pauseAtNight: boolean; // Default: true (respects night-dimmer schedule)
}
```

#### Service Worker & Cache Policy

- **Stream manifests** (`.m3u8`): `no-store` (always fresh) — add `video.c14.co.il` (or actual manifest host) to `API_CACHE_ORIGINS` in `sw.ts` with `ttl = 0`
- **Stream segments** (`.ts` / `.mp4`): `no-store` (SW must never cache media segments — they expire in seconds and would balloon the cache)
- **Poster image**: `cache: 'stale-while-revalidate'` with 24 h TTL
- **Worker route (if Mode B)**: `/api/video/*` routes return `Cache-Control: no-store`; KV only stores health-check metadata, not media bytes

#### Performance Budget

| Metric                                      | Target                                                         |
| ------------------------------------------- | -------------------------------------------------------------- |
| Added JS (gzip) if Mode A                   | < 3 KB                                                         |
| Added JS (gzip) if Mode D (vendored hls.js) | < 35 KB                                                        |
| CPU while video is playing                  | < 15 % on Raspberry Pi 4 (our reference wall-display hardware) |
| Network (1080p30 HLS)                       | ~3–5 Mb/s sustained; acceptable for home Wi-Fi                 |
| Fall-back latency when stream dies          | < 5 s to poster + "stream unavailable" state                   |

#### Accessibility & UX

- `<video>` has `aria-label="C14 live news broadcast — muted"` (updates on channel switch)
- Mute toggle button is a real `<button>` with `aria-pressed`; visible focus ring
- `M` keyboard shortcut: toggle mute; `V`: cycle channel; both announced in `docs/keyboard.md`
- When `prefers-reduced-motion: reduce` is set: video is paused, poster shown, `aria-live` region announces "video paused, reduced-motion preference active"
- Closed captions: enable where the stream provides them (WebVTT via HLS `SUBTITLES` rendition)

#### Security (CSP integration)

`index.html` meta-CSP additions (v11.0-SEC already introduces the base policy; this card extends it):

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    connect-src 'self' https://fdb.rajwanyair.workers.dev
                <c14-manifest-host>           <!-- populated from StreamDescriptor.cspHosts.connect -->
                <c14-segment-host>;
    media-src   'self' <c14-segment-host> blob:;
    frame-src   'none';                       <!-- stays 'none' unless Mode C is chosen -->
    img-src     'self' data: https:;
    script-src  'self';
    style-src   'self' 'unsafe-inline';       <!-- existing -->
  "
/>
```

`docs/security.md` gains a dedicated "Video streams" section documenting the allow-list and the opt-in nature of the card.

#### Error States & Degraded UX

| State                        | UI                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Stream unreachable           | Poster image + "שידור לא זמין · נסיון חוזר בעוד 30 שניות" overlay; exponential back-off (30 s → 2 min → 10 min) |
| Manifest parse failure       | Same fallback; `diagLog('video-news', { err, channel })` for diagnostics overlay                                |
| CORS block in DevTools       | Switch to worker-proxied mode (Mode B) on next refresh; cache health flag in KV so all clients learn            |
| Autoplay blocked by browser  | Show a single large **▶** overlay — single click starts playback; state remembered for the session              |
| `navigator.onLine === false` | Show poster + "אין חיבור לאינטרנט"; no refresh attempts while offline                                           |
| Night-dimmer active          | If `pauseAtNight=true`: pause video, dim poster; resume at `dim_end`                                            |

#### Test Plan

| Layer             | Coverage                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit              | Adapter returns correct `StreamDescriptor` per channel; reducer logic for mute/channel state                                                               |
| Unit (card)       | `video-news.test.ts`: mount, unmount, destroy, config-change reactions, mute toggle, error state rendering                                                 |
| Integration       | `tests/integration/video-stream.test.ts`: simulated HLS 404 triggers fallback UI within 5 s                                                                |
| Worker            | `worker/src/routes/video.test.ts`: manifest rewrite correctness, segment pass-through, KV health flag                                                      |
| Playwright E2E    | Card mounts, poster shown, channel switch keyboard shortcut, mute toggle — no audio leakage                                                                |
| Visual regression | New baselines: 6 themes × 3 screen modes × (playing / paused / error) = 54 screenshots (use a fixture `<video>` source — do NOT record live traffic in CI) |
| Lighthouse        | No regression in Lighthouse performance budget with card enabled                                                                                           |

#### Sprint Breakdown

| Sprint                                    | Deliverable                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **v11.1-sprint-1** (Research)             | DevTools investigation of `c14.co.il/live`; mode decision (A/B/C/D); ADR-019 recorded                 |
| **v11.1-sprint-2** (Scaffold)             | `src/cards/video-news/` skeleton; `StreamDescriptor` type; registry entry; disabled-by-default config |
| **v11.1-sprint-3** (Mode A/B integration) | HLS playback working for C14 in dev + production; worker route `/api/video/c14/*` if Mode B           |
| **v11.1-sprint-4** (CSP + security)       | Meta-CSP extended; `docs/security.md` section added; ADR-019 cross-references ADR-018                 |
| **v11.1-sprint-5** (UX polish)            | Mute toggle, channel switcher, keyboard shortcuts `M` / `V`, reduced-motion pause, error states       |
| **v11.1-sprint-6** (Tests)                | Unit + integration + Playwright + VR baselines; Lighthouse budget re-validated                        |
| **v11.1-sprint-7** (Additional channels)  | i24news, Now14, Arutz 7 behind the same `StreamDescriptor` contract — only if ToS + CORS pass         |

#### Exit Criteria (v11.1 ships when all true)

- [ ] `video-news` card rendered, registered, configurable via the UI config panel
- [ ] C14 live stream plays muted in Chrome + Edge + Safari + Firefox on cached load
- [ ] Card reaches error-state within 5 s when the stream is killed; recovers within 30 s when it returns
- [ ] `M` mutes/unmutes; `V` cycles channel; both announced to screen readers
- [ ] `prefers-reduced-motion` pauses playback and shows a poster
- [ ] Strict CSP remains in force; new hosts are documented in `docs/security.md` and ADR-019
- [ ] Bundle-size growth: < 3 KB gzip for Mode A, < 35 KB gzip for Mode D
- [ ] 54 new visual regression baselines committed and green
- [ ] Lighthouse performance ≥ 93 with card enabled (budget: no more than 2 points below the baseline of 95)
- [ ] No regression in any of the existing 11 cards' tests
- [ ] Docs: `docs/adding-a-card.md` updated with the video-card variant; new `docs/video-cards.md` covers CSP, channel schema, and how to add channel #5
- [ ] ADR-019 "Video content card — provider integration modes and CSP implications" committed

#### Open Questions (to resolve in Research sprint)

1. Does C14 publish a stable HLS manifest, or is the player proprietary (Kaltura / Brightcove / internal)?
2. Is CORS `Access-Control-Allow-Origin: *` present on their manifest? If not, is worker-proxying acceptable under their ToS?
3. Does the stream require an auth token or bearer that rotates? If so, who regenerates it — the worker?
4. Is the channel georestricted? Our primary audience is inside Israel, so this is low risk.
5. Is there an ad-roll in the live stream? If so, do we mute through it, skip it, or accept it as-is (passively displayed ads are tolerable on a family TV dashboard)?
6. Is an official embed (e.g. YouTube Live mirror) available that we would prefer for simplicity? Worth a check before committing to direct HLS.

---

## 5. Release Plan

### 5.1 v11.0 — Security, Observability & Data Rigour (target: mid-2026)

**Ship gates:** all V11-\* streams green. Minimum deliverables:

- Strict CSP + COOP/COEP in production
- Cloudflare Web Analytics live + Web Vitals reporting
- axe-core in CI + reduced-motion audit + WCAG 2.2 AA
- `/api/news` aggregation live; KV stale fallback on all 10 worker routes
- Lighthouse acc ≥ 98, perf ≥ 95
- 3 new ADRs committed (error reporting, Lightning CSS, CSP)
- Vitest run-time < 30 s
- Coverage 92 / 85 / 92 / 94

### 5.2 v11.1 — Video News Card (C14 + channel framework) (target: after v11.0 ships)

**Ship gates:** all exit criteria in §4.11 met.

- `video-news` card live with C14 working in Chrome + Edge + Safari + Firefox
- CSP allow-list extended and documented in `docs/security.md`
- ADR-019 committed (provider integration modes + CSP implications)
- 54 new visual regression baselines; no perf regression vs v11.0 baseline
- If hls.js vendored: committed under `src/vendor/` with SHA-pinned source notes

### 5.3 v12.0 — Foundation Refresh & Cross-Project Harmonisation

- Bundler re-eval (Rolldown / Rspack / stay on Vite)
- Zero-dep worker experiment (Zod → type guards)
- Cross-project tooling adoption (BudgetManager, CrossTideWeb, Wedding)
- Durable Objects for adaptive alerts rate-limit
- Conventional Commits + automated CHANGELOG
- SLSA Level 3 hermetic build evaluation

### 5.4 v13.0 — Optional Product Evolution

Only the candidates from §4.10 that pass their gate. Product-first, not feature-first.

---

## 6. Architecture Principles (v10.0.0 edition)

1. **Product truth over roadmap neatness** — plan only what we will build
2. **Incremental convergence over grand rewrites** — finish before starting
3. **Normalised data contracts over provider leakage** — cards render domain models, not raw upstream JSON
4. **Instance-owned lifecycle over file-scoped state** — `FdbCard` owns refresh, DOM, subscriptions, teardown
5. **TV readability over flashy UI tricks** — legible at 3 metres in a dark room
6. **Client simplicity over framework fashion** — vanilla TS with zero client deps stays
7. **Edge-first data over client-side CORS hacks** — worker normalises, validates, caches
8. **Observability as a first-class feature** — `diagLog`, provider health, perf marks, Web Vitals, error telemetry
9. **Documentation matches runtime reality** — no aspirational docs; ADRs for every reversal
10. **No new persistence layer without product need** — LS → IDB → KV progression only when justified
11. **Protect unique strengths** — zero deps, RTL-first, TV design, offline resilience, massive test suite
12. **Every dependency has an ADR** — client must stay at 0; worker has exactly one (Zod), reviewed each major release
13. **Security posture improves every major release** — CSP today, COEP next, SLSA L3 after

---

## 7. Immediate Next Actions

Execute in this order. Each becomes a v11.x sprint.

1. **v11.0-SEC-1** — Strict CSP + COOP/COEP headers + `docs/security.md` + ADR-018
2. **v11.0-OBS-1** — Cloudflare Web Analytics + Web Vitals inline reporter → `/api/errors`
3. **v11.0-DATA-1** — `/api/news` aggregator route (17 RSS → 1 normalized feed)
4. **v11.0-A11Y-1** — axe-core in Playwright + reduced-motion audit + landmarks
5. **v11.0-PERF-1** — Lightning CSS at build time + Vitest run-time under 30 s
6. **v11.0-DATA-2** — KV stale fallback extended to weather/currency/hebcal/sefaria/calendar
7. **v11.0-DX-1** — Registry-driven DOM (remove card shells from `index.html`); prune dead `initX()` paths
8. **v11.0-PWA-1** — Adaptive icons, splash screens, first-run tour, in-place SW update
9. **v11.0-OBS-2** — Error KV storage + export endpoint + diagnostic JSON export
10. **v11.0-DX-2** — Coverage raise to 92/85/92/94; property-based tests for cache + config + ICS

Release v11.0 when all 10 are green.

**Immediately after v11.0:**

11. **v11.1-VIDEO-1** — Research sprint: decode C14 live stream from `c14.co.il/live`; pick integration mode (A/B/C/D); write ADR-019 (see §4.11)
12. **v11.1-VIDEO-2** — Implement `video-news` card end-to-end (C14 only), including CSP extension, tests, and 54 VR baselines
13. **v11.1-VIDEO-3** — Add i24news / Now14 / Arutz 7 behind the same `StreamDescriptor` contract (only if ToS + CORS pass)

Release v11.1 when all §4.11 exit criteria are green.

---

## 8. Consolidated Legacy Items

Items from prior roadmaps, finalised:

| Legacy item                    | Final status                                                              |
| ------------------------------ | ------------------------------------------------------------------------- |
| EventTarget state store        | ✅ Done. Extended across config/cache/ui. Keep.                           |
| FdbCard base class             | ✅ 11/11 migrated (v8.4.0). Prune dead `initX()` in v11.                  |
| Shadow DOM                     | ❌ De-scoped (ADR-001). Not revisited.                                    |
| Worker tests in CI             | ✅ Done. 19-test Zod schema suite + route tests.                          |
| IDB cache                      | ✅ `cGetAsync` + `createAsyncCardLoader` on all 11 cards (v8.4.0–v8.8.0). |
| localStorage → IDB migration   | ✅ Done (D2.8 audit confirmed LS limited to config + flags).              |
| Dynamic registry-driven layout | ⚠ Partial. Complete in v11 (stream V11-DX).                               |
| Config namespacing             | ✅ All 11 cards use `cards: Record<string, CardConfig>` (E.1).            |
| Proxy removal in production    | ✅ `__USE_PROXIES__=false` tree-shakes proxy code out of prod bundles.    |
| OpenAPI completeness           | ⚠ Partial. Expand in v11 (stream V11-DATA).                               |
| Playwright / visual regression | ✅ Done (v8.5.0). Extend overlays in v11.                                 |
| Lighthouse CI                  | ✅ Done (v8.4.0). Tighten thresholds in v11.                              |
| Monorepo / workspaces          | ❌ Rejected. Flat parent-install is simpler.                              |
| Doc consolidation              | ✅ Done (Sprint 8.9.0 + 9.3.0). Continue ADR habit.                       |
| React / Next.js rewrite        | ❌ Rejected (ADR-005). Not revisited.                                     |
| Authentication                 | ❌ Rejected. Static PWA, no auth.                                         |
| Relational database            | ❌ Rejected. LS + IDB + KV is sufficient.                                 |
| News aggregation on worker     | ⚠ Pending. V11 priority (stream V11-DATA).                                |
| Web Components / Lit           | ❌ Rejected (§3.1). FdbCard + `@layer` gives 90 % of the benefit.         |
| Preact                         | ❌ Rejected (§3.1).                                                       |
| Signals for state              | ⏳ Revisit when TC39 proposal reaches stage 3 (v13+).                     |
| SQLite / DB                    | ❌ Rejected (§3.3).                                                       |
| Crowdin / > 2 languages        | ❌ Rejected (§1.2).                                                       |
| 50 + themes                    | ❌ Rejected (§1.2). 6 is the right number.                                |
| 100 + widgets                  | ❌ Rejected (§1.2). Depth over breadth.                                   |

---

## 9. Historical Release Log (condensed)

One line per release. Detailed per-sprint tables are in `CHANGELOG.md`.

| Version | Date       | Theme                                                                                    | Tests/Suites |
| ------- | ---------- | ---------------------------------------------------------------------------------------- | ------------ |
| v7.0.0  | 2025-Q4    | TypeScript migration + modular `src/`                                                    | 1390 / 41    |
| v7.13.0 | 2025-Q4    | ARCHITECTURE.md + ADRs + CardRuntime + domain types                                      | 1762 / 52    |
| v7.17.0 | 2026-Q1    | Worker normalisation foundation + release reports                                        | 2287 / 68    |
| v7.19.0 | 2026-Q1    | Per-card configSchema + provider latency + observability                                 | 2405 / 72    |
| v7.21.0 | 2026-Q1    | Shared test helpers + normalised worker types                                            | 2571 / 77    |
| v8.0.0  | 2026-Q1    | Test consolidation + dead-file cleanup + v5 config                                       | 3053 / 87    |
| v8.3.0  | 2026-Q2    | Playwright E2E + per-origin SW TTL + `WorkerResponse<T>` envelope                        | 3080 / 88    |
| v8.4.0  | 2026-Q2    | FdbCard 11/11 + critical-flow E2E + Lighthouse + ADR-010                                 | 3087 / 88    |
| v8.5.0  | 2026-Q2    | VR baselines (18) + precache manifest + KV stale W.2 + configSchema 11/11                | 3129 / 91    |
| v8.6.0  | 2026-Q2    | HebCal KV + CSS dedup + ADR-011 + SW.2 bg-sync queue                                     | 3143 / 92    |
| v8.7.0  | 2026-Q2    | Tasks/news/system-info async + sw.ts sourcemaps + Zod weather                            | 3153 / 93    |
| v8.8.0  | 2026-Q2    | `/api/crypto` + NewsRssSchema + D2.8 LS audit + ADR-012 + sw.ts TS                       | 3205 / 95    |
| v8.9.0  | 2026-Q3    | Sprint 8.9 consolidation (20 tasks) + Mermaid diagrams + `.prettier*`                    | 3205 / 95    |
| v9.0.0  | 2026-Q3    | CI self-sufficiency + vendored `tooling/` + Node 22+ CI                                  | 3179 / 94    |
| v9.1.0  | 2026-04-22 | Prettier enforced + Sprint 9.1 docs refresh + `ci_status.json` purge                     | 3179 / 94    |
| v9.2.0  | 2026-04-22 | Worker KV stale (W.9) + CSS utilities + ADR-013/014/015 + 4 tooling presets              | 3193 / 94    |
| v9.3.0  | 2026-04-22 | Sprint 9.3 consolidation + Mermaid flow/sequence + 15-file version bump                  | 3193 / 94    |
| v10.0.0 | 2026-04-22 | **First major release** — CI bail + GitKraken MCP + `docs/local-dev.md` + legacy cleanup | 3193 / 94    |

Total: **30 + production sprints**, 0 regressions through v10.0.0.

---

**Roadmap owner:** Reuven Airhar · **Last reviewed:** 2026-04-22 · **Next review:** on v11.0.0 release.
