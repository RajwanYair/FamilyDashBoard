# FamilyDashBoard - Strategic Roadmap v14.0

> **Reviewed**: 2026-09-08. **Repository baseline**: v15.7.0 in [package.json](../package.json) and [CHANGELOG.md](../CHANGELOG.md); deployment not independently verified.
> **Scope of this revision**: planning and machine inventory only. No application development, dependency changes, deployments, or release tags.
> **Next release**: unassigned. Approve scope and readiness evidence before assigning a version or date.
> **Sources of truth**: [architecture](ARCHITECTURE.md), [ADRs](adr/README.md), [scripts](../package.json), [browser targets](../.browserslistrc), and [test configuration](../vitest.config.ts). Historical delivery belongs in the changelog.

## 0. Product Direction

Build a dependable, legible household display that answers three questions at a glance: what matters now, what happens next, and how current is this information?

Best in class means measurable household outcomes, not more cards, tools, gates, or cloud services. Prioritize correct data and recovery before new features. Preserve Hebrew RTL, TV readability, useful offline behavior, and simple ownership.

### 0.1 Non-Negotiables

1. Keep a static PWA, optional Worker, and zero client runtime dependencies. No framework rewrite, accounts, OAuth, cloud profiles, or plugin marketplace.
2. Keep existing card contracts, design tokens, CSS layers, and temporal helpers. Extend an owning module before adding a parallel abstraction.
3. Distinguish hosted HTTPS, installed PWA, and local-file capabilities. Service workers and push are not promised for `file://`; cached data is not live data.
4. No emergency-delivery guarantee. Alerts supplement official channels; unavailable or stale data must never imply that an area is safe.
5. No fabricated health, benchmark, competitor, accessibility, privacy, or supply-chain claims. Record evidence, environment, date, and limits.
6. No suppression of failing quality gates. An unexecuted check is **unverified**, not passed. Fix a gate's validity before using its result as proof.
7. Keep generated reports under `$env:TEMP/FamilyDashBoard/`; keep distributable builds in ignored output directories. Never include credentials or household data in evidence.
8. Tool upgrades must preserve the shared-tooling model. No local dependency lockfile or `devDependencies` in this project; no broad machine upgrade or repository relocation hidden inside a sprint.

### 0.2 Outcome Scorecard

These are proposed acceptance targets, not measured results. S00 captures baselines and approves the test environment. Stronger existing gates remain in force until an explicit decision changes them.

| Outcome                | Proposed acceptance target                                                                                                                                                               | Measurement and owner                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Understand the display | At least 4 of 5 Hebrew-speaking participants identify the next event and stale data within 10 seconds, without instruction                                                               | S04 usability script; product owner      |
| Basic setup            | At least 4 of 5 participants complete location, calendar, card visibility, and restore tasks within 5 minutes; no critical data loss                                                     | S04 observed tasks; UX owner             |
| Honest freshness       | Every network-backed card distinguishes never loaded, fresh, stale, offline, and failed states; local-only cards have relevant status instead                                            | S02 deterministic fixtures; data owner   |
| Failure diagnosis      | Known injected failures appear in diagnostics within 5 seconds after detection, with provider, stage, and last success                                                                   | S02 failure drill; reliability owner     |
| Recovery               | Cached content remains usable during an outage; recovery succeeds without manual reload across the agreed failure matrix                                                                 | S03 E2E; reliability owner               |
| Long-running stability | 72-hour target-device soak without crash, uncontrolled retry growth, or unbounded retained objects; investigate more than 10% post-warmup retained-heap growth across comparable samples | S06 soak protocol; performance owner     |
| Performance            | Proposed cold-start LCP <= 1.5 seconds and interaction CLS <= 0.05 on the agreed TV profile; retain current budgets and report median plus worst run                                     | S06 repeated lab runs; performance owner |
| Accessibility          | WCAG 2.2 AA review of critical flows, zero serious/critical axe findings, plus manual keyboard, focus, screen-reader, contrast, and touch checks                                         | S05 evidence; accessibility owner        |
| Release trust          | Independent artifact signature verification and two clean builds compared using documented normalization                                                                                 | S07 release rehearsal; release owner     |

## 1. Evidence-Based Review

### 1.1 Corrections to the Previous Plan

| Finding                                                                   | Evidence reviewed                                                                                                                                                    | Planning consequence                                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| v15.7.0 was still described as upcoming                                   | [package.json](../package.json), [changelog](../CHANGELOG.md)                                                                                                        | Use it as the repository baseline; do not reschedule its documentation release                                          |
| `check` was described as including unit tests                             | [scripts](../package.json) has a separate `test` command; `check` includes benchmark work but no explicit unit-test gate                                             | S01 must prove gate coverage and failure propagation; run unit tests separately until then                              |
| Freshness was described as wholly unbuilt                                 | [freshness.ts](../src/core/freshness.ts) already classifies states, but rendering uses a default 15-minute TTL                                                       | Audit wiring and source timestamps; complete provider-specific policy, not another badge system                         |
| Health and degradation work was listed as new                             | [health-probe.ts](../src/core/health-probe.ts), [provider-toast.ts](../src/core/provider-toast.ts), and [Worker probes](../worker/src/routes/health-probes.ts) exist | Test deployed wiring, redaction, alert fatigue, and detection behavior before extending                                 |
| Semantic-link registry was listed as new                                  | [links.ts](../src/core/links.ts) already registers and resolves links behind config                                                                                  | P13 becomes a lifecycle and integration audit                                                                           |
| Push was described as a new DO/Queues implementation                      | [push route](../worker/src/routes/push.ts) already contains VAPID signing and KV subscription handling                                                               | Audit current security and delivery contract first; do not assume a storage migration is necessary                      |
| Reproducibility was asserted from a dry run                               | [reproducibility script](../scripts/check-reproducible.mjs) defaults to `--dry-run` through the npm alias; verification compares selected input hashes               | A manifest or matching inputs does not prove identical output; add a real clean-build comparison in S07                 |
| Sigstore check was described as artifact verification                     | [Sigstore script](../scripts/check-sigstore.mjs) inspects release-workflow text                                                                                      | Keep configuration checks distinct from cryptographic verification of actual release artifacts                          |
| Proposed 200 KB bundle budget exceeded current limits                     | [bundle checker](../scripts/check-bundle-size.mjs) uses 115 KiB JS and 30 KiB CSS gzip, with a growth check                                                          | Preserve executable limits; do not raise them to accommodate feature growth                                             |
| Absolute privacy claims conflicted with optional services                 | [privacy notice](privacy.md), [architecture](ARCHITECTURE.md), and push route describe error reporting, proxy requests, and stored subscriptions                     | S08 must reconcile actual flows and retention before AI or push expansion                                               |
| Competitor rankings, counts, and future API maturity lacked dated sources | Prior roadmap supplied estimates without reproducible measurements                                                                                                   | Replace rankings with a research protocol; do not mandate experimental browser features from an assumed standards stage |
| Oxlint was described as absent everywhere                                 | [CI installer](../.github/ci/install-tools.sh) already lists it                                                                                                      | Audit install-versus-execution coverage before adding a lint step                                                       |

