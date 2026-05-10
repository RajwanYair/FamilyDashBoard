---
description: "Scaffold a complete new card for FamilyDashBoard — module, CSS, HTML shell, registry entry, and focused tests."
tools:
  [
    "read_file",
    "grep_search",
    "file_search",
    "get_errors",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "create_file",
    "run_in_terminal",
    "get_terminal_output",
    "vscode_listCodeUsages",
    "vscode_askQuestions",
    "manage_todo_list",
    "memory",
    "tool_search",
    "runSubagent",
    "view_image",
  ]
---

# Add a New Dashboard Card

Use the `add-api` skill as the authoritative step-by-step guide.
This prompt sets up the context and runs the checklist automatically.

## Context

- Card registry: [src/core/card-registry.ts](../../src/core/card-registry.ts)
- Base card: [src/cards/base-card.ts](../../src/cards/base-card.ts)
- Constants (INTERVALS, API, PROXIES): [src/core/constants.ts](../../src/core/constants.ts)
- Existing card example: [src/cards/weather/weather.ts](../../src/cards/weather/weather.ts)
- HTML shells: [src/index.html](../../src/index.html)
- Test example: [tests/unit/cards/weather.test.ts](../../tests/unit/cards/weather.test.ts)
- Shared test helpers: [tests/unit/helpers/index.ts](../../tests/unit/helpers/index.ts)

## Instructions

Read `.github/skills/add-api/SKILL.md` then execute all 7 steps for the new card described below.

**New card spec:** {{CARD_SPEC}}

## Checklist

- [ ] `src/cards/<name>/<name>.ts` — loader, render, cache, sync, diagLog
- [ ] `src/cards/<name>/<name>.css` — card-specific styles (if needed)
- [ ] `registerCard()` call in `src/core/card-registry.ts`
- [ ] `<section data-card-id="<id>">` in `src/index.html`
- [ ] `tests/unit/cards/<name>.test.ts` — 4 paths minimum
- [ ] `INTERVALS.<NAME>` + `API.<NAME>` in `src/core/constants.ts`

## Verification

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run tests/unit/cards/<name>.test.ts --reporter=verbose
npx vitest run
```
