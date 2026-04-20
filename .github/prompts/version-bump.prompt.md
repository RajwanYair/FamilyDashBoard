---
mode: "agent"
description: "Bump the project version number consistently across all files that reference it: package.json, sw.js, CHANGELOG.md, README.md, CLAUDE.md, instruction files, copilot-instructions.md, ARCHITECTURE.md."
tools: ["read_file", "replace_string_in_file", "grep_search", "run_in_terminal"]
---

# Version Bump — FamilyDashBoard

Bump the version from the current value to a new semver target.

## Files to Update

Run `grep -r "8\.[0-9]\+\.[0-9]\+" --include="*.{md,json,js,ts}"` to locate all version references, then update each one:

| File | Field / Location |
|------|-----------------|
| `package.json` | `"version"` field |
| `sw.js` | Comment header + `CACHE_NAME` constant |
| `CHANGELOG.md` | New top-level `## vX.Y.Z` heading + date |
| `README.md` | Version badge URL + inline references |
| `CLAUDE.md` | Version heading |
| `.github/copilot-instructions.md` | Heading line |
| `.github/instructions/workspace.instructions.md` | Version reference |
| `ARCHITECTURE.md` | Version reference |

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
