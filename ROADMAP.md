<!-- markdownlint-disable MD013 MD033 MD024 MD036 -->

# FamilyDashBoard — Strategic Roadmap

> **Refresh date**: 2026-04-24 · **Shipped baseline**: v13.3.0 — 4399 tests / 150 suites / 0 failures · 0 ESLint errors · 0 warnings · 0 `eslint-disable` · 0 `@ts-ignore` · 0 TypeScript errors · 0 markdownlint issues · 36 ADRs · 0 client runtime deps · 2 worker deps (Hono + Valibot) · 6 themes · 12 cards · 11 worker routes · 4-tier offline (mem → LS → IDB → SW) · coverage 87.14 / 79.16 / 86.65 / 88.41
> **Purpose**: a first-principles re-open of every decision — including those shipping cleanly — against the 2026-Q2 web platform, then chart v13 → v15. Nothing is grandfathered. Decisions survive only when they still justify themselves on merit. Completed v13 work is consolidated out; only forward work remains.

---

## 0. Executive Summary

Between v10 (2024) and v13.3 (≈ 75 sprints) FamilyDashBoard went from "working family TV display" to a reference implementation of a zero-client-dep TypeScript PWA with an edge-hosted typed worker. The v12/v13 arc closed the three gaps that separated us from best-in-class:

- **Toolchain** (v12.0): tsgo second typecheck, Hono, Valibot, View Transitions L2, CSS `@scope`, Trusted Types, Speculation Rules, OpenAPI-driven `worker-client.ts`.
- **Edge** (v12.1 → v13.2): D1 telemetry, Durable Objects, Prometheus `/api/metrics` with p95 histogram, Workers Analytics Engine, Cron pre-warm, Reporting API, canary header plumbing.
- **Quality** (v12.2 → v13.3): WCAG 2.2 AA + selected AAA, SimHash property tests, Stryker mutation audit, CI release gate (tsc + eslint + markdownlint + bundle + SW), conventional commits + changesets, 4399 tests, 79%+ branch coverage.

Quantitatively v10 → v13.3: 2147 → 4399 tests (+105%), 88 → 150 suites (+70%), 20 → 36 ADRs, worker routes 7 → 11, worker gzip ~75 → ~62 KB, TTI ~1.4 s → < 1.0 s cached.

**Where we are.** The tactical catch-up is finished. The remaining frontier is:

1. **Cross-device continuity without auth** — finish WebRTC mirror (QR pairing, ADR-036) when 3+ users request it.
2. **Expand depth, not breadth** — SimHash-v2 precision gate, US-travel weather, WebSocket stocks.
3. **Mono-repo harvest** — propagate `tooling/` presets to sibling repos (BudgetManager, CrossTideWeb, Wedding).
4. **SLSA L3 + supply-chain hardening** (ADR-035).
5. **TC39 primitives (Signals, Temporal)** when polyfills fit the budget.
6. **Vendor-neutrality drill** — annual rebuild on Deno Deploy + Bun Deploy + fly.io (ADR-031).

Every line below has a gate, exit criterion, or trigger. No aspiration decoration.

---

## 1. Competitive Landscape — 2026-Q2

### 1.1 Comparison matrix (10 peer projects)

Grouped by mission:

- **Family / personal dashboards**: Homepage (gethomepage), Dashy, Homer, Homarr v2, Glance, MagicMirror².
- **Server / infra monitoring** (architecture-only reference, not UX peers): Beszel, Dashdot.
- **News-first references**: NetNewsWire (RSS depth), Feedly (SimHash + clustering, paid).

