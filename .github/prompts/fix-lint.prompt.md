---
description: "Fix all ESLint and TypeScript errors to reach zero warnings. Use when CI lint or typecheck fails, or after adding new code that introduced type/lint issues."
tools:
  [
    "read_file",
    "grep_search",
    "file_search",
    "get_errors",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "run_in_terminal",
    "get_terminal_output",
    "vscode_listCodeUsages",
    "vscode_renameSymbol",
    "manage_todo_list",
    "tool_search",
    "memory",
  ]
---

# Fix Lint and Type Errors

> **Extension shortcut**: Call `get_errors` on the target file FIRST — it surfaces ESLint + Stylelint diagnostics without terminal. Only fall back to terminal `npx eslint` when you need the full workspace sweep.

## Context

- ESLint config: [eslint.config.mjs](../../eslint.config.mjs)
- TypeScript config: [tsconfig.json](../../tsconfig.json)
- Source: [src/](../../src/)
- Tests: [tests/](../../tests/)

## Instructions

Fix all lint and type errors reported by the commands below.

**Scope:** {{LINT_SCOPE}} _(default: `src tests`)_

## Rules — Never Violate

1. **No `eslint-disable` comments** — fix the root cause instead
2. **No `@ts-ignore` or `@ts-expect-error`** — add proper types or guards
3. **No `any` type widening** — use `unknown` + type guard if the shape is dynamic
4. **No `innerHTML` with unsanitized data** — use `textContent` or `DocumentFragment`
5. **No hardcoded colors** — use `var(--token-name)` CSS custom properties
6. **`cGet()`/`cGetStale()` return `null`** — check `!== null`, never `!== undefined`

## Steps

1. Run lint to see all errors:

   ```powershell
   npx eslint src tests --max-warnings 0
   ```

2. Run typecheck:

   ```powershell
   npx tsc --noEmit 2>&1 | Select-Object -First 40
   ```

3. Fix each error in the source. Common patterns:

   | Error                                | Fix                                               |
   | ------------------------------------ | ------------------------------------------------- |
   | `no-unused-vars`                     | Remove or prefix with `_` if intentionally unused |
   | `@typescript-eslint/no-explicit-any` | Replace with `unknown` + type guard               |
   | `prefer-const`                       | Change `let` → `const`                            |
   | `no-console`                         | Replace `console.log` with `diagLog()`            |
   | Type `X is not assignable to Y`      | Add missing field or narrow with type guard       |
   | `Object is possibly undefined`       | Add null check or non-null assertion with comment |

4. Re-run until clean:

   ```powershell
   npx eslint src tests --max-warnings 0
   npx tsc --noEmit
   ```

## Verification

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run
```

Expected: 0 type errors · 0 lint errors · 0 lint warnings · 0 test failures.
No suppressions (`eslint-disable`, `@ts-ignore`) allowed — zero tolerance.
