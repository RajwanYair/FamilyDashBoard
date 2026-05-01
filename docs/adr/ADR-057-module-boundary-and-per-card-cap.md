# ADR-057: Sprint 335-336 Build Hygiene — Module-Boundary Lint and Per-Card Source Hard-Cap

- **Status**: Accepted
- **Date**: 2026-05-02 (v13.35.0 patch series)
- **Sprints**: 335–336
- **Related**: ADR-002 (zero client deps), ADR-019 (bundle budget), ADR-053 (card config schema)

## Context

`docs/ROADMAP.md` §1.11 (Decisions D12 and D13) called out two structural
gaps in the v14.0 readiness checklist:

- **D12** — TypeScript module boundary linting. The `src/cards/*` and
  `src/ui/*` layers communicate exclusively through the registry
  (`src/core/card-registry.ts`), the lifecycle (`src/core/fdb-card.ts`),
  and shared helpers under `src/core/`. Direct cross-imports erode that
  contract and quietly defeat per-card bundle splitting.
- **D13** — Per-card budget hard-cap. Without a runaway-growth guardrail
  any single card can drift toward the global JS gzip ceiling and starve
  the rest. The aspirational target (≤ 6 KB gzip per card ≈ ≤ 24 KB raw)
  is several sprints away; an interim hard-cap is required now.

The default tooling answer (`eslint-plugin-boundaries`) would have added
a runtime ESLint dependency. ADR-002 keeps client deps at zero, and the
spirit extends to dev tooling — every additional plugin is a supply-chain
surface to audit.

## Decision

**D12 — Module boundaries.** Adopt a custom Node script,
`scripts/check-module-boundaries.mjs`, with zero npm dependencies. It
walks `src/` and applies two regex rules:

- `src/cards/*` MUST NOT match `from "...ui/..."`
- `src/ui/*` MUST NOT match `from "...cards/..."`

Six pre-existing violations (`motivation/*`, `stocks.ts`,
`video-news/fdb-video-news.ts`, `ticker.ts`, `today-pane.ts`) are
grandfathered in a `BASELINE` constant. New violations fail with exit 1.
The baseline is itself a backlog item — see ROADMAP §3 D12-baseline —
and shrinks as cards are refactored to call shared helpers in
`src/core/`.

A unit test (`tests/unit/scripts/module-boundaries.test.ts`) executes
the script against the live `src/` tree on every CI run, so silent
breakage of the script is impossible.

**D13 — Per-card source hard-cap.** Extend
`scripts/check-bundle-size.mjs` with a per-card raw-source ceiling:

- Hard-cap: **80 KB raw** per `src/cards/<name>/` directory (`.ts` +
  `.css` + `.html`). Exceeds → exit 1.
- Warn-cap: **50 KB raw** per card. Logs a refactor candidate, no exit.

The hard-cap is intentionally generous (current max: weather at 55 KB,
stocks at 51 KB, news at 49 KB) so it does not break the existing tree
while still preventing uncontrolled growth. The warn-cap names the four
heaviest cards as the next refactor backlog and ratchets each release.

## Consequences

- **Pro:** Zero new dependencies. Both checks ship as ~50-line Node
  scripts that any contributor can read end-to-end.
- **Pro:** D12 is enforced even if the script breaks — the unit test
  catches regressions in the linter itself.
- **Pro:** D13 surfaces refactor candidates without forcing a Big Bang
  rewrite of the heaviest cards.
- **Con:** Custom regex-based linting cannot model TypeScript's full
  import graph. A re-export through `src/core/` could in principle hide
  a forbidden dependency; the linter checks string patterns only.
  Acceptable trade-off — the boundary policy is mechanical and the
  surface area small.
- **Con:** The 80 KB hard-cap is well above the D13 aspiration (≤ 24 KB
  raw). Tracked separately as a per-card refactor stream that will lower
  the ceiling release-by-release.

## Rollout

- v13.35.0 — both gates active; baseline grandfathered.
- v13.36.0+ — each release lowers the warn-cap by 5 KB and ratchets
  baseline shrinkage as refactors land.
- v14.0.0 — target: warn-cap 30 KB, hard-cap 60 KB, zero baseline
  exceptions.

## References

- `scripts/check-module-boundaries.mjs`
- `scripts/check-bundle-size.mjs` (per-card hard-cap section)
- `tests/unit/scripts/module-boundaries.test.ts`
- ROADMAP §1.11 D12, D13
- ADR-002 (zero client deps), ADR-019 (bundle budget)
