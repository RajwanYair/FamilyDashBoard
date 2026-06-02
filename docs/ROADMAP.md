# FamilyDashBoard — Strategic Roadmap v13.0

> **Refresh date**: 2026-06-02
> **Shipped baseline**: v15.6.1 (metric hierarchy · diag tab · perf hints · quality hardening)
> **Next release**: v15.7.0 (production cleanup · DX excellence · GitHub integration hardening)
> **Product surface**: 12 cards · 7 themes · 3 screen modes · 0 client runtime dependencies · 7916 tests
> **Purpose**: forward-only plan. Historical sprints and shipped work → [CHANGELOG.md](../CHANGELOG.md). Decisions → [docs/adr/](adr/).
> **v13.0 changes**: stream status updates (P0 complete, P1/P3 in-progress) · 5 new competitors · P8–P13 streams · DX+CI section · VS Code extension guidance · parent tooling sync

---

## 0. Executive Position

FamilyDashBoard competes in the **ambient family information display** category — alongside MagicMirror², Glance, Homepage, Homarr, Home Assistant Lovelace, Dakboard, TRMNL, e-ink frames, and self-hosted dashboards. Our durable differentiators:

| Differentiator                | Strength vs field                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| **Zero runtime dependencies** | Only entrant with 0 client npm deps AND full offline-first PWA                             |
| **Hebrew RTL native**         | Only ambient dashboard with native Hebrew + Jewish calendar + Shabbat-aware UI             |
| **TV-first density**          | Optimized for 1920×1080 always-on at 3 m reading distance                                  |
| **Privacy by architecture**   | No auth, no accounts, no server-side user data — local-first localStorage + IDB            |
| **Edge-augmented, not bound** | Cloudflare Worker optional; dashboard renders, refreshes, and self-heals fully without it  |
| **In-house reactivity**       | ~1 KB signals engine aligned to TC39 Stage 3 — swap-ready when native lands                |
| **27 production gates**       | `npm run check` is the canonical bar; lint + test alone are insufficient                   |
| **Reproducible artifacts**    | `check:reproducible` + `check:sigstore` provide supply-chain guarantees most peers do not  |
| **Temporal API native**       | All date/time operations route through `src/core/temporal.ts` — zero raw `Date()` in cards |
| **DX-first tooling**          | 8 MCP servers · 5 skills · 3 agents · 56 Copilot rules · 25 VS Code tasks · 3-tier memory  |

This roadmap pushes every layer to **best-in-class** across reliability, maintainability, information clarity, accessibility, and supply-chain integrity. Complexity is added only where it eliminates a real failure mode.

### 0.1 Non-Negotiables

1. **One production bar.** CI, release, and local scripts run the same gate
2. **Zero tolerated quality drift.** Stale counts, dead code, suppressed rules, or disabled checks are release blockers
3. **Generated output != product structure.** Intermediates → `$TEMP`, artifacts → ignored dirs
4. **Forward-only roadmap.** Shipped items move to changelog or ADR within the same PR
5. **Harvest practice over imitate stack.** We copy _methods_, not framework choices
6. **No waivers, no workarounds.** Every error, warning, or note is resolved at root cause

---

## 1. Deep Architecture Rethink (v12)

Every major decision reconsidered from first principles. Columns: current decision, verdict, forward action.

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

| Area             | Current                                                  | Verdict    | Forward action                                                                           |
| ---------------- | -------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| Language         | TypeScript 6 strict + `exactOptionalPropertyTypes`       | **Keep**   | Adopt TS 7 only when emit is byte-stable                                                 |
| UI framework     | Vanilla DOM + card class hierarchy + custom elements     | **Keep**   | Frameworks add no value for 12 stable cards; improve view-model separation incrementally |
| CSS architecture | `@layer` cascade governance (ADR-008)                    | **Keep**   | Expand container queries; enforce `light-dark()` + `@scope` for new themes               |
| CSS future       | Tracking `css if()` (ADR-080), anchor positioning        | **Track**  | Adopt `css if()` when Baseline Newly; anchor-pos for tooltip stacking contexts           |
| Reactivity       | In-house signals (~200 LOC, ADR-038)                     | **Keep**   | Track TC39 Stage 3; swap when native — keep adapter layer thin (ADR-081 audit done)      |
| State            | Signals + localStorage + IDB + SW                        | **Keep**   | Four-tier (memory → LS → IDB → SW) is architecturally correct                            |
| Date/time        | `src/core/temporal.ts` — **DONE** (P0 shipped v15.5)     | **Done** ✓ | Zero raw `new Date()` in cards; temporal.ts is the SSoT                                  |
| Build            | Vite 8 + Rollup, dual `--base` targets                   | **Keep**   | IIFE for `file://`, ESM for hosted; correct                                              |
| CSS processing   | LightningCSS via Vite                                    | **Keep**   | Fastest correct transform; targets aligned with `.browserslistrc`                        |
| Service Worker   | Hand-crafted, versioned, `SKIP_WAITING` message contract | **Keep**   | Full cache control without Workbox bloat                                                 |
| Icons & manifest | `src/public/` (Vite static dir)                          | **Keep**   | Unfingerprinted, stable URLs                                                             |
| Type packaging   | Per-feature `types/` modules + central `api.ts`          | **Keep**   | Domain types co-located; cross-cutting in `types/`                                       |
| View Transitions | Level 1 shipping; Level 2 cross-doc tracked (ADR-037)    | **Track**  | Adopt L2 when broadly supported; gate behind `@view-transition` opt-in                   |

