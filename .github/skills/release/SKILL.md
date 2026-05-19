---
name: release
description: "Create a versioned release of the FamilyDashBoard. Use when: bumping the version number, publishing a new release, updating CHANGELOG, updating SVG documentation assets, tagging a git commit, or preparing a GitHub release. Covers the full release checklist from version bump to git tag."
argument-hint: "New version number, e.g. 7.2.0"
---

# Release — FamilyDashBoard

Use this skill only when you are doing an actual versioned release or preparing the repository for one. For general cleanup, use the pre-release instructions without tagging.

## Version Bump Locations

Update the live version anchors and release metadata below. Do not reintroduce stale test-count snapshots into active operator docs.

| #   | File                                             | Field / location                                          | Notes                                            |
| --- | ------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| 1   | `package.json`                                   | `"version"` field                                         | Single source of truth for `__APP_VERSION__`     |
| 2   | `sw.js`                                          | Comment header version string                             | e.g. `/* FamilyDashBoard ServiceWorker — vX.Y.Z` |
| 3   | `CHANGELOG.md`                                   | New `## [X.Y.Z]` section at top; release evidence line    | Move `[Unreleased]` → versioned section          |
| 4   | `README.md`                                      | `Version-X.Y.Z` badge and any release-facing version text | Keep badges aligned with the shipped version     |
| 5   | `.github/copilot-instructions.md`                | Header version only                                       | Keep validation guidance canonical               |
| 6   | `.github/instructions/workspace.instructions.md` | Header version only                                       | Keep validation guidance canonical               |
| 7   | `docs/ARCHITECTURE.md`                           | Title `(vX.Y.Z)` and any release-facing version text      | Do not duplicate volatile test totals            |
| 8   | `.github/assets/banner.svg`                      | Version string in footer text                             |                                                  |
| 9   | `.github/assets/architecture.svg`                | Version (×3: title, sw.js label, footer)                  |                                                  |
| 10  | `.github/assets/preview.svg`                     | `Dashboard vX.Y.Z` footer text                            | Line ~156                                        |
| 11  | `.github/assets/data-sources.svg`                | `Data Sources… — vX.Y.Z` title                            | Line ~9                                          |
| 12  | `.github/assets/roadmap.svg`                     | Release-facing version text only                          | Keep the asset descriptive, not snapshot-driven  |
| 13  | `docs/ROADMAP.md`                                | `Shipped baseline: vX.Y.Z` when a new release is prepared | Keep roadmap forward-only                        |
| 14  | `.github/skills/release/SKILL.md`                | Verification guidance if the release process changed      | Keep it aligned with current repo state          |
| 15  | `docs/security.md`                               | Title `Security Model — FamilyDashBoard vX.Y.Z`           | Lines 1 and 4 (updated date + version)           |
| 16  | `.github/AGENTS.md`                              | Header `> Version: vX.Y.Z ...`                            | Keep it descriptive, not snapshot-driven         |

> `BestDashBoard.html` is legacy/archived — do NOT update its version.
> Keep active docs descriptive. Historical counts belong in `CHANGELOG.md`, release evidence, or generated reports.

## CHANGELOG Format

```markdown
## [X.Y.Z] — YYYY-MM-DD

> **N tests / M suites / 0 failures** (commit `<hash>`)

- **Feature name**: brief description
- **Fix name**: what was broken → what was fixed
```

One line per item. Move from `[Unreleased]` block. Skip empty sections.

## SVG Assets

Files in `.github/assets/` — update version number and test count.
Validate XML: open in browser or run `Get-Content .github/assets/banner.svg -Raw` in PowerShell.

## Versioning Scheme

| Change                    | Bump  | Example       |
| ------------------------- | ----- | ------------- |
| New card or major feature | Minor | 7.1 → 7.2     |
| Bug fix / polish          | Patch | 7.1.0 → 7.1.1 |
| Breaking layout redesign  | Major | 7.x → 8.0     |

## Pre-release Checklist

> **Full checklist lives in `.github/instructions/pre-release.instructions.md`** — load it and run every item in order.

Quick summary (PowerShell):

```powershell
npm run check
npm run check:actions-pinned
npm run check:ignore-scripts
npm run check:sigstore
npm run check:reproducible
npm run build
npm run check:bundle
npm run check:card-bundle
```

All commands must exit 0. No `eslint-disable`, no `@ts-ignore`, no dead exports, and no release without CI-parity checks.

Also verify the workflow docs and release configuration still match reality:

- `.github/workflows/README.md`
- `.github/release.yml`
- `.github/workflows/release.yml`

## Commit & Tag

```powershell
git add -A
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

`release.yml` auto-creates GitHub Release + attaches `dist.zip`, `sw.js`, and `dist/icon.svg` on `v*.*.*` tags.

## Verification

Run the full pre-release gate in order; every command must exit 0:

```powershell
npm run check
npm run check:actions-pinned
npm run check:ignore-scripts
npm run check:sigstore
npm run check:reproducible
npm run build
npm run check:bundle
npm run check:card-bundle
node scripts/check-version-consistency.mjs
```

Zero tolerance: 0 type errors · 0 lint errors/warnings · 0 markdownlint errors ·
0 test failures · 0 dead exports · clean build · bundle budgets green · version anchors consistent.
Always confirm the live release evidence in `CHANGELOG.md` and generated checks before tagging; do not carry forward stale totals into active docs.

Read `.github/instructions/workspace.instructions.md` before updating any
release-facing toolchain text. Do not carry forward stale totals.
