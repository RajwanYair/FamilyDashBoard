# FamilyDashBoard — Strategic Roadmap v11.0

> **Refresh date**: 2026-05-20
> **Shipped baseline**: v15.5.0 → v15.5.1 (production hardening)
> **Product surface**: 12 cards · 7 themes · 3 screen modes · 0 client runtime dependencies
> **Purpose**: forward-only plan. Historical sprints and shipped work → [CHANGELOG.md](../CHANGELOG.md). Decisions → [docs/adr/](adr/).

---

## 0. 📌 Executive Position

FamilyDashBoard competes in the **ambient family information display** category — alongside MagicMirror², Glance, Homepage, Homarr, Home Assistant Lovelace, Dakboard, TRMNL, e-ink frames, and self-hosted dashboards. Our durable differentiators:

| Differentiator                | Strength vs field                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| **Zero runtime dependencies** | Only entrant with 0 client npm deps AND full offline-first PWA                            |
| **Hebrew RTL native**         | Only ambient dashboard with native Hebrew + Jewish calendar + Shabbat-aware UI            |
| **TV-first density**          | Optimized for 1920×1080 always-on at 3 m reading distance                                 |
| **Privacy by architecture**   | No auth, no accounts, no server-side user data — local-first localStorage + IDB           |
| **Edge-augmented, not bound** | Cloudflare Worker optional; dashboard renders, refreshes, and self-heals fully without it |
| **In-house reactivity**       | ~1 KB signals engine aligned to TC39 Stage 3 — swap-ready when native lands               |
| **27 production gates**       | `npm run check` is the canonical bar; lint + test alone are insufficient                  |
| **Reproducible artifacts**    | `check:reproducible` + `check:sigstore` provide supply-chain guarantees most peers do not |

This roadmap pushes every layer to **best-in-class** across reliability, maintainability, information clarity, accessibility, and supply-chain integrity. Complexity is added only where it eliminates a real failure mode.

### 0.1 Non-Negotiables

1. **One production bar.** CI, release, and local scripts run the same gate
2. **Zero tolerated quality drift.** Stale counts, dead code, suppressed rules, or disabled checks are release blockers
3. **Generated output ≠ product structure.** Intermediates → `$TEMP`, artifacts → ignored dirs
4. **Forward-only roadmap.** Shipped items move to changelog or ADR within the same PR
5. **Harvest practice over imitate stack.** We copy _methods_, not framework choices

---

## 1. 🏗️ Deep Architecture Rethink (v11)

Every major decision was reconsidered from first principles for v11. Columns: current decision, verdict, forward action.

### 1.1 Product & Scope

| Decision                                         | Verdict  | Rationale                                                                             |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| Always-on family dashboard for large displays    | **Keep** | TV-first constraint produces correct typography, density, reliability bar             |
| Static PWA + optional edge worker                | **Keep** | Best offline resilience, zero auth, minimal ops surface                               |
| Single household, no accounts                    | **Keep** | Removes privacy/security/support complexity entirely (see ADR-002, ADR-005)           |
| Keyboard-first + remote-friendly + touch-capable | **Keep** | Correct for TV + secondary tablet                                                     |
| 12-card curated set, no plugin marketplace       | **Keep** | Quality bar > extensibility. Power users fork                                         |
| File:// + GitHub Pages dual-target build         | **Keep** | One artifact runs from a USB stick or from CDN — eliminates a whole class of failures |

### 1.2 Frontend Stack

