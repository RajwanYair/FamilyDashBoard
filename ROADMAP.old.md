# FamilyDashBoard Roadmap

> Roadmap refresh date: 2026-06-22
> Current shipped baseline: v7.20.0
> Last committed baseline: v7.20.0 — 2998 tests / 86 suites / 0 failures

This roadmap replaces the older sprint-by-sprint backlog with a single decision document that is grounded in the actual state of the repository.

The goal is not to keep adding features forever. The goal is to make FamilyDashBoard a best-in-class always-on family command center: fast, reliable, calm, maintainable, observable, and honest in its documentation.

---

## Implementation Progress (v7.13–v7.16)

> Last updated: 2025-07-17

| Release | Sprints | Status | Key Deliverables |
| ------- | ------- | ------ | ---------------- |
| v7.13.0 | 31–40 | ✅ Shipped | README rewrite, ARCHITECTURE.md, ADRs, CardRuntime, domain types, config validation, perf budget |
| v7.14.0 | 41–50 | ✅ Shipped | Domain type tests, provider health model, diag table, coldStart, staleChip, migrateLsToIdb, FdbCard hooks |
| v7.15.0 | 51–60 | ✅ Shipped | createSkeleton/Empty/Error, FdbCard.withLoading/renderNodes, CardShell, cOr, weekday dimmer, FDB-062 |
| v7.16.0 | 61–70 | ✅ Shipped | bundle-trend script, config v5 (featureFlags), config accordion renderer, fetchWithRetry, FdbCard.emit, registry createShell, isValidCardSize, ROADMAP update |
| v7.17.0 | 71–77 | ✅ Shipped | Worker normalization, FdbCard helpers, API.md, release report, CLAUDE.md update, GH release |
| v7.18.0 | 78–127 | ✅ Shipped | Provider adapters, typed card config, config auto-renderer, CSS card anatomy, theme audit, cache dashboard, offline banner, perf budgets, 50 sprints |
| v7.19.1 | 178–180 | ✅ Shipped | Tooling modernization, bilingual interface foundation, config migration hardening, targeted i18n regression coverage, patch release |
| v7.20.0 | —       | ✅ Shipped | ROADMAP strategic overhaul (streams G.1, I-0, I), worker-first weather test fix, provider adapter hardening, shared tooling foundation |
| v7.19.0 | 128–177 | ✅ Shipped | Per-card configSchema, config dirty tracking, visual polish (badge pulse, scroll shadows, night smoothing), observability suite (card timing, latency histogram, error trending), provider latency, 50 sprints |

**Stream Progress:** Stream A (Truth) ✅ · Stream B (Card Arch) ✅ · Stream C (Data Contracts) ✅ · Stream D (Observability) ✅

---

---

## 1. Product North Star

FamilyDashBoard should become the best-in-class dashboard for a wall-mounted or TV-based household display.

That means:

- It loads instantly into useful information, even on poor networks.
- It never feels brittle or half-stale.
- It favors readability and calm signal over widget sprawl.
- It remains simple to deploy as a static frontend with an edge backend.
- It is documented truthfully, with minimal drift between docs and code.
- It keeps the client lean and dependency-light without turning that principle into dogma.

### Success Metrics

We will treat the following as product-level KPIs, not vague aspirations:

| Area | Target |
| --- | --- |
| Time to first meaningful content | under 1.5s on a typical always-on desktop-class browser |
| Empty-card rate after boot | effectively 0 for cached sessions |
| Upstream outage resilience | stale or fallback content for every network-backed card |
| Production JS size | controlled by explicit budget and tracked release-to-release |
| Accessibility | Lighthouse accessibility >= 95 and keyboard-complete overlays |
| Visual regressions | screenshot coverage across all themes and screen modes |
| Documentation drift | architecture and README updated in the same release as major structural changes |

---

## 2. Current Reality

The project is in a better place than the old roadmap suggests, but the documentation does not reflect that.

### What Already Exists

- TypeScript strict-mode frontend on Vite.
- Vitest suite with very high coverage and broad module coverage.
- Cloudflare Worker backend already split into routes and middleware.
- EventTarget-based state store already exists.
- FdbCard Web Component base already exists.
- IndexedDB cache support already exists and is partially wired into startup and async cache flows.
- Worker tests are already present in CI.
- Structured diagnostics and error telemetry infrastructure already exist.

### What Is Still Misrepresented

- Older roadmap items still describe already-implemented foundations as future work.
- Some architectural decisions were proposed too broadly and now need refinement instead of blind execution.

### Current Architectural Tension

The codebase is between two eras:

- The v6/v7 functional-module era: `initX()` functions, static HTML shells, DOM refs by ID, file-scoped mutable state.
- The v8 foundation era: `FdbCard`, reactive state, richer cache layers, worker-first data flow.

The next roadmap must finish that transition deliberately, not by layering more features onto both models at once.

---

## 3. Decision Reset

This section rethinks major decisions, including some that looked clean on paper.

### 3.1 Decisions To Keep

| Decision | Keep? | Why |
| --- | --- | --- |
| TypeScript-first frontend and worker | Yes | Highest leverage choice in the project. Strongly improves long-lived maintainability. |
| Static frontend + edge worker backend | Yes | Excellent fit for this product. Low operational complexity, strong performance profile. |
| Zero or near-zero runtime dependencies on the client | Yes | Good discipline for a TV dashboard. Keeps startup, upgrades, and security simple. |
| Vite + Vitest | Yes | Fast, stable, already paying off. No reason to churn. |
| Hebrew RTL-first design | Yes | This is a product differentiator, not an implementation detail. |
| Worker-first API path | Yes | Better than shipping public proxy chains in production. |
| Progressive offline-first cache model | Yes | Core to the product experience. |
| Co-located CSS and strong token usage | Yes | Good direction; continue tightening it. |

### 3.2 Decisions To Reverse Or Narrow

| Previous Direction | New Decision | Why |
| --- | --- | --- |
| Full Web Components migration with Shadow DOM everywhere | Use `FdbCard` as an incremental card-instance base, but do not adopt Shadow DOM by default | Shadow DOM complicates global theming, typography, diagnostics, and cross-card layout for this kind of dashboard. The encapsulation win is weaker here than in app-style UIs. |
| Huge v8 rewrite framing | Move to staged architectural convergence | The foundation already exists. The risk is now fragmentation, not lack of foundations. |
| Keep adding roadmap sprints as long feature lists | Shift to capability streams with measurable exit criteria | The old roadmap became stale because it tracked ideas rather than decisions and outcomes. |
| Pure zero-dependency ideology everywhere | Allow narrowly-justified backend and build-time dependencies | The client should stay lean. The worker and tooling can accept high-value dependencies where they reduce risk or duplicated code. |
| Keep localStorage as an equal cache tier forever | localStorage becomes config-only over time | Large cached payloads belong in IndexedDB, not in persistent string blobs. |

### 3.3 Decisions To Explicitly Avoid

- No React or Next.js rewrite. This product does not need a client framework rewrite to become excellent.
- No auth system unless cloud sync becomes a real shipped feature.
- No relational database before there is an actual multi-device synchronization requirement.
- No design-system abstraction layer for its own sake.
- No backend sprawl. The edge worker should remain the only server-side runtime unless a hard product need emerges.

---

## 4. Strategic Product Direction

FamilyDashBoard should evolve from a feature-rich dashboard into a product with five strong qualities:

1. Reliable information delivery
2. Strong information hierarchy
3. Clean instance-based architecture
4. Measured performance and visual quality
5. Truthful documentation and low contributor friction

That means the roadmap should optimize less for feature count and more for:

- stable provider abstractions
- instance-based card lifecycle
- normalized data contracts
- measured design consistency
- documented operator workflow

---

## 5. Frontend Reassessment

### 5.1 What Is Good Today

- Vanilla TS and DOM code are still a good fit.
- The current CSS token approach and RTL orientation are strong.
- The dashboard still benefits from explicit, readable imperative code for a TV display.

### 5.2 What Needs Refactoring

#### Card Lifecycle

Current state:

- Many cards still use `initX()` plus module-level timers and module-level state.
- `FdbCard` exists but is not the dominant runtime model.

Target state:

- Each card becomes an instance-backed element or instance-backed controller.
- A card owns its refresh schedule, DOM cache, and subscriptions.
- Card registration creates shells dynamically from a registry, not from duplicated static markup.

Decision:

- Migrate toward `FdbCard`-based card instances.
- Do not force Shadow DOM globally.
- Keep global theming and layout tokens shared at the document level.

#### State Model

Current state:

- Reactive state exists, but much UI logic still depends on local file-scoped mutable variables.

Target state:

- Config state, transient UI state, and per-card display state are explicit and inspectable.
- Cards subscribe to state and re-render small regions instead of relying on reload-like flows.

Decision:

- Keep the EventTarget store.
- Expand it thoughtfully rather than replacing it.
- Move module-local state into explicit card-instance state where feasible.

#### Rendering Model

Current state:

- Static HTML still defines card shells.
- Registry and runtime composition are only partially realized.

Target state:

- Registry defines the card catalog.
- Layout config decides what is rendered and where.
- HTML becomes a small app shell rather than a hardcoded card inventory.

Decision:

