# FamilyDashBoard Roadmap

> Roadmap refresh date: 2026-06-22
> Current shipped baseline: v7.19.0
> Last committed baseline: v7.19.0 — 2931 tests / 79 suites / 0 failures

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

## Stream G: Testing, Observability, And Performance

Priority: High

### Goals

- Detect regressions early.
- Measure what matters.

### Deliverables

- Playwright critical-flow suite.
- Screenshot-based visual regression coverage.
- Lighthouse CI budgets.
- Provider health diagnostics and edge cache metrics.
- Bundle-size trend reporting.

### Exit Criteria

- UI regressions are caught automatically.
- Performance and accessibility are tracked continuously.

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