| Area             | Current                                                  | Verdict     | Forward action                                                                           |
| ---------------- | -------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Language         | TypeScript 6 strict + `strictFunctionTypes`              | **Keep**    | Adopt TS 7 only when emit is byte-stable                                                 |
| UI framework     | Vanilla DOM + card class hierarchy + custom elements     | **Keep**    | Frameworks add no value for 12 stable cards; improve view-model separation incrementally |
| CSS architecture | `@layer` cascade governance (ADR-008)                    | **Keep**    | Expand container queries; enforce `light-dark()` for new themes                          |
| Reactivity       | In-house signals (~200 LOC, ADR aligned)                 | **Keep**    | Track TC39 Stage 3; swap when native — keep adapter layer thin                           |
| State            | Signals + localStorage + IDB + SW                        | **Keep**    | Four-tier (memory → LS → IDB → SW) is architecturally correct                            |
| Date/time        | Mostly `Intl` + Temporal polyfill                        | **Improve** | Finish temporal unification; grep for `new Date(` in cards must return 0                 |
| Build            | Vite 8 + Rollup, dual `--base` targets                   | **Keep**    | IIFE for `file://`, ESM for hosted; correct                                              |
| CSS processing   | LightningCSS via Vite                                    | **Keep**    | Fastest correct transform; targets aligned with `.browserslistrc`                        |
| Service Worker   | Hand-crafted, versioned, `SKIP_WAITING` message contract | **Keep**    | Full cache control without Workbox bloat                                                 |
| Icons & manifest | `src/public/` (Vite static dir)                          | **Keep**    | Unfingerprinted, stable URLs                                                             |
| Type packaging   | Per-feature `types/` modules + central `api.ts`          | **Keep**    | Domain types co-located; cross-cutting in `types/`                                       |

### 1.3 Backend / Infrastructure

| Area              | Current                                        | Verdict  | Forward action                                                     |
| ----------------- | ---------------------------------------------- | -------- | ------------------------------------------------------------------ |
| Edge runtime      | Cloudflare Worker (Hono + Valibot)             | **Keep** | Annual vendor-neutrality drill (`check:vendor`) already gates this |
| Realtime          | Durable Objects (stocks, alerts, rate-limiter) | **Keep** | Finish WebSocket upgrade for stocks; tighten alerts orchestrator   |
| API proxy         | Worker routes → upstream APIs                  | **Keep** | Centralizes CORS; keeps API keys server-side                       |
| Telemetry         | Analytics Engine (operational metrics only)    | **Keep** | No user tracking; latency, cache-hit, error rates                  |
| Database (server) | None                                           | **Keep** | No server-side user state by design                                |
| Database (client) | localStorage + IndexedDB (LRU, ≤50 MB)         | **Keep** | Privacy-preserving; works offline                                  |
| CDN/hosting       | GitHub Pages                                   | **Keep** | Zero-cost, deterministic, correct for static PWA                   |
| Secrets           | Cloudflare Worker env bindings                 | **Keep** | API keys never reach client                                        |
| OpenAPI           | `worker/openapi.yaml` with TTL annotations     | **Keep** | `check:openapi-ttl` enforces freshness                             |
| Worker tests      | Vitest + Miniflare (`worker/`)                 | **Keep** | Real DO + KV simulation                                            |

### 1.4 Testing & Quality

| Area               | Current                                         | Verdict  | Forward action                                                       |
| ------------------ | ----------------------------------------------- | -------- | -------------------------------------------------------------------- |
| Unit tests         | Vitest 4 + happy-dom                            | **Keep** | Fastest correct DOM testing                                          |
| Browser tests      | `@vitest/browser` (Chromium)                    | **Keep** | Validates real DOM where happy-dom diverges                          |
| E2E tests          | Playwright (11 device projects)                 | **Keep** | Smoke on all, deep on Chromium                                       |
| Visual regression  | Playwright screenshot, baselines in repo        | **Keep** | No SaaS dependency                                                   |
| Coverage           | v8 via `vitest --coverage`, per-file thresholds | **Keep** | Thresholds in `vitest.config.ts` are SSoT                            |
| Mutation           | Stryker on logic-dense modules                  | **Keep** | Prevents test theater on cache/signals/fetch                         |
| Static analysis    | ESLint 10 flat config + typescript-eslint       | **Keep** | Type-aware rules catch real bugs                                     |
| CSS linting        | Stylelint with modern-color, layer order rules  | **Keep** | `css.validate: false` in VS Code defers to Stylelint                 |
| Custom gates       | 27 scripts in `scripts/`                        | **Keep** | Each catches a real production failure mode                          |
| Performance budget | `check:bundle` + `check:card-bundle`            | **Keep** | Per-card delta detection                                             |
| Benchmark drift    | `check:benchmark` against `benchmark-baseline`  | **Keep** | Catches micro-regressions in hot paths                               |
| Reproducible build | `check:reproducible` (byte-stable artifacts)    | **Keep** | Supply-chain guarantee                                               |
| Sigstore           | `check:sigstore` (artifact attestation)         | **Keep** | Cryptographic provenance                                             |
| OWASP              | `check:owasp` static review                     | **Keep** | Mapped to Top 10:2021 (see `.github/instructions/security-audit.md`) |
| Trusted Types      | `check:trusted-types`                           | **Keep** | Prevents DOM XSS sinks                                               |