- Finish registry-driven layout generation.
- Keep progressive enhancement and plain HTML shell semantics.

#### Design Consistency

Current state:

- Many cards are visually strong, but the system still has accreted one-off patterns.

Target state:

- Consistent card shell anatomy.
- Shared primitives for chips, metric tiles, section headers, skeletons, empty states, stale states, and error states.
- Improved readability from 3 meters away as the primary design constraint.

Decision:

- Formalize a card-shell design system.
- Avoid visual novelty that harms legibility on a TV.

---

## 6. Backend And Edge Reassessment

The backend is the Cloudflare Worker. That is still the right architecture.

### 6.1 What To Keep

- Cloudflare Worker as the single backend runtime.
- Route split and middleware structure.
- CORS termination and upstream normalization at the edge.

### 6.2 What To Improve

#### Request Validation

Current state:

- Validation is route-specific and largely manual.

Decision:

- Adopt schema-driven validation for worker inputs and normalized outputs.
- Recommended approach: Zod in the worker and shared schema packages for client and worker type reuse.

Why this is worth it:

- Stronger safety around upstream data.
- Cleaner error behavior.
- Easier OpenAPI generation.
- Much less ad hoc validation duplication.

#### Backend Caching

Current state:

- The client caches aggressively.
- The worker still does not act as a serious shared cache tier.

Decision:

- Introduce KV-backed worker caching for the most expensive or unstable providers.
- Keep cache TTLs provider-aware.
- Normalize all cache-control decisions in one backend policy layer.

#### Provider Normalization

Current state:

- Cards still know too much about provider quirks.

Decision:

- The worker should increasingly return normalized domain responses instead of thin proxied payloads.
- Client cards should render domain models, not raw upstream API structures.

---

## 7. External Sources And API Strategy

Best-in-class here means provider abstraction, health awareness, and normalization.

### Provider Decision Table

| Domain | Current Source | Decision | Next Step |
| --- | --- | --- | --- |
| Weather | Open-Meteo | Keep as primary | Add normalized worker response and fallback provider evaluation |
| Stocks | Yahoo Finance unofficial endpoints | Keep only behind abstraction, no more direct dependency leakage | Add provider adapter interface and backup provider path |
| Currency | ER-API style latest-rate feeds | Keep short-term | Add historical strategy and worker normalization |
| News | Raw RSS via multiple origins | Keep concept, change transport | Move to worker aggregation and dedupe |
| Calendar ICS | Remote ICS proxying | Keep | Harden parsing and worker-side validation |
| Alerts | Tzeva Adom | Keep | Add health and backoff policy plus degraded-state UX |
| Hebrew calendar | Hebcal | Keep | Normalize server-side where useful |
| Learning content | Sefaria | Keep | Add stronger stale strategy and response validation |

### New Provider Principles

- Every provider must have a normalized internal shape.
- Every provider must have a fallback or degraded mode story.
- Every provider must expose TTL, error classification, and stale strategy.
- Cards should not own provider-specific parsing unless there is a strong reason.

---

## 8. Data, Storage, And Database Direction

The project does not currently need a traditional database.

That is not a weakness. It is the right decision for the current product stage.

### 8.1 Client Storage

Decision:

- IndexedDB becomes the primary persistent data cache.
- localStorage becomes primarily config, tiny flags, and emergency compatibility fallback.

Why:

- localStorage is sync, size-limited, and poor for large cached payloads.
- IndexedDB better matches feed-heavy and history-heavy cards.

### 8.2 Edge Storage

Decision:

- Cloudflare KV is the first server-side persistence layer to adopt.
- Durable Objects are reserved for correctness-critical coordination.
- D1 is deferred until the product truly needs relational queries.

Recommended usage:

- KV: shared cache, provider health snapshots, allowlists, aggregated feed payloads
- Durable Objects: stronger rate limiting or future collaborative sync coordination
- D1: only if future cloud sync needs durable queryable user records
- R2: only if asset snapshots, archives, or export bundles justify it

### 8.3 No Premature Database

The project should not add D1, Postgres, Supabase, or Firebase now just because it feels more complete.

That would increase operational surface area without a current product need.

---

## 9. Documentation Reassessment

This is one of the weakest current areas.

### Problems

- README is stale and still describes the legacy single-file dashboard workflow.
- Architecture and roadmap have drifted from implementation reality.
- AI instruction files are useful but spread across too many overlapping sources.
- Some docs are release- or sprint-shaped instead of role-shaped.

### New Documentation Model

We will organize docs by audience and responsibility:

| Document | Audience | Purpose |
| --- | --- | --- |
| README.md | users and first-time contributors | truthful product overview, setup, screenshots, feature summary |
| ARCHITECTURE.md | developers | current architecture only, no wishlist content |
| ROADMAP.md | maintainers | decision log plus forward plan |
| CHANGELOG.md | releases | what changed, release by release |
| docs/adr/ | maintainers | major architectural decisions and reversals |
| worker/README.md or API.md | backend contributors | worker routes, validation, cache policy, deployment |
| CONTRIBUTING.md | human contributors | workflow, quality gates, coding rules |

### Documentation Rule

Any structural change that affects runtime architecture, caching, worker behavior, or setup must update the matching doc in the same release.

---

## 10. Tooling And Language Decisions

### Keep

- TypeScript
- Vite
- Vitest
- ESLint
- Cloudflare Worker
- GitHub Actions

### Improve

| Area | Current | Decision |
| --- | --- | --- |
| TypeScript version alignment | app on 5.9, worker on 5.8 | Align worker to frontend TS baseline |
| Node baseline | broad CI matrix | Keep active and next LTS support, but simplify local contributor guidance |
| API contract generation | partial OpenAPI story | Move to generated or schema-backed API docs |
| Browser-level QA | no serious E2E or visual regression layer | Add Playwright and screenshot regression |
| Performance budgets | only partial bundle discipline | Add Lighthouse CI and formal performance budgets |

### Dependency Policy

Client runtime:

- Default to zero new runtime dependencies.
- Exceptions require explicit justification in an ADR.

Worker and build-time tooling:

- High-value dependencies are allowed when they reduce duplicated risk.
- Likely candidates: Zod, OpenAPI helpers, Playwright, Lighthouse CI.

---

## 11. Rewrite, Refactor, Enhance: Recommended By Area

### Rewrite Now

- ROADMAP.md
- README.md
- architecture-document truth model

### Refactor Incrementally

- card lifecycle onto `FdbCard` instances
- cache usage toward async-first IDB-aware flows
- worker output normalization
- config into namespaced per-card structure
- card shell and metric tile UI primitives
- provider adapters and health model

### Enhance Without Rewrite

- diagnostics and telemetry
- design tokens and card consistency
- offline behavior and stale-state UX
- release process and CI reporting

### Explicitly Defer

- full Shadow DOM migration
- relational database adoption
- authentication
- framework rewrite

---

## 12. Roadmap Streams

This roadmap is organized into streams rather than endless micro-sprints.

## Stream A: Truth, Cleanup, And Product Framing

Priority: Immediate

### Goals

- Make docs truthful.
- Remove roadmap drift.
- Reduce contributor confusion.
- Establish the target product definition.

### Deliverables

- Rewrite README to reflect the modular TypeScript app, not the legacy HTML artifact.
- Update architecture docs to describe the real cache, state, worker, and card layers.
- Add a small ADR folder for major decisions.
- Separate legacy archive docs from current product docs.

### Exit Criteria

- A new contributor can understand setup, runtime structure, and deployment from docs alone.
- No top-level doc describes the wrong architecture.

## Stream B: Card Architecture Convergence

Priority: Very High

### Goals

- Stop living in two card models.
- Make each card instance self-contained.
- Enable registry-driven rendering and cleanup.

### Deliverables

- Define a final `CardRuntime` contract around render, connect, disconnect, refresh, and config subscriptions.
- Promote `FdbCard` from foundation to primary pattern.
- Migrate the highest-churn cards first: weather, news, stocks, tasks.
- Replace static shell duplication with registry-created shells.
- Introduce shared card anatomy primitives.

### Exit Criteria

- New cards no longer require hand-wired static HTML shells.
- A card can be instantiated, tested, and torn down in isolation.
- Timers and listeners are owned by instances, not files.

## Stream C: Data Contracts And Provider Abstraction

Priority: Very High

### Goals

- Separate rendering from provider quirks.
- Improve resilience against external API drift.

### Deliverables

- Add schema-validated normalized response contracts.
- Build provider adapters for weather, stocks, currency, news, alerts, hebcal, and calendar.
- Add provider health reporting and degraded-state UX.
- Move feed aggregation and dedupe to the worker.

### Exit Criteria

- Cards render normalized domain models.
- A provider swap does not require card rewrites.
- Invalid upstream data is detected at the boundary.

## Stream D: Storage And Offline Architecture

Priority: High

### Goals

- Make IndexedDB the real persistent cache.
- Reduce localStorage pressure and sync blocking.

### Deliverables

- Standardize async-first cache usage for network-backed cards.
- Complete LS-to-IDB migration policy and cleanup.
- Add worker KV cache for shared edge caching.
- Add better stale and empty-state rendering conventions.

### Exit Criteria

- Most network-backed cards no longer rely on localStorage as their primary persistent cache.
- Shared edge cache measurably reduces upstream calls.

