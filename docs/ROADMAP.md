# FamilyDashBoard — Strategic Roadmap v10.0

> **Refresh date**: 2026-05-19
> **Shipped baseline**: v15.3.0
> **Product surface**: 12 cards · 7 themes · 3 screen modes · 0 client runtime dependencies
> **Purpose**: forward plan only. Historical sprints and shipped work → [CHANGELOG.md](../CHANGELOG.md).

---

## 0. Executive Position

FamilyDashBoard competes in the **ambient family information display** space — a category served by MagicMirror², Glance, Homepage, Home Assistant Lovelace, Homarr, Dakboard, and various e-ink devices. Our differentiators:

| Differentiator            | Strength vs field                                                   |
| ------------------------- | ------------------------------------------------------------------- |
| Zero runtime dependencies | Only project in category with 0 client npm deps AND offline-first   |
| Hebrew RTL native         | Only ambient dashboard natively supporting Hebrew + Jewish calendar |
| TV-first density          | Optimized for 1920×1080 always-on at 3m reading distance            |
| Privacy by architecture   | No auth, no accounts, no cloud DB — local-first localStorage + IDB  |
| Edge-augmented, not bound | Cloudflare Worker optional proxy; dashboard works fully without it  |
| Custom reactivity         | In-house ~1KB signals system aligned to TC39 Stage 3 proposal       |
| Production toolchain      | 27 automated checks gate every release (not just lint+test)         |

The goal of this roadmap is to push every layer to **best-in-class** across reliability, maintainability, and information clarity. We do not add complexity for its own sake.

### 0.1 Non-Negotiables

1. **One production bar.** CI, release, and local scripts describe the same gate
2. **Zero tolerated quality drift.** Stale counts, dead code, and waived rules are not accepted
3. **Generated output ≠ product structure.** Intermediate files → `$TEMP`, artifacts → ignored dirs
4. **Forward-only roadmap.** Completed items → changelog or ADR
5. **Harvested practice over feature imitation.** We copy methods, not stacks

---

## 1. Deep Architecture Rethink

Every major decision was reconsidered from first principles. Columns: current decision, verdict after rethink, and forward action.

### 1.1 Product & Scope

| Decision                                         | Verdict      | Rationale                                                                                  |
| ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------ |
| Always-on family dashboard for large displays    | **Keep**     | The TV-first constraint produces correct typography, density, and reliability requirements |
| Static PWA + optional edge worker                | **Keep**     | Best offline resilience, zero auth, minimal ops surface                                    |
| Single household, no accounts                    | **Keep**     | Removes privacy/security/support complexity entirely                                       |
| Keyboard-first + remote-friendly + touch-capable | **Keep**     | Correct for TV + secondary tablet                                                          |
| 12 cards maximum without expansion API           | **Evaluate** | Consider a card plugin contract for power users while maintaining curated default set      |

### 1.2 Frontend Stack

| Area             | Current                                                | Verdict     | Forward action                                                                                    |
| ---------------- | ------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| Language         | TypeScript 6 strict                                    | **Keep**    | Adopt TS 7 only when emitting is unchanged; strict mode is correct                                |
| UI framework     | Vanilla DOM + card class hierarchy                     | **Keep**    | Frameworks add no value for 12 cards with stable layouts. Improve view-model separation instead   |
| CSS architecture | @layer tokens/themes/base/layout/components/animations | **Keep**    | Expand design token system; enforce container queries over media queries for card-internal layout |
| Reactivity       | In-house signals (200 LOC)                             | **Keep**    | Track TC39 Signals (Stage 3) as future swap; current impl is correct and tiny                     |
| State management | Signals + localStorage + IDB                           | **Keep**    | Three-tier approach (memory → localStorage → IDB) is architecturally sound                        |
| Date/time        | Mixed Intl + Temporal polyfill                         | **Improve** | Complete temporal unification; eliminate remaining Date() usage in calendar flows                 |
| Build            | Vite 8 + Rollup                                        | **Keep**    | Produces correct IIFE for file:// and ESM for hosted; no reason to change                         |
| CSS processing   | LightningCSS via Vite                                  | **Keep**    | Fastest CSS transform, correct browser target alignment                                           |
| Service Worker   | Hand-crafted, versioned, SKIP_WAITING msg              | **Keep**    | Full control over cache strategy without Workbox dependency                                       |

