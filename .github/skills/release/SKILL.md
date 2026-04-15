---
name: release
description: "Create a versioned release of the FamilyDashBoard. Use when: bumping the version number, publishing a new release, updating CHANGELOG, updating SVG documentation assets, tagging a git commit, or preparing a GitHub release. Covers the full release checklist from version bump to git tag."
argument-hint: "New version number, e.g. 7.2.0"
---

# Release — FamilyDashBoard

## Version Bump Locations

Update ALL of these (search current version string, e.g. `7.1.1`):

| # | File | What to update |
|---|------|---------------|
| 1 | `package.json` | `"version"` field |
| 2 | `sw.js` | `CACHE_NAME` / `APP_VERSION` string |
| 3 | `CHANGELOG.md` | New section at top (move [Unreleased] to version + date) |
| 4 | `README.md` | Version badge + test count badge |
| 5 | `.github/copilot-instructions.md` | Header version + test count |
| 6 | `.github/instructions/workspace.instructions.md` | Version + test count |
| 7 | `.github/assets/*.svg` | Version + test count in banner/architecture SVGs |

> `BestDashBoard.html` is legacy/archived — do NOT update its version.

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

```bash
npx tsc --noEmit            # 0 type errors
npx eslint src tests --max-warnings 0   # 0 lint errors
npx markdownlint-cli2 "**/*.md"         # 0 markdown errors
npx vitest run              # all tests pass
npx vite build              # clean build
```

## Commit & Tag

```bash
git add -A
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

`release.yml` auto-creates GitHub Release + attaches dist.zip + sw.js + manifest.json + icon.svg on `v*.*.*` tags.

## Verification

All **1570+ tests / 39+ suites** must pass with 0 failures before tagging.