### 1.5 Documentation & DX

| Area          | Current                                 | Verdict   | Forward action                                                                |
| ------------- | --------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| Architecture  | `docs/ARCHITECTURE.md`                  | **Keep**  | Runtime topology + cache layers                                               |
| Decisions     | `docs/adr/` (≥9 ADRs accepted)          | **Keep**  | One ADR per non-trivial decision; reference, never inline                     |
| Worker API    | `worker/API.md` + `worker/openapi.yaml` | **Keep**  | Machine-readable contract                                                     |
| Skills        | `.github/skills/` (4 skills)            | **Keep**  | add-api, release, debug-fetch, update-tests — covers all common workflows     |
| Agents        | `.github/agents/` (3 agents)            | **Keep**  | api-integrator, dashboard-designer, quality-reviewer                          |
| Copilot rules | 51-rule `copilot-instructions.md`       | **Prune** | Move file-type rules into per-instruction files (Rule 39 already covers this) |
| Reading level | `check:reading-level`                   | **Keep**  | Forces docs to be approachable                                                |
| Mermaid       | `check:mermaid` validates diagrams      | **Keep**  | Prevents broken diagrams in docs                                              |

### 1.6 Tools & Versions

| Tool       | Current          | Target           | Action                                      |
| ---------- | ---------------- | ---------------- | ------------------------------------------- |
| Node.js    | 22.x (`.nvmrc`)  | 22 LTS           | Stay on active LTS; bump to 24 when LTS     |
| TypeScript | 6.0.3            | 6.x latest patch | TS 7 only when emit unchanged               |
| Vite       | 8.x              | 8.x latest       | Auto-bump minor                             |
| Vitest     | 4.1.6            | 4.x latest       | Track Vite major                            |
| Playwright | 1.60.x           | 1.x latest       | Monthly upgrade for browser engine coverage |
| ESLint     | 10.x flat config | 10.x latest      | Flat config is final form                   |
| Prettier   | 3.8.x            | 3.x latest       | Stable                                      |
| Stylelint  | 16.x             | 16.x latest      | Modern-color notation enforced              |
| Hono       | latest           | latest           | Tiny edge router                            |
| Valibot    | 1.x              | 1.x latest       | Schema validation, smaller than Zod         |
| Wrangler   | 4.x              | 4.x latest       | Cloudflare deploy CLI                       |

### 1.7 External Data Sources

| Source          | Card(s)    | Status       | Forward action                                                       |
| --------------- | ---------- | ------------ | -------------------------------------------------------------------- |
| Open-Meteo      | weather    | **Healthy**  | Add precipitation radar tile endpoint                                |
| Yahoo Finance   | stocks     | **Healthy**  | Worker-only proxying; add market-hours awareness                     |
| Bank of Israel  | currency   | **Healthy**  | Historical trend sparklines                                          |
| Pikud HaOref    | alerts     | **Healthy**  | WebSocket via DO for sub-second delivery                             |
| Google Calendar | calendar   | **Healthy**  | Read-only public URL only; no OAuth                                  |
| Hebcal          | hebrew-cal | **Healthy**  | Single Worker endpoint for holidays + shabbat                        |
| Sefaria         | hebrew-cal | **Healthy**  | Aggressive 24 h cache for daily study text                           |
| RSS feeds       | news       | **Healthy**  | SimHash deduplication (already wired); recency-weighted ranking next |
| YouTube/RSS     | video-news | **Healthy**  | Passive embed; no YouTube API key                                    |
| CoinGecko       | currency   | **Optional** | Bonus data; not critical path                                        |

### 1.8 Security & Supply Chain

