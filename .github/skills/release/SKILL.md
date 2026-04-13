---
name: release
description: "Create a versioned release of the FamilyDashBoard. Use when: bumping the version number, publishing a new release, updating CHANGELOG, updating SVG documentation assets, tagging a git commit, or preparing a GitHub release. Covers the full release checklist from version bump to git tag."
argument-hint: "New version number, e.g. 5.2.0"
---

# Release — FamilyDashBoard

## Version Bump Locations

Update ALL of these (search current version string, e.g. `v5.1.0`):

| # | File | What to update |
|---|------|---------------|
| 1 | `BestDashBoard.html` | Status bar `<span>Dashboard vX.Y.Z` |
| 2 | `BestDashBoard.html` | Comment block `FAMILY DASHBOARD vX.Y.Z` |
| 3 | `sw.js` | `CACHE_NAME` string |
| 4 | `CHANGELOG.md` | New section at top |
| 5 | `README.md` | Version badge |
| 6 | `package.json` | `"version"` field |
| 7 | `tests/dashboard.test.mjs` | Version assertion regex |
| 8 | `.github/assets/*.svg` | Version + test count in banner/architecture/data-sources/tech-stack |

> There is NO `const VERSION` JS variable — version lives in the status bar HTML and comment block only.

## CHANGELOG Format

```markdown
## [vX.Y.Z] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Skip empty sections. Use present tense.

## SVG Assets

5 files in `.github/assets/` — update version number, test count, any changed metrics.
Validate: `[xml](Get-Content .github/assets/banner.svg -Raw)` in PowerShell.

## Versioning Scheme

| Change | Bump | Example |
|--------|------|---------|
| New card / major feature | Minor | 5.1 → 5.2 |
| Bug fix / polish | Patch | 5.1.0 → 5.1.1 |
| Breaking layout redesign | Major | 5.x → 6.0 |

## Commit & Tag

```bash
git add -A
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

`release.yml` auto-creates GitHub Release + attaches 4 artifacts on `v*.*.*` tags.

## Verification

```bash
node --test tests/dashboard.test.mjs
```

All **1084 tests / 61 suites** must pass with 0 fail, 0 skip.
