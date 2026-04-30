# FamilyDashBoard — Strategic Roadmap (v14 Deep-Rethink Edition)

> **Refresh date**: 2026-04-30 · **Shipped baseline**: v13.27.0 (Sprint 252) · **Active streams**: V14-FOUNDATIONS, V14-SEMANTIC, V14-RESILIENCE, V14-CARDS-DEEP, V14-CROSS-CARD.
>
> **Inventory**: 5581 tests / 170 suites / 0 failures · 0 lint errors · 0 lint warnings · 0 `eslint-disable` · 0 `@ts-ignore` · 49 ADRs · 0 client deps · 2 worker deps (Hono + Valibot) · 6 themes · 12 cards · 4-tier offline cache · Worker ≤ 75 KB gzip.
>
> **Purpose**: a top-to-bottom **first-principles re-litigation of every decision** — including those that look clean. No grandfathering. The bar is **best-in-class for an always-on family TV dashboard**, harvested by direct comparison against the best peer in each category. Forward-looking only; historical sprints live in [CHANGELOG.md](../CHANGELOG.md).

---

## 0. Executive Summary

After 169 sprints across v10 → v13.18 the project sits on a stable, opinionated, production-hardened plateau:

- **Frontend**: vanilla TS strict + in-house Signals (ADR-038), 0 client deps, ~88 KB gzip, CSS `@layer`/tokens/`@scope`/`light-dark()`/`@property`/Anchor Positioning/View Transitions L1.
- **Backend**: single Cloudflare Worker (Hono + Valibot), KV stale cache, D1 telemetry, DO rate-limit, Analytics Engine, ≤ 75 KB gzip.
- **Storage**: 4-tier client cache (Map → localStorage → IndexedDB ≤ 50 MB LRU → SW cache 7 origins). Zero user DB. Zero auth.
- **Quality**: 5581 unit tests + Playwright + axe + 45 VR baselines + LHCI + Stryker mutation + fast-check (SP1-SP6/CM1-CM5/AP1-AP5/HC1-HC6) + SLSA L2 + Sigstore/cosign + rebuilder manifest + SBOM-diff + container-query audit + Mermaid validator + reading-level gate.

This document **reopens every one of those decisions** at three levels:

1. **Stack-level rethink** (§1, §2): code language, frontend framework, backend platform, edge DB, tooling, testing, observability, security, docs. Each axis carries a peer-by-peer comparison.
2. **Per-card rethink** (§3): all 12 cards individually compared against best-in-class external apps in their category (NetNewsWire, Apple Weather, TradingView, Fantastical, Hebcal, Pikud Ha-Oref, Todoist, iStat Menus, …) with capability gap analysis and concrete enhancement items.
3. **Cross-card rethink** (§4): synergies, shared services, unified bus, semantic linking — features that only emerge once the 12 cards are treated as a system.

Every line below is a **decision, gate, or trigger**. No aspirational decoration.

The strategic frontier for v14 → v15 is not breadth or feature catch-up. It is:

1. **Eliminate every remaining vendor and tool lock-in** — annual neutrality drill (Cloudflare ↔ Deno Deploy ↔ Bun Deploy ↔ fly.io); auto-adopt Rolldown when Vite ships it default; track Biome/oxlint replacement.
2. **Replace heuristics with semantics** — SimHash → Vectorize embeddings (news); ad-hoc date math → TC39 Temporal; in-house signals → TC39 Signals when Stage 4.
3. **Push observability + supply chain to industry leadership** — SLSA L3 hermetic builds, Sigstore/cosign provenance, third-party rebuilder verification, opt-in OpenTelemetry, automated SBOM diff.
4. **Cross-device continuity without auth or DB** — WebRTC mirror with QR pairing (gated); CRDT (Yjs ≤ 12 KB) only if WebRTC delta proves insufficient.
5. **Card-level depth over breadth** — each card matches or exceeds its best-in-class single-purpose competitor (see §3).
6. **Cross-card synergy** — the 12 cards behave as one informed system (shared today-pane, unified notification bus, semantic links, single keyboard model). See §4.
7. **Mono-repo harvest** — promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding so all four repos share one quality gate.
8. **Resilience behind hostile networks** — corporate-proxy / firewall-aware dev mode; provider chains never block the UI; SW never serves stale offline-fallback HTML when the user opted out.

---

## 1. Stack-Level First-Principles Re-Litigation

Stamps: **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, **Supersede**.

### 1.1 Code language & TypeScript posture

| Decision | Challenge | Verdict | Action |
| --- | --- | --- | --- |
| TypeScript | Could Rust+wasm-bindgen win on a 75 KB worker? | **Keep** (load-bearing) | Annual posture review only. Rust → WASM rejected: developer pool, debug story, bundle floor (~50 KB runtime). |
| `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` + `exactOptionalPropertyTypes` | Stricter posture available? | **Keep** (highest grade) | All four flags on since v13.16. |
| TypeScript 6.0.3 | Stay current? | **Keep** | Track 6.1+ on parent `MyScripts/`. |
| TypeScript 7 (Go-rewrite, `tsc-go`) | Adopt early? | **Track v15** | Switch only when stable + zero behavioural delta on our codebase. |
| `// @ts-check` on `.mjs` scripts | Bring helpers into the type gate? | **Shipped v13.9** | All `scripts/*.mjs` opt-in via `tsconfig.scripts.json`. |
| Vanilla JS escape hatches | Allowed anywhere? | **Reject** | TS strict everywhere; no `.js` source. |
| ECMAScript decorators (Stage 3) | Adopt for `FdbCard`? | **Reject** | Adds parse cost + transpile risk for zero functional gain. |
| `tsgo` second typecheck | Re-add as informational? | **Withdrawn (ADR-021)** | Re-evaluate only when `tsgo` can replace `tsc` outright as a blocking gate. |

### 1.2 Frontend architecture & UI