| Area                 | Current                                      | Verdict  | Forward action                          |
| -------------------- | -------------------------------------------- | -------- | --------------------------------------- |
| CSP                  | Strict, no wildcards (`check:csp-wildcards`) | **Keep** | No `unsafe-inline`, no wildcard sources |
| Trusted Types        | Enforced (`check:trusted-types`)             | **Keep** | Blocks DOM XSS sinks                    |
| Dependency surface   | 0 client deps; worker deps minimal           | **Keep** | `npm audit --audit-level=high` in CI    |
| Action pinning       | SHA-pinned (`check:actions-pinned`)          | **Keep** | No floating `@vX` tags                  |
| Install scripts      | `--ignore-scripts` (`check:ignore-scripts`)  | **Keep** | Prevents postinstall malware            |
| Reproducible builds  | `check:reproducible`                         | **Keep** | Byte-stable artifacts                   |
| Sigstore attestation | `check:sigstore`                             | **Keep** | Cryptographic provenance                |
| Privacy posture      | No telemetry, no analytics, no cookies       | **Keep** | See `docs/privacy.md`                   |
| OWASP review         | `check:owasp` per release                    | **Keep** | Mapped to Top 10:2021                   |

---

## 2. 📊 Competitive Benchmark (refreshed 2026-05-20)

### 2.1 Full Comparison Matrix

| Dimension                 | FamilyDashBoard                 | Glance    | MagicMirror²   | Homepage   | Homarr      | Dakboard | HA Lovelace | Grafana      | TRMNL    |
| ------------------------- | ------------------------------- | --------- | -------------- | ---------- | ----------- | -------- | ----------- | ------------ | -------- |
| **Runtime deps (client)** | **0**                           | ~5 (Go)   | ~40 (Node)     | ~30 (Go)   | ~80 (TS)    | SaaS     | ~200 (Py)   | ~150 (Go)    | SaaS     |
| **Offline capability**    | **Full PWA**                    | None      | Partial        | None       | None        | None     | None        | None         | Firmware |
| **Auth required**         | **No**                          | No        | No             | Optional   | Yes         | Yes      | Yes         | Yes          | Yes      |
| **Server required**       | **No**                          | Yes       | Yes            | Yes        | Yes         | Cloud    | Yes         | Yes          | Cloud    |
| **TV/ambient optimized**  | **Yes**                         | Partial   | Yes            | No         | No          | Yes      | Partial     | No           | Yes      |
| **RTL / Hebrew native**   | **Yes**                         | No        | Community      | No         | No          | No       | Community   | No           | No       |
| **Cards / widgets**       | 12 curated                      | ~30       | ~200 community | ~100       | ~150        | ~20      | 1000+       | Plugin model | ~15      |
| **Card configurability**  | Medium                          | Low       | High           | Medium     | High        | Low      | Very High   | Very High    | Low      |
| **Information density**   | High                            | Very High | Medium         | Medium     | Medium      | Low      | Variable    | Very High    | Very Low |
| **Release automation**    | **Full CI/CD**                  | Manual    | npm publish    | GoReleaser | Docker      | SaaS     | pip/Docker  | GoReleaser   | SaaS     |
| **Test depth**            | **U+E2E+VR+Mut+Bench**          | Minimal   | Minimal        | Good       | Good        | Unknown  | Excellent   | Excellent    | Unknown  |
| **Custom check gates**    | **27**                          | 0         | ~3             | ~5         | ~8          | 0        | ~15         | ~20          | 0        |
| **Reproducible builds**   | **Yes**                         | No        | No             | No         | No          | N/A      | No          | No           | N/A      |
| **Sigstore attestation**  | **Yes**                         | No        | No             | No         | No          | N/A      | No          | No           | N/A      |
| **CSP / Trusted Types**   | **Strict + TT**                 | None      | None           | Basic      | Basic       | Unknown  | Basic       | Basic        | N/A      |
| **A11y posture**          | WCAG 2.2 AA target              | Unknown   | Community      | Unknown    | Unknown     | Unknown  | Partial     | Partial      | N/A      |
| **i18n model**            | RTL+Hebrew first                | en-only   | i18n plugin    | en-only    | i18n plugin | en-only  | i18n plugin | en-only      | en-only  |
| **Privacy posture**       | **Maximal**                     | Good      | Good           | Good       | Medium      | Poor     | Good        | Medium       | Poor     |
| **Bundle size (client)**  | **~180 KB gz**                  | N/A       | ~500 KB        | N/A        | ~2 MB       | N/A      | N/A         | N/A          | N/A      |
| **Setup**                 | `git clone` + open              | Docker    | npm + config   | Docker     | Docker      | Sign up  | OS install  | Docker       | Buy HW   |
| **Observability**         | Diag overlay + Analytics Engine | None      | None           | Logs only  | Basic       | None     | Excellent   | Excellent    | None     |

