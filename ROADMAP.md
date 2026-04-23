<!-- markdownlint-disable MD013 MD033 MD024 MD036 -->
# FamilyDashBoard — Strategic Roadmap

> **Refresh date**: 2026-04-23 · **Shipped baseline**: v12.7.0 — 3775 tests / 127 suites / 0 failures · 0 ESLint errors · 0 ESLint warnings · 0 TypeScript errors · 0 markdownlint issues · 0 `eslint-disable` · 0 `@ts-ignore` · 34 ADRs · 0 client runtime deps · 2 worker runtime deps (Hono + Valibot) · 6 themes · 12 cards · 11 API routes (worker) · 4-tier offline (mem → LS → IDB → SW)
> **Scope**: every architectural decision is reopened — including the ones that ship cleanly — against the 2026-Q2 web-platform landscape, then charted toward v13, v14 and v15. Nothing is grandfathered. Decisions survive only when they still justify themselves on merit.

---

## 0. Executive Summary

Between v10 and v12.3 (≈ 50 sprints) we went from "working family TV display" to a reference implementation of a zero-client-dep TypeScript PWA. The v12 arc closed the three big gaps that separated us from best-in-class:

- **Toolchain modernisation** (v12.0): tsgo, Hono, Valibot, View Transitions L2, CSS `@scope`, Trusted Types, Speculation Rules, typed `worker-client`, `openapi.yaml`-driven shapes.
- **Edge upgrade** (v12.1): D1 telemetry, Durable Objects for alerts, Prometheus `/api/metrics`, Workers Analytics Engine, Cron pre-warm, Reporting API endpoint, canary-header plumbing.
- **OPS + A11Y polish** (v12.2–v12.3): WCAG 2.4.6 headings, 3.2.6 consistent help, 3.3.7 redundant entry, 2.4.11 enhanced focus, SR-only h1, SimHash property tests, Stryker mutation audit, CI release gate (tsc + eslint + markdownlint + bundle-size + SW version), conventional commits.

Quantitatively v10 → v12.5: 2147 → 3678 tests (+71%), 88 → 123 suites (+40%), 20 → 34 ADRs, worker routes 7 → 11, worker gzip ~75 → ~62 KB (Zod → Valibot net win even after adding Hono + D1 + DO), TTI ~1.4 s → < 1.0 s cached.

**Where we are.** The tactical catch-up is done. The frontier is no longer "modernise" — it is:

1. **Push the edge posture further** (multi-region DO, Workers Queues, Email Workers for digests, Workers AI for optional Hebrew summarisation).
2. **Expand depth, not breadth** (provider redundancy on every remaining card, 7-day history everywhere sparklines help, SimHash-v2 with embeddings for news).
3. **Cross-device continuity without auth** (encrypted config URL + optional WebRTC mirror — no account, no DB).
4. **Ship the tooling monorepo** so BudgetManager / CrossTideWeb / Wedding inherit the gates we built (v14).
5. **Prove vendor-neutrality annually** (rebuild worker on Deno Deploy + Bun Deploy + fly.io once per release).

Nothing below is aspiration decoration. Every line has a gate, an exit criterion, or a trigger.

---

## 1. Competitive Landscape — 2026-Q2 refresh

### 1.1 Comparison matrix (expanded — 10 projects)

We benchmark against nine representative projects, grouped by mission:

- **Family / personal dashboards**: Homepage (gethomepage), Dashy, Homer, Homarr v2, Glance, MagicMirror² (new entrant this refresh).
- **Server/infra monitoring** (architecture-only, not UX peers): Beszel, Dashdot.
- **News-first tickers**: NetNewsWire (reference for RSS depth), Feedly (reference for SimHash/clustering).

