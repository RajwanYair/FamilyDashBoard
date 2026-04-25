# FamilyDashBoard — Strategic Roadmap

> **Refresh date**: 2026-04-26 · **Shipped baseline**: v13.8.2 — production-hardened, zero suppressions, zero waivers
>
> **Inventory**: 4802 tests / 154 suites / 0 failures · 0 ESLint errors / warnings / `eslint-disable` · 0 `@ts-ignore` · 0 TypeScript errors · 0 markdownlint / stylelint issues · 37 ADRs · 0 client runtime deps · 2 worker deps (Hono + Valibot) · 6 themes · 12 cards · 7 worker route files (`ai`, `cron`, `data`, `errors`, `feeds`, `metrics`, `reports`) · 4-tier offline cache (mem → LS → IDB → SW) · 90 source `.ts` · 171 test `.ts` · 27 worker `.ts` · 15 CSS modules · 50 docs · coverage 89.35 / 81.84 / 89.02 / 90.51
>
> **Purpose**: a *first-principles* re-litigation of every decision in this project — frontend, backend, language, tooling, docs, methods, architecture, infrastructure, external sources, data plane — against the 2026-Q2 web platform. No grandfathering. The goal is **best-in-class** for a household always-on TV dashboard. Historical sprint and release entries previously in this file have been consolidated into [CHANGELOG.md](CHANGELOG.md); only forward decisions and gate triggers remain here.

---

## 0. Executive Summary

After 96 sprints across v10 → v13.8.2 the project reached a stable, opinionated, production-hardened plateau: zero client deps, edge-only backend, four-tier offline, comprehensive observability without tracking, and the highest CI gate density in its peer table.

The **strategic frontier** for v14 → v15 is no longer breadth or feature catch-up. It is:

1. **Eliminate every remaining vendor and tool lock-in** — annual neutrality drill (Cloudflare, Deno Deploy, Bun Deploy, fly.io); replace ESLint with oxlint/Biome where rules permit; auto-adopt Rolldown when Vite ships it default.
2. **Replace heuristics with semantics where the budget allows** — SimHash → Cloudflare Vectorize embeddings (semantic news dedup); ad-hoc date math → TC39 Temporal; imperative `state.ts` → Lit Signals (bridge) → TC39 Signals.
3. **Push observability and supply chain to industry leadership** — SLSA L3 hermetic builds, sigstore/cosign provenance, third-party rebuilder verification, optional OpenTelemetry export, automated SBOM diff.
4. **Cross-device continuity *without* introducing auth or a server DB** — WebRTC mirror with QR pairing (gated); CRDT (Yjs ~12 KB) only if WebRTC delta proves insufficient.
5. **Mono-repo harvest** — promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding so the four repos share a single quality gate.

Every line below is a decision, gate, or trigger. No aspiration decoration.

---

## 1. Competitive Landscape — 2026-Q2

### 1.1 Comparison matrix — 12 peer projects

Grouped by mission. Rows are facts at the date listed; if a peer ships a new version this matrix is re-litigated annually.