Presence in source is not proof of complete wiring, passing tests, deployed bindings, or production readiness. All implementation claims below remain subject to S00 inventory and focused validation.

### 1.2 Architecture Guardrails

| Area                        | Default decision                                                      | Evidence needed to change it                                                                                 |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| DOM, signals, card registry | Retain current implementation and ownership boundaries                | Measured user benefit, migration cost, compatibility tests, and ADR                                          |
| Cache and refresh           | Use existing cache, IDB, SW, provider, and refresh-governor modules   | Proven duplicate responsibility or correctness defect; define timestamps and invalidation before refactoring |
| Time and locale             | Use existing temporal helpers and native Hebrew calendar formatting   | DST, midnight, timezone, market-hours, and supported-browser fixtures                                        |
| Browser APIs and CSS        | Progressive enhancement against declared targets                      | Feature detection, fallback, device test, and bundle impact; Baseline status alone is insufficient           |
| Worker platform             | Optional acceleration and narrowly scoped services                    | Failure behavior without Worker, cost cap, secrets handling, portability, and operator ownership             |
| Testing                     | Reuse Vitest, property tests, Playwright, and targeted mutation tests | Each new test or gate must catch an identified failure; suite count is not an outcome                        |
| Dependencies                | Latest compatible, supported, verified versions                       | Engine/peer compatibility, lockfile diff, advisory review, native-binary support, and rollback               |

## 2. Machine and Toolchain Readiness

### 2.1 Observed Inventory

Read-only checks on 2026-09-08. Versions below are installed observations, **not a claim that they are latest**. This checkout is under `Documents/GitHub/FamilyDashBoard`; the shared toolchain was found under `Documents/MyScripts`, outside its ancestor path.

| Tool or group                 | Observed state                                                                                                                | Required action                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Node.js / npm                 | Node 26.8.1; npm 11.19.0; repo [.nvmrc](../.nvmrc) says 22                                                                    | Select a supported LTS/toolchain combination and align local shell and CI; installed newest-major is not the compatibility target |
| Git / PowerShell              | Git 2.55.0.windows.5; PowerShell 7.6.5                                                                                        | Check publisher updates and executable paths; no replacement needed just to edit docs                                             |
| VS Code / GitHub CLI / WinGet | VS Code 1.136.1; gh 2.98.0; WinGet 1.29.290                                                                                   | Check stable publisher releases and policy-approved updates; GitHub authorization remains untested                                |
| TypeScript / Vite / Vitest    | Shared install: 6.0.3 / 8.0.14 / 4.1.7                                                                                        | Packages exist but do not resolve from this checkout; repair documented workspace setup before development                        |
| Browser and coverage testing  | Shared Playwright 1.60.0; Vitest browser and coverage-v8 4.1.7                                                                | Verify imports and launch matching browser binaries; default Playwright cache absent and no custom path configured                |
| Lint and formatting           | Shared ESLint 10.4.1; Prettier 3.8.3; Stylelint 17.12.0; markdownlint-cli2 0.22.1                                             | Confirm plugins and project configuration resolve, not merely CLI presence                                                        |
| Other test tools              | Shared happy-dom 20.9.0; Stryker 9.6.1; LHCI 0.15.1                                                                           | Smoke-test only the tools needed for the selected sprint                                                                          |
| Worker and fast lint          | Wrangler, Hono, and Oxlint absent from the checked shared root; Valibot 1.4.1 present                                         | Check Worker-local installation and CI scope before declaring them missing machine-wide or installing                             |
| VS Code extensions            | ESLint, Prettier, Stylelint, Markdownlint, Vitest, Playwright, PowerShell, YAML, Hebrew spell-check, axe, and Sonar installed | Check activation and updates; optional recommendations are not mandatory apps                                                     |
| Recommendation mismatch       | Recommendations name `ms-edgetools.vscode-edge-devtools`; installed extension uses `ms-edgedevtools.vscode-edge-devtools`     | S00 verifies the publisher ID before proposing recommendation changes                                                             |
| Search utility                | `rg` not found on PATH                                                                                                        | Optional convenience only; built-in workspace search and PowerShell are sufficient                                                |
| Registry and release access   | npm registry and Node release-index requests timed out; Marketplace homepage returned HTTP 200                                | Resolve policy-approved connectivity; homepage access does not verify extension update availability                               |
| Initial docs check            | `npx --no-install markdownlint-cli2 docs/ROADMAP.md` attempted registry resolution and timed out                              | Use the installed shared checker directly; never interpret this as a Markdown failure or a passed gate                            |

**Readiness decision: BLOCKED for development.** The shared-toolchain path mismatch, missing browser-launch evidence, and unverified update/advisory status must be closed. No packages, editor extensions, system apps, or global configuration were changed by this planning revision.

### 2.2 Required Versus Optional

- **Required for core development**: compatible Node/npm, Git, the approved shared package set, TypeScript, Vite, Vitest/happy-dom, required lint plugins, formatters, coverage tools, and Playwright with matching browsers.
- **Required for Worker sprints**: Worker package dependencies, compatible Wrangler and Workers types, local runtime simulation, and an isolated non-production environment. Credentials are entered directly by the operator, never into chat or reports.
- **Required for release verification**: access to CI artifacts and approved signature-verification tooling. Signing and deployment credentials are not prerequisites for local UI development.
- **Optional, measured value only**: Oxlint, GitHub CLI convenience flows, extra profiling extensions, and MCP integrations. Docker, WSL, Python, additional IDEs, and unrelated desktop apps are not prerequisites for this static dashboard.
- **MCP readiness**: configuration presence is not connectivity. Perform one read-only operation per needed server, verify least privilege, and document an ordinary CLI/manual fallback. Do not require every integration for every sprint.