| Dimension | **FamilyDashBoard v12.5.0** | **Homepage** | **Dashy** | **Homer** | **Homarr v2** | **Glance** | **MagicMirror²** | **Beszel** | **Dashdot** | **NetNewsWire** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Primary audience | Always-on family TV | Homelab launcher | Homelab dashboard | Static startpage | Homelab mgmt | News/feed dashboard | Smart mirror display | Server monitoring | Server monitoring | News reader |
| Stars (Apr 2026 est.) | ~85 | 44 K | 28 K | 12 K | 16 K | 24 K | 19 K | 7 K | 6 K | 7 K |
| Frontend language | **Vanilla TS strict + Vite 8** | Next.js 15 (React 19) | Vue 3.5 | Vue 3 | Next.js 15 + Mantine 7 | Go templates → HTML | Node + MM modules | Svelte + SvelteKit | React + Vite | Swift (Mac/iOS) |
| Client runtime deps | **0 / ~88 KB gzip** | ~38 | ~22 | ~12 | ~55 | 0 (SSR) | ~15 | ~4 | ~25 | N/A (native) |
| Backend | **Cloudflare Worker (edge)** | Node reverse-proxy | Node/Express | None (static) | Node + tRPC + Drizzle | Single Go binary | Node Express | Single Go binary | Single Go binary | N/A |
| Database | **None user (LS + IDB + KV + D1-anon)** | None (YAML) | None (YAML) | None (YAML) | **SQLite + Drizzle** | None (YAML) | None (JSON) | **SQLite embedded** | None | **SQLite** (feeds) |
| TypeScript strictness | **100% strict + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`** | `strict` | partial | JS-dominant | `strict` | N/A | partial | `strict` | partial | N/A |
| CSS architecture | **Vanilla `@layer` + tokens + Lightning CSS + `@scope`** | Tailwind 4 | SCSS + themes | SCSS | Mantine CSS-in-JS | Hand-written CSS | CSS modules | Tailwind 4 | Tailwind 3 | AppKit/UIKit |
| Tests (unit + E2E + VR + axe) | **3678 unit + Playwright + axe + 54 VR + LHCI + fast-check + Stryker** | Vitest partial | Vitest partial | None | Vitest + PW + Argos CI | Go tests | Minimal | Go tests + Svelte test | Partial | XCTest |
| Visual regression | **Playwright (54 baselines)** | None | None | None | Argos CI | None | None | None | None | Snapshot testing |
| i18n | **Hebrew RTL + English** | 45+ (Crowdin) | 22+ | YAML | 38+ | English-only | 30+ | English-only | English-only | 40+ (Apple) |
| Accessibility | **WCAG 2.2 AA · axe-core gate · parts of 2.2 AAA** | Partial | Partial | Unknown | Partial | Unknown | Partial | Unknown | Unknown | VoiceOver |
| Offline / PWA | **Full SW · 4-tier cache · precache manifest · background sync** | No | Basic PWA | Installable PWA | No | No | No | No | No | Native offline |
| Auth | **None (intentional)** | Host/proxy | Keycloak / basic | None | OIDC + passkey | None | None | Email + 2FA | None | Apple sign-in |
| Config model | **UI panel + JSON export (user-owned)** | YAML + Docker labels | YAML + UI | YAML | UI drag-drop (DB) | YAML | Config.js | UI (DB) | Config.js | UI only |
| Edge proxy / CORS | **Worker + KV stale + Valibot + D1 anon telemetry + Analytics Engine** | Server proxy | Proxy chain | N/A | tRPC over Next | N/A | None | N/A | N/A | None (RSS direct) |
| Observability | **CF Web Analytics + Web Vitals + Error KV + D1 hits + Reporting API + Prometheus `/api/metrics` + Analytics Engine + diag JSON export** | None (self-host) | None | None | Sentry (optional) | Prometheus endpoint | None | Built-in metrics | Prometheus endpoint | Apple telemetry |
| Security headers | **CSP L3 + strict + Trusted Types + COOP/COEP(credentialless)/CORP + Permissions-Policy (28 APIs) + HSTS** | NGINX templates | Varies | None | Next defaults | Go handlers | None | Svelte defaults | Partial | Apple sandbox |
| Supply-chain | **SLSA L2 + SBOM (CycloneDX) + Dependabot + Renovate (Actions SHA) + dependency-review + Stryker mutation** | High (Next churn) | Medium | Low | **Very high** | ~0 (single bin) | Medium | Low | Medium | Apple-signed |
| CI gates | **tsc + tsgo + eslint + markdownlint + vitest + LHCI + axe + VR + bundle + SW + SLSA + commitlint + mutation** | Docker + tests | Docker build | Build only | Build + tests | Go build + test | Node build | Go build + test | Go build + test | Xcode tests |
| License | MIT | GPL-3.0 | MIT | Apache-2.0 | MIT | AGPL-3.0 | MIT | MIT | MIT | MIT |
| Cold-start TTI | **< 1.0 s cached / ~1.6 s fresh** | ~2.5 s | ~3 s | ~1 s (static) | ~3.5 s | ~300 ms | ~2 s | ~500 ms | ~800 ms | N/A |
| Live-data cards | **12 deep, provider-adapted, history-backed** | 100+ widgets (shallow) | 50+ widgets | limited | 30+ integrations | 12 feed types | 100+ modules (shallow) | Server metrics | Server metrics | RSS only |
| Unique protected strengths | **Hebrew/Zmanim/Hebcal, TV-3m, 4-tier offline, zero deps, largest test gate matrix** | Ecosystem size | Themeable | Simplicity | Feature breadth | Go deploy footprint | Mirror form-factor | Go deploy | Go deploy | macOS polish |

### 1.2 Patterns to harvest — 2026-Q2

What we consider, filtered through our mission:

| Pattern | Source | Verdict | Where it lands |
| --- | --- | --- | --- |
| **Workers AI** (Llama 3.3 8B on edge, free tier) | CF 2025 GA | **Adopt narrowly (v13-AI)** | Optional Hebrew summarisation for news card; feature-flag off by default; batched, cached per feed hour. ADR-030. |
| **Workers Queues** for fan-out + retry | CF 2024 GA | **Adopt in v13-EDGE** | Offload error-reporter ingestion from request path; retries on backpressure. |
| **Email Workers** for digest | CF 2024 GA | **Adopt in v13-OPS** | Weekly CSP-violation + provider-health digest to a user-supplied address. Opt-in. |
| **Regional Durable Objects** | CF 2025 GA | **Adopt in v13-EDGE** | Alerts DO pinned to `IL` region drops p95 alert-latency ~ 60 ms. |
| **Workers Smart Placement** | CF 2024 GA | **Adopt across all routes in v13** | Zero-config latency win for origin-fetch routes. |
| **CSS `@property` + `@scroll-timeline` + scroll-driven animations** | CSS WG 2025 | **Adopt in v13** | Scroll-driven ticker + progress rings without JS; zero cost. |
| **CSS Anchor Positioning** | CSS WG 2025 | **Adopt for tooltips + help overlay v13** | Removes `getBoundingClientRect`-driven layout JS. |
| **CSS `light-dark()` function** | CSS WG 2024 | **Adopt in v13** | Collapses dual theme tokens; still inside `@layer tokens`. |
| **Popover API (`popover`, `popovertarget`)** | Browser 2024 | **Adopt in v13** | Replaces `<dialog>` for lightweight menus (stocks-details, card-context menu). |
| **`scrollend` event + `overscroll-behavior: contain`** | Browser 2025 | **Adopt** | Improves auto-loop-scroll re-anchoring after manual pause. |
| **Fetch `Retry-After` + `AbortSignal.timeout()`** | Browser 2025 | **Already partial; fully adopt v13** | Replaces custom `fetchWithTimeout`; drops ~40 LOC. |
| **Document Picture-in-Picture API** | Browser 2024 | **Evaluate for video-news card v13** | PiP the video into a corner while other cards refresh. |
| **URL Pattern API** | Browser 2024 | **Already on worker (Hono uses it); expose in client for dynamic routes** | v13. |
| **Shared Element Transitions L3 (cross-doc)** | CSS WG draft 2026 | **Track** | Revisit v14. |
| **WebGPU offscreen canvas for stocks chart** | Browser 2025 | **Reject** | Our charts are SVG under 30 KB; no perf problem to solve. |
| **Temporal API (Stage 3)** | TC39 2026 | **Adopt when polyfill < 10 KB gzip** | Ditches ad-hoc date arithmetic in Hebrew-cal + calendar. Track. v14. |
| **TC39 Signals (Stage 3)** | TC39 2026 | **Adopt when polyfill < 1.5 KB + concrete card benefit** | `state.ts` replacement. v14. |
| **Rolldown** (Vite's Rust bundler) | Vite 2026 | **Adopt once Vite 8 default** | Zero config change. |
| **Bun 1.2 test runner** | Bun 2026 | **Track only** | Vitest 4.1 ecosystem lead > Bun parity; revisit v15. |
| **tRPC-style end-to-end types** | Homarr v2 | **Superseded** | Our `openapi-ts`-generated `worker-client.ts` already gives end-to-end types without the framework lock. |
| **AGPL copyleft** | Glance | **Reject** | MIT aligns with family-project distribution. |
| **Single-binary deploy** | Glance, Beszel | **Already harvested** | `dist.zip` + `worker.js` pinned by SLSA. |
| **Native Bluetooth / sensor APIs** | MagicMirror² | **Reject** | Permissions-Policy denies them. |
| **SimHash → embeddings dedup** | Feedly | **Adopt in v13-DATA** | SimHash catches paraphrases; small multilingual embedding (Workers AI `@cf/baai/bge-small-en` + Hebrew equivalent) catches cross-paraphrase near-dupes. |

### 1.3 Our protected unique strengths

1. **Zero runtime deps on the client** — genuinely rare; most competitors ship 30–55.
2. **TV-first at 3 m** — no competitor targets this ergonomic.
3. **Hebrew RTL + Zmanim + Hebcal + Sefaria + Tzeva-Adom native** — unique.
4. **12 deep, provider-adapted cards with normalized history** — depth over breadth.
5. **4-tier offline** (mem → LS → IDB → SW) — no competitor renders a useful dashboard `navigator.onLine === false`.
6. **3678 tests + axe + VR + LHCI + Stryker + SLSA** — highest quality-gate density in the table.
7. **Observable in production** (RUM + Vitals + Errors + Reports + Analytics Engine + Prometheus) with zero tracking cookies.
8. **One-binary-ish deployment** — static ZIP + one worker.js, SLSA L2, SBOM per release.

---

## 2. First-principles reopen — every decision re-examined (2026-Q2)

All 29 ADRs re-litigated, plus decisions not yet formalised. Every row is stamped **Keep**, **Adopt**, **Replace**, **Defer**, **Reject**, or **Supersede**.

### 2.1 Frontend — language, build, framework, state, CSS

| # | Decision | Current | Verdict | Action |
| --- | --- | --- | --- | --- |
| F1 | TypeScript strictness (`strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`) | 6.0.3 | **Keep** | Annual re-review. Still exemplary. |
| F2 | **tsgo** (TypeScript-Go) as second typecheck | In CI (ADR-021) | **Keep** | Promote to primary when (a) stable on `--build` mode, (b) project refs parity, (c) 2+ release cycles green. Tentative v14. |
| F3 | Build tool — Vite 8 (Rollup) | Shipped | **Keep; auto-adopt Rolldown on Vite default** | No code action. |
| F4 | Runtime framework — Vanilla DOM + `FdbCard` (ADR-005) | Shipped | **Keep** | Reconfirmed for the 4th time. No competitor has shown a benefit we lack. |
| F5 | Web Components / Lit (ADR-001) | Rejected | **Keep rejection** | Shadow DOM still breaks global `@layer` theming. `@scope` (ADR-022) gives encapsulation without theming tax. |
| F6 | Module format — native ESM | Shipped | **Keep** | Correct forever at this scale. |
| F7 | Zero client runtime deps (ADR-002) | 0 deps, ~88 KB gzip | **Keep (load-bearing)** | Non-negotiable. |
| F8 | Signals (TC39 Stage 3) | `state.ts` ~70 LOC | **Track** | Adopt when (a) stage 3, (b) polyfill < 1.5 KB gzip, (c) concrete card benefit. Candidate: v14. |
| F9 | CSS approach — vanilla `@layer` + tokens + Lightning CSS (ADR-008, ADR-017) | Shipped | **Keep** | Reconfirmed. Tailwind 4 rejected. |
| F10 | CSS `@scope` per card (ADR-022) | Shipped | **Keep** | 16 unit tests enforce it. |
| F11 | CSS `light-dark()`, `@property`, scroll-driven animations, Anchor Positioning | Not used | **Adopt in v13** | All zero-cost; progressive-enhancement only. |
| F12 | View Transitions L2 (cross-doc) | Shipped for theme switch + config-panel | **Keep; expand to maximise-card flow** | v13. |
| F13 | Speculation Rules API | Shipped (prefetch preview) | **Keep; audit coverage** | Audit every external link for `moderate` vs `conservative`. v13. |
| F14 | Trusted Types + CSP L3 `require-trusted-types-for 'script'` | Shipped | **Keep** | Defence-in-depth; no offenders. |
| F15 | Popover API | Not used | **Adopt in v13** | Replaces `<dialog>` for lightweight menus. |
| F16 | Document Picture-in-Picture (video-news card) | Not used | **Evaluate v13** | Gate on user request ≥ 3. |
| F17 | Bundle analyzer — `check-bundle-size.mjs` with per-card breakdown | Shipped | **Keep; add per-card delta alert** | Fail CI on > 10 % growth per card (currently whole-bundle only). v13. |
| F18 | Typed worker client from OpenAPI (ADR-021) | `src/core/worker-client.ts` shipped | **Keep; regenerate on every worker OpenAPI change** | Add pre-commit check that compares hash of generated file to checked-in. v13. |
| F19 | Lightning CSS (ADR-017) | Shipped | **Keep** | Reconfirmed; continue to pin version. |
| F20 | Vanilla DOM refs cache (`el` object pattern) | Shipped | **Keep** | Documented in ARCHITECTURE.md. |
| F21 | FLIP animations (maximise-card) | Shipped | **Keep; migrate to View Transitions L2 when cross-doc ready** | v14. |

### 2.2 Backend — worker runtime, validation, storage

| # | Decision | Current | Verdict | Action |
| --- | --- | --- | --- | --- |
| B1 | Cloudflare Worker (ADR-003) | Shipped | **Keep** | Annual vendor-neutrality drill (see B11). |
| B2 | Hono router (ADR-026) | Shipped, replaced hand-written | **Keep** | Reconfirmed. First-class with Valibot. |
| B3 | Valibot validation (ADR-023) | Shipped, replaced Zod | **Keep** | ~25 KB worker win. |
| B4 | KV stale cache (ADR-013) | All 11 routes | **Keep; annual audit of TTLs** | Document per-route TTL in OpenAPI description. v13. |
| B5 | D1 telemetry (ADR-024) | Shipped v12.1 | **Keep; tighten schema in v13** | Add route-level p95 latency aggregation. |
| B6 | Durable Objects — alerts SSE (ADR-025) | Shipped stub; SSE wiring deferred | **Complete in v13-EDGE** | Finish SSE client + alerts card subscription. Drops per-client polling. |
| B7 | Workers Analytics Engine (ADR-029) | Middleware shipped | **Keep; query dashboard in v13** | Grafana Cloud free-tier. |
| B8 | Reporting API + D1 (ADR-028) | Shipped | **Keep; weekly digest v13-OPS** | Email Workers. |
| B9 | Worker cron triggers — pre-warm | 3 triggers shipped | **Keep; add 29-Elul next-year pre-warm audit** | v13. |
| B10 | Prometheus `/api/metrics` | Shipped (token-gated) | **Keep; expose provider-health histogram in v13** | |
| B11 | **Annual vendor-neutrality build drill** | Not yet run | **Adopt** | Prove `worker/src` builds on Deno Deploy + Bun Deploy + fly.io once per major release. Green = we retain the exit door without spending weekly on it. v13 release ritual. ADR-031. |
| B12 | Workers Queues for error-reporter fan-out | Not used | **Adopt v13-EDGE** | Offloads from request path; retries on backpressure. ADR-032. |
| B13 | Email Workers for digest | Not used | **Adopt v13-OPS (opt-in)** | Weekly CSP + provider-health summary. ADR-033. |
| B14 | Regional Durable Objects (IL) | Not used | **Adopt v13** | Pin alerts DO to `IL` region. |
| B15 | Smart Placement | Not used | **Adopt v13** | Zero config. |
| B16 | Workers AI (optional Hebrew summarisation) | Not used | **Adopt v13-AI, feature-flag OFF** | News card: 1-line Hebrew digest per feed, cached 1h. ADR-030. |
| B17 | Hyperdrive (Postgres) | — | **Reject (re-confirm)** | No Postgres in stack. |
| B18 | User-facing database | **None** | **Keep rejection** | LS + IDB + JSON export. Cross-device continuity via encrypted config URL, not a DB. |
| B19 | Rate limiting (DO counter) | In-memory per-IP | **Upgrade v13** | Per-client adaptive back-off. |
| B20 | Worker bundle budget | ~62 KB gzip | **Keep budget ≤ 75 KB gzip through v13** | Enforced in CI. |

### 2.3 Data plane — APIs, providers, aggregation, history

| Card/Area | Current | Verdict | Action |
| --- | --- | --- | --- |
| News (17 RSS via `/api/news`) | Worker-aggregated, SimHash v1, Valibot | **Keep; SimHash v2 with embeddings v13-DATA** | Add `@cf/baai/bge-small-en` (+ Hebrew equivalent) for paraphrase robustness. Gate: precision@10 > baseline by 15 %. |
| Weather — Open-Meteo primary + `met.no` backup | Shipped | **Keep; add `api.weather.gov` for US-travel mode v13** | Opt-in. |
| Stocks — Yahoo v8 primary + Finnhub backup | Shipped | **Promote Finnhub to primary v13-DATA** | Yahoo v8 broke 3× historically. Finnhub Free 60 rpm, WebSocket streaming option for v14. |
| Currency — ER-API + ExchangeRate + Yahoo futures (metals) | Shipped | **Keep** | Stable in v12.x window. |
| Calendar — ICS + RRULE | Shipped | **Keep; icalendar-rfc5545 spec fuzz tests expanded** | 13 → 25 fuzz cases. v13. |
| Hebrew-Cal (Hebcal) | Shipped + annual pre-warm | **Keep** | Best-in-class. |
| Alerts (Tzeva Adom) | Polled | **Upgrade to DO + SSE v13-EDGE (B6)** | Drops per-client polling. |
| Sefaria | Worker-proxied, Valibot | **Keep** | |
| Bitcoin (CoinGecko) | `/api/crypto` | **Keep** | Stable. |
| Video-news (7 channels) | iframe mode | **Keep; evaluate Picture-in-Picture v13** | Gate: user request ≥ 3. |
| System-info | Shipped + 7-day battery sparkline | **Keep; add 7-day connection-type sparkline v13** | |
| Motivation | Quote rotation | **Keep; add worker-AI Hebrew quote generation v13-AI (opt-in)** | Daily 1 quote, cached 24 h. |
| Tasks | Daily checklist | **Keep; add recurring weekly/monthly v13** | Config-driven. |
| Countdown (3 slots) | Shipped | **Keep** | |
| **History everywhere** | stocks, battery | **Expand v13-DATA** | 7-day rolling for weather, currency, crypto, alerts count. Unified `core/history.ts` already shipped. |

### 2.4 Testing & quality

| Decision | Current | Verdict | Action |
| --- | --- | --- | --- |
| Unit runner — Vitest 4.1.5 + happy-dom 20 | Shipped | **Keep** | |
| E2E — Playwright | Shipped | **Keep** | |
| VR — Playwright screenshots (54 baselines) | Shipped | **Expand to 80+ v13** | Add DO-SSE alert states, video-news channel variants. |
| LHCI — perf ≥ 95, a11y ≥ 98, BP ≥ 95, SEO ≥ 90 | Shipped | **Tighten perf to 97 v13** | TTI < 1 s is sticky. |
| axe-core per screen mode | Shipped | **Keep** | |
| Property tests (`fast-check`) — cache, config, ICS, SimHash | Shipped | **Expand to worker-client v13** | End-to-end envelope invariants. |
| Mutation tests (Stryker) — SimHash, analytics, D1, canary | Shipped | **Keep; add error-tracker + config v13** | Threshold ≥ 85 %. |
| `@vitest/browser` component-in-browser tests | Not used | **Adopt v13** | For cards whose DOM is too complex for happy-dom (maximise-FLIP, layout-drag). Keeps unit suite fast. |
| Coverage thresholds — 94/88/94/95 | Shipped | **Raise to 95/90/95/96 v13** | |
| CI pre-release gate | Shipped (`release.yml`) | **Keep** | Reconfirmed in v12.3. |
| commitlint (Conventional Commits) | Shipped | **Keep** | |
| changesets auto-CHANGELOG | Not used | **Adopt v13-OPS** | Removes last human release step. ADR-034. |

### 2.5 Observability

| Decision | Current | Verdict | Action |
| --- | --- | --- | --- |
| Client diag — `diagLog` + `D` overlay + `Ctrl+Shift+E` JSON export v1 schema | Shipped | **Keep; bump schema v2 when needed** | Version-gated. |
| Error KV — last 1000, 7-day TTL | Shipped | **Keep** | Debug mode. |
| RUM — CF Web Analytics + inline Web Vitals | Shipped | **Keep; add Speculation Rules prerender metric v13** | |
| Prometheus `/api/metrics` token-gated | Shipped | **Keep** | |
| Reporting API `/api/reports` → D1 | Shipped | **Keep; weekly digest v13-OPS** | |
| Analytics Engine | Shipped | **Query dashboard v13** | |
| OpenTelemetry from worker | — | **Defer to v14** | Value unclear at 100K req/day. |

### 2.6 Security

| Decision | Current | Verdict | Action |
| --- | --- | --- | --- |
| CSP L3 strict | Shipped | **Keep; annual audit** | |
| Trusted Types | Shipped | **Keep** | |
| COOP / COEP `credentialless` / CORP | Shipped (v12.1) | **Keep** | |
| Permissions-Policy (28 APIs denied) | Shipped | **Keep; add newly-shipped APIs each release** | |
| HSTS `max-age=2592000` | Shipped | **Keep** | |
| Reporting API ingestion | Shipped | **Keep** | |
| SRI (subresource integrity) | N/A | **Document** | `docs/security.md` §11. v13. |
| SLSA build provenance | L2 | **Upgrade to L3 (hermetic) v14** | |
| SBOM (CycloneDX) per release | Shipped | **Keep** | |
| Dependabot + Renovate (Actions SHA) | Shipped | **Keep** | |
| Dependency-review on every PR | Shipped | **Keep** | |
| Secret rotation — `wrangler secret` | Shipped | **Rotate on every major release** | Cheap hygiene. |
| Worker canary header | Shipped (plumbing) | **Wire canary route v13** | 1 % traffic, 24 h bake. |

### 2.7 Infrastructure & deployment

| Decision | Current | Verdict | Action |
| --- | --- | --- | --- |
| Static host — GitHub Pages | Shipped | **Keep; evaluate Cloudflare Pages v14** | |
| Worker deploy — Wrangler + SLSA | Shipped | **Keep** | |
| CDN cache headers | Tightened v12.1 | **Keep** | |
| Release artifact — `dist.zip` + SHA-256 + SLSA + SBOM | Shipped | **Keep** | |
| GitHub Actions — SHA-pinned | Shipped | **Keep; Renovate handles rotation** | |
| Canary worker route | Plumbing shipped | **Wire v13** | |
| Multi-region — CF handles by default | Shipped | **Keep** | Regional DO for IL only (alerts). |

### 2.8 Documentation & DX

| Decision | Current | Verdict | Action |
| --- | --- | --- | --- |
| ADR count | 29 | **Pace ~1 per major decision; tentative 30 → 36 in v13** | |
| ARCHITECTURE.md — version-pinned + Mermaid + auto-generated card table | Shipped (`arch:table` script) | **Keep** | |
| AI customisation — instructions + skills + prompts + agents | Shipped | **Keep; add `release-check` auto-invocation v13** | |
| OpenAPI — `worker/openapi.yaml` | Shipped; drives `worker-client.ts` | **Keep** | |
| Conventional Commits + changesets | commitlint shipped; changesets deferred | **Adopt changesets v13-OPS** | |
| Pre-commit hooks | Rejected | **Keep rejection** | Editor tasks + CI sufficient. |
| Mono-repo tooling (`tooling/` presets) | Shipped (ADR-014) | **Extend to BudgetManager/CrossTideWeb/Wedding v14** | |
| `.github/copilot/MCP_SERVERS.md` | Shipped | **Keep; add GitKraken + Azure matrix** | v13. |
| `docs/adr/README.md` index | Shipped | **Auto-generate from ADR frontmatter v13** | Kills index drift. |

### 2.9 Decisions explicitly held rejected (re-confirmed 2026-Q2)

| Decision | Status | Re-confirmed because |
| --- | --- | --- |
| Client framework rewrite (React/Vue/Svelte/Solid) | Rejected (ADR-005) | 4th reconfirm. No competitor benefit we lack. |
| Shadow DOM | Rejected (ADR-001) | Breaks global `@layer`. |
| User-facing database | Rejected | LS + IDB + JSON export covers everything; a DB creates multi-device-sync expectations we won't own. |
| OIDC / passkey auth | Rejected | Single-household device; largest new attack surface for zero benefit. |
| 40+ language i18n (Crowdin) | Rejected | Family product. Hebrew + English. `i18n.ts` keeps the door open. |
| Pre-commit hooks | Rejected | Editor + CI sufficient; adds CI-only-style debugging burden. |
| WebGPU / WASM hot paths | Rejected | No hot path justifies either at our scale. |
| OPFS structured cache | Rejected | IDB mature, cross-browser; OPFS solution in search of a problem. |
| AGPL | Rejected | MIT aligns with family-project distribution. |
| Multi-tenant Workers for Platforms | Rejected | Single-tenant product. |
| 3rd language (Arabic, German) | Deferred | Only if a contributor offers to maintain it. |

---

## 3. Strategic Streams (v13 → v15)

Each stream lists deliverables, ADR candidates, exit criteria, and gate triggers.

### 3.1 Stream V13-EDGE — Edge completion (v13.0, highest priority)

Finish what v12.1 started.

**Deliverables**

- [ ] `alerts` card SSE subscription backed by Durable Object (wire the stub shipped in v12.1).
- [ ] Regional Durable Objects pinned to `IL` for alerts.
- [ ] Workers Queues for error-reporter fan-out + retry. ADR-032.
- [ ] Workers Smart Placement across all origin-fetch routes.
- [ ] Canary route wired (`X-Canary` header already flows in 1 % traffic; needs a second worker deploy with `CANARY_PCT` set). 24 h bake before promote.
- [ ] Rate limiting via DO counter (per-client adaptive back-off).
- [ ] OpenAPI-driven description of per-route KV TTLs.

**Exit**: alerts card p95 latency < 150 ms (currently ~800 ms cold hit), zero user-observable canary regression in bake, DO counter live for all 11 routes.

### 3.2 Stream V13-AI — Optional Workers AI (v13.1, feature-flag off)

**Deliverables**

- [ ] `/api/news/summarise` — Hebrew 1-line digest per feed per hour; cached in KV. ADR-030.
- [ ] `/api/motivation/hebrew` — daily 1-quote Hebrew generation. Opt-in via config flag; default: curated list.
- [ ] News SimHash v2 with embedding layer (`@cf/baai/bge-small-en` + Hebrew). Gate: precision@10 > baseline by 15 %.

**Exit**: feature-flag defaults OFF; zero impact on non-AI users (bundle, latency, tokens).

### 3.3 Stream V13-DATA — Card depth (v13.2)

| Card | Action |
| --- | --- |
| stocks | Finnhub → primary; Yahoo → tertiary; 7-day history sparkline (already shipped); add volume sparkline. |
| news | SimHash v2 with embeddings (see V13-AI). |
| weather | 7-day history sparkline (temp + precip). `api.weather.gov` for US-travel mode (opt-in). |
| currency | 7-day history sparkline (XAU / XAG / USD / EUR / GBP). |
| crypto | 7-day price history sparkline. |
| alerts | DO-SSE live count + 7-day history sparkline (incidents/day). |
| hebrew-cal | Next-year holiday pre-warm audit (29 Elul trigger). |
| calendar | icalendar-rfc5545 fuzz tests 13 → 25 cases. |
| sefaria | Valibot strict mode (currently lenient). |
| motivation | Worker-AI Hebrew quote (see V13-AI, opt-in). |
| tasks | Recurring weekly/monthly tasks (config-driven). |
| system-info | Connection-type + downlink sparkline. |

**Exit**: every card has provider-redundant path + typed-validated payload + stale-fallback + 7-day history where it aids legibility.

### 3.4 Stream V13-A11Y — 2.2 AAA closure + cognitive (v13.3)

- [x] WCAG 2.4.11 Focus not obscured (enhanced)
- [x] WCAG 3.2.6 Consistent help
- [x] WCAG 3.3.7 Redundant entry
- [x] WCAG 2.4.6 Headings
- [ ] WCAG 3.1.5 Reading level (cognitive) — run Hebrew readability on all card copy
- [ ] WCAG 1.4.12 Text spacing — `letter-spacing`, `line-height`, `word-spacing` min assertions in VR tests
- [ ] Voice-control semantic names — every interactive element has a unique accessible name (verify via axe custom rule)
- [ ] Screen-reader heading-skip audit across all dialogs

### 3.5 Stream V13-OPS — Operations polish (v13.4)

- [ ] `changesets` auto-CHANGELOG (removes last human release step). ADR-034.
- [ ] Email Workers weekly digest (CSP violations + provider health + 5xx rate). Opt-in. ADR-033.
- [ ] `release-check.prompt` auto-invoked in `release.yml`.
- [ ] Renovate Bot for Action SHA rotation (already shipped — extend to worker dependabot).
- [ ] `docs/adr/README.md` auto-generated from ADR frontmatter (kills index drift).

### 3.6 Stream V13-CONTINUITY — Cross-device without auth (v13.5, gated)

**Gate trigger**: 3+ users request it in an issue thread.

- [ ] Encrypted config URL export (AES-GCM with user-chosen passphrase; output: `fdb://config#<base64>`).
- [ ] Import flow: paste URL → prompt passphrase → decrypt → apply.
- [ ] Optional: short-lived WebRTC mirror (no server, QR-code pairing, 5-min window). Zero CF resource cost.
- [ ] Documentation: `docs/sync.md`.