| Dimension                     | **FamilyDashBoard v13.8.2**                                                                | Homepage              | Dashy             | Homer             | Homarr v2              | Glance              | MagicMirror²            | Beszel              | Dashdot           | NetNewsWire          | Feedly                | Apple Home Hub          |
| ----------------------------- | ------------------------------------------------------------------------------------------ | --------------------- | ----------------- | ----------------- | ---------------------- | ------------------- | ----------------------- | ------------------- | ----------------- | -------------------- | --------------------- | ----------------------- |
| Audience                      | Always-on family TV                                                                        | Homelab launcher      | Homelab dashboard | Static startpage  | Homelab mgmt           | News/feed dashboard | Smart-mirror display    | Server monitor      | Server monitor    | News reader          | News reader (paid)    | Apple smart-home hub    |
| Stars (Apr 2026 est.)         | ~95                                                                                        | 47 K                  | 30 K              | 12 K              | 18 K                   | 27 K                | 19 K                    | 9 K                 | 6 K               | 7 K                  | n/a (closed)          | n/a (closed)            |
| Frontend                      | **Vanilla TS strict + Vite 8**                                                             | Next.js 15 / React 19 | Vue 3.5           | Vue 3             | Next.js 15 / Mantine 7 | Go templates → HTML | Node + MM modules       | SvelteKit           | React + Vite      | Swift native         | React (closed)        | SwiftUI                 |
| Client runtime deps           | **0 / ~88 KB gzip**                                                                        | ~38                   | ~22               | ~12               | ~55                    | 0 (SSR)             | ~15                     | ~4                  | ~25               | n/a                  | unknown               | n/a                     |
| State                         | **Imperative `state.ts` → Lit Signals (v14) → TC39 Signals (v15)**                         | React state           | Pinia             | Vuex              | Zustand                | n/a                 | Module bus              | Svelte runes        | React state       | KVO                  | unknown               | SwiftUI                 |
| Backend                       | **Cloudflare Worker (edge, Hono + Valibot)**                                               | Node reverse-proxy    | Node/Express      | None (static)     | Node + tRPC + Drizzle  | Single Go binary    | Node Express            | Single Go binary    | Single Go binary  | n/a                  | Cloud (closed)        | iCloud                  |
| User database                 | **None** — LS + IDB + JSON export + signed URL share                                       | None (YAML)           | None (YAML)       | None (YAML)       | SQLite + Drizzle       | None (YAML)         | None (JSON)             | SQLite embedded     | None              | SQLite (feeds)       | Cloud DB              | iCloud                  |
| Edge DB / cache               | **KV stale + D1 anon telemetry + DO + Analytics Engine** (+ R2 candidate v14)              | n/a                   | n/a               | n/a               | Postgres / SQLite      | n/a                 | n/a                     | SQLite embedded     | n/a               | n/a                  | proprietary           | iCloud KV               |
| TS strictness                 | **strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`**                           | strict                | partial           | JS-dominant       | strict                 | n/a                 | partial                 | strict              | partial           | n/a                  | unknown               | n/a                     |
| Linter                        | ESLint 10 (→ + oxlint v14 fast pass)                                                       | ESLint default        | ESLint default    | None              | ESLint default         | golangci-lint       | ESLint default          | golangci-lint       | ESLint default    | SwiftLint            | unknown               | SwiftLint               |
| CSS architecture              | **Vanilla `@layer` + tokens + Lightning CSS + `@scope` + `light-dark()` + `@property`**    | Tailwind 4            | SCSS              | SCSS              | Mantine CSS-in-JS      | Hand CSS            | CSS Modules             | Tailwind 4          | Tailwind 3        | AppKit               | Tailwind              | SwiftUI                 |
| Tests                         | **4802 unit + Playwright + axe + 54 VR + LHCI + fast-check + Stryker**                     | Vitest partial        | Vitest partial    | None              | Vitest + PW + Argos    | Go tests            | Minimal                 | Go tests            | Partial           | XCTest               | unknown               | XCTest                  |
| Mutation testing              | **Stryker (error-tracker, config, diag — extending v13.x)**                                | None                  | None              | None              | None                   | None                | None                    | None                | None              | None                 | unknown               | None                    |
| Visual regression             | **Playwright (54 baselines, in-repo)**                                                     | None                  | None              | None              | Argos CI               | None                | None                    | None                | None              | Snapshot             | unknown               | None                    |
| i18n                          | **Hebrew RTL + English** (3rd = contributor-gated)                                         | 45+ (Crowdin)         | 22+               | YAML              | 38+                    | en-only             | 30+                     | en-only             | en-only           | 40+ (Apple)          | 25+                   | 40+                     |
| Accessibility                 | **WCAG 2.2 AA + selected AAA + axe-core gate**                                             | Partial               | Partial           | Unknown           | Partial                | Unknown             | Partial                 | Unknown             | Unknown           | VoiceOver            | Unknown               | Apple stack             |
| Offline / PWA                 | **Full SW · 4-tier cache · precache manifest · BG sync**                                   | No                    | Basic PWA         | Installable       | No                     | No                  | No                      | No                  | No                | Native               | Web stale-only        | Native                  |
| Auth                          | **None (intentional)**                                                                     | Host/proxy            | Keycloak / basic  | None              | OIDC + passkey         | None                | None                    | Email + 2FA         | None              | Apple ID             | Email                 | Apple ID                |
| Config model                  | **UI panel + JSON export (user-owned) + AES-GCM encrypted URL share**                      | YAML + Docker labels  | YAML + UI         | YAML              | UI drag-drop (DB)      | YAML                | Config.js               | UI (DB)             | Config.js         | UI                   | Cloud-stored          | iCloud                  |
| Edge proxy / CORS             | **Worker + KV stale + Valibot + D1 + Analytics Engine + DO rate-limit**                    | Server proxy          | Proxy chain       | n/a               | tRPC over Next         | n/a                 | None                    | n/a                 | n/a               | None                 | proprietary           | iCloud                  |
| Observability                 | **CF Web Analytics + Web Vitals + Error KV + D1 + Reporting API + Prometheus `/api/metrics` (p95 hist) + Analytics Engine + diag JSON** | None | None | None | Sentry (opt) | Prometheus endpoint | None | Built-in metrics | Prometheus | Apple telemetry | proprietary | Apple telemetry |
| Security headers              | **CSP L3 + Trusted Types + COOP/COEP(credentialless)/CORP + Permissions-Policy (28 APIs) + HSTS** | NGINX templates | Varies | None | Next defaults | Go handlers | None | Svelte defaults | Partial | Apple sandbox | proprietary | Apple sandbox |
| Supply-chain                  | **SLSA L2 + SBOM (CycloneDX) + Dependabot + Renovate (Actions SHA) + dependency-review + Stryker** (→ SLSA L3 v14.2) | High (Next churn) | Medium | Low | Very high | ~0 (single bin) | Medium | Low | Medium | Apple-signed | proprietary | Apple-signed |
| Reproducibility               | **`dist.zip` + `worker.js` SLSA-pinned + SBOM per release**                                | Docker image          | Docker image      | Static site       | Docker compose         | Single binary       | Node bundle             | Single binary       | Single binary     | Apple-signed         | n/a                   | n/a                     |
| CI gates                      | **tsc + eslint + markdownlint + stylelint + vitest + LHCI + axe + VR + bundle + SW + SLSA + commitlint + mutation** | Docker + tests | Docker build | Build only | Build + tests | Go build + test | Node build | Go build + test | Go build + test | Xcode tests | proprietary | Xcode tests |
| Cold-start TTI                | **< 1.0 s cached / ~1.6 s fresh**                                                          | ~2.5 s                | ~3 s              | ~1 s (static)     | ~3.5 s                 | ~300 ms             | ~2 s                    | ~500 ms             | ~800 ms           | n/a                  | ~2 s                  | n/a                     |
| Live-data cards               | **12 deep, provider-adapted, history-backed**                                              | 100+ (shallow)        | 50+               | limited           | 30+                    | 12 feed types       | 100+ (shallow)          | Server metrics      | Server metrics    | RSS only             | RSS + ML              | Smart-home only         |
| License                       | MIT                                                                                        | GPL-3.0               | MIT               | Apache-2.0        | MIT                    | AGPL-3.0            | MIT                     | MIT                 | MIT               | MIT                  | proprietary           | proprietary             |
| Unique strength               | Hebrew/Zmanim/Hebcal/Sefaria · TV-3 m · 4-tier offline · zero deps · highest gate density | Ecosystem size        | Themeable         | Simplicity        | Feature breadth        | Go footprint        | Mirror form-factor      | Go deploy           | Go deploy         | macOS polish         | ML clustering         | Apple integration       |

### 1.2 Patterns harvested (or rejected) — 2026-Q2 expansion

This is the operational output of the matrix. New rows for v14 are marked **NEW**.

| Pattern                                              | Source                | Verdict                                       | Landing                                                                                                  |
| ---------------------------------------------------- | --------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Cloudflare Vectorize (semantic dedup)**            | Feedly ML clustering  | **Adopt v14.0** ✱NEW                          | Replaces SimHash v2 in news after 30-day shadow run; precision@10 gate unchanged.                        |
| **Workers AI Llama 4 / multilingual**                | CF 2026 GA roadmap    | **Track v14.x**                               | Replaces Llama 3.3 only when Hebrew quality measurably better at equal cost.                             |
| **DO Hibernatable WebSocket**                        | CF 2025 GA            | **Adopt v14.x** ✱NEW                          | Stocks live-stream + alerts SSE — DO bill drops ~80 % when idle.                                         |
| **Cloudflare R2 for asset cache**                    | CF 2024 GA            | **Adopt v14.x** ✱NEW                          | Backgrounds + offline shell mirrored to R2 with object-version pinning; egress = $0.                     |
| **DO Storage SQL (SQLite-in-DO)**                    | CF 2025 GA            | **Track**                                     | Possible D1 replacement for telemetry; gate: same query latency at lower CPU-time bill.                  |
| **Lit Signals (≈ 1 KB)**                             | Lit team 2025         | **Adopt v14.0** ✱NEW                          | Bridge until TC39 Signals Stage 4. Card-at-a-time migration of `state.ts`.                               |
| **TC39 Signals**                                     | TC39 Stage 3          | **Adopt when polyfill ≤ 1.5 KB and benefit**  | Drop-in replacement for Lit Signals when shipped; same call sites.                                       |
| **TC39 Temporal**                                    | TC39 Stage 3          | **Adopt when polyfill ≤ 10 KB gzip**          | Replaces date math in `hebrew-cal`, `calendar`, `countdown`.                                             |
| **CSS `@starting-style`**                            | Browser 2025          | **Adopt v14.0** ✱NEW                          | Replaces JS enter animations on overlays; net DOM-event win.                                             |
| **CSS Anchor Positioning expansion**                 | Browser 2025          | **Expand v14.0**                              | Already in Stocks Popover; expand to Diag-Overlay + Help dialog.                                         |
| **HTTP Early Hints (103) via Worker**                | RFC 8297              | **Adopt v14.x** ✱NEW                          | Push critical CSS + main JS earlier; expected −80 ms TTI.                                                |
| **Subresource Integrity (auto-injected)**            | W3C SRI               | **Adopt v14.0** ✱NEW                          | Vite plugin emits `<script integrity="…">` per build; tightens supply chain at zero runtime cost.        |
| **Speculation Rules expansion**                      | Browser 2024          | **Audit v13.x**                               | Already shipped; verify all SPA-style transitions list `prerender`, not just `prefetch`.                 |
| **Native File System Access**                        | Browser 2024          | **Adopt v14.x** ✱NEW                          | Replaces clipboard for config import/export when supported; falls back to URL share.                     |
| **CRDT (Yjs ≈ 12 KB) for cross-device**              | Yjs 2024              | **Track**                                     | Only if WebRTC delta proves insufficient. Hard budget: ≤ 12 KB gzip.                                     |
| **Document Picture-in-Picture (video-news)**         | Browser 2024          | **Gate: 3+ user requests**                    | Corner PiP while other cards refresh.                                                                    |
| **OpenTelemetry from Worker (opt-in)**               | OTel 1.30+            | **Adopt v14.2** ✱NEW                          | Self-host `otel-collector` on R2 + Workers ingestor; off by default, env-flag on.                        |
| **Codecov-style PR coverage delta bot**              | OSS bots              | **Adopt v14.0** ✱NEW                          | Existing CI thresholds get a delta comment per PR; zero SaaS dependency (own action).                    |
| **`oxlint` (Rust ESLint, 50–100×)**                  | Oxc 2025              | **Adopt v14.0 as fast pre-pass** ✱NEW         | Run before ESLint in CI; ESLint stays for rules oxlint lacks.                                            |
| **Biome (formatter + minimal lint)**                 | Biome 2.x             | **Track**                                     | Re-evaluate v15 after Biome reaches feature parity with Prettier+ESLint stack we use.                    |
| **Rolldown (Vite Rust bundler)**                     | Vite 2026 default     | **Auto-adopt**                                | Zero code change required.                                                                               |
| **Bun 1.2 test runner**                              | Bun 2026              | **Track only**                                | Vitest 4.1 ecosystem leads; revisit v15 if Vitest stalls.                                                |
| **Argos CI visual regression**                       | Homarr v2             | **Superseded**                                | Playwright baselines in-repo; zero SaaS dependency.                                                      |
| **Drizzle / tRPC / Mantine / Next.js / React**       | Homarr v2             | **Reject (4th reconfirm)**                    | Contradicts zero-dep, no-DB, no-framework lines.                                                         |
| **OIDC / passkey auth**                              | Homarr v2 / Beszel    | **Reject**                                    | Single-household device; largest new attack surface for zero benefit.                                    |
| **AGPL copyleft**                                    | Glance                | **Reject**                                    | MIT aligns with family-project distribution.                                                             |
| **Native Bluetooth / sensor APIs**                   | MagicMirror²          | **Reject**                                    | Permissions-Policy denies them.                                                                          |
| **WebGPU on stocks**                                 | Browser 2025          | **Reject**                                    | SVG charts are ≤ 30 KB; no perf problem.                                                                 |
| **Multi-tenant Workers for Platforms**               | CF 2024               | **Reject**                                    | Single household.                                                                                        |
| **`pnpm` workspace**                                 | pnpm 2024             | **Reject**                                    | npm + parent-workspace pattern is sufficient and simpler.                                                |

### 1.3 Our protected unique strengths

1. **Zero runtime deps on the client** — peers ship 30–55; we ship 0.
2. **TV-first at 3 m viewing distance** — no peer targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 provider-adapted cards with normalized history + stale fallback** — depth over breadth.
5. **4-tier offline cache** — no peer renders a useful dashboard offline.
6. **4802 tests + axe + VR + LHCI + Stryker + SLSA** — highest gate density in the matrix.
7. **Production observability without tracking cookies** — RUM + Vitals + Errors + Reports + Analytics Engine + Prometheus.
8. **Reproducible single-artifact release** — `dist.zip` + `worker.js`, SLSA-pinned, SBOM per release.

---

## 2. First-principles re-litigation — every decision tier

Every ADR re-opened. Stamps: **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, **Supersede**. Decisions confirmed without action are listed once and not re-iterated below.

### 2.1 Code language & TypeScript posture

| Decision                                                     | Verdict                                | Action                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript                                                   | **Keep** (load-bearing)                | Annual posture review.                                                                                      |
| `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` | **Keep** (highest grade)             | No regressions tolerated.                                                                                   |
| `tsgo` (TypeScript-Go) as second typecheck                   | **Withdrawn v13.8.2**                  | Re-evaluate only when tsgo can replace `tsc` outright as a *blocking* gate (no `continue-on-error`).        |
| TypeScript 6.x                                               | **Keep** (current 6.0.3)               | Track 6.1+ on parent `MyScripts/` workspace.                                                                |
| Per-file `// @ts-check` on `.mjs` scripts                    | **Adopt v14.0**                        | Brings `scripts/*.mjs` into the typecheck gate without renaming to `.ts`.                                   |

