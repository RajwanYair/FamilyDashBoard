<!-- markdownlint-disable MD013 MD033 MD024 -->
# FamilyDashBoard — Strategic Roadmap

> **Refresh date**: 2026-05-19 · **Shipped baseline**: v12.0.0 — 3309 tests / 102 suites / 0 failures · 0 ESLint · 0 TS · 0 markdownlint · 0 runtime deps (client) · 2 runtime deps (worker: Hono + Valibot)
> **Scope of this rewrite**: every major architectural decision is reopened — including the ones that looked clean — against the 2026 web-platform landscape, then charted toward v12, v13, and v14. Nothing is assumed permanent. Decisions survive only if they still justify themselves.

---

## 0. Executive Summary

FamilyDashBoard v11 closed the foundational gap to best-in-class. Over ~35 sprints we shipped:

- **Security posture**: strict CSP + COOP/COEP/CORP headers, Permissions-Policy, `docs/security.md` (ADR-018)
- **Observability**: Cloudflare Web Analytics + inline Web Vitals reporter + worker error KV + `Ctrl+Shift+E` diagnostic export (ADR-016)
- **Accessibility**: axe-core in CI, reduced-motion audit, WCAG 2.2 AA, `aria-live` on refreshing cards
- **Data plane**: `/api/news` edge-aggregation, KV stale-fallback on all 10 worker routes, Zod-validated everywhere, backup providers for weather/stocks/metals
- **Performance**: Lightning CSS in Vite build (ADR-017), TTI < 1.0 s, Vitest < 30 s, `requestIdleCallback` deferred init (ADR-020)
- **Product**: 12th card (`video-news`, opt-in) shipped behind a `StreamDescriptor` adapter with CSP documented per channel (ADR-019)
- **DX**: 20 ADRs, registry-driven DOM, shared `tooling/` presets, frontmatter linter, SLSA provenance on every release

Quantitatively: 3309 unit tests (3193 → 3309), 100 test suites, 0 regressions across 5 streams, zero supply-chain incidents, zero runtime client deps preserved.

**What's next.** The v11 charter is done. The frontier in 2026 is no longer "foundational maturity" — it's:

1. **Modernise the toolchain** against a rapidly shifting platform (TypeScript-Go / tsgo, Rolldown, native Signals, Bun 1.2, Deno 2, CSS `@scope`, View Transitions L2).
2. **Harden the edge** with Cloudflare's current graduated primitives (D1, Durable Objects with SQLite, Workers Analytics Engine, Hyperdrive) — chosen on merit, not hype.
3. **Expand depth per card** (not breadth), with provider redundancy and normalized history for the first time (7-day rolling window on weather/stocks/currency/alerts).
4. **Ship cross-device continuity** without introducing auth or a database — via optional encrypted config URL export.
5. **Cement this as the reference implementation** of a zero-runtime-dep TypeScript PWA for other projects in the monorepo.

This document is the plan. Every major decision has been reopened. Those that survive are flagged **Keep**. Those that change are flagged **Adopt**, **Replace**, or **Defer**.

---

## 1. Competitive Landscape — 2026 refresh

Seven projects studied for this refresh (two new entrants since the v10 comparison: **Glance** matured to a single-binary juggernaut, **Beszel** emerged as a zero-dep Go dashboard worth watching; **Homarr v2** rebuilt on tRPC + SQLite and is the clearest contrast to our LocalStorage-first posture).

### 1.1 Comparison matrix