## Stream E: Config And Personalization

Priority: High

### Goals

- Stop growing a single flat config bag.
- Make per-card settings maintainable.

### Deliverables

- Move to namespaced config per card and per UI domain.
- Refactor config panel around card-specific groups.
- Add schema-aware import and export validation.
- Reduce implicit localStorage key coupling.

### Exit Criteria

- Config migrations are localized and understandable.
- Card settings can evolve independently.

## Stream F: Visual System And UX Quality

Priority: High

### Goals

- Turn a strong-looking dashboard into a coherent system.
- Improve consistency, density management, and readability.

### Deliverables

- Formal card shell primitives.
- Shared skeleton, empty, stale, and error patterns.
- Theme audits across all cards.
- TV-distance readability audit.
- Better use of visual hierarchy, fewer noisy one-off badges.

### Exit Criteria

- Cards feel like one product, not eleven separate experiments.
- Theme and screen mode changes do not create layout surprises.

## Stream G: Test Consolidation, Observability, And Performance

Priority: **High — Execute Before New Feature Work**

> The test suite has grown to 2998+ tests across 78 files. While coverage is excellent,
> the suite now has significant duplication, unnecessary module-isolation overhead, and
> avoidable DOM churn that inflate both run time and maintenance cost. This stream's
> primary objective is to consolidate and accelerate the test suite without reducing
> coverage quality.

### G.1 — Unit Test Consolidation (Primary Initiative)

#### Current State (Profiling Baseline)

| Metric | Value |
| --- | --- |
| Total test files | 78 |
| Total tests | 2998+ |
| Total suites | 86 |
| `vi.resetModules()` calls | 186 across 14 files |
| `vi.useFakeTimers()` calls | 118 across 21 files |
| `document.body.innerHTML` assignments | 300+ across 30+ files |
| `vi.fn()` calls | 500+ across nearly all files |
| `vi.mocked()` type casts | 400+ across 35+ files |

#### Slowest Test Files (Measured)

| File | Duration | Root Cause |
| --- | --- | --- |
| `config-panel.test.ts` | ~15 s | 49 `vi.resetModules()` + 30+ DOM rebuilds |
| `weather.test.ts` | ~8 s | 81 `innerHTML` assignments + timer mocking |
| `news.test.ts` | ~7 s | 32 `vi.resetModules()` + 65+ test cases |
| `bg-images.test.ts` | ~6 s | 25 `vi.resetModules()` per describe block |
| `stocks.test.ts` | ~6 s | 80+ tests, 12 `useFakeTimers` setups |
| `alerts.test.ts` | ~5 s | 14 `vi.resetModules()` + 13 timer setups |
| `night-dimmer.test.ts` | ~5 s | 15 `vi.resetModules()` + 22 DOM mutations |
| `main.test.ts` | ~5 s | 35+ `innerHTML` + 40+ mocked calls |

#### Goals

1. **Reduce total test run time by 30–50%** without reducing coverage
2. **Cut `vi.resetModules()` calls by 70%** — most are unnecessary if modules expose `destroy()` or reset functions
3. **Eliminate repeated DOM boilerplate** — extract shared fixtures
4. **Consolidate mock factories** — stop creating identical mocks in every file
5. **Reduce test count where tests overlap** — merge near-duplicate assertions

#### Detailed Action Plan

##### Phase 1: Shared Test Infrastructure (Do First)

Create reusable helpers in `tests/helpers/` to eliminate cross-file duplication:

| Helper | Purpose | Replaces |
| --- | --- | --- |
| `createCardDOM(cardId, html)` | Sets up card-specific DOM fragment in `document.body` and returns element refs | 300+ raw `document.body.innerHTML` assignments |
| `cleanupDOM()` | Clears body, resets scroll, removes event listeners | 300+ `document.body.innerHTML = ''` in afterEach |
| `withFakeTimers(fn)` | Wraps a test block with `useFakeTimers` / `useRealTimers` and auto-cleanup | 118 manual timer setup/teardown pairs |
| `createMockCache()` | Returns typed `{ cGet, cSet, cGetStale }` mock object | Dozens of identical mock-cache objects |
| `createMockFetch(responses)` | Configures `vi.fn()` fetch with a response map | Repeated fetch mock setup in 30+ files |
| `createMockConfig(overrides)` | Returns a full config object with sensible defaults and optional overrides | Repeated partial config construction |

##### Phase 2: Eliminate Unnecessary `vi.resetModules()` (Biggest Win)

The 186 `vi.resetModules()` calls are the single largest performance drain. Most exist because source modules accumulate state in file-scoped variables that cannot be reset between tests.

**Strategy per file:**

| Target File | Calls | Fix |
| --- | --- | --- |
| `config-panel.test.ts` (49) | Extract panel state into a resettable object; add `resetConfigPanel()` to source module | Reduces 49 re-imports to 1 initial import + reset calls |
| `news.test.ts` (32) | Add `resetNewsState()` to the news card module; mock only the external fetches | Reduces 32 re-imports to 1 |
| `bg-images.test.ts` (25) | The bg-images module caches DOM refs in closures; add `resetBgImages()` | Reduces 25 re-imports to 1 |
| `night-dimmer.test.ts` (15) | Add `resetDimmer()` or make dimmer state instance-based | Reduces 15 re-imports to 1 |
| `motivation.test.ts` (15) | Add `resetMotivation()` for quote-index state | Reduces 15 re-imports to 1 |
| `alerts.test.ts` (14) | Alert state machine already has partial reset; complete it | Reduces 14 re-imports to 1 |
| Remaining 8 files (36) | Apply same pattern: add targeted `reset()` export, remove `resetModules()` | |

**Estimated impact:** Eliminating `resetModules()` from the top 6 files alone should save 5–8 seconds of total suite time (module re-parsing overhead).

**Source code change required:** Each affected module gets a `/** @internal — test-only */ export function _resetForTest(): void` that clears module-scoped state. This is a small, safe change that does not affect production bundles (tree-shaken).

##### Phase 3: Consolidate Overlapping Test Cases

Several large test files contain near-duplicate assertions that test the same code path with trivially different inputs. These should be converted to parameterized tests:

| File | Pattern | Action |
| --- | --- | --- |
| `weather.test.ts` (70+ tests) | Multiple blocks test the same rendering logic for different weather codes | Use `it.each()` with a weather-code table |
| `stocks.test.ts` (80+ tests) | Separate tests for each market-data field with identical structure | Use `it.each()` for field validation |
| `hebrew-cal.test.ts` (50+ tests) | Individual holiday-detection tests with same assertion shape | Use `it.each()` with holiday lookup table |
| `calendar.test.ts` (40+ tests) | Repeated date-format assertions | Use `it.each()` for format variants |
| `currency.test.ts` (25+ tests) | Per-currency rendering tests with identical structure | Use `it.each()` with currency table |

**Estimated reduction:** 15–25% fewer individual test cases (from ~2998 to ~2400–2500) with identical coverage.

##### Phase 4: DOM Setup Optimization

Instead of 300+ `document.body.innerHTML = '<huge HTML string>'` calls:

1. **Create per-card HTML fixture files** in `tests/fixtures/` — load once per suite, clone per test
2. **Use `DocumentFragment` cloning** instead of re-parsing HTML strings
3. **Share the base dashboard DOM** across tests that only need card containers

**Estimated impact:** 20–40% faster DOM-heavy test files (weather, config-panel, main, ticker).

##### Phase 5: Timer Mock Reduction

Many tests use `vi.useFakeTimers()` when they don't actually test time-dependent behavior:

1. **Audit all 118 `useFakeTimers` sites** — remove from tests that never call `advanceTimersByTime`
2. **Group timer-dependent tests** into dedicated `describe('timers')` blocks with a single setup/teardown
3. **Use `vi.advanceTimersToNextTimer()` instead of arbitrary ms values** where possible

#### Exit Criteria

| Criterion | Target |
| --- | --- |
| Total suite run time | ≤ 60% of current baseline |
| `vi.resetModules()` usage | ≤ 30 calls (down from 186) |
| `document.body.innerHTML` raw assignments | ≤ 50 (down from 300+) |
| Test count | 2400–2600 (down from 2998) with same or better branch coverage |
| No test file exceeds | 500 lines (split oversized suites) |
| Shared test helpers | `tests/helpers/` with ≥ 5 reusable utilities |

#### Execution Order

```text
Phase 1 (helpers)     →  1–2 sessions  →  no source changes needed
Phase 2 (resetModules) →  3–4 sessions  →  source + test changes, biggest ROI
Phase 3 (parameterize) →  2–3 sessions  →  test-only changes
Phase 4 (DOM fixtures) →  1–2 sessions  →  test-only changes
Phase 5 (timer audit)  →  1 session     →  test-only changes
```

### G.2 — Observability And External Quality

#### Deliverables

- Playwright critical-flow suite
- Screenshot-based visual regression coverage
- Lighthouse CI budgets
- Provider health diagnostics and edge cache metrics
- Bundle-size trend reporting

#### Exit Criteria

- UI regressions are caught automatically
- Performance and accessibility are tracked continuously

## Stream H: Infrastructure And Release Engineering

Priority: Medium

### Goals

- Make shipping boring and safe.

### Deliverables