### 2.2 Frontend architecture & UI

| Decision                                                     | Verdict                                | Action                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Vanilla DOM + `FdbCard` (no framework)                       | **Keep (5th reconfirm)**               | No peer benefit we lack.                                                                                    |
| Shadow DOM / Web Components                                  | **Reject (reconfirmed)**               | `@scope` gives encapsulation without breaking global `@layer` theming.                                      |
| Zero client deps (ADR-002)                                   | **Keep (load-bearing)**                | Non-negotiable.                                                                                             |
| State (`state.ts` imperative)                                | **Replace v14.0**                      | Lit Signals (~1 KB) bridge → TC39 Signals when Stage 4. Card-at-a-time migration.                           |
| Date math (ad-hoc + `Intl`)                                  | **Replace v14.x**                      | TC39 Temporal when polyfill ≤ 10 KB gzip.                                                                   |
| View Transitions L2 (same-doc)                               | **Keep**                               | Theme + config-panel shipped.                                                                               |
| View Transitions cross-doc                                   | **Adopt v14.0**                        | Chrome + Safari shipped Q1-2026; expand to maximise-card flow.                                              |
| CSS `@layer` + tokens + `light-dark()` + `@property`         | **Keep**                               |                                                                                                             |
| CSS `@starting-style`                                        | **Adopt v14.0**                        | Replace JS enter animations on `<dialog>` overlays; remove ~30 LOC of imperative animation code.            |
| CSS Anchor Positioning                                       | **Expand v14.0**                       | Stocks Popover shipped; expand to Diag-Overlay + Help dialog.                                               |
| Container Queries                                            | **Audit v13.x**                        | Confirm every card uses `@container` not viewport breakpoints; tighten layout-drag panes.                   |
| Lightning CSS                                                | **Keep**                               |                                                                                                             |
| Per-card bundle delta CI alert                               | **Shipped**                            | Verified > 10 % growth fails CI.                                                                            |
| Subresource Integrity (auto-injected)                        | **Adopt v14.0**                        | Vite plugin generates `integrity="sha384-…"` per asset; tightens supply chain at zero runtime cost.         |
| HTTP Early Hints (103) from Worker                           | **Adopt v14.x**                        | Push critical CSS + main JS earlier; expected ~80 ms TTI improvement.                                       |
| Native File System Access                                    | **Adopt v14.x**                        | Replaces clipboard for config import/export when supported; URL-share fallback retained.                    |
| Document Picture-in-Picture (video-news)                     | **Gate: 3+ user requests**             |                                                                                                             |

