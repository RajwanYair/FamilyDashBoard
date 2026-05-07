---
description: "Perform a thorough code review of the FamilyDashBoard TypeScript source. Check security (XSS, unsanitized innerHTML, eval), UI quality (RTL, responsiveness, TV font sizes), API reliability (caching, proxy fallback, error handling), and performance (DOM updates, lazy loading)."
tools: ["read_file", "grep_search", "file_search", "semantic_search", "get_errors", "replace_string_in_file", "multi_replace_string_in_file", "run_in_terminal", "get_terminal_output", "vscode_listCodeUsages", "manage_todo_list", "tool_search", "memory", "runSubagent", "view_image"]
---

# Code Review — FamilyDashBoard

Review the TypeScript source files in `src/` for the following:

## Security

- [ ] No `eval()` or `Function()` usage
- [ ] No `innerHTML` with unsanitized external API data — use `textContent` or `DocumentFragment`
- [ ] No hardcoded API keys or secrets
- [ ] All external links use HTTPS
- [ ] Content Security Policy (`default-src 'self'`) not weakened

## TypeScript Quality

- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] `npx eslint src tests --max-warnings 0` passes (0 warnings)
- [ ] No `@ts-ignore` or `eslint-disable` suppressions
- [ ] Type imports use `import type` for type-only imports

## UI Quality

- [ ] RTL layout intact (`dir="rtl"`)
- [ ] CSS custom properties used — no hardcoded colors
- [ ] 6 themes covered: black · blue · matrix · amber · purple · rose
- [ ] Font sizes readable on TV from 3m distance
- [ ] New CSS rules in correct `@layer` (tokens → themes → base → layout → components → animations)
- [ ] No duplicate CSS selectors

## API Reliability & Performance

> Use `runSubagent` with `@api-integrator` for deep data flow, cache, proxy fallback, and sync state review.
> Use `runSubagent` with `@dashboard-designer` for a11y, performance, and TV-readability review.
> Use `get_errors` (webhint extension) for browser-compat diagnostics without terminal commands.

Quick gates:

- [ ] `if (!_pageVisible) return;` guard at top of all async loaders
- [ ] `cGet`/`cSet`/`cGetStale` used (not raw `localStorage`)
- [ ] `setSync(id, state)` called on every exit path
- [ ] `DocumentFragment` for batch DOM writes

## Tests

- [ ] `npx vitest run` passes (0 failures)
- [ ] New code has corresponding test in `tests/unit/`

Report: Critical issues first, then warnings, then suggestions.
