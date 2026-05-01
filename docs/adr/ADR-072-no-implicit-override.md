# ADR-072: Enable `noImplicitOverride` Compiler Flag

- **Status**: Accepted
- **Date**: 2026-05-02 (v13.43.0 / Sprint 403)
- **Sprints**: 403 (enable), 408 (this ADR)
- **Related**: ADR-001 (TypeScript strict baseline)

## Context

The shared `tooling/tsconfig/base-typescript.json` already opts into the
strictest TypeScript surface available in 6.0.3:

- `strict: true` (full bundle)
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `verbatimModuleSyntax`
- `noFallthroughCasesInSwitch`
- `noImplicitReturns`

`noImplicitOverride` was the last cheap-but-meaningful guard not yet
enabled. It requires every method that overrides a base-class method
to carry the `override` keyword, eliminating an entire class of
silent-shadow regressions when base classes evolve.

The dashboard codebase has very few class hierarchies (most of the
runtime is module-level functions plus one or two shallow classes in
`src/ui/` and worker code), so the migration cost was zero — a typecheck
on the whole project produced no errors when the flag was flipped.

## Decision

Enable `noImplicitOverride: true` in
`tooling/tsconfig/base-typescript.json`. The setting is inherited by
all four project tsconfigs (root, `tsconfig.node.json`,
`tsconfig.scripts.json`, `tsconfig.sw.json`) and the worker's own
tsconfig via the shared base.

## Consequences

### Positive consequences

- Future class-hierarchy growth (e.g. a planned `BaseCard` abstraction
  in v14.x) cannot silently shadow a parent method.
- Zero runtime cost — pure type-checker enhancement.
- Zero migration cost in v13.43.0 — clean typecheck on first run.

### Negative consequences and mitigations

- Any contributor adding an `override`-shaped method must remember the
  keyword. The compiler error is precise and self-explanatory, so this
  is a near-zero-friction guard.

## Notes

Sprint 403 commit `f59e68b`. ADR authored Sprint 408 (v13.44.0 prep).
