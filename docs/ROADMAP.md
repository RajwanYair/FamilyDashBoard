# FamilyDashBoard — Strategic Roadmap

> **Refresh date**: 2026-04-27 · **Shipped baseline**: v13.12.0 (Sprint 117 — production-ready cleanup: 103 inline styles extracted to utility classes; root duplicates `CLAUDE.md` + `icon.svg` removed; `link-check.yml` strict-mode; documentation/SVG/instruction references rewired).
>
> **Inventory**: 4835 tests / 157 suites / 0 failures · 0 ESLint errors · 0 ESLint warnings · 0 `eslint-disable` · 0 `@ts-ignore` · 0 TS errors · 0 markdownlint / stylelint issues · 39 ADRs · 0 client runtime deps · 2 worker deps (Hono + Valibot) · 6 themes · 12 cards · 4-tier offline cache · 90 source `.ts` · 171 test `.ts` · 27 worker `.ts` · 15 CSS modules · 50 docs · coverage 89.35 / 81.84 / 89.02 / 90.51.
>
> **Purpose**: a deliberate, *first-principles re-litigation of every decision* — including the ones that look clean. No grandfathering. The bar is **best-in-class** for an always-on family TV dashboard. Historical sprint and release entries live in [CHANGELOG.md](../CHANGELOG.md); this file is forward-looking only.

---

## 0. Executive Summary

After 117 sprints across v10 → v13.12.0 the project has reached a stable, opinionated, production-hardened plateau: zero client deps, edge-only backend, four-tier offline, comprehensive observability without tracking, and the highest CI gate density in its peer table.

The strategic frontier for v14 → v15 is no longer breadth or feature catch-up. It is:

1. **Eliminate every remaining vendor and tool lock-in** — annual neutrality drill (Cloudflare ↔ Deno Deploy ↔ Bun Deploy ↔ fly.io); replace ESLint with `oxlint`/Biome where rules permit; auto-adopt Rolldown when Vite ships it default.
2. **Replace heuristics with semantics where the budget allows** — SimHash → Cloudflare Vectorize embeddings (semantic news dedup); ad-hoc date math → TC39 Temporal; imperative `state.ts` → in-house Signals (ADR-038, shipped) → TC39 Signals.
3. **Push observability and supply chain to industry leadership** — SLSA L3 hermetic builds, Sigstore/cosign provenance, third-party rebuilder verification, optional OpenTelemetry export, automated SBOM diff bot (shipped v13.9).
4. **Cross-device continuity *without* introducing auth or a server DB** — WebRTC mirror with QR pairing (gated); CRDT (Yjs ~12 KB) only if WebRTC delta proves insufficient.
5. **Mono-repo harvest** — promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding so all four repos share one quality gate.

Every line below is a decision, gate, or trigger. No aspiration decoration.

---

## 1. First-Principles Re-Litigation — Every Axis Reopened

Every "clean" decision is challenged below. Stamps: **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, **Supersede**. Decisions confirmed without action are listed once and not iterated.

### 1.1 Code language & TypeScript posture

| Decision | Challenge | Verdict | Action |
|---|---|---|---|
| TypeScript | Could Rust+wasm-bindgen win on a 75 KB worker? | **Keep** (load-bearing) | Annual posture review only. Rust → WASM rejected: developer pool, debug story, and bundle floor (≈ 50 KB just for runtime) are worse for our budget. |
| `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` | Stricter posture available? | **Keep** (highest grade) | Track `exactOptionalPropertyTypes` migration v14.x — currently disabled to keep card config evolutions ergonomic; quantify breakage cost first. |
| `tsgo` (TypeScript-Go) as second typecheck | Re-add as informational? | **Withdrawn (ADR-021)** | Re-evaluate only when `tsgo` can replace `tsc` outright as a *blocking* gate. No `continue-on-error` shadow gates. |
| TypeScript 6.x | Stay current? | **Keep** (6.0.3) | Track 6.1+ on parent `MyScripts/`. |
| `// @ts-check` on `.mjs` scripts | Bring helpers into the type gate? | **Shipped v13.9** | All `scripts/*.mjs` now opt-in via `tsconfig.scripts.json`. |
| Vanilla JS escape hatches in `worker/src` | Allowed anywhere? | **Reject** | TS strict everywhere; no `.js` source. |

### 1.2 Frontend architecture & UI

| Decision | Challenge | Verdict | Action |
|---|---|---|---|
| Vanilla DOM + `FdbCard` (no framework) | React 19 / Solid / Svelte 5 won the productivity war? | **Keep (5th reconfirm)** | No peer benefit we lack. Bundle floor of any framework ≥ 30 KB gzip vs. our ~12 KB main thread runtime. |
| Shadow DOM / Web Components | Better encapsulation than `@scope`? | **Reject (reconfirmed, ADR-001)** | `@scope` gives encapsulation without breaking global `@layer` theming or `prefers-reduced-motion` cascades. |
| Zero client deps (ADR-002) | Ever? | **Keep (load-bearing)** | Non-negotiable. Polyfills count against the 75 KB ceiling. |
| State (`state.ts` imperative) | Replace? | **In progress** | ADR-038 ships zero-dep `signals.ts` mirroring TC39 Signals + Lit Signals API. Card-at-a-time migration v14.0; one-line swap when TC39 reaches Stage 4. |
| Date math (ad-hoc + `Intl`) | TC39 Temporal? | **Replace v14.x** | When polyfill ≤ 10 KB gzip — gate `hebrew-cal`, `calendar`, `countdown`. |
| View Transitions L1 (same-doc) | Already used? | **Keep** | Theme + config-panel + maximise-FLIP shipped. |
| View Transitions L2 (cross-doc) | Adopt? | **Adopt v14.0** | Chrome + Safari shipped Q1-2026; expand to maximise-card flow. |
| CSS `@layer` + tokens + `light-dark()` + `@property` | Sufficient? | **Keep** | Tailwind 4 / CSS-in-JS rejected — they would break the 6-theme token system. |
| CSS `@starting-style` | Replace JS enter animations? | **Shipped v13.9** | All `<dialog>` overlays use native enter/exit. |
| CSS Anchor Positioning | Beyond Stocks Popover? | **Expand v14.0** | Diag-Overlay + Help dialog. |
| Container Queries-only layout (ADR enforced via `check-container-queries.mjs`) | Audited? | **Shipped v13.10** | CI guard blocks viewport `@media` in card CSS. |
| Lightning CSS | Faster than esbuild CSS? | **Keep (ADR-017)** | Re-evaluate v15 if esbuild-css adds nesting + custom-property fallback at parity. |
| Per-card bundle delta CI alert | Shipped? | **Shipped** | > 10 % growth fails CI. |
| Subresource Integrity auto-injection | Source patched? | **Shipped v13.9** | `injectSri` Vite plugin emits `integrity="sha384-…"`. |
| HTTP Early Hints (103) from Worker | Adopt? | **Adopt v14.x** | ~80 ms TTI improvement; gate Vite ↔ CF interaction in shadow first. |
| Native File System Access | Shipped? | **Shipped v13.10** | `src/core/fs-access.ts` with blob-anchor + hidden input fallback. |
| Document Picture-in-Picture (video-news) | Adopt? | **Gate: 3+ user requests** | |
| Streams API for news ingestion | Replace JSON-batch with NDJSON streamed render? | **Defer v15** | Quantify perceived-TTI win first; current p95 already < 1.0 s cached. |
| `<selectlist>` + `<details>` `name=` (Open UI) | Replace `<dialog>`? | **Reject** | `<dialog>` is GA across all browsers; Open UI remains experimental. |