### 2.3 Safe Update Procedure

1. Record executable paths, installed versions, repository `.nvmrc`, shared package versions, and Worker-local versions. Resolve duplicate checkouts before selecting the shared install location; do not move files automatically.
2. Restore trusted access to npm, Node releases, browser downloads, and publisher update services. Do not disable TLS validation, expose proxy credentials, or substitute an unapproved registry.
3. Compare installed, wanted, and latest versions in the approved shared `MyScripts` directory. Check Worker dependencies separately. Review advisories and peer requirements before choosing upgrades.
4. Read applicable upgrade guidance for TypeScript or major toolchain changes. Upgrade related packages as a tested group, especially Vitest/browser/coverage and Playwright/browser binaries. Avoid blanket `latest`, `audit fix --force`, or `winget upgrade --all`.
5. Install only in the authorized shared location, with install-script restrictions and reviewed native-binary requirements. Preserve the shared manifest and lockfile for rollback; no project-local workaround.
6. Run import-resolution checks from this checkout, CLI version checks, one focused unit test, Worker typecheck if applicable, and one browser launch per required engine. Confirm VS Code diagnostics use the same toolchain.
7. Check relevant editor and desktop-app updates through trusted publishers. Stage updates that require a VS Code restart; elevated installers must be run directly by the operator. Do not remove unrelated extensions.
8. Record a sanitized before/after manifest, test exits, and unresolved items under `$env:TEMP/FamilyDashBoard/toolchain/`. Close S00 only after fresh-shell validation; restore prior approved versions if validation fails.

## 3. Delivery Model

### 3.1 Sprint Contract

All sprints start **Planned** unless explicitly blocked. Role names below need a named owner at kickoff; they are not staffing commitments. Estimates are focused engineer-days including implementation, review, tests, and docs, excluding access delays and unattended soak time. Plan one core sprint at a time; split any sprint exceeding 10 engineer-days into independently testable increments.

Each task becomes an issue with this minimum content:

| Field                | Required content                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Identity             | Stable task ID, title, stream, priority, sprint, named owner, reviewer                             |
| Problem              | User-visible failure, baseline evidence, desired outcome, explicit non-goals                       |
| Scope                | Existing owning files and callers, data contract, tests to extend, docs/ADR impact                 |
| Dependencies         | Blocking task IDs, access needs, open decisions, external provider limits                          |
| Implementation brief | Small change sequence, boundary conditions, migration and cleanup behavior                         |
| Acceptance           | Observable given/when/then cases, numeric thresholds, failure and recovery paths                   |
| Validation           | Exact focused test names/commands, fixture setup, browser/device matrix, required repository gates |
| Delivery             | Effort range, risk, rollout sequence, rollback trigger, rollback steps, evidence links             |

**Definition of Ready**: owner and reviewer assigned; dependencies closed; acceptance and tests agreed; existing implementation inspected; privacy/security decisions resolved; toolchain usable.

**Definition of Done**: acceptance demonstrated; applicable focused tests and required gates passed; no new suppressions; docs and ADRs consistent; migration/rollback rehearsed when relevant; evidence linked to commit and environment. Source presence, a screenshot, or a green text-scanning script alone is not completion.

### 3.2 Dependency and Release Sequence

| Sprint                                 | Priority / effort         | Depends on                                          | Deliverable                                               |
| -------------------------------------- | ------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| S00 Toolchain and truth baseline       | Blocker / 2-4 days        | Approved connectivity and shared-workspace decision | Reproducible local setup and evidence ledger              |
| S01 Trustworthy validation             | Blocker / 3-5 days        | S00                                                 | Gate coverage, fail-fast behavior, deterministic fixtures |
| S02 Freshness and provider health      | High / 4-6 days           | S01                                                 | Correct age/status and actionable diagnostics             |
| S03 Offline and recovery               | High / 5-8 days           | S02                                                 | Durable data, lifecycle recovery, safe update flow        |
| S04 Settings and TV information design | High / 4-6 days           | S02                                                 | Clear setup, readable hierarchy, usable card controls     |
| S05 Accessibility and compatibility    | High / 4-6 days           | S03, S04                                            | Verified critical flows across modes and input methods    |
| S06 Performance and endurance          | High / 4-6 days plus soak | S03, S05                                            | Stable always-on behavior and measured budgets            |
| S07 Release provenance and operations  | High / 4-6 days           | S01, S06                                            | Independently verifiable release and rollback rehearsal   |
| S08 Privacy and provider contracts     | High / 3-5 days           | S00; before any optional data expansion             | Accurate data-flow inventory and enforced boundaries      |
| S09 Feed and trend quality             | Medium / 4-7 days         | S02, S03, S05, S08                                  | Deterministic feed behavior and honest trends             |
| E01 Streaming completion               | Conditional / 5-8 days    | S06, S08                                            | Measured streaming benefit with polling fallback          |
| E02 Semantic-link completion           | Conditional / 3-5 days    | S04, S05, S09                                       | Small, lifecycle-safe cross-card interactions             |
| E03 Optional media                     | Conditional / 3-5 days    | S03, S06, S08                                       | Bounded, accessible media with local fallback             |
| E04 Optional AI research               | Discovery only / 2-3 days | S08 and explicit demand                             | Privacy/cost/quality go-or-stop decision                  |
| E05 Optional push security review      | Discovery only / 3-5 days | S03, S07, S08 and explicit demand                   | Security, retention, and delivery go-or-stop decision     |

These ranges are not calendar commitments. S08 can be scheduled earlier where privacy questions block core work; it must finish before the core release candidate. Do not put all optional work into a major-version promise.

**Release candidates**: RC-A contains S00-S03; RC-B adds S04-S08; feed improvements and approved optional features ship independently afterward. Each candidate still requires the full applicable release gate. Version numbers are assigned from actual compatibility impact and completed scope, not this table.

### 3.3 Strategic Stream Traceability