- Align package and toolchain versions across app and worker.
- Simplify contributor install story.
- Decide whether to keep parent-level install model or move to a workspace model.
- Add preview deployments if they materially improve review quality.

### Exit Criteria

- Contributor setup is documented and unsurprising.
- Releases include automated quality reporting and artifact verification.

## Stream I-0: Shared Tooling Configuration — MyScripts Level

Priority: **High — Execute Before Next Feature Stream**

> All common development tools should live under `C:\Users\ryair\OneDrive - Intel Corporation\Documents\MyScripts\`
> (the parent directory). Individual workspaces keep only project-specific overrides: paths, aliases,
> includes, coverage targets, and build plugins. This reduces drift, eliminates duplicated config,
> and guarantees that all projects under `MyScripts/` share the same quality baseline.

### Current State (Audit)

#### Already Shared (MyScripts/ level)

| Tool | Location | Consumers |
| --- | --- | --- |
| Node packages (devDependencies) | `MyScripts/package.json` | All TS/JS projects resolve from `MyScripts/node_modules/` |
| ESLint factory | `MyScripts/tooling/eslint/web-ts-app.mjs` | FamilyDashBoard only |
| TypeScript base config | `MyScripts/tooling/tsconfig/base-typescript.json` | FamilyDashBoard only |
| Vitest shared test config | `MyScripts/tooling/vitest/base.mjs` | FamilyDashBoard only |
| Stylelint shared rules | `MyScripts/tooling/stylelint/base.json` | FamilyDashBoard only |
| EditorConfig | `MyScripts/.editorconfig` | All projects (universal format rules) |
| Markdownlint | `MyScripts/.markdownlint.json` | All projects (relaxed MD rules) |
| Python tooling | `MyScripts/pyproject.toml` | 7+ Python projects (ruff, mypy, pytest, coverage, black, isort) |

#### Not Yet Shared (Duplicated Per Project)

| Tool | Problem | Affected Projects |
| --- | --- | --- |
| ESLint config | BudgetManager, CrossTideWeb, Wedding each maintain independent ESLint configs with near-identical rule sets | 3 projects |
| TypeScript base options | BudgetManager, CrossTideWeb define the same `strict`, `ES2022`, `bundler` options independently | 2 projects |
| Vitest environment | BudgetManager (node), CrossTideWeb (happy-dom) use custom configs that could extend the shared base | 2 projects |
| Stylelint rules | BudgetManager, CrossTideWeb, Wedding each have `.stylelintrc.json` with overlapping rules not extending `tooling/stylelint/base.json` | 3 projects |
| Wedding devDependencies | Wedding owns its own `devDependencies` instead of using parent-level packages | 1 project |
| Prettier / formatting | No shared Prettier config; some projects rely on EditorConfig alone | All |

### Goals

1. **Every TypeScript/Vite project** under MyScripts extends the shared configs from `tooling/`
2. **Zero duplicated tool configuration** — projects keep only overrides (paths, aliases, includes, project-specific rules)
3. **Single install point** — `npm install` in `MyScripts/` provides all dev tools for all JS/TS projects
4. **Python projects** continue using the shared `pyproject.toml` patterns (already working)
5. **New projects** get a documented template showing how to wire into the shared configs

### Architecture: What Lives Where

```text
MyScripts/                              ← SHARED LEVEL
├── package.json                        ← All devDependencies (eslint, vite, vitest, typescript, stylelint, etc.)
├── package-lock.json                   ← Single lockfile for all JS/TS projects
├── node_modules/                       ← Resolved once, walked up by all sub-projects
├── .editorconfig                       ← Universal formatting (indentation, line endings, charset)
├── .markdownlint.json                  ← Shared markdownlint rules
├── pyproject.toml                      ← Python shared config (ruff, mypy, pytest, black, isort)
├── tooling/
│   ├── eslint/
│   │   ├── web-ts-app.mjs             ← Factory for browser TypeScript apps (Vite-based)
│   │   ├── node-ts-app.mjs            ← (NEW) Factory for Node/Worker TypeScript projects
│   │   └── js-browser-app.mjs         ← (NEW) Factory for JS-only browser apps (Wedding)
│   ├── tsconfig/
│   │   ├── base-typescript.json        ← Strict TS base (ES2022, bundler, no emit)
│   │   └── base-node.json             ← (NEW) Node-targeted TS base (Worker, CLI tools)
│   ├── vitest/
│   │   ├── base.mjs                   ← Shared defaults (pool, timeouts, globals)
│   │   ├── happy-dom.mjs             ← (NEW) Preset: happy-dom environment + DOM defaults
│   │   └── node.mjs                   ← (NEW) Preset: node environment for non-DOM projects
│   ├── stylelint/
│   │   └── base.json                  ← Standard CSS quality rules
│   └── prettier/
│       └── base.json                  ← (NEW) Shared Prettier config if adopted
│
├── FamilyDashBoard/                    ← PROJECT LEVEL (only overrides)
│   ├── eslint.config.mjs              ← imports createWebTsAppEslintConfig(), adds project paths
│   ├── tsconfig.json                  ← extends base, adds "paths", "lib", "include"
│   ├── vitest.config.ts               ← imports sharedVitestTestConfig, adds aliases, defines, coverage
│   ├── .stylelintrc.json              ← extends ../tooling/stylelint/base.json
│   └── vite.config.ts                 ← project-specific build plugins (SW injection, etc.)
│
├── BudgetManager/                      ← (MIGRATE) same pattern as FamilyDashBoard
├── CrossTideWeb/                       ← (MIGRATE) same pattern
└── Wedding/                            ← (MIGRATE) move devDeps to parent, extend shared configs
```

### Detailed Action Plan

#### Phase 1: Expand Shared Tooling Presets

Create the missing config variants in `MyScripts/tooling/`:

| New File | Purpose | Based On |
| --- | --- | --- |
| `tooling/eslint/node-ts-app.mjs` | ESLint factory for Node TypeScript projects (Worker, CLI) | Adapt `web-ts-app.mjs`, swap browser globals for Node globals |
| `tooling/eslint/js-browser-app.mjs` | ESLint factory for JS-only browser projects (Wedding) | Subset of `web-ts-app.mjs` without TypeScript rules |
| `tooling/tsconfig/base-node.json` | TypeScript base for Node targets (module: NodeNext) | Adapt `base-typescript.json` for Node module resolution |
| `tooling/vitest/happy-dom.mjs` | Vitest preset with happy-dom environment baked in | Extract from FamilyDashBoard's current `vitest.config.ts` |
| `tooling/vitest/node.mjs` | Vitest preset for non-DOM Node projects | Minimal: environment "node", pool "forks" |

#### Phase 2: Migrate BudgetManager

BudgetManager already uses `@eslint/js + typescript-eslint` (strict) and Vite 8 — nearly identical to FamilyDashBoard.

| File | Current | Target |
| --- | --- | --- |
| `eslint.config.mjs` | Custom 150+ line config | Import `createWebTsAppEslintConfig()` from `../tooling/eslint/web-ts-app.mjs` + project overrides |
| `tsconfig.json` | Custom strict config | `"extends": "../tooling/tsconfig/base-typescript.json"` + local `paths`, `include` |
| `vitest.config.ts` | Custom config | Import `sharedVitestTestConfig` + project-specific coverage/aliases |
| `.stylelintrc.json` | Custom rules | `"extends": "../tooling/stylelint/base.json"` + project-specific ignores |

**Validation**: `npx tsc --noEmit && npx eslint src tests --max-warnings 0 && npx vitest run` must pass unchanged.

#### Phase 3: Migrate CrossTideWeb

Same migration pattern as BudgetManager. CrossTideWeb uses `createRequire` for ESLint import — switch to direct ESM import from shared factory.

| File | Action |
| --- | --- |
| `eslint.config.mjs` | Replace with `createWebTsAppEslintConfig()` call |
| `tsconfig.json` | Extend `../tooling/tsconfig/base-typescript.json` |
| `vitest.config.ts` | Import shared preset + project overrides |
| `.stylelintrc.json` | Extend `../tooling/stylelint/base.json` |

#### Phase 4: Migrate Wedding

Wedding is unique — JavaScript-only with `checkJs: true`. Requires the new `js-browser-app.mjs` ESLint preset.

| File | Action |
| --- | --- |
| `package.json` | Remove `devDependencies` — move any missing packages to `MyScripts/package.json` |
| `eslint.config.mjs` | Use new `createJsBrowserAppEslintConfig()` from shared factory |
| `tsconfig.json` | Extend `../tooling/tsconfig/base-typescript.json` + `"allowJs": true, "checkJs": true` |
| `.stylelintrc.json` | Extend `../tooling/stylelint/base.json` |

#### Phase 5: Worker Config Alignment

The `FamilyDashBoard/worker/` directory has its own `package.json` and `tsconfig.json` — this is intentional for Cloudflare deployment. However, its TypeScript config should still extend the shared base.

| File | Action |
| --- | --- |
| `worker/tsconfig.json` | Extend `../../tooling/tsconfig/base-node.json` + Cloudflare-specific `types` and `lib` |
| `worker/` ESLint | Inherit from parent config via `eslint.config.mjs` (already works — no change needed) |

#### Phase 6: Documentation And Templates

| Deliverable | Purpose |
| --- | --- |
| `tooling/README.md` | Document the shared config architecture, how to create a new project, how to override |
| `tooling/TEMPLATE-tsconfig.json` | Minimal tsconfig for a new project extending the shared base |
| `tooling/TEMPLATE-eslint.config.mjs` | Minimal ESLint config calling the shared factory |
| `tooling/TEMPLATE-vitest.config.ts` | Minimal Vitest config importing the shared preset |
| Update `ARCHITECTURE.md` | Add "Shared Tooling" section explaining the MyScripts-level architecture |
| Update `.github/instructions/workspace.instructions.md` | Expand shared tooling section with the full layout |

### What Stays Project-Specific (NEVER Shared)

These must remain in individual workspaces because they encode project-unique behavior:

| Config | Why It Stays Local |
| --- | --- |
| `vite.config.ts` | Build plugins, entry points, output formats, base paths differ per project |
| `vitest.config.ts` setup files | Each project has its own test setup, mocks, and DOM fixtures |
| `tsconfig.json` `paths` aliases | `@/` maps to different directories per project |
| `tsconfig.json` `include` / `exclude` | Source layout differs per project |
| ESLint `ignores` | Each project has different dist/coverage/generated directories |
| Coverage thresholds | Projects have different maturity and coverage targets |
| `.stylelintrc.json` project-specific ignores | Custom properties and pseudo-classes differ per design system |
| `package.json` (project metadata) | Name, version, scripts, runtime deps are per-project |
| `worker/package.json` + lockfile | Cloudflare deployment has its own dependency resolution |

### Constraints

1. **Never break existing projects** — migration is per-project, validated by running full test suites before and after
2. **No monorepo tool** — we do NOT adopt npm workspaces, pnpm, turborepo, or nx. The flat structure with Node module resolution walk-up is sufficient and simpler.
3. **Python projects keep their pattern** — `pyproject.toml` at parent level already works. No Node tooling needed for Python.
4. **Dart, C#, C++ projects are excluded** — they use language-native build systems (pubspec, MSBuild, CMake)
5. **CI must work** — `.github/ci/install-tools.sh` installs from `MyScripts/` level. No change needed if projects extend rather than duplicate.

### Exit Criteria

| Criterion | Target |
| --- | --- |
| TypeScript projects extending shared `tsconfig` | 4/4 (FamilyDashBoard ✅, BudgetManager, CrossTideWeb, Wedding) |
| TypeScript projects using shared ESLint factory | 4/4 |
| TypeScript projects importing shared Vitest preset | 3/3 (FamilyDashBoard, BudgetManager, CrossTideWeb — Wedding TBD) |
| Stylelint configs extending shared base | 4/4 |
| Zero `devDependencies` in sub-project `package.json` | All except `worker/package.json` (Cloudflare deployment exception) |
| `tooling/README.md` exists and is accurate | Documented architecture + new project template |
| All migrated projects pass their full test suite | `npx tsc --noEmit && npx eslint && npx vitest run` green per project |
| No duplicated ESLint/TS/Vitest rule definitions | Only overrides remain in project configs |

### Execution Order

```text
Phase 1 (new presets)    →  1 session   →  create node-ts, js-browser, happy-dom, node vitest configs
Phase 2 (BudgetManager)  →  1 session   →  migrate + validate (closest to FamilyDashBoard)
Phase 3 (CrossTideWeb)   →  1 session   →  migrate + validate
Phase 4 (Wedding)        →  1 session   →  migrate + validate (unique: JS-only)
Phase 5 (Worker)         →  30 min      →  tsconfig extend only
Phase 6 (docs)           →  1 session   →  README, templates, ARCHITECTURE update
```

---

## Stream I: AI Customization And .github Documentation Modernization

Priority: **High — Execute Before Next Feature Stream**

> The repository already has custom agents, file-scoped instructions, prompt files, skills,
> MCP guidance, and workflow documentation in `.github/`. However, these files were created
> incrementally and do not yet exploit the full capability surface of the latest VS Code
> Copilot, GitHub Copilot, Claude, and MCP tooling. This stream brings every `.github/`
> markdown file to production-grade completeness.

### Current State (Audit)

| Category | Files | Status |
| --- | --- | --- |
| Custom agents | 2 (`api-integrator`, `dashboard-designer`) | Good structure, but missing: `applyTo` patterns, `#file` context refs, output expectations, error-handling guidance |
| Instruction files | 4 (`cicd`, `dashboard`, `pre-release`, `workspace`) | Solid content, but `applyTo` globs may be too narrow; no instruction for test files or TypeScript source |
| Prompt files | 4 (`code-review`, `add-section`, `fix-quality`, `modernize-tooling`) | Functional, but use only basic `mode: agent`; no `#file` / `#selection` context variables, no `tools` restrictions |
| Skills | 4 (`add-api`, `debug-fetch`, `release`, `update-tests`) | Best maintained; could add definition-of-done checklists, link to newer agent frontmatter fields |
| MCP guidance | 1 (`MCP_SERVERS.md`) | Good policy doc; missing concrete `.vscode/mcp.json` examples, no server-capability matrix |
| Copilot config | 1 (`config.json`) | Uses legacy `modes` schema — should be validated against current Copilot config spec or removed if deprecated |
| Workflow docs | 1 (`workflows/README.md`) | Adequate; could add per-workflow permissions table, secret inventory, concurrency policy |
| AGENTS.md | 1 | Good index, but duplicates agent descriptions instead of linking; does not mention config.json or hooks |