### 1.3 Backend / Infrastructure

| Area               | Current                               | Verdict  | Forward action                                                              |
| ------------------ | ------------------------------------- | -------- | --------------------------------------------------------------------------- |
| Edge runtime       | Cloudflare Worker (Hono + Valibot)    | **Keep** | Annual vendor-neutrality portability drill; Hono's router is genuinely tiny |
| Realtime           | Durable Objects (stocks, alerts)      | **Keep** | Finish WebSocket upgrade paths for stock ticker; reduce polling frequency   |
| API proxy          | Worker routes → upstream APIs         | **Keep** | Centralizes CORS handling; keeps API keys server-side                       |
| Telemetry          | Analytics Engine (operational only)   | **Keep** | No user tracking; only request latency, cache-hit ratios, error rates       |
| Database           | None (localStorage + IDB client-side) | **Keep** | No server-side user state aligns with privacy-first architecture            |
| CDN/hosting        | GitHub Pages                          | **Keep** | Zero-cost, auto-deploy from CI, correct for static PWA                      |
| Secrets management | Cloudflare Worker env bindings        | **Keep** | API keys never reach client; Worker bindings are the correct pattern        |

### 1.4 Testing & Quality

| Area              | Current                          | Verdict  | Forward action                                                                  |
| ----------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------- |
| Unit testing      | Vitest 4 + happy-dom             | **Keep** | Fast, compatible, correct for DOM-heavy tests without full browser overhead     |
| Browser testing   | @vitest/browser (Chromium)       | **Keep** | Validates real DOM behavior where happy-dom diverges                            |
| E2E testing       | Playwright (11 device projects)  | **Keep** | Best cross-browser coverage; run smoke on all, deep on Chromium                 |
| Visual regression | Playwright screenshot comparison | **Keep** | Local baselines in-repo; no SaaS dependency                                     |
| Coverage          | v8 (vitest --coverage)           | **Keep** | Per-file thresholds in vitest.config.ts are the single source of truth          |
| Mutation testing  | Stryker (targeted)               | **Keep** | Run only on logic-dense modules (cache, signals, fetch); prevents test theater  |
| Static analysis   | ESLint 10 + typescript-eslint    | **Keep** | Type-aware rules catch real bugs; eslint-plugin-compat enforces browser targets |
| Custom checks     | 27 scripts in `scripts/`         | **Keep** | Each gate catches a real production failure mode                                |

### 1.5 Documentation & DX

| Area                 | Current                             | Verdict   | Forward action                                                               |
| -------------------- | ----------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Architecture docs    | docs/ARCHITECTURE.md                | **Keep**  | Keep as runtime topology reference; stop duplicating in prompts              |
| Decision records     | docs/adr/                           | **Keep**  | One ADR per non-trivial decision; reference, don't inline                    |
| API docs             | worker/API.md + worker/openapi.yaml | **Keep**  | OpenAPI spec is machine-readable; keep TTL annotations current               |
| Copilot instructions | 51 rules in copilot-instructions.md | **Prune** | Consolidate overlapping rules; move file-type rules to per-instruction files |
| Skills/Agents        | .github/skills/ + .github/agents/   | **Keep**  | Proven workflow; reduce duplication between skills and instruction files     |

### 1.6 Tools & Versions

| Tool             | Current version | Target      | Action                                                   |
| ---------------- | --------------- | ----------- | -------------------------------------------------------- |
| Node.js          | 22.x (.nvmrc)   | 22 LTS      | Correct; stay on active LTS                              |
| TypeScript       | 6.0.3           | 6.x latest  | Upgrade patch only; TS 7 when stable                     |
| Vite             | 8.x             | 8.x latest  | Correct; no reason to change                             |
| Vitest           | 4.1.6           | 4.x latest  | Keep in sync with Vite major                             |
| Playwright       | 1.60.x          | 1.x latest  | Monthly upgrades for browser engine coverage             |
| ESLint           | 10.x            | 10.x latest | Flat config is correct; upgrade patch only               |
| Prettier         | 3.8.x           | 3.x latest  | Stable formatter; no action needed                       |
| Hono (worker)    | latest          | latest      | Minimal edge router; auto-upgrade safe                   |
| Valibot (worker) | 1.x             | 1.x latest  | Tiny schema validation; correct choice over Zod for edge |