### 1.3 Backend architecture & edge

| Decision | Challenge | Verdict | Action |
|---|---|---|---|
| Cloudflare Worker (ADR-003) | Better edge? | **Keep** | Annual vendor-neutrality drill (ADR-031) starts v14.0 — rebuild on Deno Deploy + Bun Deploy + fly.io. |
| Hono + Valibot | Lighter? | **Keep** | ~25 KB win over Zod retained; Hono routing < 8 KB. |
| KV stale cache (per route) | Per-route TTL audit? | **Keep** (ADR-013) | Annual TTL review against `worker/openapi.yaml`. |
| D1 telemetry | Cheaper alt? | **Keep, audit v15** | Compare DO Storage SQL + Workers Analytics Engine for same workload. |
| Durable Objects (alerts SSE) | Hibernatable? | **Adopt v14.x** | DO Hibernatable WebSocket — stocks live-stream + alerts SSE; ~80 % bill drop when idle. |
| R2 for asset cache | Adopt? | **Adopt v14.x** | Backgrounds + offline shell mirrored; egress = $0. |
| Workers Queues (error fan-out) | Shipped? | **Shipped v13.0** | |
| Email Workers weekly digest | Shipped? | **Shipped v13.0 (opt-in)** | |
| Workers AI (Llama 3.3 8B) | Llama 4? | **Track v14.x** | Switch only when Hebrew quality measurably better at equal cost. |
| Cloudflare Vectorize (semantic news dedup) | Replace SimHash? | **Adopt v14.0** | 30-day shadow vs SimHash; precision@10 ≥ +15 % gate. |
| Hyperdrive / Postgres | Adopt? | **Reject (reconfirmed)** | No relational store in stack. |
| User-facing DB | Adopt? | **Reject (reconfirmed)** | LS + IDB + JSON export + AES-GCM URL share cover it. |
| Rate limiting (DO counter) | Sufficient? | **Keep** | Per-client adaptive back-off live across all routes. |
| Worker bundle budget ≤ 75 KB gzip | Tighten? | **Keep ceiling** | Tightening to 60 KB rejected — leaves no room for Hyperdrive-free DO Storage SQL adapter. |
| Annual vendor-neutrality build drill | Adopt? | **Adopt v14.0 (ADR-031)** | First run rebuild on Deno Deploy + Bun Deploy + fly.io once per major release. |
| OpenTelemetry from Worker | Adopt? | **Adopt v14.2 (opt-in)** | Self-hosted collector; off by default, env-flag on. |
| WebTransport / HTTP/3 push | Adopt for stocks/alerts? | **Defer** | DO Hibernatable WebSocket has same UX at known cost; revisit v15 once CF supports WebTransport server-side natively. |

### 1.4 Data plane & external API surface

| Card / area | Provider redundancy | Verdict / Action |
|---|---|---|
| news | RSS aggregator → SimHash v2 → (v14) **Vectorize embeddings** → Llama 3.3 summary | Vectorize shadow run 30 d before SimHash retire. |
| weather | Met Norway (default) + NWS (US-travel mode) + provider chain | Add Open-Meteo as 3rd fallback; gate stable schema mapping in Valibot. |
| stocks | Yahoo + Finnhub HTTP today | DO Hibernatable WebSocket live-stream v14.x; gate TTI + battery budget. |
| currency | exchangerate.host + open.er-api | Add ECB direct as third source v14.x. |
| calendar | iCal (RFC-5545) + Google Calendar feed | Fuzz-case set 204 → 250+ v14.0. |
| hebrew-cal | Hebcal + Zmanim + Sefaria | Replace internal date math with Temporal when polyfill in budget. |
| alerts | Pikud Ha-Oref + Tzeva-Adom + DO SSE | DO Hibernatable upgrade. |
| motivation | Local curator + Workers AI Hebrew quote | Non-repeat window already shipped; faith-safe curator audit annually. |
| tasks | Local IDB | Optional CRDT sync gate (Yjs ≤ 12 KB). |
| system-info | `navigator.connection` + battery + memory | Add `userAgentData` high-entropy hints v14.x. |
| countdown | Local | Stable. |
| video-news | Embed allowlist only | Document PiP gate: 3+ user requests. |

**Cross-cutting**: every external response is Valibot-validated, KV-stale-cached, has a per-route TTL documented in `worker/openapi.yaml`, and falls back to a stale tier on failure.

### 1.5 Database / storage / infrastructure

| Tier | Current | Challenged with | Verdict |
|---|---|---|---|
| Browser L1 | In-memory `Map` | None viable | **Keep** |
| Browser L2 | `localStorage` (`dash_v2_*`) | OPFS structured cache | **Keep** — OPFS has no eviction story for our LRU pattern. |
| Browser L3 | IndexedDB ≤ 50 MB LRU | OPFS / SQLite-WASM | **Keep** — SQLite-WASM ≈ 1.5 MB blows our ceiling. |
| Browser L4 | Service Worker cache (7 origins) | None viable | **Keep** |
| Edge cache | Cloudflare KV (per-route) | DO Storage SQL | **Audit v15** |
| Edge analytics | D1 + Analytics Engine | Workers Logs | **Keep, audit v15** |
| Edge object | (none) | R2 | **Adopt v14.x** for backgrounds + offline shell |
| User-owned config | LS + IDB + JSON export + AES-GCM URL | Cloud DB | **Reject (4th reconfirm)** |
| Reproducible artefact | `dist.zip` + `worker.js` (SLSA L2) | Docker image | **Keep** — Docker adds OS surface for zero benefit on a static SPA. |

