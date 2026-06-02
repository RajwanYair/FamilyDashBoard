---
description: "Optimize workspace: reduce file watchers, clean caches, validate configs, enforce conventions."
mode: "agent"
---

# Optimize Workspace

Run the workspace optimization skill to ensure the development environment is lean, fast, and correctly configured.

## Checks

1. **File Watchers** — Verify `files.watcherExclude` covers `node_modules/`, `dist/`, `coverage/`, `test-results/`
2. **Search Exclusions** — Confirm `search.exclude` skips generated directories
3. **Explorer Nesting** — Validate `explorer.fileNesting.patterns` groups config files correctly
4. **Extension Conflicts** — Check for conflicting or redundant extensions
5. **Task Consistency** — Verify all task commands match `package.json` scripts
6. **Launch Config** — Confirm all debug configs reference existing entry points
7. **MCP Servers** — Validate all MCP server URLs are reachable
8. **Generated Files** — Remove any stray `.tmp`, `.bak`, `.log`, `*_output.txt` from workspace
9. **$TEMP Enforcement** — Confirm coverage/reports/logs go to `$env:TEMP/FamilyDashBoard/`

## Output

Produce a pass/fail table and auto-fix any issues found.