### 2.3 Backend architecture & edge

| Decision                                                     | Verdict                                | Action                                                                                                      |
| ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker (ADR-003)                                  | **Keep**                               | Annual vendor-neutrality drill (ADR-031) starts v14.0.                                                      |
| Hono + Valibot                                               | **Keep**                               | Reconfirmed; ~25 KB win over Zod retained.                                                                  |
| KV stale cache (per route)                                   | **Keep**                               | Per-route TTL annual audit.                                                                                 |
| D1 telemetry                                                 | **Keep, audit v15**                    | Compare with DO Storage SQL and Workers Analytics Engine for the same workload; pick lowest CPU-bill.       |
| Durable Objects                                              | **Keep**                               | Alerts SSE; pinned IL; p95 ~150 ms.                                                                         |
| DO Hibernatable WebSocket                                    | **Adopt v14.x**                        | Stocks live-stream + alerts SSE — DO bill drops ~80 % when idle.                                            |
| R2 for asset cache                                           | **Adopt v14.x**                        | Backgrounds + offline shell mirrored; egress = $0.                                                          |
| Workers Queues (error fan-out)                               | **Keep**                               | Shipped v13.0.                                                                                              |
| Email Workers weekly digest                                  | **Keep**                               | Shipped v13.0 opt-in.                                                                                       |
| Workers AI (Llama 3.3 8B)                                    | **Keep, tighten precision**            | SimHash v2 → Vectorize embedding pipeline gate.                                                             |
| Cloudflare Vectorize (semantic news dedup)                   | **Adopt v14.0**                        | Replace SimHash after 30-day shadow comparison passes precision@10 gate.                                    |
| Hyperdrive / Postgres / Hyperdrive cache                     | **Reject (reconfirmed)**               | No relational store in stack.                                                                               |
| User-facing DB                                               | **Reject (reconfirmed)**               | LS + IDB + JSON export + AES-GCM URL share cover it.                                                        |
| Rate limiting (DO counter)                                   | **Keep**                               | Per-client adaptive back-off live across all routes.                                                        |
| Worker bundle budget                                         | **Keep ≤ 75 KB gzip**                  | CI-enforced.                                                                                                |
| Annual vendor-neutrality build drill                         | **Adopt v14.0** (ADR-031)              | Rebuild `worker/src` on Deno Deploy + Bun Deploy + fly.io once per major release.                           |
| OpenTelemetry from Worker                                    | **Adopt v14.2 opt-in**                 | Self-host collector; off by default; env-flag on.                                                           |

