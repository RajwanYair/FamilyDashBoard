# ADR-021: TypeScript-Go (tsgo) as Second CI Typecheck

**Date:** 2026-04-23
**Status:** Accepted
**Deciders:** Project maintainer
**Supersedes:** Nothing — additive
**Context:** V12-MODERNISE-1

---

## Context

Microsoft announced `tsgo` (TypeScript-Go) in March 2025: a complete rewrite of the
TypeScript compiler and language service in Go. Key claims:

- **8–10× faster** cold `tsc --noEmit` (2.7 GB source → 800 ms vs 7 s)
- Same `tsconfig.json` — zero migration cost
- Identical type-checking semantics (ported algorithm by algorithm)
- Open-source at <https://github.com/microsoft/typescript-go>

At v12.0 time, `tsgo` is **alpha-stable**: it passes the full TypeScript compiler test
suite and the top 1 000 npm packages' type definitions, but the CLI API surface is not
yet finalised and a handful of advanced diagnostics differ by design.

---

## Decision

**Add `tsgo` as a _second_, parallel CI typecheck job.** The existing `tsc` job remains
the canonical gate. `tsgo` runs with `continue-on-error: true` so alpha regressions
cannot block merges — but failures are reported in the CI summary for triage.

Promote `tsgo` to **primary** (and remove `tsc`) when both of the following hold:

1. `tsgo` exits the alpha label (Microsoft blog post + semver ≥ 1.0).
2. `tsgo` passes the same zero-error baseline locally (`npx @typescript/tsgo --noEmit`).

The two-gate window gives us:

- Free early warning of type drift that `tsc` might not yet catch.
- Measured cold-run speed improvement on CI (tracked in bundle-trend).
- Zero risk of a blocked PR during the alpha period.

---

## Implementation

### CI (`.github/workflows/ci.yml`)

New job `typecheck-tsgo` runs in parallel with `typecheck`:

```yaml
typecheck-tsgo:
  name: TypeScript-Go (alpha second pass)
  runs-on: ubuntu-latest
  timeout-minutes: 5
  continue-on-error: true
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
    - name: Install CI toolchain
      run: bash .github/ci/install-tools.sh
    - name: Install tsgo
      run: npm install -g @typescript/tsgo --ignore-scripts
    - name: tsgo typecheck (alpha — informational)
      run: tsgo --noEmit 2>&1 || echo "::warning::tsgo found issues (alpha — not yet blocking)"
```

### Local development

Developers can run `npx @typescript/tsgo --noEmit` for a fast parallel check.
No changes to existing `npm run check` or `npx tsc` workflow.

---

## Consequences

**Good:**

- CI gets an 8–10× faster supplementary typecheck in parallel.
- We track `tsgo` fidelity early, reducing the promotion cost later.
- Zero risk of blocked PRs during alpha (continue-on-error).

**Neutral:**

- Adds ~30 s to the CI wall-clock budget (parallel, so no change to critical path).
- Requires periodic review of `tsgo` release notes.

**Bad:**

- Alpha-period false positives will generate CI warnings that need triage.

---

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Promote tsgo to primary immediately | Rejected — alpha stability not proven on our exact tsconfig/plugin set |
| Ignore tsgo entirely until 1.0 | Rejected — early signal is cheap and valuable |
| Run tsgo only on PR, not on main | Considered — rejected because main pushes benefit most from fast feedback |

---

## References

- <https://github.com/microsoft/typescript-go>
- TypeScript Summit 2025 announcement
- ADR-015 (env type isolation — same typecheck scope)