| Dimension                       | **FamilyDashBoard v13.3**                                                                                                                    | Homepage               | Dashy             | Homer            | Homarr v2              | Glance              | MagicMirror²           | Beszel                 | Dashdot             | NetNewsWire          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------- | ---------------- | ---------------------- | ------------------- | ---------------------- | ---------------------- | ------------------- | -------------------- |
| Primary audience                | Always-on family TV                                                                                                                          | Homelab launcher       | Homelab dashboard | Static startpage | Homelab mgmt           | News/feed dashboard | Smart mirror display   | Server monitoring      | Server monitoring   | News reader          |
| Stars (Apr 2026 est.)           | ~90                                                                                                                                          | 46 K                   | 29 K              | 12 K             | 17 K                   | 26 K                | 19 K                   | 8 K                    | 6 K                 | 7 K                  |
| Frontend                        | **Vanilla TS strict + Vite 8**                                                                                                               | Next.js 15 (React 19)  | Vue 3.5           | Vue 3            | Next.js 15 + Mantine 7 | Go templates → HTML | Node + MM modules      | Svelte + SvelteKit     | React + Vite        | Swift (native)       |
| Client runtime deps             | **0 / ~88 KB gzip**                                                                                                                          | ~38                    | ~22               | ~12              | ~55                    | 0 (SSR)             | ~15                    | ~4                     | ~25                 | N/A                  |
| Backend                         | **Cloudflare Worker (edge)**                                                                                                                 | Node reverse-proxy     | Node/Express      | None (static)    | Node + tRPC + Drizzle  | Single Go binary    | Node Express           | Single Go binary       | Single Go binary    | N/A                  |
| Database                        | **None user (LS + IDB + KV + D1-anon)**                                                                                                      | None (YAML)            | None (YAML)       | None (YAML)      | SQLite + Drizzle       | None (YAML)         | None (JSON)            | SQLite embedded        | None                | SQLite (feeds)       |
| TS strictness                   | **100% strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`**                                                                        | strict                 | partial           | JS-dominant      | strict                 | N/A                 | partial                | strict                 | partial             | N/A                  |
| CSS architecture                | **Vanilla `@layer` + tokens + Lightning CSS + `@scope` + `light-dark()` + `@property`**                                                      | Tailwind 4             | SCSS + themes     | SCSS             | Mantine CSS-in-JS     | Hand-written CSS    | CSS modules            | Tailwind 4             | Tailwind 3          | AppKit/UIKit         |
| Tests                           | **4399 unit + Playwright + axe + 54 VR + LHCI + fast-check + Stryker**                                                                       | Vitest partial         | Vitest partial    | None             | Vitest + PW + Argos CI | Go tests            | Minimal                | Go tests               | Partial             | XCTest               |
| Visual regression               | **Playwright (54 baselines)**                                                                                                                | None                   | None              | None             | Argos CI               | None                | None                   | None                   | None                | Snapshot             |
| i18n                            | **Hebrew RTL + English**                                                                                                                     | 45+ (Crowdin)          | 22+               | YAML             | 38+                    | en-only             | 30+                    | en-only                | en-only             | 40+ (Apple)          |
| Accessibility                   | **WCAG 2.2 AA + axe-core gate + parts of 2.2 AAA**                                                                                           | Partial                | Partial           | Unknown          | Partial                | Unknown             | Partial                | Unknown                | Unknown             | VoiceOver            |
| Offline / PWA                   | **Full SW · 4-tier cache · precache manifest · background sync**                                                                             | No                     | Basic PWA         | Installable      | No                     | No                  | No                     | No                     | No                  | Native offline       |
| Auth                            | **None (intentional)**                                                                                                                       | Host/proxy             | Keycloak / basic  | None             | OIDC + passkey         | None                | None                   | Email + 2FA            | None                | Apple ID             |
| Config model                    | **UI panel + JSON export (user-owned) + encrypted URL share**                                                                                | YAML + Docker labels   | YAML + UI         | YAML             | UI drag-drop (DB)      | YAML                | Config.js              | UI (DB)                | Config.js           | UI only              |
| Edge proxy / CORS               | **Worker + KV stale + Valibot + D1 anon telemetry + Analytics Engine + DO rate-limit**                                                       | Server proxy           | Proxy chain       | N/A              | tRPC over Next         | N/A                 | None                   | N/A                    | N/A                 | None                 |
| Observability                   | **CF Web Analytics + Web Vitals + Error KV + D1 hits + Reporting API + Prometheus `/api/metrics` (+ p95 hist) + Analytics Engine + diag JSON** | None                   | None              | None             | Sentry (opt)           | Prometheus endpoint | None                   | Built-in metrics       | Prometheus endpoint | Apple telemetry      |
| Security headers                | **CSP L3 + strict + Trusted Types + COOP/COEP(credentialless)/CORP + Permissions-Policy (28 APIs) + HSTS**                                   | NGINX templates        | Varies            | None             | Next defaults          | Go handlers         | None                   | Svelte defaults        | Partial             | Apple sandbox        |
| Supply-chain                    | **SLSA L2 + SBOM (CycloneDX) + Dependabot + Renovate (Actions SHA) + dependency-review + Stryker mutation**                                  | High (Next churn)      | Medium            | Low              | Very high              | ~0 (single bin)     | Medium                 | Low                    | Medium              | Apple-signed         |
| CI gates                        | **tsc + tsgo + eslint + markdownlint + vitest + LHCI + axe + VR + bundle + SW + SLSA + commitlint + mutation**                               | Docker + tests         | Docker build      | Build only       | Build + tests          | Go build + test     | Node build             | Go build + test        | Go build + test     | Xcode tests          |
| License                         | MIT                                                                                                                                          | GPL-3.0                | MIT               | Apache-2.0       | MIT                    | AGPL-3.0            | MIT                    | MIT                    | MIT                 | MIT                  |
| Cold-start TTI                  | **< 1.0 s cached / ~1.6 s fresh**                                                                                                            | ~2.5 s                 | ~3 s              | ~1 s (static)    | ~3.5 s                 | ~300 ms             | ~2 s                   | ~500 ms                | ~800 ms             | N/A                  |
| Live-data cards                 | **12 deep, provider-adapted, history-backed**                                                                                                | 100+ widgets (shallow) | 50+ widgets       | limited          | 30+ integrations       | 12 feed types       | 100+ modules (shallow) | Server metrics         | Server metrics      | RSS only             |
| Unique strengths                | **Hebrew/Zmanim/Hebcal/Sefaria, TV-3m, 4-tier offline, zero deps, largest test-gate matrix**                                                 | Ecosystem size         | Themeable         | Simplicity       | Feature breadth        | Go footprint        | Mirror form-factor     | Go deploy              | Go deploy           | macOS polish         |

### 1.2 Patterns harvested (or rejected) — 2026-Q2

| Pattern                                          | Source                    | Verdict                                              | Landing                                                                                                     |
| ------------------------------------------------ | ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Workers AI (Llama 3.3 8B, free tier)             | CF 2025 GA                | ✅ Done v13.1 narrow                                 | `/api/news/summarise` + Hebrew motivation, feature-flag OFF, cached 1h. ADR-030.                            |
| Workers Queues (fan-out + retry)                 | CF 2024 GA                | ✅ Done v13.0                                        | Error-reporter off request path. ADR-032.                                                                   |
| Email Workers (digest)                           | CF 2024 GA                | ✅ Done v13.0                                        | Weekly CSP + provider-health digest, opt-in. ADR-033.                                                       |
| Regional Durable Objects (IL)                    | CF 2025 GA                | ✅ Done v13.0                                        | Alerts DO pinned to IL, p95 ~150 ms.                                                                        |
| Workers Smart Placement                          | CF 2024 GA                | ✅ Done v13.0                                        | All origin-fetch routes.                                                                                    |
| CSS `light-dark()`                               | CSS WG 2024               | ✅ Done v13                                          | `@layer tokens` — all core colors.                                                                          |
| CSS `@property` + scroll-driven animations       | CSS WG 2025               | ✅ Done v13                                          | Scroll-driven ticker + progress rings, no JS.                                                               |
| CSS Anchor Positioning                           | CSS WG 2025               | ✅ Done v13                                          | Stocks Popover — removes `getBoundingClientRect` layout JS.                                                 |
| Popover API                                      | Browser 2024              | ✅ Done v13                                          | `stk-detail-popover` on every stock row.                                                                    |
| `scrollend` + `overscroll-behavior: contain`     | Browser 2025              | ✅ Done v13                                          | `auto-loop-scroll.ts` parent-attached.                                                                      |
| `AbortSignal.timeout()`                          | Browser 2025              | ✅ Done v13                                          | `fetchWithTimeout()`, legacy fallback retained.                                                             |
| Cross-doc View Transitions L2                    | Chrome/Safari 2025        | **Partial — keep expanding**                         | Theme + config-panel same-doc ✅; cross-doc when Safari ships full support (v14).                           |
| Document Picture-in-Picture                      | Browser 2024              | **Gate: 3+ user requests**                           | video-news card — corner PiP while other cards refresh.                                                     |
| URL Pattern API on client                        | Browser 2024              | **Adopt v14**                                        | Already in Hono on worker; expose for dynamic routes.                                                       |
| Shared Element Transitions L3 (cross-doc)        | CSS WG draft 2026         | **Track**                                            | Revisit v14.                                                                                                |
| WebGPU offscreen canvas for stocks               | Browser 2025              | **Reject**                                           | Charts < 30 KB SVG; no perf problem.                                                                        |
| Temporal API (Stage 3)                           | TC39 2026                 | **Adopt when polyfill < 10 KB gzip**                 | Replaces ad-hoc date arithmetic in hebrew-cal + calendar. v14.                                              |
| TC39 Signals (Stage 3)                           | TC39 2026                 | **Adopt when polyfill < 1.5 KB + concrete benefit**  | `state.ts` incremental swap. v14.                                                                           |
| Rolldown (Vite Rust bundler)                     | Vite 2026                 | **Auto-adopt on Vite default**                       | Zero config action required.                                                                                |
| Bun 1.2 test runner                              | Bun 2026                  | **Track only**                                       | Vitest 4.1 ecosystem leads; revisit v15.                                                                    |
| tRPC-style end-to-end types                      | Homarr v2                 | **Superseded**                                       | `openapi-ts`-generated `worker-client.ts` already covers this without framework lock.                       |
| AGPL copyleft                                    | Glance                    | **Reject**                                           | MIT aligns with family-project distribution.                                                                |
| Single-binary deploy                             | Glance, Beszel            | **Already harvested**                                | `dist.zip` + `worker.js`, SLSA-pinned.                                                                      |
| Native Bluetooth / sensor APIs                   | MagicMirror²              | **Reject**                                           | Permissions-Policy denies them.                                                                             |
| SimHash → embeddings dedup                       | Feedly                    | ✅ Done v13.1 coarse                                 | `@cf/baai/bge-small-en` cosine pass over SimHash survivors; precision@10 gate still open.                   |
| Argos CI visual regression                       | Homarr v2                 | **Superseded**                                       | Playwright baselines already hosted in-repo; zero SaaS dependency.                                          |
| Drizzle / tRPC / Mantine                         | Homarr v2                 | **Reject**                                           | Contradicts zero-dep, no-user-DB, no-framework lines.                                                       |
| OIDC / passkey auth                              | Homarr v2                 | **Reject**                                           | Single-household device; largest new attack surface for zero benefit.                                       |

### 1.3 Our protected unique strengths

1. **Zero runtime deps on the client** — most peers ship 30–55; we ship 0.
2. **TV-first at 3 m** — no peer targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 provider-adapted cards with normalized history** — depth over breadth.
5. **4-tier offline** — no peer renders a useful dashboard offline.
6. **4399 tests + axe + VR + LHCI + Stryker + SLSA** — highest gate density in the table.
7. **Production observability without tracking cookies** — RUM + Vitals + Errors + Reports + Analytics Engine + Prometheus.
8. **Reproducible one-binary-ish release** — static ZIP + `worker.js`, SLSA L2, SBOM per release.

---

## 2. First-principles reopen — 2026-Q2

Every ADR re-litigated. Stamp: **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, **Supersede**. Only rows requiring action or reconfirmation are listed; purely done work is omitted.

### 2.1 Frontend

| Decision                                                   | Verdict                                   | Action                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| TypeScript `strict` + `noUncheckedIndexedAccess`           | **Keep**                                  | Annual re-review.                                                                         |
| tsgo (TypeScript-Go) as second typecheck                   | **Keep; promote when stable**             | Primary when (a) `--build` mode stable, (b) project refs parity, (c) 2+ green cycles. v14.|
| Vite 8 (Rollup)                                            | **Keep; auto-adopt Rolldown**             | No code action.                                                                           |
| Vanilla DOM + `FdbCard` (no framework)                     | **Keep (4th reconfirm)**                  | No peer benefit we lack.                                                                  |
| Shadow DOM / Web Components                                | **Reject (reconfirmed)**                  | Breaks global `@layer` theming; `@scope` gives encapsulation without tax.                 |
| Zero client deps (ADR-002)                                 | **Keep (load-bearing)**                   | Non-negotiable.                                                                           |
| TC39 Signals                                               | **Track**                                 | Adopt when stage 3 + polyfill < 1.5 KB + concrete card benefit. v14.                      |
| Temporal API                                               | **Track**                                 | Polyfill ≤ 10 KB gzip gate.                                                               |
| View Transitions L2 cross-doc                              | **Expand**                                | Theme switch + config panel done; expand to maximise-card flow. v13/v14.                  |
| Document Picture-in-Picture (video-news)                   | **Gate: 3+ user requests**                |                                                                                           |
| Per-card bundle delta alert                                | **Adopt v13.x**                           | Fail CI on > 10 % growth per card (currently whole-bundle only).                          |
| Typed `worker-client.ts` regen hash-check                  | **Adopt**                                 | Pre-commit hash compare against `openapi.yaml` snapshot.                                  |
| FLIP animations → cross-doc View Transitions               | **Track**                                 | When cross-doc ships everywhere. v14.                                                     |

### 2.2 Backend

| Decision                                   | Verdict                            | Action                                                                                                                               |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cloudflare Worker (ADR-003)                | **Keep**                           | Annual vendor-neutrality drill (ADR-031).                                                                                            |
| Hono + Valibot                             | **Keep**                           | Reconfirmed; ~25 KB win over Zod retained.                                                                                           |
| KV stale cache (all 11 routes)             | **Keep; annual TTL audit**         | Per-route TTL documented in OpenAPI description. v13.x.                                                                              |
| D1 telemetry + p95 histogram               | **Keep**                           | Shipped v13.2.                                                                                                                       |
| Durable Objects — alerts SSE               | **Keep**                           | Shipped v13.0; p95 ~150 ms; regional pin to IL.                                                                                      |
| Workers Queues (error fan-out)             | **Keep**                           | Shipped v13.0.                                                                                                                       |
| Email Workers weekly digest                | **Keep**                           | Shipped v13.0 opt-in.                                                                                                                |
| Workers AI (Hebrew summarisation)          | **Keep; tighten precision gate**   | SimHash v2 embedding dedup shipped coarse; precision@10 gate remains open target v13.x.                                              |
| Hyperdrive / Postgres                      | **Reject (reconfirmed)**           | No Postgres in stack.                                                                                                                |
| User-facing DB                             | **Reject (reconfirmed)**           | LS + IDB + JSON export + encrypted URL share cover it.                                                                               |
| Rate limiting (DO counter)                 | **Keep**                           | Per-client adaptive back-off live across all 11 routes.                                                                              |
| Worker bundle budget                       | **Keep ≤ 75 KB gzip**              | CI-enforced.                                                                                                                         |
| **Annual vendor-neutrality build drill**   | **Adopt**                          | Rebuild `worker/src` on Deno Deploy + Bun Deploy + fly.io once per major release. ADR-031. First run at v14.0.                       |

### 2.3 Data plane

Every card row currently: provider-redundant + Valibot-validated + stale-fallback + 7-day history where it aids legibility. Remaining moves:

| Card / area                                   | Action                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| news                                          | SimHash v2 **precision@10 gate** > baseline by 15 % before removing SimHash v1. Deferred from v13.1 full.                  |
| weather                                       | Opt-in `api.weather.gov` for US-travel mode. v13.x.                                                                        |
| stocks                                        | WebSocket live-stream (Finnhub) — gate: TTI + battery budget fit. v15.                                                     |
| calendar                                      | icalendar-rfc5545 fuzz cases 79 → 150+. v13.x.                                                                             |
| tasks                                         | Recurring monthly/yearly (weekly/recurrence-badge already shipped). v13.x.                                                 |
| video-news                                    | Document Picture-in-Picture — gate: 3+ user requests. v15.                                                                 |
| motivation                                    | AI Hebrew daily quote precision audit (non-repeat window, faith-safe curator). v13.x.                                      |

### 2.4 Testing & quality

| Decision                                        | Verdict                                 | Action                                                                                                 |
| ----------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Vitest 4.1 + happy-dom 20                       | **Keep**                                |                                                                                                        |
| Playwright + axe + VR (54 baselines)            | **Expand to 80+**                       | DO-SSE alert states, video-news channel variants, maximise-card FLIP. v13.x.                           |
| LHCI — perf ≥ 95 / a11y ≥ 98 / BP ≥ 95 / SEO 90 | **Tighten perf to 97**                  | TTI < 1 s is sticky.                                                                                   |
| Property tests (`fast-check`)                   | **Expand to worker-client**             | End-to-end envelope invariants. v13.x.                                                                 |
| Mutation tests (Stryker)                        | **Extend**                              | Add error-tracker + config modules. Threshold ≥ 85 %.                                                  |
| `@vitest/browser` component tests               | **Adopt**                               | For cards whose DOM is too complex for happy-dom (maximise-FLIP, layout-drag). Keeps unit suite fast.  |
| Coverage thresholds                             | **Ratchet 85/79/85/86 → 95/90/95/96**   | Currently 87.14 / 79.16 / 86.65 / 88.41. +1% per minor release.                                        |
| changesets auto-CHANGELOG                       | **Shipped v13**                         | Reconfirmed.                                                                                           |

### 2.5 Observability, Security, Infra, DX

| Area   | Action                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------- |
| Obs    | Diag schema v1 → v2 only if needed; OpenTelemetry from worker deferred to v14 (value unclear at 100 K req/day).         |
| Sec    | **SLSA L3 (hermetic build)** — ADR-035 planning complete; first shipped release v14.2. Sigstore/cosign per release.     |
| Sec    | Secret rotation on every major release (cheap hygiene). Reporting API sampling audit annually.                          |
| Infra  | Canary route live v13.0; annual vendor-neutrality drill ADR-031 starts v14.0.                                           |
| Infra  | Cloudflare Pages migration — gate: measurable TTI or caching regression on Pages.                                       |
| DX     | `docs/adr/README.md` auto-generated from ADR frontmatter (shipped v13).                                                 |
| DX     | Cross-project MCP matrix in `.github/copilot/MCP_SERVERS.md` (add GitKraken + Azure rows). v13.x.                       |
| DX     | Mono-repo tooling harvest — propagate `tooling/` presets to BudgetManager / CrossTideWeb / Wedding. v14.1.              |

### 2.6 Decisions held rejected (reconfirmed 2026-Q2)

Client framework rewrite · Shadow DOM · user-facing DB · OIDC/passkey · 40+ language i18n · pre-commit hooks · WebGPU / WASM hot paths · OPFS structured cache · AGPL · multi-tenant Workers for Platforms · 3rd language (deferred to contributor offer).

---

## 3. Strategic Streams (v13 remaining → v15)

Each stream: deliverables · ADR candidates · exit criteria · gate triggers. Completed items are dropped from this section — see CHANGELOG for the full historical record.

### 3.1 V13-CONTINUITY — Cross-device without auth *(gated)*

**Gate trigger**: 3+ users request it in an issue thread.

- [x] Encrypted config URL export (AES-GCM + passphrase; `fdb://config#<base64>`).
- [x] Import flow + `docs/sync.md`.
- [ ] **WebRTC mirror** — short-lived (5-min) QR-pairing data channel, STUN-only, no TURN, no relay. Valibot on incoming delta. ADR-036.