### 1.3 Backend / Infrastructure

| Area              | Current                                        | Verdict  | Forward action                                                     |
| ----------------- | ---------------------------------------------- | -------- | ------------------------------------------------------------------ |
| Edge runtime      | Cloudflare Worker (Hono + Valibot)             | **Keep** | Annual vendor-neutrality drill (`check:vendor`) already gates this |
| Realtime          | Durable Objects (stocks, alerts, rate-limiter) | **Keep** | Finish WebSocket upgrade for stocks; tighten alerts orchestrator   |
| API proxy         | Worker routes → upstream APIs                  | **Keep** | Centralizes CORS; keeps API keys server-side                       |
| Telemetry         | Analytics Engine (operational metrics only)    | **Keep** | No user tracking; latency, cache-hit, error rates                  |
| Database (server) | None                                           | **Keep** | No server-side user state by design                                |
| Database (client) | localStorage + IndexedDB (LRU, 50 MB cap)      | **Keep** | Privacy-preserving; works offline                                  |
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

| Area          | Current                                          | Verdict  | Forward action                                                            |
| ------------- | ------------------------------------------------ | -------- | ------------------------------------------------------------------------- |
| Architecture  | `docs/ARCHITECTURE.md`                           | **Keep** | Runtime topology + cache layers                                           |
| Decisions     | `docs/adr/` (92 ADRs accepted)                   | **Keep** | One ADR per non-trivial decision; reference, never inline                 |
| Worker API    | `worker/API.md` + `worker/openapi.yaml`          | **Keep** | Machine-readable contract                                                 |
| Skills        | `.github/skills/` (5 skills)                     | **Keep** | add-api, release, debug-fetch, update-tests, workspace-optimize           |
| Agents        | `.github/agents/` (3 agents)                     | **Keep** | api-integrator, dashboard-designer, quality-reviewer                      |
| Copilot rules | 56-rule `copilot-instructions.md`                | **Keep** | Battle-tested; per-file instructions supplement via `applyTo`             |
| Prompts       | 24 prompt files in `.github/prompts/`            | **Keep** | Full workflow coverage: sprint, release, debug, security, review, roadmap |
| MCP servers   | 8 servers (github, fetch, filesystem, gitkraken, | **Keep** | Deferred via tool_search; memory MCP cross-session knowledge              |
|               | playwright, cloudflare, memory, seq-thinking)    |          |                                                                           |
| Memory tiers  | 3-tier: user · session · repo                    | **Keep** | `/memories/repo/` for workspace-scoped facts across sessions              |
| Reading level | `check:reading-level`                            | **Keep** | Forces docs to be approachable                                            |
| Mermaid       | `check:mermaid` validates diagrams               | **Keep** | Prevents broken diagrams in docs                                          |
| Instructions  | 8 per-file instruction files with `applyTo`      | **Keep** | cicd · css · dashboard · pre-release · security · tests · ts · workspace  |

### 1.6 GitHub Actions & CI/CD

| Area               | Current                                            | Verdict     | Forward action                                                |
| ------------------ | -------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| Primary CI         | `ci.yml` — unified typecheck → lint → test → build | **Keep**    | Single source of truth; no parallel ci-v\*.yml files          |
| Deploy             | `deploy.yml` + `deploy-worker.yml`                 | **Keep**    | Pages deploy from `main`; worker from `worker/`               |
| Release            | `release.yml` + `release-drafter.yml`              | **Keep**    | Automated GitHub release + release notes                      |
| Security           | `codeql.yml` · `security.yml` · `trivy.yml`        | **Keep**    | Multi-layer security scanning                                 |
| TruffleHog         | `trufflehog.yml` — secret scanning                 | **Keep**    | Prevents credential leaks in history                          |
| ZAP                | `zap-baseline.yml` — DAST                          | **Keep**    | Dynamic application security testing                          |
| SBOM               | `sbom.yml` + `pr-sbom-diff.yml`                    | **Keep**    | Software bill of materials on every release                   |
| Scorecard          | `scorecard.yml` — OpenSSF                          | **Keep**    | External supply-chain scoring                                 |
| Stale              | `stale.yml`                                        | **Keep**    | Keeps issues/PRs clean                                        |
| Dependabot         | `dependabot.yml` + `dependabot-auto-merge.yml`     | **Keep**    | Automated dep bumps; auto-merge for minor/patch               |
| Renovate           | `renovate.json`                                    | **Keep**    | Supplemental to Dependabot for worker/ deps                   |
| Visual baselines   | `visual-baselines.yml`                             | **Keep**    | Regenerates VR baselines on main after intentional UI changes |
| Perf regression    | `perf-regression.yml`                              | **Keep**    | Lighthouse CI ratchet (0.99 floor)                            |
| Rebuild verify     | `rebuild-verify.yml`                               | **Keep**    | Reproducible build attestation                                |
| Supply chain       | `supply-chain.yml`                                 | **Keep**    | SLSA provenance generation                                    |
| Action SHA pinning | All actions use SHA pins                           | **Keep**    | `check:actions-pinned` enforces this in CI                    |
| Branch protection  | `branch-protection.yml`                            | **Improve** | Add required reviewers + code owner approval for `main`       |
| PR coverage        | `pr-coverage.yml` — coverage delta on PRs          | **Keep**    | Prevent coverage regressions in PRs                           |

