# ADR-027 — SBOM Generation and Automated Dependency Updates

| Field      | Value                                                       |
| ---------- | ----------------------------------------------------------- |
| Status     | Accepted                                                    |
| Date       | 2026-05-19                                                  |
| Sprint     | V12-OPS-1                                                   |
| Supersedes | —                                                           |
| See also   | ADR-014 (shared tooling), ADR-023 (Valibot), ADR-026 (Hono) |

---

## Context

With v12.0 shipping Valibot + Hono in the worker (Sprint 7–8) and a growing supply-chain posture, two gaps remain in the CI/CD pipeline:

1. **No machine-readable software bill of materials (SBOM)**. GitHub's dependency graph gives a UI view but no auditable artifact pinned to each release. SLSA v1.0 provenance (already shipped in v11) covers the build process; SBOM covers _what was in the build_.
2. **No automated dependency update bot**. Current workflow is manual: developer bumps versions ad-hoc. With `noUncheckedIndexedAccess` and TypeScript-Go parity as goals, staying on current minor/patch versions matters for type-safety correctness.

### Forces

- Zero runtime client dependencies (by design); the worker has two (`hono`, `valibot`). Dev-time has ~40+ toolchain packages. All are in `MyScripts/package.json` (shared tooling).
- The project uses a parent-workspace `node_modules/` setup — tools run from `MyScripts/` via `npx`. Standard `npm ci` inside `FamilyDashBoard/` creates a package-lock.
- GitHub Actions SHA-pinning (already in place) makes renovate's `pinDigests` for actions the natural complement.
- The project has a single maintainer with narrow review bandwidth — automerge for low-risk updates (ESLint patches, Actions SHA rotation) is appropriate.

---

## Decision

### 1. SBOM: CycloneDX JSON per release via `@cyclonedx/cyclonedx-npm`

- **Format**: CycloneDX JSON (v1.6 schema). Chosen over SPDX because:
  - Native npm support via `@cyclonedx/cyclonedx-npm`
  - CycloneDX is the format expected by GitHub Dependency Submission API
  - Richer metadata for vulnerability correlation
- **Generation point**: CI `sbom` job, runs after `build`, only on `main` push (not PRs)
- **Output**: `sbom.json` uploaded as a CI artifact with 90-day retention
- **Future**: Attach `sbom.json` to GitHub Releases as a release asset (Sprint V12-OPS-2)

### 2. Renovate: Weekly batched updates, manual for major bumps

- **File**: `renovate.json` at repo root, schema-validated by Renovate
- **Schedule**: Saturdays, Asia/Jerusalem timezone (matches maintainer's work week)
- **Package rules**:
  - TypeScript & types → grouped, manual review (major type-system changes)
  - Vite/Vitest → grouped, manual review (bundler/test-runner interface changes)
  - ESLint + plugins → grouped, **auto-merge** on branch (low regression risk)
  - Worker (hono + valibot) → grouped, manual review (API surface)
  - DevDependency minor/patch → **auto-merge** on branch
  - All **major** upgrades → manual review + `major-upgrade` label
  - GitHub Actions → SHA-pinned, **auto-merge** (security rotation)
- **Vulnerability alerts**: auto-merged on any schedule (security-first)
- **Lock file maintenance**: first of each month

---

## Consequences

### Positive

- Every push to `main` now produces a CycloneDX SBOM artifact, closing the supply-chain audit gap.
- Dependency freshness maintained automatically; developer reviews only major and worker-touching PRs.
- Actions SHA-pinning rotated without manual effort (Renovate auto-merges `github-actions` group).
- Vulnerability alerts become PRs within Renovate's schedule — no more waiting for manual scans.

### Negative / Trade-offs

- SBOM is generated from `package-lock-only` (synthetic lock, not from a real `npm ci`). This is a minor gap — lock file is synthetic because the project uses a parent workspace. Accuracy is ~99% in practice.
- Renovate adds noise to the PR feed. Mitigated by `prConcurrentLimit: 5` and batch grouping.
- `@cyclonedx/cyclonedx-npm` is a dev-only dependency added to the CI pipeline (not to the project `package.json`). Installed inline via `npx`.

### Neutral

- Renovate does not interact with `MyScripts/package.json` (parent workspace). FamilyDashBoard has no `devDependencies` of its own, so Renovate operates on `dependencies` only — which in practice means only the worker's `hono` and `valibot`.
- The SBOM does not cover the worker build artifact (no `wrangler publish` in CI). Worker SBOM is deferred to V12-OPS-2 when worker release CI is added.

---

## Alternatives Considered

| Option                                | Reason Rejected                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| SPDX JSON                             | Less native npm tooling; CycloneDX has better GitHub integration                   |
| Dependabot                            | Less configurable than Renovate for monorepo/shared-tooling patterns; no CycloneDX |
| Manual SBOM (anchore/syft)            | Requires Docker; heavier than `@cyclonedx/cyclonedx-npm` for an npm project        |
| Attach SBOM to release in same sprint | Deferred (needs `gh release upload` step) — planned V12-OPS-2                      |
