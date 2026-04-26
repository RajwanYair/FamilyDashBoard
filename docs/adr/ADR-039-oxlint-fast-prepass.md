# ADR-039 — oxlint as Fast CI Pre-Pass

| Field  | Value                 |
| ------ | --------------------- |
| Date   | 2026-04-26            |
| Status | Accepted              |
| Sprint | 107 (V14-FOUNDATIONS) |

## Context

The ESLint 10 + typescript-eslint 8 gate runs ~25–35 seconds in CI due to type-aware rules
that require a full TypeScript program. Fast-failing the build on simple lint violations
(naming, style, redundant code) reduces wasted CI minutes and gives developers quicker
feedback on PRs.

[oxlint](https://oxc.rs/docs/guide/usage/linter.html) is a Rust-native linter with ~100
built-in rules that cover most of ESLint's non-type-aware rule set. It executes in ~200 ms
on this codebase.

## Decision

Introduce oxlint as a **parallel fast pre-pass** before ESLint in the CI `lint` job:

```yaml
- name: oxlint (fast pre-pass)
  run: npx --yes oxlint@^1.61.0 --quiet src tests
```

`--quiet` reports only errors (no warnings) so oxlint cannot generate false positives
that block the build without a corresponding ESLint violation.

ESLint remains the **canonical** lint gate for type-aware rules, custom plugin rules
(perfectionist, unicorn), and project-specific overrides. oxlint is **additive only**:
any rule oxlint covers that ESLint also covers is redundant but harmless; there is no
plan to remove the overlapping ESLint rules.

## Consequences

- CI `lint` job: oxlint step added before the ESLint step (~200 ms overhead).
- `@lhci/ci/install-tools.sh`: `oxlint@^1.61.0` added to the npm install list.
- Fast failures (naming, unused imports, no-debugger) surface in ~5 seconds instead of ~30 seconds.
- oxlint is pinned with `^1.61.0`; Renovate / Dependabot auto-bumps on minor/patch.

## Alternatives Considered

| Option                                  | Rejected Reason                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Replace ESLint with oxlint              | oxlint does not yet implement type-aware rules or unicorn/perfectionist plugins required by this project. |
| Biome as ESLint replacement             | Same coverage gap; additionally requires migrating formatter config from Prettier.                        |
| Increase ESLint parallelism (`--cache`) | Already using `--cache --cache-strategy content`; diminishing returns.                                    |
