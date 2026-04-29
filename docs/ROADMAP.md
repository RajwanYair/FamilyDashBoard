# FamilyDashBoard — Strategic Roadmap

> **Refresh date**: 2026-04-29 · **Shipped baseline**: v13.16.0 (Sprint 149). Active stream: v14.0 (Q1 2027) — V14-FOUNDATIONS, V14-SEMANTIC, V14-RESILIENCE. Roadmap items #7, #8, #10 confirmed Done.
>
> **Inventory**: 5121+ tests / 162+ suites / 0 failures · 0 ESLint errors · 0 ESLint warnings · 0 `eslint-disable` · 0 `@ts-ignore` · 0 TS errors · 0 markdownlint / stylelint issues · 42+ ADRs · 0 client runtime deps · 2 worker deps (Hono + Valibot) · 6 themes · 12 cards · 4-tier offline cache.
>
> **Purpose**: a deliberate, _first-principles re-litigation of every decision_ — including the ones that look clean. No grandfathering. The bar is **best-in-class** for an always-on family TV dashboard. Historical sprint and release entries live in [CHANGELOG.md](../CHANGELOG.md); this file is forward-looking only.

---

## 0. Executive Summary

After 118 sprints across v10 → v13.13 the project has reached a stable, opinionated, production-hardened plateau: zero client deps, edge-only backend, four-tier offline, comprehensive observability without tracking, and the highest CI gate density in its peer table.

The strategic frontier for v14 → v15 is no longer breadth or feature catch-up. It is:

1. **Eliminate every remaining vendor and tool lock-in** — annual neutrality drill (Cloudflare ↔ Deno Deploy ↔ Bun Deploy ↔ fly.io); replace ESLint with `oxlint`/Biome where rules permit; auto-adopt Rolldown when Vite ships it default.
2. **Replace heuristics with semantics where the budget allows** — SimHash → Cloudflare Vectorize embeddings (semantic news dedup); ad-hoc date math → TC39 Temporal; imperative `state.ts` → in-house Signals → TC39 Signals.
3. **Push observability and supply chain to industry leadership** — SLSA L3 hermetic builds, Sigstore/cosign provenance, third-party rebuilder verification, optional OpenTelemetry export, automated SBOM diff bot.
4. **Cross-device continuity _without_ introducing auth or a server DB** — WebRTC mirror with QR pairing (gated); CRDT (Yjs ~12 KB) only if WebRTC delta proves insufficient.
5. **Mono-repo harvest** — promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding so all four repos share one quality gate.
6. **Resilience behind hostile networks** — corporate-proxy / firewall-aware dev mode; provider chains never block the UI; SW never serves stale offline-fallback HTML when the user opted out.

Every line below is a decision, gate, or trigger. No aspiration decoration.

---

## 1. First-Principles Re-Litigation — Every Axis Reopened

Every "clean" decision is challenged below. Stamps: **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, **Supersede**. Decisions confirmed without action are listed once and not iterated.

### 1.1 Code language & TypeScript posture

| Decision                                                       | Challenge                                      | Verdict                  | Action                                                                                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                                                     | Could Rust+wasm-bindgen win on a 75 KB worker? | **Keep** (load-bearing)  | Annual posture review only. Rust → WASM rejected: developer pool, debug story, and bundle floor (~50 KB just for runtime) are worse.            |
| `strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` | Stricter posture available?                    | **Keep** (highest grade) | Track `exactOptionalPropertyTypes` migration v14.x — currently disabled to keep card config evolutions ergonomic; quantify breakage cost first. |
| `tsgo` (TypeScript-Go) as second typecheck                     | Re-add as informational?                       | **Withdrawn (ADR-021)**  | Re-evaluate only when `tsgo` can replace `tsc` outright as a _blocking_ gate. No `continue-on-error` shadow gates.                              |
| TypeScript 6.x                                                 | Stay current?                                  | **Keep** (6.0.3)         | Track 6.1+ on parent `MyScripts/`.                                                                                                              |
| `// @ts-check` on `.mjs` scripts                               | Bring helpers into the type gate?              | **Shipped v13.9**        | All `scripts/*.mjs` opt-in via `tsconfig.scripts.json`.                                                                                         |
| Vanilla JS escape hatches in `worker/src`                      | Allowed anywhere?                              | **Reject**               | TS strict everywhere; no `.js` source.                                                                                                          |
| TypeScript 7 (Go-rewrite, `tsc-go`)                            | Adopt early?                                   | **Track v15**            | Keep `tsc` as gate. Switch when stable + zero behavioural delta on our codebase.                                                                |
| ECMAScript decorators (Stage 3)                                | Adopt for `FdbCard`?                           | **Reject**               | Adds parse cost + transpile risk for zero functional gain over our class-without-decorators pattern.                                            |

### 1.2 Frontend architecture & UI