### 1.7 Tools & Versions

| Tool         | Current          | Target           | Action                                                       |
| ------------ | ---------------- | ---------------- | ------------------------------------------------------------ |
| Node.js      | 22.x (`.nvmrc`)  | 22 LTS           | Stay on active LTS; bump to 24 when LTS                      |
| TypeScript   | 6.0.3            | 6.x latest patch | TS 7 only when emit unchanged                                |
| Vite         | 8.x              | 8.x latest       | Auto-bump minor                                              |
| Vitest       | 4.1.6            | 4.x latest       | Track Vite major                                             |
| Playwright   | 1.60.x           | 1.x latest       | Monthly upgrade for browser engine coverage                  |
| ESLint       | 10.x flat config | 10.x latest      | Flat config is final form                                    |
| Oxlint       | Not yet          | ADR-039          | Add as fast prepass (<50 ms); block ESLint for oxlint errors |
| Prettier     | 3.8.x            | 3.x latest       | Stable                                                       |
| Stylelint    | 17.x             | 17.x latest      | Modern-color notation enforced                               |
| Hono         | latest           | latest           | Tiny edge router                                             |
| Valibot      | 1.x              | 1.x latest       | Schema validation, smaller than Zod                          |
| Wrangler     | 4.x              | 4.x latest       | Cloudflare deploy CLI                                        |
| LightningCSS | via Vite 8       | via Vite         | Aligned with `.browserslistrc`; update when targets change   |
| happy-dom    | 20.x             | 20.x latest      | Matches Vitest; update together                              |
| Stryker      | 9.x              | 9.x latest       | Mutation testing; expand scope per ADR-083                   |

### 1.8 External Data Sources

| Source          | Card(s)    | Status      | Forward action                                                     |
| --------------- | ---------- | ----------- | ------------------------------------------------------------------ |
| Open-Meteo      | weather    | **Healthy** | Add precipitation radar tile endpoint; 3-day sparkline             |
| Yahoo Finance   | stocks     | **Healthy** | Worker-only proxying; Hibernatable WebSocket (ADR-087)             |
| Bank of Israel  | currency   | **Healthy** | Historical trend sparklines; crypto add-on via CoinGecko           |
| Pikud HaOref    | alerts     | **Healthy** | Hibernatable WebSocket DO (ADR-089); VAPID push opt-in (ADR-091)   |
| Google Calendar | calendar   | **Healthy** | Read-only public URL only; no OAuth                                |
| Hebcal          | hebrew-cal | **Healthy** | Single Worker endpoint for holidays + shabbat                      |
| Sefaria         | hebrew-cal | **Healthy** | Aggressive 24 h cache for daily study text                         |
| RSS feeds       | news       | **Healthy** | SimHash dedup done; recency-weighted ranking + starred persistence |
| YouTube/RSS     | video-news | **Healthy** | Passive embed; no YouTube API key; PiP API (ADR-045)               |
| CoinGecko       | currency   | **Healthy** | Crypto rates, 5-min cache                                          |

### 1.9 Security & Supply Chain

| Area                 | Current                                      | Verdict  | Forward action                              |
| -------------------- | -------------------------------------------- | -------- | ------------------------------------------- |
| CSP                  | Strict, no wildcards (`check:csp-wildcards`) | **Keep** | No `unsafe-inline`, no wildcard sources     |
| Trusted Types        | Enforced (`check:trusted-types`)             | **Keep** | Blocks DOM XSS sinks                        |
| Dependency surface   | 0 client deps; worker deps minimal           | **Keep** | `npm audit --audit-level=high` in CI        |
| Action pinning       | SHA-pinned (`check:actions-pinned`)          | **Keep** | No floating `@vX` tags                      |
| Install scripts      | `--ignore-scripts` (`check:ignore-scripts`)  | **Keep** | Prevents postinstall malware                |
| Reproducible builds  | `check:reproducible`                         | **Keep** | Byte-stable artifacts                       |
| Sigstore attestation | `check:sigstore`                             | **Keep** | Cryptographic provenance                    |
| TruffleHog           | Secret scanning in CI (`trufflehog.yml`)     | **Keep** | Catches accidental credential commits       |
| ZAP DAST             | `zap-baseline.yml` on deploy                 | **Keep** | Dynamic security scan against Pages URL     |
| OpenSSF Scorecard    | `scorecard.yml`                              | **Keep** | External supply-chain health score          |
| SBOM                 | CycloneDX on release (`sbom.yml`)            | **Keep** | Software bill of materials in every release |
| Privacy posture      | No telemetry, no analytics, no cookies       | **Keep** | See `docs/privacy.md`                       |
| OWASP review         | `check:owasp` per release                    | **Keep** | Mapped to Top 10:2021                       |