| Prior stream               | New delivery home | Disposition                                                    |
| -------------------------- | ----------------- | -------------------------------------------------------------- |
| P0 Temporal                | S03, S05          | Regression coverage for existing work; no repeat migration     |
| P1 Hierarchy and freshness | S02, S04          | Complete wiring and validate comprehension                     |
| P2 Provider health         | S02, S08          | Audit existing implementation and provider constraints         |
| P3 Feed intelligence       | S09               | Data quality, persistence, then trend display                  |
| P4 Settings                | S04               | Task-based setup and progressive disclosure                    |
| P5 Performance/PWA         | S03, S06          | Recovery, budgets, endurance                                   |
| P6 Accessibility           | S05               | Automated and manual evidence                                  |
| P7 Supply chain            | S01, S07          | Gate correctness and real artifact verification                |
| P8 Oxlint                  | S01-03            | Benchmark and rule-parity decision, not assumed adoption       |
| P9 Streaming               | E01               | Audit existing routes and DO lifecycle first                   |
| P10 AI                     | E04               | Discovery gate; no committed household-data upload             |
| P11 Push                   | E05               | Audit existing KV/VAPID code; no automatic DO/Queues migration |
| P12 Media                  | E03               | Audit existing background/R2 modules and storage budget        |
| P13 Links                  | E02               | Extend existing registry only where useful                     |

## 4. Core Sprint Briefs

### S00 - Toolchain and Truth Baseline

**Owner**: tooling maintainer; reviewer: release maintainer. **Risk**: high shared-workspace blast radius. **Entry**: this plan approved. **Exit**: a fresh shell in the intended checkout resolves the approved toolchain and the evidence ledger distinguishes existing, partial, unverified, and absent behavior.

- **S00-01 - Repair setup readiness (1-2 days).** Follow Section 2.3; verify the intended checkout versus the other `MyScripts` checkout, shared dependency resolution, Worker tools, and browser downloads. Deliver a setup decision and sanitized installed/wanted/latest inventory. Accept only when required packages import from this checkout and matching browsers launch. Block on unavailable registries rather than guessing version freshness.
- **S00-02 - Build the implementation ledger (0.5-1 day).** Inspect each P0-P13 owner, runtime caller, neighboring tests, ADR, and required Worker binding. Record source-present versus wired versus tested versus deployed separately. Include freshness, probes, toasts, push, AI, R2, links, and streaming. Accept when every future task has an existing anchor or explicitly proposed file and no completed feature is scheduled from scratch.
- **S00-03 - Capture reproducible baselines (0.5-1 day).** Record commit, OS, CPU/RAM, Node/browser versions, network fixtures, screen sizes, viewport scaling, test counts from current output, bundle results, and cold/warm timings. Do not reuse changelog counts as current evidence. Accept when another developer can repeat the commands and locate reports without household data.

**Validation**: package import probes, exact CLI versions, focused unit smoke, browser launch, extension diagnostics, and setup walkthrough. **Rollback**: restore approved shared package versions; do not move or delete either checkout. No feature work while this sprint is blocked.

### S01 - Trustworthy Validation and DX

**Owner**: quality/tooling maintainer. **Anchors**: [scripts](../package.json), [workspace tasks](../.vscode/tasks.json), [CI installer](../.github/ci/install-tools.sh), [Vitest config](../vitest.config.ts), [Playwright config](../playwright.config.ts). **Exit**: every required check has a real execution path and a known failing fixture that produces a failed gate.

- **S01-01 - Gate coverage and failure propagation (1-2 days).** Map static checks, unit tests, coverage, Worker checks, builds, E2E, security, and artifact checks to local tasks and CI. Inspect PowerShell task sequences that use `;` for masked earlier failures. Define one authoritative gate contract without duplicate whole-suite work. Accept when intentional failure in each stage stops release/deploy and the task/CI process exits nonzero.
- **S01-02 - Deterministic test and report policy (1-2 days).** Reuse [test helpers](../tests/helpers) for frozen time, fixed RSS/ICS/API fixtures, unavailable Worker, rate limits, and offline cache. Separate live-provider monitoring from blocking deterministic tests. Route reports to TEMP, keep existing coverage thresholds, and prohibit baseline updates just to silence regressions. Accept repeatable focused runs and zero workspace-root report pollution.
- **S01-03 - Tool-value and dependency hygiene (1 day).** Check which CI-installed tools actually run, including Oxlint. Benchmark equivalent full-tree workloads; preserve type-aware ESLint rules until parity is proven. Review duplicate updater ownership, shared-versus-CI version drift, install-script policy, editor recommendation IDs, and obsolete tasks. Accept an adopt/defer/remove decision with timing and rule coverage; do not add tools for count alone.

**Validation**: isolated gate failure fixtures, repeated test subset, report-path inspection, clean-shell setup. **Rollback**: revert gate wiring as one change if any required check stops executing; retain the prior explicit validation command list.

### S02 - Freshness and Provider Health

**Owner**: data/reliability maintainer. **Anchors**: [freshness](../src/core/freshness.ts), [provider](../src/core/provider.ts), [health probes](../src/core/health-probe.ts), [provider toast](../src/core/provider-toast.ts), [diagnostics](../src/ui/diag-overlay.ts), [freshness tests](../tests/unit/core/freshness.test.ts). **Exit**: users can distinguish old data from failed retrieval without opening developer tools.

- **S02-01 - Define the freshness contract (1-2 days).** Separate upstream observation/publication time, successful retrieval time, and local render time. Specify per-provider TTL, market-closed behavior, local-only status, unknown timestamps, future timestamps, and clock skew. Reuse the existing classification helper. Accept boundary fixtures at TTL and twice TTL; loading a stale cache must not reset data age to now.
- **S02-02 - Wire status consistently (1-2 days).** Audit each network-backed card's success, stale-cache, never-loaded, error, and offline path. Use existing tokens and semantic time labels, not color alone or fixed green/yellow/red thresholds for every provider. Verify destroy/remount cleanup and subdued announcements. Accept no false freshness after failure and no network-age badge on a purely local card.
- **S02-03 - Complete the scorecard and drill (2 days).** Audit success/error counts, sample windows, p50/p95, last success, failure streak, and failed stage: Worker, direct, proxy, parse, or cache. Reuse probes and coalesced notifications. Inject timeout, 429, invalid payload, Worker-down, and recovery; accept diagnostics within 5 seconds of detection, one onset notification per incident, and redacted URLs.

**Validation**: extend freshness/provider/toast tests with fake clocks; card integration fixtures; E2E diagnosis drill; theme and RTL screenshots. **Rollback**: revert new presentation without dropping cached data or hiding failures; no cache migration is required merely for badges.

### S03 - Offline, Storage, and Lifecycle Recovery