### 2.2 Harvested Methods (executable list)

| Source             | Method                                     | Adoption plan                                                                |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| **Glance**         | Ruthless information hierarchy per card    | Primary metric always largest; secondary 0.6×; tertiary 0.4×                 |
| **Glance**         | Single-column density with breathing room  | Narrow screen mode default                                                   |
| **TRMNL**          | Pacing for always-on displays              | Refresh-rate governor; coalesce repaints                                     |
| **TRMNL**          | "Less but clearer"                         | Default card config hides optional fields; expand-on-demand                  |
| **NetNewsWire**    | Explicit stale/fresh visual semantics      | Color-coded timestamp badges (green <5 m, yellow <30 m, red >1 h)            |
| **NetNewsWire**    | Cross-feed deduplication                   | SimHash already wired; surface dedup ratio in diag overlay                   |
| **Grafana**        | Provider health dashboard                  | Scorecard in diag overlay: success rate, p50/p95, last-ok, consecutive fails |
| **Grafana**        | Evidence-driven release gates              | All 27 checks emit machine-readable pass/fail                                |
| **Home Assistant** | Semantic card grouping                     | Group cards by function (info / status / action) in settings                 |
| **Home Assistant** | Progressive disclosure in settings         | Tab-based settings with summary → detail drill-down                          |
| **Homepage**       | Overview-first framing                     | Fastest-available data renders first; slow cards show skeleton               |
| **MagicMirror²**   | Ambient mindset preservation               | Night dimmer, auto-scroll, low-motion preferences as first-class             |
| **Dakboard**       | Photo/media integration as ambient content | Optional background media rotation during idle                               |
| **Dakboard**       | Family calendar as primary anchor          | Calendar card highest priority in default layout                             |
| **HACS / HA**      | Versioned, signed update channels          | We already have Sigstore; add visible "verified build" badge in diag overlay |
| **Lighthouse**     | Continuous performance budget              | Add Lighthouse CI gate at 95+ across all categories                          |
| **Vite Ecosystem** | Pre-bundled IIFE for `file://`             | Already shipped; document as best practice                                   |

### 2.3 Anti-Patterns (Permanently Rejected)

- Framework rewrite without measurable user benefit
- User accounts, auth flows, or cloud profiles
- Server-required runtime for core viewing
- SaaS-only observability or visual-regression services
- Plugin ecosystem that dilutes the quality bar
- Docker-first deployment for a static site
- GraphQL or gRPC abstraction without real demand
- Tailwind or CSS-in-JS migration (design tokens + `@layer` is correct)
- Third-party state management (signals impl is tiny and correct)
- Microservices or micro-frontends for a 12-card product
- `eslint-disable`, `@ts-ignore`, `@ts-expect-error` directives (any density > 0 blocks release)
- Floating `@vN` GitHub Action tags (SHA-pinning enforced)

---

## 3. ✅ Production Readiness Definition

### 3.1 What "Production Ready" Means (canonical, no waivers)