### 2.4 Data plane & external API surface

| Card / area      | Provider redundancy                                                                       | Action                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| news             | RSS aggregator → SimHash v2 → (v14) **Vectorize embeddings** → Llama 3.3 summary          | Vectorize shadow run 30 d before SimHash retire.                                              |
| weather          | Met Norway (default) + NWS (US-travel mode) + provider chain                              | Open-Meteo as 3rd fallback; gate: stable schema mapping in Valibot.                           |
| stocks           | Yahoo + Finnhub HTTP today                                                                | **DO Hibernatable WebSocket** live-stream v14.x; gate: TTI + battery budget.                  |
| currency         | exchangerate.host + open.er-api                                                           | Add ECB direct as third source.                                                               |
| calendar         | iCal (RFC-5545) + Google Calendar feed                                                    | Fuzz-case set 204 → 250+ v14.0.                                                               |
| hebrew-cal       | Hebcal + Zmanim + Sefaria                                                                 | Replace internal date math with Temporal when polyfill in budget.                             |
| alerts           | Pikud Ha-Oref + Tzeva-Adom + DO SSE                                                       | DO Hibernatable upgrade.                                                                      |
| motivation       | Local curator + Workers AI Hebrew quote                                                   | Non-repeat window already shipped; faith-safe curator audit annually.                         |
| tasks            | Local IDB                                                                                 | Optional CRDT sync gate (Yjs ≤ 12 KB).                                                        |
| system-info      | `navigator.connection` + battery + memory                                                 | Add `navigator.userAgentData` high-entropy hints v14.x.                                       |
| countdown        | Local                                                                                     | Stable.                                                                                       |
| video-news       | Embed allowlist only                                                                      | Document PiP gate: 3+ user requests.                                                          |

**Cross-cutting**: every external response is Valibot-validated, KV-stale-cached, has a per-route TTL documented in `worker/openapi.yaml`, and falls back to a stale tier on failure.

### 2.5 Tooling & versions