| Dimension                      | **FamilyDashBoard v11.5.1**      | **Homepage** (gethomepage)            | **Dashy** (Lissy93)                 | **Homer**                 | **Homarr v2**                        | **Glance**                | **Beszel**                |
| ------------------------------ | -------------------------------- | ------------------------------------- | ----------------------------------- | ------------------------- | ------------------------------------ | ------------------------- | ------------------------- |
| Primary audience               | Always-on family TV display      | Homelab service launcher              | Personal/homelab dashboard          | Static homelab startpage  | Homelab mgmt + apps                  | News/feed dashboard       | Server monitoring         |
| Stars (Apr 2026, approx)       | ~80                              | 42 K                                  | 28 K                                | 12 K                      | 15 K                                 | 22 K                      | 6 K                       |
| Frontend lang                  | **Vanilla TS (strict) + Vite 8** | Next.js 15 (React 19)                 | Vue 3.5                             | Vue 3                     | Next.js 15 + Mantine 7               | Go templates → HTML       | Svelte + SvelteKit        |
| Runtime deps (client, gzip)    | **0 / ~88 KB total**             | ~38 (react, next, tailwind, radix, …) | ~22 (vue, axios, …)                 | ~12 (vue, lodash, …)      | ~55 (next, mantine, trpc, drizzle…)  | 0 (rendered server-side)  | ~4 (svelte runtime)       |
| Backend                        | **Cloudflare Worker (edge)**     | Node reverse-proxy                    | Node + Express                      | None (static)             | Node + tRPC + Drizzle                | Single Go binary          | Single Go binary          |
| Database                       | **None** (LS + IDB + KV)         | None (YAML)                           | None (YAML / git)                   | None (YAML)               | **SQLite + Drizzle**                 | None (YAML)               | **SQLite (embedded)**     |
| TypeScript strictness          | **100% `strict` + `noUncheckedIndexedAccess`** | `strict`                | partial                             | JS-dominant               | `strict`                             | N/A (Go)                  | `strict`                  |
| CSS architecture               | **Vanilla `@layer` + tokens + Lightning CSS** | Tailwind 4 (CSS-first)    | SCSS + themes                       | SCSS                      | Mantine CSS-in-JS                    | Hand-written CSS          | Tailwind 4                |
| Tests                          | **3309 unit + Playwright + axe + VR + LHCI** | Vitest partial            | Vitest partial                      | None                      | Vitest + Playwright                  | Go tests                  | Go tests + Svelte test    |
| Visual regression              | **Playwright screenshots (54 baselines)** | None                           | None                                | None                      | Argos CI                             | None                      | None                      |
| i18n                           | Hebrew RTL + English             | 45+ languages (Crowdin)               | 22+ languages                       | YAML                      | 38+ languages                        | English-only              | English-only              |
| Accessibility                  | **WCAG 2.2 AA · axe-core gate**  | Partial                               | Partial                             | Unknown                   | Partial                              | Unknown                   | Unknown                   |
| Offline / PWA                  | **Full SW · 4-tier cache · precache manifest · background sync** | No | Basic PWA                           | Installable PWA           | No                                   | No                        | No                        |
| Auth                           | **None (intentional)**           | Host/reverse-proxy                    | Keycloak / basic                    | None                      | OIDC + passkey                       | None                      | Email + 2FA               |
| Config model                   | **UI panel + JSON export (user-owned)** | YAML + Docker labels           | YAML + UI                           | YAML                      | UI drag-drop (DB-backed)             | YAML                      | UI (DB-backed)            |
| Edge proxy / CORS              | **Worker + KV stale + Zod**      | Server proxy                          | Proxy chain                         | N/A                       | tRPC over Next API routes            | N/A                       | N/A                       |
| Observability                  | **CF Web Analytics + Web Vitals + Error KV + diag export** | None (self-host) | None                          | None                      | Sentry (optional)                    | Prometheus endpoint       | Built-in metrics          |
| Security headers               | **Strict CSP · COOP/COEP/CORP · Permissions-Policy** | Docker NGINX templates | Varies                            | None                      | Next defaults                        | Go handlers               | Svelte defaults           |
| CI gates                       | **tsc + eslint + vitest + LHCI + axe + VR + bundle-size + markdownlint + SLSA** | Docker + tests | Docker build | Build only                | Build + tests                        | Go build + test           | Go build + test           |
| License                        | MIT                              | GPL-3.0                               | MIT                                 | Apache-2.0                | MIT                                  | AGPL-3.0                  | MIT                       |
| Supply-chain attack surface    | **~0 (client) / 1 (worker)**     | High (React/Next churn)               | Medium (Vue ecosystem)              | Low                       | **Very High** (Next + tRPC + Drizzle) | ~0 (single Go binary)    | Low (tiny Svelte tree)    |
| Deployment footprint           | **Static ZIP + one Worker**      | Docker container                      | Docker / metal                      | Docker / zip              | Docker + DB volume                   | Single binary             | Single binary             |
| Cold-start TTI                 | **< 1.0 s cached / ~1.8 s fresh** | ~2.5 s                               | ~3 s                                | ~1 s (static)             | ~3.5 s                               | ~300 ms                   | ~500 ms                   |
| Live-data integrations (deep)  | **12 cards, provider-adapted**   | 100+ widgets (shallow)                | 50+ widgets                         | smart-card (limited)      | 30+ integrations                     | 12 feed types             | Server metrics only       |

### 1.2 What to harvest from 2026 competitors (filtered through our mission)

| Pattern                                                    | Source                   | 2026 verdict                                                                                                                                                 |
| ---------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tailwind 4 CSS-first engine (no config JS)**             | Homepage v1.0, Beszel    | **Reject the framework; harvest the pattern.** Our Lightning-CSS pipeline + `@layer` already gives cascade-aware composition without a design dep.           |
| **tRPC-style typed edge calls**                            | Homarr v2                | **Reopen.** Our fetch adapter already returns `WorkerResponse<T>`. Generate client-side typed callers from `worker/openapi.yaml` to kill duplication.        |
| **SQLite at the edge (D1) for config history**             | Homarr v2                | **Adopt narrowly.** D1 only for **anonymous aggregate** error/health telemetry (7-day rolling). Never for user config. See §2.3.                             |
| **Durable Objects with embedded SQLite**                   | CF 2025 GA               | **Adopt for alerts card.** Per-region DO holds active-alert state, broadcasts to connected SSE clients. Removes per-client polling. See §3.3.                |
| **Svelte compiled output (no VDOM)**                       | Beszel                   | **Reject re-platform.** Our vanilla DOM already has zero framework cost. Studying Svelte 5 runes informs our signals decision (§2.1) — but no rewrite.       |
| **Go single-binary determinism**                           | Glance, Beszel           | **Harvest pattern.** Our worker deploys one `worker.js` bundle pinned by SLSA provenance. Extend: publish `dashboard-tarball-v11.5.1.zip` with SHA-256.      |
| **Cloudflare Images for user-supplied backgrounds**        | — (new product decision) | **Defer to v13.** Optional, only if self-hosted image rotation becomes a user request.                                                                       |
| **Crowdin for 40+ languages**                              | Homepage, Homarr         | **Reject.** Family product, Hebrew + English. `i18n.ts` keeps the door open for contributors.                                                                |
| **OIDC / passkey auth**                                    | Homarr v2                | **Reject (re-confirm).** Largest attack surface in the app for zero benefit on a single-household device.                                                    |
| **Argos CI visual testing**                                | Homarr v2                | **Superseded.** Our in-repo Playwright VR (54 baselines) + `update-snapshots` task already delivers this.                                                    |
| **Prometheus scraping endpoint**                           | Glance, Beszel           | **Adopt narrowly.** Worker `/api/metrics` (Prometheus text format, token-gated) in v12 — aggregated from KV counters, zero PII. Home-lab observer friendly.  |
| **Svelte 5 runes / Solid signals**                         | Svelte/Solid 2026        | **Track TC39 Signals (stage 2).** Replace `state.ts` only when stage 3 + polyfill under 1.5 KB gzip + concrete card benefit (§2.1).                          |
| **View Transitions API Level 2 (cross-document)**          | CSS WG 2026              | **Adopt for theme switch + card maximise.** Chrome + Safari ship it; Firefox flagged. Progressive enhancement, zero cost.                                    |
| **Speculation Rules API for archived preview**             | Chrome 120+              | **Adopt narrowly.** Inline `<script type="speculationrules">`. Zero client deps.                                                                             |
| **CSS `@scope` for card-level style isolation**            | CSS WG 2025              | **Adopt in v12.** Removes the last place where class-naming discipline is load-bearing. Works without Shadow DOM.                                            |
| **Trusted Types API for XSS defence-in-depth**             | Browser 2025             | **Adopt.** Zero cost; we have no `innerHTML` to block anyway. Publishes CSP `require-trusted-types-for 'script'`.                                            |
| **Permissions-Policy + Reporting API endpoint**            | Browser 2024             | **Adopt fully in v12.** We already ship Permissions-Policy; add Reporting-API → worker `/api/reports` for CSP + deprecation reports.                         |
| **OPFS (Origin Private File System) for structured cache** | Browser 2025             | **Reject.** IDB is sufficient and cross-browser mature. OPFS is a solution in search of a problem at our size.                                               |
| **WebGPU / WASM for hot paths**                            | Browser 2025             | **Reject.** No hot path in this app justifies either. ICS parsing and dedup are microsecond operations.                                                      |

