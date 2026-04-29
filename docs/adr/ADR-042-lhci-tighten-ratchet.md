# ADR-042 — LHCI Performance Threshold Tightening Plan

| Field   | Value                          |
| ------- | ------------------------------ |
| Date    | 2026-04-28                     |
| Status  | Accepted (Plan)                |
| Sprint  | 134 (V14-FOUNDATIONS)          |
| Related | Roadmap item #19, Roadmap §4.1 |

## Context

Lighthouse CI (LHCI) currently asserts the performance category at
`warn 0.70` (warning threshold, no hard error). This was relaxed in v13.13 from
the previous `error 0.95` after CI runners showed 12 % run-to-run variance on a
3-card mid-load and the `warn 0.70` floor was a pragmatic compromise.

Roadmap item #19 calls for a return to `error 0.97` once **HTTP Early Hints
(item #7)** and **SRI (shipped v13.9)** are both live and the CI runner is stable.

We need a single document that codifies:

1. The exit criteria.
2. The intermediate ratchet steps.
3. The rollback plan when a single PR regresses past the floor.

## Decision

Adopt a four-step ratchet plan for the LHCI `performance` category assertion in
`tooling/ci/lighthouse.json` (or its successor):

| Step | Threshold       | Trigger to advance                                                     | Target sprint |
| ---- | --------------- | ---------------------------------------------------------------------- | ------------- |
| 0    | `warn 0.70`     | (original baseline)                                                    | ~~active~~ Done Sprint 124 |
| 1    | `warn 0.80`     | 30 consecutive PRs ≥ 0.85 measured                                     | ~~v13.16~~ Done Sprint 147 |
| 2    | `error 0.85`    | HTTP Early Hints (Roadmap #7) live in production                       | **v13.18 — Sprint 161 (triggered)** |
| 3    | `error 0.92`    | SLSA L3 hermetic build (ADR-035) live; runner instance type pinned    | v14.1         |
| 4    | `error 0.97`    | 60 consecutive PRs ≥ 0.97 measured; 14-day RUM Web Vitals ≥ 0.95 LCP   | v14.2         |

Each ratchet step is gated on a PR that updates this ADR's "Current step" line
below and the LHCI config. No two ratchets ship in the same release.

**Current step**: 3 (`error 0.92`) — Ratcheted Sprint 217 (v13.24.0); accessibility also raised to 0.90.

### Rollback

Any merged PR that lowers the measured performance score below the active
threshold by more than 0.03 triggers an **automatic ratchet rollback to the
previous step** in the next patch release, with a `gh issue` opened citing this
ADR.

## Consequences

### Positive

- Removes the perennial debate about "is 0.70 too lax / 0.97 too strict" by
  encoding the trade-off as a measurable, sequential ratchet.
- Forces every tightening step to be backed by either (a) a measurable
  performance win shipped, or (b) demonstrable runner stability.
- Aligns with the V14-FOUNDATIONS exit criterion ("LHCI perf back to
  `error ≥ 0.97`").

### Negative

- 4 ratchet steps means 4 separate release cycles spent on perf gating —
  roughly two quarters of cadence.
- A noisy CI runner can stall the ratchet at step 1 indefinitely.

### Neutral

- The PR-time `coverage` gate is unchanged (canonical thresholds in
  `vitest.config.ts`); only the `performance` LHCI category is governed here.

## Verification

- Each ratchet PR must:
  1. Update the **Current step** line above.
  2. Update `tooling/ci/lighthouse.json` (or successor) to the new threshold.
  3. Cite the trigger condition with evidence (link to PR list, runner status,
     or RUM dashboard).
- Pre-release checklist (`.github/instructions/pre-release.instructions.md`)
  references this ADR's "Current step" line as the source of truth for the
  expected LHCI threshold.