---

## 2. Competitive Benchmark (refreshed 2026-06-02)

### 2.1 Full Comparison Matrix

| Dimension                 | FamilyDashBoard           | Glance (Go)   | MagicMirror² (JS) | Homepage (Next.js)  | Homarr (TS)  | Dakboard (SaaS) | HA Lovelace (Py) | Grafana (Go)  | TRMNL (HW) | Flame (Node)  | Dasherr (SSR) | Netdata (Go)  | Actual Budget (TS) | Nextcloud (PHP) |
| ------------------------- | ------------------------- | ------------- | ----------------- | ------------------- | ------------ | --------------- | ---------------- | ------------- | ---------- | ------------- | ------------- | ------------- | ------------------ | --------------- |
| **Runtime deps (client)** | **0**                     | ~5            | ~40               | ~30                 | ~80          | SaaS            | ~200             | ~150          | Firmware   | ~20           | ~5            | ~100          | ~60                | ~300            |
| **Offline capability**    | **Full PWA**              | None          | Partial           | None                | None         | None            | None             | None          | Firmware   | None          | None          | None          | **Full PWA**       | Partial         |
| **Auth required**         | **No**                    | No            | No                | Optional            | Yes          | Yes             | Yes              | Yes           | Yes        | No            | Optional      | Yes           | Optional           | Yes             |
| **Server required**       | **No**                    | Yes (Go)      | Yes (Node)        | Yes (Docker)        | Yes (Docker) | Cloud           | Yes (Python)     | Yes (Docker)  | Cloud      | Yes (Node)    | Yes (Node)    | Yes (Go)      | **No**             | Yes (LAMP)      |
| **TV/ambient optimized**  | **Yes**                   | Partial       | Yes               | No                  | No           | Yes             | Partial          | No            | Yes        | No            | No            | No            | No                 | No              |
| **RTL / Hebrew native**   | **Yes**                   | No            | Community plugin  | No                  | No           | No              | Community        | No            | No         | No            | No            | No            | No                 | Partial         |
| **Cards / widgets**       | 12 curated                | ~30           | ~200 community    | ~100                | ~150         | ~20             | 1000+            | Plugin model  | ~15        | 15 apps       | ~25           | ~50           | ~12                | 100+ apps       |
| **Information density**   | High                      | Very High     | Medium            | Medium              | Medium       | Low             | Variable         | Very High     | Very Low   | Low           | Low           | Very High     | High               | Variable        |
| **Build system**          | Vite 8 + Rollup           | Go build      | npm + webpack     | Next.js             | Turborepo    | N/A             | pip/Docker       | GoReleaser    | N/A        | npm + webpack | Vite          | GoReleaser    | Vite + Rollup      | npm             |
| **Type safety**           | **TS 6 strict**           | Go (typed)    | No (JS)           | Partial             | TS           | N/A             | Python typing    | Go (typed)    | N/A        | JS only       | Go (typed)    | Go (typed)    | **TS strict**      | PHP typed       |
| **Test depth**            | **U+E2E+VR+Mut+Bench**    | Minimal       | Minimal           | Good                | Good         | Unknown         | Excellent        | Excellent     | Unknown    | Basic         | Basic         | Good          | Good               | Good            |
| **Custom check gates**    | **27**                    | 0             | ~3                | ~5                  | ~8           | 0               | ~15              | ~20           | 0          | 0             | 0             | ~5            | ~10                | ~5              |
| **Reproducible builds**   | **Yes**                   | No            | No                | No                  | No           | N/A             | No               | No            | N/A        | No            | No            | No            | No                 | No              |
| **Sigstore attestation**  | **Yes**                   | No            | No                | No                  | No           | N/A             | No               | No            | N/A        | No            | No            | No            | No                 | No              |
| **CSP / Trusted Types**   | **Strict + TT**           | None          | None              | Basic               | Basic        | Unknown         | Basic            | Basic         | N/A        | None          | None          | Basic         | Basic              | Basic           |
| **A11y posture**          | WCAG 2.2 AA target        | Unknown       | Community         | Unknown             | Unknown      | Unknown         | Partial          | Partial       | N/A        | Unknown       | Unknown       | Partial       | Good               | Partial         |
| **i18n model**            | RTL+Hebrew first          | en-only       | i18n plugin       | en-only             | i18n plugin  | en-only         | i18n plugin      | en-only       | en-only    | en-only       | en-only       | Multi-lang    | en-only            | Multi-lang      |
| **Privacy posture**       | **Maximal (no tracking)** | Good          | Good              | Good                | Medium       | Poor            | Good             | Medium        | Poor       | Good          | Good          | Medium        | **Maximal**        | Good            |
| **Bundle size (client)**  | **~180 KB gz**            | N/A (server)  | ~500 KB           | N/A (server)        | ~2 MB        | N/A             | N/A              | N/A           | N/A        | N/A           | ~50 KB        | N/A           | ~400 KB            | N/A             |
| **Setup complexity**      | `git clone` + open        | Docker/binary | npm + config      | Docker              | Docker       | Sign up         | OS install       | Docker        | Buy HW     | Docker        | npm + config  | Docker        | npm start          | Full LAMP stack |
| **Observability**         | Diag overlay + AE         | None          | None              | Logs only           | Basic        | None            | Excellent        | Excellent     | None       | None          | None          | **Excellent** | Basic              | Basic           |
| **Container queries**     | **Yes (enforced)**        | No            | No                | Tailwind responsive | Tailwind     | No              | No               | No            | No         | No            | No            | No            | No                 | No              |
| **View Transitions**      | **Yes**                   | No            | No                | No                  | No           | No              | No               | No            | No         | No            | No            | No            | No                 | No              |
| **Lighthouse perf**       | **0.99**                  | N/A           | ~0.60             | ~0.85               | ~0.70        | Unknown         | N/A              | N/A           | N/A        | ~0.80         | ~0.70         | N/A           | ~0.90              | N/A             |
| **Financial tracking**    | Stocks + Currency         | No            | Plugin            | No                  | No           | No              | Plugin           | Plugin        | No         | No            | No            | No            | **Excellent**      | Plugin          |
| **Real-time monitoring**  | Provider health + diag    | Process info  | Plugin            | No                  | Service ping | No              | Excellent        | **Excellent** | No         | No            | No            | **Excellent** | No                 | Plugin          |