**Owner**: reliability maintainer. **Anchors**: [cache](../src/core/cache.ts), [IDB cache](../src/core/idb-cache.ts), [SW registration](../src/core/sw-register.ts), [service worker](../sw.ts), [refresh tests](../tests/unit/core/refresh-governor.test.ts), [config backup tests](../tests/unit/core/config-backup.test.ts). **Exit**: interrupted service or browser lifecycle does not erase useful information or cause uncontrolled refresh work.

- **S03-01 - Storage failure and migration contract (2-3 days).** Document authority and invalidation across memory, localStorage, IDB, and SW. Cover denied storage, quota exhaustion, eviction, corrupt entries, schema changes, two tabs, and interrupted writes. Bound storage and preserve prior usable data on failed migration. Accept recovery or an explicit degraded mode without unhandled errors or loss of unrelated settings.
- **S03-02 - Refresh and resume discipline (1-2 days).** Audit the existing governor, visibility guards, timeouts, aborts, backoff, and in-flight deduplication. Test hide/resume, device sleep, offline/online, Worker fallback, DST, and midnight. Accept no nonessential hidden-page polling, no duplicate provider requests after resume, bounded retries, and success without manual reload.
- **S03-03 - Update, restore, and local-file matrix (2-3 days).** Test update available, accepted update, failed precache, old open tab, offline restart after a successful hosted visit, first-ever offline visit, and version mismatch. Preserve the explicit `SKIP_WAITING` message contract. Verify export/import schema validation and safe restore. For `file://`, test only supported rendering/storage/network fallbacks; show capability limits instead of claiming SW parity.

**Validation**: existing cache/IDB/config/SW tests; deterministic offline/update Playwright cases; manual sleep/resume on a target display. **Rollback**: retain backward-readable storage during rollout; restore prior release artifacts without deleting household data. A destructive reset is never the default recovery path.

### S04 - Settings and TV Information Design

**Owner**: UX/frontend maintainer; reviewer: accessibility maintainer. **Anchors**: [settings panel](../src/ui/config-panel.ts), [card registry](../src/core/card-registry.ts), [styles](../src/styles), [first-run tests](../tests/unit/core/first-run-tour.test.ts). **Exit**: basic setup and everyday scanning meet Section 0.2 targets.

- **S04-01 - Information hierarchy audit (1-2 days).** Inventory primary, secondary, and optional data for each card. Evaluate calendar/next-event prominence at 1920x1080 from 3 meters, compact and theater modes, high contrast, and long Hebrew/mixed-direction text. Keep rectangular data tiles and existing token/layer conventions. Accept no clipped metric, accidental overlap, ambiguous reading order, or reliance on opacity that breaks contrast.
- **S04-02 - Task-based settings (2 days).** Audit existing tabs before regrouping. Specify quick visibility/size controls, advanced options, validation, dirty state, cancel/save behavior, per-card reset, and full reset confirmation. Preserve persisted registry IDs and existing settings migrations. Accept keyboard and touch completion of common tasks with no silent data loss or inaccessible advanced fields.
- **S04-03 - Usability evidence (1-2 days).** Run a fixed script with 5 consenting participants: identify next event, detect stale data, change location, hide a card, and restore a backup. Record completion, time, errors, and assistance without collecting private calendars. Fix critical blockers and retest affected tasks. A failed study becomes scoped follow-up work, not a claimed pass.

**Validation**: settings unit/integration tests, RTL and long-label screenshots, target-TV and mobile layout review, observed task results. **Rollback**: preserve old config compatibility and revert layout changes independently from storage behavior.

### S05 - Accessibility and Browser Compatibility

**Owner**: accessibility maintainer. **Anchors**: [UI](../src/ui), [accessibility styles](../src/styles/a11y.css), [E2E suite](../tests/e2e), [screen-reader guidance](screen-reader.md), [browser targets](../.browserslistrc). **Exit**: critical workflows have automated and manual evidence, with no claim that axe alone certifies WCAG.

- **S05-01 - Input and focus contract (1-2 days).** Audit all dialogs, menus, maximized cards, toasts, and remote-key paths. Cover initial focus, Tab order, Escape, focus return, nested overlays, hidden cards, and DOM changes during refresh. Prefer native semantics; avoid redundant ARIA. Accept all primary tasks with keyboard only, visible focus, no trapped focus, and deterministic return to the invoker.
- **S05-02 - Perception and motion (1-2 days).** Check all themes and data states for WCAG text/non-text contrast, text zoom, non-color status, reduced motion, pause behavior for auto-scrolling, and touch target sizing. Test Hebrew labels, numbers, dates, English tickers, and screen-reader announcements. Accept understandable status without color and no announcement storm from periodic badges.
- **S05-03 - Compatibility evidence (2 days).** Run configured smoke/a11y device projects and Chromium visual regression. Add manual target-TV, NVDA/browser, and VoiceOver/Safari checks where available. Test supported minimum versions separately from latest Playwright engines; emulation does not certify physical TV hardware or an older browser. Record unavailable devices as release evidence gaps.

**Validation**: axe plus manual checklist, representative viewport screenshots, text zoom and reduced-motion runs, physical-device observations. **Rollback**: revert problematic enhancements while preserving native controls and keyboard access; no browser-target change without approval.

### S06 - Performance, Energy, and Endurance

**Owner**: performance/reliability maintainer. **Anchors**: [performance helpers](../src/core/perf.ts), [idle scheduling](../src/core/idle.ts), [bundle checker](../scripts/check-bundle-size.mjs), [benchmark checker](../scripts/check-benchmark.mjs), [browser tests](../tests/browser). **Exit**: budgets pass and long-running behavior is bounded on a documented device profile.

- **S06-01 - Repeatable performance budget (1-2 days).** Measure hosted and local-file builds separately, with fixed cold/warm cache conditions and fixture data. Run at least 5 comparable samples; report LCP, CLS, interaction delay, long tasks, request count, and gzip size. Preserve executable bundle limits and current CI assertions. Investigate regressions rather than hiding them with a baseline update or a universal Lighthouse-100 promise.
- **S06-02 - Work and energy budget (1-2 days).** Profile the refresh governor, animations, media, and diagnostics. Coalesce redundant updates; avoid blanket `will-change` and speculative resource hints to unused origins. Compare visible/hidden/low-motion states using CPU time, wakeups, and network activity; energy claims require actual measurement. Accept no new idle polling and no repeated layout shifts from updates.
- **S06-03 - Endurance and fault soak (2 days plus 72 hours).** Run deterministic periodic outages, malformed payloads, reconnects, card hide/show, theme changes, and midnight rollover. Sample retained heap after comparable cleanup, listener/timer counts, cache size, and retry rate. Apply Section 0.2 thresholds and investigate trends rather than comparing arbitrary heap snapshots. Record device sleep separately from application failure.

