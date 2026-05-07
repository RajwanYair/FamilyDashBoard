# ADR-073: Forbid `.only` and `.skip` in Committed Test Files

- **Status**: Accepted
- **Date**: 2026-05-02 (v13.44.0 / Sprints 410–411)
- **Sprints**: 410 (script + npm wiring), 411 (CI wiring), 416 (this ADR)
- **Related**: ADR-001 (TypeScript strict baseline), `.github/instructions/pre-release.instructions.md`

## Context

Vitest exposes the standard Jest-style `it.only`, `test.only`,
`describe.only` (focus) and the matching `.skip` variants. These are
useful **locally** for narrowing a test run while debugging, but are
catastrophic if accidentally committed to `main`:

- `.only` silently disables thousands of sibling tests — coverage drops
  but the suite still reports green.
- `.skip` permanently disables a test until somebody notices the
  yellow line in vitest output (which CI does not surface).

The pre-release zero-tolerance policy already forbids both, but it
relied on human review. As the suite has grown past 6 000 tests across
196 files, a single missed `.only` could ship undetected.

## Decision

1. A standalone Node script — `scripts/check-test-focus-skip.mjs` —
   walks every `*.test.ts` under `tests/` and `exit 1`'s if any line
   matches `\b(it|test|describe)\.(only|skip)\s*\(`.
2. Exposed as `npm run check:test-focus`.
3. Wired into the unified `npm run check` pipeline so local
   pre-commit and pre-release runs catch the violation.
4. Wired into the `unit-tests` job in `.github/workflows/ci.yml`,
   running **before** `npx vitest run`. The CI job fails fast with a
   precise file-and-line message before any test even starts.

## Alternatives considered

- **`eslint-plugin-vitest`'s `no-focused-tests` / `no-disabled-tests`**:
  rejected because it would add another runtime dependency to the
  parent `MyScripts/node_modules/`. The 70-line script has zero deps,
  is auditable in one screen, and runs in < 50 ms.
- **`grep` in CI shell**: rejected because the project is PowerShell-on-
  Windows for local dev; a Node script gives identical behaviour on
  every developer machine and on Linux CI.

## Consequences

### Positive consequences

- Zero risk of `.only` / `.skip` ever reaching `main` again.
- Fast CI feedback: failure is reported in the first second of the
  unit-tests job, not after a 90-second vitest run.
- Local `npm run check` reproduces CI exactly.

### Negative consequences and mitigations

- Developers can no longer `git commit -am "wip"` while a `.only` is
  in flight.
  Mitigation: this is the desired behaviour — the script makes the
  policy mechanical instead of a review burden.

## Notes

added the script and `npm run check:test-focus`.
added the CI step. documents the rationale.