| Criterion                           | Requirement                            | Enforced by          |
| ----------------------------------- | -------------------------------------- | -------------------- |
| Zero type errors                    | `tsc -b --noEmit` exits 0              | `check` script       |
| Zero SW type errors                 | `tsc -p tsconfig.sw.json` exits 0      | `check` script       |
| Zero lint errors/warnings           | `eslint . --max-warnings 0` exits 0    | `check` script       |
| Zero format drift                   | `prettier --check .` exits 0           | `check` script       |
| Zero CSS lint errors                | `stylelint "src/**/*.css"` exits 0     | `check` script       |
| Zero markdown errors                | `markdownlint-cli2` exits 0            | `check` script       |
| Zero instruction-file violations    | `lint:instructions` exits 0            | `check` script       |
| All unit tests pass                 | `vitest run` exits 0                   | `check` script       |
| Coverage above per-file thresholds  | `vitest run --coverage` exits 0        | `vitest.config.ts`   |
| All 27 custom gates pass            | each `check:*` exits 0                 | `check` script       |
| No `eslint-disable`                 | grep finds 0 in `src/` and `tests/`    | manual + pre-release |
| No `@ts-ignore`/`@ts-expect-error`  | grep finds 0 in `src/` and `tests/`    | manual + pre-release |
| No `TODO`/`FIXME`/`HACK`            | grep finds 0 in `src/` and `tests/`    | manual + pre-release |
| No disabled feature flags           | no compile-time `false` flags          | manual               |
| No dead code files                  | `check:dead-exports --fail-on-dead`    | `check` script       |
| Production build succeeds           | `npm run build` exits 0                | release gate         |
| Build artifacts untracked           | `check:artifacts` exits 0              | `check` script       |
| Bundle size within budget           | `check:bundle` exits 0                 | release gate         |
| Per-card bundle delta within budget | `check:card-bundle` exits 0            | release gate         |
| SW version matches package.json     | `check:sw` exits 0                     | `check` script       |
| Version consistency across files    | `check:version` exits 0                | `check` script       |
| Actions SHA-pinned                  | `check:actions-pinned` exits 0         | `check` script       |
| npm ignore-scripts enforced         | `check:ignore-scripts` exits 0         | `check` script       |
| OWASP review                        | `check:owasp` exits 0                  | `check` script       |
| CSP no wildcards                    | `check:csp-wildcards` exits 0          | `check` script       |
| Trusted Types respected             | `check:trusted-types` exits 0          | `check` script       |
| ADR index current                   | `check:adr` exits 0                    | `check` script       |
| OpenAPI TTL annotations current     | `check:openapi-ttl` exits 0            | `check` script       |
| Release notes prepared              | `check:release-notes` exits 0          | `check` script       |
| Module boundaries respected         | `check:boundaries` exits 0             | `check` script       |
| Container queries used over MQ      | `check:containers` exits 0             | `check` script       |
| Reading level approachable          | `check:reading-level` exits 0          | `check` script       |
| Smart contrast tokens               | `check:smart-contrast` exits 0         | `check` script       |
| Temporal polyfill size budget       | `check:temporal-polyfill` exits 0      | `check` script       |
| Benchmark within drift budget       | `check:benchmark` exits 0              | `check` script       |
| Reproducible build                  | `check:reproducible --dry-run` exits 0 | release gate         |
| Sigstore attestation valid          | `check:sigstore` exits 0               | release gate         |

### 3.2 Canonical Release Gate

```powershell
npm run check               # 27 gates + typecheck + lint + format + tests
npm run check:reproducible  # byte-stable artifact verification
npm run check:sigstore      # signature attestation
npm run build               # production build
npm run check:bundle        # size budget
npm run check:card-bundle   # per-card delta budget
```

Release is blocked if any command fails. **No exceptions. No waivers. No suppressions.**

---

## 4. 🚀 Strategic Streams (forward work)

### P0 — Temporal Unification

**Goal**: eliminate raw `Date()` in card logic; route through `src/core/temporal.ts`.

- Countdown card: migrate remaining `Date.now()` comparisons
- Calendar card: use temporal helpers for event proximity windows
- Hebrew-cal: consolidate `Intl.DateTimeFormat` wrappers
- **Exit**: grep for `new Date(` in `src/cards/**` returns 0

### P1 — Information Hierarchy Tightening (Glance + TRMNL harvest)

**Goal**: each card's primary metric is unambiguously primary.

- Primary metric ≥ 3× the size of any secondary
- Stale/fresh color-coded timestamp badges on all data cards
- Skeleton loading states for slow-loading cards (LCP discipline)
- Reduce simultaneous visual weight of optional fields
- **Exit**: visual regression baselines reflect new hierarchy on all 12 cards

### P2 — Provider Health Observability (Grafana harvest)

**Goal**: any provider failure is diagnosable from the diag overlay alone.

- Provider scorecard in diag overlay (D key): success rate, p50/p95 latency, last-ok, consecutive fails
- Worker-side synthetic probes for critical upstreams
- Toast alerts on provider degradation
- **Exit**: synthetic-failure drill confirms diag overlay shows root cause within 5 s

### P3 — Feed Intelligence (NetNewsWire harvest)

**Goal**: news card surfaces signal, suppresses noise.

- SimHash dedup already implemented → surface dedup ratio in diag overlay
- Recency-weighted ranking (not pure reverse chronological)
- Explicit "x minutes ago" freshness badges
- Read/starred persistence in IDB
- **Exit**: duplicate headlines across feeds are suppressed in render