**Exit**: zero DB, zero account, zero worker storage — purely client-side crypto + user-owned medium (clipboard / URL / QR).

### 3.2 V13-POLISH — Residual card depth + test ratchet *(v13.4 → v13.6)*

- [ ] SimHash v2 precision@10 gate > baseline by 15 % (news).
- [ ] Opt-in `api.weather.gov` US-travel mode.
- [ ] Tasks recurring monthly/yearly.
- [ ] icalendar-rfc5545 fuzz cases 79 → 150+.
- [ ] Per-card bundle-delta CI alert (> 10 % growth).
- [x] `worker-client.ts` regeneration hash check (pre-commit).
- [ ] LHCI perf ≥ 97 (from 95).
- [ ] `@vitest/browser` component tests for maximise-FLIP / layout-drag cards.
- [ ] Coverage ratchet: 87.14 / 79.16 / 86.65 / 88.41 → 90 / 82 / 89 / 91 (incremental, +1 per release).

**Exit**: LHCI perf ≥ 97, coverage branches ≥ 82, zero flaky tests on `main` for 3 consecutive releases.

### 3.3 V14-TC39 — Platform primitives *(gated, v14.0)*

**Triggers**

- Signals: TC39 Stage 3 + polyfill < 1.5 KB + concrete card benefit.
- Temporal: TC39 Stage 3 + polyfill < 10 KB gzip.
- Shared Element Transitions L3 (cross-doc): Chrome + Safari both ship.