**Validation**: bundle and benchmark gates, profiles, paired baseline runs, 72-hour report, and post-soak interaction checks. **Rollback**: revert the measured regression in isolation; do not enlarge budgets or disable animations/features globally without a scoped product decision.

### S07 - Release Provenance and Operator Readiness

**Owner**: release/security maintainer. **Anchors**: [reproducibility checker](../scripts/check-reproducible.mjs), [Sigstore checker](../scripts/check-sigstore.mjs), [deployment guide](deployment.md), [security guide](security.md). **Exit**: an independent operator verifies a release and rehearses recovery using documented inputs.

- **S07-01 - Real reproducibility (1-2 days).** Define the complete build inputs: commit, shared lockfile/toolchain snapshot, Node/npm versions, native binaries, environment, and build mode. Compare two clean output trees and archives; normalize only documented nondeterministic metadata such as archive timestamps. Missing input hashes, a dry run, or one manifest must fail to satisfy acceptance. Report exact divergence when outputs differ.
- **S07-02 - Real provenance verification (1-2 days).** Download a release artifact and its verification bundle in an isolated verifier. Check expected repository/workflow identity, issuer, and digest with supported verification tooling. Include tampered artifact, wrong identity, and absent bundle failures. Verify SBOM corresponds to actual artifacts; assess SLSA requirements before claiming a level. Do not add a verified-build badge based on workflow text.
- **S07-03 - Release and rollback rehearsal (2 days).** Map branch protections, least-privilege workflow permissions, dependency-update ownership, artifact retention, release notes, and required review. Rehearse hosted/local builds, Worker compatibility, SW activation, and rollback to the last known-good release. Record owner, commands, recovery time, and user-data preservation; document any external account setting that cannot be verified locally.

**Validation**: independent two-build comparison, positive/negative signature tests, release checklist, staging deployment/rollback with explicit authorization. **Rollback**: retain prior signed artifacts and compatible Worker/config schema; do not delete caches as a substitute for a rollback plan.

### S08 - Privacy, Security, and Provider Contracts

**Owner**: security/data maintainer. **Anchors**: [privacy notice](privacy.md), [data sources](data-sources.md), [Worker routes](../worker/src/routes), [API contract](../worker/openapi.yaml), [fetch layer](../src/core/fetch.ts). **Exit**: public claims match actual enabled modes and sensitive values are protected across normal and failure paths.

- **S08-01 - Data-flow and consent inventory (1-2 days).** Trace direct, Worker, and proxy modes; errors/metrics; public or bearer-like calendar URLs; location; media; AI; and push subscriptions. Record fields, recipient, trigger, default, retention, deletion, and logging policy. Reconcile claims such as no telemetry or no server-side user state against actual enabled behavior. Do not describe a proxied private URL as anonymous by default.
- **S08-02 - Provider and boundary review (1-2 days).** Record official endpoint/docs, terms, attribution, cache TTL, quotas, retry policy, maintenance/market windows, and fallback for each active provider. Review URL allowlists, redirects, DNS/private-address protections where relevant, payload limits, schema validation, CSP/Trusted Types, and secret placement. Test rejected inputs and redact calendar tokens from diagnostics and support exports.
- **S08-03 - Operational controls (1 day).** Define Worker request/storage/egress/inference budgets, alerts, owner, and safe feature shutdown; do not assume a free tier guarantees zero cost. Ensure external probes respect quotas and do not contain household values. Accept one synthetic limit-exceeded drill and one retention/deletion walkthrough for each stored optional data class.

**Validation**: targeted security tests, network/request inspection with synthetic data, redaction fixtures, provider-contract review. **Rollback**: disable only the affected optional service through its existing control; retain safe local viewing. Privacy policy conflicts block E01 and E03-E05 expansion until resolved.

### S09 - Feed Intelligence and Honest Trends

**Owner**: data/frontend maintainer. **Anchors**: [news card](../src/cards/news/news.ts), [currency card](../src/cards/currency/currency.ts), [history helpers](../src/core/history.ts), [SimHash tests](../tests/unit/core/simhash.test.ts), [IDB tests](../tests/unit/core/idb-store.test.ts). **Exit**: users see less duplication without hidden source bias or misleading financial history.

- **S09-01 - Deterministic ranking (1-2 days).** Audit current deduplication and ordering. Define recency decay, stable tie-breaks, missing/future dates, source diversity, update identity, and chronological fallback. Use a labeled synthetic Hebrew/mixed-language corpus and measure false merges as well as duplicate suppression. Accept repeatable order and no loss of materially different updates.
- **S09-02 - Read/starred persistence (1-2 days).** Inspect existing bookmarks before adding stores. Define stable item IDs, retention, migrations, cross-tab behavior, export/delete, and unavailable-storage fallback. Never use a title alone as identity. Accept persistence across reload/offline use and no cross-feed collision or data loss after a failed write.
- **S09-03 - Financial trends (2-3 days).** Reuse history primitives where suitable. Establish provider rights, sampling interval, timezone, market closures, currency/units, precision, gaps, and cache retention before rendering sparklines. Preserve an accessible numeric summary. Accept no fabricated interpolation across missing data, no inverted currency pair, and clear stale/delayed labels.

**Validation**: ranking corpus, property tests for identity/dedup boundaries, persistence recovery tests, accessible chart screenshots and numeric assertions. **Rollback**: keep chronological ordering available and prior bookmark data readable; remove a misleading chart before relaxing correctness criteria.

## 5. Conditional Feature Sprints

These are not prerequisites for a best-in-class core release. A go/no-go decision must show household demand, an owner, affordable operations, accepted privacy impact, and graceful fallback. Existing ADRs inform the decision but do not prove the feature is complete or require it to ship.

### E01 - Streaming Completion (P9)

**Owner**: Worker/data maintainer. **Entry**: S06 and S08 complete; provider terms and quotas allow streaming. **Risk**: reconnect storms, duplicate or late events, and misleading alert-delivery expectations.