### Goals

1. **Every `.github/` markdown file exploits the latest tooling capabilities** — not just documents conventions
2. **Agents use full frontmatter spec**: `tools`, `handoffs`, `applyTo`, `#file` context references, output format expectations
3. **Instructions cover all file categories**: add a `typescript.instructions.md` for `src/**/*.ts` and a `tests.instructions.md` for `tests/**`
4. **Prompts use context variables and tool restrictions** where appropriate
5. **Skills include machine-verifiable exit criteria** (specific commands to run, expected output patterns)
6. **MCP guidance includes concrete config examples** for the servers this project actually uses
7. **Legacy `config.json` is evaluated** — migrate useful content to proper agents/instructions or remove if deprecated
8. **Workflow README includes a complete permissions and secrets matrix**

### Detailed Action Plan

#### Phase 1: Agent Modernization

Update `.github/agents/*.agent.md` to use the full current spec:

| Enhancement | `api-integrator` | `dashboard-designer` |
| --- | --- | --- |
| `applyTo` patterns | `src/cards/**,src/core/fetch.ts,src/core/cache.ts,worker/**` | `src/styles/**,src/ui/**,src/cards/**/*.css` |
| `tools` list | Add `run_in_terminal`, `list_dir`, `file_search` | Add `list_dir`, `file_search`, `view_image` |
| `#file` context refs | Reference `src/core/constants.ts`, `src/core/fetch.ts` in system prompt | Reference `src/styles/tokens.css`, `src/styles/themes.css` |
| Output expectations | "Always end with a verification block: commands to run and expected pass criteria" | "Always include before/after screenshots or describe expected visual change" |
| Error playbooks | Add "If worker route returns 500…" and "If all proxies fail…" decision trees | Add "If theme token is missing…" and "If RTL breaks…" decision trees |
| Handoff refinement | Typed handoff payload describing which card/endpoint was changed | Typed handoff payload describing which visual area was changed |

Consider adding a third agent:

| Agent | Name | Purpose |
| --- | --- | --- |
| Quality reviewer | `quality-reviewer` | Pre-release gate: run full checklist from `pre-release.instructions.md`, verify counts, close issues, flag drift |

#### Phase 2: Instruction File Expansion

Add missing instruction files and tighten existing ones:

| File | `applyTo` | Content |
| --- | --- | --- |
| `typescript.instructions.md` (NEW) | `src/**/*.ts` | Import conventions, `diagLog` not `console.log`, `cGet`/`cSet` not raw LS, `_resetForTest` patterns, naming table |
| `tests.instructions.md` (NEW) | `tests/**` | Vitest conventions, mock rules, `vi.resetModules` policy, fixture extraction, `it.each` for table-driven tests, floor rules from `update-tests` skill |
| `workspace.instructions.md` | Expand `applyTo` to `**` | Add shared tooling layout table (`MyScripts/tooling/*`), current test baseline, dynamic badge references |
| `cicd.instructions.md` | Keep `**/*.yml` | Add per-workflow permissions table, secret inventory, concurrency group policy |
| `dashboard.instructions.md` | Keep `**/*.html` | Add card anatomy diagram reference, new card shell primitives, maximized-card rules |
| `pre-release.instructions.md` | Keep current | Add explicit "run these commands in order" block with expected output patterns for each gate |

#### Phase 3: Prompt File Enhancement

Upgrade `.github/prompts/*.prompt.md` with context variables and tool guidance:

| Prompt | Enhancements |
| --- | --- |
| `code-review` | Add `#file` context variable for the file under review; add `tools: [get_errors, runTests]` so the agent validates rather than only reporting |
| `add-section` | Wire `{{sectionName}}`, `{{dataSource}}`, `{{refreshInterval}}` properly; add `#file:src/core/card-registry.ts` context; reference `add-api` skill explicitly |
| `fix-quality` | Add `tools: [run_in_terminal, get_errors]` so the agent can auto-fix; add a "verify after fix" step |
| `modernize-tooling` | Add `#file:.github/AGENTS.md` and `#file:.github/copilot/config.json` context; reference this roadmap stream |