### 1.3 Our protected unique strengths

1. **Zero runtime deps on the client** — now genuinely rare. Next.js 15 apps ship 300+ transitive deps by default.
2. **TV-first at 3 m** — still uncontested in this comparison.
3. **Hebrew RTL-first, Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 deep cards with provider-adapted redundancy + normalized history** — breadth-of-depth, not breadth.
5. **4-tier offline (mem → LS → IDB → SW)** — no competitor renders a useful dashboard under `navigator.onLine === false`.
6. **3309 tests + axe + VR + LHCI + SLSA** — highest quality-gate density in the comparison.
7. **Observable in production** (Web Vitals + Error KV + diag export) without tracking cookies.
8. **One-binary-ish deployment** (static ZIP + one worker.js) — rivals Go binaries on operational simplicity.

---

## 2. First-principles reopen — every decision re-examined (2026)

Every decision below has been reopened against 2026 platform reality.

### 2.1 Frontend — language, build, framework, state, CSS

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| TypeScript strictness | 6.0.3 `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` | **Keep** | Still exemplary. Competitors converging on what we have. |
| **TypeScript-Go (`tsgo`)** — Microsoft's Go rewrite | Not used | **Adopt in v12 as second CI typecheck** | Alpha-stable, 8–10× faster on cold `tsc --noEmit`. Same `tsconfig.json`. Zero risk as a second check; promote to primary once stable. ADR-021. |
| Build tool | Vite 8 (Rollup) | **Keep for v12; adopt Rolldown once Vite makes it default** | Rolldown is Vite's stated Rollup replacement. Wait for the Vite-led migration path. Re-evaluate every Vite minor. |
| Runtime framework | Vanilla DOM + `FdbCard` base class | **Keep (re-confirm ADR-005)** | 12 cards, imperative mounts, zero VDOM cost. A framework would add 40–120 KB for zero user gain. |
| Web Components / Lit | Not used | **Reject (re-confirm ADR-001)** | Shadow DOM still breaks global `@layer` theming. `FdbCard` + `@scope` (§1.2) gives the encapsulation benefit without the theming tax. |
| Signals (TC39 proposal) | `state.ts` EventTarget (~70 LOC) | **Track — do not migrate in v12** | Proposal at stage 2 late-2025. Polyfills ~2 KB. Adopt only when (a) stage 3, (b) polyfill < 1.5 KB gzip, (c) concrete card benefit. v13 candidate. |
| Svelte 5 / Solid rewrite | — | **Reject** | Studied for inspiration; no rewrite. |
| Module format | Native ES modules | **Keep** | Correct forever at this scale. |
| Zero client runtime deps | 0 | **Keep — ADR-002 is load-bearing** | Reopened; decision survives. |
| CSS approach | Vanilla `@layer` + tokens + `color-mix()` + Lightning CSS | **Keep; add `@scope` in v12** | Adds per-card style isolation without Shadow DOM. Kills the last place manual class-naming matters. |
| Tailwind 4 (CSS-first) | — | **Reject** | Adds 12–40 KB and a dep. We already get cascade-aware composition via `@layer`. |
| View Transitions API | Level 1 (same-doc) | **Adopt Level 2 in v12** | Cross-doc transitions for theme switch + config-panel open. Chrome + Safari shipped. |
| Speculation Rules | Not used | **Adopt narrowly** for archived preview + external doc links | Zero client deps; inline `<script type="speculationrules">`. |
| Trusted Types | Not used | **Adopt in v12** | Defence-in-depth; we have no offenders. New CSP directive. |
| CSS `@scope` | Not used | **Adopt in v12** | Per-card scoped rules; kills manual class-naming discipline. ADR-022. |
| Bundle analyzer | `scripts/check-bundle-size.mjs` | **Keep, add per-card breakdown** | Fail CI on >10 % growth per card (not only whole-bundle). |