| Decision | Challenge | Verdict | Action |
| --- | --- | --- | --- |
| Vanilla DOM + `FdbCard` (no framework) | React 19 / Solid / Svelte 5 / Qwik won the productivity war? | **Keep (5th reconfirm)** | No peer benefit we lack. Bundle floor of any framework ≥ 30 KB gzip vs. our ~12 KB main thread runtime. |
| Shadow DOM / Web Components | Better encapsulation than `@scope`? | **Reject (ADR-001)** | `@scope` gives encapsulation without breaking global `@layer` theming. |
| Zero client deps (ADR-002) | Ever? | **Keep (load-bearing)** | Polyfills count against the ceiling. |
| State (`state.ts` imperative) | Replace? | **In progress** | ADR-038 ships zero-dep `signals.ts`. Card-at-a-time migration v14.0; one-line swap to TC39 when Stage 4. |
| Date math (ad-hoc + `Intl`) | TC39 Temporal? | **Replace v14.x** | When polyfill ≤ 10 KB gzip — gate `hebrew-cal`, `calendar`, `countdown`. |
| View Transitions L1 (same-doc) | Already used? | **Keep** | Theme + config-panel + maximise-FLIP shipped. |
| View Transitions L2 (cross-doc) | Adopt? | **Adopt v14.0** | Browser-shipped Q1-2026; expand to maximise-card flow. |
| CSS `@layer` + tokens + `light-dark()` + `@property` | Sufficient? | **Keep** | Tailwind 4 / CSS-in-JS rejected — would break the 6-theme token system. |
| CSS `@starting-style` | Replace JS enter animations? | **Shipped v13.9** | All `<dialog>` overlays use native enter/exit. |
| CSS Anchor Positioning | Beyond Stocks Popover? | **Shipped v13.15** | Diag-Overlay + Help dialog. |
| Container-Queries-only layout | Audited? | **Shipped v13.10** | CI guard blocks viewport `@media` in card CSS. |
| Lightning CSS | Faster than esbuild CSS? | **Keep (ADR-017)** | Re-evaluate v15 if esbuild-css gains nesting + custom-property fallback at parity. |
| Per-card bundle delta CI alert | Shipped? | **Shipped** | > 10 % growth fails CI. |
| Subresource Integrity auto-injection | Source patched? | **Shipped v13.9** | `injectSri` Vite plugin. |
| HTTP Early Hints (103) from Worker | Adopt? | **Shipped v13.14** | ~80 ms TTI improvement. |
| Document Picture-in-Picture (video-news) | Adopt? | **Gate: 3+ user requests** | ADR-045. |
| Streams API for news ingestion | Replace JSON-batch with NDJSON? | **Defer v15** | Quantify perceived-TTI win first; current p95 already < 1.0 s cached. |
| `<selectlist>` + `<details>` `name=` (Open UI) | Replace `<dialog>`? | **Reject** | `<dialog>` is GA across all browsers; Open UI remains experimental. |
| Card layout: rectangular tile/grid (rule #25) | Vertical lists ever? | **Keep** | Audited every release. Sequential feeds (news, stocks) excepted. |

### 1.3 Backend architecture & edge

| Decision | Challenge | Verdict | Action |
| --- | --- | --- | --- |
| Cloudflare Worker (ADR-003) | Better edge? | **Keep** | Annual vendor-neutrality drill (ADR-031) starts v14.0 — rebuild on Deno Deploy + Bun Deploy + fly.io. |
| Hono + Valibot | Lighter? | **Keep** | ~25 KB win over Zod retained; Hono routing < 8 KB. |
| KV stale cache (per route) | Per-route TTL audit? | **Keep** (ADR-013) | Annual TTL review against `worker/openapi.yaml`. |
| D1 telemetry | Cheaper alt? | **Audit v15** | Compare DO Storage SQL + Workers Analytics Engine for same workload. |
| Durable Objects (alerts SSE) | Hibernatable? | **Adopt v14.x** | DO Hibernatable WebSocket — stocks live + alerts SSE; ~80 % bill drop when idle. |
| R2 for asset cache | Adopt? | **Adopt v14.x** | Backgrounds + offline shell mirrored; egress = $0. |
| Workers Queues (error fan-out) | Shipped? | **Shipped v13.0** | |
| Email Workers weekly digest | Shipped? | **Shipped v13.0 (opt-in)** | |
| Workers AI (Llama 3.3 8B) | Llama 4? | **Track v14.x** | Switch only when Hebrew quality measurably better at equal cost. |
| Cloudflare Vectorize (semantic news dedup) | Replace SimHash? | **Adopt v14.0** | 30-day shadow vs SimHash; precision@10 ≥ +15 % gate. |
| Hyperdrive / Postgres | Adopt? | **Reject (reconfirmed)** | No relational store in stack. |
| User-facing DB | Adopt? | **Reject (4th reconfirm)** | LS + IDB + JSON export + AES-GCM URL share cover it. |
| Worker bundle budget ≤ 75 KB gzip | Tighten? | **Keep ceiling** | Tightening to 60 KB rejected — leaves no room for DO Storage SQL adapter. |
| Annual vendor-neutrality build drill | Adopt? | **Adopt v14.0 (ADR-031)** | First run rebuild on Deno Deploy + Bun Deploy + fly.io once per major release. |
| OpenTelemetry from Worker | Adopt? | **Adopt v14.2 (opt-in)** | Self-hosted collector; off by default. |
| WebTransport / HTTP/3 push | Adopt for stocks/alerts? | **Defer** | DO Hibernatable WebSocket has same UX at known cost. |
| File-protocol launch (`dist/index.html`) | Adopt? | **Shipped v13.13** | `--base ./` + `removeCrossOrigin` Vite plugin. |
| Dev-mode CSP relaxation | Adopt? | **Shipped (Sprint 127)** | `vite-plugin-dev-csp-strip` removes meta in `serve` mode only. |

### 1.4 Data plane & external APIs

Cross-cutting rules: every external response is **Valibot-validated**, **KV-stale-cached**, has a **per-route TTL** documented in `worker/openapi.yaml`, **falls back to a stale tier on failure**, has a **page-visibility guard** (`if (!_pageVisible) return;`) at top of every loader, **try/catch + proxy fallback chain** (`PROXIES`) on every fetch, **`diagLog()` on every error**.

| Card | Provider chain | Verdict / Action |
| --- | --- | --- |
| news | RSS aggregator → SimHash v2 → (v14) Vectorize embeddings → Llama 3.3 summary | Vectorize shadow run 30 d before SimHash retire. |
| weather | Met Norway (default) + NWS (US-travel) + Open-Meteo + provider chain | 3-source fallback shipped. UI: 4-col detail grid + equal-width forecast tiles. |
| stocks | Yahoo + Finnhub HTTP today | DO Hibernatable WebSocket live-stream v14.x; gate TTI + battery budget. |
| currency | exchangerate.host + open.er-api + Frankfurter + ECB direct | 4 providers shipped (Sprint 162). |
| calendar | iCal (RFC-5545) + Google Calendar feed | 21-day window shipped; fuzz set 258 (>250). |
| hebrew-cal | Hebcal + Zmanim + Sefaria | Replace internal date math with Temporal when polyfill ≤ 10 KB gzip. |
| alerts | Pikud Ha-Oref + Tzeva-Adom + DO SSE | DO Hibernatable upgrade v14.x. |
| motivation | Local curator + Workers AI Hebrew quote | Non-repeat window shipped; faith-safe curator audit annually. |
| tasks | Local IDB | Optional CRDT sync gate (Yjs ≤ 12 KB). |
| system-info | `navigator.connection` + battery + memory + UA-CH high-entropy | Stable. |
| countdown | Local | Stable. |
| video-news | Embed allowlist only | Document PiP gate: 3+ user requests. |

### 1.5 Storage / database / infrastructure

| Tier | Current | Challenged with | Verdict |
| --- | --- | --- | --- |
| Browser L1 | In-memory `Map` | None viable | **Keep** |
| Browser L2 | `localStorage` (`dash_v2_*`) | OPFS structured cache | **Keep** — OPFS lacks LRU eviction story. |
| Browser L3 | IndexedDB ≤ 50 MB LRU | OPFS / SQLite-WASM | **Keep** — SQLite-WASM ≈ 1.5 MB blows ceiling. |
| Browser L4 | Service Worker cache (7 origins) | None viable | **Keep** |
| Edge cache | Cloudflare KV (per-route) | DO Storage SQL | **Audit v15** |
| Edge analytics | D1 + Analytics Engine | Workers Logs | **Keep, audit v15** |
| Edge object | (none) | R2 | **Adopt v14.x** for backgrounds + offline shell |
| User-owned config | LS + IDB + JSON export + AES-GCM URL | Cloud DB | **Reject (4th reconfirm)** |
| Reproducible artefact | `dist.zip` + `worker.js` (SLSA L2 → L3) | Docker image | **Keep** — Docker adds OS surface for zero benefit on a static SPA. |

### 1.6 Tooling & versions

| Tool | Current | Challenge | Action |
| --- | --- | --- | --- |
| Node.js | 22 LTS | 24 LTS | Track; switch on first stable (Oct 2026). |
| TypeScript | 6.0.3 | 6.1+ / TS7 (Go) | Track minor monthly; TS7 only when zero-delta. |
| Vite | 8 | 9 + Rolldown | Auto-adopt when default. |
| Vitest | 4.1.5 | 4.2 / 5.x | Auto-adopt 4.2; track 5.x. |
| ESLint | 10 | `oxlint` (50–100×) | **Adopted as fast pre-pass v13.13 (ADR-039)**; ESLint retained for missing rules. |
| Prettier | 3.x | Biome 2.x | **Track**; switch only on TS+MD+JSON parity. |
| Stylelint | 16.x | Lightning-CSS-only | Keep; consider Lightning-CSS-only validation v15. |
| Playwright | 1.5x | latest | Quarterly baseline regen. |
| Stryker (mutation) | 8.x | — | Threshold ≥ 85 %; extend to error-tracker + config + diag. |
| `fast-check` (property) | 3.x | — | Extend to worker-client envelope invariants v14.x. |
| `axe-core` (a11y) | latest | — | Keep CI gate. |
| Lighthouse CI | latest | — | Ratchet path: `warn 0.85` → `error 0.97` v14.x. |
| `pnpm` workspace | npm + parent | — | **Reject** — current pattern is sufficient and simpler. |
| Husky / Lefthook | none (CI is the gate) | — | **Reject** — pre-commit hooks slow contributors. |

### 1.7 Testing strategy

| Layer | Tooling | Action |
| --- | --- | --- |
| Unit | Vitest 4.1 + happy-dom 20 | Keep. Suite split per file. |
| Component (DOM-heavy) | `@vitest/browser` (Playwright provider) | Shipped v13.16 for `maximize.ts` + `layout-drag.ts`. |
| Property-based | fast-check | Extend to worker-client envelope invariants v14.x. |
| Mutation | Stryker | Threshold ≥ 85 %. |
| Visual regression | Playwright (in-repo baselines) | 45 → 80+ baselines; add DO-SSE alert states + video-news + maximise-FLIP. |
| End-to-end | Playwright | Keep. |
| Accessibility | axe-core (CI gate) | Keep + manual screen-reader pass per major release. |
| Performance | Lighthouse CI (`error 0.85`) | Tighten to `error 0.97` v14.x once Early Hints + SRI mature. |
| Coverage thresholds | 93.5 / 85.7 / 92.5 / 94.7 (current) | **Ratchet path**: → 95 / 90 / 95 / 96 (v15). +1 % per minor release. |

### 1.8 Observability, security, supply chain

| Area | Action |
| --- | --- |
| Obs | Diag schema v1 → v2 only if needed. **OpenTelemetry from Worker (opt-in, v14.2)**. |
| Obs | SLO dashboard (Grafana free tier or self-hosted) — gate: > 100 K req/day. |
| Sec | **SLSA L3 hermetic build (ADR-035)** — first shipped v14.2. Sigstore/cosign per release. |
| Sec | Subresource Integrity auto-injected (shipped v13.9). |
| Sec | Secret rotation per major release. Reporting API sampling audit annually. |
| Sec | CSP `require-trusted-types-for 'script'` enforcement audit v14.0. |
| Sec | npm + GitHub Actions provenance (Sigstore) — adopt v14.2. |
| Sec | OWASP Top 10 audit per major release; CSP wildcards reviewed every patch. |
| Infra | Cloudflare Pages migration — gate on measurable TTI/caching regression. |
| Infra | Annual vendor-neutrality drill (ADR-031) starts v14.0. |
| Infra | Static-PWA constraint: no server, no auth, no backend session (rule #26). |
| DX | `docs/adr/README.md` auto-generated (shipped). |
| DX | Mono-repo tooling harvest — propagate `tooling/` presets to siblings v14.1. |
| DX | Codecov-style PR coverage delta bot (own action) — shipped v13.9. |
| DX | PR SBOM-diff bot (own action) — shipped v13.9. |
| DX | Dev-mode SW kill switches (`?nosw=1`, `__fdbUnregisterSW()`) — shipped v13.13.1. |

### 1.9 Documentation discipline

| Type | Current | Verdict / Action |
| --- | --- | --- |
| ADRs | 45 (44 active, 1 withdrawn) | One per non-trivial decision. ADR-021 withdrawn; ADR-037 reserved. |
| User docs (`docs/`) | 14 + 45 | Keep. `docs/README.md` is the table of contents. |
| Legacy | `docs/legacy/BestDashBoard.html` | Keep archived; never edit. |
| `CHANGELOG.md` | per-release | Single source of historical truth. |
| `ROADMAP.md` | this file | Forward-looking only. |
| `.github/` | instructions, prompts, agents, skills | Deduplicated against `copilot-instructions.md`. |
| Architecture diagrams | `.github/assets/*.svg` + Mermaid | Auto-validated (ADR-040). |
| Inline comments | sparse, intent-only | Keep. No JSDoc for trivial functions. |
| Reading-level gate | `check-reading-level.mjs` | Shipped. |
| Wiki / Discussions | none | **Reject** — `docs/` + ADRs cover it. |

### 1.10 Decisions held rejected (consolidated 2026-Q2)

Client framework rewrite · Shadow DOM · user DB · OIDC/passkey/Google/Facebook/Apple auth · 40+ language i18n · pre-commit hooks · WebGPU/WASM hot paths · OPFS structured cache · AGPL · multi-tenant Workers for Platforms · pnpm workspace · Husky · Lerna/Nx · hand-rolled bundler · custom auth · Sentry SaaS · Codecov SaaS · Argos CI SaaS · Docker image release · Hyperdrive/Postgres · WebTransport server-side · Open UI `<selectlist>` · Bun test runner · `<dialog>` replacement · ECMAScript decorators · React Server Components · Remix/Next routing · GraphQL · gRPC · Drizzle/tRPC/Mantine.

---

## 2. Competitive Landscape — 2026-Q2

### 2.1 Comparison matrix — 16 peer projects across 4 categories

Categories: **TV/Family dashboards** · **Homelab dashboards** · **News/feed readers** · **Smart-home / monitoring**.

| Dimension | **FamilyDashBoard v13.18** | Homepage | Dashy | Homer | Homarr v2 | Glance | MagicMirror² | Beszel | Dashdot | NetNewsWire | Feedly | Apple Home | Grafana | HASS Lovelace | Tidbyt | TRMNL |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Audience | Always-on family TV | Homelab launcher | Homelab dashboard | Static startpage | Homelab mgmt | News dashboard | Smart-mirror | Server monitor | Server monitor | News reader | News reader (paid) | Apple smart-home | SRE/observability | Smart-home | Pixel info display | E-ink dashboard |
| Frontend | **Vanilla TS strict + Vite 8** | Next.js 15 | Vue 3.5 | Vue 3 | Next.js 15 + Mantine 7 | Go templates | Node + MM modules | SvelteKit | React + Vite | Swift | React (closed) | SwiftUI | React | Lit + Polymer | Go (HW) | Vue (HW) |
| Client deps | **0 / ~88 KB gzip** | ~38 | ~22 | ~12 | ~55 | 0 (SSR) | ~15 | ~4 | ~25 | n/a | unknown | n/a | ~120 | ~65 | n/a | n/a |
| State | **In-house Signals (ADR-038)** | React state | Pinia | Vuex | Zustand | n/a | Module bus | Svelte runes | React state | KVO | unknown | SwiftUI | Redux | Lit reactive | n/a | n/a |
| Backend | **Cloudflare Worker (Hono + Valibot)** | Node proxy | Node/Express | None | Node + tRPC + Drizzle | Single Go binary | Node Express | Single Go binary | Single Go binary | n/a | Cloud (closed) | iCloud | Go monolith | Python (HASS core) | Cloud + device | Cloud |
| User database | **None** | None | None | None | SQLite + Drizzle | None | None | SQLite | None | SQLite | Cloud | iCloud | many | SQLite | Cloud KV | Cloud KV |
| Edge cache | **KV stale + D1 + DO + Analytics Engine** | n/a | n/a | n/a | Postgres / SQLite | n/a | n/a | SQLite | n/a | n/a | proprietary | iCloud | Prometheus / Mimir | InfluxDB / SQLite | Tidbyt cloud | TRMNL cloud |
| TS strictness | **strict + nUII + vMS + eOPT** | strict | partial | JS-dominant | strict | n/a | partial | strict | partial | n/a | unknown | n/a | partial | partial | n/a | n/a |
| CSS | **`@layer` + tokens + Lightning + `@scope` + `light-dark()` + `@property`** | Tailwind 4 | SCSS | SCSS | Mantine CSS-in-JS | Hand CSS | CSS Modules | Tailwind 4 | Tailwind 3 | AppKit | Tailwind | SwiftUI | SCSS + Emotion | hand CSS | n/a | hand CSS |
| Tests | **5155 unit + PW + axe + 45 VR + LHCI + fast-check + Stryker** | Vitest partial | Vitest partial | None | Vitest + PW + Argos | Go tests | Minimal | Go tests | Partial | XCTest | unknown | XCTest | Go tests | pytest | n/a | n/a |
| Mutation | **Stryker** | None | None | None | None | None | None | None | None | None | unknown | None | None | None | None | None |
| Visual regression | **Playwright (45, in-repo)** | None | None | None | Argos CI | None | None | None | None | Snapshot | unknown | None | Pixelmatch | None | None | None |
| i18n | **Hebrew RTL + English** | 45+ | 22+ | YAML | 38+ | en-only | 30+ | en-only | en-only | 40+ | 25+ | 40+ | 30+ | 80+ | en-only | en-only |
| A11y | **WCAG 2.2 AA + axe gate** | Partial | Partial | Unknown | Partial | Unknown | Partial | Unknown | Unknown | VoiceOver | Unknown | Apple stack | Partial | Partial | n/a | n/a |
| Offline / PWA | **Full SW · 4-tier cache · `?nosw=1` escape** | No | Basic PWA | Installable | No | No | No | No | No | Native | Web stale-only | Native | No | Partial | n/a | E-ink only |
| Auth | **None (intentional)** | Host/proxy | Keycloak / basic | None | OIDC + passkey | None | None | Email + 2FA | None | Apple ID | Email | Apple ID | Many | Account / OIDC | Cloud account | Cloud account |
| Edge proxy | **Worker + KV stale + Valibot + D1 + Analytics + DO RL** | Server proxy | Proxy chain | n/a | tRPC over Next | n/a | None | n/a | n/a | None | proprietary | iCloud | Plugin model | Add-on model | n/a | n/a |
| Observability | **Web Analytics + Vitals + Errors + D1 + Reporting + Prom + AE + diag JSON** | None | None | None | Sentry (opt) | Prom endpoint | None | Built-in | Prometheus | Apple | proprietary | Apple | Prom + OTel | Prom + OTel + Loki | n/a | Cloud only |
| Sec headers | **CSP L3 + Trusted Types + COOP/COEP/CORP + 28-API Permissions-Policy + HSTS** | NGINX | Varies | None | Next defaults | Go handlers | None | Svelte defaults | Partial | Apple | proprietary | Apple | Helm defaults | HASS defaults | n/a | n/a |
| Supply-chain | **SLSA L2 + SBOM + Dependabot + Renovate (SHA) + dep-review + Stryker + SBOM-diff bot** (→ L3 v14.2) | High (Next churn) | Medium | Low | Very high | ~0 | Medium | Low | Medium | Apple-signed | proprietary | Apple-signed | Medium | High | Cloud-signed | Cloud-signed |
| Reproducible artefact | **`dist.zip` + `worker.js`, SLSA-pinned, SBOM/release** | Docker | Docker | Static site | Docker compose | Single binary | Node bundle | Single binary | Single binary | Apple-signed | n/a | n/a | Docker / Helm | Docker / venv | Cloud | Cloud |
| Cold-start TTI | **< 1.0 s cached / ~1.6 s fresh** | ~2.5 s | ~3 s | ~1 s | ~3.5 s | ~300 ms | ~2 s | ~500 ms | ~800 ms | n/a | ~2 s | n/a | ~3 s | ~2 s | n/a | ~1 s |
| Live-data cards | **12 deep, provider-adapted, history-backed** | 100+ shallow | 50+ | limited | 30+ | 12 feed types | 100+ shallow | Server metrics | Server metrics | RSS only | RSS + ML | Smart-home only | unlimited | unlimited | curated apps | curated apps |
| Hostile-network mode | **`?nosw=1` + corp CSP allowlist + DevTools unregister** | None | None | None | None | None | None | None | None | None | None | None | None | None | None | None |
| License | MIT | GPL-3.0 | MIT | Apache-2.0 | MIT | AGPL-3.0 | MIT | MIT | MIT | MIT | proprietary | proprietary | AGPL-3.0 | Apache-2.0 | proprietary | proprietary |
| Unique strength | Hebrew/Zmanim/Hebcal/Sefaria · TV-3 m · 4-tier offline · zero deps · highest gate density · firewall-aware | Ecosystem size | Themeable | Simplicity | Feature breadth | Go footprint | Mirror form-factor | Go deploy | Go deploy | macOS polish | ML clustering | Apple integration | Best-in-class panels | Vast device ecosystem | Pixel charm | E-ink low-power |

### 2.2 Patterns harvested (or rejected)

| Pattern | Source | Verdict | Landing |
| --- | --- | --- | --- |
| **Cloudflare Vectorize (semantic dedup)** | Feedly ML | **Adopt v14.0** | Replaces SimHash v2; precision@10 gate. |
| **Workers AI Llama 4 / multilingual** | CF 2026 GA | **Track v14.x** | Replace Llama 3.3 only when Hebrew quality measurably better at equal cost. |
| **DO Hibernatable WebSocket** | CF 2025 GA | **Adopt v14.x** | Stocks live + alerts SSE — DO bill drops ~80 % when idle. |
| **Cloudflare R2 for asset cache** | CF 2024 GA | **Adopt v14.x** | Backgrounds + offline shell mirrored; egress = $0. |
| **DO Storage SQL** | CF 2025 GA | **Track** | Possible D1 replacement; gate same query latency at lower CPU bill. |
| **TC39 Signals** | TC39 Stage 3 | **Adopt when polyfill ≤ 1.5 KB** | Drop-in for in-house signals. |
| **TC39 Temporal** | TC39 Stage 3 | **Adopt when polyfill ≤ 10 KB gzip** | Replaces date math in `hebrew-cal`, `calendar`, `countdown`. |
| **HTTP Early Hints (103)** | RFC 8297 | **Shipped v13.14** | −80 ms TTI. |
| **CRDT (Yjs ≈ 12 KB)** | Yjs 2024 | **Track** | Only if WebRTC delta proves insufficient. Hard budget ≤ 12 KB. |
| **Document Picture-in-Picture** | Browser 2024 | **Gate: 3+ user requests** | Corner PiP while other cards refresh. |
| **OpenTelemetry from Worker (opt-in)** | OTel 1.30+ | **Adopt v14.2** | Self-host collector on R2 + Workers ingestor. |
| **`oxlint` Rust lint pre-pass** | Oxc 2025 | **Shipped v13.13 (ADR-039)** | Pre-pass before ESLint. |
| **Biome (formatter + lint)** | Biome 2.x | **Track** | Re-evaluate v15 on TS+MD+JSON parity. |
| **Rolldown (Vite Rust bundler)** | Vite 2026 default | **Auto-adopt** | Zero code change required. |
| **Mermaid pre-commit validator** | Internal | **Shipped v13.10 (ADR-040)** | All architecture diagrams validated in CI. |
| **Argos CI visual regression** | Homarr v2 | **Superseded** | Playwright in-repo baselines; zero SaaS dep. |
| **Drizzle / tRPC / Mantine / Next** | Homarr v2 | **Reject (4th reconfirm)** | Contradicts zero-dep, no-DB, no-framework lines. |
| **OIDC / passkey / OAuth** | Homarr v2 / Beszel | **Reject** | Static client-only PWA; auth would require backend session store. |
| **Tidbyt pixel-art aesthetic** | Tidbyt | **Reject** | TV-3 m readability is opposite design pressure. |
| **TRMNL e-ink cadence (15-min)** | TRMNL | **Inspire** | Already aligned with our card TTLs. |
| **Apple Home Hub continuity** | Apple | **Inspire** | Mirrors WebRTC mirror direction (gated v14.x); auth-free, P2P. |
| **Feedly ML clustering** | Feedly | **Adopt v14.0** | Vectorize embeddings is the open-stack equivalent. |
| **Grafana panel grammar** | Grafana | **Reject** | Plugin loader ≥ 30 KB; our 12 cards are statically authored. |
| **HASS Lovelace YAML cards** | HASS | **Reject** | YAML editor adds parsing surface for zero gain on 12-card SPA. |
| **NetNewsWire SwiftData sync** | NNW 2024 | **N/A** | Apple-only; no cross-platform equivalent worth shipping. |

### 2.3 Our protected unique strengths

1. **Zero runtime deps on client** — peers ship 30–55; we ship 0.
2. **TV-first at 3 m viewing distance** — no peer targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 provider-adapted cards with normalized history + stale fallback** — depth over breadth.
5. **4-tier offline cache + dev escape hatches** — no peer renders a useful dashboard offline _and_ provides a `?nosw=1` opt-out.
6. **5155 tests + axe + VR + LHCI + Stryker + SLSA + container-query audit + mermaid validator** — highest gate density in matrix.
7. **Production observability without tracking cookies** — RUM + Vitals + Errors + Reports + AE + Prometheus.
8. **Reproducible single-artefact release** — `dist.zip` + `worker.js`, SLSA-pinned.
9. **Hostile-network resilience** — explicit corp-proxy CSP allowlist, SW unregister helper, file-protocol launch.
10. **Static-PWA constraint discipline** — no auth, no server, no DB. Reaffirmed every release.

---

## 3. Per-Card Deep Dive — 12 Cards × Best-in-Class Comparison

For each card: **(a)** current capabilities, **(b)** best-in-class peer comparison, **(c)** capability gap, **(d)** enhancement backlog (P/E/I — see §5).

### 3.1 News card

**Current**: RSS aggregator → SimHash v2 dedup → Llama 3.3 8B summary; per-source weighting; KV stale; no tracking.

**Compared to**: NetNewsWire (macOS, MIT, native), Feedly Pro+ ($8/mo, ML clustering), Inoreader ($5/mo, rules engine), Tiny Tiny RSS (self-host), Miniflux (Go self-host).

| Capability | Us | NetNewsWire | Feedly | Inoreader | Verdict |
| --- | --- | --- | --- | --- | --- |
| Semantic dedup | SimHash v2 | None | ML clustering | Rules | **Adopt Vectorize v14.0** |
| Auto-summary | Llama 3.3 Hebrew | None | English only | None | Keep |
| Read-later / starred | None | Yes | Yes | Yes | **Add v14.x** (IDB-backed) |
| Source weighting | Per-source slider | None | Pro feature | Pro feature | Keep |
| Topic clustering | None | None | ML | Rules | **Adopt v14.0** (Vectorize) |
| Hostile-network | `?nosw=1` + proxy chain | n/a | None | None | Keep — unique |
| RTL Hebrew | Native | Partial | Partial | Partial | Keep — unique |
| Per-article TTS | None | macOS only | None | None | **Defer v15** (Web Speech API; gate readability) |

**Enhancements**:

- N1 · P0 · M · Hi · v14.0 — Vectorize semantic dedup + topic clusters (replaces SimHash; precision@10 ≥ +15 %).
- N2 · P1 · S · Mid · v14.x — Star/read-later list (IDB-backed, AES-GCM URL share).
- N3 · P2 · S · Lo · v14.x — Per-source mute window (snooze 1 h / 1 d / 7 d).
- N4 · P2 · M · Mid · v15 — Web Speech API "read article" (Hebrew + English, gated by ≥ 3 user requests).
- N5 · P1 · S · Mid · v14.x — Article freshness pill (`<2 m`/`<1 h`/`<1 d`/old) with theme-tinted color.

### 3.2 Weather card

**Current**: Met Norway default + NWS (US travel) + Open-Meteo fallback + provider chain; 4-col detail grid; equal-width forecast tiles; °C/°F toggle; mm/in toggle.

**Compared to**: Apple Weather (proprietary), Carrot Weather ($5/yr), Tomorrow.io (API), Pirate Weather (open Dark Sky clone), Windy (vertical product).

| Capability | Us | Apple | Carrot | Tomorrow.io | Verdict |
| --- | --- | --- | --- | --- | --- |
| Multi-source aggregation | 3+ providers | 1 (Apple WeatherKit) | 6+ | 1 | **Lead** |
| Hyperlocal precip (next-hr) | None | Yes (US/UK/JP) | Yes | Yes | **Add v14.x** (Open-Meteo nowcast) |
| Severe-weather alerts | Via alerts card | Yes | Yes | Yes | **Cross-link to alerts card v14.0** |
| Air quality (AQI) | None | Yes | Yes | Yes | **Add v14.x** (Open-Meteo air-quality endpoint) |
| UV index | None | Yes | Yes | Yes | **Add v14.0** |
| Sunrise/sunset/golden | None | Yes | Yes | Yes | **Add v14.0** (compute locally, no API) |
| Moon phase | None | Yes | Yes | None | **Add v14.x** (Hebrew lunar tie-in) |
| Wind/gust visualization | Numeric | Compass | Compass + animated | Compass | **Add v14.x** SVG compass |
| Pollen | None | Yes | None | Yes | **Defer v15** |
| 10-day forecast | 7-day | 10-day | 10-day | 14-day | **Extend to 10-day v14.0** |

**Enhancements**:

- W1 · P0 · S · Mid · v14.0 — UV index + sunrise/sunset/golden hour (local compute, no extra API).
- W2 · P1 · M · Hi · v14.0 — Forecast 7 → 10 days (already in Open-Meteo response).
- W3 · P1 · M · Mid · v14.x — Hyperlocal nowcast (next 1-hour minute-by-minute precip from Open-Meteo).
- W4 · P1 · S · Mid · v14.x — Air-quality tile (PM2.5/PM10/O3 from Open-Meteo air-quality).
- W5 · P2 · S · Lo · v14.x — SVG wind compass with gust ring.
- W6 · P2 · S · Lo · v14.x — Moon phase emoji + Hebrew lunar day (tie to hebrew-cal card).

### 3.3 Stocks card

**Current**: Yahoo + Finnhub HTTP poll; SVG sparkline; Anchor-positioned popover; column widths fixed (rule #13).

**Compared to**: TradingView (proprietary), Yahoo Finance (free), Robinhood (broker), Bloomberg Terminal (enterprise), simplywall.st.

| Capability | Us | TradingView | Yahoo | Robinhood | Verdict |
| --- | --- | --- | --- | --- | --- |
| Live streaming | HTTP poll (60 s) | WebSocket | 15-min delay | WebSocket | **Adopt DO Hibernatable WS v14.x** |
| Sparkline | SVG inline | Pro charts | Pro charts | Pro charts | Keep — readability win at 3 m |
| Pre/post-market | None | Yes | Yes | Yes | **Add v14.x** |
| Multi-currency display | None | Yes | Yes | None | **Add v14.0** (cross-link currency card) |
| Earnings calendar | None | Yes | Yes | Yes | **Defer v15** (cross-link calendar card) |
| Watchlist groups | Single list | Multi | Multi | Multi | **Add v14.0** (IDB-backed groups) |
| Daily mover badge | None | Yes | Yes | Yes | **Add v14.0** (gainers/losers pill) |
| Historic chart on hover | Popover sparkline | Full chart | Full chart | Limited | Keep — readability; extend popover with 1Y/5Y tabs v14.x |
| Hebrew/RTL ticker | Native | None | None | None | Keep — unique |

**Enhancements**:

- S1 · P0 · M · Hi · v14.x — DO Hibernatable WebSocket live stream (replaces HTTP poll; ~80 % DO bill drop idle).
- S2 · P1 · S · Mid · v14.0 — Cross-card display: convert ticker to user's preferred currency (uses currency card rate).
- S3 · P1 · S · Mid · v14.0 — Daily-mover pills (top 3 gainers / losers across watchlist).
- S4 · P2 · M · Mid · v14.x — Watchlist groups (drag-into-group; IDB; AES-GCM URL share).
- S5 · P2 · S · Lo · v14.x — Pre/post-market state badge.

### 3.4 Currency card

**Current**: 4 providers (exchangerate.host + open.er-api + Frankfurter + ECB direct); ILS-base; per-route TTL.

**Compared to**: xe.com, Wise (formerly TransferWise), OANDA, Google Finance.

| Capability | Us | xe.com | Wise | OANDA | Verdict |
| --- | --- | --- | --- | --- | --- |
| Provider redundancy | 4 | 1 | 1 | 1 | **Lead** |
| Fee/spread reveal | None | Yes (paid) | Yes | Yes | **Skip** — not a transactional product |
| Historic chart | None | Yes | Yes | Yes | **Add v14.x** (30-day mini sparkline) |
| Quick-amount calculator | Static rate | Yes | Yes | Yes | **Add v14.0** (in-card input → result) |
| Multi-pair watch | 1 base | unlimited | 5 | unlimited | **Add v14.0** (allow up to 6 watch pairs) |
| Trend arrow (1d/7d/30d) | None | Yes | None | Yes | **Add v14.0** |
| Hebrew RTL | Native | Partial | None | None | Keep |

**Enhancements**:

- C1 · P0 · S · Hi · v14.0 — In-card mini-calculator: number input → live result for selected pair.
- C2 · P1 · S · Mid · v14.0 — Multi-pair watch (≤ 6 pairs).
- C3 · P1 · S · Mid · v14.0 — Trend arrow (1d Δ, 7d Δ, 30d Δ) — uses Frankfurter history endpoint.
- C4 · P2 · S · Lo · v14.x — 30-day SVG sparkline per pair.

### 3.5 Calendar card

**Current**: iCal (RFC-5545) + Google Calendar feed; 21-day window; 258 fuzz cases.

**Compared to**: Fantastical (Apple, $5/mo), Google Calendar, BusyCal, Cron (Notion).

| Capability | Us | Fantastical | Google | BusyCal | Verdict |
| --- | --- | --- | --- | --- | --- |
| Multi-source ingestion | iCal + Google | All (CalDAV/Google/Exchange/iCloud) | Google + iCal | All | Keep — within static-PWA constraint |
| Natural-language input | None | Yes | Limited | Yes | **Reject** — TV display, not authoring |
| Today/Next strip | Yes | Yes | Yes | Yes | Keep |
| 3-week view | 21 days | 6 weeks | 6 weeks | configurable | **Make horizon configurable v14.x** (1/2/3/4 weeks) |
| Holiday overlay | None | Yes | Yes | Yes | **Add v14.0** (Hebrew + Gregorian holidays from hebrew-cal) |
| Per-source color | None | Yes | Yes | Yes | **Add v14.0** |
| Conflict detection | None | Yes | None | Yes | **Add v14.x** (overlap badge) |
| Privacy-mode (titles hidden) | None | Yes | Yes | Yes | **Add v14.0** (`Busy` placeholder) |
| Temporal date math | ad-hoc | n/a | n/a | n/a | **Adopt when polyfill ≤ 10 KB** |

**Enhancements**:

- CAL1 · P0 · S · Hi · v14.0 — Holiday overlay using hebrew-cal data (cross-card).
- CAL2 · P0 · S · Mid · v14.0 — Per-source color tag (config UI).
- CAL3 · P1 · S · Mid · v14.0 — Privacy mode (replace title with `Busy`; per-source toggle).
- CAL4 · P1 · S · Mid · v14.x — Configurable horizon (1/2/3/4 weeks).
- CAL5 · P1 · M · Mid · v14.x — Replace ad-hoc date math with TC39 Temporal (gate by polyfill size).
- CAL6 · P2 · S · Lo · v14.x — Conflict overlap badge.

### 3.6 Hebrew calendar card

**Current**: Hebcal + Zmanim + Sefaria; daily Hebrew date; weekly parasha; festival highlights.

**Compared to**: Hebcal app, Sefaria iOS/Android, OpenSiddur, Chabad.org calendar.

| Capability | Us | Hebcal | Sefaria | Chabad | Verdict |
| --- | --- | --- | --- | --- | --- |
| Hebrew date | Native | Yes | Yes | Yes | Keep |
| Zmanim (6 daily) | Yes | Yes | Limited | Yes | Keep |
| Parasha + Haftarah | Parasha only | Both + commentary | Both | Both | **Add Haftarah ref v14.0** |
| Daily Sefaria text | None | Limited | Native | Limited | **Add v14.0** (one verse / day, Hebrew + EN translit) |
| Daf Yomi | None | Yes | Yes | Yes | **Add v14.0** (free Sefaria endpoint) |
| Candle-lighting countdown | None | Yes | None | Yes | **Add v14.0** (cross-link to countdown card on Fridays) |
| Omer counter | None | Yes (seasonal) | None | Yes | **Add v14.0** (auto-active Pesach → Shavuot) |
| Lunar phase + Rosh Chodesh | None | Yes | None | Yes | **Add v14.0** (cross-link to weather moon-phase). |
| Yahrzeit reminder | None | Yes | None | Yes | **Add v14.x** (IDB list, no PII to server). |

**Enhancements**:

- H1 · P0 · S · Hi · v14.0 — Daf Yomi tile (free Sefaria endpoint).
- H2 · P0 · S · Hi · v14.0 — Omer counter (seasonal auto-activation).
- H3 · P0 · S · Hi · v14.0 — Candle-lighting countdown (auto on Fridays + chag eves).
- H4 · P1 · S · Mid · v14.0 — Haftarah reference next to Parasha.
- H5 · P1 · S · Mid · v14.0 — Rosh Chodesh + lunar phase tile (cross-link to weather).
- H6 · P2 · M · Mid · v14.x — Yahrzeit list (local-only, IDB, AES-GCM URL share).
- H7 · P1 · M · Mid · v14.x — Replace internal date math with TC39 Temporal (gate by polyfill).

### 3.7 Alerts card (Israel home-front)

**Current**: Pikud Ha-Oref + Tzeva-Adom + DO SSE; Hebrew RTL; severity coloring; geo filter.

**Compared to**: Pikud Ha-Oref official app, Tzeva Adom (community), Red Alert (volunteer).

| Capability | Us | Pikud Ha-Oref | Tzeva-Adom | Red Alert | Verdict |
| --- | --- | --- | --- | --- | --- |
| Real-time SSE | DO SSE | Native push | WebSocket | Native push | **Upgrade to DO Hibernatable WS v14.x** |
| Geo-filtering | Yes | Yes | Yes | Yes | Keep |
| Multi-source corroboration | 2 sources | 1 official | 1 community | 1 community | **Lead** |
| Audio alarm | None | Yes | Yes | Yes | **Add v14.0** (TV-only opt-in; user-supplied tone path; Permissions-Policy compliant) |
| Vibrate fallback | None | n/a | Yes | Yes | **N/A** — TV |
| Alert history (24h) | Live only | Yes | Yes | Yes | **Add v14.0** (ring buffer in IDB, ≤ 100 entries) |
| Map view | None | Yes | Yes | Yes | **Defer v15** (would require map deps; static SVG tile alternative under audit) |
| Cross-card pause | None | n/a | n/a | n/a | **Add v14.0** (on alert: dim non-essential cards, full-screen alert) |

**Enhancements**:

- A1 · P0 · M · Hi · v14.0 — Alert mode UI takeover (full-screen, dim other cards, audio opt-in).
- A2 · P0 · S · Hi · v14.0 — 24-h alert history ring buffer (IDB, ≤ 100 entries).
- A3 · P1 · M · Hi · v14.x — DO Hibernatable WebSocket SSE upgrade.
- A4 · P2 · L · Mid · v15 — SVG static-tile map of recent alert geographies (no map dep).

### 3.8 Motivation card

**Current**: Local curator + Workers AI Hebrew quote; non-repeat window; faith-safe curator.

**Compared to**: Motivation+ ($1.99/yr), Daily Quote apps, Stoic ($30/yr), I Am ($30/yr).

| Capability | Us | Motivation+ | Stoic | I Am | Verdict |
| --- | --- | --- | --- | --- | --- |
| Hebrew RTL | Native | None | None | None | Keep — unique |
| AI-generated | Llama 3.3 | Curated | Curated | Curated | Keep |
| Faith-safe filter | Yes | None | None | None | Keep |
| Theme-by-day | None | Yes | Yes | Yes | **Add v14.0** (gratitude/courage/calm rotation) |
| Quote source attribution | Sometimes | Always | Always | Always | **Add v14.0** (source badge: Tanakh / Hazal / Modern / AI) |
| Save / favorite | None | Yes | Yes | Yes | **Add v14.x** (IDB favorites, AES-GCM URL share) |

**Enhancements**:

- M1 · P0 · S · Mid · v14.0 — Source attribution badge (Tanakh / Hazal / Modern / AI).
- M2 · P1 · S · Lo · v14.0 — Theme-by-day rotation (Sun=gratitude, Mon=courage, …).
- M3 · P2 · S · Lo · v14.x — Favorites list (IDB, ≤ 50 entries).

### 3.9 Tasks card

**Current**: Local IDB; per-task priority; due dates; CRDT track-only.

**Compared to**: Todoist (paid), Things 3 (Apple, $50), Microsoft To Do (free), TickTick.

| Capability | Us | Todoist | Things 3 | MS To Do | Verdict |
| --- | --- | --- | --- | --- | --- |
| Local-only | Yes | No | Per device | No | Keep — privacy win |
| Due-date reminders | None | Yes | Yes | Yes | **Add v14.0** (overdue badge + cross-card today-pane) |
| Recurring tasks | None | Yes | Yes | Yes | **Add v14.0** (RRULE subset) |
| Subtasks | None | Yes | Yes | Yes | **Add v14.x** (1-level nesting only) |
| Natural-language input | None | Yes | Yes | Yes | **Reject** — TV display |
| Tags / labels | None | Yes | Yes | Yes | **Add v14.0** (≤ 6 user-defined tags, color-coded) |
| Cross-device sync | URL share only | Cloud | iCloud | Cloud | **Add v14.x** (WebRTC mirror, gated 3+ requests) |
| Today / upcoming view | None | Yes | Yes | Yes | **Add v14.0** (cross-card today pane) |

**Enhancements**:

- T1 · P0 · S · Hi · v14.0 — Due-date overdue/today/this-week badge.
- T2 · P0 · M · Hi · v14.0 — RRULE recurring tasks (daily/weekly/monthly subset).
- T3 · P1 · S · Mid · v14.0 — Tags (≤ 6 user-defined, color-coded).
- T4 · P2 · M · Mid · v14.x — 1-level subtasks.
- T5 · P2 · L · Mid · v14.x — WebRTC mirror sync (gated; ADR-036).

### 3.10 System-info card

**Current**: `navigator.connection` + battery + memory + UA-CH high-entropy.

**Compared to**: Stats (macOS), iStat Menus ($10), HWMonitor (Win), Beszel.

| Capability | Us | iStat Menus | Stats (free) | Beszel | Verdict |
| --- | --- | --- | --- | --- | --- |
| Browser-only sandbox | Yes | n/a | n/a | n/a | Keep — only privacy-safe option |
| CPU per-core | API limited | Yes | Yes | Yes | **N/A** — browser sandbox |
| Network throughput | Connection type only | Yes | Yes | Yes | **Add v14.x** (passive RTT + downlink trend) |
| Battery health | % only | Yes | Yes | n/a | Keep within Battery API limits |
| Memory pressure | Yes | Yes | Yes | Yes | Keep |
| Storage quota | None | n/a | n/a | n/a | **Add v14.0** (`navigator.storage.estimate()`) |
| Service-worker state | None | n/a | n/a | n/a | **Add v14.0** (active/installing/redundant) |

**Enhancements**:

- SI1 · P1 · S · Mid · v14.0 — Storage quota tile (`navigator.storage.estimate()`).
- SI2 · P1 · S · Mid · v14.0 — Service-worker state tile (active / installing / redundant / none).
- SI3 · P2 · S · Lo · v14.x — Network RTT + downlink trend (10-min sparkline).

### 3.11 Countdown card

**Current**: Local user-defined target; Hebrew + Gregorian; multiple countdowns.

**Compared to**: Countdown+ ($1), Final Countdown, Days Until.

| Capability | Us | Countdown+ | Final Countdown | Verdict |
| --- | --- | --- | --- | --- |
| Multiple countdowns | Yes | Yes | Yes | Keep |
| Recurring | None | Yes | Yes | **Add v14.0** (annual/monthly) |
| Background image / theme | Theme tokens | Per-event image | Per-event image | **Reject** — breaks 6-theme system |
| Auto-link to calendar event | None | iCal import | iCal import | **Add v14.0** (cross-link calendar card events ≥ 7 days out) |
| Auto-link to hebrew-cal | None | None | None | **Add v14.0** — auto-add next Yom Tov |
| Confetti / celebration on T-0 | None | Yes | Yes | **Add v14.0** (CSS-only, reduced-motion aware) |

**Enhancements**:

- CD1 · P0 · S · Hi · v14.0 — Auto-import next Yom Tov from hebrew-cal (cross-card).
- CD2 · P0 · S · Mid · v14.0 — Auto-link from calendar events ≥ 7 days out (one-click "track").
- CD3 · P1 · S · Lo · v14.0 — Recurring (annual/monthly).
- CD4 · P2 · S · Lo · v14.x — CSS-only confetti at T-0 (`prefers-reduced-motion: no-preference`).

### 3.12 Video-news card

**Current**: Embed allowlist (YouTube, Reuters, AP); CSP `frame-src` strict.

**Compared to**: YouTube TV, Apple News+ video, Reuters TV.

| Capability | Us | YouTube TV | Apple News+ | Reuters TV | Verdict |
| --- | --- | --- | --- | --- | --- |
| Embed allowlist | Yes | n/a | n/a | n/a | Keep — only privacy-safe option |
| Picture-in-Picture | None | Yes | Yes | Yes | **Adopt PiP gated 3+ requests** (ADR-045) |
| Auto-play next | None | Yes | Yes | Yes | **Reject** — TV always-on, would compete with audio alerts |
| Captions / subtitles | Native player | Yes | Yes | Yes | Keep — native player passes through |
| Hebrew RTL caption | Player-dependent | n/a | n/a | n/a | Keep |
| Channel pinning | None | Yes | Yes | None | **Add v14.0** (≤ 4 channels in user config) |

**Enhancements**:

- V1 · P0 · S · Mid · v14.0 — Channel pinning (≤ 4 channels, drag-reorder).
- V2 · P2 · S · Lo · v14.x — Document Picture-in-Picture (gated; ADR-045 already exists).

---

## 4. Cross-Card Synergies — System-Level Enhancements

Once each card is best-in-class individually, the next leap is treating them as **one informed system**. Concrete synergies:

### 4.1 Unified "Today" pane (priority overlay)

A single full-width strip above the grid that aggregates every card's "today-relevant" signal in one row:

- Next event from **calendar** (≤ 6 h away).
- Next zman from **hebrew-cal** (≤ 3 h).
- Active **alert** badge (severity tinted).
- Top **stocks** mover (≥ 3 % move).
- Top **news** cluster (last 30 min).
- Most-overdue **task**.
- Active **countdown** (≤ 24 h).

**Item X1** · P0 · M · Hi · v14.0 — Implement `today-pane.ts` reading from each card's signal; single subscriber pattern; auto-collapses when empty.

### 4.2 Notification bus

Replace per-card sync indicators with a single coordinated bus:

- One **`globalSync`** signal aggregates all card states.
- One **`globalAlertChannel`** broadcasts cross-card pause requests (e.g., alert card requests dim).
- One **`globalThemeChannel`** propagates theme changes via View Transitions L2.

**Item X2** · P0 · M · Hi · v14.0 — `src/core/event-bus.ts` (signals-based pub/sub, ≤ 1 KB).

### 4.3 Semantic linking between cards

| Trigger | Effect |
| --- | --- |
| Calendar event with location → | Weather card prefetches forecast for that location on that date. |
| Hebrew-cal Erev Shabbat → | Countdown card auto-creates "candle-lighting" timer. |
| Hebrew-cal Yom Tov → | Calendar card colors holiday days; Countdown auto-tracks. |
| Stocks earnings date → | Calendar card adds read-only "earnings: TICKER". |
| News article mentions ticker → | Stocks card flashes the ticker subtle highlight. |
| News article high-severity tag (war/disaster) → | Alerts card surfaces banner. |

**Item X3** · P1 · L · Hi · v14.x — Semantic-link service (`src/core/links.ts`); one subscriber per direction; gated by user toggle.

### 4.4 Single keyboard model

Today: `T D A S N P B H ?` + arrows + numbers. Risk: model bloat per card.

**Item X4** · P1 · S · Mid · v14.0 — Centralised `keymap.ts` with help dialog auto-generated from registry; cards register their own bindings instead of patching globally.

### 4.5 Shared "card-state" lifecycle

All 12 cards already extend `FdbCard`. Promote shared lifecycle hooks:

- `onVisible()` / `onHidden()` (currently ad-hoc in each card).
- `onConfigChange(scope)` (currently `state.ts` listener).
- `onThemeChange()` (currently CSS-only; some cards need to recompute SVG colors).
- `onAlert()` (new — cards opt-in to dim/quiet).

**Item X5** · P1 · M · Hi · v14.0 — Lifecycle hook formalisation in `FdbCard` base class. ✅ Sprint 253 — `onThemeChange()` + `onAlert()` added to `FdbCard`; wired to `globalThemeChannel` / `globalAlertChannel` via `effect()` dispose pattern; 9 new tests.

### 4.6 Shared offline indicator + retry

One global "offline" pill replaces 12 per-card sync indicators when network is fully down. Per-card stale indicator remains for partial failures.

**Item X6** · P0 · S · Mid · v14.0 — `src/ui/offline-banner.ts` driven by `globalSync` signal.

### 4.7 Cross-card config search

Config panel today scrolls through all card configs. Add a top search box that fuzzy-matches config keys across cards.

**Item X7** · P2 · S · Lo · v14.x — Config search (≤ 1 KB; uses native fuzzy `match()`).

### 4.8 Cross-card snapshot

Single "snapshot" command (`Ctrl+Shift+S`) that exports a JSON capture of the entire dashboard state for support / debug / share. AES-GCM URL share already exists for config; this captures **state + config** at a moment.

**Item X8** · P2 · M · Mid · v13.28.0 — Snapshot export (gated by debug menu). ✅ Sprint 258 — `Ctrl+Shift+S` keyboard shortcut added to `main.ts`; calls `downloadSnapshot()` from `src/core/snapshot.ts`; shows toast confirmation; `buildSnapshot()` captures config + localStorage + diagLog.

### 4.9 Cross-card AI synthesis (Workers AI)

When all 12 cards are loaded, send their headline data points to Workers AI Llama 3.3 for a 1-line "summary of your day" tile. Hebrew-first.

**Item X9** · P1 · M · Mid · v14.x — Daily synthesis tile (cached 4 h; opt-in; faith-safe curator pre-filter).

### 4.10 Card-bundle delta budget per card group

Today: per-card bundle delta (rule shipped). Add **group budgets**: news+video (≤ 25 KB), weather+hebrew-cal+countdown (≤ 30 KB), …

**Item X10** · P2 · S · Lo · v14.x — Extend `check-card-bundle-delta.mjs` with grouped totals.

---

## 5. Consolidated Improvement Backlog

`P` = priority (P0 next-release blocker, P1 same-cycle, P2 opportunistic). `E` = effort (S ≤ 1 day, M 2–5 days, L > 5 days). `I` = impact (Hi/Mid/Lo).

### 5.1 Stack-level (carried from previous roadmap, consolidated)

| # | Type | Item | P | E | I | Target |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Rewrite | SimHash → Cloudflare Vectorize semantic news dedup | P0 | L | Hi | v14.0 |
| 2 | Refactor | Replace ad-hoc date math with TC39 Temporal in `hebrew-cal`/`calendar`/`countdown` (gated polyfill ≤ 10 KB) | P1 | M | Mid | v14.x |
| 3 | Enhance | DO Hibernatable WebSocket for stocks live + alerts SSE | P1 | M | Hi | v14.x |
| 4 | Enhance | R2 mirror for backgrounds + offline shell | P2 | M | Mid | v14.x |
| 5 | Refactor | Annual vendor-neutrality build drill (Deno Deploy + Bun Deploy + fly.io) | P1 | L | Hi | v14.0 |
| 6 | Enhance | OpenTelemetry from Worker (opt-in) | P2 | L | Mid | v14.2 |
| 7 | Enhance | SLSA L3 hermetic build + Sigstore/cosign | P0 | L | Hi | v14.2 |
| 8 | Refactor | Promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding | P1 | M | Hi | v14.1 |
| 9 | Enhance | Visual-regression baselines 45 → 80+ | P1 | M | Mid | v14.0 |
| 10 | Enhance | LHCI perf `error 0.85` → `error 0.97` once Early Hints + SRI ship and CI runner stable | P1 | S | Mid | v14.x |
| 11 | Enhance | WebRTC mirror with QR pairing (gated 3+ requests) | P2 | L | Mid | v14.x |
| 12 | Refactor | Narrow CSP `https://*.intel.com` wildcard once alternatives surface | P2 | S | Lo | v14.x |
| 13 | Enhance | OWASP Top 10 audit (rotate per major release) | P0 | M | Hi | v14.0 |
| 14 | Refactor | Coverage ratchet 93.5/85.7/92.5/94.7 → 95/90/95/96 | P1 | M | Mid | v15 |
| 15 | Track | TC39 Signals one-line swap when polyfill ≤ 1.5 KB and Stage 4 | P2 | S | Mid | v14.x |
| 16 | Track | Biome replacement for Prettier + ESLint when parity reached | P2 | M | Mid | v15 |
| 17 | Track | Rolldown auto-adopt when Vite default | P2 | S | Mid | v14.x |
| 18 | Track | TypeScript 7 (Go) primary typecheck once stable + zero-delta | P2 | M | Mid | v15 |

### 5.2 Per-card (from §3)

News: N1–N5 · Weather: W1–W6 · Stocks: S1–S5 · Currency: C1–C4 · Calendar: CAL1–CAL6 · Hebrew-cal: H1–H7 · Alerts: A1–A4 · Motivation: M1–M3 · Tasks: T1–T5 · System-info: SI1–SI3 · Countdown: CD1–CD4 · Video-news: V1–V2.

### 5.3 Cross-card (from §4)

X1–X10.

### 5.4 Anti-backlog (deliberately not on the list)

React rewrite · Shadow DOM · auth (Google/FB/Apple/OIDC/passkey) · user DB · Sentry · Codecov SaaS · Argos CI SaaS · pnpm · Husky · Bun runtime · Docker artefact · 3rd language until contributor offer · WebGPU/WASM hot paths · ECMAScript decorators · React Server Components · Remix/Next routing · GraphQL · gRPC · Tailwind · CSS-in-JS · Map dependencies (Leaflet/Mapbox) · auto-play video · auto-translate · pollen API.

---

## 6. Strategic Streams (v14 → v15)

### 6.1 V14-FOUNDATIONS — Tooling acceleration & supply-chain tightening (v14.0, Q1 2027)

- [x] SRI auto-injected · `@ts-check` on `.mjs` · `@starting-style` for `<dialog>` (v13.9).
- [x] PR coverage-delta + SBOM-diff bots (v13.9).
- [x] Mermaid + container-query audit (v13.10).
- [x] `oxlint` fast pre-pass (v13.13).
- [x] Cross-doc View Transitions opt-in (v13.13).
- [x] Smart text contrast (v13.13.1).
- [x] Dev-mode SW kill switches (v13.13.1).
- [x] `@vitest/browser` for `maximize.ts` + `layout-drag.ts` (v13.16).
- [x] CSS Anchor Positioning expansion (v13.15).
- [x] Stryker scope: error-tracker + config + diag (Sprint 126).
- [x] Coverage ratchet 89/81/89/90 → 93.5/85.7/92.5/94.7 (Sprint 167).
- [x] `vite-plugin-dev-csp-strip` (Sprint 127).
- [x] VR baselines 45 → 81 (Sprint 223).
- [x] Stryker scope extended: event-bus + keyboard + links (Sprint 226).
- [x] Coverage ratchet 92.3/84.0/91.5/93.7 (Sprint 225).
- [x] Coverage ratchet 92.7/84.2/91.5/94.0 (Sprint 235).
- [x] fast-check worker-client invariants P1-P13 (Sprint 233).
- [x] fast-check IDB property tests IDB1-IDB8 (Sprint 234).
- [x] Card pure-function property tests CP1-CP6 (Sprint 240).
- [x] LHCI `error 0.85` → `error 0.97` *(step 5/5: 0.97 at v13.26.0 — Sprint 236)*.
- [x] fast-check stocks SP1-SP6 + currency CM1-CM5 + alerts AP1-AP5 + hebrew-cal HC1-HC6 (Sprints 245–248).
- [x] Coverage ratchet 92.7/84.2/91.5/94.0 → 93.0/84.5/91.8/94.3 (Sprint 250).
- [x] Sigstore/cosign keyless signing for dist.zip + sw.js (Sprint 243).
- [x] Third-party rebuilder manifest `dist/rebuilder-manifest.json` (Sprint 244).

**Exit**: oxlint green; CI deltas live; coverage ≥ 93.0/84.5/91.8/94.3; LHCI perf `error ≥ 0.97`.

### 6.2 V14-SEMANTIC — Replace heuristics with embeddings & Signals (v14.0, Q1–Q2 2027)

- [x] In-house `signals.ts` shipped (ADR-038).
- [x] `state.ts` → `signals.ts` migration (100 % of reactive call sites).
- [x] HTTP Early Hints (103) from Worker (v13.14).
- [ ] Cloudflare Vectorize semantic news dedup (30-day shadow → SimHash retire).
- [ ] TC39 Signals one-line swap when polyfill ≤ 1.5 KB and Stage 4.
- [ ] TC39 Temporal in `hebrew-cal`/`calendar`/`countdown` when polyfill ≤ 10 KB gzip.

**Exit**: Vectorize precision@10 ≥ SimHash + 15 %; LHCI perf ≥ 0.98 cached.

### 6.3 V14-CARDS-DEEP — Best-in-class per-card depth (v14.0, Q1–Q2 2027)

Per-card backlog from §3. **Exit**: each card matches or exceeds its best-in-class peer on every capability listed in §3 except those marked Reject/Defer.

### 6.4 V14-CROSS-CARD — System-level synergies (v14.0–v14.1)

X1–X10 from §4. **Exit**: Today pane + event bus + lifecycle hooks + offline banner shipped; semantic linking opt-in; AI daily synthesis tile available.

### 6.5 V14-CONTINUITY — Cross-device without auth (v14.x, gated 3+ requests)

- [x] AES-GCM encrypted config URL export.
- [x] Import flow + `docs/sync.md`.
- [ ] WebRTC mirror — short-lived (5 min) QR-pairing, STUN-only, no relay (ADR-049 designed Sprint 249).
- [ ] CRDT (Yjs) — track only; adopt only if WebRTC delta insufficient AND core ≤ 12 KB gzip.

### 6.6 V14-EDGE — Workers platform expansion (v14.x, Q2–Q3 2027)

- [ ] DO Hibernatable WebSocket — stocks live + alerts SSE.
- [ ] R2 for asset cache (ADR-050 designed Sprint 249).
- [ ] Workers AI Llama 4 (gate Hebrew quality).
- [ ] DO Storage SQL audit (D1 replacement candidate).

### 6.7 V14-HARMONISE — Mono-repo reference (v14.1, Q2 2027)

- [x] Composite `tooling/ci/check.yml`.
- [x] Cross-project tooling registry.
- [x] Sibling repo audit (Sprint 168).
- [ ] BudgetManager / CrossTideWeb / Wedding on shared presets.
- [x] Shared `tooling/vitest/happy-dom.mjs` (Sprint 221).
- [x] Cross-project release gate (Sprint 239).

### 6.8 V14-SECURITY-L3 — SLSA L3 + supply chain (v14.2, Q3 2027)

- [x] Hermetic build: `actions/checkout` + `actions/setup-node` SHA-pinned (Sprint 222).
- [x] Hermetic build: npm `--ignore-scripts` gate + deploy-worker/preview-deploy fixed (Sprint 237).
- [x] Sigstore/cosign signature on `dist.zip` + `sw.js` (Sprint 243).
- [x] Third-party rebuilder manifest `dist/rebuilder-manifest.json` (Sprint 244).
- [x] npm + GitHub Actions provenance (SLSA L2 `attest-build-provenance` in release.yml).
- [x] CSP `require-trusted-types-for 'script'` enforcement audit (Sprint 220, trusted-types policy).
- [x] OWASP Top 10 rotation automated (`scripts/check-owasp.mjs`, Sprint 221).

### 6.9 V14-RESILIENCE — Hostile-network & DX (v14.0, Q1 2027)

- [x] `?nosw=1` URL flag (v13.13.1).
- [x] `__fdbUnregisterSW()` DevTools helper (v13.13.1).
- [x] CSP `connect-src` allowlist widened (v13.13.1).
- [x] `vite-plugin-dev-csp-strip` (Sprint 127).
- [x] Per-card "blocked by network" diagnostic toast (Sprint 136).
- [x] `docs/local-dev.md` corp-proxy quickstart (Sprint 135).

**Exit**: developer behind hostile firewall iterates on every card without disabling CSP globally.

### 6.10 V15-OPEN — Long horizon (Q4 2027 →)

- [ ] Streams API for news ingestion (gate measurable perceived-TTI win).
- [ ] WebTransport server-side once Cloudflare ships native support.
- [ ] DO Storage SQL evaluation as D1 replacement.
- [ ] Lightning CSS validation as sole CSS lint (drop Stylelint) on rule-set parity.
- [ ] TS7 (Go-rewrite) primary typecheck on stable + zero-delta.
- [ ] Coverage ratchet to 95 / 90 / 95 / 96.

---

## 7. Release Cadence & Gates

| Phase | Gate | Action on red |
| --- | --- | --- |
| Pre-PR | tsc · eslint · oxlint · prettier · stylelint | Fix locally before push. |
| PR | vitest · LHCI · axe · VR · bundle delta · SBOM | One reviewer (self) — block on any red gate. |
| Pre-tag | `.github/instructions/pre-release.instructions.md` checklist | All zero-tolerance items must pass. |
| Post-tag | `release.yml` workflow | Watch for `dist.zip` + SBOM + cosign signature. |
| Post-prod | RUM Web Vitals + diag JSON + Prom `/api/metrics` | Regression > 10 % triggers patch within 24 h. |

**Versioning**: SemVer. Major = breaking config schema (rare); Minor = new card or worker route or stream completion; Patch = bug fix or polish.

---

## 8. Open Questions (re-litigated quarterly)

1. When does TC39 Signals reach Stage 4 + polyfill ≤ 1.5 KB? (gate item #15)
2. When does TC39 Temporal land a polyfill ≤ 10 KB gzip? (gate items #2, CAL5, H7)
3. Will Cloudflare Pages match Workers TTI at zero cost differential? (Pages migration gate)
4. Should `https://*.intel.com` wildcard narrow once we leave the corp environment? (#12)
5. At what tested-card count does the `weather` 4×2 detail grid exhaust readability on a 65″ TV at 3 m? (visual-regression check at v14.0)
6. Should we add a `?dev=1` mega-flag bundling `?nosw=1` + dev CSP strip + verbose diag? (track demand)
7. Is 21-day calendar (3 weeks) the right default, or should the user-configurable horizon (CAL4) become default? (track post-shipping)
8. Does Vectorize cost-per-million stay below D1 read cost at our news volume? (gate item #1)
9. Does the cross-card AI synthesis tile (X9) regress LHCI on first paint? (visual-regression + LHCI gate)

---

## 9. Pointers

- **History**: [CHANGELOG.md](../CHANGELOG.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **ADRs**: [adr/README.md](./adr/README.md)
- **Data sources**: [data-sources.md](./data-sources.md)
- **Local dev**: [local-dev.md](./local-dev.md)
- **Sync (config-share)**: [sync.md](./sync.md)
- **Security**: [security.md](./security.md)
- **Privacy**: [privacy.md](./privacy.md)
- **Card audit**: [card-architecture-audit.md](./card-architecture-audit.md)