### 1.7 External APIs & Data Sources

| Source             | Card(s)    | Status       | Improvement                                                           |
| ------------------ | ---------- | ------------ | --------------------------------------------------------------------- |
| Open-Meteo         | weather    | **Healthy**  | Add precipitation radar endpoint                                      |
| Yahoo Finance      | stocks     | **Healthy**  | Move to Worker-only proxying; add market-hours awareness              |
| ILS exchange rates | currency   | **Healthy**  | Add historical trend sparkline data                                   |
| IDF Pikud HaOref   | alerts     | **Healthy**  | WebSocket path via Durable Object for sub-second delivery             |
| Google Calendar    | calendar   | **Healthy**  | Keep read-only; no OAuth (public calendar URL only)                   |
| Hebcal             | hebrew-cal | **Healthy**  | Consolidate holidays + shabbat into single Worker endpoint            |
| Sefaria            | hebrew-cal | **Healthy**  | Cache daily study text aggressively (24h TTL)                         |
| RSS feeds          | news       | **Healthy**  | Better deduplication + ranking as harvested from NetNewsWire patterns |
| YouTube/RSS        | video-news | **Healthy**  | Keep as passive embed; no YouTube API key required                    |
| CoinGecko          | currency   | **Optional** | Keep as bonus data; not critical path                                 |

---

## 2. Competitive Benchmark

### 2.1 Full Comparison Matrix

| Dimension                | FamilyDashBoard | Glance    | MagicMirror² | Homepage   | Homarr   | Dakboard | HA Lovelace | Grafana    | TRMNL    |
| ------------------------ | --------------- | --------- | ------------ | ---------- | -------- | -------- | ----------- | ---------- | -------- |
| **Runtime deps**         | 0               | ~5 (Go)   | ~40 (Node)   | ~30 (Go)   | ~80 (TS) | SaaS     | ~200 (Py)   | ~150 (Go)  | SaaS     |
| **Offline capability**   | Full PWA        | None      | Partial      | None       | None     | None     | None        | None       | Firmware |
| **Auth required**        | No              | No        | No           | Optional   | Yes      | Yes      | Yes         | Yes        | Yes      |
| **Server required**      | No              | Yes       | Yes          | Yes        | Yes      | Cloud    | Yes         | Yes        | Cloud    |
| **TV/ambient optimized** | Yes             | Partial   | Yes          | No         | No       | Yes      | Partial     | No         | Yes      |
| **RTL/Hebrew native**    | Yes             | No        | Community    | No         | No       | No       | Community   | No         | No       |
| **Card configurability** | Medium          | Low       | High         | Medium     | High     | Low      | Very High   | Very High  | Low      |
| **Information density**  | High            | Very High | Medium       | Medium     | Medium   | Low      | Variable    | Very High  | Very Low |
| **Release automation**   | Full CI/CD      | Manual    | npm publish  | GoReleaser | Docker   | SaaS     | pip/Docker  | GoReleaser | SaaS     |
| **Test depth**           | Unit+E2E+VR+Mut | Minimal   | Minimal      | Good       | Good     | Unknown  | Excellent   | Excellent  | Unknown  |
| **Custom check gates**   | 27              | 0         | ~3           | ~5         | ~8       | 0        | ~15         | ~20        | 0        |
| **Privacy posture**      | Maximal         | Good      | Good         | Good       | Medium   | Poor     | Good        | Medium     | Poor     |
| **Bundle size (client)** | ~180 KB gzip    | N/A       | ~500 KB      | N/A        | ~2 MB    | N/A      | N/A         | N/A        | N/A      |
| **Setup complexity**     | git clone+open  | Docker    | npm+config   | Docker     | Docker   | Sign up  | OS install  | Docker     | Buy HW   |

### 2.2 Harvested Methods (Detailed)

