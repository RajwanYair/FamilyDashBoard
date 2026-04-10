---
name: release
description: "Create a versioned release of the FamilyDashBoard. Use when: bumping the version number, publishing a new release, updating CHANGELOG, updating SVG documentation assets, tagging a git commit, or preparing a GitHub release. Covers the full release checklist from version bump to git tag."
argument-hint: "New version number, e.g. 4.8 or 4.7.1"
---

# Release — FamilyDashBoard

## When to Use
- Publishing a new version after a feature or fix
- Bumping the version constant in the HTML
- Generating a CHANGELOG entry
- Updating SVG documentation assets
- Tagging the commit and creating a GitHub release

---

## Step 1 — Determine Version

Use [Semantic Versioning](https://semver.org/) adapted for this project:

| Change type | Version bump | Example |
|-------------|-------------|---------|
| New card / major feature | Minor (`4.x → 4.x+1`) | `4.7 → 4.8` |
| Bug fix, polish, small addition | Patch (`4.x.y → 4.x.y+1`) | `4.7.0 → 4.7.1` |
| Full redesign / breaking layout | Major (`4.x → 5.0`) | `4.x → 5.0` |

Current version is stored in:
1. `BestDashBoard.html` — JS constant `const VERSION = 'v4.x'` or similar near the top of `<script>`
2. Status bar HTML element displaying the version
3. `README.md` badge
4. CHANGELOG.md header

---

## Step 2 — Update Version in HTML

In `BestDashBoard.html`, find and update:
```javascript
// Near top of <script>
const VERSION = 'v<NEW>';
```
Also update the status bar display element if version is hardcoded there.

Run this search to locate all version references before editing:
```
grep_search pattern: "v4\." in BestDashBoard.html
```

---

## Step 3 — Update CHANGELOG.md

Add a new section at the top of `CHANGELOG.md` (above the previous release):

```markdown
## [v<NEW>] — <YYYY-MM-DD>

### Added
- <Feature 1>
- <Feature 2>

### Changed
- <What changed and in which direction> (e.g., "Replaced GIF icons with emoji")

### Fixed
- <Bug that was fixed>

### Removed
- <What was removed>
```

**Rules for CHANGELOG entries:**
- "Changed" entries must accurately describe the direction of change (not ambiguous)
- Use present tense ("Add", "Fix", "Remove")
- Skip empty sections — don't include `### Fixed` if nothing was fixed

---

## Step 4 — Update SVG Documentation Assets

The 5 SVGs in `.github/assets/` must be refreshed after major changes:

| SVG file | What to update |
|----------|---------------|
| `banner.svg` | Version number |
| `architecture.svg` | Section counts, layout percentages |
| `data-sources.svg` | API names, count, refresh intervals |
| `tech-stack.svg` | Any new capabilities |
| `preview.svg` | Only if layout changed significantly |

**Validate SVGs with PowerShell after editing:**
```powershell
[xml](Get-Content .github/assets/banner.svg -Raw)
```
A parse error means malformed XML — fix before committing.

---

## Step 5 — Update README Badges (if version changed)

In `README.md`, find:
```markdown
![Version](https://img.shields.io/badge/version-v4.x-...)
```
Update the badge URL to the new version.

---

## Step 6 — Run Tests

```bash
node --test tests/dashboard.test.mjs
```

All 398 tests across 44 suites must pass. If the version string changed, update the version regex in the test file:
```javascript
// In tests/dashboard.test.mjs — find version test
assert.match(html, /VERSION\s*=\s*'v<NEW>'/);
```

---

## Step 7 — Commit

```bash
git add BestDashBoard.html CHANGELOG.md README.md .github/assets/
git commit -m "chore: release v<NEW>"
```

Use Conventional Commits format:
- `feat: add <feature>` — for feature releases
- `fix: <description>` — for patch releases
- `chore: release v<NEW>` — for release commit

---

## Step 8 — Tag

```bash
git tag v<NEW>.0
git push origin main --tags
```

The `release.yml` GitHub Actions workflow triggers on tags matching `v*.*.*` and creates a GitHub Release automatically from the CHANGELOG entry.

---

## Quick Release Checklist

```
[ ] VERSION constant updated in BestDashBoard.html
[ ] Status bar version element updated (if hardcoded)
[ ] CHANGELOG.md entry added at top
[ ] SVG assets refreshed (banner.svg at minimum)
[ ] README.md version badge updated
[ ] node --test passes (398 tests / 44 suites)
[ ] git commit with conventional commit message
[ ] git tag vX.Y.Z pushed
```
