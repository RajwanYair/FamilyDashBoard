# FamilyDashBoard — Strategic Roadmap (Deep-Rethink v2)

> **Refresh date**: 2026-05-05 · **Shipped baseline**: v14.0.0 (Sprint 429) · **Active streams**: V14-FOUNDATIONS, V14-SEMANTIC, V14-CONTINUITY, V14-EDGE, V14-AGENTIC, V15-OPEN.
>
> **Inventory**: 6240 tests / 203 suites / 0 failures · 0 lint errors · 0 lint warnings · 0 `eslint-disable` · 0 `@ts-ignore` · 73 ADRs · 0 client deps · 2 worker deps (Hono + Valibot) · 6 themes · 12 cards · 4-tier offline cache · Worker ≤ 75 KB gzip · LHCI perf `error 0.97` · SLSA L2 + Sigstore + rebuilder manifest.
>
> **Purpose**: a forward-looking, first-principles plan. Every paragraph is a decision, gate, or trigger. Historical sprints live in [CHANGELOG.md](../CHANGELOG.md) — this file is **what's next, only**.
>
> **Bar**: best-in-class for an always-on family TV dashboard, harvested by direct comparison against the best peer in each category, no grandfathering of past decisions, no decoration.

---

## 0. Executive Summary

After 326 sprints across v10 → v13.33 the project sits on a stable, opinionated, production-hardened plateau. v14-CARD-SETTINGS, v14-CROSS-CARD synergies (X1–X15), and the per-card depth backlog (§3 of the v1 roadmap) are **shipped**. The quality gate is industry-leading for a static-PWA: 6240 tests, 65 fast-check property suites across 13 modules, container-query-only audit, mermaid validator, reading-level gate, smart-contrast audit, vendor-neutrality drill active.

The v14 → v17 frontier is no longer breadth or feature catch-up. It is six things:

1. **Replace heuristics with semantics** — Vectorize embeddings (news, owned shadow run); TC39 Temporal once polyfill ≤ 10 KB; TC39 Signals one-line swap once ≤ 1.5 KB; on-device WebNN inference for motivation/news where it preserves zero-PII.
2. **Push observability + supply chain to industry leadership** — SLSA L3 hermetic builds (v14.2), opt-in OpenTelemetry from Worker (v14.2), Cloudflare Snippets / Trusted Execution audit, third-party rebuilder verification, automated SBOM diff.
3. **Cross-device continuity without auth or DB** — WebRTC mirror with QR pairing (gated, ADR-049), CRDT (Yjs ≤ 12 KB) only if WebRTC delta proves insufficient, opt-in Web Push for alerts on phone (Cloudflare Workers VAPID).
4. **Resilience behind hostile networks** — preserve `?nosw=1`, corp-CSP allowlist, file-protocol launch; layer in Compute Pressure API, Storage Buckets, Origin-Agent-Cluster.
5. **Agentic dashboard** — expose the dashboard as an MCP server (read-only) so users' AI assistants can query "what's on today" without scraping. Privacy boundary: localhost-only, no cloud egress.
6. **Mono-repo harvest** — promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding so all four repos share one quality gate.

Streams are scoped tight. Each one ships in 5–15 sprints with a hard exit gate. No dangling P3 backlog.

### 0.1 Engineering Discipline (Non-Negotiable)

Five meta-rules that override all feature pressure. Sourced from the project's genesis quality directive; reaffirmed at every major release.

1. **No suppression, waivers, or workarounds.** Fix root causes. If genuinely unavoidable, document in an ADR with a production-safe rationale — never just disable a check.
2. **No suspended / disabled / deprecated / commented-out code in production.** If it exists for a real reason, it belongs to the correct production approach with an ADR. If not, delete it.
3. **No dead artifacts.** Dead code, dead docs, dead configs, unused scripts, stale examples — remove them. Everything in the repository must be wired, coherent, and current.
4. **Reproducibility first.** Deterministic builds (SHA-pinned Actions), pinned tool versions, documented setup steps, and an annual third-party rebuilder drill (D15 — see §6.8).
5. **Forward-only history.** This document records only what is _next_. Completed work is deleted from here and moved to `CHANGELOG.md`.

---

## 1. Stack-Level First-Principles Re-Litigation (2026-Q2 refresh)

Stamps: **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, **Track**, **Supersede**.

### 1.1 Code language & TypeScript posture

| Decision                                                   | Verdict                  | Action                                                            |
| ---------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| TypeScript strict + nUII + vMS + eOPT                      | **Keep (load-bearing)**  | Annual posture review only. Rust → WASM rejected (bundle floor).  |
| TypeScript 6.0.3                                           | **Keep**                 | Track 6.1+ on parent `MyScripts/`.                                |
| TypeScript 7 (Go-rewrite, `tsgo`)                          | **Track for v15**        | Promote to primary typecheck only on stable + zero behaviour delta. |
| `// @ts-check` on `.mjs`                                   | **Shipped v13.9**        | All `scripts/*.mjs` opt-in via `tsconfig.scripts.json`.            |
| Vanilla JS escape hatches                                  | **Reject**               | TS strict everywhere; no `.js` source.                            |
| ECMAScript decorators (Stage 3)                            | **Reject (reconfirmed)** | Adds parse cost + transpile risk for zero functional gain.        |
| `tsgo` informational pre-pass                              | **Withdrawn (ADR-021)**  | Re-evaluate only when `tsgo` can replace `tsc` outright.          |

### 1.2 Frontend architecture & UI

| Decision                                            | Verdict                           | Action                                                                                       |
| --------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| Vanilla DOM + `FdbCard` (no framework)              | **Keep (6th reconfirm)**          | No peer benefit we lack. Smallest framework floor still ≥ 30 KB gzip vs. our ~12 KB runtime. |
| Shadow DOM                                          | **Reject (ADR-001)**              | `@scope` gives encapsulation without breaking global `@layer` theming.                       |
| Zero client deps (ADR-002)                          | **Keep (load-bearing)**           | Polyfills count against the ceiling.                                                         |
| In-house `signals.ts` (ADR-038)                     | **Keep**                          | One-line swap to TC39 Signals when polyfill ≤ 1.5 KB and Stage 4.                            |
| Date math (ad-hoc + `Intl`)                         | **Replace v14.x**                 | TC39 Temporal once polyfill ≤ 10 KB gzip — gate `hebrew-cal`, `calendar`, `countdown`.       |
| View Transitions L1 (same-doc)                      | **Keep**                          | Theme + config-panel + maximise-FLIP shipped.                                                |
| View Transitions L2 (cross-doc)                     | **Adopted v13.29**                | Expand to maximise-card flow.                                                                |
| CSS `@layer` + tokens + `light-dark()` + `@property` | **Keep**                          | Tailwind 4 / CSS-in-JS rejected — would break the 6-theme token system.                      |
| `@starting-style`, Anchor Positioning, `@scope`     | **Shipped v13.9–v13.15**          | Audited every release.                                                                       |
| Container-Queries-only layout                       | **Shipped v13.10**                | CI guard blocks viewport `@media` in card CSS.                                               |
| Lightning CSS                                       | **Keep (ADR-017)**                | Re-evaluate v15 if esbuild-css gains nesting + custom-property fallback at parity.           |
| Subresource Integrity auto-injection                | **Shipped v13.9**                 | `injectSri` Vite plugin.                                                                     |
| HTTP Early Hints (103) from Worker                  | **Shipped v13.14**                | ~80 ms TTI improvement.                                                                      |
| Document Picture-in-Picture (video-news)            | **Gate: 3+ user requests**        | ADR-045.                                                                                     |
| Streams API for news ingestion                      | **Defer v15**                     | Quantify perceived-TTI win first; current p95 already < 1.0 s cached.                        |
| `<selectlist>` + Open UI                            | **Reject**                        | `<dialog>` is GA; Open UI experimental.                                                      |
| Speculation Rules API (prerender)                   | **Track v14.x**                   | Worth audit on the help / config panels; gate by bundle delta < 1 KB.                        |
| `popover=` attribute                                | **Adopt v14.x**                   | Harvest for diag toasts + bookmark menu; replaces ad-hoc focus traps.                        |
| **WebNN (on-device inference)**                     | **Track v15**                     | News rerank + motivation curator on-device once Chrome ships GA + falls back gracefully.     |
| **CSS `@function`**                                 | **Track**                         | Theme tokens may compress 20% once Chrome ships GA.                                          |
| **CSS `if()`**                                      | **Adopt v14.x**                   | Replaces some token-based light-dark gymnastics.                                             |

### 1.3 Backend architecture & edge