### 2.2 Harvested Methods (executable list)

| Source             | Method                                      | Adoption plan                                                                  |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------ |
| **Glance**         | Ruthless information hierarchy per card     | Primary metric always largest; secondary 0.6×; tertiary 0.4× — **P1 done**     |
| **Glance**         | Single binary / zero-config deployment      | Our `file://` mode is the equivalent — one artifact, no server — **done**      |
| **Glance**         | Minimal vanilla JS, no framework            | Already aligned — validates our decision                                       |
| **TRMNL**          | Pacing for always-on displays               | Refresh-rate governor; coalesce repaints — **P1 in-progress**                  |
| **TRMNL**          | "Less but clearer"                          | Default card config hides optional fields; expand-on-demand — **P4**           |
| **NetNewsWire**    | Explicit stale/fresh visual semantics       | Color-coded timestamp badges — **P1 in-progress**                              |
| **NetNewsWire**    | Cross-feed deduplication                    | SimHash done; dedup ratio in diag overlay — **P3 done**                        |
| **Grafana**        | Provider health dashboard                   | Scorecard in diag overlay: success rate, p50/p95, last-ok — **P2 in-progress** |
| **Grafana**        | Evidence-driven release gates               | All 27 checks emit machine-readable pass/fail — **done**                       |
| **Home Assistant** | Semantic card grouping                      | Group cards by function (info / status / action) in settings — **P4**          |
| **Home Assistant** | Progressive disclosure in settings          | Tab-based settings with summary → detail drill-down — **P4**                   |
| **Homepage**       | Overview-first framing                      | Fastest-available data renders first; slow cards show skeleton — **P1 done**   |
| **Homepage**       | YAML-driven widget configuration            | Our JSON-schema settings dialog achieves same with type safety — **done**      |
| **MagicMirror2**   | Ambient mindset preservation                | Night dimmer, auto-scroll, low-motion preferences as first-class — **done**    |
| **MagicMirror2**   | Module lifecycle hooks (start/stop/resume)  | FdbCard lifecycle (ADR-051) mirrors this with signals — **done**               |
| **Dakboard**       | Photo/media integration as ambient content  | Optional background media rotation during idle — **R2 ADR-092**                |
| **Dakboard**       | Family calendar as primary anchor           | Calendar card highest priority in default layout — **done**                    |
| **HACS / HA**      | Versioned, signed update channels           | Sigstore shipped; add visible "verified build" badge in diag — **P7**          |
| **Lighthouse**     | Continuous performance budget               | LHCI gate at 0.99 performance — **done** (v15.6.1)                             |
| **Vite Ecosystem** | Pre-bundled IIFE for `file://`              | Already shipped; documented as best practice                                   |
| **Actual Budget**  | Clean financial data visualization          | Sparkline charts for currency/stocks; trend comparison — **P3 extension**      |
| **Actual Budget**  | Offline-first with full PWA                 | Validates our architecture; similar LevelDB → IDB pattern                      |
| **Netdata**        | Real-time streaming metrics display         | Provider health WebSocket streams via DO (ADR-087/089) — **P9**                |
| **Netdata**        | Self-healing metric collection              | Worker synthetic probes + fallback chain mirrors their agent model             |
| **Nextcloud**      | Progressive offline sync strategy           | Our SW + IDB cache mirrors their offline-first approach; validates four-tier   |
| **Flame**          | Minimalist "just works" homelab page        | Validates our zero-config `file://` target as the right simplicity anchor      |
| **Dasherr**        | Clean bookmark + service status in one pane | Semantic link service (ADR-X11) provides cross-card linking equivalent         |

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