### P4 — Settings Progressive Disclosure (Home Assistant harvest)

**Goal**: a new user configures basic preferences without reading docs.

- Settings dialog uses tab groups by function (Info / Status / Display / Diagnostics)
- Each card surfaces a quick-toggle row (show/hide/size)
- Advanced settings revealed on demand
- First-run tour reflects new layout
- **Exit**: usability test (5 users) — all complete basic setup unassisted

### P5 — Performance & PWA Excellence (Lighthouse harvest)

**Goal**: Lighthouse 100/100/100/100 consistently.

- Eliminate render-blocking patterns
- LCP < 1.5 s on cold start
- CLS = 0 (skeletons prevent layout shift)
- SW precache only critical assets; lazy-cache card-specific resources
- Resource hints (`preconnect`, `dns-prefetch`) for all API origins
- **Exit**: Lighthouse CI gate at 95+ across all categories

### P6 — Accessibility Hardening (WCAG 2.2 AA)

**Goal**: every interactive surface fully keyboard-operable and screen-reader-meaningful.

- Audit every `<dialog>` for focus trap correctness
- Verify ARIA roles on all custom elements
- Reduced-motion alternative for every animation
- Color contrast token regression check (`check:smart-contrast` already wired)
- **Exit**: axe-core finds 0 serious or critical issues across all cards and overlays

### P7 — Supply-Chain Hardening

**Goal**: every release attestable end-to-end.

- Sigstore attestation already shipping (`check:sigstore`)
- Add SBOM generation (CycloneDX) to release artifacts
- Add SLSA Build Level 3 documentation
- Document "verified build" badge in diag overlay
- **Exit**: third-party verifier can reproduce a release from git SHA alone

---

## 5. 🎯 Near-Term Milestones

### v15.5.1 — Production Cleanup (this release)

- ROADMAP consolidated to v11.0 (this document)
- VS Code extension noise tuned to `.browserslistrc` (Baseline Lens config)
- Legitimate CSS hygiene fixes (`-webkit-` ordering, missing prefixes)
- Repo memory refreshed
- No behavior change, no version-breaking change

### v15.6.0 — Information Hierarchy (P1)

- Glance/TRMNL harvest applied to weather, stocks, currency, news
- Freshness badges across all data cards
- Skeleton states for slow loaders
- VR baselines updated

### v15.7.0 — Provider Health (P2)

- Diag overlay scorecard
- Worker health probes
- Degradation toasts

### v16.0.0 — Feed Intelligence + Settings Disclosure (P3 + P4)

- Cross-feed dedup surfaced
- Recency-weighted ranking
- Read/starred persistence
- Settings tab groups
- First-run tour refreshed

### v16.1.0 — Performance & A11y (P5 + P6)

- Lighthouse CI 95+ gate
- Resource hints
- axe-core clean

### v16.2.0 — Supply-Chain Excellence (P7)

- SBOM in release artifacts
- SLSA Build Level 3
- Verified-build badge

---

## 6. 🚫 Rejected or Deferred Directions

Permanently rejected unless an ADR reverses with concrete evidence:

- Framework rewrite for its own sake
- Auth, accounts, OAuth, social-login
- User cloud database
- Plugin marketplace expansion
- Tailwind / CSS-in-JS migration
- Server-required product runtime
- Docker-first deployment model
- SaaS-first observability dependencies
- Next.js, Remix, or server-routing stacks
- GraphQL or gRPC as a generalized API layer
- Web framework adoption (React/Vue/Svelte/Solid) for the dashboard shell

Tracked but not adopted yet:

- TypeScript 7 — only when emit is byte-stable
- TC39 Signals (native) — only when polyfill path is small and stable
- On-device inference — only if privacy-preserving with graceful fallback
- Additional Cloudflare platform primitives — only when they reduce complexity
- WebGPU rendering for cards — only with measured battery/perf benefit
- File System Access API write paths — only behind explicit user consent

---

## 7. 🔧 Maintenance Rules

1. No shipped sprint logs — use `CHANGELOG.md`
2. No embedded volatile counts — reference canonical sources
3. Remove completed items immediately
4. Move historical context to changelog or ADRs
5. Comparison tables re-audited quarterly
6. This document must be mechanically accurate at all times — any drift is a release blocker
7. Every new architectural commitment requires an ADR before code lands
