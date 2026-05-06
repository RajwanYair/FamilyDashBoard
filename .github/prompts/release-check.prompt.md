---
mode: "agent"
description: "Run the full FamilyDashBoard pre-release checklist before tagging a version. All gates must be green before creating a git tag."
tools: ["read_file", "grep_search", "run_in_terminal", "get_terminal_output", "get_errors", "file_search", "manage_todo_list", "memory", "tool_search", "vscode_listCodeUsages", "view_image"]
---

# Release Check — FamilyDashBoard

Run this checklist in order before tagging any release. All items must be ✅ green. Zero tolerance on any failure.

## 1. Version Consistency

Run the automated check first:

```powershell
node scripts/check-version-consistency.mjs
```

Expected: **All 7 files match package.json vX.Y.Z**

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

## 2. Type Check

```sh
npx tsc --noEmit
```

Expected: **0 errors**

## 2a. Worker Type Check (V13-OPS)

```sh
cd worker && npx tsc --noEmit && cd ..
```

Expected: **0 errors** in `worker/src/`

## 3. Lint

```sh
npx eslint src tests --max-warnings 0
```

Expected: **0 errors · 0 warnings · 0 suppressions**

No `@ts-ignore`, `eslint-disable`, or `// @ts-expect-error` in committed source.

## 4. Markdown Lint

```sh
npx markdownlint-cli2 "**/*.md" "#**/node_modules/**"
```

Expected: **0 errors**

## 5. Tests

```sh
npx vitest run
```

Expected: **0 failures**

## 6. Build

```sh
npm run build
```

Expected: **0 errors · dist/ generated**

## 7. Bundle Size

```sh
npm run check:bundle
```

Expected: **below threshold** (exits 0)

## 8. SW Version

```sh
npm run check:sw
```

Expected: **version in sw.js matches package.json**

## 9. OWASP Script

```powershell
node scripts/check-owasp.mjs
```

Expected: **0 findings** (Exit 0)

## 10. A11Y Audit (V13-A11Y)

Verify no regressions in accessibility contract:

```sh
npx vitest run tests/unit/html/dom-contract.test.ts
```

Expected: **all 112+ tests pass** — confirms every dialog has `aria-labelledby`, all
icon-only buttons have `aria-label`, all cards have `role=region`.

## 11. Open Issues

All GitHub issues assigned to the milestone must be **closed** with a commit hash in the closing comment before tagging.

## 12. Tag & Release

Only after all 12 gates are green:

```sh
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes
```

## Output

Report each gate as ✅ PASS or ❌ FAIL with the command output summary.
Do NOT proceed to the tag step if any gate fails.

---

## v13 Gate Summary (added V13-OPS)

| New gate                           | Command                                               | Threshold              |
| ---------------------------------- | ----------------------------------------------------- | ---------------------- |
| Worker typecheck                   | `cd worker && npx tsc --noEmit`                       | 0 errors               |
| sw.ts version                      | `npm run check:sw`                                    | matches `package.json` |
| A11Y contract                      | `npx vitest run tests/unit/html/dom-contract.test.ts` | 0 failures             |
| AI routes (when `AI_ENABLED=true`) | `npx vitest run tests/unit/worker/ai.test.ts`         | 0 failures             |