| Decision                                            | Verdict                           | Action                                                                                                  |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cloudflare Worker (ADR-003)                         | **Keep**                          | Annual vendor-neutrality drill (ADR-031) — rebuild on Deno Deploy + Bun Deploy + fly.io once per major. |
| Hono + Valibot                                      | **Keep**                          | ~25 KB win over Zod retained; Hono routing < 8 KB.                                                      |
| KV stale cache (per route)                          | **Keep (ADR-013)**                | Annual TTL review against `worker/openapi.yaml`.                                                        |
| D1 telemetry                                        | **Audit v15**                     | Compare DO Storage SQL + Workers Analytics Engine for the same workload.                                |
| **DO Hibernatable WebSocket** (stocks live + alerts) | **Adopt v14.x (ADR-047)**         | ~80 % bill drop when idle; replaces HTTP poll + SSE.                                                    |
| **R2 for asset cache**                              | **Adopt v14.x (ADR-050)**         | Backgrounds + offline shell mirrored; egress = $0.                                                      |
| Workers Queues (error fan-out)                      | **Shipped v13.0**                 | —                                                                                                       |
| Email Workers weekly digest                         | **Shipped v13.0 (opt-in)**        | —                                                                                                       |
| Workers AI (Llama 3.3 8B Hebrew)                    | **Track Llama 4 v14.x**           | Switch only when Hebrew quality measurably better at equal cost.                                        |
| **Cloudflare Vectorize (semantic news dedup)**      | **Adopt v14.0 (ADR-052)**         | Shadow-mode active since Sprint 267; 30-day precision@10 ≥ +15 % gate.                                  |
| Hyperdrive / Postgres                               | **Reject (reconfirmed)**          | No relational store in stack.                                                                           |
| User-facing DB                                      | **Reject (5th reconfirm)**        | LS + IDB + JSON export + AES-GCM URL share cover it.                                                    |
| Worker bundle budget ≤ 75 KB gzip                   | **Keep ceiling**                  | Tightening to 60 KB rejected — leaves no room for DO Storage SQL adapter.                               |
| **OpenTelemetry from Worker (opt-in)**              | **Adopt v14.2**                   | Self-hosted collector on R2 + Workers ingestor; off by default.                                         |
| **Cloudflare Snippets**                             | **Track v14.x**                   | Move static header injection out of Worker once Snippets ships TEE.                                     |
| WebTransport / HTTP/3 push                          | **Defer**                         | DO Hibernatable WebSocket has same UX at known cost.                                                    |
| File-protocol launch (`dist/index.html`)            | **Shipped v13.13**                | `--base ./` + `removeCrossOrigin` Vite plugin.                                                          |
| Dev-mode CSP relaxation                             | **Shipped (Sprint 127)**          | `vite-plugin-dev-csp-strip` removes meta in `serve` mode only.                                          |
| **MCP server (read-only) for AI assistants**        | **Adopt v14.x (NEW, see §1.11)**  | Localhost-only; surface "today's signals" so user agents can ask without scraping.                      |
| **Web Push (VAPID) for alerts on phone**            | **Gate: 3+ user requests v14.x**  | Worker-side VAPID; opt-in; never tracks; only fires for `alerts` card severity ≥ rocket.                |

### 1.4 Data plane & external APIs

Cross-cutting rules unchanged: every external response is **Valibot-validated**, **KV-stale-cached**, has a **per-route TTL** documented in `worker/openapi.yaml`, **falls back to a stale tier on failure**, has a **page-visibility guard** at top of every loader, **try/catch + proxy fallback chain** on every fetch, **`diagLog()` on every error**.

| Card        | Provider chain                                                  | Open work                                                                                                |
| ----------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| news        | RSS aggregator → SimHash v2 → (v14) Vectorize → Llama 3.3       | Vectorize 30-day shadow run before SimHash retire (gate: precision@10 +15 %).                            |
| weather     | Met Norway + NWS (US travel) + Open-Meteo                       | Add **IMS (Israel Met Service)** native source — primary for Hebrew users when geo ∈ IL.                 |
| stocks      | Yahoo + Finnhub HTTP                                            | Add **TASE (Tel-Aviv Stock Exchange)** native source for `.TA` suffix tickers; DO Hibernatable WS upgrade. |
| currency    | exchangerate.host + open.er-api + Frankfurter + ECB             | Add **Bank of Israel direct** native source as `ILS` authoritative rate.                                 |
| calendar    | iCal (RFC-5545) + Google Calendar feed                          | Stable; revisit CalDAV write-path only if user pressure accumulates.                                     |
| hebrew-cal  | Hebcal + Zmanim + Sefaria                                       | Replace internal date math with Temporal when polyfill ≤ 10 KB gzip; add **OpenSiddur** parashat haftarah audio link (gated). |
| alerts      | Pikud Ha-Oref + Tzeva-Adom + DO SSE                             | DO Hibernatable upgrade v14.x; opt-in Web Push to phone (gate).                                           |
| motivation  | Local curator + Workers AI Hebrew quote                         | Add **WebNN on-device curator** once Chrome GA so Hebrew quotes never round-trip.                        |
| tasks       | Local IDB                                                       | Optional CRDT sync gate (Yjs ≤ 12 KB).                                                                    |
| system-info | `navigator.connection` + battery + memory + UA-CH high-entropy + Storage Buckets | Add **Compute Pressure API** tile; Storage Buckets audit.                                |
| countdown   | Local                                                           | Stable.                                                                                                   |
| video-news  | Embed allowlist only                                            | Document PiP gate: 3+ user requests.                                                                     |

### 1.5 Storage / database / infrastructure

| Tier                  | Current                                                        | Verdict / Action                                                                  |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Browser L1            | In-memory `Map`                                                | **Keep**                                                                          |
| Browser L2            | `localStorage` (`dash_v2_*`)                                   | **Keep** — OPFS lacks LRU eviction story.                                         |
| Browser L3            | IndexedDB ≤ 50 MB LRU                                          | **Keep** — SQLite-WASM ≈ 1.5 MB blows ceiling.                                    |
| Browser L4            | Service Worker cache (7 origins)                               | **Keep**                                                                          |
| **Browser L5 (NEW)**  | **Storage Buckets (per-card eviction policy)**                 | **Adopt v14.x** — let `news` evict before `tasks`; aligns with our LRU intent.    |
| Edge cache            | Cloudflare KV (per-route)                                      | DO Storage SQL **audit v15**.                                                     |
| Edge analytics        | D1 + Analytics Engine                                          | **Keep**, audit v15 against Workers Logs.                                         |
| Edge object           | (none)                                                         | **Adopt R2 v14.x** for backgrounds + offline shell.                               |
| User-owned config     | LS + IDB + JSON export + AES-GCM URL                           | **Reject cloud DB (5th reconfirm)**.                                              |
| Reproducible artefact | `dist.zip` + `worker.js` (SLSA L2 → L3)                        | **Keep** — Docker adds OS surface for zero benefit on a static SPA.               |

### 1.6 Tooling & versions

| Tool                  | Current                  | Action                                                                            |
| --------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| Node.js               | 24 LTS                   | Track 26 LTS (Oct 2027).                                                          |
| TypeScript            | 6.0.3                    | Track minor monthly; TS7 only when zero-delta.                                    |
| Vite                  | 8                        | Auto-adopt 9 + Rolldown when default.                                             |
| Vitest                | 4.1.5                    | Auto-adopt 4.2; track 5.x.                                                        |
| ESLint                | 10                       | Pair with `oxlint` fast pre-pass (ADR-039).                                       |
| Prettier              | 3.x                      | **Track Biome 2.x**; switch only on TS+MD+JSON+YAML parity.                       |
| Stylelint             | 16.x                     | Keep; consider Lightning-CSS-only validation v15.                                 |
| Playwright            | 1.5x                     | Quarterly baseline regen.                                                         |
| Stryker (mutation)    | 8.x                      | Threshold ≥ 85 %; extend to error-tracker + config + diag (shipped) + provider-health. |
| `fast-check`          | 3.x                      | 55 property suites; extend to worker-client envelope invariants v14.x.            |
| `axe-core`            | latest                   | Keep CI gate.                                                                     |
| Lighthouse CI         | latest                   | Tightened to `error 0.97`; ratchet to `0.98` cached v14.x.                        |
| `pnpm` workspace      | npm + parent             | **Reject** — current pattern is sufficient and simpler.                           |
| Husky / Lefthook      | none (CI is the gate)    | **Reject** — pre-commit hooks slow contributors.                                  |

### 1.7 Testing strategy

| Layer            | Tooling                                | Action                                                                            |
| ---------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| Unit             | Vitest 4.1 + happy-dom 20              | Keep. Suite split per file.                                                       |
| Component        | `@vitest/browser` (Playwright)         | Shipped v13.16.                                                                   |
| Property-based   | fast-check (55 suites, ADR-054/055)    | Extend to worker-client envelope invariants v14.x.                                |
| Mutation         | Stryker                                | Threshold ≥ 85 %.                                                                 |
| Visual regression | Playwright (108 baselines)             | Extend to DO-SSE alert states + maximise-FLIP.                                    |
| End-to-end       | Playwright                             | Keep.                                                                             |
| Accessibility    | axe-core (CI gate)                     | Keep + manual screen-reader pass per major.                                       |
| Performance      | Lighthouse CI (`error 0.97`)           | Tighten to `0.98` cached v14.x.                                                   |
| Coverage         | 93.0/84.6/92.0/94.5                    | Ratchet path → 95/90/95/96 by v15. +0.5 % per minor release.                      |

### 1.8 Observability, security, supply chain

