---
description: "Bump the project version number consistently across all files that reference it: package.json, sw.js, CHANGELOG.md, README.md, instruction files, copilot-instructions.md, docs/ARCHITECTURE.md."
tools: ["read_file", "replace_string_in_file", "multi_replace_string_in_file", "grep_search", "file_search", "run_in_terminal", "get_terminal_output", "get_errors", "manage_todo_list", "vscode_listCodeUsages", "tool_search", "memory"]
---

# Version Bump — FamilyDashBoard

Bump the version from the current value to a new semver target.

> **Full file list**: load `.github/skills/release/SKILL.md` — it is the canonical source for every file that needs updating. Do not duplicate that list here.

## Quick Steps

1. Confirm the current version: `Get-Content package.json | Select-String version`.
2. Load `.github/skills/release/SKILL.md` for the complete file table.
3. For each file in the SKILL table, replace **every** occurrence of the old version with the new one.
4. Add a CHANGELOG entry at the top: `## [X.Y.Z] — YYYY-MM-DD` with a bulleted summary.
5. Run version consistency check — must exit 0:

   ```powershell
   node scripts/check-version-consistency.mjs
   node scripts/check-sw-version.mjs
   npx tsc --noEmit
   npx eslint src tests --max-warnings 0
   ```

## Output

List every file changed and the old → new version string for each.
Paste the new CHANGELOG entry.
