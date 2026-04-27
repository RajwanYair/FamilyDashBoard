# ADR-034 — Changesets Auto-CHANGELOG

| Field        | Value                                   |
| ------------ | --------------------------------------- |
| **Date**     | 2026-04-23                              |
| **Status**   | Accepted                                |
| **Deciders** | @RajwanYair                             |
| **Tags**     | ops, dx, changelog, release, automation |

---

## Context

`CHANGELOG.md` is currently maintained manually: each sprint adds a section describing the
change, the ADR it relates to, and the sprint number. This is accurate but requires human
discipline at release time (a sprint is sometimes committed without a CHANGELOG entry, then
back-filled at the next release).

`@changesets/cli` (maintained by Atlassian) provides a workflow where:

1. During development, the author runs `npx changeset` and records a short description +
   semver bump type (patch/minor/major).
2. A `.changeset/*.md` file is staged and committed alongside the code change.
3. At release time, `npx changeset version` bumps `package.json` + writes `CHANGELOG.md`
   from all accumulated changeset files automatically.
4. The changeset files are deleted after being consumed.

This eliminates the last manual step in the release process (`npm run release:report` already
exists; this replaces the manual CHANGELOG editing portion).

---

## Decision

Adopt `@changesets/cli` as a devDependency in `MyScripts/package.json` (shared tooling, ADR-014).

Configuration:

1. `.changeset/config.json`:
   - `changelog`: `"@changesets/changelog-github"` (links to commits/PRs).
   - `commit`: `false` (we stage manually, commit ourselves).
   - `linked`: `[]` (single package).
   - `access`: `"restricted"` (private repo).
   - `baseBranch`: `"main"`.
2. Add `"changeset": "changeset"` npm script to `FamilyDashBoard/package.json`.
3. Add `"version": "changeset version && npm run lint:md"` npm script (validates MD after version bump).
4. Keep `CHANGELOG.md` as the canonical history — changesets append to it, do not replace it.
5. CI: `.github/workflows/release.yml` runs `npx changeset status --verbose` to fail the build
   if a feature PR is merged without a changeset file.

**Migration**: existing `CHANGELOG.md` content (v12.3.0 and earlier) is preserved as-is.
Changesets only manage entries from v12.4.0 onward.

---

## Consequences

### Good

- CHANGELOG is always up to date at merge time, not at release time.
- Semver bumps are deliberate and documented per-change.
- Release process reduced to: `npx changeset version && git add -A && git commit && git tag`.

### Neutral

- Contributors must remember to run `npx changeset` when merging features.
- Minor learning curve for the changeset workflow.
- Changesets file format is `.md` with YAML front-matter — markdownlint rule `MD041` must be
  suppressed for the `.changeset/` directory.

**Related ADRs**: ADR-014 (shared tooling presets), ADR-009 (config schema evolution).