| Tool                       | Current     | Verdict / Action                                                                                                   |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Node.js                    | 22 LTS      | Track 24 LTS (Oct 2026); switch on first stable.                                                                   |
| TypeScript                 | 6.0.3       | Track minor releases monthly.                                                                                      |
| Vite                       | 8           | Auto-adopt 9 + Rolldown when default.                                                                              |
| Vitest                     | 4.1.5       | Auto-adopt 4.2+; track 5.x.                                                                                        |
| ESLint                     | 10          | **Add oxlint as fast pre-pass v14.0**; ESLint retained for rules oxlint lacks.                                     |
| Prettier                   | 3.x         | **Track Biome 2.x**; switch only if feature-parity on TS + Markdown + JSON.                                        |
| Stylelint                  | 16.x        | Keep; consider Lightning-CSS-only validation v15 if rule set fully migrated.                                       |
| Playwright                 | 1.5x        | Track latest each release; baseline regen quarterly.                                                               |
| `markdownlint-cli2`        | 0.22        | Keep.                                                                                                              |
| `commitlint`               | 19.x        | Keep + conventional-commits enforced.                                                                              |
| `changesets`               | 2.x         | Keep.                                                                                                              |
| Stryker (mutation)         | 8.x         | Extend scope to `error-tracker` + `config` + `diag` v14.0; threshold ≥ 85 %.                                       |
| `fast-check` (property)    | 3.x         | Extend to worker-client envelope invariants v14.x.                                                                 |
| `axe-core` (a11y)          | latest      | Keep CI gate.                                                                                                      |
| Lighthouse CI              | latest      | Tighten perf 0.97 → 0.98 v14.x.                                                                                    |
| `markdown-link-check`      | n/a         | **Adopt v14.0**: monthly cron-only, never blocks PR.                                                               |

### 2.6 Testing strategy

| Layer                | Tooling                              | Action                                                                                                        |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Unit                 | Vitest 4.1 + happy-dom 20            | Keep. Suite split per file (no shared imports).                                                               |
| Component            | `@vitest/browser` (Playwright provider) | Adopt for cards too DOM-complex for happy-dom (maximise-FLIP, layout-drag) v14.0.                          |
| Property-based       | fast-check                           | Extend to worker-client end-to-end envelope invariants v14.x.                                                 |
| Mutation             | Stryker                              | Threshold ≥ 85 %; extend to error-tracker + config + diag v14.0.                                              |
| Visual regression    | Playwright (in-repo baselines)       | 54 → 80+ baselines; add DO-SSE alert states + video-news + maximise-FLIP v13.x → v14.0.                       |
| End-to-end           | Playwright                           | Keep.                                                                                                         |
| Accessibility        | axe-core (CI gate)                   | Keep + add manual screen-reader test pass per major release.                                                  |
| Performance          | Lighthouse CI (perf ≥ 0.97)          | Tighten to 0.98 v14.x once Early Hints + SRI ship.                                                            |
| Coverage thresholds  | 89 / 81 / 89 / 90 (current)          | **Ratchet path**: 89/81/89/90 → 92/85/92/93 (v14) → 95/90/95/96 (v15). +1% per minor release.                 |

### 2.7 Observability, security, supply chain

| Area              | Action                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| Obs               | Diag schema v1 → v2 only if needed. **OpenTelemetry from Worker (opt-in, v14.2)**.                                 |
| Obs               | SLO dashboard (Grafana free tier or self-hosted) — gate: > 100 K req / day or 5+ user reports of degraded perf.    |
| Sec               | **SLSA L3 hermetic build** (ADR-035) — first shipped release v14.2. Sigstore/cosign per release.                   |
| Sec               | Subresource Integrity auto-injected v14.0.                                                                          |
| Sec               | Secret rotation on every major release. Reporting API sampling audit annually.                                      |
| Sec               | CSP `require-trusted-types-for 'script'` audit v14.0; verify policy enforcement in production logs.                |
| Sec               | Post-quantum-ready signature for config URL share — **track only**; current AES-GCM + HMAC remains adequate.        |
| Sec               | npm + GitHub Actions provenance (Sigstore) — adopt v14.2.                                                          |
| Infra             | Cloudflare Pages migration — **gate**: measurable TTI or caching regression on Pages.                              |
| Infra             | Annual vendor-neutrality drill (ADR-031) starts v14.0.                                                              |
| DX                | `docs/adr/README.md` auto-generated from ADR frontmatter — shipped v13.                                            |
| DX                | Cross-project MCP matrix in `.github/copilot/MCP_SERVERS.md` — extend with GitKraken + Azure rows v14.0.           |
| DX                | Mono-repo tooling harvest — propagate `tooling/` presets to BudgetManager / CrossTideWeb / Wedding v14.1.           |
| DX                | Codecov-style PR coverage delta bot (own action, no SaaS) v14.0.                                                    |

### 2.8 Documentation discipline

| Type                  | Current  | Verdict / Action                                                                                                   |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| ADRs                  | 37       | One per non-trivial decision. ADR-021 withdrawn v13.8.2.                                                           |
| User docs (`docs/`)   | 13 + 24  | Keep. `docs/README.md` is the table of contents.                                                                   |
| Legacy docs           | `docs/legacy/BestDashBoard.html` | Keep archived; never edit.                                                                              |
| `CHANGELOG.md`        | per-release sections | Single source of historical truth. Old sprint logs collapsed to one line per sprint.                   |
| `ROADMAP.md`          | this file | Forward-looking only. Shipped releases live in CHANGELOG.                                                         |
| `.github/`            | instructions, prompts, agents, skills, copilot config | Keep; deduplicate against `copilot-instructions.md` (single source of truth). |
| Architecture diagrams | `.github/assets/*.svg` | One per non-trivial subsystem. Auto-validated against Markdown via mermaid-validator pre-commit (v14.0). |
| Inline comments       | sparse, intent-only | Keep. No JSDoc for trivial functions.                                                                       |