**Deliverables (if triggers fire)**

- [ ] `state.ts` → Signals (incremental, card-at-a-time).
- [ ] hebrew-cal + calendar date arithmetic → Temporal.
- [ ] View Transitions → cross-doc for theme switch.

### 3.4 V14-HARMONISE — Mono-repo reference *(v14.1)*

- [x] Composite `tooling/ci/check.yml` (v13.3).
- [x] Cross-project tooling registry (v13.2).
- [ ] BudgetManager / CrossTideWeb / Wedding on `tooling/eslint/web-ts-app.mjs` + `tooling/tsconfig/base-typescript.json`.
- [ ] Shared `tooling/vitest/happy-dom.mjs` preset across all three.
- [ ] Cross-project release gate (each repo's `release.yml` extends shared composite).

### 3.5 V14-SECURITY-L3 — SLSA L3 + supply-chain *(v14.2)*

- [x] ADR-035 planning complete (v13.2).
- [ ] SLSA Level 3 hermetic build (`slsa-framework/slsa-github-generator`).
- [ ] Signed provenance attestations per release (sigstore/cosign).
- [ ] Secret-scanning attestation in SBOM.
- [ ] Vendor-neutrality drill first run (ADR-031) — rebuild on Deno Deploy + Bun Deploy + fly.io.

### 3.6 V15-PRODUCT — Optional evolution *(gated)*

| Candidate                                                   | Gate                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| User-supplied background URL list + CF Images resize        | 5+ users request it                                     |
| Stocks WebSocket live-stream (Finnhub)                      | TTI + battery budget fit                                |
| Document Picture-in-Picture on video-news                   | User request ≥ 3                                        |
| TC39 Signals adoption                                       | See §3.3                                                |
| Cloudflare Pages migration                                  | Measurable TTI or caching regression on Pages           |
| OpenTelemetry from worker                                   | Scale demands it (> 500 K req/day)                      |
| AI summary card (local Hebrew LLM, WASM quantised)          | Viable open-weight Hebrew model ≤ 20 MB at useful speed |
| 3rd language (Arabic, German)                               | Contributor offers to maintain it                       |
| Bun 1.2 test runner                                         | Vitest ecosystem parity lost                            |

---

## 4. Release Plan

### 4.1 v13.3 — *Coverage + Worker + Docs* **(shipped 2026-04-24)**

Hebrew-cal 29 Elul pre-warm · scrollend/animLevel coverage · handleWeather NWS branches · feeds.ts route coverage · ADR-036 WebRTC design · V14-HARMONISE CI composite · branches 77 → 79 · simhash flake fix. 4399 tests / 150 suites / 0 failures.

### 4.2 v13.4 — *Coverage ratchet + residual depth* (target 2026-Q3)

Ships first slice of V13-POLISH §3.2:

- Coverage branches 79 → 82.
- SimHash v2 precision@10 gate.
- Per-card bundle delta CI.
- `worker-client.ts` regeneration hash check.
- LHCI perf ≥ 97.

**Gate**: 0 flaky on main for 3 releases · coverage ≥ 90/82/89/91 · no ESLint regressions.

### 4.3 v13.5 — *Continuity (gated)* (target 2027-Q1 if triggered)

Ships V13-CONTINUITY §3.1 — WebRTC mirror, ADR-036. Only if 3+ user requests.

### 4.4 v13.6 — *Residual card depth* (target 2026-Q4)

- Opt-in US-travel weather (`api.weather.gov`).
- Tasks recurring monthly/yearly.
- icalendar fuzz cases 79 → 150+.
- `@vitest/browser` component tests for complex cards.

### 4.5 v14.0 — *TC39 primitives (gated)* (target 2027-Q1/Q2)

Ships V14-TC39 §3.3. Only if triggers fire. Annual vendor-neutrality drill (ADR-031) first run.

### 4.6 v14.1 — *Mono-repo reference* (target 2027-Q2)

Ships V14-HARMONISE §3.4. Hard gate: all three sibling repos green under shared presets.

### 4.7 v14.2 — *SLSA L3 + supply-chain* (target 2027-Q3)

Ships V14-SECURITY-L3 §3.5. Hard gate: sigstore/cosign provenance on release artefact; hermetic build verified by third-party rebuilder.

### 4.8 v15.0 — *Optional evolution (gated)* (target 2027-Q4+)

Only items from §3.6 with passed gates. No pre-committed content.

---

## 5. Best-in-class aim — concrete targets

| Axis              | v13.3 now                                | v14 target                                 | v15 target                                 |
| ----------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Client deps       | 0                                        | 0                                          | 0                                          |
| TS strict         | strict + unchecked-idx + verbatim        | same + tsgo primary                        | same                                       |
| Coverage          | 87 / 79 / 87 / 88                        | 92 / 85 / 92 / 93                          | 95 / 90 / 95 / 96                          |
| Tests             | 4399                                     | 5000+                                      | 5500+                                      |
| Suites            | 150                                      | 170+                                       | 180+                                       |
| LHCI perf         | ≥ 95                                     | ≥ 97                                       | ≥ 98                                       |
| TTI cached        | < 1.0 s                                  | < 850 ms                                   | < 750 ms                                   |
| Worker gzip       | ~62 KB (budget 75 KB)                    | ≤ 75 KB                                    | ≤ 75 KB                                    |
| WCAG              | 2.2 AA + selected AAA                    | 2.2 AAA closure + cognitive                | Re-audit under WCAG 3.0 draft              |
| Security          | CSP L3 · Trusted Types · SLSA L2 · SBOM  | + SLSA L3 · sigstore/cosign · hermetic     | + third-party rebuild verified             |
| Observability     | RUM + Vitals + Errors + p95 + Analytics  | + opt-in OpenTelemetry                     | + SLO dashboard (Grafana free tier)        |
| Vendor lock-in    | CF-first; exits documented               | Annual rebuild drill green                 | Continuous rebuild drill green             |
| i18n              | he + en                                  | same (3rd = contributor-gated)             | same                                       |
| Auth              | None                                     | None                                       | None                                       |

---

## 6. What this roadmap deliberately does **not** do

- No monetisation, no SaaS tier, no login, no multi-tenant path.
- No framework rewrite, no Shadow DOM, no user-facing DB.
- No 40+ language i18n, no pre-commit hooks, no WebGPU/WASM hot paths, no OPFS.
- No AGPL relicensing.
- No speculative features without a gate trigger or user request count.

Every line here can be defended on merit. When a decision can no longer be defended, it goes into the ADR graveyard with a superseded-by link, not into the product.