- **E01-01 (1-2 days)**: audit existing Worker/DO routes, bindings, hibernation, client wiring, message schema, sequence IDs, and upstream capabilities. Deliver a streaming-versus-polling cost/latency baseline; stop if no user-visible benefit.
- **E01-02 (2-3 days)**: define ordering, replay windows, heartbeat, reconnect backoff/jitter, deduplication, hidden-page policy, and polling fallback. Accept blocked WebSocket, Worker restart, duplicate/out-of-order message, and offline/resume fixtures without event loss within the agreed replay contract.
- **E01-03 (2-3 days)**: run staging fan-out and reconnect tests with bounded clients. Measure p50/p95 server-ingestion-to-render latency, request volume, and cost; proposed p95 <= 1 second applies only to the controlled fixture, not upstream availability or emergency guarantees.

**Validation/rollback**: transport contract tests, replay drill, privacy-safe latency evidence; return to proven polling without wiping cached data.

### E02 - Semantic-Link Completion (P13)

**Owner**: frontend maintainer. **Entry**: S04, S05, S09; product approves specific links. **Anchor**: [existing registry](../src/core/links.ts) and [tests](../tests/unit/core/links.test.ts).

- **E02-01 (1 day)**: audit registrations/callers; specify payload types, missing-target behavior, disabled mode, resolver failure, unregister semantics, and no circular imports. Accept lifecycle tests through mount/destroy/remount.
- **E02-02 (1-2 days)**: implement one approved interaction first, such as calendar event to countdown. Define event identity, timezone, edited/deleted events, and confirmation before creating persisted data. Accept keyboard/touch use with an absent or hidden target card.
- **E02-03 (1-2 days)**: add stocks-to-news and holiday-to-motivation only after the first flow demonstrates value. Define matching quality and empty results; avoid forced relationships. Accept focused integration and accessibility tests with zero new runtime dependencies.

**Validation/rollback**: existing link/property tests plus destination workflows; disabling links must leave each card independently usable and preserve user-created timers.

### E03 - Optional Background Media (P12)

**Owner**: frontend/Worker maintainer. **Entry**: S03, S06, S08. **Anchors**: [background images](../src/ui/bg-images.ts), [R2 route](../worker/src/routes/r2-asset.ts).

- **E03-01 (1 day)**: audit existing rotation, R2 delivery, URL validation, licensing, CORS, cache headers, and image metadata. Decide whether local media already meets demand; do not require R2 or presigned URLs without need.
- **E03-02 (1-2 days)**: define accepted formats, decoded dimensions, byte limits, shared storage allocation, LRU eviction, expired URLs, and offline fallback. Keep household photos off public buckets unless explicitly intended and approved.
- **E03-03 (1-2 days)**: test missing/oversized images, quota errors, low-memory devices, reduced motion, pause controls, text contrast, and local-file fallback. Accept stable layout and no eviction of higher-priority household configuration.

**Validation/rollback**: media fixtures, storage and performance tests, hosted/local screenshots; turn rotation off and retain the standard theme without deleting unrelated cached data.

### E04 - AI Briefing Discovery (P10)

**Owner**: product/security maintainer. **Entry**: explicit demand and S08. **Anchor**: [existing AI route](../worker/src/routes/ai.ts). **Timebox**: 2-3 days; implementation requires a separate approved sprint.

- **E04-01**: compare a deterministic local summary with remote inference using synthetic public news. Do not upload private calendars, tasks, household names, or alert-location context as part of discovery.
- **E04-02**: define explicit opt-in and send action, previewed fields, redaction, retention, deletion, model/provider disclosure, rate limits, budget ceiling, timeout, and non-AI fallback. Treat feed content as untrusted input; assess prompt injection and source attribution.
- **E04-03**: create an evaluation set for factuality, Hebrew quality, unsupported statements, source traceability, and stale inputs. AI must not infer emergency safety or replace official alerts. Deliver evidence and a go/no-go ADR, not a zero-cost or no-keys promise.

**Acceptance/rollback**: product and security approve measurable quality and privacy criteria before implementation; a no-go preserves ordinary cards with no new remote data flow.

### E05 - Push Security and Delivery Discovery (P11)

**Owner**: security/Worker maintainer. **Entry**: explicit demand, S03, S07, S08. **Anchors**: [push route](../worker/src/routes/push.ts), [push tests](../tests/unit/worker/push.test.ts), [push ADR](adr/ADR-091-web-push-vapid-skeleton.md). **Timebox**: 3-5 days; implementation follows only after approval.

- **E05-01**: audit existing KV/VAPID behavior, subscription validation, endpoint allowlisting, redirect behavior, arbitrary-outbound-request risk, subscription ownership/deletion, sender authorization, abuse quotas, and secret rotation. Determine whether accepted subscription data can direct Worker traffic to an unintended host; record findings and required tests without assuming validation is sufficient.
- **E05-02**: reconcile stored subscriptions with the no-cloud-profile policy. Specify retention, explicit subscribe/unsubscribe, deletion on expiry, logging redaction, and operator obligations. Review payload encryption requirements separately from VAPID identity; use a maintained Worker-side implementation if development is approved, not new custom cryptography.
- **E05-03**: define HTTPS/installed-PWA/browser support, permission denied/revoked, background restrictions, duplicate sends, expiry, and offline device behavior. Measure server acceptance separately from device display; replace the previous universal 3-second promise with a bounded test protocol and clear delivery limitations.

**Acceptance/rollback**: threat model and privacy decision approved; critical security gaps block enablement. Retain explicit opt-out and server-side subscription deletion; no public emergency-reliability claim and no requirement for DO/Queues unless demonstrated scale demands it.

## 6. Validation and Release Evidence

### 6.1 Required Verification Layers

Current commands are entry points, not proof that all prerequisites are wired. S01 must validate their actual coverage, build ordering, report destinations, and exit behavior. A missing tool or unavailable target is an explicit blocker for the affected release claim.