### 2.9 Decisions held rejected (reconfirmed 2026-Q2)

Client framework rewrite · Shadow DOM · user-facing DB · OIDC/passkey · 40+ language i18n · pre-commit hooks (CI is the gate) · WebGPU/WASM hot paths · OPFS structured cache · AGPL · multi-tenant Workers for Platforms · 3rd language (deferred to contributor offer) · pnpm workspace · Husky · Lerna/Nx · hand-rolled bundler · custom auth · Sentry SaaS.

---

## 3. Strategic Streams (v14 → v15)

Each stream lists deliverables · ADR candidates · exit criteria · gate triggers. Completed work is dropped — see [CHANGELOG.md](CHANGELOG.md).

### 3.1 V14-FOUNDATIONS — Tooling acceleration & supply-chain tightening

Target: **v14.0** (Q1 2027).

- [ ] **oxlint** as fast pre-pass (~50–100× ESLint).
- [ ] **`@vitest/browser`** component tests for maximise-FLIP + layout-drag.
- [ ] **Subresource Integrity** auto-injected per asset.
- [ ] **Codecov-style coverage delta bot** (own action, zero SaaS).
- [ ] **`@ts-check` on `scripts/*.mjs`** — bring helper scripts into the type gate.
- [ ] **CSS `@starting-style`** — replace JS enter animations on `<dialog>` overlays.
- [ ] **CSS Anchor Positioning** expansion (Diag-Overlay + Help dialog).
- [ ] **Cross-doc View Transitions** for theme switch + maximise-card.
- [ ] **Stryker** scope extension: error-tracker + config + diag, threshold ≥ 85 %.
- [ ] **Coverage ratchet**: 89/81/89/90 → 92/85/92/93.
- [ ] **mermaid-validator pre-commit** — every architecture diagram in Markdown must validate.

**Exit**: oxlint green on first pass; CI delta bot live; SRI in production HTML; coverage at 92/85/92/93; LHCI perf still ≥ 0.97.

### 3.2 V14-SEMANTIC — Replace heuristics with embeddings & Signals

Target: **v14.0** (Q1–Q2 2027).

- [ ] **Cloudflare Vectorize** semantic news dedup (30-day shadow → SimHash retire after precision@10 gate).
- [ ] **Lit Signals** (~1 KB) bridge — incremental `state.ts` migration, card-at-a-time.
- [ ] **TC39 Signals** drop-in when polyfill ≤ 1.5 KB gzip and Stage 4.
- [ ] **TC39 Temporal** in `hebrew-cal` + `calendar` + `countdown` when polyfill ≤ 10 KB gzip.
- [ ] **HTTP Early Hints (103)** from Worker — push critical CSS + main JS earlier.

**Exit**: Vectorize precision@10 ≥ SimHash + 15 %; Signals migration ≥ 50 % of `state.ts` call sites; LHCI perf ≥ 0.98 cached.

### 3.3 V14-CONTINUITY — Cross-device without auth (gated)

Target: **v14.x** (gated).

- [x] AES-GCM encrypted config URL export.
- [x] Import flow + `docs/sync.md`.
- [ ] **WebRTC mirror** — short-lived (5 min) QR-pairing data channel, STUN-only, no TURN, no relay. Valibot on incoming delta. ADR-036.
- [ ] **CRDT (Yjs)** — *track only*. Adopt only if WebRTC delta proves insufficient AND Yjs core ≤ 12 KB gzip.

**Gate trigger**: 3+ users request continuity in an issue thread. **Exit**: zero DB, zero account, zero worker storage. Purely client-side crypto on a user-owned medium (clipboard / URL / QR).

### 3.4 V14-EDGE — Workers platform expansion

Target: **v14.x** (Q2–Q3 2027).

- [ ] **DO Hibernatable WebSocket** — stocks live-stream + alerts SSE.
- [ ] **R2 for asset cache** — backgrounds + offline shell.
- [ ] **Workers AI Llama 4** — only when measurably better Hebrew quality at equal cost.
- [ ] **DO Storage SQL audit** — possible D1 replacement; gate: same query latency at lower CPU bill.

**Exit**: DO bill drops ≥ 50 % at idle; R2 egress = $0 confirmed.

### 3.5 V14-HARMONISE — Mono-repo reference

Target: **v14.1**.