Consider adding new prompts:

| Prompt | Purpose |
| --- | --- |
| `/test-coverage` | Run coverage for a specific file, identify gaps, generate missing tests |
| `/debug-card` | Focused card debugging: check DOM, loader registration, cache state, sync dot |
| `/release-check` | Execute the pre-release gate checklist and produce a pass/fail report |

#### Phase 4: Skill Hardening

Add machine-verifiable definition-of-done to each skill:

| Skill | New Content |
| --- | --- |
| `add-api` | Add "Verification" section: `npx vitest run tests/unit/cards/<name>.test.ts` must pass; `npx tsc --noEmit` clean; `npx eslint src/cards/<name> --max-warnings 0` clean |
| `debug-fetch` | Add "Good End State" section: sync dot green, `diagLog` shows OK, cache key populated, no stale chip |
| `release` | Add automated version-string grep: `Select-String -Path *.md,*.json,*.js -Pattern "vOLD"` must return 0 matches |
| `update-tests` | Add performance guard: "If test file exceeds 500 lines, extract fixtures to `tests/helpers/`" |

#### Phase 5: MCP And Config Cleanup

| Task | Action |
| --- | --- |
| Evaluate `config.json` | The `modes` schema predates the current agent model. Determine if VS Code still reads it. If not, archive to `config.json.legacy` and document removal in AGENTS.md. If yes, align mode names with current agent names. |
| Add `.vscode/mcp.json` example | Create a documented example (commented out or in MCP_SERVERS.md) showing GitHub + Filesystem server config with input variables for secrets |
| Server capability matrix | Add a table to MCP_SERVERS.md: which servers provide tools vs resources vs prompts, and which agents benefit from each |
| Security hardening | Add a "Reviewing MCP trust" checklist: what to check before enabling a new server |

#### Phase 6: Workflow Documentation Completion

| Enhancement | Location |
| --- | --- |
| Permissions matrix | `workflows/README.md` — table of which workflow needs which `permissions:` grants |
| Secrets inventory | `workflows/README.md` — table of all secrets, which workflows consume them, how to rotate |
| Concurrency policy | `workflows/README.md` — document `concurrency:` groups and cancel-in-progress behavior |
| Branch protection alignment | `workflows/README.md` — which workflows are required status checks |
| Failure notification | `workflows/README.md` — how failures surface (GitHub UI, email, Slack if configured) |

### Exit Criteria

| Criterion | Target |
| --- | --- |
| Agent files | Use full frontmatter spec (`tools`, `handoffs`, `applyTo`, context refs) |
| Instruction files | ≥ 6 files covering all file categories (`*.ts`, `*.html`, `*.yml`, `tests/**`, release, workspace) |
| Prompt files | ≥ 6 prompts, all with context variables and tool restrictions where applicable |
| Skills | All 4 have machine-verifiable "Verification" or "Definition of Done" sections |
| MCP guidance | Includes concrete config examples and server capability matrix |
| `config.json` | Either modernized to current spec or archived with documented rationale |
| Workflow README | Includes permissions, secrets, concurrency, and branch-protection tables |
| AGENTS.md | Single source of truth index — no duplicated descriptions, links to all files |
| Markdownlint | 0 errors across all `.github/**/*.md` files |

### Execution Order

```text
Phase 1 (agents)       →  1 session   →  frontmatter + content upgrades
Phase 2 (instructions) →  1 session   →  2 new files + 4 updates
Phase 3 (prompts)      →  1 session   →  4 updates + 2–3 new prompts
Phase 4 (skills)       →  1 session   →  verification sections added
Phase 5 (MCP/config)   →  1 session   →  config decision + MCP examples
Phase 6 (workflows)    →  1 session   →  README tables completed
```

---

## Stream J: Configuration, Documentation, And Environment Standards

Priority: **High — Execute Before Next Feature Stream**

> Every configuration file, documentation asset, and environment descriptor must conform to the
> latest VS Code and GitHub platform standards. Documentation should use SVG graphical
> representations where architecture, data flow, or lifecycle concepts benefit from visual
> communication. This stream audits the entire workspace for standards drift and closes every gap.

### Current State (Audit)

#### VS Code Configuration (`.vscode/`)

| File | Status | Gap |
| --- | --- | --- |
| `settings.json` | ✅ Present | Comprehensive — review for deprecated keys against VS Code 1.100+ settings schema |
| `extensions.json` | ✅ Present | 15 recommendations + 6 unwanted — verify all extension IDs still exist in Marketplace |
| `tasks.json` | ✅ Present | 13 tasks — add `group.isDefault` for build tasks, add `problemMatcher` where missing |
| `mcp.json` | ✅ Present | 3 servers — verify against latest MCP spec (tool annotations, `inputSchema` format) |
| `launch.json` | ❌ Missing | No debug configs for Vite dev server, Vitest debugging, or Chrome attach |

#### GitHub Community Files (`.github/`)

| File | Status | Gap |
| --- | --- | --- |
| `CODEOWNERS` | ✅ Present | Verify syntax against latest GitHub CODEOWNERS spec (team + glob patterns) |
| `FUNDING.yml` | ✅ Present | Verify supported platforms list is current |
| `SECURITY.md` | ✅ Present | Add supported-versions table and PGP key if applicable |
| `CODE_OF_CONDUCT.md` | ✅ Present | Verify Contributor Covenant version is latest (2.1) |
| `CONTRIBUTING.md` | ✅ Present | Add "Development Environment" section referencing shared tooling |
| `PULL_REQUEST_TEMPLATE.md` | ✅ Present | Ensure checklist items match current CI gates |
| `dependabot.yml` | ✅ Present | Add `groups` for bundled updates (GitHub latest feature); verify `npm` ecosystem entry for parent-level deps |
| `release.yml` | ✅ Present | Verify category labels match current `labeler.yml` |
| `labeler.yml` | ✅ Present | Audit path patterns against current `src/` structure |

#### Issue & Discussion Templates

| File | Status | Gap |
| --- | --- | --- |
| `ISSUE_TEMPLATE/bug.yml` | ✅ | Verify YAML form spec fields against GitHub's latest (`type: checkboxes`, `validations.required`) |
| `ISSUE_TEMPLATE/feature.yml` | ✅ | Same YAML form spec audit |
| `ISSUE_TEMPLATE/api_issue.yml` | ✅ | Same YAML form spec audit |
| `ISSUE_TEMPLATE/config.yml` | ✅ | Verify `blank_issues_enabled` and `contact_links` format |
| `DISCUSSION_TEMPLATE/ideas.yml` | ✅ | Verify against latest discussion category template spec |
| `DISCUSSION_TEMPLATE/q-and-a.yml` | ✅ | Same |
| `DISCUSSION_TEMPLATE/show-and-tell.yml` | ✅ | Same |

#### GitHub Actions Workflows

| Workflow | Status | Gap |
| --- | --- | --- |
| `ci.yml` | ✅ | Audit: `permissions` block (least-privilege), `concurrency` groups, latest action versions, attestation support |
| `deploy.yml` | ✅ | Verify `id-token: write` for Pages OIDC, artifact v4 API |
| `release.yml` | ✅ | Add `attestations` step for SLSA provenance (GitHub latest); verify `softprops/action-gh-release` version |
| `deploy-worker.yml` | ✅ | Verify Wrangler action version, add `permissions: contents: read` |
| `auto-label.yml` | ✅ | Verify `actions/labeler` version (v5 → v6 migration if needed) |
| `dependabot-auto-merge.yml` | ✅ | Verify `gh pr merge` flags match latest GitHub CLI syntax |

#### Root Configuration Files

| File | Status | Gap |
| --- | --- | --- |
| `tsconfig.json` | ✅ | Verify against TypeScript 5.9 new options (`erasableSyntaxOnly`, `verbatimModuleSyntax` review) |
| `tsconfig.node.json` | ✅ | Ensure aligned with `tsconfig.json` base strategy |
| `eslint.config.mjs` | ✅ | Verify flat config uses latest `typescript-eslint` v8+ APIs |
| `vite.config.ts` | ✅ | Verify Vite 8 config schema (deprecated options audit) |
| `vitest.config.ts` | ✅ | Verify Vitest 4 new options (`pool`, `snapshotEnvironment`, workspace support) |
| `.editorconfig` | ✅ | Verify `end_of_line`, `charset`, `indent_style` cover all file types |
| `.gitignore` | ✅ | Add missing patterns: `.vite/`, `*.tsbuildinfo`, IDE-specific (`.idea/`) |
| `.gitattributes` | ✅ | Verify `linguist-*` attributes for accurate GitHub language stats |
| `.htmlhintrc` | ✅ | Verify rules against HTMLHint latest (rule renames, new rules) |
| `.htmlvalidate.json` | ✅ | Verify extends target against html-validate latest major |
| `.markdownlint.json` | ✅ | Verify rule set against markdownlint v0.37+ |
| `.stylelintrc.json` | ✅ | Verify extends shared base, audit for deprecated rules |
| `.prettierrc` | ❌ Missing | Prettier is in recommended extensions but has no config — add shared config or remove from recommendations |
| `.nvmrc` | ❌ Missing | Pin Node LTS version for contributors using nvm/fnm |

