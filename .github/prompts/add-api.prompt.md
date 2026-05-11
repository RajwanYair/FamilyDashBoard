---
description: "Add a new API data source to the dashboard — endpoint, worker route, cache, proxy fallback, sync indicator, tests, and docs."
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
    "tool_search",
    "memory",
    "runSubagent",
  ]
---

# Add a New API Data Source

Load the full skill before proceeding:

```
read_file(".github/skills/add-api/SKILL.md")
```

## Context

- Card registry: [src/core/card-registry.ts](../../src/core/card-registry.ts)
- Fetch helpers: [src/core/api.ts](../../src/core/api.ts) (`fetchWithTimeout`, `PROXIES`)
- Cache helpers: [src/core/cache.ts](../../src/core/cache.ts) (`cGet`, `cSet`, `cGetStale`)
- Sync indicator: [src/ui/sync.ts](../../src/ui/sync.ts) (`setSync`)
- Diagnostics: [src/core/diag.ts](../../src/core/diag.ts) (`diagLog`)
- Worker routes: [worker/src/index.ts](../../worker/src/index.ts)
- API types: [src/types/api.ts](../../src/types/api.ts)
- Data sources doc: [docs/data-sources.md](../../docs/data-sources.md)

## Instructions

Add a new data source for: **{{input:description|Describe the API source, endpoint, card, and data shape}}**

### Checklist

1. Define TypeScript types in `src/types/api.ts` (Valibot schema + domain type)
2. Add worker route in `worker/src/index.ts` with KV caching
3. Add client-side loader in the target card module with:
   - `if (!_pageVisible) return;` guard
   - `cGet`/`cSet`/`cGetStale` dual-layer cache
   - try/catch + proxy fallback (`PROXIES`) + `diagLog()`
   - `setSync(id, state)` indicator
4. Wire loader to card's `setInterval` refresh
5. Add unit tests (loader + worker route + property tests)
6. Update `docs/data-sources.md`
7. Run `npx vitest run` — 0 failures
8. Run `npx eslint src tests --max-warnings 0` — 0 errors
