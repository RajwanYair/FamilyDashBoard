# Skill: workspace-optimize

> Audit and optimize the FamilyDashBoard workspace for production readiness, clean generated files, enforce $TEMP for intermediates, and validate VS Code integration quality.

## When To Use

- Before a release to ensure the workspace is clean
- After adding new tooling or extensions
- When generated files are accumulating in the workspace
- To verify that all intermediate outputs go to `$TEMP`
- To audit VS Code settings, tasks, and launch configs for consistency

## Prerequisites

- PowerShell terminal
- Node.js installed (via parent `MyScripts/node_modules/`)

## Steps

### 1. Audit Generated Files

Check that no intermediate/generated files exist in the workspace root:

```powershell
# Files that should NOT exist in the workspace
$forbidden = @(
    "vitest-*.txt", "vitest-*.json", "test-results.json",
    "coverage-out*.txt", "tsc_output.txt", "output.txt",
    "*.log", "*.bak", "*.tmp", "stats.html", "bundle-stats.json"
)
foreach ($pattern in $forbidden) {
    $found = Get-ChildItem -Path . -Filter $pattern -ErrorAction SilentlyContinue
    if ($found) { Write-Warning "GENERATED FILE IN WORKSPACE: $($found.FullName)" }
}
```

### 2. Enforce $TEMP for Intermediate Output

All test/coverage/report output MUST go to `$env:TEMP/FamilyDashBoard/`:

| Output Type      | Correct Location                                |
| ---------------- | ----------------------------------------------- |
| Coverage HTML    | `$env:TEMP/FamilyDashBoard/coverage/`           |
| Test reports     | `$env:TEMP/FamilyDashBoard/reports/`            |
| Bundle analysis  | `$env:TEMP/FamilyDashBoard/bundle-stats/`       |
| Mutation reports | `$env:TEMP/FamilyDashBoard/mutation/`           |
| Debug logs       | `$env:TEMP/FamilyDashBoard/logs/`               |
| Build artifacts  | `dist/` (gitignored)                            |

### 3. Validate VS Code Integration

Check that all workspace configurations are consistent:

- `.vscode/settings.json` — no deprecated keys, all extensions referenced exist
- `.vscode/tasks.json` — all npm scripts referenced exist in `package.json`
- `.vscode/launch.json` — all launch configs reference valid entry points
- `.vscode/extensions.json` — all recommended extensions are current
- `.vscode/mcp.json` — all MCP servers are reachable

### 4. Clean Workspace

```powershell
# Remove all generated files from workspace
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue `
    dist, coverage, test-results, playwright-report, `
    blob-report, .playwright, .eslintcache, tsconfig.tsbuildinfo

# Remove stray intermediate files
Get-ChildItem -Filter "*.tmp" -Recurse | Remove-Item -Force
Get-ChildItem -Filter "*.bak" -Recurse | Remove-Item -Force
Get-ChildItem -Filter "*.log" -Recurse | Remove-Item -Force
```

### 5. Verify Production Readiness

Run the full production gate:

```powershell
npm run check
npm run test:e2e
npm run check:bundle
```

All must exit 0 with zero warnings.

## Output

Return a structured report:

```markdown
## Workspace Optimization Report

| Check                      | Status | Details |
| -------------------------- | ------ | ------- |
| Generated files in root    | ✅/❌   |         |
| $TEMP enforcement          | ✅/❌   |         |
| VS Code settings valid     | ✅/❌   |         |
| Tasks reference valid cmds | ✅/❌   |         |
| Extensions up to date      | ✅/❌   |         |
| MCP servers configured     | ✅/❌   |         |
| Production gate passes     | ✅/❌   |         |
```