| Source             | Method                                             | How we apply it                                                           |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------- |
| **Glance**         | Ruthless information hierarchy per card            | Reduce visual weight of secondary data; primary metric always largest     |
| **Glance**         | Single-column density with breathing room          | Apply to mobile/narrow screen mode                                        |
| **TRMNL**          | Content pacing for always-on displays              | Add refresh-rate governor; prevent unnecessary repaints                   |
| **TRMNL**          | "Less but clearer" — intentional content restraint | Default card config hides optional fields; power users expand             |
| **NetNewsWire**    | Explicit stale/fresh visual semantics              | Timestamp badges with color coding: green (<5m), yellow (<30m), red (>1h) |
| **NetNewsWire**    | Feed deduplication + quality ranking               | Implement content fingerprinting for cross-feed duplicate detection       |
| **Grafana**        | Provider health dashboard                          | Expose provider scorecard in diagnostics overlay                          |
| **Grafana**        | Evidence-driven release gates                      | All 27 checks produce machine-readable pass/fail evidence                 |
| **Home Assistant** | Semantic card grouping                             | Group cards by function (information, status, action) in settings UI      |
| **Home Assistant** | Progressive disclosure in settings                 | Tab-based settings with summary → detail drill-down                       |
| **Homepage**       | Overview-first framing                             | Dashboard loads fastest-available data first; slow cards show skeleton    |
| **MagicMirror²**   | Ambient mindset preservation                       | Night dimmer, auto-scroll, low-motion preferences as first-class          |
| **Dakboard**       | Photo/media integration as ambient content         | Consider background media rotation during idle periods                    |
| **Dakboard**       | Family calendar as primary anchor                  | Ensure calendar card has highest visual priority in default layout        |

### 2.3 Anti-Patterns (Permanently Rejected)

- Framework rewrite without measurable user benefit
- User accounts, auth, or cloud profiles
- Server-required runtime for core viewing
- SaaS-only observability or VR services
- Plugin ecosystem that dilutes quality bar
- Docker-first deployment for a static site
- GraphQL/gRPC abstraction without real need
- Tailwind or CSS-in-JS migration (design tokens + layers is correct)
- Third-party state management (signals impl is tiny and correct)
- Microservices/micro-frontends for a 12-card product

---

## 3. Production Readiness Definition

### 3.1 What "Production Ready" Means

| Criterion                        | Requirement                            | Status |
| -------------------------------- | -------------------------------------- | ------ |
| Zero type errors                 | `tsc -b --noEmit` exits 0              | ✅     |
| Zero lint errors/warnings        | `eslint . --max-warnings 0` exits 0    | ✅     |
| Zero formatting drift            | `prettier --check .` exits 0           | ✅     |
| Zero markdown errors             | `markdownlint-cli2` exits 0            | ✅     |
| All unit tests pass              | `vitest run` exits 0                   | ✅     |
| All custom checks pass           | 27 script gates exit 0                 | ✅     |
| No dead exports                  | `check:dead-exports` exits 0           | ✅     |
| No eslint-disable directives     | grep finds 0                           | ✅     |
| No @ts-ignore/@ts-expect-error   | grep finds 0                           | ✅     |
| No TODO/FIXME/HACK markers       | grep finds 0                           | ✅     |
| No disabled feature flags        | no compile-time false flags            | ✅     |
| No dead code files               | all source files imported/referenced   | ✅     |
| Production build succeeds        | `vite build` exits 0                   | ✅     |
| Bundle size within budget        | `check:bundle` exits 0                 | ✅     |
| SW version matches package       | `check:sw` exits 0                     | ✅     |
| All configs reference real paths | tsconfig audited                       | ✅     |
| No ESM convention violations     | `import.meta.dirname` over `__dirname` | ✅     |

### 3.2 Canonical Release Gate

```powershell
npm run check              # typecheck + lint + format + md + 27 gates + tests
npm run check:actions-pinned
npm run check:ignore-scripts
npm run check:sigstore
npm run check:reproducible
npm run build              # production build
npm run check:bundle       # size budget
npm run check:card-bundle  # per-card delta
```

Release is blocked if any command fails. No exceptions. No waivers.

---

## 4. Strategic Streams (Forward Work)

### P0 — Temporal Unification

