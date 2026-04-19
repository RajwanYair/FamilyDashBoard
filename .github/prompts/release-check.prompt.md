---
mode: "agent"
description: "Run the full FamilyDashBoard pre-release checklist before tagging a version. All gates must be green before creating a git tag."
---

# Release Check — FamilyDashBoard

Run this checklist in order before tagging any release. All items must be ✅ green. Zero tolerance on any failure.

## 1. Version Consistency

Confirm `7.X.Y` appears consistently in ALL of:

- `package.json` → `"version"`
- `sw.js` → version comment / `CACHE_NAME` constant
- `CHANGELOG.md` → top entry heading
- `README.md` → badge / version reference
- `CLAUDE.md` → version reference
- `.github/copilot-instructions.md` → heading
- `.github/instructions/workspace.instructions.md` → heading
- `ARCHITECTURE.md` → version reference

## 2. Type Check

```sh
npx tsc --noEmit
```

Expected: **0 errors**

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

## 9. Open Issues

All GitHub issues assigned to the milestone must be **closed** with a commit hash in the closing comment before tagging.

## 10. Tag & Release

Only after all 9 gates are green:

```sh
git tag v7.X.Y
git push origin v7.X.Y
gh release create v7.X.Y --generate-notes
```

## Output

Report each gate as ✅ PASS or ❌ FAIL with the command output summary.
Do NOT proceed to the tag step if any gate fails.