#### Package.json Metadata

| Field | Status | Gap |
| --- | --- | --- |
| `name`, `version`, `description` | ✅ | — |
| `type: "module"` | ✅ | — |
| `private: true` | ✅ | — |
| `engines` | ✅ | Verify range matches CI matrix and `.nvmrc` (once created) |
| `repository` | ❌ Missing | Add `{ "type": "git", "url": "..." }` for `npm repo` command and GitHub linking |
| `homepage` | ❌ Missing | Add GitHub Pages URL |
| `bugs` | ❌ Missing | Add `{ "url": "...issues" }` for `npm bugs` command |
| `author` | ❌ Missing | Add author field |
| `keywords` | ❌ Missing | Add for discoverability even on private packages |
| `license` | ⚠️ Check | Ensure `license` field matches `LICENSE` file SPDX identifier |

#### SVG Documentation Assets

| File | Status | Purpose |
| --- | --- | --- |
| `.github/assets/architecture.svg` | ✅ | System architecture diagram |
| `.github/assets/banner.svg` | ✅ | README banner graphic |
| `.github/assets/data-sources.svg` | ✅ | API data flow diagram |
| `.github/assets/preview.svg` | ✅ | Dashboard preview |
| `.github/assets/roadmap.svg` | ✅ | Roadmap visual |
| `.github/assets/tech-stack.svg` | ✅ | Technology stack diagram |
| Card lifecycle SVG | ❌ Missing | FdbCard lifecycle (init → connect → render → refresh → disconnect) |
| Cache layer SVG | ❌ Missing | Cache architecture (memory → IDB → localStorage → worker KV) |
| Config flow SVG | ❌ Missing | Config load → validate → migrate → render pipeline |
| CI/CD pipeline SVG | ❌ Missing | Workflow stages and gates visual |
| Theme system SVG | ❌ Missing | Token → layer → component cascade |

### Goals

1. **Every config file passes its tool's latest validation** — no deprecated options, no missing required fields
2. **Every GitHub community file uses the latest spec** — YAML form templates, workflow permissions, dependabot groups
3. **Package.json has complete metadata** — repository, homepage, bugs, author, keywords, license
4. **Environment is pinned** — `.nvmrc` matches `engines` and CI matrix
5. **VS Code DX is complete** — debug configs, problem matchers, task defaults
6. **SVG diagrams cover all major architectural concepts** — at least 10 total, referenced from docs
7. **Prettier decision is resolved** — either configure it or remove from extensions
8. **All GitHub Actions use latest stable versions** with explicit `permissions` and `concurrency` on every workflow

### Detailed Action Plan

#### Phase 1: Environment And Metadata Alignment

Close the simplest gaps first — these require no design decisions:

| Task | Action |
| --- | --- |
| Create `.nvmrc` | Pin to `22` (LTS, matches CI matrix primary) |
| Create `.node-version` | Same value as `.nvmrc` for fnm/volta compatibility |
| Add `package.json` metadata | `repository`, `homepage`, `bugs`, `author`, `keywords`, `license` fields |
| Verify `engines` | Ensure range `^20.19.0 \|\| ^22.13.0 \|\| >=24.0.0` matches CI matrix exactly |
| Resolve Prettier | **Decision**: either add `.prettierrc` extending `../tooling/prettier/base.json` OR remove `esbenp.prettier-vscode` from `extensions.json`. Document decision. |

#### Phase 2: VS Code Configuration Modernization

| Task | Action |
| --- | --- |
| Create `launch.json` | Add 3 configs: (1) Vite Dev Server launch, (2) Vitest Debug Current File, (3) Chrome Attach to running Vite |
| Audit `settings.json` | Remove deprecated keys; add `typescript.tsdk` pointing to shared `node_modules`; verify `eslint.useFlatConfig` is current; add `[markdown]` language-specific settings |
| Audit `tasks.json` | Add `problemMatcher` to lint/typecheck tasks (`$tsc`, `$eslint-stylish`); set `group.isDefault` for build; add `presentation.reveal` preferences |
| Audit `extensions.json` | Verify all 15 IDs exist in Marketplace; check for successor extensions (e.g. `dbaeumer.vscode-eslint` → flat config support confirmed); add `github.copilot-chat` if missing |
| Audit `mcp.json` | Verify server entries use latest MCP SDK schemas; add `description` fields per server; verify `inputVariable` syntax matches VS Code 1.100+ |

#### Phase 3: GitHub Community Files Update