**Goal**: eliminate all raw `Date()` usage in card logic; route through `src/core/temporal.ts`.

- Countdown card: migrate remaining `Date.now()` comparisons
- Calendar card: use temporal helpers for event proximity
- Hebrew-cal: consolidate Intl.DateTimeFormat wrappers
- **Exit**: grep for `new Date(` in card files returns 0

### P1 — Information Hierarchy Tightening

**Goal**: harvest Glance/TRMNL patterns for clearer card readability.

- Primary metric per card: 3× larger than secondary
- Stale/fresh color coding on all data cards (green/yellow/red timestamps)
- Skeleton loading states for slow-loading cards
- Reduce simultaneous visual weight of non-critical elements
- **Exit**: visual regression baselines reflect new hierarchy

### P2 — Provider Health Observability

**Goal**: harvest Grafana patterns for provider monitoring.

- Surface provider scorecard in diagnostics overlay (D key)
- Per-provider: success rate, avg latency, last-ok, consecutive fails
- Alert when provider degrades (toast notification)
- Worker-side synthetic health probes for critical upstreams
- **Exit**: any provider failure is diagnosable from the overlay alone

### P3 — Feed Intelligence

**Goal**: harvest NetNewsWire patterns for news quality.

- Content fingerprinting for cross-feed duplicate detection
- Recency-weighted ranking (not just reverse-chronological)
- Explicit "x minutes ago" freshness badges
- Mark read/starred persistence in IDB
- **Exit**: duplicate headlines across feeds are suppressed

### P4 — Settings Progressive Disclosure

**Goal**: harvest Home Assistant patterns for settings UX.

- Settings dialog uses tab groups by function
- Each card has a "quick toggle" surface (show/hide/size)
- Advanced settings revealed on demand
- First-run tour updated to reflect new settings layout
- **Exit**: new users can configure basic preferences without reading docs

### P5 — Performance & PWA Excellence

**Goal**: push Lighthouse scores to consistent 100/100/100/100.

- Eliminate render-blocking patterns
- Reduce LCP to <1.5s on cold start
- Reduce CLS to 0 (skeleton states prevent layout shift)
- SW precache only critical assets; lazy-cache card-specific resources
- Add resource hints (preconnect, dns-prefetch) for all API origins
- **Exit**: Lighthouse CI gates at 95+ across all categories

---

## 5. Near-Term Milestones

### v15.0.0 — Production Reset Complete

- All dead code removed (serve-local.ps1, \_\_dirname violation)
- preview.html added to production build
- Full CI gate passes with 0 waivers
- ROADMAP rewritten as forward-only strategy

### v15.0.0 — Information Hierarchy

- Glance/TRMNL harvest applied to all 12 cards
- Freshness badges on all data cards
- Skeleton states for slow loaders
- Visual regression baselines updated

### v15.1.0 — Provider Health

- Diagnostics overlay shows provider scorecard
- Worker health probes for critical upstreams
- Toast alerts for degraded providers

### v16.0.0 — Feed Intelligence

- Duplicate detection across news feeds
- Recency-weighted ranking
- Read/starred state persistence

---

## 6. Rejected or Deferred Directions

Permanently rejected unless an ADR reverses with concrete evidence:

- Framework rewrite for its own sake
- Auth and account systems
- User cloud database
- Plugin ecosystem expansion
- Tailwind or CSS-in-JS migration
- Server-required product runtime
- Docker-first deployment model
- SaaS-first observability dependencies
- Next.js, Remix, or server routing stacks
- GraphQL, gRPC, or generalized API abstraction layers

Tracked but not adopted yet:

- TypeScript 7 — only when behavior is unchanged
- TC39 Signals — only when native or polyfill path is small and stable
- On-device inference — only if privacy-preserving with graceful fallback
- Cloudflare platform additions — only when they reduce complexity

---

## 7. Maintenance Rules

1. Do not add shipped sprint logs — use CHANGELOG.md
2. Do not embed volatile counts — reference canonical sources
3. Remove completed items immediately
4. Move historical context to changelog or ADRs
5. Keep comparison tables maintained — re-audit quarterly
6. This document must be mechanically accurate at all times