| Layer                   | Existing entry point                                                        | Required evidence                                                                                      |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Focused slice           | Installed Vitest CLI with exact touched suites; extension diagnostics       | Failing case before fix where practical, passing case after, no unrelated test edits                   |
| Repository gate         | `npm run check`                                                             | All configured checks pass; do not call it the unit-test suite                                         |
| Unit and coverage       | `npm run test`; `npm run test:coverage`                                     | Current passing results and existing coverage thresholds; reports directed to TEMP                     |
| Real-browser units      | `npm run test:browser -- --run`                                             | Non-watch completion on the configured browser environment                                             |
| Worker                  | [Worker scripts](../worker/package.json)                                    | Typecheck and applicable runtime/route tests with required dependencies and bindings                   |
| Hosted and local builds | `npm run build`; `npm run build:local`                                      | Separate artifacts, correct base paths, SW/capability behavior; do not overwrite one before testing it |
| E2E and accessibility   | `npm run test:e2e`                                                          | Deterministic fixtures, configured device results, manual accessibility evidence                       |
| Bundle                  | `npm run check:bundle`; `npm run check:card-bundle`                         | Fresh matching build; current limits, no stale `dist` evidence                                         |
| Reproducibility         | `npm run check:reproducible` plus S07 independent comparison                | Default dry run alone is insufficient; two actual build outputs compared                               |
| Signing                 | `npm run check:sigstore` plus S07 artifact verification                     | Workflow scan alone is insufficient; identity and digest verified with negative cases                  |
| Security and operations | Relevant security scripts, shared/Worker advisory review, staging drills    | Threat-model coverage and actual runtime behavior, not only string scans                               |
| Documentation           | Installed Markdownlint and Prettier against changed docs; local link checks | No broken references, invalid task IDs, stale completion claims, or format drift                       |

### 6.2 Release Evidence Packet

The release owner assembles a compact packet linked to the exact commit:

- Toolchain/browser manifest, test fixtures, command exits, current coverage and bundle reports.
- Acceptance results by task ID; accessibility/manual device limitations; soak and recovery results.
- Build artifacts and hashes, signature verification, SBOM, reproducibility comparison, and compatibility notes.
- Provider/Worker cost assumptions, required bindings, privacy changes, migration and rollback steps.
- Known blockers with named owners. Do not label an incomplete candidate production-ready or silently waive a required gate.

No application tests, builds, deployments, or release verification are implied by this documentation-only revision. Its validation is scoped to the roadmap.

## 7. Competitive Research Without Unsupported Rankings

Use competitors as design references, not as unsourced claims of superiority. Runtime dependencies, privacy, accessibility, prices, and performance vary by version and configuration. The previous estimated matrix is retired.

| Reference         | Official starting point                               | Practice to evaluate                           | Local experiment                                                   |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Glance            | <https://github.com/glanceapp/glance>                 | Compact information hierarchy and scanning     | S04 time-to-find comparison using equivalent content               |
| MagicMirror       | <https://github.com/MagicMirrorOrg/MagicMirror>       | Ambient lifecycle and recovery                 | S03/S06 sleep, resume, and long-running scenarios                  |
| Homepage          | <https://github.com/gethomepage/homepage>             | Setup and overview clarity                     | S04 first-run task completion                                      |
| Homarr            | <https://github.com/homarr-labs/homarr>               | Configuration discoverability                  | S04 basic-versus-advanced settings review                          |
| Home Assistant    | <https://www.home-assistant.io/dashboards/>           | State semantics and progressive disclosure     | S02 stale/unavailable comprehension test                           |
| DAKboard          | <https://dakboard.com/>                               | Calendar prominence and ambient media          | S04/E03 readability evaluation                                     |
| TRMNL             | <https://usetrmnl.com/>                               | Low-frequency refresh and glanceability        | S06 refresh/energy comparison without copying hardware assumptions |
| Grafana / Netdata | <https://grafana.com/> / <https://www.netdata.cloud/> | Actionable service diagnostics                 | S02 time-to-diagnose exercise                                      |
| Actual Budget     | <https://actualbudget.org/>                           | Clear financial state and local data ownership | S09 trend labels, missing-data behavior, and export review         |

**Quarterly research task**: record source URL, version/date, test configuration, target audience, observation, and a proposed experiment. Separate public documentation from hands-on measurement. Adopt a practice only when it improves the scorecard without violating the static/local-first constraints; do not add a framework to imitate another product.

## 8. Risks, Decisions, and Maintenance

### 8.1 Decision Register

| ID  | Decision / risk                                                                              | Owner                        | Due / consequence                                           |
| --- | -------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| D01 | Intended checkout and supported Node/shared-toolchain layout                                 | Tooling maintainer           | S00; blocks package resolution and upgrades                 |
| D02 | What local/CI/release gates truly execute and how failure propagates                         | Quality maintainer           | S01; blocks trustworthy release results                     |
| D03 | Per-provider freshness, unavailable alerts, and clock semantics                              | Data maintainer              | Before S02 implementation                                   |
| D04 | Storage authority, migration, and rollback compatibility                                     | Reliability maintainer       | Before S03 implementation                                   |
| D05 | Target TV/device profile and access to manual browser/a11y testing                           | Product/accessibility owners | S00 baseline; unresolved coverage blocks related claims     |
| D06 | Telemetry defaults, proxy disclosures, subscription retention, and private calendar handling | Security maintainer          | S08; blocks optional remote-data expansion                  |
| D07 | Provider licensing, quotas, Worker budgets, and operational owner                            | Data/Worker maintainer       | S08; blocks streaming and new upstream requests             |
| D08 | Definition and evidence for reproducible and verified artifacts                              | Release maintainer           | S07; blocks provenance claims                               |
| D09 | Demand and go/no-go for AI, push, media, and semantic links                                  | Product owner                | Before each conditional sprint; deferral is a valid outcome |

### 8.2 Roadmap Hygiene

1. Update task status using **Planned**, **Ready**, **In progress**, **Blocked**, or **Done** with evidence. This revision does not mark source-present features Done.
2. At kickoff, replace role placeholders with named owners and set capacity-based dates. Track a single active core sprint; do not invent parallel staffing.
3. At sprint close, attach acceptance results and move delivered history to the changelog in the implementation PR. Keep this document forward-looking.
4. Recheck affected ADRs and public documentation when a decision changes; add a new ADR only for a real architectural choice.
5. Refresh machine inventory after upgrades and competitor observations quarterly. Installed versions in Section 2 are dated snapshots; authoritative update services decide what is current.
6. Keep runtime counts, benchmark results, and budgets in executable sources. Do not replace verified limits with aspirational numbers in this document.
7. A blocked environment, missing browser, unverified account setting, or failed experiment must remain visible with an owner and next action.
8. Start development only after explicit authorization and S00/S01 readiness. The next action from this revision is to resolve D01 and trusted registry access, not to begin feature implementation.
