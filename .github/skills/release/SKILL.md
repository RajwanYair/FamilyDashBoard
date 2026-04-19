---
name: release
description: "Create a versioned release of the FamilyDashBoard. Use when: bumping the version number, publishing a new release, updating CHANGELOG, updating SVG documentation assets, tagging a git commit, or preparing a GitHub release. Covers the full release checklist from version bump to git tag."
argument-hint: "New version number, e.g. 7.2.0"
---

# Release — FamilyDashBoard

Use this skill only when you are doing an actual versioned release or preparing the repository for one. For general cleanup, use the pre-release instructions without tagging.

## Version Bump Locations

Update ALL of these (search current version string, e.g. `7.9.0`):

| # | File | Field / location | Notes |
|---|------|-----------------|-------|
| 1 | `package.json` | `"version"` field | Single source of truth for `__APP_VERSION__` |
| 2 | `sw.js` | Comment header version string | e.g. `/* FamilyDashBoard ServiceWorker — vX.Y.Z` |
| 3 | `CHANGELOG.md` | New `## [X.Y.Z]` section at top; test count line | Move `[Unreleased]` → versioned section |
| 4 | `README.md` | `Version-X.Y.Z` badge + `Vitest-NNNN_passing` badge | Lines ~22-23 |
| 5 | `CLAUDE.md` | Header `v7.X.Y`, test count (×2), suite count | Lines 1, 17, 48 |
| 6 | `.github/copilot-instructions.md` | Header version + test count | Lines 1, 6 |
| 7 | `.github/instructions/workspace.instructions.md` | Header version + test count | Line 6 |
| 8 | `ARCHITECTURE.md` | Test count in stack table + constraint list | Lines ~14, ~195 |
| 9 | `.github/assets/banner.svg` | Version string + test count in footer text | Line ~34 |
| 10 | `.github/assets/architecture.svg` | Version (×3: title, sw.js label, footer) + test count | Lines ~15, 25, 124, 142 |
| 11 | `.github/assets/preview.svg` | `Dashboard vX.Y.Z` footer text | Line ~156 |
| 12 | `.github/assets/data-sources.svg` | `Data Sources… — vX.Y.Z` title | Line ~9 |
| 13 | `.github/assets/roadmap.svg` | Test count progression line | Line ~90 |
| 14 | `ROADMAP.md` | New row in the version history table | Bottom of the released versions table |
| 15 | `.github/skills/release/SKILL.md` | Verification guidance if the baseline changed | Keep it aligned with current repo state |

> `BestDashBoard.html` is legacy/archived — do NOT update its version.
> `ROADMAP.md` comment `<!-- Last updated: vX.Y.Z -->` at the bottom should also be bumped.

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

| Change | Bump | Example |
|--------|------|---------|
| New card or major feature | Minor | 7.1 → 7.2 |
| Bug fix / polish | Patch | 7.1.0 → 7.1.1 |
| Breaking layout redesign | Major | 7.x → 8.0 |

## Pre-release Checklist

> **Full checklist lives in `.github/instructions/pre-release.instructions.md`** — load it and run every item in order.

Quick summary (PowerShell):

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx markdownlint-cli2 "**/*.md" --ignore node_modules --ignore dist
npx vitest run
npx vite build
```

All five must exit 0. No `eslint-disable`, no `@ts-ignore`, no `console.log` in `src/`.

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

`release.yml` auto-creates GitHub Release + attaches dist.zip + sw.js + icon.svg on `v*.*.*` tags.

## Verification

Run the full pre-release gate in order; every command must exit 0:

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx markdownlint-cli2 "**/*.md" "#**/node_modules/**" "#**/coverage/**"
npx vitest run
npm run build
node scripts/check-bundle-size.mjs
node scripts/check-sw-version.mjs
```

Zero tolerance: 0 type errors · 0 lint errors/warnings · 0 markdownlint errors ·
0 test failures · JS gzip ≤ 100 KB · CSS gzip ≤ 25 KB · SW version matches `package.json`.

Read `.github/instructions/workspace.instructions.md` before updating any
hardcoded test-count or toolchain text. Do not carry forward stale totals.