### 1.6 Tooling & versions

| Tool | Current | Challenge | Action |
|---|---|---|---|
| Node.js | 22 LTS | 24 LTS | Track; switch on first stable (Oct 2026). |
| TypeScript | 6.0.3 | 6.1+ | Track minor releases monthly. |
| Vite | 8 | 9 + Rolldown | Auto-adopt when default. |
| Vitest | 4.1.5 | 4.2 / 5.x | Auto-adopt 4.2; track 5.x. |
| ESLint | 10 | `oxlint` (50–100×) | **Add as fast pre-pass v14.0 (ADR-039)**; ESLint retained for rules `oxlint` lacks. |
| Prettier | 3.x | Biome 2.x | **Track**; switch only on TS+MD+JSON parity. |
| Stylelint | 16.x | Lightning-CSS-only | Keep; consider Lightning-CSS-only validation v15 if rule set fully migrated. |
| Playwright | 1.5x | latest | Quarterly baseline regen. |
| `markdownlint-cli2` | 0.22 | latest | Keep. |
| `commitlint` | 19.x | conventional | Keep. |
| `changesets` | 2.x | release-please | Keep (ADR-034). |
| Stryker (mutation) | 8.x | — | Extend scope: error-tracker + config + diag v14.0; threshold ≥ 85 %. |
| `fast-check` (property) | 3.x | — | Extend to worker-client envelope invariants v14.x. |
| `axe-core` (a11y) | latest | — | Keep CI gate. |
| Lighthouse CI | latest | — | Tighten perf 0.97 → 0.98 v14.x. |
| `markdown-link-check` | n/a | — | **Adopt v14.0**: monthly cron-only, never blocks PR. |
| `pnpm` workspace | npm + parent | — | **Reject** — current pattern is sufficient and simpler. |
| Husky / Lefthook | none (CI is the gate) | — | **Reject** — pre-commit hooks slow contributors; CI has zero suppression. |

### 1.7 Testing strategy

| Layer | Tooling | Action |
|---|---|---|
| Unit | Vitest 4.1 + happy-dom 20 | Keep. Suite split per file (no shared imports). |
| Component (DOM-heavy) | `@vitest/browser` (Playwright provider) | Adopt v14.0 for maximise-FLIP, layout-drag — too DOM-complex for happy-dom. |
| Property-based | fast-check | Extend to worker-client envelope invariants v14.x. |
| Mutation | Stryker | Threshold ≥ 85 %; extend to error-tracker + config + diag v14.0. |
| Visual regression | Playwright (in-repo baselines) | 54 → 80+ baselines; add DO-SSE alert states + video-news + maximise-FLIP. |
| End-to-end | Playwright | Keep. |
| Accessibility | axe-core (CI gate) | Keep + manual screen-reader pass per major release. |
| Performance | Lighthouse CI (perf ≥ 0.97) | Tighten to 0.98 v14.x once Early Hints + SRI ship in concert. |
| Coverage thresholds | 89 / 81 / 89 / 90 (current) | **Ratchet path**: 89/81/89/90 → 92/85/92/93 (v14) → 95/90/95/96 (v15). +1 % per minor release. Sprint 116 deferred ratchet — add targeted branch/line tests in S117 to clear the 81.84 → 82 threshold. |

### 1.8 Observability, security, supply chain

| Area | Action |
|---|---|
| Obs | Diag schema v1 → v2 only if needed. **OpenTelemetry from Worker (opt-in, v14.2)**. |
| Obs | SLO dashboard (Grafana free tier or self-hosted) — gate: > 100 K req / day or 5+ user reports of degraded perf. |
| Sec | **SLSA L3 hermetic build (ADR-035)** — first shipped v14.2. Sigstore/cosign per release. |
| Sec | Subresource Integrity auto-injected (**shipped v13.9**). |
| Sec | Secret rotation on every major release. Reporting API sampling audit annually. |
| Sec | CSP `require-trusted-types-for 'script'` audit v14.0; verify policy enforcement in production logs. |
| Sec | Post-quantum-ready signature for config URL share — **track only**; current AES-GCM + HMAC adequate. |
| Sec | npm + GitHub Actions provenance (Sigstore) — adopt v14.2. |
| Infra | Cloudflare Pages migration — **gate**: measurable TTI or caching regression on Pages. |
| Infra | Annual vendor-neutrality drill (ADR-031) starts v14.0. |
| DX | `docs/adr/README.md` auto-generated from ADR frontmatter — **shipped**. |
| DX | Cross-project MCP matrix in `.github/copilot/MCP_SERVERS.md` — extend with GitKraken + Azure rows v14.0. |
| DX | Mono-repo tooling harvest — propagate `tooling/` presets to BudgetManager / CrossTideWeb / Wedding v14.1. |
| DX | Codecov-style PR coverage delta bot (own action, no SaaS) — **shipped v13.9**. |
| DX | PR SBOM-diff bot (own action, no SaaS) — **shipped v13.9**. |

### 1.9 Documentation discipline

| Type | Current | Verdict / Action |
|---|---|---|
| ADRs | 39 (38 active, 1 withdrawn) | One per non-trivial decision. ADR-021 withdrawn v13.8.2; ADR-037 reserved. |
| User docs (`docs/`) | 13 + 24 | Keep. `docs/README.md` is the table of contents. |
| Legacy docs | `docs/legacy/BestDashBoard.html` | Keep archived; never edit. |
| `CHANGELOG.md` | per-release | Single source of historical truth. Old sprint logs collapsed to one line per sprint. |
| `ROADMAP.md` | this file | Forward-looking only. Shipped releases live in CHANGELOG. |
| `.github/` | instructions, prompts, agents, skills, copilot config | Keep; deduplicate against `copilot-instructions.md` (single source of truth). |
| Architecture diagrams | `.github/assets/*.svg` + Mermaid in `docs/ARCHITECTURE.md` | Auto-validated against Markdown via `check-mermaid.mjs` (ADR-040, **shipped v13.10**). |
| Inline comments | sparse, intent-only | Keep. No JSDoc for trivial functions. |
| Reading-level gate | `check-reading-level.mjs` shipped | Keep. |
| Wiki / GitHub Discussions | none | **Reject** — `docs/` + ADRs cover it; one canonical source. |