## 3. Production Readiness Definition

### 3.1 What "Production Ready" Means (canonical, no waivers)

| Criterion                           | Requirement                            | Enforced by        |
| ----------------------------------- | -------------------------------------- | ------------------ |
| Zero type errors                    | `tsc -b --noEmit` exits 0              | `check` script     |
| Zero SW type errors                 | `tsc -p tsconfig.sw.json` exits 0      | `check` script     |
| Zero lint errors/warnings           | `eslint . --max-warnings 0` exits 0    | `check` script     |
| Zero format drift                   | `prettier --check .` exits 0           | `check` script     |
| Zero CSS lint errors                | `stylelint "src/**/*.css"` exits 0     | `check` script     |
| Zero markdown errors                | `markdownlint-cli2` exits 0            | `check` script     |
| Zero instruction-file violations    | `lint:instructions` exits 0            | `check` script     |
| All unit tests pass                 | `vitest run` exits 0                   | `check` script     |
| Coverage above per-file thresholds  | `vitest run --coverage` exits 0        | `vitest.config.ts` |
| All 27 custom gates pass            | each `check:*` exits 0                 | `check` script     |
| No `eslint-disable`                 | grep finds 0 in `src/` and `tests/`    | pre-release gate   |
| No `@ts-ignore`/`@ts-expect-error`  | grep finds 0 in `src/` and `tests/`    | pre-release gate   |
| No `TODO`/`FIXME`/`HACK`            | grep finds 0 in `src/` and `tests/`    | pre-release gate   |
| No disabled feature flags           | no compile-time `false` flags          | pre-release gate   |
| No dead code files                  | `check:dead-exports --fail-on-dead`    | `check` script     |
| Production build succeeds           | `npm run build` exits 0                | release gate       |
| Build artifacts untracked           | `check:artifacts` exits 0              | `check` script     |
| Bundle size within budget           | `check:bundle` exits 0                 | release gate       |
| Per-card bundle delta within budget | `check:card-bundle` exits 0            | release gate       |
| SW version matches package.json     | `check:sw` exits 0                     | `check` script     |
| Version consistency across files    | `check:version` exits 0                | `check` script     |
| Actions SHA-pinned                  | `check:actions-pinned` exits 0         | `check` script     |
| npm ignore-scripts enforced         | `check:ignore-scripts` exits 0         | `check` script     |
| OWASP review                        | `check:owasp` exits 0                  | `check` script     |
| CSP no wildcards                    | `check:csp-wildcards` exits 0          | `check` script     |
| Trusted Types respected             | `check:trusted-types` exits 0          | `check` script     |
| ADR index current                   | `check:adr` exits 0                    | `check` script     |
| OpenAPI TTL annotations current     | `check:openapi-ttl` exits 0            | `check` script     |
| Release notes prepared              | `check:release-notes` exits 0          | `check` script     |
| Module boundaries respected         | `check:boundaries` exits 0             | `check` script     |
| Container queries used over MQ      | `check:containers` exits 0             | `check` script     |
| Reading level approachable          | `check:reading-level` exits 0          | `check` script     |
| Smart contrast tokens               | `check:smart-contrast` exits 0         | `check` script     |
| Temporal polyfill size budget       | `check:temporal-polyfill` exits 0      | `check` script     |
| Benchmark within drift budget       | `check:benchmark` exits 0              | `check` script     |
| Reproducible build                  | `check:reproducible --dry-run` exits 0 | release gate       |
| Sigstore attestation valid          | `check:sigstore` exits 0               | release gate       |
| Zero VS Code extension errors       | All workspace diagnostics resolved     | pre-release gate   |
| No intermediate files in repo       | All temp output → `$TEMP`              | `.gitignore` + CI  |
| No suspended/disabled config        | All config options active or removed   | pre-release gate   |

### 3.2 Canonical Release Gate

```powershell
npm run check               # 27 gates + typecheck + lint + format + tests
npm run test                # unit tests (redundant with check but explicit)
npm run check:reproducible  # byte-stable artifact verification
npm run check:sigstore      # signature attestation
npm run build               # production build
npm run check:bundle        # size budget
npm run check:card-bundle   # per-card delta budget
```

Release is blocked if any command fails. **No exceptions. No waivers. No suppressions.**

---

## 4. Strategic Streams (forward work)

### P0 — Temporal Unification ✅ COMPLETE (v15.5.0)

All date/time operations route through `src/core/temporal.ts`. Zero raw `new Date()` in card code.
`grep -r "new Date(" src/cards/` returns 0 matches. Exit criterion met.

### P1 — Information Hierarchy Tightening — IN PROGRESS (v15.3–v15.6)

**Goal**: each card's primary metric is unambiguously primary.