| Decision                                                                       | Challenge                                             | Verdict                           | Action                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Vanilla DOM + `FdbCard` (no framework)                                         | React 19 / Solid / Svelte 5 won the productivity war? | **Keep (5th reconfirm)**          | No peer benefit we lack. Bundle floor of any framework ≥ 30 KB gzip vs. our ~12 KB main thread runtime.                         |
| Shadow DOM / Web Components                                                    | Better encapsulation than `@scope`?                   | **Reject (reconfirmed, ADR-001)** | `@scope` gives encapsulation without breaking global `@layer` theming or `prefers-reduced-motion` cascades.                     |
| Zero client deps (ADR-002)                                                     | Ever?                                                 | **Keep (load-bearing)**           | Non-negotiable. Polyfills count against the 75 KB ceiling.                                                                      |
| State (`state.ts` imperative)                                                  | Replace?                                              | **In progress**                   | ADR-038 ships zero-dep `signals.ts` mirroring TC39 Signals API. Card-at-a-time migration v14.0; one-line swap when Stage 4.     |
| Date math (ad-hoc + `Intl`)                                                    | TC39 Temporal?                                        | **Replace v14.x**                 | When polyfill ≤ 10 KB gzip — gate `hebrew-cal`, `calendar`, `countdown`.                                                        |
| View Transitions L1 (same-doc)                                                 | Already used?                                         | **Keep**                          | Theme + config-panel + maximise-FLIP shipped.                                                                                   |
| View Transitions L2 (cross-doc)                                                | Adopt?                                                | **Adopt v14.0**                   | Browser-shipped Q1-2026; expand to maximise-card flow.                                                                          |
| CSS `@layer` + tokens + `light-dark()` + `@property`                           | Sufficient?                                           | **Keep**                          | Tailwind 4 / CSS-in-JS rejected — they would break the 6-theme token system.                                                    |
| Smart text contrast (auto B/W per scheme)                                      | Hand-tuned per theme?                                 | **Shipped v13.13.1**              | `light-dark()` argument order corrected so text auto-flips: dark scheme → `#faf5ef`, light scheme → `#1c1008`.                  |
| CSS `@starting-style`                                                          | Replace JS enter animations?                          | **Shipped v13.9**                 | All `<dialog>` overlays use native enter/exit.                                                                                  |
| CSS Anchor Positioning                                                         | Beyond Stocks Popover?                                | **Expand v14.0**                  | Diag-Overlay + Help dialog.                                                                                                     |
| Container Queries-only layout (ADR enforced via `check-container-queries.mjs`) | Audited?                                              | **Shipped v13.10**                | CI guard blocks viewport `@media` in card CSS.                                                                                  |
| Lightning CSS                                                                  | Faster than esbuild CSS?                              | **Keep (ADR-017)**                | Re-evaluate v15 if esbuild-css adds nesting + custom-property fallback at parity.                                               |
| Per-card bundle delta CI alert                                                 | Shipped?                                              | **Shipped**                       | > 10 % growth fails CI.                                                                                                         |
| Subresource Integrity auto-injection                                           | Source patched?                                       | **Shipped v13.9**                 | `injectSri` Vite plugin emits `integrity="sha384-…"`.                                                                           |
| HTTP Early Hints (103) from Worker                                             | Adopt?                                                | **Adopt v14.x**                   | ~80 ms TTI improvement; gate Vite ↔ CF interaction in shadow first.                                                             |
| Native File System Access                                                      | Shipped?                                              | **Shipped v13.10**                | `src/core/fs-access.ts` with blob-anchor + hidden input fallback.                                                               |
| Document Picture-in-Picture (video-news)                                       | Adopt?                                                | **Gate: 3+ user requests**        |                                                                                                                                 |
| Streams API for news ingestion                                                 | Replace JSON-batch with NDJSON streamed render?       | **Defer v15**                     | Quantify perceived-TTI win first; current p95 already < 1.0 s cached.                                                           |
| `<selectlist>` + `<details>` `name=` (Open UI)                                 | Replace `<dialog>`?                                   | **Reject**                        | `<dialog>` is GA across all browsers; Open UI remains experimental.                                                             |
| Card content layout: rectangular tile/grid (rule #25)                          | Vertical lists ever?                                  | **Keep**                          | Audited every release. Sequential feeds (news, stock rows) excepted.                                                            |
| Fixed-content card sizing (no stretch)                                         | Some cards stretched in v13.12?                       | **Shipped v13.13**                | weather/motivation/countdown/currency in `flex: 0 1 auto` group; `weather-body` set to `flex: 0 0 auto` to kill vertical gaps.  |
| Equal-width forecast/calendar tiles (rule #25 extension)                       | Content-width skew?                                   | **Shipped v13.13.1**              | `repeat(N, 1fr)` + `min-width: 0` on children — tiles never collapse to content width; widest tile defines the row's heightset. |

### 1.3 Backend architecture & edge

| Decision                                       | Challenge                | Verdict                    | Action                                                                                                              |
| ---------------------------------------------- | ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker (ADR-003)                    | Better edge?             | **Keep**                   | Annual vendor-neutrality drill (ADR-031) starts v14.0 — rebuild on Deno Deploy + Bun Deploy + fly.io.               |
| Hono + Valibot                                 | Lighter?                 | **Keep**                   | ~25 KB win over Zod retained; Hono routing < 8 KB.                                                                  |
| KV stale cache (per route)                     | Per-route TTL audit?     | **Keep** (ADR-013)         | Annual TTL review against `worker/openapi.yaml`.                                                                    |
| D1 telemetry                                   | Cheaper alt?             | **Keep, audit v15**        | Compare DO Storage SQL + Workers Analytics Engine for same workload.                                                |
| Durable Objects (alerts SSE)                   | Hibernatable?            | **Adopt v14.x**            | DO Hibernatable WebSocket — stocks live-stream + alerts SSE; ~80 % bill drop when idle.                             |
| R2 for asset cache                             | Adopt?                   | **Adopt v14.x**            | Backgrounds + offline shell mirrored; egress = $0.                                                                  |
| Workers Queues (error fan-out)                 | Shipped?                 | **Shipped v13.0**          |                                                                                                                     |
| Email Workers weekly digest                    | Shipped?                 | **Shipped v13.0 (opt-in)** |                                                                                                                     |
| Workers AI (Llama 3.3 8B)                      | Llama 4?                 | **Track v14.x**            | Switch only when Hebrew quality measurably better at equal cost.                                                    |
| Cloudflare Vectorize (semantic news dedup)     | Replace SimHash?         | **Adopt v14.0**            | 30-day shadow vs SimHash; precision@10 ≥ +15 % gate.                                                                |
| Hyperdrive / Postgres                          | Adopt?                   | **Reject (reconfirmed)**   | No relational store in stack.                                                                                       |
| User-facing DB                                 | Adopt?                   | **Reject (reconfirmed)**   | LS + IDB + JSON export + AES-GCM URL share cover it.                                                                |
| Rate limiting (DO counter)                     | Sufficient?              | **Keep**                   | Per-client adaptive back-off live across all routes.                                                                |
| Worker bundle budget ≤ 75 KB gzip              | Tighten?                 | **Keep ceiling**           | Tightening to 60 KB rejected — leaves no room for Hyperdrive-free DO Storage SQL adapter.                           |
| Annual vendor-neutrality build drill           | Adopt?                   | **Adopt v14.0 (ADR-031)**  | First run rebuild on Deno Deploy + Bun Deploy + fly.io once per major release.                                      |
| OpenTelemetry from Worker                      | Adopt?                   | **Adopt v14.2 (opt-in)**   | Self-hosted collector; off by default, env-flag on.                                                                 |
| WebTransport / HTTP/3 push                     | Adopt for stocks/alerts? | **Defer**                  | DO Hibernatable WebSocket has same UX at known cost; revisit v15 once CF supports WebTransport server-side.         |
| CSP `connect-src` allowlist                    | Wildcards added?         | **Shipped v13.13.1**       | `https://*.intel.com` added for corp-proxy environments. Continue strict allowlist (no `*` blanket).                |
| Service Worker dev escape hatches              | Adopt?                   | **Shipped v13.13.1**       | `?nosw=1` URL flag bypasses SW; `__fdbUnregisterSW()` global purges registrations + caches behind firewalls.        |
| File-protocol launch (`dist/index.html`)       | Adopt?                   | **Shipped v13.13**         | `--base ./` + `removeCrossOrigin` Vite plugin → single IIFE with no CSP meta + no `crossorigin` attrs.              |
| Dev-mode CSP relaxation (Vite plugin)          | Adopt?                   | **Defer v14.0**            | Ship a `vite-plugin-dev-csp-strip` that removes the meta only when `mode==='development'` for proxy-blocked devs.   |

### 1.4 Data plane & external API surface

| Card / area | Provider redundancy                                                              | Verdict / Action                                                        |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| news        | RSS aggregator → SimHash v2 → (v14) **Vectorize embeddings** → Llama 3.3 summary | Vectorize shadow run 30 d before SimHash retire.                        |
| weather     | Met Norway (default) + NWS (US-travel mode) + Open-Meteo + provider chain        | Open-Meteo confirmed as 3rd fallback v13.13; UI: 4-col detail grid + equal-width forecast tiles (rule #25). |
| stocks      | Yahoo + Finnhub HTTP today                                                       | DO Hibernatable WebSocket live-stream v14.x; gate TTI + battery budget. |
| currency    | exchangerate.host + open.er-api                                                  | Add ECB direct as third source v14.x.                                   |
| calendar    | iCal (RFC-5545) + Google Calendar feed                                           | 21-day window (3 weeks) shipped v13.13.1; fuzz-case set 204 → 250+ v14.0. |
| hebrew-cal  | Hebcal + Zmanim + Sefaria                                                        | Replace internal date math with Temporal when polyfill in budget.       |
| alerts      | Pikud Ha-Oref + Tzeva-Adom + DO SSE                                              | DO Hibernatable upgrade.                                                |
| motivation  | Local curator + Workers AI Hebrew quote                                          | Non-repeat window already shipped; faith-safe curator audit annually.   |
| tasks       | Local IDB                                                                        | Optional CRDT sync gate (Yjs ≤ 12 KB).                                  |
| system-info | `navigator.connection` + battery + memory + UA-CH high-entropy                   | Stable v13.13.                                                          |
| countdown   | Local                                                                            | Stable.                                                                 |
| video-news  | Embed allowlist only                                                             | Document PiP gate: 3+ user requests.                                    |

**Cross-cutting**: every external response is Valibot-validated, KV-stale-cached, has a per-route TTL documented in `worker/openapi.yaml`, and falls back to a stale tier on failure. **Page-visibility guard** (`if (!_pageVisible) return;`) at top of every loader. **Try/catch + proxy fallback chain** (`PROXIES`) on every fetch. **Diagnostic log** (`diagLog()`) on every error.

### 1.5 Database / storage / infrastructure

| Tier                  | Current                              | Challenged with       | Verdict                                                             |
| --------------------- | ------------------------------------ | --------------------- | ------------------------------------------------------------------- |
| Browser L1            | In-memory `Map`                      | None viable           | **Keep**                                                            |
| Browser L2            | `localStorage` (`dash_v2_*`)         | OPFS structured cache | **Keep** — OPFS has no eviction story for our LRU pattern.          |
| Browser L3            | IndexedDB ≤ 50 MB LRU                | OPFS / SQLite-WASM    | **Keep** — SQLite-WASM ≈ 1.5 MB blows our ceiling.                  |
| Browser L4            | Service Worker cache (7 origins)     | None viable           | **Keep**                                                            |
| Edge cache            | Cloudflare KV (per-route)            | DO Storage SQL        | **Audit v15**                                                       |
| Edge analytics        | D1 + Analytics Engine                | Workers Logs          | **Keep, audit v15**                                                 |
| Edge object           | (none)                               | R2                    | **Adopt v14.x** for backgrounds + offline shell                     |
| User-owned config     | LS + IDB + JSON export + AES-GCM URL | Cloud DB              | **Reject (4th reconfirm)**                                          |
| Reproducible artefact | `dist.zip` + `worker.js` (SLSA L2)   | Docker image          | **Keep** — Docker adds OS surface for zero benefit on a static SPA. |

### 1.6 Tooling & versions

| Tool                    | Current               | Challenge          | Action                                                                              |
| ----------------------- | --------------------- | ------------------ | ----------------------------------------------------------------------------------- |
| Node.js                 | 22 LTS                | 24 LTS             | Track; switch on first stable (Oct 2026).                                           |
| TypeScript              | 6.0.3                 | 6.1+ / TS7 (Go)    | Track minor monthly; TS7 only when zero-delta.                                      |
| Vite                    | 8                     | 9 + Rolldown       | Auto-adopt when default.                                                            |
| Vitest                  | 4.1.5                 | 4.2 / 5.x          | Auto-adopt 4.2; track 5.x.                                                          |
| ESLint                  | 10                    | `oxlint` (50–100×) | **Adopted as fast pre-pass v13.13 (ADR-039)**; ESLint retained for missing rules.   |
| Prettier                | 3.x                   | Biome 2.x          | **Track**; switch only on TS+MD+JSON parity.                                        |
| Stylelint               | 16.x                  | Lightning-CSS-only | Keep; consider Lightning-CSS-only validation v15 if rule set fully migrated.        |
| Playwright              | 1.5x                  | latest             | Quarterly baseline regen.                                                           |
| `markdownlint-cli2`     | 0.22                  | latest             | Keep.                                                                               |
| `commitlint`            | 19.x                  | conventional       | Keep.                                                                               |
| `changesets`            | 2.x                   | release-please     | Keep (ADR-034).                                                                     |
| Stryker (mutation)      | 8.x                   | —                  | Extend scope: error-tracker + config + diag v14.0; threshold ≥ 85 %.                |
| `fast-check` (property) | 3.x                   | —                  | Extend to worker-client envelope invariants v14.x.                                  |
| `axe-core` (a11y)       | latest                | —                  | Keep CI gate.                                                                       |
| Lighthouse CI           | latest                | —                  | Perf assertion lowered to `warn` v13.13.1 (CI sandbox cannot reliably hit 0.70 for 12 cards). Re-tighten to ≥ 0.97 once Early Hints + SRI ship and CI runner CPU budget stabilises. |
| `markdown-link-check`   | shipped v13.13        | —                  | Monthly cron-only, never blocks PR.                                                 |
| `pnpm` workspace        | npm + parent          | —                  | **Reject** — current pattern is sufficient and simpler.                             |
| Husky / Lefthook        | none (CI is the gate) | —                  | **Reject** — pre-commit hooks slow contributors; CI has zero suppression.           |

### 1.7 Testing strategy

| Layer                 | Tooling                                 | Action                                                                                                           |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Unit                  | Vitest 4.1 + happy-dom 20               | Keep. Suite split per file (no shared imports).                                                                  |
| Component (DOM-heavy) | `@vitest/browser` (Playwright provider) | Adopt v14.0 for maximise-FLIP, layout-drag — too DOM-complex for happy-dom.                                      |
| Property-based        | fast-check                              | Extend to worker-client envelope invariants v14.x.                                                               |
| Mutation              | Stryker                                 | Threshold ≥ 85 %; extend to error-tracker + config + diag v14.0.                                                 |
| Visual regression     | Playwright (in-repo baselines)          | 54 → 80+ baselines; add DO-SSE alert states + video-news + maximise-FLIP.                                        |
| End-to-end            | Playwright                              | Keep.                                                                                                            |
| Accessibility         | axe-core (CI gate)                      | Keep + manual screen-reader pass per major release.                                                              |
| Performance           | Lighthouse CI (perf `warn` ≥ 0.70)      | Tighten back to `error` ≥ 0.97 v14.x once Early Hints + SRI ship in concert and CI runner perf is stable.        |
| Coverage thresholds   | 89 / 81 / 89 / 90 (current)             | **Ratchet path**: 89/81/89/90 → 92/85/92/93 (v14) → 95/90/95/96 (v15). +1 % per minor release.                   |

### 1.8 Observability, security, supply chain

| Area  | Action                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Obs   | Diag schema v1 → v2 only if needed. **OpenTelemetry from Worker (opt-in, v14.2)**.                                                                           |
| Obs   | SLO dashboard (Grafana free tier or self-hosted) — gate: > 100 K req / day or 5+ user reports of degraded perf.                                              |
| Sec   | **SLSA L3 hermetic build (ADR-035)** — first shipped v14.2. Sigstore/cosign per release.                                                                     |
| Sec   | Subresource Integrity auto-injected (**shipped v13.9**).                                                                                                     |
| Sec   | Secret rotation on every major release. Reporting API sampling audit annually.                                                                               |
| Sec   | CSP `require-trusted-types-for 'script'` audit v14.0; verify policy enforcement in production logs.                                                          |
| Sec   | Post-quantum-ready signature for config URL share — **track only**; current AES-GCM + HMAC adequate.                                                         |
| Sec   | npm + GitHub Actions provenance (Sigstore) — adopt v14.2.                                                                                                    |
| Sec   | OWASP Top 10 audit per major release. CSP wildcards reviewed every patch (current: `https://*.intel.com` corp-proxy escape hatch — narrow when alternatives surface). |
| Infra | Cloudflare Pages migration — **gate**: measurable TTI or caching regression on Pages.                                                                        |
| Infra | Annual vendor-neutrality drill (ADR-031) starts v14.0.                                                                                                       |
| Infra | Static-PWA constraint: no server, no auth, no backend session. (ADR-002, ADR-003 reaffirmed.)                                                                |
| DX    | `docs/adr/README.md` auto-generated from ADR frontmatter — **shipped**.                                                                                      |
| DX    | Cross-project MCP matrix in `.github/copilot/MCP_SERVERS.md` — extend with GitKraken + Azure rows v14.0.                                                     |
| DX    | Mono-repo tooling harvest — propagate `tooling/` presets to BudgetManager / CrossTideWeb / Wedding v14.1.                                                    |
| DX    | Codecov-style PR coverage delta bot (own action, no SaaS) — **shipped v13.9**.                                                                               |
| DX    | PR SBOM-diff bot (own action, no SaaS) — **shipped v13.9**.                                                                                                  |
| DX    | Dev-mode SW kill switches (`?nosw=1`, `__fdbUnregisterSW()`) — **shipped v13.13.1**.                                                                         |

### 1.9 Documentation discipline

| Type                      | Current                                                    | Verdict / Action                                                                       |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| ADRs                      | 39 (38 active, 1 withdrawn)                                | One per non-trivial decision. ADR-021 withdrawn v13.8.2; ADR-037 reserved.             |
| User docs (`docs/`)       | 13 + 24                                                    | Keep. `docs/README.md` is the table of contents.                                       |
| Legacy docs               | `docs/legacy/BestDashBoard.html`                           | Keep archived; never edit.                                                             |
| `CHANGELOG.md`            | per-release                                                | Single source of historical truth. Old sprint logs collapsed to one line per sprint.   |
| `ROADMAP.md`              | this file                                                  | Forward-looking only. Shipped releases live in CHANGELOG.                              |
| `.github/`                | instructions, prompts, agents, skills, copilot config      | Keep; deduplicate against `copilot-instructions.md` (single source of truth).          |
| Architecture diagrams     | `.github/assets/*.svg` + Mermaid in `docs/ARCHITECTURE.md` | Auto-validated against Markdown via `check-mermaid.mjs` (ADR-040, **shipped v13.10**). |
| Inline comments           | sparse, intent-only                                        | Keep. No JSDoc for trivial functions.                                                  |
| Reading-level gate        | `check-reading-level.mjs` shipped                          | Keep.                                                                                  |
| Wiki / GitHub Discussions | none                                                       | **Reject** — `docs/` + ADRs cover it; one canonical source.                            |

### 1.10 Decisions held rejected (consolidated 2026-Q2)

Client framework rewrite · Shadow DOM · user-facing DB · OIDC/passkey/Google/Facebook/Apple auth · 40+ language i18n · pre-commit hooks · WebGPU/WASM hot paths · OPFS structured cache · AGPL · multi-tenant Workers for Platforms · 3rd language (deferred to contributor offer) · pnpm workspace · Husky · Lerna/Nx · hand-rolled bundler · custom auth · Sentry SaaS · Codecov SaaS · Argos CI SaaS · Docker image release · Hyperdrive/Postgres · WebTransport server-side (until CF native) · Open UI `<selectlist>` (until GA) · Bun test runner (until Vitest stalls) · `<dialog>` replacement · ECMAScript decorators · React Server Components · Remix/Next routing.

---

## 2. Competitive Landscape — 2026-Q2

### 2.1 Comparison matrix — 16 peer projects across 4 categories

Categories: **TV/Family dashboards** · **Homelab dashboards** · **News/feed readers** · **Smart-home / monitoring**. Rows are facts at the date listed.

| Dimension             | **FamilyDashBoard v13.13.1**                                                                                                                                          | Homepage             | Dashy             | Homer            | Homarr v2              | Glance           | MagicMirror²       | Beszel           | Dashdot          | NetNewsWire   | Feedly             | Apple Home Hub    | Grafana                         | HASS Lovelace             | Tidbyt             | TRMNL             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------- | ---------------- | ---------------------- | ---------------- | ------------------ | ---------------- | ---------------- | ------------- | ------------------ | ----------------- | ------------------------------- | ------------------------- | ------------------ | ----------------- |
| Audience              | Always-on family TV                                                                                                                                                   | Homelab launcher     | Homelab dashboard | Static startpage | Homelab mgmt           | News dashboard   | Smart-mirror       | Server monitor   | Server monitor   | News reader   | News reader (paid) | Apple smart-home  | SRE/observability               | Smart-home                | Pixel info display | E-ink dashboard   |
| Frontend              | **Vanilla TS strict + Vite 8**                                                                                                                                        | Next.js 15           | Vue 3.5           | Vue 3            | Next.js 15 + Mantine 7 | Go templates     | Node + MM modules  | SvelteKit        | React + Vite     | Swift         | React (closed)     | SwiftUI           | React                           | Lit + Polymer             | Go (HW)            | Vue (HW)          |
| Client deps           | **0 / ~88 KB gzip**                                                                                                                                                   | ~38                  | ~22               | ~12              | ~55                    | 0 (SSR)          | ~15                | ~4               | ~25              | n/a           | unknown            | n/a               | ~120                            | ~65                       | n/a                | n/a               |
| State                 | **In-house Signals (ADR-038) → TC39 Signals**                                                                                                                         | React state          | Pinia             | Vuex             | Zustand                | n/a              | Module bus         | Svelte runes     | React state      | KVO           | unknown            | SwiftUI           | Redux                           | Lit reactive              | n/a                | n/a               |
| Backend               | **Cloudflare Worker (Hono + Valibot)**                                                                                                                                | Node proxy           | Node/Express      | None             | Node + tRPC + Drizzle  | Single Go binary | Node Express       | Single Go binary | Single Go binary | n/a           | Cloud (closed)     | iCloud            | Go monolith                     | Python (HASS core)        | Cloud + device     | Cloud             |
| User database         | **None**                                                                                                                                                              | None                 | None              | None             | SQLite + Drizzle       | None             | None               | SQLite           | None             | SQLite        | Cloud              | iCloud            | many backends                   | SQLite                    | Cloud KV           | Cloud KV          |
| Edge DB / cache       | **KV stale + D1 + DO + Analytics Engine**                                                                                                                             | n/a                  | n/a               | n/a              | Postgres / SQLite      | n/a              | n/a                | SQLite           | n/a              | n/a           | proprietary        | iCloud            | Prometheus / Mimir              | InfluxDB / SQLite         | Tidbyt cloud       | TRMNL cloud       |
| TS strictness         | **strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`**                                                                                                      | strict               | partial           | JS-dominant      | strict                 | n/a              | partial            | strict           | partial          | n/a           | unknown            | n/a               | partial                         | partial                   | n/a                | n/a               |
| Linter                | ESLint 10 + **oxlint** pre-pass                                                                                                                                       | ESLint default       | ESLint default    | None             | ESLint default         | golangci-lint    | ESLint default     | golangci-lint    | ESLint default   | SwiftLint     | unknown            | SwiftLint         | golangci-lint                   | flake8 / mypy             | n/a                | n/a               |
| CSS architecture      | **`@layer` + tokens + Lightning CSS + `@scope` + `light-dark()` + `@property`**                                                                                       | Tailwind 4           | SCSS              | SCSS             | Mantine CSS-in-JS      | Hand CSS         | CSS Modules        | Tailwind 4       | Tailwind 3       | AppKit        | Tailwind           | SwiftUI           | SCSS + Emotion                  | hand CSS                  | n/a                | hand CSS          |
| Tests                 | **4842 unit + Playwright + axe + 54 VR + LHCI + fast-check + Stryker**                                                                                                | Vitest partial       | Vitest partial    | None             | Vitest + PW + Argos    | Go tests         | Minimal            | Go tests         | Partial          | XCTest        | unknown            | XCTest            | Go tests                        | pytest                    | n/a                | n/a               |
| Mutation testing      | **Stryker**                                                                                                                                                           | None                 | None              | None             | None                   | None             | None               | None             | None             | None          | unknown            | None              | None                            | None                      | None               | None              |
| Visual regression     | **Playwright (54 baselines, in-repo)**                                                                                                                                | None                 | None              | None             | Argos CI               | None             | None               | None             | None             | Snapshot      | unknown            | None              | Pixelmatch (partial)            | None                      | None               | None              |
| i18n                  | **Hebrew RTL + English**                                                                                                                                              | 45+                  | 22+               | YAML             | 38+                    | en-only          | 30+                | en-only          | en-only          | 40+           | 25+                | 40+               | 30+                             | 80+                       | en-only            | en-only           |
| Accessibility         | **WCAG 2.2 AA + selected AAA + axe gate**                                                                                                                             | Partial              | Partial           | Unknown          | Partial                | Unknown          | Partial            | Unknown          | Unknown          | VoiceOver     | Unknown            | Apple stack       | Partial                         | Partial                   | n/a                | n/a               |
| Offline / PWA         | **Full SW · 4-tier cache · precache · BG sync · `?nosw=1` escape**                                                                                                    | No                   | Basic PWA         | Installable      | No                     | No               | No                 | No               | No               | Native        | Web stale-only     | Native            | No                              | Partial                   | n/a                | E-ink only        |
| Auth                  | **None (intentional, ADR-002)**                                                                                                                                       | Host/proxy           | Keycloak / basic  | None             | OIDC + passkey         | None             | None               | Email + 2FA      | None             | Apple ID      | Email              | Apple ID          | Many providers                  | Account / OIDC            | Cloud account      | Cloud account     |
| Config                | **UI panel + JSON export + AES-GCM URL share**                                                                                                                        | YAML + Docker labels | YAML + UI         | YAML             | UI drag-drop (DB)      | YAML             | Config.js          | UI (DB)          | Config.js        | UI            | Cloud              | iCloud            | UI + JSON                       | YAML + UI                 | App store          | Web UI            |
| Edge proxy / CORS     | **Worker + KV stale + Valibot + D1 + Analytics Engine + DO rate-limit**                                                                                               | Server proxy         | Proxy chain       | n/a              | tRPC over Next         | n/a              | None               | n/a              | n/a              | None          | proprietary        | iCloud            | Plugin model                    | Add-on model              | n/a                | n/a               |
| Observability         | **Web Analytics + Web Vitals + Error KV + D1 + Reporting API + Prometheus `/api/metrics` + Analytics Engine + diag JSON**                                             | None                 | None              | None             | Sentry (opt)           | Prom endpoint    | None               | Built-in         | Prometheus       | Apple         | proprietary        | Apple             | Prom + OTel                     | Prom + OTel + Loki        | n/a                | Cloud only        |
| Security headers      | **CSP L3 + Trusted Types + COOP/COEP(credentialless)/CORP + Permissions-Policy (28 APIs) + HSTS**                                                                     | NGINX templates      | Varies            | None             | Next defaults          | Go handlers      | None               | Svelte defaults  | Partial          | Apple sandbox | proprietary        | Apple sandbox     | Helm defaults                   | HASS defaults             | n/a                | n/a               |
| Supply-chain          | **SLSA L2 + SBOM (CycloneDX) + Dependabot + Renovate (Actions SHA) + dependency-review + Stryker + SBOM-diff bot** (→ SLSA L3 v14.2)                                  | High (Next churn)    | Medium            | Low              | Very high              | ~0               | Medium             | Low              | Medium           | Apple-signed  | proprietary        | Apple-signed      | Medium                          | High (HASS core)          | Cloud-signed       | Cloud-signed      |
| Reproducibility       | **`dist.zip` + `worker.js`, SLSA-pinned, SBOM/release**                                                                                                               | Docker image         | Docker image      | Static site      | Docker compose         | Single binary    | Node bundle        | Single binary    | Single binary    | Apple-signed  | n/a                | n/a               | Docker / Helm                   | Docker / venv             | Cloud              | Cloud             |
| CI gates              | **tsc + eslint + oxlint + markdownlint + stylelint + vitest + LHCI + axe + VR + bundle + SW + SLSA + commitlint + mutation + container-query audit + mermaid + reading-level** | Docker + tests       | Docker build      | Build            | Build + tests          | Go build + test  | Node build         | Go build + test  | Go build + test  | Xcode tests   | proprietary        | Xcode tests       | Many                            | Many                      | n/a                | n/a               |
| Cold-start TTI        | **< 1.0 s cached / ~1.6 s fresh**                                                                                                                                     | ~2.5 s               | ~3 s              | ~1 s             | ~3.5 s                 | ~300 ms          | ~2 s               | ~500 ms          | ~800 ms          | n/a           | ~2 s               | n/a               | ~3 s                            | ~2 s                      | n/a                | ~1 s              |
| Live-data cards       | **12 deep, provider-adapted, history-backed**                                                                                                                         | 100+ (shallow)       | 50+               | limited          | 30+                    | 12 feed types    | 100+ (shallow)     | Server metrics   | Server metrics   | RSS only      | RSS + ML           | Smart-home only   | unlimited                       | unlimited                 | curated apps       | curated apps      |
| Hostile-network mode  | **`?nosw=1` + corp CSP allowlist + dev unregister helper**                                                                                                            | None                 | None              | None             | None                   | None             | None               | None             | None             | None          | None               | None              | None                            | None                      | None               | None              |
| License               | MIT                                                                                                                                                                   | GPL-3.0              | MIT               | Apache-2.0       | MIT                    | AGPL-3.0         | MIT                | MIT              | MIT              | MIT           | proprietary        | proprietary       | AGPL-3.0                        | Apache-2.0                | proprietary        | proprietary       |
| Unique strength       | Hebrew/Zmanim/Hebcal/Sefaria · TV-3 m · 4-tier offline · zero deps · highest gate density · firewall-aware                                                            | Ecosystem size       | Themeable         | Simplicity       | Feature breadth        | Go footprint     | Mirror form-factor | Go deploy        | Go deploy        | macOS polish  | ML clustering      | Apple integration | Best-in-class panels & alerting | Vast device ecosystem     | Pixel charm        | E-ink + low power |

### 2.2 Patterns harvested (or rejected) — 2026-Q2 expansion

| Pattern                                          | Source             | Verdict                              | Landing                                                                        |
| ------------------------------------------------ | ------------------ | ------------------------------------ | ------------------------------------------------------------------------------ |
| **Cloudflare Vectorize (semantic dedup)**        | Feedly ML          | **Adopt v14.0**                      | Replaces SimHash v2 in news after 30-day shadow run; precision@10 gate.        |
| **Workers AI Llama 4 / multilingual**            | CF 2026 GA         | **Track v14.x**                      | Replace Llama 3.3 only when Hebrew quality measurably better at equal cost.    |
| **DO Hibernatable WebSocket**                    | CF 2025 GA         | **Adopt v14.x**                      | Stocks live + alerts SSE — DO bill drops ~80 % when idle.                      |
| **Cloudflare R2 for asset cache**                | CF 2024 GA         | **Adopt v14.x**                      | Backgrounds + offline shell mirrored; egress = $0.                             |
| **DO Storage SQL (SQLite-in-DO)**                | CF 2025 GA         | **Track**                            | Possible D1 replacement; gate same query latency at lower CPU bill.            |
| **Lit Signals (≈ 1 KB) → in-house**              | Lit team 2025      | **Superseded by ADR-038**            | Zero-dep `signals.ts` mirrors API; one-line swap to TC39 when Stage 4.         |
| **TC39 Signals**                                 | TC39 Stage 3       | **Adopt when polyfill ≤ 1.5 KB**     | Drop-in for in-house signals.                                                  |
| **TC39 Temporal**                                | TC39 Stage 3       | **Adopt when polyfill ≤ 10 KB gzip** | Replaces date math in `hebrew-cal`, `calendar`, `countdown`.                   |
| **CSS `@starting-style`**                        | Browser 2025       | **Shipped v13.9**                    | Replaces JS enter animations on overlays.                                      |
| **CSS Anchor Positioning expansion**             | Browser 2025       | **Shipped v13.15.0**                 | Diag-Overlay (Sprint 6) + Help dialog (Sprint 140) both anchored to `--status-bar-anchor`. |
| **HTTP Early Hints (103) via Worker**            | RFC 8297           | **Adopt v14.x**                      | Push critical CSS + main JS earlier; expected −80 ms TTI.                      |
| **Subresource Integrity (auto-injected)**        | W3C SRI            | **Shipped v13.9**                    | Vite plugin emits `<script integrity="…">` per build.                          |
| **Speculation Rules expansion**                  | Browser 2024       | **Audit v13.x**                      | Verify all SPA-style transitions list `prerender`.                             |
| **Native File System Access**                    | Browser 2024       | **Shipped v13.10**                   | Replaces clipboard for config import/export when supported.                    |
| **CRDT (Yjs ≈ 12 KB)**                           | Yjs 2024           | **Track**                            | Only if WebRTC delta proves insufficient. Hard budget ≤ 12 KB gzip.            |
| **Document Picture-in-Picture (video-news)**     | Browser 2024       | **Gate: 3+ user requests**           | Corner PiP while other cards refresh.                                          |
| **OpenTelemetry from Worker (opt-in)**           | OTel 1.30+         | **Adopt v14.2**                      | Self-host collector on R2 + Workers ingestor; off by default.                  |
| **PR coverage-delta bot (own action)**           | OSS bots           | **Shipped v13.9**                    | Zero SaaS dependency.                                                          |
| **PR SBOM-diff bot (own action)**                | OSS bots           | **Shipped v13.9**                    | Zero SaaS dependency.                                                          |
| **`oxlint` (Rust ESLint, 50–100×)**              | Oxc 2025           | **Shipped v13.13 (ADR-039)**         | Pre-pass before ESLint in CI.                                                  |
| **Biome (formatter + minimal lint)**             | Biome 2.x          | **Track**                            | Re-evaluate v15 when feature parity with Prettier+ESLint reached.              |
| **Rolldown (Vite Rust bundler)**                 | Vite 2026 default  | **Auto-adopt**                       | Zero code change required.                                                     |
| **Bun 1.2 test runner**                          | Bun 2026           | **Track only**                       | Vitest 4.1 ecosystem leads.                                                    |
| **Mermaid pre-commit validator**                 | Internal           | **Shipped v13.10 (ADR-040)**         | All architecture diagrams validated in CI.                                     |
| **Container-query audit script**                 | Internal           | **Shipped v13.10**                   | `check-container-queries.mjs` blocks viewport `@media` in card CSS.            |
| **Argos CI visual regression**                   | Homarr v2          | **Superseded**                       | Playwright in-repo baselines; zero SaaS dependency.                            |
| **Drizzle / tRPC / Mantine / Next / React**      | Homarr v2          | **Reject (4th reconfirm)**           | Contradicts zero-dep, no-DB, no-framework lines.                               |
| **OIDC / passkey / OAuth (Google/FB/Apple)**     | Homarr v2 / Beszel | **Reject**                           | Static client-only PWA; auth would require a backend session store.            |
| **AGPL copyleft**                                | Glance / Grafana   | **Reject**                           | MIT aligns with family-project distribution.                                   |
| **Native Bluetooth / sensor APIs**               | MagicMirror²       | **Reject**                           | Permissions-Policy denies them.                                                |
| **WebGPU on stocks**                             | Browser 2025       | **Reject**                           | SVG charts ≤ 30 KB; no perf problem.                                           |
| **Multi-tenant Workers for Platforms**           | CF 2024            | **Reject**                           | Single household.                                                              |
| **`pnpm` workspace**                             | pnpm 2024          | **Reject**                           | npm + parent-workspace pattern is sufficient and simpler.                      |
| **Grafana panel grammar (data-source plugin)**   | Grafana            | **Reject**                           | Plugin loader ≥ 30 KB; our 12 cards are statically authored.                   |
| **HASS Lovelace card YAML model**                | HASS               | **Reject**                           | YAML editor adds parsing surface for zero gain on a 12-card SPA.               |
| **HASS `custom_component` ecosystem**            | HASS               | **Reject**                           | We are not a platform.                                                         |
| **Tidbyt pixel-art aesthetic**                   | Tidbyt             | **Reject**                           | TV-3 m readability is the opposite design pressure.                            |
| **TRMNL e-ink cadence (15-min refresh)**         | TRMNL              | **Inspire**                          | Already aligned with our card TTLs; documented in `docs/data-sources.md`.      |
| **Dashing/Smashing widget bus pattern**          | Smashing           | **Reject**                           | Server-push bus would break our offline-first model.                           |
| **Grafana variable templating**                  | Grafana            | **Reject**                           | Adds DSL to a static SPA; user config UI suffices.                             |
| **NetNewsWire SwiftData sync**                   | NNW 2024           | **N/A**                              | Apple-only; no cross-platform equivalent worth shipping.                       |
| **Feedly ML clustering**                         | Feedly             | **Adopt v14.0**                      | Vectorize embeddings (above) is the open-stack equivalent.                     |
| **Apple Home Hub continuity**                    | Apple              | **Inspire**                          | Mirrors our WebRTC mirror direction (gated v14.x); auth-free, peer-to-peer.    |
| **HASS automation YAML**                         | HASS               | **Reject**                           | We are not an automation platform.                                             |

### 2.3 Our protected unique strengths

1. **Zero runtime deps on the client** — peers ship 30–55; we ship 0.
2. **TV-first at 3 m viewing distance** — no peer targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 provider-adapted cards with normalized history + stale fallback** — depth over breadth.
5. **4-tier offline cache + dev escape hatches** — no peer renders a useful dashboard offline _and_ provides a `?nosw=1` opt-out for hostile networks.
6. **4842 tests + axe + VR + LHCI + Stryker + SLSA + container-query audit + mermaid validator** — highest gate density in the matrix.
7. **Production observability without tracking cookies** — RUM + Vitals + Errors + Reports + Analytics Engine + Prometheus.
8. **Reproducible single-artifact release** — `dist.zip` + `worker.js`, SLSA-pinned, SBOM per release, SBOM-diff bot per PR.
9. **Hostile-network resilience** — explicit corp-proxy CSP allowlist, SW unregister helper, file-protocol launch path. No peer ships this.
10. **Static-PWA constraint discipline** — no auth, no server, no DB. Reaffirmed every release.

---

## 3. Improvement Backlog — Rewrite / Refactor / Enhance

Concrete work items. **P** = priority (P0 next-release blocker, P1 same-cycle, P2 opportunistic). **E** = effort (S ≤ 1 day, M 2–5 days, L > 5 days). **I** = impact (Hi/Mid/Lo).

| #   | Type     | Item                                                                                                | P   | E   | I   | Target  | Notes                                                                |
| --- | -------- | --------------------------------------------------------------------------------------------------- | --- | --- | --- | ------- | -------------------------------------------------------------------- |
| 1   | ~~Refactor~~ | ~~Migrate `state.ts` call sites to in-house `signals.ts` (ADR-038) — card-at-a-time~~ | P0  | L   | Hi  | ~~v14.0~~ **Done** | ✅ Sprint 140/141: motivationInterval signal added; fdb-motivation.ts migrated. 100% of reactive config call sites now on signals (weather.ts + fdb-motivation.ts). screenMode + alertsEnabled signals added for future consumers. |
| 2   | Rewrite  | Replace SimHash v2 news dedup with Cloudflare Vectorize embeddings                                  | P0  | L   | Hi  | v14.0   | 30-day shadow + precision@10 gate.                                   |
| 3   | Refactor | Replace ad-hoc date math with Temporal in `hebrew-cal`/`calendar`/`countdown` once polyfill ≤ 10 KB | P1  | M   | Mid | v14.x   | Gate by polyfill size.                                               |
| 4   | Enhance  | `@vitest/browser` for `maximize.ts` + `layout-drag.ts` (DOM-heavy)                                   | P1  | M   | Mid | v14.0   | happy-dom doesn't model FLIP correctly.                              |
| 5   | Enhance  | DO Hibernatable WebSocket for stocks live + alerts SSE                                              | P1  | M   | Hi  | v14.x   | ~80 % DO bill drop when idle.                                        |
| 6   | Enhance  | R2 mirror for backgrounds + offline shell                                                           | P2  | M   | Mid | v14.x   | egress = $0.                                                         |
| 7   | ~~Enhance~~ | ~~HTTP Early Hints (103) from Worker~~ | P1  | S   | Mid | ~~v14.x~~ **Done** | ✅ Sprint 122 (v13.14.0): `worker/src/middleware/early-hints.ts` preloads 6 API endpoints via `Link` headers on eligible GET responses. |
| 8   | ~~Enhance~~ | ~~Coverage ratchet 89/81/89/90 → 92/85/92/93~~ | P0  | M   | Mid | ~~v14.0~~ **Done** | ✅ Sprint 143 (v13.15.0): thresholds raised to 93.5/85.0/92.5/94.7 — all targets exceeded. Actuals: 93.62/85.40/92.63/94.87. |
| 9   | ~~Enhance~~ | ~~Stryker scope: error-tracker + config + diag, threshold ≥ 85 %~~ | P1  | M   | Mid | ~~v14.0~~ **Done** | ✅ Sprint 126: error-tracker + config + diag confirmed in scope; break threshold raised 75 → 85. |
| 10  | ~~Enhance~~ | ~~Cross-doc View Transitions for theme switch + maximise-card~~ | P1  | S   | Lo  | ~~v14.0~~ **Done** | ✅ v13.13: `<meta name="view-transition" content="same-origin">` + `src/ui/maximize.ts` L2 VT types + `src/ui/theme.ts` brightness-flash keyframes. |
| 11  | ~~Enhance~~  | ~~Anchor Positioning for Diag-Overlay + Help dialog~~                                             | P2  | S   | Lo  | ~~v14.0~~ **Done** | ✅ Sprint 6 (diag-overlay) + Sprint 140 (help dialog), both anchored to `--status-bar-anchor`. |
| 12  | Refactor | Annual vendor-neutrality build drill (Deno Deploy + Bun Deploy + fly.io)                            | P1  | L   | Hi  | v14.0   | First run unlocks ADR-031.                                           |
| 13  | Enhance  | OpenTelemetry from Worker (opt-in, self-host collector)                                             | P2  | L   | Mid | v14.2   |                                                                      |
| 14  | Enhance  | SLSA L3 hermetic build + Sigstore/cosign provenance                                                 | P0  | L   | Hi  | v14.2   | ADR-035. Third-party rebuilder must produce byte-identical artefact. |
| 15  | Refactor | Promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding                                | P1  | M   | Hi  | v14.1   | Cross-project release gate.                                          |
| 16  | Refactor | Add ECB direct as 3rd currency fallback                                                             | P2  | S   | Lo  | v14.x   | Provider redundancy.                                                 |
| 17  | ~~Enhance~~ | ~~Calendar fuzz-case set 204 → 250+~~ | P2  | S   | Lo  | ~~v14.0~~ **Done** | ✅ Sprint 128: 258 tests confirmed (>250). RFC-5545 edge cases complete. |
| 18  | Enhance  | Visual-regression baselines 54 → 80+ (DO-SSE + video-news + maximise-FLIP + 21-day cal + 4×2 wx)    | P1  | M   | Mid | v14.0   |                                                                      |
| 19  | Enhance  | LHCI perf threshold `warn 0.70` → `error 0.97` once Early Hints + SRI ship and CI runner stable     | P1  | S   | Mid | v14.x   | Sprint 147: ratcheted warn 0.70→0.80 (Sprint 124) → **0.85** (v13.16.0). Final `error 0.97` at v14.x. |
| 20  | ~~Refactor~~ | ~~`exactOptionalPropertyTypes` migration audit~~ | P2  | M   | Lo  | ~~v14.x~~ **Done** | ✅ Sprint 148 (v13.16.0): enabled. 15 errors fixed — all `prop?: T` → `prop?: T \| undefined`. |
| 21  | Enhance  | WebRTC mirror with QR pairing (gated: 3+ user requests)                                             | P2  | L   | Mid | v14.x   | ADR-036.                                                             |
| 22  | Enhance  | Document Picture-in-Picture for video-news (gated: 3+ user requests)                                | P2  | S   | Lo  | v14.x   |                                                                      |
| 23  | ~~Enhance~~ | ~~`vite-plugin-dev-csp-strip` — relax CSP only in dev mode~~ | P2  | S   | Mid | ~~v14.0~~ **Done** | ✅ Sprint 127: `stripDevCsp` plugin already in `vite.config.ts` (`apply: "serve"`). Companion to `?nosw=1` for corp-proxy devs. |
| 24  | ~~Enhance~~ | ~~Smart-contrast audit — verify all 6 themes use `var(--text-primary)` exclusively (no hardcoded `#fff`/`#000`)~~ | P1  | S   | Mid | ~~v14.0~~ **Done** | ✅ Sprint 125: `node scripts/check-smart-contrast.mjs` → 0 violations across 37 CSS files. |
| 25  | Refactor | Narrow CSP `https://*.intel.com` wildcard to specific corp hosts when alternatives surface          | P2  | S   | Lo  | v14.x   |                                                                      |
| 26  | Enhance  | OWASP Top 10 audit (rotate per major release)                                                       | P0  | M   | Hi  | v14.0   | Auto-rotated checklist in `.github/instructions/security-audit.md`.  |

**Anti-backlog** (deliberately not on the list, to stop perennial re-litigation): React rewrite · Shadow DOM · auth (Google/FB/Apple/OIDC/passkey) · user DB · Sentry · Codecov SaaS · Argos CI SaaS · pnpm · Husky · Bun runtime · Docker artefact · 3rd language until contributor offer · WebGPU/WASM hot paths · ECMAScript decorators · React Server Components · Remix/Next routing · GraphQL · gRPC.

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
- [x] `oxlint` as fast pre-pass (~50–100× ESLint) (v13.13).
- [x] `markdown-link-check` monthly cron (v13.13).
- [x] Cross-doc View Transitions opt-in via `<meta name="view-transition">` (v13.13).
- [x] Smart text contrast via corrected `light-dark()` token order (v13.13.1).
- [x] Dev-mode SW kill switches (`?nosw=1`, `__fdbUnregisterSW()`) (v13.13.1).
- [x] `@vitest/browser` component tests for `maximize.ts` + `layout-drag.ts`. (v13.16.0, Sprints 145–146)
- [x] CSS Anchor Positioning expansion (Diag-Overlay + Help dialog). (v13.15.0)
- [x] Cross-doc View Transitions for theme switch + maximise-card.
- [x] Stryker scope extension: error-tracker + config + diag, threshold ≥ 85 % (Sprint 126).
- [x] Coverage ratchet: 89/81/89/90 → 93.5/85.0/92.5/94.7. (Sprint 143, v13.15.0)
- [x] `vite-plugin-dev-csp-strip` for proxy-blocked devs (Sprint 127).

**Exit**: oxlint green on first pass; CI deltas live; coverage at 92/85/92/93; LHCI perf back to `error ≥ 0.97`.

### 4.2 V14-SEMANTIC — Replace heuristics with embeddings & Signals

Target: **v14.0** (Q1–Q2 2027).

- [x] In-house `signals.ts` shipped (ADR-038).
- [ ] Cloudflare Vectorize semantic news dedup (30-day shadow → SimHash retire after precision@10 gate).
- [x] `state.ts` → `signals.ts` migration ≥ 50 % of call sites (100 % achieved — Sprint 140/141).
- [ ] TC39 Signals one-line swap when polyfill ≤ 1.5 KB and Stage 4.
- [ ] TC39 Temporal in `hebrew-cal`/`calendar`/`countdown` when polyfill ≤ 10 KB gzip.
- [x] HTTP Early Hints (103) from Worker — push critical CSS + main JS earlier. (v13.14.0, Sprint 122)

**Exit**: Vectorize precision@10 ≥ SimHash + 15 %; signals migration ≥ 50 % of `state.ts` call sites; LHCI perf ≥ 0.98 cached.

### 4.3 V14-CONTINUITY — Cross-device without auth (gated)

Target: **v14.x** (gated by 3+ user requests).

- [x] AES-GCM encrypted config URL export.
- [x] Import flow + `docs/sync.md`.
- [ ] WebRTC mirror — short-lived (5 min) QR-pairing data channel, STUN-only, no TURN, no relay. Valibot on incoming delta. ADR-036.
- [ ] CRDT (Yjs) — _track only_. Adopt only if WebRTC delta insufficient AND Yjs core ≤ 12 KB gzip.

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

- [ ] Hermetic build via reproducible toolchain pin (`actions/setup-node@v4` SHA-pinned, npm `--ignore-scripts`).
- [ ] Sigstore/cosign signature on `dist.zip` + `worker.js`.
- [ ] Third-party rebuilder GitHub Action verifies byte-identical output across two runners.
- [ ] npm + GitHub Actions provenance attached to release.
- [ ] CSP `require-trusted-types-for 'script'` enforcement audit in production logs.
- [ ] OWASP Top 10 rotation checklist — automate per major release.

**Exit**: SLSA L3 attestation green; cosign verify passes; rebuilder hashes match.

### 4.7 V14-RESILIENCE — Hostile-network & dev-experience

Target: **v14.0** (Q1 2027).

- [x] `?nosw=1` URL flag bypasses SW registration (v13.13.1).
- [x] `globalThis.__fdbUnregisterSW()` DevTools helper (v13.13.1).
- [x] CSP `connect-src` allowlist widened with `https://*.intel.com` for corp-proxy environments (v13.13.1).
- [x] `vite-plugin-dev-csp-strip` — relax CSP only in dev mode for proxy-blocked devs (Sprint 127).
- [x] Per-card "blocked by network" diagnostic toast (instead of silent failure) (Sprint 136).
- [x] `docs/local-dev.md` corp-proxy quickstart section (Sprint 135).

**Exit**: developer behind a hostile firewall can iterate on every card without disabling CSP globally; no SW serves stale offline-fallback HTML when the user opted out.

### 4.8 V15-OPEN — Long-horizon (2027 Q4 →)

- [ ] Streams API for news ingestion (gated: measurable perceived-TTI win).
- [ ] WebTransport server-side once Cloudflare ships native support.
- [ ] DO Storage SQL evaluation as D1 replacement.
- [ ] Lightning CSS validation as sole CSS lint (drop Stylelint) once rule-set parity confirmed.
- [ ] TS7 (Go-rewrite) primary typecheck once stable + zero behavioural delta.

---

## 5. Release Cadence & Gates

| Phase    | Gate                                           | Action on red                                                       |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Pre-PR   | tsc · eslint · oxlint · prettier · stylelint   | Fix locally before push.                                            |
| PR       | vitest · LHCI · axe · VR · bundle delta · SBOM | One reviewer (self) — block on any red gate.                        |
| Pre-tag  | `.github/instructions/pre-release.instructions.md` checklist | All zero-tolerance items must pass; no `@ts-ignore`, no `eslint-disable`. |
| Post-tag | release.yml workflow                           | Watch for `dist.zip` artefact + SBOM + cosign signature.            |
| Post-prod | RUM Web Vitals + diag JSON + Prom `/api/metrics` | Regression > 10 % triggers patch within 24 h.                       |

**Versioning**: SemVer. Major = breaking config schema (rare), Minor = new card or worker route, Patch = bug fix or polish (current cycle).

---

## 6. Open Questions (Re-litigated quarterly)

1. **When does TC39 Signals reach Stage 4 + a polyfill ≤ 1.5 KB?** Target adoption v14.x.
2. **When does TC39 Temporal land a polyfill ≤ 10 KB gzip?** Replace ad-hoc date math.
3. **Will Cloudflare Pages match Workers TTI at zero cost differential?** Migration gated.
4. **Should `https://*.intel.com` wildcard narrow once we leave the corp environment?** Quarterly review.
5. **Is the LHCI `warn 0.70` floor sustainable, or should we bracket it tighter (`warn 0.85`) before the v14.x re-tighten?** Re-evaluate after CI runner upgrade.
6. **Should we add a `?dev=1` mega-flag that bundles `?nosw=1` + dev CSP strip + verbose diag?** Track user demand.
7. **Is 21-day calendar (3 weeks) the right horizon, or should it be configurable (1/2/3/4 weeks)?** Track user demand.
8. **At what tested-card count does the `weather` 4×2 detail grid exhaust readability on a 65″ TV at 3 m?** Visual-regression check at v14.0.

---

## 7. Pointers

- **History**: [CHANGELOG.md](../CHANGELOG.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **ADRs**: [adr/README.md](./adr/README.md)
- **Data sources**: [data-sources.md](./data-sources.md)
- **Local dev**: [local-dev.md](./local-dev.md)
- **Sync (config-share)**: [sync.md](./sync.md)
- **Security**: [security.md](./security.md)
- **Privacy**: [privacy.md](./privacy.md)