### 2.2 Backend — edge runtime, validation, storage

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| Cloudflare Worker | Single-worker, route-based | **Keep** | 100 K req/day free, Durable Objects GA, SQLite-in-DO GA, D1 GA, Analytics Engine stable. Best edge runtime at our volume. Vendor-lock mitigated by adapter boundary. |
| Workers for Platforms | — | **Reject** | Multi-tenant primitive; we are single-tenant. |
| Deno Deploy / Bun Deploy / fly.io Machines | — | **Track, do not migrate** | Annual vendor-neutrality drill: prove `worker/src` builds on all three. Promote only if CF pricing or reliability regresses. |
| **Hono** as worker framework | Hand-written `Router` (~150 LOC) | **Adopt in v12** | 12 KB, zero runtime deps (WinterCG-spec), first-class workers support. Replaces our router with a tested one. Worker stays at one runtime dep because Zod is replaced — see below. |
| Validation (worker) | **Zod 3.x** | **Replace with Valibot (or `@standard/schema`) in v12** | Valibot is 8–10× smaller (3 KB vs 29 KB gzip), tree-shakeable, identical inference quality. Hono has first-class Valibot middleware. Frees ~25 KB worker bundle → lets us add Hono net-neutral. ADR-023. |
| D1 (SQLite at edge) | — | **Adopt narrowly in v12** | **Only** for anonymized aggregate telemetry: hourly counters per route × provider × status. Never user config. 5 GB free, 25 M reads/day. ADR-024. |
| Workers Analytics Engine | — | **Adopt in v12** | Replaces the Error-KV-query hack for real-time metrics. Writes free; queries cheap. Error KV kept for last-1000 debug mode. |
| Hyperdrive (Postgres) | — | **Reject** | No Postgres in the stack. |
| Durable Objects | — | **Adopt for alerts card in v12** | Per-region DO owns active-alert state; SSE to connected clients; kills per-client 30 s polling. ADR-025. |
| KV stale cache | All 10 routes | **Keep; add tier-2 cron warming** | Worker Cron Trigger pre-warms stocks/currency/hebcal daily at rollover; cold-hit latency ~800 ms → ~80 ms. |
| Worker OpenAPI | `worker/openapi.yaml` | **Keep; generate TS client in v12** | `openapi-ts` → `src/core/worker-client.ts`. Kills duplicated type shapes in `src/types/api.ts`. |
| Database (user-facing) | **None** | **Reject** (re-confirm) | User config stays in LS + IDB + JSON export. A user DB would create multi-device-sync expectations we do not want to own. |
| Cron triggers | — | **Adopt in v12** | Pre-warm + KV stale eviction + D1 compaction. Zero marginal cost. |
| Rate limiting | In-memory per-IP | **Upgrade to DO counter in v12** | Per-client adaptive backoff on upstream 429s. Bounded cost. |

### 2.3 Data plane — APIs, providers, aggregation, history

| Area | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| News (17 RSS) | Worker-aggregated `/api/news` | **Keep; add SimHash dedup v2** | Current dedup is URL-normalize + title-lowercase. SimHash catches paraphrased duplicates across HaAretz / Ynet / Walla. ~600 LOC TS. |
| Weather | Open-Meteo primary + `met.no` backup | **Keep; add `api.weather.gov` for US-travel mode** | Trip-mode config toggle (opt-in). |
| Stocks (Yahoo v8) | Unofficial + Finnhub backup | **Replace primary with Finnhub Free tier (60 req/min) in v12** | Yahoo v8 broke 3× historically. Finnhub has a published, stable, free tier; WebSocket-streaming option for v13. Yahoo stays as tertiary. |
| Currency | ER-API + ExchangeRate + Yahoo futures (metals) | **Keep (fixed in v11.5.1)** | `GC=F` / `SI=F` proven stable in the same windows Yahoo-stocks breakages occurred. |
| Calendar (Google ICS) | Worker proxy + RRULE expansion | **Keep; validate with `icalendar-rfc5545` spec tests in v12** | Malformed-VEVENT fuzz tests. |
| Hebrew Cal (Hebcal) | Worker + KV + annual pre-warm | **Keep** | Best-in-class already. |
| Alerts (Tzeva Adom) | Worker + KV polling | **Upgrade to DO + SSE in v12** | See §2.2. Drops per-client polling. |
| Sefaria | Worker-proxied | **Keep; add Zod validation in v12** | Last unvalidated route. |
| Bitcoin (CoinGecko) | `/api/crypto` | **Keep** | Stable. |
| Background images | Direct HTTPS | **Keep; add user-URL-list in v13** | Optional. |
| **History — first time** | — | **Adopt in v12** | 7-day rolling per-card history in IDB (weather, stocks, currency, alerts, crypto). Opens sparkline-in-tile UX without fetching N-days on boot. |

### 2.4 Testing & quality

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| Unit runner | Vitest 4.1.5 + happy-dom 20 | **Keep** | Fast, stable, ecosystem-mature. |
| **Bun test runner** | — | **Track, do not migrate** | Bun `test` is 10× faster but lacks Vitest's coverage thresholds + snapshot parity. Re-evaluate when `bun:test` ships `--coverage-threshold`. |
| E2E | Playwright 1.x | **Keep** | Best-in-class. |
| Component-in-browser tests | — | **Adopt `@vitest/browser` in v12** | For 3–4 cards whose DOM is too complex for happy-dom (maximise-FLIP, layout-drag). Keeps unit suite fast. |
| Visual regression | 54 Playwright baselines | **Expand to 72** | Add video-news paused/playing/error + SSE-alert state. v12. |
| Lighthouse CI | acc ≥ 98 / perf ≥ 95 / BP ≥ 95 / SEO ≥ 90 | **Tighten perf to 97 in v12** once TTI < 1 s sticks | Lagging indicator. |
| axe-core | Runs per screen mode | **Keep** | 0 serious/critical gate. |
| Property-based tests | `fast-check` on cache + config + ICS | **Expand to SimHash dedup in v12** | Paraphrase-robustness invariants. |
| Mutation testing | — | **One-off Stryker audit in v12** | Evidence, not ongoing practice. |
| Coverage thresholds | 92 / 85 / 92 / 94 | **Raise to 94 / 88 / 94 / 95 in v12** | Within reach. |