- ✅ Primary metric >= 3× visual weight (v15.3, S43)
- ✅ Secondary opacity 0.75; tertiary 0.6 (v15.3, S48)
- ✅ Skeleton loading states on all cold-load cards (v15.3, S41)
- ✅ DNS-prefetch + preconnect resource hints (v15.3, S42 + v15.6.0, S83)
- 🔲 Stale/fresh color-coded timestamp badges (green < 5 m, yellow < 30 m, red > 1 h)
- 🔲 Starred/read persistence in IDB for news and calendar
- **Exit**: visual regression baselines reflect new hierarchy; freshness badges on all 12 cards

### P2 — Provider Health Observability — IN PROGRESS (v15.6)

**Goal**: any provider failure is diagnosable from the diag overlay alone.

- ✅ p95 latency per provider in diag overlay (v15.6.0, S82)
- ✅ Diagnostics tab in settings panel (v15.6.0, S81)
- ✅ Dedup ratio surfaced in diagnostics (v15.6.0, S80)
- 🔲 Full provider scorecard: success rate · p50/p95 · last-ok · consecutive fails
- 🔲 Worker-side synthetic probes for critical upstreams
- 🔲 Toast alerts on provider degradation onset
- **Exit**: synthetic-failure drill — diag overlay shows root cause within 5 s

### P3 — Feed Intelligence — IN PROGRESS (v15.6)

**Goal**: news card surfaces signal, suppresses noise.

- ✅ SimHash deduplication implemented
- ✅ Dedup ratio surfaced in diag overlay (v15.6.0)
- 🔲 Recency-weighted ranking (not pure reverse-chronological)
- 🔲 Read/starred persistence in IDB
- 🔲 Currency sparkline trends (Actual Budget harvest)
- **Exit**: duplicate headlines suppressed in render; freshness-ranked display

### P4 — Settings Progressive Disclosure

**Goal**: a new user configures basic preferences without reading docs.

- 🔲 Settings dialog uses tab groups by function (Info / Status / Display / Diagnostics)
- 🔲 Each card surfaces a quick-toggle row (show/hide/size)
- 🔲 Advanced settings revealed on demand
- 🔲 First-run tour reflects new layout
- **Exit**: usability test (5 users) — all complete basic setup unassisted

### P5 — Performance & PWA Excellence — IN PROGRESS (v15.4–v15.6)

**Goal**: Lighthouse 100/100/100/100 consistently.

- ✅ LCP discipline via skeleton + `contain-intrinsic-block-size` (v15.4, S65)
- ✅ `will-change` hints on infinite animations (v15.5, S74)
- ✅ `fetchpriority=low` on decorative images (v15.5, S76)
- ✅ Lighthouse CI at 0.99 floor (v15.6.1)
- 🔲 LCP < 1.5 s on cold start (confirmed via LHCI)
- 🔲 CLS = 0 fully confirmed
- 🔲 Resource hints for all API origins complete
- **Exit**: LHCI gate at 100 across all categories

### P6 — Accessibility Hardening (WCAG 2.2 AA)

**Goal**: every interactive surface fully keyboard-operable and screen-reader-meaningful.

- 🔲 Audit every `<dialog>` for focus trap correctness
- 🔲 Verify ARIA roles on all custom elements
- 🔲 Reduced-motion alternative for every animation
- 🔲 Color contrast token regression check (`check:smart-contrast` wired)
- **Exit**: axe-core finds 0 serious or critical issues across all cards and overlays

### P7 — Supply-Chain Hardening — IN PROGRESS

**Goal**: every release attestable end-to-end.

- ✅ Sigstore attestation shipped (`check:sigstore`)
- ✅ SBOM generation (`sbom.yml`)
- ✅ TruffleHog secret scanning
- ✅ OpenSSF Scorecard
- 🔲 SLSA Build Level 3 documentation
- 🔲 "Verified build" badge in diag overlay
- **Exit**: third-party verifier can reproduce a release from git SHA alone

### P8 — Oxlint Fast Prepass (ADR-039)

**Goal**: sub-50 ms lint prepass catches 80% of errors before ESLint runs.

- 🔲 Add `oxlint` as a pre-ESLint step in `check` pipeline
- 🔲 Configure overlapping rules to run in oxlint only
- 🔲 Gate CI on oxlint before running slower typescript-eslint
- **Exit**: `npm run lint:fast` exits in < 200 ms on full repo

### P9 — Real-time WebSocket Streaming (ADR-087/089)

**Goal**: sub-second delivery for stocks + alerts via Hibernatable Durable Objects.

- 🔲 Stocks card WebSocket upgrade (ADR-087)
- 🔲 Alerts card WebSocket upgrade (ADR-089)
- 🔲 Graceful degradation to polling when WS unavailable
- **Exit**: stock quote and Red Alert deliver within 1 s of server event

### P10 — AI-Assisted Content (ADR-030 Workers AI)

**Goal**: opt-in daily briefing synthesis from multi-card context.