| Area | Action |
| ---- | ------ |
| Obs  | **OpenTelemetry from Worker (opt-in, v14.2)**. Diag schema v1 → v2 only if needed. |
| Obs  | SLO dashboard (Grafana free tier or self-hosted) — gate: > 100 K req/day. |
| Sec  | **SLSA L3 hermetic build (ADR-035)** — first shipped v14.2. Sigstore/cosign per release. |
| Sec  | Subresource Integrity auto-injected (shipped v13.9). |
| Sec  | Secret rotation per major release. Reporting API sampling audit annually. |
| Sec  | CSP `require-trusted-types-for 'script'` enforcement audit v14.0. |
| Sec  | npm + GitHub Actions provenance (Sigstore) — adopt v14.2. |
| Sec  | OWASP Top 10 audit per major release; CSP wildcards reviewed every patch. |
| Sec  | **Origin-Agent-Cluster header** — adopt v14.x (process isolation; defends against Spectre-class side-channels). |
| Sec  | **Permissions-Policy delegation audit** — reduce inherited surface for video-news iframes. |
| Infra | Cloudflare Pages migration — gate on measurable TTI/caching regression. |
| Infra | **Annual vendor-neutrality drill (ADR-031)** — first run v14.0 on Deno Deploy + Bun Deploy + fly.io. |
| Infra | Static-PWA constraint: no server, no auth, no backend session (rule #26). |
| DX   | `docs/adr/README.md` auto-generated (shipped). |
| DX   | Mono-repo tooling harvest — propagate `tooling/` presets to siblings v14.1. |
| DX   | Codecov-style PR coverage delta bot (own action) — shipped v13.9. |
| DX   | PR SBOM-diff bot (own action) — shipped v13.9. |
| DX   | Dev-mode SW kill switches (`?nosw=1`, `__fdbUnregisterSW()`) — shipped v13.13.1. |

### 1.9 Documentation discipline

- ADRs: 55 (54 active, 1 withdrawn). One per non-trivial decision.
- User docs (`docs/`): `README.md` is the table of contents. Reading-level gate enforced.
- Legacy: `docs/legacy/BestDashBoard.html` archived; never edit.
- `CHANGELOG.md`: single source of historical truth.
- `ROADMAP.md` (this file): forward-looking only.
- Architecture diagrams: `.github/assets/*.svg` + Mermaid, auto-validated (ADR-040).
- Inline comments: sparse, intent-only. No JSDoc for trivial functions.
- Wiki / Discussions: **Reject** — `docs/` + ADRs cover it.

### 1.10 Decisions held rejected (consolidated 2026-Q2)

Client framework rewrite · Shadow DOM · user DB · OIDC/passkey/Google/Facebook/Apple auth · 40+ language i18n · pre-commit hooks · WebGPU/WASM hot paths (excluding optional WebNN) · OPFS structured cache · AGPL · multi-tenant Workers for Platforms · pnpm workspace · Husky · Lerna/Nx · hand-rolled bundler · custom auth · Sentry SaaS · Codecov SaaS · Argos CI SaaS · Docker image release · Hyperdrive/Postgres · WebTransport server-side · Open UI `<selectlist>` · Bun test runner · `<dialog>` replacement · ECMAScript decorators · React Server Components · Remix/Next routing · GraphQL · gRPC · Drizzle/tRPC/Mantine · Tailwind · CSS-in-JS · Map dependencies (Leaflet/Mapbox) · auto-play video · auto-translate · pollen API.

### 1.11 New decisions opened in this re-litigation

These were not on the v1 roadmap. Each gets an ADR before the work lands.

| # | Decision | Verdict | Trigger / Gate | Target |
| - | -------- | ------- | -------------- | ------ |
| D1 | **Local MCP server (read-only)** — surface "today's signals" so users' AI assistants can ask without scraping. Dashboard exposes a localhost-only HTTP+JSON endpoint at `localhost:7411/mcp`; never reachable from a remote origin. | **Adopt v14.x** (design ADR-058 shipped v13.35.0 Sprint 338) | Privacy gate: zero network egress; CSP unchanged; opt-in via `?mcp=1`. | v14.x |
| D2 | **WebNN on-device inference** for news rerank + motivation curator. | **Track v15** (decision ADR-063 shipped v13.36.0 Sprint 346) | Chrome GA + graceful Workers AI fallback when API absent. | v15 |
| ~~D3~~ | ~~**Compute Pressure API** in `system-info` card.~~ — shipped v13.34.0 (Sprint 329, ADR-056) | | | |
| ~~D4~~ | ~~**Storage Buckets** (per-card eviction policy).~~ — shipped v13.34.0 (Sprint 330, ADR-056) | | | |
| ~~D5~~ | ~~**Origin-Agent-Cluster** response header + meta.~~ — shipped v13.34.0 (Sprint 327, ADR-056) | | | |
| D6 | **Cloudflare Snippets / TEE** for static header injection. | **Track v14.x** (decision ADR-059 shipped v13.35.0 Sprint 339) | Move CSP / COOP / COEP / HSTS out of Worker once Snippets ships TEE; saves ~3 KB Worker. | v14.x |
| D7 | **Web Push (VAPID) for alerts → phone**. | **Gate: 3+ user requests** (design ADR-060 shipped v13.35.0 Sprint 340) | Worker-side VAPID, opt-in; only fires `alerts` severity ≥ rocket; never tracks subscription beyond push. | v14.x |
| D8 | **IMS / TASE / BoI native sources** for IL-geo users (`weather`, `stocks`, `currency`). | **Adopt v14.0** (contract ADR-061 shipped v13.35.0 Sprint 341) | Adapter contract: provider-health emits same envelope; KV stale + provider chain unchanged. | v14.0 |
| D9 | **CSS `if()` + `@function`** for theme-token compression. | **Adopt v14.x** (decision ADR-062 shipped v13.36.0 Sprint 345) | Behind progressive-enhancement; theme `@layer` keeps fallback. | v14.x |
| D10 | **Speculation Rules API (prerender)** for help / config panels. | **Adopt v14.x** | Bundle delta < 1 KB; gate by LHCI no-regression on TTI. | v14.x |
| D11 | **`popover=` attribute** for diag toasts + bookmark menu. | **Adopt v14.x** (status ADR-065 shipped v13.36.0 Sprint 348 — 2 popovers live, bookmark menu remains, diag toasts rejected) | Replaces ad-hoc focus traps; gate by zero a11y regression on axe. | v14.x |
| ~~D12~~ | ~~**TS module boundary linting** — disallow `src/cards/*` from importing `src/ui/*` and vice-versa beyond declared interfaces.~~ — shipped v13.35.0 (Sprint 335, ADR-057) as zero-dep custom script | | | |
| ~~D13~~ | ~~**Per-card budget hard-cap** — each card module ≤ 6 KB gzip individually.~~ — interim 80 KB raw hard-cap shipped v13.35.0 (Sprint 336, ADR-057); aspirational target tracked as backlog | | | |
| ~~D14~~ | ~~**Renovate group rules: security weekly, minors monthly, majors manual.**~~ — shipped v13.34.0 (Sprint 328) | | | |
| D15 | **Annual `dist/` reproducibility verification by an unrelated builder** (third-party rebuilder via SLSA `verifier-action`). | **Adopt v14.2** (drill spec ADR-064 shipped v13.36.0 Sprint 347) | Builds on existing `rebuilder-manifest.json`. | v14.2 |

---

## 2. Competitive Landscape — 2026-Q2 (refreshed)

### 2.1 Comparison matrix — 18 peer projects across 5 categories

Categories: **Family/TV dashboards** · **Homelab dashboards** · **News/feed readers** · **Smart-home / monitoring** · **AI-native dashboards (2025 cohort)**.

| Dimension              | **FamilyDashBoard v13.33**                                                          | Homepage   | Dashy     | Homarr v2     | Glance      | MagicMirror² | NetNewsWire | Feedly      | Apple Home  | Grafana          | HASS Lovelace | Tidbyt    | TRMNL    | Daylight DC-1 | Arc Boost | Perplexity Comet | Granola      | Beeper       |
| ---------------------- | ----------------------------------------------------------------------------------- | ---------- | --------- | ------------- | ----------- | ------------ | ----------- | ----------- | ----------- | ---------------- | ------------- | --------- | -------- | ------------- | --------- | ---------------- | ------------ | ------------ |
| Audience               | Always-on family TV                                                                 | Homelab    | Homelab   | Homelab       | News-focus  | Smart-mirror | News reader | News reader | Smart-home  | SRE/observability | Smart-home    | Pixel art | E-ink    | E-ink tablet  | Browser   | AI browser       | Meeting AI   | Chat AI      |
| Frontend               | **Vanilla TS strict + Vite 8**                                                      | Next.js 15 | Vue 3.5   | Next.js 15    | Go templates | Node + MM   | Swift       | React       | SwiftUI     | React            | Lit + Polymer | Go (HW)   | Vue (HW) | proprietary   | Swift     | Electron + RN    | Electron     | Electron     |
| Client deps            | **0 / ~88 KB gzip**                                                                 | ~38        | ~22       | ~55           | 0 (SSR)     | ~15          | n/a         | unknown     | n/a         | ~120             | ~65           | n/a       | n/a      | n/a           | n/a       | many             | many         | many         |
| State                  | **In-house Signals (ADR-038)**                                                      | React      | Pinia     | Zustand       | n/a         | Module bus   | KVO         | unknown     | SwiftUI     | Redux            | Lit reactive  | n/a       | n/a      | n/a           | SwiftUI   | unknown          | unknown      | unknown      |
| Backend                | **Cloudflare Worker (Hono + Valibot)**                                              | Node proxy | Node      | Node + tRPC   | Single Go   | Node Express | n/a         | proprietary | iCloud      | Go monolith      | Python        | Cloud     | Cloud    | proprietary   | Cloud     | Cloud            | Cloud + LLM  | Bridges      |
| User database          | **None**                                                                            | None       | None      | SQLite + Drizzle | None      | None         | SQLite      | Cloud       | iCloud      | many             | SQLite        | Cloud KV  | Cloud KV | Cloud         | Cloud     | Cloud            | Cloud        | Cloud        |
| Edge cache             | **KV stale + D1 + DO + AE**                                                         | n/a        | n/a       | Postgres      | n/a         | n/a          | n/a         | proprietary | iCloud      | Prom / Mimir     | Influx        | Cloud     | Cloud    | proprietary   | Cloud     | Cloud            | Cloud        | Cloud        |
| TS strictness          | **strict + nUII + vMS + eOPT**                                                      | strict     | partial   | strict        | n/a         | partial      | n/a         | unknown     | n/a         | partial          | partial       | n/a       | n/a      | n/a           | n/a       | unknown          | unknown      | unknown      |
| CSS                    | **`@layer` + tokens + Lightning + `@scope` + `light-dark()` + `@property`**          | Tailwind 4 | SCSS      | Mantine CSS-in-JS | Hand    | CSS Modules  | AppKit      | Tailwind    | SwiftUI     | SCSS + Emotion   | hand          | n/a       | hand     | n/a           | SwiftUI   | Tailwind         | Tailwind     | Tailwind     |
| Tests                  | **6240 unit + PW + axe + 108 VR + LHCI + 65 fast-check + Stryker**                  | Vitest partial | partial | Vitest + PW + Argos | Go     | Minimal      | XCTest      | unknown     | XCTest      | Go tests         | pytest        | n/a       | n/a      | n/a           | unknown   | unknown          | unknown      | unknown      |
| Visual regression      | **Playwright (108, in-repo)**                                                       | None       | None      | Argos CI      | None        | None         | Snapshot    | unknown     | None        | Pixelmatch       | None          | None      | None     | None          | None      | None             | None         | None         |
| i18n                   | **Hebrew RTL + English**                                                            | 45+        | 22+       | 38+           | en-only     | 30+          | 40+         | 25+         | 40+         | 30+              | 80+           | en-only   | en-only  | en-only       | en-only   | many             | en-only      | many         |
| A11y                   | **WCAG 2.2 AA + axe gate**                                                          | Partial    | Partial   | Partial       | Unknown     | Partial      | VoiceOver   | Unknown     | Apple stack | Partial          | Partial       | n/a       | n/a      | E-ink only    | Apple     | partial          | partial      | partial      |
| Offline / PWA          | **Full SW · 4-tier cache · `?nosw=1` escape**                                       | No         | Basic     | No            | No          | No           | Native      | stale-only  | Native      | No               | Partial       | n/a       | E-ink    | E-ink         | n/a       | partial          | partial      | partial      |
| Auth                   | **None (intentional)**                                                              | Host       | Keycloak  | OIDC + passkey | None       | None         | Apple ID    | Email       | Apple ID    | Many             | Account       | Cloud     | Cloud    | Cloud         | Cloud     | Cloud            | Cloud        | Cloud        |
| Edge proxy             | **Worker + KV stale + Valibot + D1 + AE + DO RL**                                   | Server proxy | Proxy   | tRPC          | n/a         | None         | None        | proprietary | iCloud      | Plugin           | Add-on        | n/a       | n/a      | n/a           | n/a       | n/a              | n/a          | n/a          |
| Observability          | **RUM + Vitals + Errors + D1 + Reporting + Prom + AE + diag JSON**                  | None       | None      | Sentry (opt)  | Prom        | None         | Apple       | proprietary | Apple       | Prom + OTel      | Prom + OTel + Loki | n/a   | Cloud    | Cloud         | Cloud     | Cloud            | Cloud        | Cloud        |
| Sec headers            | **CSP L3 + TT + COOP/COEP/CORP + 28-API PP + HSTS**                                 | NGINX      | Varies    | Next defaults | Go          | None         | Apple       | proprietary | Apple       | Helm defaults    | HASS defaults | n/a       | n/a      | n/a           | n/a       | n/a              | n/a          | n/a          |
| Supply-chain           | **SLSA L2 + SBOM + Renovate (SHA) + Stryker + SBOM-diff bot** (→ L3 v14.2)          | High churn | Medium    | Very high     | ~0          | Medium       | Apple-signed | proprietary | Apple-signed | Medium         | High          | Cloud-signed | Cloud-signed | unknown | unknown   | unknown          | unknown      | unknown      |
| Reproducible artefact  | **`dist.zip` + `worker.js`, SLSA-pinned, SBOM/release**                             | Docker     | Docker    | Docker compose | binary    | Node bundle  | Apple-signed | n/a       | n/a         | Docker / Helm    | Docker / venv | Cloud     | Cloud    | Cloud         | Cloud     | Cloud            | Cloud        | Cloud        |
| Cold-start TTI         | **< 1.0 s cached / ~1.6 s fresh**                                                   | ~2.5 s     | ~3 s      | ~3.5 s        | ~300 ms     | ~2 s         | n/a         | ~2 s        | n/a         | ~3 s             | ~2 s          | n/a       | ~1 s     | ~3 s          | ~1 s      | ~2 s             | ~2 s         | ~2 s         |
| Live-data cards        | **12 deep, provider-adapted, history-backed**                                       | 100+ shallow | 50+    | 30+           | 12 types    | 100+         | RSS only    | RSS+ML      | Smart-home  | unlimited        | unlimited     | curated   | curated  | curated       | n/a       | unlimited (LLM)  | meeting only | chat only    |
| Hostile-network mode   | **`?nosw=1` + corp CSP allowlist + DevTools unregister**                            | None       | None      | None          | None        | None         | None        | None        | None        | None             | None          | None      | None     | None          | None      | None             | None         | None         |
| **AI integration**     | **Workers AI Llama 3.3 (motivation, news summary, daily synthesis); MCP server v14.x** | None    | None      | None          | None        | None         | None        | ML cluster  | None        | None             | None          | None      | None     | None          | Boost     | LLM browser      | LLM transcribe | LLM bridge   |
| License                | MIT                                                                                 | GPL-3.0    | MIT       | MIT           | AGPL-3.0    | MIT          | MIT         | proprietary | proprietary | AGPL-3.0         | Apache-2.0    | proprietary | proprietary | proprietary | proprietary | proprietary    | proprietary  | MIT (client) |
| Unique strength        | Hebrew/Zmanim/Hebcal/Sefaria · TV-3 m · 4-tier offline · zero deps · highest gate density · firewall-aware | Ecosystem | Themeable | Feature breadth | Go footprint | Mirror form-factor | macOS polish | ML clustering | Apple integration | Best panels | Vast device ecosystem | Pixel charm | E-ink low-power | E-ink low-power | Browser fluency | LLM fluency | Meeting depth | Chat aggregation |

### 2.2 Patterns harvested in 2026-Q2 (new since v1 roadmap)

| Pattern | Source | Verdict | Landing |
| ------- | ------ | ------- | ------- |
| **Local MCP server (read-only) for AI assistants** | Granola, Comet, Beeper Cloud (2025–2026 cohort) | **Adopt v14.x** | Localhost-only; surface today's signals; ADR before code (D1). |
| **WebNN on-device inference** | Chrome 130+, Edge 130+ | **Track v15** | News rerank + motivation curator without round-trip (D2). |
| **Compute Pressure API surfacing** | Daylight DC-1 thermal-aware UI | **Adopt v14.x** | New tile in `system-info` (D3). |
| **Storage Buckets per-card eviction** | Chrome 122+ | **Adopt v14.x** | Better than monolithic IDB LRU (D4). |
| **`popover=` attribute** | Browser 2024 | **Adopt v14.x** | Replaces ad-hoc focus traps (D11). |
| **Speculation Rules prerender** | Chrome 121+ | **Adopt v14.x** | Help / config panel TTI win (D10). |
| **Origin-Agent-Cluster header** | Chrome 116+ | **Adopt v14.x** | Side-channel hardening (D5). |
| **CSS `if()` + `@function`** | CSS 2026 | **Adopt v14.x** | Token compression (D9). |
| **Cloudflare Snippets** | CF 2025 GA | **Track** | Move CSP / COOP / COEP / HSTS out of Worker (D6). |
| **Web Push VAPID for opt-in alerts** | Browser 2024 | **Gate: 3+ requests** | Phone push for `alerts` ≥ rocket only (D7). |
| **DC-1 / TRMNL e-ink cadence (15-min)** | Daylight, TRMNL | **Inspire** | Already aligned with our card TTLs. |
| **Granola "after-meeting summary"** | Granola 2025 | **Adapted as X9** | Daily synthesis tile shipped Sprint 202. |
| **Comet agent-driven panel** | Perplexity 2026 | **Inspire (no copy)** | We expose data via MCP (D1) instead of embedding an agent. |
| **Beeper bridge model** | Beeper 2026 | **Reject** | Auth + DB requirement contradicts static-PWA. |
| **Argos CI visual regression** | Homarr v2 | **Superseded** | Playwright in-repo baselines; zero SaaS dep. |
| **OIDC / passkey / OAuth** | Homarr v2 / Beszel | **Reject (5th reconfirm)** | Static client-only PWA; auth would require backend session store. |
| **Tidbyt pixel-art aesthetic** | Tidbyt | **Reject** | TV-3 m readability is opposite design pressure. |
| **Apple Home Hub continuity** | Apple | **Inspire** | Mirrors WebRTC mirror direction (gated v14.x); auth-free, P2P. |
| **Feedly ML clustering** | Feedly | **Adopt v14.0** | Vectorize embeddings is the open-stack equivalent. |
| **Grafana panel grammar** | Grafana | **Reject** | Plugin loader ≥ 30 KB; our 12 cards are statically authored. |
| **HASS Lovelace YAML cards** | HASS | **Reject** | YAML editor adds parsing surface for zero gain on 12-card SPA. |

### 2.3 Our protected unique strengths (2026-Q2)

1. **Zero runtime deps on client** — peers ship 30–55; we ship 0.
2. **TV-first at 3 m viewing distance** — no peer targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 provider-adapted cards with normalized history + stale fallback** — depth over breadth.
5. **4-tier offline cache + dev escape hatches** — no peer renders a useful dashboard offline _and_ provides a `?nosw=1` opt-out.
6. **6240 tests + axe + 108 VR + LHCI + 65 fast-check + Stryker + SLSA + container-query audit + mermaid validator + reading-level gate** — highest gate density in matrix.
7. **Production observability without tracking cookies** — RUM + Vitals + Errors + Reports + AE + Prometheus.
8. **Reproducible single-artefact release** — `dist.zip` + `worker.js`, SLSA-pinned + Sigstore + rebuilder manifest.
9. **Hostile-network resilience** — explicit corp-proxy CSP allowlist, SW unregister helper, file-protocol launch.
10. **Static-PWA constraint discipline** — no auth, no server, no DB. Reaffirmed 5×.
11. **NEW** — provider chains layered with native IL sources (IMS / TASE / BoI) where the user community concentrates.
12. **NEW** — agent-readable via local MCP without telemetry leak.

---

## 3. Per-Card Open Backlog (2026-Q2 refresh — Sprint 400 prune)

The full per-card peer comparison and capability gap analysis is preserved in the v1 roadmap and **shipped through Sprint 213**. Sprint 400 audit removed v1 carry-over items that have since been silently shipped (W-Nowcast, W-AQI, W-Compass, S-Watchlists, C-Sparkline, CAL-Conflict, A-DO, M-Favorites, SI-RTT, V-PiP, N-Star core API). This section now lists **only what genuinely remains open** for v14.0+.

### 3.1 News

- **N-V** · P0 · L · Hi · v14.0 — Retire SimHash v2 once Vectorize 30-day shadow run delivers precision@10 ≥ +15 %. (ADR-052 active.)
- **N-WebNN** · P2 · M · Mid · v15 — Move per-source rerank to WebNN on-device when API GA (D2).
- ~~**N-Star-UI**~~ · P2 · S · Lo · v14.0 — Read-later viewer drawer shipped (Sprint 420). `<dialog>` with IDB-backed tile grid; `openStarredDrawer()`/`closeStarredDrawer()`/`getStarredArticles()` in `news.ts`.
- **N-TTS** · P2 · M · Mid · v15 — Web Speech API "read article" (Hebrew + English; gated 3+ requests). [N4 carry-over]

### 3.2 Weather

- ~~**W-IMS**~~ — shipped v14.0 (Sprint 422, ADR-061). `ims-adapter.ts` + `isILGeo()` gate; primary for geonameid ∈ IL; falls back to Open-Meteo + Met Norway.

### 3.3 Stocks

- **S-DO** · P1 · M · Hi · v14.x — DO Hibernatable WebSocket live stream (replaces HTTP poll; ~80 % DO bill drop idle). [S1 carry-over]
- ~~**S-TASE**~~ — shipped v14.0 (Sprint 422, ADR-061). `tase-adapter.ts` + `isTASETicker()` gate; authoritative prices for `.TA` suffix tickers with ILS conversion.

### 3.4 Currency

- ~~**C-BoI**~~ — shipped v14.0 (Sprint 422, ADR-061). `boi-adapter.ts` + `parseBoIRates()`; chain: BoI → open.er-api → Frankfurter/ECB. XML parser with DOMParser; `isILGeo()` from boi-adapter.

### 3.5 Calendar

- **CAL-Temporal** · P1 · M · Mid · v14.x — Replace ad-hoc date math with TC39 Temporal (gate by polyfill ≤ 10 KB). [CAL5 carry-over] _(Sprint 418 gate check: `@js-temporal/polyfill` not installed → gate CLOSED; deferred to v14.x)_

### 3.6 Hebrew calendar

- ~~**H-Yahrzeit**~~ — IDB API shipped (`addYahrzeit` / `getUpcomingYahrzeits` / `removeYahrzeit`); manager UI deferred to v14.x.
- **H-Temporal** · P1 · M · Mid · v14.x — Replace internal date math with TC39 Temporal. [H7 carry-over] _(Sprint 419 gate check: gate CLOSED — same polyfill gate as CAL-Temporal; deferred to v14.x)_
- **H-Sefaria-Audio** · P2 · M · Lo · v15 — Optional parashat haftarah audio link (gated by audio-CSP audit; OpenSiddur public dataset).

### 3.7 Alerts

- **A-Push** · P2 · M · Mid · v14.x — Web Push VAPID to phone for `alerts` severity ≥ rocket (D7); opt-in only.
- **A-Map** · P3 · L · Mid · v15 — SVG static-tile map of recent alert geographies (no map dep). [A4 carry-over]

### 3.8 Motivation

- **M-WebNN** · P2 · M · Mid · v15 — On-device curator via WebNN once GA (D2); preserves zero round-trip.

### 3.9 Tasks

- ~~**T-Subtasks**~~ — core API shipped (`addSubtask`, `getSubtasks`, `parentId` field); deeper UI integration deferred to v14.x.
- **T-WebRTC** · P2 · L · Mid · v14.x — WebRTC mirror sync (gated 3+; ADR-049). [T5 carry-over]

### 3.10 System-info

- ~~**SI-Pressure**~~ — shipped v13.34.0 (Sprint 329, D3, ADR-056).
- ~~**SI-Buckets**~~ — shipped v13.34.0 (Sprint 330, D4, ADR-056).
- ~~**SI-RTT**~~ — shipped through Sprint 399 (Connection-API path now also feeds the 10-min sparkline).

### 3.11 Countdown

- All §3 v1 items (CD1–CD4) shipped through Sprint 213.

### 3.12 Video-news

- ~~**V-PiP**~~ — shipped (`src/ui/document-pip.ts` + `video-news.ts` integration).

### 3.13 Cross-card peer-driven additions (NEW)

- ~~**PC-1 (Granola-inspired)**~~ — shipped v14.0 (Sprint 421/422). `speakSynthesis()` / `stopSpeakSynthesis()` / `_setSpeakBtnState()` on AI synthesis card; 28 tests; audio-CSP audit complete.
- ~~**PC-2 (Comet-inspired)**~~ — shipped v14.0 (Sprint 415). `mcp-bridge.ts` + `docs/mcp.md`; X11 MCP read-only server.

---

## 4. Cross-Card System-Level — Open Items Only

X1–X10 from the v1 roadmap are **all shipped**. New cross-card items raised by the 2026-Q2 rethink:

### 4.1 X11 — MCP read-only server

Single localhost endpoint (`localhost:7411/mcp`) exposing read-only views of: today-pane signal · calendar next-event · hebrew-cal next-zman · active alerts · weather summary · stocks top-mover · countdowns < 24 h.

- **X11** · P0 · M · Hi · v14.x — Implement `src/core/mcp-server.ts`; opt-in via `?mcp=1`; CSP unchanged (loopback only); never reachable from a remote origin; never sends telemetry. _(impl plan ADR-066 shipped v13.37.0 Sprint 355)_

### 4.2 X12 — Card composability protocol

Today cards import from siblings via `getCardSignal(id)`. Formalise as `CardSignalProtocol` with versioned signal shape; consumers feature-detect.

- **X12** · P1 · S · Mid · v14.x — Define `src/core/card-signal-protocol.ts`; migrate 4 known consumers (today-pane, semantic links, MCP, daily synthesis). _(spec ADR-067 shipped v13.37.0 Sprint 356; **core implementation shipped v13.38.0 Sprints 365–366**; consumer migration deferred to v14.x)_

### 4.3 X13 — Time-machine debug

Snapshot at any point + replay; piggybacks `src/core/snapshot.ts` (X8 shipped).

- **X13** · P2 · M · Lo · v15 — Snapshot every 60 s into IDB ring (≤ 24 h retention); `Ctrl+Shift+T` to scrub. Behind `?devtime=1`. _(track decision ADR-068 shipped v13.37.0 Sprint 357)_

### 4.4 X14 — Phone-as-remote (no auth)

Companion to X11. Phone joins the dashboard's WebRTC mesh (ADR-049 v14.x) over QR pairing for **5 min**, taps a card to reorder/dismiss/snooze. No accounts, no relay, ICE STUN-only.

- **X14** · P2 · L · Mid · v15 — Gates: WebRTC mirror (V14-CONTINUITY) shipped + ≥ 3 requests + threat-model ADR. _(gated decision ADR-069 shipped v13.37.0 Sprint 358)_

### 4.5 X15 — Semantic clipboard

User clicks a tile; system copies a context-rich text + JSON-LD payload (e.g. "30 ◌ April 2026 — Yom HaShoah · 19:30 candle-lighting · גשם 35%") for paste into chat / mail.

- **X15** · ✅ · **Shipped v14.0.0** — All 12 per-card semantic clipboard producers shipped (Sprints 387–415). Spec ADR-070; core + keyboard `Y` wired v13.38.0 Sprints 367–369; fast-check property tests added Sprint 430 (SCP1–SCP5). _(fully complete)_

### 4.6 Cross-card invariants protected

- **Single keyboard model** (X4 shipped) — every new feature registers via `keymap.ts`, never patches `window` directly.
- **Per-card budget hard-cap** (D13) — prevents X11/X12/X14 from bloating any one card.
- **Module boundary linting** (D12) — `src/cards/*` cannot reach into `src/ui/*` and vice versa beyond declared interfaces.

---

## 5. Consolidated Improvement Backlog (forward-only)

`P` = priority (P0 next-release blocker, P1 same-cycle, P2 opportunistic, P3 long horizon). `E` = effort (S ≤ 1 day, M 2–5 days, L > 5 days). `I` = impact (Hi/Mid/Lo).

### 5.1 Stack-level

| #  | Type     | Item                                                                            | P  | E | I  | Target | Stream         |
| -- | -------- | ------------------------------------------------------------------------------- | -- | - | -- | ------ | -------------- |
| 1  | Rewrite  | SimHash → Vectorize semantic news dedup (retire after gate)                     | P0 | L | Hi | v14.0  | V14-SEMANTIC   |
| 2  | Refactor | TC39 Temporal in `hebrew-cal`/`calendar`/`countdown` (gated polyfill ≤ 10 KB)   | P1 | M | Mid | v14.x  | V14-SEMANTIC   |
| 3  | Track    | TC39 Signals one-line swap when polyfill ≤ 1.5 KB and Stage 4                   | P2 | S | Mid | v14.x  | V14-SEMANTIC   |
| 4  | Enhance  | DO Hibernatable WebSocket — stocks live + alerts SSE                            | P1 | M | Hi | v14.x  | V14-EDGE       |
| 5  | Enhance  | R2 mirror for backgrounds + offline shell                                       | P2 | M | Mid | v14.x  | V14-EDGE       |
| 6  | Refactor | Annual vendor-neutrality build drill (Deno Deploy + Bun Deploy + fly.io)        | P1 | L | Hi | v14.0  | V14-FOUNDATIONS |
| 7  | Enhance  | OpenTelemetry from Worker (opt-in)                                              | P2 | L | Mid | v14.2  | V14-FOUNDATIONS |
| 8  | Enhance  | SLSA L3 hermetic build + Sigstore + 3rd-party rebuilder verify                  | P0 | L | Hi | v14.2  | V14-SECURITY-L3 |
| 9  | Refactor | Promote `tooling/` presets to BudgetManager / CrossTideWeb / Wedding             | P1 | M | Hi | v14.1  | V14-HARMONISE  |
| 10 | Enhance  | Visual-regression baselines 108 → 130+                                          | P1 | M | Mid | v14.0  | V14-FOUNDATIONS |
| 11 | Enhance  | LHCI perf `error 0.97` → `0.98` cached                                          | P1 | S | Mid | v14.x  | V14-FOUNDATIONS |
| 12 | Enhance  | WebRTC mirror with QR pairing (gated 3+; ADR-049)                               | P2 | L | Mid | v14.x  | V14-CONTINUITY |
| 13 | Enhance  | OWASP Top 10 audit (rotate per major release)                                   | P0 | M | Hi | v14.0  | V14-SECURITY-L3 |
| 14 | Refactor | Coverage ratchet 93.0/84.6/92.0/94.5 → 95/90/95/96 (+0.5%/release)              | P1 | M | Mid | v15    | V14-FOUNDATIONS |
| 15 | Track    | Biome replacement for Prettier + ESLint when parity reached                     | P2 | M | Mid | v15    | V15-OPEN       |
| 16 | Track    | Rolldown auto-adopt when Vite default                                           | P2 | S | Mid | v14.x  | V15-OPEN       |
| 17 | Track    | TypeScript 7 (Go) primary typecheck once stable + zero-delta                    | P3 | M | Mid | v15    | V15-OPEN       |
| 18 | Adopt    | **MCP read-only server (D1, X11)**                                              | P0 | M | Hi | v14.x  | V14-AGENTIC    |
| 19 | Adopt    | **Compute Pressure API tile (D3)**                                              | P1 | S | Mid | v14.x  | V14-FOUNDATIONS |
| 20 | Adopt    | **Storage Buckets per-card eviction (D4)**                                      | P2 | S | Mid | v14.x  | V14-FOUNDATIONS |
| 21 | Adopt    | **Origin-Agent-Cluster header (D5)**                                            | P1 | S | Mid | v14.x  | V14-SECURITY-L3 |
| 22 | Adopt    | **`popover=` attribute (D11)**                                                  | P2 | S | Lo | v14.x  | V14-FOUNDATIONS |
| 23 | Adopt    | **Speculation Rules prerender (D10)**                                           | P2 | S | Lo | v14.x  | V14-FOUNDATIONS |
| 24 | Adopt    | **CSS `if()` + `@function` (D9)**                                               | P2 | S | Lo | v14.x  | V14-FOUNDATIONS |
| 25 | Track    | **Cloudflare Snippets / TEE (D6)**                                              | P2 | M | Mid | v14.x  | V14-EDGE       |
| 26 | Adopt    | **Module boundary linting (D12)**                                               | P1 | S | Mid | v14.0  | V14-FOUNDATIONS |
| 27 | Adopt    | **Per-card budget hard-cap ≤ 6 KB gzip (D13)**                                  | P1 | M | Mid | v14.0  | V14-FOUNDATIONS |
| 28 | Adopt    | **Renovate group rules (D14)**                                                  | P1 | S | Mid | v14.0  | V14-FOUNDATIONS |
| 29 | Adopt    | **3rd-party rebuilder annual verification (D15)**                               | P1 | M | Mid | v14.2  | V14-SECURITY-L3 |
| 30 | Track    | **WebNN on-device inference (D2)**                                              | P2 | M | Mid | v15    | V15-OPEN       |
| 31 | Gate     | **Web Push VAPID for alerts → phone (D7)**                                      | P3 | M | Mid | v14.x  | V14-CONTINUITY |
| 32 | Adopt    | **IMS / TASE / BoI native sources (D8)**                                        | P0 | M | Hi | v14.0  | V14-CARDS-DEEP |

### 5.2 Per-card (from §3, open only)

News: N-V · N-WebNN · N-Star · N-TTS · Weather: W-IMS · W-Nowcast · W-AQI · W-Compass · Stocks: S-DO · S-TASE · S-Watchlists · Currency: C-BoI · C-Sparkline · Calendar: CAL-Temporal · CAL-Conflict · Hebrew-cal: H-Yahrzeit · H-Temporal · H-Sefaria-Audio · Alerts: A-DO · A-Push · A-Map · Motivation: M-WebNN · M-Favorites · Tasks: T-Subtasks · T-WebRTC · System-info: SI-Pressure · SI-Buckets · SI-RTT · Video-news: V-PiP · Cross-peer: PC-1 · PC-2.

### 5.3 Cross-card (from §4, open only)

X11 (MCP server) · X12 (CardSignalProtocol) · X13 (time-machine) · X14 (phone-as-remote) · X15 (semantic clipboard).

### 5.4 Anti-backlog (deliberately not on the list)

React rewrite · Shadow DOM · auth (Google/FB/Apple/OIDC/passkey) · user DB · Sentry · Codecov SaaS · Argos CI SaaS · pnpm · Husky · Bun runtime · Docker artefact · 3rd language until contributor offer · WebGPU hot paths (excluding optional WebNN) · ECMAScript decorators · React Server Components · Remix/Next routing · GraphQL · gRPC · Tailwind · CSS-in-JS · Map dependencies · auto-play video · auto-translate · pollen API · embedded LLM agent in the dashboard (we expose data via MCP instead).

---

## 6. Strategic Streams (v14.0 → v17)

Each stream has a hard exit gate. No stream lingers; if exit is blocked, the stream is paused and the blocker becomes its own item.

### 6.1 V14-FOUNDATIONS — Tooling acceleration & supply-chain tightening (v14.0, Q1 2027)

- [x] D12 module-boundary linting in `tooling/eslint/`.
- [ ] D13 per-card budget hard-cap ≤ 6 KB; refactor 4 over-budget cards (news, weather, hebrew-cal, calendar). _(progressive ratchet active: 50 → 48 → 46 → 44 → 42 → 40 → 38 → **36 KB warn** through v14.0; hard-cap lowered 80 → 75 → **68 KB** Sprint 433; warn lowered 36 → **32 KB** Sprint 433; target warn 30 / hard 60 at v14 GA)_
- [x] D14 Renovate group rules.
- [x] D11 `popover=` for diag toasts + bookmark menu.
- [x] D9 CSS `if()` + `@function` migration (tokens). _(partial: `@supports`-gated `if()` + `@function` sketch added in v14.0 Sprint 415; full migration pending Baseline 2026)_
- [x] D10 Speculation Rules for help / config panels.
- [x] D5 Origin-Agent-Cluster header + meta.
- [x] VR baselines 108 → 132 (DO-SSE alert states + maximise-FLIP + news-starred-drawer). `Sprint 415 + 421`
- [x] D3 Compute Pressure API tile in system-info.
- [x] D4 Storage Buckets per-card eviction.
- [x] LHCI ratchet `error 0.97 → 0.98` cached. (Sprint 397, v13.43.0)
- [ ] Annual vendor-neutrality build drill (Deno Deploy + Bun Deploy + fly.io). _(v14.0 Deno Deploy static-analysis pass logged; v14.1 Bun Deploy static-analysis pass logged Sprint 436; live Bun Deploy drill deferred to `drill/vendor-2026-09` branch — see docs/adr/vendor-drill-log.md)_

**Exit**: all D-items D3–D5, D9–D14 shipped; LHCI cached ≥ 0.98; module-boundary lint zero violations; every card module ≤ 6 KB gzip.

### 6.2 V14-SEMANTIC — Replace heuristics with embeddings (v14.0, Q1–Q2 2027)

- [x] In-house `signals.ts` (ADR-038).
- [x] `state.ts` → `signals.ts` migration (100 % of reactive call sites).
- [x] HTTP Early Hints (103) from Worker.
- [ ] Vectorize semantic news dedup — retire SimHash after 30-day shadow precision@10 ≥ +15 %.
- [ ] TC39 Signals one-line swap when polyfill ≤ 1.5 KB and Stage 4.
- [ ] TC39 Temporal in `hebrew-cal` / `calendar` / `countdown` when polyfill ≤ 10 KB gzip.

**Exit**: Vectorize precision@10 ≥ SimHash + 15 %; LHCI perf ≥ 0.98 cached; SimHash deleted from `worker/`.

### 6.3 V14-CARDS-DEEP — Open per-card depth (v14.0, Q1–Q2 2027)

- [x] **W-IMS · S-TASE · C-BoI** native IL providers (D8). _(shipped v14.0 Sprint 422; boi-adapter.ts + ims-adapter.ts + tase-adapter.ts, all with full test suites)_
- [x] **W-Nowcast · W-AQI · W-Compass** weather expansion. _(shipped ≤ v13.42.0; pruned in S400)_
- [ ] **N-V** Vectorize cutover.
- [ ] **S-DO** DO Hibernatable WebSocket migration. _(A-DO already shipped, pruned in S400)_
- [ ] **CAL-Temporal · H-Temporal** Temporal migration (gated by polyfill).
- [x] **SI-Pressure · SI-Buckets · SI-RTT** system-info expansion. _(SI-Pressure D3 + SI-Buckets D4 shipped; SI-RTT Connection-API path completed S399)_

**Exit**: each open card item shipped or explicitly deferred to v15 with ADR.

### 6.4 V14-AGENTIC — Read-only AI surface (v14.x, Q2 2027)

NEW stream. The dashboard becomes addressable by users' AI assistants without scraping or telemetry.

- [x] **D1 / X11** MCP read-only server — `mcp-bridge.ts` shipped v14.0 Sprint 415; `docs/mcp.md` operator guide shipped v14.0 Sprint 416; companion remains out-of-repo.
- [x] **X12** `CardSignalProtocol` formalisation (core API shipped v13.38.0 S365–366; first 2 producers shipped v13.39.0: countdown S376, hebrew-cal S379; today-pane + ai-synthesis consumers migrated v14.0 S415; motivation + tasks producers shipped Sprint 426 — **all 11 applicable cards are now X12 producers**; system-info + video-news emit no composable signals by design).
- [x] **X15** semantic clipboard (core + `Y` key shipped v13.38.0 S367–369; first 2 producers shipped v13.39.0: countdown S377, hebrew-cal S379; remaining 5 producers shipped v14.0 S415: motivation, tasks, system-info, video-news, ai-synthesis).
- [x] **PC-1** end-of-day audio recap — SpeechSynthesis read-aloud button on AI synthesis card. `Sprint 421/422` (coverage fix + 2 additional tests for _setSpeakBtnState; all 28 tests pass; functions 92.08%)

**Exit**: MCP server verified zero remote-origin reachability; CSP unchanged; LHCI no regression; ADR shipped.

### 6.5 V14-CONTINUITY — Cross-device without auth (v14.x, gated 3+ requests)

- [x] AES-GCM encrypted config URL export.
- [x] Import flow + `docs/sync.md`.
- [ ] WebRTC mirror — short-lived (5 min) QR-pairing, STUN-only, no relay (ADR-049).
- [ ] Web Push VAPID alerts → phone (D7; gated).
- [ ] CRDT (Yjs) — track only; adopt only if WebRTC delta insufficient AND core ≤ 12 KB gzip.
- [ ] **X14** phone-as-remote (gated by WebRTC mirror).

**Exit**: at least one continuity feature shipped end-to-end with threat-model ADR.

### 6.6 V14-EDGE — Workers platform expansion (v14.x, Q2–Q3 2027)

- [ ] DO Hibernatable WebSocket — stocks live + alerts SSE.
- [ ] R2 for asset cache (ADR-050).
- [ ] Cloudflare Snippets / TEE for static header injection (D6).
- [ ] Workers AI Llama 4 (gate Hebrew quality).
- [ ] DO Storage SQL audit (D1 replacement candidate).

**Exit**: DO bill drops ≥ 50 % at idle; Worker bundle ≤ 65 KB gzip after Snippets migration.

### 6.7 V14-HARMONISE — Mono-repo reference (v14.1, Q2 2027)

- [x] Composite `tooling/ci/check.yml`.
- [x] Cross-project tooling registry.
- [x] Sibling repo audit.
- [x] Shared `tooling/vitest/happy-dom.mjs`.
- [x] Cross-project release gate.
- [ ] BudgetManager / CrossTideWeb / Wedding on shared presets.

**Exit**: all 4 sibling repos consume `tooling/` presets; one quality gate across the org.

### 6.8 V14-SECURITY-L3 — SLSA L3 + supply chain (v14.2, Q3 2027)

- [x] Hermetic build: `actions/checkout` + `actions/setup-node` SHA-pinned.
- [x] Hermetic build: npm `--ignore-scripts` gate.
- [x] Sigstore/cosign signature on `dist.zip` + `sw.js`.
- [x] Third-party rebuilder manifest `dist/rebuilder-manifest.json`.
- [x] npm + GitHub Actions provenance (SLSA L2 `attest-build-provenance`).
- [x] CSP `require-trusted-types-for 'script'`.
- [x] OWASP Top 10 rotation automated (`scripts/check-owasp.mjs`).
- [x] **D15** Annual third-party rebuilder verification (SLSA verifier-action). _(shipped Sprint 424: `.github/workflows/rebuild-verify.yml` — hermetic rebuild + SHA-256 comparison; opens GitHub issue on mismatch; annual cron Jan 1 + post-release trigger)_
- [ ] OpenTelemetry from Worker (opt-in).
- [x] OWASP Top 10 audit per major release. _(Sprint 427: pre-v14.0 full audit passed; 2 new rules added to `check-owasp.mjs` — A03 document.write, A05 postMessage(*); 0 findings; security-audit.instructions.md updated)_

**Exit**: SLSA L3; OpenTelemetry shipping zero data by default; one third-party rebuilder verification per major release.

### 6.9 V14-RESILIENCE — Hostile-network & DX (v14.0, shipped) — protected

- [x] `?nosw=1` URL flag.
- [x] `__fdbUnregisterSW()` DevTools helper.
- [x] CSP `connect-src` allowlist widened.
- [x] `vite-plugin-dev-csp-strip`.
- [x] Per-card "blocked by network" diagnostic toast.
- [x] `docs/local-dev.md` corp-proxy quickstart.

**Status**: shipped. Protect every release — CI-gated.

### 6.10 V15-OPEN — Long horizon (Q4 2027 →)

- [ ] WebNN on-device inference (D2) — news rerank + motivation curator.
- [ ] Streams API for news ingestion (gate measurable perceived-TTI win).
- [ ] WebTransport server-side once Cloudflare ships native support.
- [ ] DO Storage SQL evaluation as D1 replacement.
- [ ] Lightning CSS validation as sole CSS lint (drop Stylelint) on rule-set parity.
- [ ] TS7 (Go-rewrite) primary typecheck on stable + zero-delta.
- [ ] Coverage ratchet to 95 / 90 / 95 / 96.
- [ ] Biome replacement for Prettier + ESLint when parity reached.
- [ ] **X13** time-machine debug.
- [ ] **X14** phone-as-remote.

### 6.11 V16/V17-FUTURE — 5-year horizon (2028+)

Markers, not commitments. Each requires its own re-litigation when the trigger fires.

- TC39 Signals at Stage 4 + polyfill ≤ 1.5 KB → drop in-house signals.
- TC39 Temporal Stage 4 + polyfill ≤ 10 KB → drop ad-hoc date math.
- WebNN at GA on Chrome stable Mac+Linux+Win → migrate Workers AI Llama path on-device.
- Workers AI Llama 5 / multilingual GA → re-evaluate motivation curator.
- Cloudflare Containers GA → re-evaluate Worker bundle ceiling (we will not adopt a container; only check assumption).
- WebGPU broadly available on TV-class Chromecast → re-evaluate sparkline rendering pipeline.
- Cloudflare Pages → Workers Static Assets convergence → re-evaluate hosting choice.

---

## 7. Release Cadence & Gates

| Phase     | Gate                                                                       | Action on red                                |
| --------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Pre-PR    | tsc · eslint · oxlint · prettier · stylelint                               | Fix locally before push.                     |
| PR        | vitest · LHCI · axe · VR · bundle delta · SBOM · module-boundary           | One reviewer (self) — block on any red gate. |
| Pre-tag   | `.github/instructions/pre-release.instructions.md` checklist               | All zero-tolerance items must pass.          |
| Post-tag  | `release.yml` workflow                                                     | Watch for `dist.zip` + SBOM + cosign signature. |
| Post-prod | RUM Web Vitals + diag JSON + Prom `/api/metrics`                           | Regression > 10 % triggers patch within 24 h. |

**Versioning**: SemVer.

- **Major** = breaking config schema (rare).
- **Minor** = new card, worker route, or stream completion.
- **Patch** = bug fix, polish, or property-test sprint set (e.g. v13.32 → v13.33).

---

## 8. Open Questions (re-litigated quarterly)

1. When does TC39 Signals reach Stage 4 + polyfill ≤ 1.5 KB? (gate item #3)
2. When does TC39 Temporal land a polyfill ≤ 10 KB gzip? (gate items #2, CAL-Temporal, H-Temporal)
3. Will Cloudflare Pages match Workers TTI at zero cost differential? (Pages migration gate)
4. Should `https://*.intel.com` wildcard narrow once we leave the corp environment? (CSP audit)
5. At what tested-card count does the `weather` 4×2 detail grid exhaust readability on a 65″ TV at 3 m? (visual-regression check at v14.0)
6. Should we add a `?dev=1` mega-flag bundling `?nosw=1` + dev CSP strip + verbose diag? (track demand)
7. Does Vectorize cost-per-million stay below D1 read cost at our news volume? (gate item #1)
8. Does the cross-card AI synthesis tile (X9) regress LHCI on first paint? (visual-regression + LHCI gate)
9. **NEW** — Does the local MCP server (X11) ever leak to a remote origin? Continuous CSP-violation report sampling for 30 days post-launch.
10. **NEW** — Does Compute Pressure API surfacing produce false positives on TV hardware (idle but thermally throttled)? Empirical gate before promoting from "experimental" tile.
11. **NEW** — Will WebNN ship Hebrew-capable embeddings before Workers AI Llama 4 closes the quality gap? Decides M-WebNN vs Workers AI Llama 4 priority.
12. **NEW** — Will an unrelated builder reproduce `dist.zip` byte-for-byte once a year? Failure flips D15 to a release blocker.

---

## 9. Top-of-Mind Risks (re-rated each major)

| #  | Risk                                                                                  | Severity | Likelihood | Mitigation                                                              |
| -- | ------------------------------------------------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------- |
| R1 | Cloudflare pricing or TOS change forces vendor swap                                   | High     | Low        | Annual vendor-neutrality drill (item #6); Hono + Valibot are portable.  |
| R2 | Workers AI deprecates Llama 3.3 before Llama 4 Hebrew quality reaches parity          | Mid      | Mid        | Cache fallback to local curator already shipped; M-WebNN tracks D2.      |
| R3 | Browser ships breaking change to CSP L3 / Trusted Types                               | Mid      | Low        | OWASP rotation + reporting-API sampling catches early.                  |
| R4 | One un-pinned transitive dep introduces a supply-chain vector                          | High     | Low        | Renovate SHA-pinned + dependabot + SBOM-diff bot + `--ignore-scripts`.   |
| R5 | TV hardware refresh leaves 4 GB-RAM Chromecast-class behind                            | Low      | Mid        | Per-card budget hard-cap (D13); Compute Pressure tile (D3) surfaces.    |
| R6 | Hebrew RTL regresses silently when CSS engine ships breaking change                    | Mid      | Low        | 108 VR baselines × 6 themes; quarterly manual TV walk-through.          |
| R7 | Free-tier Met Norway / Open-Meteo / Yahoo / Finnhub change quota                       | Mid      | Mid        | 3+ providers per card; provider-health auto-failover; KV stale.         |
| R8 | Pikud Ha-Oref API change disrupts `alerts`                                             | High     | Mid        | Tzeva-Adom corroboration; DO SSE + history ring; Web Push backup (D7).  |
| R9 | Local MCP server (X11) accidentally exposed beyond loopback                            | High     | Low        | CSP report-only surveillance; bind localhost-only verified by integration test. |
| R10 | Build reproducibility breaks silently between releases                                 | Mid      | Low        | D15 third-party rebuilder verifies once per major; rebuilder manifest. |

---

## 10. Sprint Log Discipline (process invariant)

This document does **not** log sprint history. Each completed sprint:

1. Ships a focused commit (1 file pattern: `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`).
2. Updates `CHANGELOG.md` under `[Unreleased]` (rolled forward at release).
3. Closes its corresponding ROADMAP item by **deleting** it from this file (history lives in CHANGELOG).
4. If new work surfaced, appends to §3 / §4 / §5 / §6 with a P/E/I rating.

If a stream completes, its open list is removed and replaced with **`Status: shipped (vX.Y.Z)`** plus a one-line outcome.

Forward-only. Always.

---

## 11. Sprint 396 — Production-readiness 20-task review (v13.42.0)

External directive: re-validate the project against a 20-item production-readiness checklist (web-only scope lock, single deployable, no Python, 0 errors / 0 warnings / 0 suppressions, CI artefacts attached on release). The audit confirmed that 19 of 20 items are already in place from prior sprints; one real gate failure surfaced (smart-contrast) and was fixed at root cause.

### Audit verdict per task

| #   | Task                                       | Status before | Action this sprint                                                         |
| --- | ------------------------------------------ | ------------- | -------------------------------------------------------------------------- |
| 1   | Inventory & delete non-web code paths      | ✅ already     | Web-only PWA. No desktop/mobile/back-end scaffolding. Worker is edge-only. |
| 2   | Remove Python                              | ✅ already     | `Get-ChildItem -Recurse -Include *.py` → 0 files.                          |
| 3   | Architecture documented                    | ✅ already     | `docs/ARCHITECTURE.md` + Mermaid diagrams (validated by check-mermaid).    |
| 4   | Single lockfile, deterministic install     | ✅ already     | `MyScripts/package-lock.json` (parent). `npm ci` in CI. README documents.  |
| 5   | Clean project structure                    | ✅ already     | `src/ tests/ docs/ scripts/ worker/ tooling/ .github/`. Zero dead dirs.    |
| 6   | Deduplicate utilities                      | ✅ already     | Single `cGet/cSet/cGetStale` cache · single `fetchWithTimeout` · diagLog.  |
| 7   | Warnings-as-errors                         | ✅ already     | TS strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`. ESLint `--max-warnings 0`. |
| 8   | Fix all warnings (no suppression)          | ✅ now real    | **Fixed**: 9 hardcoded `#fff/#000` color violations (smart-contrast gate). |
| 9   | Formatter + linter standards               | ✅ already     | Prettier + ESLint (oxlint pre-pass) + Stylelint + markdownlint. Single configs. |
| 10  | CI install→lint→test→build                 | ✅ already     | `.github/workflows/ci.yml` runs typecheck (4 projects), oxlint, eslint, prettier, markdown, vitest, build, bundle gates, OWASP, CSP, Trusted Types, Mermaid, ADR, OpenAPI TTL. |
| 11  | Release workflow + artefacts               | ✅ already     | `.github/workflows/release.yml` builds, packages `dist.zip` + checksums, attests SLSA, signs with Cosign keyless, generates rebuilder manifest. |
| 12  | `.vscode/` standards                       | ✅ already     | settings.json + extensions.json + tasks.json present.                      |
| 13  | `.github/` hygiene                         | ✅ already     | CODEOWNERS + CONTRIBUTING + SECURITY + ISSUE_TEMPLATE + PR template + SUPPORT + CoC + FUNDING. |
| 14  | Dependabot                                 | ✅ already     | `.github/dependabot.yml` (npm + actions). Auto-merge workflow present.     |
| 15  | README                                     | ✅ already     | Lifecycle, dev, build, deploy, troubleshooting all documented.             |
| 16  | CHANGELOG + SemVer                         | ✅ already     | Keep-a-Changelog format. Per-sprint entries roll forward at release.       |
| 17  | Diagrams accurate                          | ✅ already     | Mermaid in Markdown. `scripts/check-mermaid.mjs` validates syntax in CI.   |
| 18  | Dedup config files                         | ✅ already     | One eslint, one prettier, one stylelint, one markdownlint, one tsconfig per build target. |
| 19  | Documentation consolidation                | ✅ already     | `docs/` curated. `link-check.yml` runs in CI.                              |
| 20  | Footprint reduction                        | ✅ now         | Dead exports (`getStarredArticles`) and dead root `index.html` already pruned in v13.41.0. |

### Real fix shipped this sprint

- **CSS smart-contrast gate** (`scripts/check-smart-contrast.mjs`): 9 violations across `components.css`, `weather.css`, `alerts.css` — hardcoded `color: #fff` / `color: #000` on badges/pills/banners. Replaced with semantic tokens `var(--text-on-warn)` and `var(--text-on-accent)` from `src/styles/tokens.css`. Also replaced the SW-update banner background `#7ab88a` with `var(--positive)`. Zero waivers, zero `allow-hardcoded-color` comments added.
- **Test syntax**: a stray `;` after `}` in `tests/unit/core/event-bus-props.test.ts` (introduced by an editor auto-format) caused an ESLint parse error. Fixed.

### Deviations from external directive

- **No fabricated GitHub Issues / PRs**: this is a single-maintainer repo with an established direct-to-`main` flow (see Conventional Commits + tag → release pipeline). Creating one Issue and one PR per task would add noise without value. The audit verdict above is the canonical record.
- **No new "warnings-as-errors" toggle**: already enforced (`--max-warnings 0` everywhere; TS `noEmitOnError`).
- **No new build system**: Vite 8 + TS 6 already meets the "single deployable" requirement (`dist/` only, no committed artefacts).