### 2.5 Observability

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| Client diagnostics | `diagLog` + `D` overlay + `Ctrl+Shift+E` export | **Keep; add structured JSON schema in v12** | Versioned export format → rigorous post-hoc triage. |
| Error KV | Last 1000 errors, 7-day TTL | **Keep; augment with Analytics Engine for trends** | KV = debug; Analytics Engine = aggregate. |
| RUM | Cloudflare Web Analytics + inline Web Vitals | **Keep; add Speculation-Rules prerender metric** | Per-pointer trigger latency. |
| Prometheus `/api/metrics` | — | **Adopt in v12 (token-gated)** | Home-lab friendly; zero PII; text format. |
| Reporting API endpoint | — | **Adopt in v12** | Collects CSP + deprecation + intervention reports. Worker `/api/reports` → D1. |
| OpenTelemetry from worker | — | **Defer to v13** | Value unclear at 100K req/day. |

### 2.6 Security

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| CSP | Strict (script-src 'self', etc.) | **Upgrade to CSP L3 in v12** | Add `require-trusted-types-for 'script'`, strict `default-src 'none'`, per-directive fallbacks. |
| COOP / COEP / CORP | Shipped | **Upgrade COEP to `credentialless` in v12** | Unblocks cross-origin images without isolation regression. |
| Permissions-Policy | Shipped | **Tighten in v12** | Deny `camera`, `microphone`, `geolocation`, `usb`, `payment`, `xr-spatial-tracking`, `browsing-topics`. |
| Trusted Types | Not used | **Adopt in v12** | Defence-in-depth; we have no offenders. |
| Reporting API | Not used | **Adopt in v12** | Collects CSP violations in production. |
| Subresource Integrity | N/A (no 3rd-party scripts) | **Document** | Publish in `docs/security.md` §11. |
| HSTS preload | GH Pages default | **Accept** | Cannot preload `*.github.io`. |
| Dependabot alerts | Shipped | **Keep** | Weekly cadence. |
| Dependency-review Action | On every PR | **Keep** | Catches Dependabot lag. |
| SLSA build provenance | Level 2 | **Upgrade to Level 3 (hermetic) in v13** | Hermetic-build exercise; not blocking. |
| Supply-chain attestation | SLSA + release artifact SHA | **Adopt SBOM (CycloneDX) in v12** | Auto-generated per release. |

### 2.7 Infrastructure & deployment

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| Static host | GitHub Pages | **Keep; evaluate Cloudflare Pages for v13** | Pages + Workers would unify deployment, caching, Analytics. Not urgent. |
| Worker deployment | Wrangler + SLSA provenance | **Keep; add canary route in v12** | 1 % traffic to `/worker-canary` for 24 h before promote. |
| CDN cache headers | Basic `Cache-Control` | **Audit + tighten in v12** | `immutable` on fingerprinted assets, `stale-while-revalidate` on shell, `no-store` on worker root. |
| Release artifact | `dist.zip` + SHA-256 + SLSA | **Keep; add SBOM** | See §2.6. |
| GitHub Actions | 8 workflows, pinned SHAs | **Keep; add Renovate Bot for SHA rotation** | Dependabot handles npm; Renovate handles Actions-by-SHA better. |
| Secret handling | `wrangler secret` (one: `ERROR_REPORTING_TOKEN`) | **Keep; rotate on every major release** | Cheap hygiene. |
| Multi-region | CF edge handles it | **N/A** | Workers are global by default. |

### 2.8 Documentation & DX

| Decision | Status | 2026 verdict | Why |
| --- | --- | --- | --- |
| ADR count | 20 (ADR-001 through ADR-020) | **Keep pace; add ADR-021 through ADR-028 in v12** | ~1 per major decision reopen. |
| ARCHITECTURE.md | Version-pinned + Mermaid | **Keep; generate partial from code** | `scripts/generate-arch-table.mjs` auto-writes the "Card registry" table from `card-registry.ts`. |
| AI customisation | 15 instructions + 4 skills + 14 prompts + 2 agents | **Keep; auto-invoke `release-check.prompt` in workflow** | Removes last human step in release gate. |
| OpenAPI | `worker/openapi.yaml` | **Generate client in v12** | `openapi-ts` → `src/core/worker-client.ts`. |
| Conventional Commits + automated CHANGELOG | Not enforced | **Adopt in v12** | `commitlint` + `changesets` (dev-dep at parent, zero cost). Automates §8 of this doc. |
| Pre-commit hooks | None | **Still reject** | Editor tasks + CI sufficient. |
| Mono-repo tooling | Parent `MyScripts/` + `tooling/` presets | **Keep; cross-adopt in v14** | BudgetManager + CrossTideWeb + Wedding inherit shared presets. |
| `.github/copilot/MCP_SERVERS.md` | Shipped | **Keep; add GitKraken + Azure matrix** | v12. |

---

## 3. Strategic Streams (V12 → V14)

Each stream has deliverables, exit criteria, and ADR candidates.

### 3.1 Stream V12-MODERNISE — Toolchain catch-up (v12.0, highest priority)

#### Deliverables

- [ ] Adopt `tsgo` (TypeScript-Go) as **second** CI typecheck; promote to primary when stable. ADR-021.
- [ ] Replace Zod with **Valibot** in worker. ADR-023.
- [ ] Adopt **Hono** as worker router; delete hand-written `Router`. Net worker bundle: ~neutral.
- [ ] Generate typed client from `worker/openapi.yaml` → `src/core/worker-client.ts`.
- [ ] Adopt **View Transitions L2** for theme switch + config-panel open.
- [ ] Adopt **CSS `@scope`** for per-card style isolation. ADR-022.
- [ ] Adopt **Trusted Types** (+ CSP directive). Defence-in-depth.
- [ ] Adopt **Speculation Rules** for archived preview + external doc links.