- 🔲 Worker endpoint: summarize today's calendar + alerts + news → 3-line brief
- 🔲 Cards surface "AI brief" chip, click-to-expand
- 🔲 Strictly opt-in; default off; no data leaves client without user action
- 🔲 Workers AI — zero-cost inference budget, graceful degradation
- **Exit**: daily brief generated and displayed without any new API keys required

### P11 — Web Push Notifications (ADR-060/091)

**Goal**: VAPID push for critical alerts when dashboard is backgrounded.

- 🔲 VAPID key generation + service worker push event handler
- 🔲 Worker stores subscriptions in DO; fan-out via Workers Queues
- 🔲 Red Alert (Tzeva Adom) as first push event
- 🔲 User permission flow — explicit opt-in only
- **Exit**: push notification delivered on Red Alert within 3 s of ingestion

### P12 — R2 Background Images (ADR-092)

**Goal**: CDN-backed background image rotation with zero GitHub repo growth.

- 🔲 Worker endpoint serves R2 presigned URLs for background images
- 🔲 Client caches in IDB (50 MB LRU)
- 🔲 Offline fallback to stored image set
- **Exit**: background rotation works on `file://` + hosted, with zero new repo bytes

### P13 — Semantic Links + Cross-Card Protocol (ADR-067)

**Goal**: cards can link to each other by semantic concept, not by DOM id.

- 🔲 `src/core/links.ts` register/resolve API gated behind `semanticLinksEnabled`
- 🔲 Calendar → Countdown link (event → timer)
- 🔲 Stocks → News link (ticker → headline)
- 🔲 Hebrew-cal → Motivation link (holiday → themed quote)
- **Exit**: three cross-card links functional; zero circular dependencies in registry

---

## 5. Near-Term Milestones

### v15.7.0 — DX Pipeline + P1/P2 Exit (next release)

- 🔲 ROADMAP.md v13.0 committed (this document, 5 new competitors, P8–P13)
- 🔲 Freshness badges on all 12 data cards (green/yellow/red timestamp)
- 🔲 Provider scorecard complete in diag overlay (P2 exit criterion)
- 🔲 Oxlint prepass prototype added to `check` pipeline (P8 start)
- 🔲 `.vscode/extensions.json` updated with 4 new DX extensions
- 🔲 `.github` instructions, skills, agents, prompts updated
- 🔲 MyScripts parent tooling aligned with FamilyDashBoard learnings
- 🔲 Bundle size ≤ 200 KB gz
- 🔲 Full `npm run check` passing (0 errors, 0 warnings)

### v15.8.0 — P1 Completion + P3 Feed Intelligence

- 🔲 All P1 exit criteria confirmed via VR baselines
- 🔲 News: recency-weighted ranking + starred IDB persistence
- 🔲 Currency card: sparkline trend visualization (Actual Budget harvest)
- 🔲 Settings dialog progressive disclosure beginning (P4)

### v15.9.0 — P9 WebSocket Prototype + P5 Lighthouse

- 🔲 Stocks Hibernatable DO WebSocket prototype (ADR-087)
- 🔲 Red Alert DO WebSocket upgrade (ADR-089)
- 🔲 LHCI gate hardened to 100 in all categories (P5 exit)
- 🔲 Synthetic probes for all 10 external sources (P2 exit)

### v16.0.0 — Major: AI Brief + Web Push + Supply Chain

- 🔲 Workers AI daily briefing opt-in (P10, ADR-030)
- 🔲 VAPID push notifications for Red Alert (P11, ADR-060/091)
- 🔲 SLSA Build Level 3 documentation (P7 exit)
- 🔲 WCAG 2.2 AA full axe-core pass (P6 exit)
- 🔲 R2 background image rotation prototype (P12, ADR-092)
- 🔲 Semantic links registry prototype (P13, ADR-067)

### v17.0.0 — Consolidation + P12/P13 Exit

- 🔲 R2 background images fully operational
- 🔲 Three cross-card semantic links functional
- 🔲 Full 13-stream retrospective and new north-star scan
- 🔲 ROADMAP.md v14.0

---

## 6. Rejected or Deferred Directions

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

## 7. Maintenance Rules

1. No shipped sprint logs — use `CHANGELOG.md`
2. No embedded volatile counts — reference canonical sources
3. Remove completed items immediately
4. Move historical context to changelog or ADRs
5. Comparison tables re-audited quarterly
6. This document must be mechanically accurate at all times — any drift is a release blocker
7. Every new architectural commitment requires an ADR before code lands
8. No suspended options, disabled flags, or TODO markers in production code
9. All intermediate/generated files route to `$TEMP` — never committed to repo
10. VS Code extension diagnostics treated same as CI errors — resolve at root cause
11. DX tooling (MCP servers, skills, agents, prompts, instructions) audited at each major version
12. Competitive benchmark refreshed quarterly with `## 2. Competitive Benchmark (refreshed <date>)`
13. New strategic streams require: clear exit criterion, ADR reference, and milestone assignment before work begins
14. When a stream completes, mark ✅ COMPLETE in Section 4 and tag the shipping version
