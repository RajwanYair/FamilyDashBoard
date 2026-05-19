---
description: "Run the full FamilyDashBoard pre-release checklist before tagging a version. All gates must be green before creating a git tag."
tools:
  [
    "read_file",
    "grep_search",
    "run_in_terminal",
    "get_terminal_output",
    "get_errors",
    "file_search",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "manage_todo_list",
    "memory",
    "tool_search",
    "vscode_listCodeUsages",
    "view_image",
    "runSubagent",
  ]
---

# Release Check — FamilyDashBoard

Run this checklist in order before tagging any release. All items must be ✅ green. Zero tolerance on any failure.

## 1. Version Consistency

Run the automated check first:

```powershell
node scripts/check-version-consistency.mjs
```

Expected: version anchors match `package.json` in every documented release file.

Then confirm `vX.Y.Z` appears consistently in ALL 16 documented files:

- `package.json` → `"version"`
- `sw.js` → version comment / `CACHE_NAME` constant
- `CHANGELOG.md` → top entry heading
- `README.md` → badge / version reference
- `.github/copilot-instructions.md` → heading
- `.github/instructions/workspace.instructions.md` → heading
- `.github/AGENTS.md` → header Version line
- `docs/ARCHITECTURE.md` → version reference
- `docs/security.md` → title and updated-date line
- `.github/assets/banner.svg`, `architecture.svg`, `preview.svg`, `data-sources.svg`, `roadmap.svg` → version text

> Full file list in `.github/skills/release/SKILL.md`.

## 2. Canonical Quality Gate

```powershell
npm run check
```

Expected: **0 failures** across typecheck, lint, markdown, tests, dead-export gate, OWASP, Trusted Types, build-artifact hygiene, and all other repository checks.

## 3. CI-Parity Supply-Chain Checks

```powershell
npm run check:actions-pinned
npm run check:ignore-scripts
npm run check:sigstore
npm run check:reproducible
```

Expected: **0 failures**.

## 4. Build and Package Gates

```powershell
npm run build
npm run check:bundle
npm run check:card-bundle
```

Expected: clean build and passing bundle budgets.

## 5. Release Notes and Version Audit

```powershell
node scripts/check-version-consistency.mjs
node scripts/check-release-notes.mjs
```

Expected: **0 failures**.

## 6. Open Issues

All GitHub issues assigned to the milestone must be **closed** with a commit hash in the closing comment before tagging.

## 7. Tag & Release

Only after all 12 gates are green:

```powershell
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes
```

## Output

Report each gate as ✅ PASS or ❌ FAIL with the command output summary.
Do NOT proceed to the tag step if any gate fails.
