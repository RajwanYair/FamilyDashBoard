---
mode: "agent"
description: "Bump the project version number consistently across all files that reference it: package.json, sw.js, CHANGELOG.md, README.md, instruction files, copilot-instructions.md, docs/ARCHITECTURE.md."
tools: ["read_file", "replace_string_in_file", "grep_search", "run_in_terminal"]
---

# Version Bump — FamilyDashBoard

Bump the version from the current value to a new semver target.

## Files to Update

Run `Select-String -Path src,docs,.github -Pattern "<OLD_VERSION>" -Recurse -Include "*.md","*.json","*.js","*.ts"` to locate all version references, then update each one:

| File                                             | Field / Location                         |
| ------------------------------------------------ | ---------------------------------------- |
| `package.json`                                   | `"version"` field                        |
| `sw.js`                                          | Comment header + `CACHE_NAME` constant   |
| `CHANGELOG.md`                                   | New top-level `## vX.Y.Z` heading + date |
| `README.md`                                      | Version badge URL + inline references    |
| `.github/copilot-instructions.md`                | Heading line + test count                |
| `.github/instructions/workspace.instructions.md` | Version reference + test count           |
| `.github/AGENTS.md`                              | Header `> Version:` line                 |
| `docs/ARCHITECTURE.md`                           | Version reference + test count           |
| `.github/assets/banner.svg`                      | Version string + test count              |
| `.github/assets/architecture.svg`                | Version ×3 + test count                  |
| `.github/assets/preview.svg`                     | `Dashboard vX.Y.Z` footer text           |
| `.github/assets/data-sources.svg`                | Title line version                       |
| `.github/assets/roadmap.svg`                     | Test count progression line              |
| `docs/ROADMAP.md`                                | Shipped baseline header                  |
| `.github/skills/release/SKILL.md`                | Verification test count line             |
| `docs/security.md`                               | Title version string                     |

## Steps

1. Confirm the current version: `Get-Content package.json | Select-String version`.
2. For each file in the table, replace **every** occurrence of the old version with the new one.
3. Add a CHANGELOG entry at the top with the new version, date, and a bulleted summary of changes.
4. Run `node scripts/check-sw-version.mjs` — must exit 0.
5. Run `npx tsc --noEmit && npx eslint src tests --max-warnings 0` — must exit 0.

## Validation

```sh
node scripts/check-sw-version.mjs
```

Expected: **SW version matches package.json**

## Output

List every file changed and the old → new version string for each.
Paste the new CHANGELOG entry.