### 1.10 Decisions held rejected (consolidated 2026-Q2)

Client framework rewrite · Shadow DOM · user-facing DB · OIDC/passkey auth · 40+ language i18n · pre-commit hooks · WebGPU/WASM hot paths · OPFS structured cache · AGPL · multi-tenant Workers for Platforms · 3rd language (deferred to contributor offer) · pnpm workspace · Husky · Lerna/Nx · hand-rolled bundler · custom auth · Sentry SaaS · Codecov SaaS · Argos CI SaaS · Docker image release · Hyperdrive/Postgres · WebTransport server-side (until CF native) · Open UI `<selectlist>` (until GA) · Bun test runner (until Vitest stalls) · `<dialog>` replacement.

---

## 2. Competitive Landscape — 2026-Q2

### 2.1 Comparison matrix — 16 peer projects across 4 categories

Categories: **TV/Family dashboards** · **Homelab dashboards** · **News/feed readers** · **Smart-home / monitoring**. Rows are facts at the date listed; new peers in this revision marked ✱.

| Dimension | **FamilyDashBoard v13.11.0** | Homepage | Dashy | Homer | Homarr v2 | Glance | MagicMirror² | Beszel | Dashdot | NetNewsWire | Feedly | Apple Home Hub | Grafana ✱ | Home Assistant Lovelace ✱ | Tidbyt ✱ | TRMNL ✱ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Audience | Always-on family TV | Homelab launcher | Homelab dashboard | Static startpage | Homelab mgmt | News dashboard | Smart-mirror | Server monitor | Server monitor | News reader | News reader (paid) | Apple smart-home | SRE/observability | Smart-home | Pixel info display | E-ink dashboard |
| Stars (Apr 2026 est.) | ~95 | 47 K | 30 K | 12 K | 18 K | 27 K | 19 K | 9 K | 6 K | 7 K | n/a | n/a | 70 K | 71 K | n/a (HW) | n/a (HW) |
| Frontend | **Vanilla TS strict + Vite 8** | Next.js 15 | Vue 3.5 | Vue 3 | Next.js 15 + Mantine 7 | Go templates | Node + MM modules | SvelteKit | React + Vite | Swift | React (closed) | SwiftUI | React | Lit + Polymer | Go (HW) | Vue (HW) |
| Client deps | **0 / ~88 KB gzip** | ~38 | ~22 | ~12 | ~55 | 0 (SSR) | ~15 | ~4 | ~25 | n/a | unknown | n/a | ~120 | ~65 | n/a | n/a |
| State | **In-house Signals (ADR-038) → TC39 Signals** | React state | Pinia | Vuex | Zustand | n/a | Module bus | Svelte runes | React state | KVO | unknown | SwiftUI | Redux | Lit reactive | n/a | n/a |
| Backend | **Cloudflare Worker (Hono + Valibot)** | Node proxy | Node/Express | None | Node + tRPC + Drizzle | Single Go binary | Node Express | Single Go binary | Single Go binary | n/a | Cloud (closed) | iCloud | Go monolith | Python (HASS core) | Cloud + device | Cloud |
| User database | **None** | None | None | None | SQLite + Drizzle | None | None | SQLite | None | SQLite | Cloud | iCloud | many backends | SQLite | Cloud KV | Cloud KV |
| Edge DB / cache | **KV stale + D1 + DO + Analytics Engine** | n/a | n/a | n/a | Postgres / SQLite | n/a | n/a | SQLite | n/a | n/a | proprietary | iCloud | Prometheus / Mimir | InfluxDB / SQLite | Tidbyt cloud | TRMNL cloud |
| TS strictness | **strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`** | strict | partial | JS-dominant | strict | n/a | partial | strict | partial | n/a | unknown | n/a | partial | partial | n/a | n/a |
| Linter | ESLint 10 (+ oxlint v14) | ESLint default | ESLint default | None | ESLint default | golangci-lint | ESLint default | golangci-lint | ESLint default | SwiftLint | unknown | SwiftLint | golangci-lint | flake8 / mypy | n/a | n/a |
| CSS architecture | **Vanilla `@layer` + tokens + Lightning CSS + `@scope` + `light-dark()` + `@property`** | Tailwind 4 | SCSS | SCSS | Mantine CSS-in-JS | Hand CSS | CSS Modules | Tailwind 4 | Tailwind 3 | AppKit | Tailwind | SwiftUI | SCSS + Emotion | hand CSS | n/a | hand CSS |
| Tests | **4835 unit + Playwright + axe + 54 VR + LHCI + fast-check + Stryker** | Vitest partial | Vitest partial | None | Vitest + PW + Argos | Go tests | Minimal | Go tests | Partial | XCTest | unknown | XCTest | Go tests | pytest | n/a | n/a |
| Mutation testing | **Stryker** | None | None | None | None | None | None | None | None | None | unknown | None | None | None | None | None |
| Visual regression | **Playwright (54 baselines, in-repo)** | None | None | None | Argos CI | None | None | None | None | Snapshot | unknown | None | Pixelmatch (partial) | None | None | None |
| i18n | **Hebrew RTL + English** | 45+ | 22+ | YAML | 38+ | en-only | 30+ | en-only | en-only | 40+ | 25+ | 40+ | 30+ | 80+ | en-only | en-only |
| Accessibility | **WCAG 2.2 AA + selected AAA + axe gate** | Partial | Partial | Unknown | Partial | Unknown | Partial | Unknown | Unknown | VoiceOver | Unknown | Apple stack | Partial | Partial | n/a | n/a |
| Offline / PWA | **Full SW · 4-tier cache · precache · BG sync** | No | Basic PWA | Installable | No | No | No | No | No | Native | Web stale-only | Native | No | Partial | n/a | E-ink only |
| Auth | **None (intentional)** | Host/proxy | Keycloak / basic | None | OIDC + passkey | None | None | Email + 2FA | None | Apple ID | Email | Apple ID | Many providers | Account / OIDC | Cloud account | Cloud account |
| Config | **UI panel + JSON export + AES-GCM URL share** | YAML + Docker labels | YAML + UI | YAML | UI drag-drop (DB) | YAML | Config.js | UI (DB) | Config.js | UI | Cloud | iCloud | UI + JSON | YAML + UI | App store | Web UI |
| Edge proxy / CORS | **Worker + KV stale + Valibot + D1 + Analytics Engine + DO rate-limit** | Server proxy | Proxy chain | n/a | tRPC over Next | n/a | None | n/a | n/a | None | proprietary | iCloud | Plugin model | Add-on model | n/a | n/a |
| Observability | **Web Analytics + Web Vitals + Error KV + D1 + Reporting API + Prometheus `/api/metrics` + Analytics Engine + diag JSON** | None | None | None | Sentry (opt) | Prom endpoint | None | Built-in | Prometheus | Apple | proprietary | Apple | Prom + OTel | Prom + OTel + Loki | n/a | Cloud only |
| Security headers | **CSP L3 + Trusted Types + COOP/COEP(credentialless)/CORP + Permissions-Policy (28 APIs) + HSTS** | NGINX templates | Varies | None | Next defaults | Go handlers | None | Svelte defaults | Partial | Apple sandbox | proprietary | Apple sandbox | Helm defaults | HASS defaults | n/a | n/a |
| Supply-chain | **SLSA L2 + SBOM (CycloneDX) + Dependabot + Renovate (Actions SHA) + dependency-review + Stryker + SBOM-diff bot** (→ SLSA L3 v14.2) | High (Next churn) | Medium | Low | Very high | ~0 | Medium | Low | Medium | Apple-signed | proprietary | Apple-signed | Medium | High (HASS core) | Cloud-signed | Cloud-signed |
| Reproducibility | **`dist.zip` + `worker.js`, SLSA-pinned, SBOM/release** | Docker image | Docker image | Static site | Docker compose | Single binary | Node bundle | Single binary | Single binary | Apple-signed | n/a | n/a | Docker / Helm | Docker / venv | Cloud | Cloud |
| CI gates | **tsc + eslint + markdownlint + stylelint + vitest + LHCI + axe + VR + bundle + SW + SLSA + commitlint + mutation + container-query audit + mermaid + reading-level** | Docker + tests | Docker build | Build | Build + tests | Go build + test | Node build | Go build + test | Go build + test | Xcode tests | proprietary | Xcode tests | Many | Many | n/a | n/a |
| Cold-start TTI | **< 1.0 s cached / ~1.6 s fresh** | ~2.5 s | ~3 s | ~1 s | ~3.5 s | ~300 ms | ~2 s | ~500 ms | ~800 ms | n/a | ~2 s | n/a | ~3 s | ~2 s | n/a | ~1 s |
| Live-data cards | **12 deep, provider-adapted, history-backed** | 100+ (shallow) | 50+ | limited | 30+ | 12 feed types | 100+ (shallow) | Server metrics | Server metrics | RSS only | RSS + ML | Smart-home only | unlimited | unlimited | curated apps | curated apps |
| License | MIT | GPL-3.0 | MIT | Apache-2.0 | MIT | AGPL-3.0 | MIT | MIT | MIT | MIT | proprietary | proprietary | AGPL-3.0 | Apache-2.0 | proprietary | proprietary |
| Unique strength | Hebrew/Zmanim/Hebcal/Sefaria · TV-3 m · 4-tier offline · zero deps · highest gate density | Ecosystem size | Themeable | Simplicity | Feature breadth | Go footprint | Mirror form-factor | Go deploy | Go deploy | macOS polish | ML clustering | Apple integration | Best-in-class panels & alerting | Vast device ecosystem | Pixel charm | E-ink + low power |

### 2.2 Patterns harvested (or rejected) — 2026-Q2 expansion

The matrix' operational output. New rows for v14 marked ✱.

| Pattern | Source | Verdict | Landing |
|---|---|---|---|
| **Cloudflare Vectorize (semantic dedup)** | Feedly ML | **Adopt v14.0** ✱ | Replaces SimHash v2 in news after 30-day shadow run; precision@10 gate. |
| **Workers AI Llama 4 / multilingual** | CF 2026 GA | **Track v14.x** | Replace Llama 3.3 only when Hebrew quality measurably better at equal cost. |
| **DO Hibernatable WebSocket** | CF 2025 GA | **Adopt v14.x** ✱ | Stocks live + alerts SSE — DO bill drops ~80 % when idle. |
| **Cloudflare R2 for asset cache** | CF 2024 GA | **Adopt v14.x** ✱ | Backgrounds + offline shell mirrored; egress = $0. |
| **DO Storage SQL (SQLite-in-DO)** | CF 2025 GA | **Track** | Possible D1 replacement; gate same query latency at lower CPU bill. |
| **Lit Signals (≈ 1 KB) → in-house** | Lit team 2025 | **Superseded by ADR-038** ✱ | Zero-dep `signals.ts` mirrors API exactly; one-line swap to TC39 when Stage 4. |
| **TC39 Signals** | TC39 Stage 3 | **Adopt when polyfill ≤ 1.5 KB** | Drop-in for in-house signals. |
| **TC39 Temporal** | TC39 Stage 3 | **Adopt when polyfill ≤ 10 KB gzip** | Replaces date math in `hebrew-cal`, `calendar`, `countdown`. |
| **CSS `@starting-style`** | Browser 2025 | **Shipped v13.9** ✱ | Replaces JS enter animations on overlays. |
| **CSS Anchor Positioning expansion** | Browser 2025 | **Expand v14.0** | Already in Stocks Popover; expand to Diag-Overlay + Help dialog. |
| **HTTP Early Hints (103) via Worker** | RFC 8297 | **Adopt v14.x** ✱ | Push critical CSS + main JS earlier; expected −80 ms TTI. |
| **Subresource Integrity (auto-injected)** | W3C SRI | **Shipped v13.9** ✱ | Vite plugin emits `<script integrity="…">` per build. |
| **Speculation Rules expansion** | Browser 2024 | **Audit v13.x** | Verify all SPA-style transitions list `prerender`. |
| **Native File System Access** | Browser 2024 | **Shipped v13.10** ✱ | Replaces clipboard for config import/export when supported. |
| **CRDT (Yjs ≈ 12 KB)** | Yjs 2024 | **Track** | Only if WebRTC delta proves insufficient. Hard budget ≤ 12 KB gzip. |
| **Document Picture-in-Picture (video-news)** | Browser 2024 | **Gate: 3+ user requests** | Corner PiP while other cards refresh. |
| **OpenTelemetry from Worker (opt-in)** | OTel 1.30+ | **Adopt v14.2** ✱ | Self-host collector on R2 + Workers ingestor; off by default. |
| **PR coverage-delta bot (own action)** | OSS bots | **Shipped v13.9** ✱ | Zero SaaS dependency. |
| **PR SBOM-diff bot (own action)** | OSS bots | **Shipped v13.9** ✱ | Zero SaaS dependency. |
| **`oxlint` (Rust ESLint, 50–100×)** | Oxc 2025 | **Adopt v14.0 (ADR-039)** ✱ | Run before ESLint in CI; ESLint stays for rules `oxlint` lacks. |
| **Biome (formatter + minimal lint)** | Biome 2.x | **Track** | Re-evaluate v15 when feature parity with Prettier+ESLint reached. |
| **Rolldown (Vite Rust bundler)** | Vite 2026 default | **Auto-adopt** | Zero code change required. |
| **Bun 1.2 test runner** | Bun 2026 | **Track only** | Vitest 4.1 ecosystem leads. |
| **Mermaid pre-commit validator** | Internal | **Shipped v13.10 (ADR-040)** ✱ | All architecture diagrams validated in CI. |
| **Container-query audit script** | Internal | **Shipped v13.10** ✱ | `check-container-queries.mjs` blocks viewport `@media` in card CSS. |
| **Argos CI visual regression** | Homarr v2 | **Superseded** | Playwright in-repo baselines; zero SaaS dependency. |
| **Drizzle / tRPC / Mantine / Next / React** | Homarr v2 | **Reject (4th reconfirm)** | Contradicts zero-dep, no-DB, no-framework lines. |
| **OIDC / passkey auth** | Homarr v2 / Beszel | **Reject** | Single-household device; largest new attack surface for zero benefit. |
| **AGPL copyleft** | Glance / Grafana | **Reject** | MIT aligns with family-project distribution. |
| **Native Bluetooth / sensor APIs** | MagicMirror² | **Reject** | Permissions-Policy denies them. |
| **WebGPU on stocks** | Browser 2025 | **Reject** | SVG charts ≤ 30 KB; no perf problem. |
| **Multi-tenant Workers for Platforms** | CF 2024 | **Reject** | Single household. |
| **`pnpm` workspace** | pnpm 2024 | **Reject** | npm + parent-workspace pattern is sufficient and simpler. |
| **Grafana panel grammar (data-source plugin)** ✱ | Grafana | **Reject** | Plugin loader ≥ 30 KB; our 12 cards are statically authored. |
| **Home Assistant Lovelace card YAML model** ✱ | HASS | **Reject** | YAML editor adds parsing surface for zero gain on a 12-card SPA. |
| **Lovelace `custom_component` ecosystem** ✱ | HASS | **Reject** | We are not a platform. |
| **Tidbyt pixel-art aesthetic** ✱ | Tidbyt | **Reject** | TV-3 m readability is the opposite design pressure. |
| **TRMNL e-ink cadence (15-min refresh)** ✱ | TRMNL | **Inspire** | Already aligned with our card TTLs; documented in `docs/data-sources.md`. |
| **Smashing/Dashing widget bus pattern** | Smashing | **Reject** | Server-push bus would break our offline-first model. |

### 2.3 Our protected unique strengths

1. **Zero runtime deps on the client** — peers ship 30–55; we ship 0.
2. **TV-first at 3 m viewing distance** — no peer targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 provider-adapted cards with normalized history + stale fallback** — depth over breadth.
5. **4-tier offline cache** — no peer renders a useful dashboard offline.
6. **4835 tests + axe + VR + LHCI + Stryker + SLSA + container-query audit + mermaid validator** — highest gate density in the matrix.
7. **Production observability without tracking cookies** — RUM + Vitals + Errors + Reports + Analytics Engine + Prometheus.
8. **Reproducible single-artifact release** — `dist.zip` + `worker.js`, SLSA-pinned, SBOM per release, SBOM-diff bot per PR.

---

## 3. Improvement Backlog — Rewrite / Refactor / Enhance

Concrete work items extracted from §1 and §2, prioritised. **P** = priority (P0 next-release blocker, P1 same-cycle, P2 opportunistic). **E** = effort (S ≤ 1 day, M 2–5 days, L > 5 days). **I** = impact (Hi/Mid/Lo).

| # | Type | Item | P | E | I | Target | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Refactor | Migrate `state.ts` call sites to in-house `signals.ts` (ADR-038) — card-at-a-time | P0 | L | Hi | v14.0 | One-line swap to TC39 Signals later. |
| 2 | Enhance | Add `oxlint` fast pre-pass to CI before ESLint (ADR-039) | P0 | S | Hi | v14.0 | 50–100× lint speedup. |
| 3 | Refactor | Replace ad-hoc date math with Temporal in `hebrew-cal`/`calendar`/`countdown` once polyfill ≤ 10 KB | P1 | M | Mid | v14.x | Gate by polyfill size. |
| 4 | Enhance | `@vitest/browser` for `maximize.ts` + `layout-drag.ts` (DOM-heavy) | P1 | M | Mid | v14.0 | happy-dom doesn't model FLIP correctly. |
| 5 | Rewrite | Replace SimHash v2 news dedup with Cloudflare Vectorize embeddings | P0 | L | Hi | v14.0 | 30-day shadow + precision@10 gate. |
| 6 | Enhance | DO Hibernatable WebSocket for stocks live + alerts SSE | P1 | M | Hi | v14.x | ~80 % DO bill drop when idle. |
| 7 | Enhance | R2 mirror for backgrounds + offline shell | P2 | M | Mid | v14.x | egress = $0. |
| 8 | Enhance | HTTP Early Hints (103) from Worker | P1 | S | Mid | v14.x | Expected −80 ms TTI. |
| 9 | Enhance | Coverage ratchet 89/81/89/90 → 92/85/92/93 (S117 first) | P0 | M | Mid | v14.0 | S117 adds branch tests to clear 81.84 → 82. |
| 10 | Enhance | Stryker scope: error-tracker + config + diag, threshold ≥ 85 % | P1 | M | Mid | v14.0 | |
| 11 | Enhance | Cross-doc View Transitions for theme switch + maximise-card | P1 | S | Lo | v14.0 | Native browser support live Q1 2026. |
| 12 | Enhance | Anchor Positioning for Diag-Overlay + Help dialog | P2 | S | Lo | v14.0 | |
| 13 | Refactor | Annual vendor-neutrality build drill (Deno Deploy + Bun Deploy + fly.io) | P1 | L | Hi | v14.0 | First run unlocks ADR-031. |
| 14 | Enhance | OpenTelemetry from Worker (opt-in, self-host collector) | P2 | L | Mid | v14.2 | |
| 15 | Enhance | SLSA L3 hermetic build + Sigstore/cosign provenance | P0 | L | Hi | v14.2 | ADR-035. Third-party rebuilder must produce byte-identical artefact. |
| 16 | Refactor | Promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding | P1 | M | Hi | v14.1 | Cross-project release gate. |
| 17 | Enhance | `markdown-link-check` monthly cron-only | P2 | S | Lo | v14.0 | Never blocks PR. |
| 18 | Enhance | `userAgentData` high-entropy hints in `system-info` card | P2 | S | Lo | v14.x | |
| 19 | Refactor | Add Open-Meteo as 3rd weather fallback; ECB direct as 3rd currency fallback | P2 | M | Lo | v14.x | Provider redundancy. |
| 20 | Enhance | Calendar fuzz-case set 204 → 250+ | P2 | S | Lo | v14.0 | RFC-5545 edge cases. |
| 21 | Enhance | Visual-regression baselines 54 → 80+ (DO-SSE + video-news + maximise-FLIP) | P1 | M | Mid | v14.0 | |
| 22 | Enhance | LHCI perf threshold 0.97 → 0.98 (after Early Hints + SRI in concert) | P1 | S | Mid | v14.x | |
| 23 | Refactor | `exactOptionalPropertyTypes` migration audit (defer if breakage > S effort) | P2 | M | Lo | v14.x | |
| 24 | Enhance | WebRTC mirror with QR pairing (gated: 3+ user requests) | P2 | L | Mid | v14.x | ADR-036. |
| 25 | Enhance | Document Picture-in-Picture for video-news (gated: 3+ user requests) | P2 | S | Lo | v14.x | |

**Anti-backlog** (deliberately not on the list, to stop perennial re-litigation): React rewrite · Shadow DOM · auth · user DB · Sentry · Codecov SaaS · Argos CI SaaS · pnpm · Husky · Bun runtime · Docker artefact · 3rd language until contributor offer · WebGPU/WASM hot paths.

---

## 4. Strategic Streams (v14 → v15)

Each stream lists deliverables · ADR candidates · exit criteria · gate triggers. Completed work dropped — see [CHANGELOG.md](../CHANGELOG.md).

### 4.1 V14-FOUNDATIONS — Tooling acceleration & supply-chain tightening

Target: **v14.0** (Q1 2027).

- [x] Subresource Integrity auto-injected (v13.9).
- [x] `@ts-check` on `scripts/*.mjs` (v13.9).
- [x] CSS `@starting-style` for `<dialog>` overlays (v13.9).
- [x] PR coverage-delta bot (v13.9).
- [x] PR SBOM-diff bot (v13.9).
- [x] Mermaid pre-commit validator (v13.10).
- [x] Container-query audit script (v13.10).
- [ ] `oxlint` as fast pre-pass (~50–100× ESLint).
- [ ] `@vitest/browser` component tests for `maximize.ts` + `layout-drag.ts`.
- [ ] CSS Anchor Positioning expansion (Diag-Overlay + Help dialog).
- [ ] Cross-doc View Transitions for theme switch + maximise-card.
- [ ] Stryker scope extension: error-tracker + config + diag, threshold ≥ 85 %.
- [ ] Coverage ratchet: 89/81/89/90 → 92/85/92/93.
- [ ] `markdown-link-check` monthly cron.

**Exit**: oxlint green on first pass; CI deltas live; coverage at 92/85/92/93; LHCI perf still ≥ 0.97.

### 4.2 V14-SEMANTIC — Replace heuristics with embeddings & Signals

Target: **v14.0** (Q1–Q2 2027).

- [x] In-house `signals.ts` shipped (ADR-038).
- [ ] Cloudflare Vectorize semantic news dedup (30-day shadow → SimHash retire after precision@10 gate).
- [ ] `state.ts` → `signals.ts` migration ≥ 50 % of call sites.
- [ ] TC39 Signals one-line swap when polyfill ≤ 1.5 KB and Stage 4.
- [ ] TC39 Temporal in `hebrew-cal`/`calendar`/`countdown` when polyfill ≤ 10 KB gzip.
- [ ] HTTP Early Hints (103) from Worker — push critical CSS + main JS earlier.

**Exit**: Vectorize precision@10 ≥ SimHash + 15 %; signals migration ≥ 50 % of `state.ts` call sites; LHCI perf ≥ 0.98 cached.

### 4.3 V14-CONTINUITY — Cross-device without auth (gated)

Target: **v14.x** (gated by 3+ user requests).

- [x] AES-GCM encrypted config URL export.
- [x] Import flow + `docs/sync.md`.
- [ ] WebRTC mirror — short-lived (5 min) QR-pairing data channel, STUN-only, no TURN, no relay. Valibot on incoming delta. ADR-036.
- [ ] CRDT (Yjs) — *track only*. Adopt only if WebRTC delta insufficient AND Yjs core ≤ 12 KB gzip.

**Exit**: zero DB, zero account, zero worker storage. Purely client-side crypto on a user-owned medium (clipboard / URL / QR).

### 4.4 V14-EDGE — Workers platform expansion

Target: **v14.x** (Q2–Q3 2027).

- [ ] DO Hibernatable WebSocket — stocks live-stream + alerts SSE.
- [ ] R2 for asset cache — backgrounds + offline shell.
- [ ] Workers AI Llama 4 — only when measurably better Hebrew quality at equal cost.
- [ ] DO Storage SQL audit — possible D1 replacement; gate same query latency at lower CPU bill.

**Exit**: DO bill drops ≥ 50 % at idle; R2 egress = $0 confirmed.

### 4.5 V14-HARMONISE — Mono-repo reference

Target: **v14.1** (Q2 2027).

- [x] Composite `tooling/ci/check.yml`.
- [x] Cross-project tooling registry.
- [ ] BudgetManager / CrossTideWeb / Wedding on `tooling/eslint/web-ts-app.mjs` + `tooling/tsconfig/base-typescript.json`.
- [ ] Shared `tooling/vitest/happy-dom.mjs` preset across all three.
- [ ] Cross-project release gate (each repo's `release.yml` extends shared composite).

**Exit**: all three sibling repos green under shared presets; one breakage in any repo blocks the others' release.

### 4.6 V14-SECURITY-L3 — SLSA L3 + supply chain

Target: **v14.2** (Q3 2027).

- [x] ADR-035 planning (v13.2).
- [x] SBOM-diff bot (v13.9).
- [x] SRI auto-injection (v13.9).
- [ ] SLSA L3 hermetic build (`slsa-framework/slsa-github-generator`).
- [ ] Sigstore/cosign signed provenance per release.
- [ ] Secret-scanning attestation in SBOM.
- [ ] Annual vendor-neutrality drill (ADR-031) — first run rebuild on Deno Deploy + Bun Deploy + fly.io.
- [ ] OpenTelemetry from Worker (opt-in).

**Exit**: third-party rebuilder produces a byte-identical artefact; sigstore proof links resolve.

### 4.7 V15-PRODUCT — Optional evolution (fully gated)

Target: **v15+** (no pre-committed content).

| Candidate | Gate |
|---|---|
| Document Picture-in-Picture on video-news | User request ≥ 3 |
| User-supplied background URL list + CF Images resize | User request ≥ 5 |
| AI summary card (local Hebrew LLM, WASM quantised) | Open-weight Hebrew model ≤ 20 MB at useful speed |
| 3rd language (Arabic, German) | Contributor offers to maintain it |
| Bun 1.2 test runner | Vitest ecosystem parity lost |
| Biome instead of Prettier+ESLint | Biome reaches feature parity with our stack |
| Cloudflare Pages migration | Measurable TTI or caching regression on Pages |
| WCAG 3.0 audit | WCAG 3.0 reaches Candidate Recommendation |
| WebTransport server-side | Cloudflare native support |

---

## 5. Forward Release Plan

Past releases live in [CHANGELOG.md](../CHANGELOG.md). Forward-only.

| Version | Theme | Window | Scope link |
|---|---|---|---|
| **v13.11.0** | Sprint 116 — platform hardening | 2026-Q2 | Shipped ✓ |
| **v13.12.0** | Sprint 117 — production-ready cleanup (inline-styles, dead files, strict link-check) | 2026-Q2 | Shipped ✓ |
| **v13.13** | Sprint 118 — coverage ratchet (S116 deferred), oxlint introduction prep | 2026-Q3 | §4.1 |
| **v14.0** | V14-FOUNDATIONS + V14-SEMANTIC | 2027-Q1 | §4.1, §4.2 |
| **v14.1** | V14-HARMONISE | 2027-Q2 | §4.5 |
| **v14.2** | V14-SECURITY-L3 + V14-EDGE | 2027-Q3 | §4.6, §4.4 |
| **v14.x** | V14-CONTINUITY (gated) | when triggered | §4.3 |
| **v15.0** | V15-PRODUCT (gated only) | 2027-Q4+ | §4.7 |

---

## 6. Best-in-Class Targets

| Axis | v13.12.0 (now) | v14 target | v15 target |
|---|---|---|---|
| Client deps | 0 | 0 | 0 |
| Worker deps | 2 (Hono + Valibot) | 2 | 2 |
| TS strict | strict + unchecked-idx + verbatim | + scripts under `@ts-check` | + `exactOptionalPropertyTypes` (audited) |
| Linter | ESLint 10 | + oxlint fast pre-pass | re-evaluate Biome |
| State | In-house `signals.ts` (ADR-038) ≈ 0 % migrated | ≥ 50 % migrated | TC39 Signals (full) |
| Date math | ad-hoc + `Intl` | TC39 Temporal (in budget) | TC39 Temporal (full) |
| News dedup | SimHash v2 | Vectorize embeddings | Vectorize + multi-stage |
| Stocks transport | HTTP polling | DO Hibernatable WebSocket | same |
| Coverage | 89 / 81 / 89 / 90 | 92 / 85 / 92 / 93 | 95 / 90 / 95 / 96 |
| Tests | 4835 | 5000+ | 5500+ |
| Suites | 157 | 170+ | 180+ |
| LHCI perf | ≥ 0.97 | ≥ 0.98 | ≥ 0.98 |
| TTI cached | < 1.0 s | < 850 ms | < 750 ms |
| Worker gzip | ~62 KB (budget 75 KB) | ≤ 75 KB | ≤ 75 KB |
| WCAG | 2.2 AA + selected AAA | 2.2 AAA closure + cognitive | re-audit under WCAG 3.0 draft |
| Security | CSP L3 · Trusted Types · SLSA L2 · SBOM · SRI auto · SBOM-diff bot | + SLSA L3 · sigstore/cosign | + third-party rebuild verified |
| Observability | RUM + Vitals + Errors + p95 + Analytics Engine | + opt-in OpenTelemetry | + SLO dashboard |
| Vendor lock-in | CF-first; exits documented | Annual rebuild drill green | Continuous rebuild drill green |
| Visual-regression baselines | 54 | 80+ | 100+ |
| ADRs | 39 | 42+ | 45+ |

---

## 7. Open Questions (next quarter)

1. Does the in-house `signals.ts` push-pull semantics match the TC39 Stage-3 spec under the latest Stage-3 errata? — re-verify against TC39 spec text quarterly.
2. Will Cloudflare publish R2 + DO co-located region pinning in 2026? — gates V14-EDGE rollout order.
3. Does `oxlint` reach rule parity with our type-aware ESLint set in 2026-Q3? — affects when ESLint becomes informational vs. blocking.
4. Will browsers ship `customElements` upgrade for cross-doc View Transitions reliably? — affects §4.1 cross-doc adoption.
5. Will TC39 Signals reach Stage 4 in 2027-Q1? — gates §4.2 swap.
6. Does Cloudflare Vectorize multilingual (Hebrew) precision@10 beat SimHash by ≥ 15 %? — gates §4.2 dedup swap.

Each question has a named owner in `.github/ISSUE_TEMPLATE/decision-question.md` and a dated re-evaluation gate.

---

> **Next session**: Sprint 117 — clear `81.84 → 82` branch coverage; introduce `oxlint` fast pre-pass; first vendor-neutrality drill (Deno Deploy rebuild). All three are P0 / E ≤ M.