- [x] Composite `tooling/ci/check.yml`.
- [x] Cross-project tooling registry.
- [ ] BudgetManager / CrossTideWeb / Wedding on `tooling/eslint/web-ts-app.mjs` + `tooling/tsconfig/base-typescript.json`.
- [ ] Shared `tooling/vitest/happy-dom.mjs` preset across all three.
- [ ] Cross-project release gate (each repo's `release.yml` extends shared composite).

**Exit**: all three sibling repos green under shared presets; one breakage in any repo blocks the others' release.

### 3.6 V14-SECURITY-L3 — SLSA L3 + supply chain

Target: **v14.2** (Q3 2027).

- [x] ADR-035 planning (v13.2).
- [ ] **SLSA Level 3 hermetic build** (`slsa-framework/slsa-github-generator`).
- [ ] **Sigstore/cosign** signed provenance per release.
- [ ] **Secret-scanning attestation** in SBOM.
- [ ] **Annual vendor-neutrality drill (ADR-031)** — first run: rebuild on Deno Deploy + Bun Deploy + fly.io.
- [ ] **OpenTelemetry from Worker (opt-in)**.

**Exit**: third-party rebuilder produces a byte-identical artefact; sigstore proof links resolve.

### 3.7 V15-PRODUCT — Optional evolution (gated)

Target: **v15+** (no pre-committed content).

| Candidate                                                  | Gate                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| Document Picture-in-Picture on video-news                  | User request ≥ 3                                           |
| User-supplied background URL list + CF Images resize       | User request ≥ 5                                           |
| AI summary card (local Hebrew LLM, WASM quantised)         | Viable open-weight Hebrew model ≤ 20 MB at useful speed    |
| 3rd language (Arabic, German)                              | Contributor offers to maintain it                          |
| Bun 1.2 test runner                                        | Vitest ecosystem parity lost                               |
| Biome instead of Prettier+ESLint                           | Biome reaches feature parity with our stack                |
| Cloudflare Pages migration                                 | Measurable TTI or caching regression on Pages              |
| Native File System Access for config import/export         | Browser support ≥ 80 % of users                            |
| WCAG 3.0 audit                                             | WCAG 3.0 reaches Candidate Recommendation                  |

---

## 4. Forward Release Plan

Past releases live in [CHANGELOG.md](CHANGELOG.md). This section is forward-only.

| Version    | Theme                                          | Window         | Scope link                       |
| ---------- | ---------------------------------------------- | -------------- | -------------------------------- |
| **v13.9**  | Optional residual polish (no new ADRs)         | 2026-Q3        | Bug fixes only                   |
| **v14.0**  | V14-FOUNDATIONS + V14-SEMANTIC                 | 2027-Q1        | §3.1, §3.2                       |
| **v14.1**  | V14-HARMONISE                                  | 2027-Q2        | §3.5                             |
| **v14.2**  | V14-SECURITY-L3 + V14-EDGE                     | 2027-Q3        | §3.6, §3.4                       |
| **v14.x**  | V14-CONTINUITY (gated)                         | when triggered | §3.3                             |
| **v15.0**  | V15-PRODUCT (gated only)                       | 2027-Q4+       | §3.7                             |

---

## 5. Best-in-class targets

| Axis              | v13.8.2 (now)                            | v14 target                                 | v15 target                                 |
| ----------------- | ---------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Client deps       | 0                                        | 0                                          | 0                                          |
| Worker deps       | 2 (Hono + Valibot)                       | 2                                          | 2                                          |
| TS strict         | strict + unchecked-idx + verbatim        | same + scripts under `@ts-check`           | same                                       |
| Linter            | ESLint 10                                | + oxlint fast pre-pass                     | re-evaluate Biome                          |
| State             | Imperative `state.ts`                    | Lit Signals (≥ 50 % migrated)              | TC39 Signals (full)                        |
| Date math         | ad-hoc + `Intl`                          | TC39 Temporal (in budget)                  | TC39 Temporal (full)                       |
| News dedup        | SimHash v2                               | Vectorize embeddings                       | Vectorize + multi-stage                    |
| Stocks transport  | HTTP polling                             | DO Hibernatable WebSocket                  | same                                       |
| Coverage          | 89 / 81 / 89 / 90                        | 92 / 85 / 92 / 93                          | 95 / 90 / 95 / 96                          |
| Tests             | 4802                                     | 5000+                                      | 5500+                                      |
| Suites            | 154                                      | 170+                                       | 180+                                       |
| LHCI perf         | ≥ 0.97                                   | ≥ 0.98                                     | ≥ 0.98                                     |
| TTI cached        | < 1.0 s                                  | < 850 ms                                   | < 750 ms                                   |
| Worker gzip       | ~62 KB (budget 75 KB)                    | ≤ 75 KB                                    | ≤ 75 KB                                    |
| WCAG              | 2.2 AA + selected AAA                    | 2.2 AAA closure + cognitive                | re-audit under WCAG 3.0 draft              |
| Security          | CSP L3 · Trusted Types · SLSA L2 · SBOM  | + SRI auto · SLSA L3 · sigstore/cosign     | + third-party rebuild verified             |
| Observability     | RUM + Vitals + Errors + p95 + Analytics  | + opt-in OpenTelemetry                     | + SLO dashboard                            |
| Vendor lock-in    | CF-first; exits documented               | Annual rebuild drill green                 | Continuous rebuild drill green             |
| i18n              | he + en                                  | same (3rd = contributor-gated)             | same                                       |
| Auth              | None                                     | None                                       | None                                       |

---

## 6. What this roadmap deliberately does **not** do

- No monetisation, no SaaS tier, no login, no multi-tenant path.
- No framework rewrite, no Shadow DOM, no user-facing DB.
- No 40+ language i18n, no pre-commit hooks, no WebGPU/WASM hot paths, no OPFS.
- No AGPL relicensing.
- No `husky`, `lerna`, `nx`, `pnpm workspace`, hand-rolled bundler, custom auth, Sentry SaaS.
- No speculative features without a gate trigger or user request count.
- No tool addition that increases our blocking-CI runtime by > 30 s without a measured quality gain.

Every line above can be defended on merit. When a decision can no longer be defended, it goes to the ADR graveyard with a `superseded-by` link, not into the product.