#### Exit criteria

- CI typecheck time halved on cold run
- Worker bundle < 90 KB gzip (currently ~110 KB with Zod)
- No `innerHTML` anywhere; Trusted-Types violations = 0 in field reports
- View-Transition theme switch renders under 200 ms on cached desktop
- 3 new ADRs committed; all 20 existing ADRs still valid

### 3.2 Stream V12-EDGE — Edge upgrade (v12.1)

Graduate from KV-only to CF's full edge toolkit.

#### Deliverables

- [ ] Worker **Cron Trigger** pre-warms stocks, currency, hebcal daily at rollover.
- [ ] **D1** holds anonymous aggregate telemetry (hourly route × provider × status counters). 7-day rolling. Never user config. ADR-024.
- [ ] **Workers Analytics Engine** replaces the Error-KV-query hack for real-time metrics. Error KV kept for last-1000 debug.
- [ ] **Durable Object** owns active-alerts state for Tzeva-Adom; SSE to connected clients. ADR-025.
- [ ] **Canary route** (1 % traffic) with 24 h bake before promote.
- [ ] **Prometheus `/api/metrics`** (token-gated, from D1).
- [ ] **Reporting API `/api/reports`** → D1; weekly digest.

#### Exit criteria

- Alerts card p95 latency < 150 ms (currently ~800 ms cold hit)
- Zero user-observable regression during canary bake
- D1 query p95 < 40 ms
- Prometheus scrape works under Grafana Cloud free tier

### 3.3 Stream V12-DATA — Depth per card, not breadth (v12.2)

| Card | Deliverable |
| --- | --- |
| stocks | **Finnhub** as primary (Yahoo demoted to tertiary); WebSocket-stream preview (feature-flagged) |
| news | **SimHash** dedup v2; paraphrase-robust |
| weather | 7-day history sparkline in tile |
| currency | 7-day history sparkline (XAU / XAG / USD / EUR / GBP) |
| alerts | DO-backed SSE (see §3.2) |
| sefaria | Zod validation (last unvalidated route) |
| hebrew-cal | Next-year holiday pre-warm at 23:00 on 29 Elul |

**Exit**: every card has a provider-redundant path + typed-validated payload + stale-fallback.

### 3.4 Stream V12-A11Y+ — Past 2.2 AA into 2.2 AAA (where free) (v12.3)

- [x] Enhanced focus indicators (WCAG 2.4.11 AAA)
- [ ] Consistent help (3.2.6 AA)
- [ ] Redundant entry (3.3.7 AA)
- [ ] Screen-reader heading-skip map
- [x] Voice-control semantic names (every interactive element has a unique accessible name)

### 3.5 Stream V12-OPS — Operations polish (v12.4)

- [ ] Conventional Commits + `changesets` auto-CHANGELOG
- [x] SBOM (CycloneDX) generated per release
- [ ] `release-check.prompt` invoked automatically by release workflow
- [ ] Weekly digest email from `/api/reports` (CSP violations, 5xx rate, deprecated APIs)
- [x] Renovate Bot for Action SHA rotation

### 3.6 Stream V13-PRODUCT — Optional evolution (gated)

| Candidate | Gate |
| --- | --- |
| Encrypted config export to user-chosen URL (multi-device mirror, no DB) | 5+ users request it in an issue thread |
| User-supplied background URL list + Cloudflare Images resize | 5+ users request it |
| Stocks WebSocket live-stream (Finnhub streaming) | TTI budget + battery budget fit |
| TC39 Signals adoption | Proposal at stage 3 + polyfill < 1.5 KB + concrete card benefit |
| Cloudflare Pages migration (from GitHub Pages) | Measurable TTI or caching regression on Pages |
| OpenTelemetry from worker | Scale demands it |
| AI summary card (local Hebrew LLM, WASM quantised) | Viable open-weight Hebrew model ≤ 20 MB at useful speed |
| 3rd language (Arabic, German for diaspora) | Contributor offers to maintain it |

### 3.7 Stream V14-HARMONISE — Mono-repo reference (v14.0)

- BudgetManager, CrossTideWeb, Wedding all on `tooling/eslint/web-ts-app.mjs` + `tooling/tsconfig/base-typescript.json`
- Shared `tooling/vitest/happy-dom.mjs` preset
- Shared `tooling/ci/` re-usable workflow fragments
- `tooling/README.md` becomes the cross-project developer handbook

---

## 4. Release Plan

### 4.1 v11.6.x — Post-11.5.1 maintenance (short window)

Patch-only. Bug fixes, doc corrections, minor provider hardening. No scope for features.

### 4.2 v12.0 — **Toolchain catch-up** (target: 2026-Q3)

Ships Stream V12-MODERNISE. Hard gate:

- `tsgo` CI green; worker uses Hono + Valibot; `worker-client.ts` generated; Trusted Types shipped; View Transitions L2 theme switch; CSS `@scope` on all 12 cards; 3 new ADRs.

### 4.3 v12.1 — **Edge upgrade** (target: 2026-Q3)

Ships Stream V12-EDGE. Hard gate:

- D1 telemetry live; DO-backed alerts SSE; Cron pre-warm live; Prometheus endpoint; canary route operational; 2 new ADRs.

### 4.4 v12.2 — **Card depth** (target: 2026-Q4)

Ships Stream V12-DATA. Hard gate:

- Finnhub primary, Yahoo tertiary; SimHash dedup; 7-day history sparklines on 4 cards; every card provider-redundant + validated + stale-fallback.

### 4.5 v12.3 — **Accessibility & polish** (target: 2026-Q4)

Ships V12-A11Y+ + V12-OPS. Hard gate:

- 2.2 AAA on free criteria; Conventional Commits; SBOM per release; weekly digest live.

### 4.6 v13.0 — **Optional evolution** (target: 2027, gated)

Only items from §3.6 with passed gates.

### 4.7 v14.0 — **Mono-repo reference** (target: 2027-Q2)

Ships Stream V14-HARMONISE.

---

## 5. Architecture Principles (v11.5.1 edition)

1. **Product truth over roadmap neatness** — plan what we will build, not what sounds good.
2. **Incremental convergence over grand rewrites** — finish before starting.
3. **Normalised data contracts over provider leakage** — cards render domain models, never raw upstream JSON.
4. **Instance-owned lifecycle** — `FdbCard` owns refresh, DOM, subscriptions, teardown.
5. **TV readability at 3 m** — legible in a dark room, from across the room.
6. **Zero client runtime deps stays zero** — ADR-002 is load-bearing.
7. **Exactly one worker runtime dep** — reviewed each major release; Zod → Valibot is the current rotation.
8. **Edge-first data** — worker normalises, validates, caches; client only renders.
9. **Observability is a first-class feature** — `diagLog`, provider health, Web Vitals, error KV, D1 aggregate.
10. **Docs match runtime** — no aspirational docs; ADRs for reversals.
11. **No new persistence without product need** — LS → IDB → KV → D1 in that order, justified each time.
12. **Security posture improves every major release** — CSP L3 next, SLSA L3 after.
13. **Protect unique strengths** — zero client deps, RTL-first, TV design, offline resilience, largest test suite in the comparison.
14. **Reopen clean decisions annually** — staying correct is more work than getting correct.

---

## 6. Immediate Next Actions (v11.6 / v12.0 runway)

Execute in order. Each becomes one or more v12.x sprints.

1. ✅ **V12-MODERNISE-1** — `tsgo` second-typecheck job in CI (ADR-021).
2. ✅ **V12-MODERNISE-2** — Valibot POC in worker (one route: `/api/currency`), benchmark bundle + type-inference parity; then migrate (ADR-023).
3. ✅ **V12-MODERNISE-3** — Hono router migration; delete hand-written `Router`.
4. **V12-MODERNISE-4** — `openapi-ts` generates `src/core/worker-client.ts`; migrate one card at a time; delete duplicated shapes.
5. **V12-MODERNISE-5** — Trusted Types + CSP directive; CSS `@scope` (ADR-022); View Transitions L2; Speculation Rules.
6. **V12-EDGE-1** — Cron Trigger pre-warm (stocks, currency, hebcal).
7. **V12-EDGE-2** — D1 telemetry schema + migration (ADR-024); Analytics Engine for hot metrics.
8. **V12-EDGE-3** — Durable Object for alerts SSE (ADR-025); client migrate; remove polling.
9. **V12-EDGE-4** — Canary route + Prometheus endpoint + Reporting API.
10. ✅ **V12-DATA-1** — Finnhub promote; Yahoo demote; provider-health tile in diag overlay.
11. ✅ **V12-DATA-2** — SimHash dedup v2 in `/api/news`.
12. ✅ **V12-DATA-3** — 7-day history IDB store + sparkline tiles on 4 cards.
13. ✅ **V12-A11Y-1** — 2.2 AAA free-wins + voice-control audit.
14. ✅ **V12-OPS-1** — Conventional Commits + changesets + SBOM + Renovate.

Release v12.0 when items 1–5 green; v12.1 when 6–9; v12.2 when 10–12; v12.3 when 13–14.
**v12.0.0 shipped**: items 1–3, 10–14 complete — 2026-05-19.

---

## 7. Consolidated legacy items (through v12.0.0)

| Item | Final status |
| --- | --- |
| TypeScript migration + modular src/ | Done (v7.0.0). |
| ARCHITECTURE.md + ADR folder | Done (v7.13 → 20 ADRs as of v11.5). |
| `FdbCard` base class | Done 12/12 cards (v8.4.0 + video-news v11.3). Dead `initX()` pruned in v11.5.0. |
| Worker normalization contract | Done (ADR-011). |
| IDB L3 cache on all cards | Done (v8.4–v8.8, ADR-010). |
| Worker KV stale fallback | Done all 10 routes (v11.0, ADR-013). |
| Playwright E2E + VR (54 baselines) | Done (v8.5 → v11.3). |
| Lighthouse CI (acc 98 / perf 95) | Done (v11.0). |
| axe-core in CI | Done (v11.0). |
| Strict CSP + COOP/COEP/CORP | Done (v11.0, ADR-018). |
| CF Web Analytics + Web Vitals + Error KV | Done (v11.0, ADR-016). |
| Worker `/api/news` aggregation | Done (v11.0, ADR-007). |
| `/api/crypto` + Zod on every route | Done (v11.0). |
| Lightning CSS in Vite build | Done (v11.0, ADR-017). |
| `requestIdleCallback` 3-tier init | Done (v11.5, ADR-020). |
| Video-news card (C14 + framework) | Done (v11.3, ADR-019). |
| Gold/silver via Yahoo futures | Done (v11.5.1). |
| Countdown RTL tile direction | Done (v11.5.1). |
| Property-based tests (`fast-check`) | Done (v11.0). |
| Registry-driven DOM (`mountRegisteredCards`) | Partial (v11.4); 11 legacy cards stay in `index.html` as a deliberate perf optimisation (measured). |
| React / Next.js rewrite | **Rejected** — ADR-005 still valid. |
| Auth (OIDC / passkey) | **Rejected** — re-confirmed 2026. |
| Relational DB (user-facing) | **Rejected** — D1 adopted **only** for anonymous aggregates in v12. |
| Shadow DOM | **Rejected** (ADR-001); CSS `@scope` supersedes the use-case in v12. |
| Preact / Lit / Solid / Svelte rewrite | **Rejected** — re-confirmed 2026. |
| Crowdin / 40+ languages | **Rejected**. |
| 50+ themes | **Rejected**. |
| 100+ widgets | **Rejected**. |
| OPFS | **Rejected** — IDB is sufficient. |
| WebGPU / WASM hot paths | **Rejected** — no justifying hot path. |
| Pre-commit hooks | **Rejected** — CI gates are sufficient. |
| Zod in worker | **Replaced** by Valibot in v12 (ADR-023 pending). |
| Hand-written worker `Router` | **Replaced** by Hono in v12. |