| Task | Action |
| --- | --- |
| Issue templates | Audit all `.yml` forms against GitHub's current YAML form schema: `type`, `id`, `attributes`, `validations` fields; add `type: checkboxes` where useful; verify dropdown `options` syntax |
| Discussion templates | Verify `labels` and `body` array syntax matches latest spec |
| `CONTRIBUTING.md` | Add "Prerequisites" section (Node version, parent install, VS Code extensions); add "Running Checks" section pointing to `tasks.json` tasks |
| `SECURITY.md` | Add supported-versions table: `\| Version \| Supported \|`; add responsible disclosure timeline |
| `CODE_OF_CONDUCT.md` | Verify Contributor Covenant version is 2.1 (latest); update enforcement contact if needed |
| `dependabot.yml` | Add `groups:` for bundled minor updates (GitHub's grouped updates feature); verify `registries` config if private packages exist |
| `labeler.yml` | Audit all path globs against current `src/` directory structure; add labels for `worker/**`, `tests/**`, `docs/**` if missing |
| `PULL_REQUEST_TEMPLATE.md` | Ensure checklist matches current CI gates (typecheck, lint, markdownlint, SW version check, test, bundle size) |
| `release.yml` | Verify auto-generated release notes categories match current label set |

#### Phase 4: GitHub Actions Workflow Hardening

| Task | Action |
| --- | --- |
| **Permissions** | Add explicit top-level `permissions: contents: read` to every workflow; add job-level overrides only where needed (`pages: write`, `id-token: write`) |
| **Concurrency** | Add `concurrency: { group: "${{ github.workflow }}-${{ github.ref }}", cancel-in-progress: true }` to CI and deploy workflows |
| **Action versions** | Audit all `uses:` references: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v5`; pin to latest patch via SHA where security-critical |
| **Attestations** | Add `actions/attest-build-provenance@v2` to `release.yml` for SLSA supply-chain provenance on `dist.zip` |
| **Cache** | Verify `actions/cache` or `setup-node` cache strategy uses latest `cache: 'npm'` with proper `cache-dependency-path` pointing to parent `MyScripts/package-lock.json` |
| **Security scan** | Verify `npm audit` step uses `--audit-level=high`; consider adding `actions/dependency-review-action` for PRs |
| **Artifact v4** | Ensure all `upload-artifact` / `download-artifact` uses v4 API (v3 deprecated) |

#### Phase 5: Root Config File Audit

| File | Audit Action |
| --- | --- |
| `tsconfig.json` | Verify `moduleDetection`, `verbatimModuleSyntax`, `resolveJsonModule` against TS 5.9 defaults; remove options that match new defaults |
| `tsconfig.node.json` | Align `module`/`moduleResolution` with Vite 8 recommendations |
| `eslint.config.mjs` | Verify `typescript-eslint` v8 API usage (`tseslint.config()` factory); remove deprecated rule names; verify `languageOptions.parserOptions.projectService` |
| `vite.config.ts` | Remove deprecated Vite 7→8 options (`build.terserOptions` if present); verify `build.target` matches `engines` Node range |
| `vitest.config.ts` | Verify `pool` default, `snapshotSerializers`, `typecheck` options against Vitest 4 spec |
| `.editorconfig` | Add `[*.svg]` section (indent_size = 2, insert_final_newline = true); add `[*.yml]` if missing |
| `.gitignore` | Add `.vite/` (Vite 8 cache dir); verify `*.tsbuildinfo` pattern; add `.turbo/` (defensive) |
| `.gitattributes` | Add `*.svg linguist-documentation` to exclude SVGs from language stats; verify `*.ts linguist-language=TypeScript` |
| `.htmlhintrc` | Verify all 16 rules exist in current HTMLHint version; check for renamed rules |
| `.markdownlint.json` | Verify rule names against markdownlint v0.37+ (rule number → name migration) |
| `.stylelintrc.json` | Verify `extends` target resolves; audit for rules removed in Stylelint 16+ |

#### Phase 6: SVG Documentation Graphics

Create new SVG diagrams in `.github/assets/` and reference them from documentation:

| SVG File | Depicts | Referenced From |
| --- | --- | --- |
| `card-lifecycle.svg` | FdbCard lifecycle: init → connect → render → refresh → disconnect → destroy | `ARCHITECTURE.md` |
| `cache-layers.svg` | Cache cascade: in-memory Map → IndexedDB → localStorage fallback → Worker KV | `ARCHITECTURE.md` |
| `config-pipeline.svg` | Config flow: load defaults → read localStorage → validate schema → migrate → render panel | `ARCHITECTURE.md` |
| `ci-cd-pipeline.svg` | CI/CD stages: typecheck → lint → test (matrix) → security → build → deploy | `.github/workflows/README.md` |
| `theme-cascade.svg` | Theme token system: `@layer tokens` → `@layer themes` → component consumption | `ARCHITECTURE.md` |

**SVG Design Rules:**

- Use clean, minimal flat design — no gradients, no 3D effects
- Dark background (`#1a1a2e`) with light text for consistency with dashboard aesthetic
- Use project theme colors: `--accent` palette from `tokens.css`
- Embed all fonts (system-ui fallback) — no external font dependencies
- Keep file size under 20 KB each (optimize with SVGO)
- All text must be selectable (not converted to paths) for accessibility
- Add `role="img"` and `<title>` element for screen readers
- Reference from docs using relative paths: `![Architecture](.github/assets/architecture.svg)`

**Update existing SVGs:**

- Audit the 6 existing SVGs for accessibility (`<title>`, `role="img"`, `aria-label`)
- Verify they render correctly on GitHub (dark and light mode, no broken refs)
- Update `architecture.svg` to reflect current v7.20 module structure
- Update `roadmap.svg` to reflect this roadmap's stream structure

#### Phase 7: Documentation Cross-References

Wire all assets and configs into the documentation:

| Task | Action |
| --- | --- |
| `README.md` | Embed `banner.svg`, `preview.svg`; add badges for CI, coverage, version; add "Tech Stack" section with `tech-stack.svg` |
| `ARCHITECTURE.md` | Embed `architecture.svg`, new `card-lifecycle.svg`, `cache-layers.svg`, `config-pipeline.svg`, `theme-cascade.svg`; verify every section has a corresponding visual |
| `.github/workflows/README.md` | Embed `ci-cd-pipeline.svg`; add the permissions/secrets/concurrency tables from Stream I Phase 6 |
| `CONTRIBUTING.md` | Add setup diagram or reference `tech-stack.svg`; link to `launch.json` debug configs |
| `docs/README.md` | Add index entries for all SVG assets with thumbnail previews |
| ADR files | Add diagram references where architectural decisions benefit from visual context |

### What Stays Unchanged

These are already correct and require no action:

| Item | Reason |
| --- | --- |
| `.editorconfig` core rules | UTF-8, LF, 2-space indent are correct |
| Issue template structure | 3 templates + chooser config is appropriate |
| Discussion template structure | 3 categories is appropriate |
| `CODEOWNERS` content | Single owner is correct for this project |
| `FUNDING.yml` content | GitHub Sponsors only is correct |
| Worker configs (`worker/package.json`, `worker/tsconfig.json`) | Cloudflare deployment has its own requirements |

### Constraints

1. **No breaking changes to CI** — all workflow edits must be validated by running the full CI pipeline
2. **SVG files must render on GitHub** — test in both light and dark mode before committing
3. **Config changes must pass their tool's validation** — `npx tsc --noEmit`, `npx eslint --print-config`, `npx vitest list` after changes
4. **No new dependencies** — this stream is config and docs only
5. **Preserve existing `.github/assets/` SVGs** — update in-place, do not delete and recreate
6. **Coordinate with Stream I** — workflow README changes in Phase 7 depend on Stream I Phase 6 (permissions/secrets tables)

### Exit Criteria

| Criterion | Target |
| --- | --- |
| VS Code `launch.json` | ≥ 3 debug configurations (Vite, Vitest, Chrome) |
| `settings.json` deprecated keys | 0 |
| `extensions.json` stale IDs | 0 |
| `tasks.json` tasks with `problemMatcher` | All lint/typecheck tasks |
| `package.json` metadata fields | `repository`, `homepage`, `bugs`, `author`, `keywords`, `license` all present |
| `.nvmrc` exists | Matches primary CI Node version |
| Prettier decision | Resolved and documented (config added or extension removed) |
| GitHub Actions `permissions` | Explicit on every workflow |
| GitHub Actions `concurrency` | Present on CI and deploy workflows |
| Issue/discussion templates | Pass GitHub's YAML form schema validation |
| Root config files | 0 deprecated options across all linter/compiler configs |
| SVG documentation assets | ≥ 10 total (6 existing + 5 new) |
| SVG accessibility | All SVGs have `<title>`, `role="img"` |
| SVG file size | All under 20 KB |
| Docs embed SVGs | README, ARCHITECTURE, workflows README all reference relevant SVGs |
| `CONTRIBUTING.md` | Includes prerequisites, setup, and debugging sections |
| `SECURITY.md` | Includes supported-versions table |
| All checks pass | `npm run check` green after all changes |

### Execution Order

```text
Phase 1 (env + metadata)     →  30 min    →  .nvmrc, package.json fields, Prettier decision
Phase 2 (VS Code config)     →  1 session →  launch.json, settings/tasks/extensions/mcp audit
Phase 3 (GitHub community)   →  1 session →  templates, CONTRIBUTING, SECURITY, dependabot, labeler
Phase 4 (Actions hardening)  →  1 session →  permissions, concurrency, versions, attestations
Phase 5 (root config audit)  →  1 session →  tsconfig, eslint, vite, vitest, editorconfig, gitignore
Phase 6 (SVG graphics)       →  2 sessions →  5 new SVGs + 6 existing SVG audits
Phase 7 (doc cross-refs)     →  1 session →  embed SVGs, wire references, verify rendering
```

---

## 13. Release Plan

## v7.13 - Truth And Stabilization Release

Purpose:

- close the documentation gap
- stabilize current architecture
- consolidate recently added infrastructure

Must include:

- ROADMAP rewrite
- README rewrite
- architecture refresh
- audit of stale roadmap items vs actual implementation
- localStorage and cache policy review
- external-source inventory review

Nice to include:

- first provider decision ADRs
- first design-system and card-shell audit

## v7.14 - Data Boundary Release

Purpose:

- normalize provider handling
- harden worker contracts

Must include:

- schema-backed worker validation
- normalized response contracts for highest-risk providers
- worker-side news aggregation start
- stocks provider abstraction start

## v7.15 - Card Runtime Release

Purpose:

- commit to a single card runtime direction

Must include:

- registry-driven shell creation for at least one major slice
- first production cards on the `FdbCard` instance pattern
- card-owned refresh and cleanup

## v8.0 - Architecture Convergence Release

Purpose:

- make the current transitional architecture coherent

Required outcomes:

- `FdbCard` or equivalent instance runtime becomes the default
- config becomes namespaced
- worker-first normalized data model is established
- docs, tests, and architecture are aligned

## v8.1 - Offline And Edge Cache Release

Required outcomes:

- IDB-first persistent cache strategy
- KV-backed worker cache for high-value providers
- stronger stale-state and degraded-state UX

## v8.2 - Best-In-Class Quality Release

Required outcomes:

- Playwright critical flows
- visual regression suite
- Lighthouse CI budgets
- design consistency audit across all cards

## v9.0 - Optional Cloud Sync Release

This is intentionally optional.

Only pursue it if:

- there is a real multi-device product need
- local-only configuration becomes a bottleneck
- the operational and auth tradeoffs are justified

---

## 14. Consolidation Of The Old Roadmap

The old roadmap mixed three kinds of items: already done, partially done, and still valuable. This section consolidates them.

| Old Item | New Status |
| --- | --- |
| EventTarget state store | Done. Keep and extend. |
| FdbCard base class | Done as foundation. Finish adoption, not redesign. |
| Shadow DOM migration | De-scoped. Use only if a specific card needs hard encapsulation. |
| Worker tests in CI | Done. Maintain. |
| IDB cache support | Done in foundation and partial wiring. Finish operational model. |
| localStorage to IDB migration | Partially done. Complete policy and cleanup. |
| Dynamic registry-driven layout | Still strategic. Keep. |
| Config namespacing | Still strategic. Keep. |
| Proxy removal in production | Partially done. Finish cleanup and transport simplification. |
| OpenAPI completeness | Still valuable. Keep. |
| Playwright and visual regression | Still valuable. Keep. |
| Lighthouse CI | Still valuable. Keep. |
| Monorepo and workspaces migration | Reconsider, not automatic. Decide based on contributor friction, not aesthetics. |
| Doc consolidation | Still urgent. Keep and execute soon. |

---

## 15. Architecture Principles Going Forward

All future work should follow these principles:

1. Product truth over roadmap neatness.
2. Incremental convergence over grand rewrites.
3. Normalized data contracts over provider leakage.
4. Instance-owned lifecycle over file-owned mutable state.
5. TV readability over flashy UI tricks.
6. Client simplicity over framework fashion.
7. Edge caching before backend expansion.
8. Documentation that matches runtime reality.
9. Observability as a feature, not a debugging afterthought.
10. No new persistence layer without a clear product reason.

---

## 16. Immediate Next Actions

These are the highest-value actions after this roadmap rewrite:

- Rewrite README.md to reflect the modular TypeScript app and current deployment model.
- Refresh ARCHITECTURE.md to align with the real v7.12 implementation and this roadmap.
- Add ADRs for three decisions: no full client framework rewrite, no default Shadow DOM, worker-normalized data model.
- Audit highest-risk providers: stocks, news, currency.
- Define the `CardRuntime` migration contract and migrate one card end-to-end before expanding.
- Create a docs inventory and remove or archive clearly stale legacy guidance.

This is the shortest path toward a best-in-class application without losing the strengths already earned.