**Exit**: zero DB, zero account, zero worker-storage. Purely client-side crypto + user-owned medium (clipboard, URL, QR).

### 3.7 Stream V14-TC39 — Platform primitives (v14.0, gated)

**Triggers**

- **Signals** (TC39): stage 3 + polyfill < 1.5 KB gzip + concrete card benefit.
- **Temporal**: stage 3 + polyfill < 10 KB gzip.
- **Shared Element Transitions L3 (cross-doc)**: Chrome + Safari ship.

**Deliverables (if triggers fire)**

- [ ] `state.ts` → Signals (incremental, card-at-a-time).
- [ ] Hebrew-cal + calendar date arithmetic → Temporal.
- [ ] View Transitions → cross-doc for theme switch (already L2 same-doc).

### 3.8 Stream V14-HARMONISE — Mono-repo reference (v14.1)

- [ ] BudgetManager / CrossTideWeb / Wedding all on `tooling/eslint/web-ts-app.mjs` + `tooling/tsconfig/base-typescript.json`.
- [ ] Shared `tooling/vitest/happy-dom.mjs` preset across all three.
- [ ] Shared `tooling/ci/` reusable workflow fragments.
- [ ] `tooling/README.md` becomes the cross-project handbook.
- [ ] Cross-project release gate (each repo's `release.yml` extends a shared composite action).

### 3.9 Stream V14-SECURITY-L3 — SLSA + supply-chain (v14.2)

- [ ] SLSA L3 (hermetic build).
- [ ] Dependency attestation (sigstore/cosign) per release.
- [ ] Secret-scanning attestation in SBOM.

### 3.10 Stream V15-PRODUCT — Optional evolution (gated)

| Candidate | Gate |
| --- | --- |
| User-supplied background URL list + Cloudflare Images resize | 5+ users request it |
| Stocks WebSocket live-stream (Finnhub) | TTI + battery budget fit |
| Document Picture-in-Picture on video-news | User request ≥ 3 |
| TC39 Signals adoption | See §3.7 |
| Cloudflare Pages migration | Measurable TTI or caching regression on Pages |
| OpenTelemetry from worker | Scale demands it |
| AI summary card (local Hebrew LLM, WASM quantised) | Viable open-weight Hebrew model ≤ 20 MB at useful speed |
| 3rd language (Arabic, German) | Contributor offers to maintain it |

---

## 4. Release Plan

### 4.1 v12.4.x — Post-12.3.0 maintenance

Patch-only. Bug fixes, doc corrections, minor provider hardening. Explicit: no scope for new features.

### 4.2 v13.0 — **Edge completion** (target: 2026-Q3)

Ships Stream V13-EDGE. Hard gate:

- DO-backed alerts SSE live; regional DO in IL; Workers Queues for errors; Smart Placement on all origin routes; canary route operational; DO-based rate limiter.

### 4.3 v13.1 — **Workers AI (optional)** (target: 2026-Q3)

Ships Stream V13-AI. Hard gate:

- Feature-flag OFF by default; SimHash v2 precision@10 gate met; zero latency/bundle impact for opt-out users.

### 4.4 v13.2 — **Card depth** (target: 2026-Q4)

Ships Stream V13-DATA. Hard gate:

- Every card: provider-redundant + validated + stale-fallback + (where applicable) 7-day history.

### 4.5 v13.3 — **Accessibility AAA & cognitive** (target: 2026-Q4)

Ships Stream V13-A11Y. Hard gate:

- All 2.2 AA + selected 2.2 AAA criteria green; Hebrew readability audit passed; text-spacing assertions in VR.

### 4.6 v13.4 — **OPS polish** (target: 2026-Q4)

Ships Stream V13-OPS. Hard gate:

- changesets auto-CHANGELOG; weekly digest; auto-ADR-index; auto-release-check.

### 4.7 v13.5 — **Cross-device continuity (gated)** (target: 2027-Q1 if triggered)

Ships Stream V13-CONTINUITY. Only if gate triggered.

### 4.8 v14.0 — **TC39 platform primitives (gated)** (target: 2027-Q1/Q2)

Ships Stream V14-TC39. Only if triggers fire.

### 4.9 v14.1 — **Mono-repo reference** (target: 2027-Q2)

Ships Stream V14-HARMONISE.

### 4.10 v14.2 — **SLSA L3 + supply-chain** (target: 2027-Q2)

Ships Stream V14-SECURITY-L3.

### 4.11 v15.0 — **Optional evolution (gated)** (target: 2027-Q3+)

Only items from §3.10 with passed gates.

---

## 5. Architecture Principles (v12.3.0 edition)

These are the rules the above decisions all derive from.

1. **Product truth over roadmap neatness** — plan what we will build, not what sounds good.
2. **Incremental convergence over grand rewrites** — finish before starting.
3. **Normalised data contracts over provider leakage** — cards render domain models, never raw upstream JSON.
4. **Instance-owned lifecycle** — `FdbCard` owns refresh, DOM, subscriptions, teardown.
5. **TV readability at 3 m** — legible in a dark room, from across the room.
6. **Zero client runtime deps stays zero** — ADR-002 is load-bearing.
7. **Exactly two worker runtime deps** — reviewed each major release; current: Hono + Valibot. Any third requires ADR.
8. **Edge-first data** — worker normalises, validates, caches; client only renders.
9. **Observability is a first-class feature** — `diagLog`, provider health, Web Vitals, error KV, D1, Analytics Engine, Reporting API, Prometheus.
10. **Docs match runtime** — no aspirational docs; ADRs for reversals.
11. **No new persistence without product need** — LS → IDB → KV → D1-anon in that order, justified each time. No user-facing DB.
12. **Security posture improves every major release** — CSP L3 shipped; SLSA L3 next.
13. **Protect unique strengths** — zero client deps, RTL-first, TV design, offline resilience, largest test gate matrix in the comparison.
14. **Reopen clean decisions annually** — staying correct is more work than getting correct. This ROADMAP is the record of the annual re-litigation.
15. **Vendor-neutrality is a drill, not a deploy target** — annual rebuild on Deno Deploy / Bun Deploy / fly.io proves the exit door exists without spending weekly on it.
16. **Gate optional features on user demand** — no speculative scope. A feature without a user is tech debt.
17. **One language per layer** — TS in client + worker, no Rust/Go/WASM until a specific hot path justifies it.

---

## 6. Immediate Next Actions (v13.0 runway)

Execute in order. Each becomes one or more v13.x sprints.

1. **V13-EDGE-1** — Wire `alerts` card SSE client to the Durable Object stub shipped in v12.1. Unit + E2E + VR test for live-event path.
2. **V13-EDGE-2** — Deploy regional DO pinned to `IL` region for alerts.
3. **V13-EDGE-3** — Workers Queues for error-reporter (ADR-032). Offloads ingestion from request path.
4. **V13-EDGE-4** — Workers Smart Placement flag on all origin-fetch routes.
5. **V13-EDGE-5** — Canary route wired (`CANARY_PCT=1` worker deploy; 24 h bake).
6. **V13-EDGE-6** — DO counter rate limiter across all 11 routes.
7. **V13-EDGE-7** — Per-route KV TTL documented in `worker/openapi.yaml`.
8. **V13-AI-1** — `/api/news/summarise` behind feature flag (ADR-030). Hebrew 1-line digest. Cached 1 h per feed.
9. **V13-AI-2** — SimHash v2 with embeddings on news dedup; precision@10 gate.
10. **V13-DATA-1** — Finnhub → primary for stocks.
11. **V13-DATA-2** — 7-day history sparklines on weather, currency, crypto, alerts.
12. **V13-A11Y-1** — Hebrew readability audit + text-spacing VR assertions.
13. **V13-OPS-1** — changesets auto-CHANGELOG (ADR-034). Delete manual CHANGELOG sprint headers.
14. **V13-OPS-2** — Email Workers weekly digest (ADR-033).
15. **V13-OPS-3** — Auto-generate `docs/adr/README.md` from ADR frontmatter.

---

## 7. Quality Gates — non-negotiable at every release

| Gate | Current value | v13 target |
| --- | --- | --- |
| TypeScript errors | 0 | 0 |
| ESLint errors | 0 | 0 |
| ESLint warnings | 0 | 0 |
| `eslint-disable` occurrences | 0 | 0 |
| `@ts-ignore` occurrences | 0 | 0 |
| markdownlint issues | 0 | 0 |
| Unit test failures | 0 / 3775 | 0 / 3800+ |
| Playwright failures | 0 | 0 |
| axe serious/critical | 0 | 0 |
| Dead code (ts-unused-exports) | 0 | 0 |
| Dead config files | 0 | 0 |
| LHCI perf (median) | ≥ 95 | ≥ 97 |
| LHCI a11y | ≥ 98 | ≥ 99 |
| LHCI BP | ≥ 95 | ≥ 95 |
| LHCI SEO | ≥ 90 | ≥ 92 |
| Coverage (lines / branches / functions / statements) | ≥ 87 / 77 / 84 / 86 | ≥ 90 / 82 / 90 / 90 |
| Mutation score (Stryker targets) | ≥ 85 % | ≥ 88 % |
| Client bundle gzip | ~88 KB | ≤ 100 KB |
| Worker bundle gzip | ~62 KB | ≤ 75 KB |
| TTI cached | < 1.0 s | < 0.9 s |
| TTI fresh | < 1.6 s | < 1.4 s |
| SLSA provenance | L2 | L2 (L3 targeted v14) |
| SBOM per release | Yes | Yes |
| Dependency-review on every PR | Yes | Yes |
| npm audit (high+) | 0 | 0 |
| Supply-chain attack surface (client) | 0 deps | 0 deps |
| Supply-chain attack surface (worker) | 2 deps | ≤ 2 deps |
| Open GitHub issues for the milestone before tag | 0 | 0 |

---

## 8. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Cloudflare pricing change | Low | Medium | Annual vendor-neutrality drill (§2.2 B11). |
| Yahoo v8 breaks again | Medium | High for stocks card | Finnhub primary v13 (§3.3). |
| Workers AI outage | Medium | Low (feature-flag off) | AI features all gated; zero impact on default config. |
| CF D1 schema migration complexity | Low | Low | D1 is anon telemetry only; can be dropped + recreated in place. No user data loss risk. |
| tsgo regression on `--build` mode | Low | Low | Stays as second typecheck; `tsc` remains primary until 2+ release cycles green. |
| Browser compat regression from `@scope`, View Transitions, Popover | Low | Low | All progressive enhancement; feature-detect + fallback; VR catches. |
| Hono or Valibot supply-chain compromise | Low | High | Dependabot + Renovate + SLSA + SBOM; vendored-fallback plan documented in `docs/security.md` §9. |
| Test suite duration balloon | Medium | Medium | `@vitest/browser` for heavy-DOM cards (§2.4) keeps unit suite fast. |
| ADR drift vs code | Medium | Medium | Auto-generate ADR index v13; `scripts/lint-instructions.mjs` already catches frontmatter drift. |
| Bundle bloat from V13-AI | Low | Medium | Feature-flag default OFF; AI routes strictly worker-side. |
| OS-level Hebrew rendering regression (TV) | Low | High | VR baselines on he+RTL already; LHCI a11y gate; real-device smoke before each tag. |

---

## 9. Glossary (v12.3.0)

- **ADR** — Architectural Decision Record (`docs/adr/`), one per major reopened decision.
- **FdbCard** — base class all 12 cards extend; owns DOM refs, refresh timer, subscriptions.
- **Worker envelope** — `{ ok, data, error, stale, meta }` uniform response shape (ADR-011).
- **4-tier cache** — in-memory Map → localStorage → IndexedDB → Service-Worker precache (ADRs 010, 013).
- **Provider adapter** — async adapter that hides per-provider JSON shapes (ADR-012).
- **`@scope`** — CSS scoped rules per card (ADR-022).
- **Canary** — fractional worker deploy tagged via `X-Canary` header (ADR-029 section 2).
- **Vendor-neutrality drill** — annual rebuild of `worker/src` on Deno Deploy + Bun Deploy + fly.io; proves exit door.
- **Gate** — quantitative condition that must hold before a stream ships (e.g. SimHash-v2 precision@10 gate).

---

## 10. What changed vs the previous ROADMAP (v11.5.1 edition)

- **Baseline updated** v11.5.1 → v12.3.0 (+177 tests, +8 suites, +9 ADRs).
- **v12 streams (MODERNISE, EDGE, DATA, A11Y+, OPS)** moved from "planned" to "shipped" or "in progress"; residuals consolidated into V13-EDGE / V13-DATA / V13-A11Y / V13-OPS.
- **New streams added**: V13-AI (Workers AI optional), V13-CONTINUITY (encrypted config URL), V14-SECURITY-L3.
- **Comparison matrix** refreshed to 10 projects (added MagicMirror², Dashdot, NetNewsWire).
- **All 29 ADRs re-litigated** in §2 with explicit Keep/Adopt/Replace/Defer/Reject/Supersede stamps.
- **New quality-gate table** (§7) consolidates all numeric thresholds.
- **Risks table** (§8) promoted to first-class; was scattered across streams.
- **Annual vendor-neutrality drill** (§2.2 B11) formalised as an ADR candidate (ADR-031).
- **Principles renumbered** 1 → 17 (was 1 → 14); added: vendor-neutrality as drill, gate-on-demand, one-language-per-layer.