---

## 8. Historical release log (condensed)

One line per release. Per-sprint detail lives in `CHANGELOG.md`.

| Version | Date | Theme | Tests / Suites |
| --- | --- | --- | --- |
| v7.0.0  | 2025-Q4    | TypeScript migration + modular `src/`                                                                                   | 1390 / 41 |
| v7.13.0 | 2025-Q4    | ARCHITECTURE.md + ADRs + CardRuntime + domain types                                                                     | 1762 / 52 |
| v7.17.0 | 2026-Q1    | Worker normalisation foundation + release reports                                                                       | 2287 / 68 |
| v7.21.0 | 2026-Q1    | Shared test helpers + normalised worker types                                                                           | 2571 / 77 |
| v8.0.0  | 2026-Q1    | Test consolidation + dead-file cleanup + v5 config                                                                      | 3053 / 87 |
| v8.4.0  | 2026-Q2    | FdbCard 11/11 + critical-flow E2E + Lighthouse + ADR-010                                                                | 3087 / 88 |
| v8.5.0  | 2026-Q2    | VR baselines (18) + precache manifest + KV stale + configSchema 11/11                                                   | 3129 / 91 |
| v8.8.0  | 2026-Q2    | `/api/crypto` + NewsRssSchema + ADR-012 + `sw.ts` TS                                                                    | 3205 / 95 |
| v9.0.0  | 2026-Q3    | CI self-sufficiency + vendored `tooling/` + Node 22+ CI                                                                 | 3179 / 94 |
| v9.2.0  | 2026-04-22 | Worker KV stale (W.9) + CSS utilities + ADR-013/014/015 + 4 tooling presets                                             | 3193 / 94 |
| v10.0.0 | 2026-04-22 | **First major** — CI bail + GitKraken MCP + `docs/local-dev.md` + legacy cleanup                                        | 3193 / 94 |
| v11.0.0 | 2026-05-18 | **Security + Observability + A11Y** — strict CSP, CF Web Analytics, axe-core, `/api/news`, Lightning CSS, ADR-016/017/018 | 3249 / 98 |
| v11.0.1 | 2026-04-22 | Fix SW reload loop · Vite warning · coverage improvements                                                               | 3265 / 98 |
| v11.2.0 | 2026-04-22 | Reduced-motion audit · focus-ring tokens · bundle guard · PWA screenshots · SW update UX · backup providers             | 3265 / 98 |
| v11.3.0 | 2026-07-01 | **Video-news card** (opt-in) · `mountRegisteredCards` · scroll shadows · error boundary · ADR-019 · frontmatter linter  | 3303 / 100 |
| v11.4.0 | 2026-07-02 | Registry-driven DOM · LHCI thresholds · TTI opt · PWA splash · screen-reader docs                                       | 3303 / 100 |
| v11.5.0 | 2026-07-05 | ADR-020 idle-callback deferred init · video-news docs · dead `initX` cleanup · ARCHITECTURE refresh                     | 3303 / 100 |
| v11.5.1 | 2026-07-10 | Currency XAU/XAG via Yahoo GC=F/SI=F · countdown RTL tile direction · +6 unit tests                                     | 3309 / 100 |
| v12.0.0 | 2026-05-19 | **Toolchain Modernisation** — Valibot (Zod→Valibot) · Hono 4.x router · Finnhub primary stocks · SimHash news dedup · 7-day IDB history + sparklines · WCAG 2.4.11 AAA focus + aria-labels · SBOM (CycloneDX) + Renovate · 27 ADRs | 3309 / 102 |
| v12.1.0 | 2026-07-15 | **Edge Upgrade** — D1 telemetry (ADR-024) · Durable Objects alerts (ADR-025) · Prometheus `/api/metrics` · worker-client.ts typed HTTP · JSON diag export · security headers COEP credentialless · IDB sparklines on stocks + system-info · openapi.yaml v12.1.0 · commitlint · 13 iCalendar fuzz tests | 3406 / 106 |
| v12.2.0 | 2025-07-13 | **OPS + A11Y** — Reporting API `/api/reports` + D1 (ADR-028, Sprint 28) · Analytics Engine middleware (ADR-029, Sprint 29) · SR-only `<h1>` WCAG 2.4.6 + `.sr-only` CSS (Sprint 30) · WCAG 3.3.7 + 3.2.6 docs (Sprint 31) · Canary route header `X-Canary` (Sprint 32) · SimHash fast-check expansion + Stryker config (Sprint 33) · openapi.yaml v12.2.0 | 3459 / 109 |

Total through v12.2.0: **55+ production sprints**, **29 ADRs**, **0 regressions**.

---

**Roadmap owner**: Reuven Airhar · **Last reviewed**: 2025-07-13 · **Next review**: on v12.3 milestone tagging.
