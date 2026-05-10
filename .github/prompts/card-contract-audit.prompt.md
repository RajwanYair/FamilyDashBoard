---
description: "Audit all 12 cards for a specific contract requirement (configSchema, FdbCard, destroy lifecycle, etc.) and produce a gap report with fixes."
tools:
  [
    "grep_search",
    "read_file",
    "file_search",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "semantic_search",
    "run_in_terminal",
    "get_terminal_output",
    "get_errors",
    "vscode_listCodeUsages",
    "vscode_renameSymbol",
    "manage_todo_list",
    "tool_search",
    "memory",
    "runSubagent",
  ]
---

# Card Contract Audit — FamilyDashBoard

Audit all 12 registered cards for a specific interface contract and fix any gaps.

## Cards to Audit

| Card ID       | File                                   |
| ------------- | -------------------------------------- |
| `weather`     | `src/cards/weather/weather.ts`         |
| `news`        | `src/cards/news/news.ts`               |
| `stocks`      | `src/cards/stocks/stocks.ts`           |
| `currency`    | `src/cards/currency/currency.ts`       |
| `hebrew-cal`  | `src/cards/hebrew-cal/hebrew-cal.ts`   |
| `calendar`    | `src/cards/calendar/calendar.ts`       |
| `motivation`  | `src/cards/motivation/motivation.ts`   |
| `alerts`      | `src/cards/alerts/alerts.ts`           |
| `countdown`   | `src/cards/countdown/countdown.ts`     |
| `system-info` | `src/cards/system-info/system-info.ts` |
| `tasks`       | `src/cards/tasks/tasks.ts`             |
| `video-news`  | `src/cards/video-news/video-news.ts`   |

## Supported Contracts

### A) `configSchema`

Every `CardDefinition` must have `configSchema: CardConfigField[]`.
Check: `grep -r "configSchema" src/cards/`

### B) `destroy()` lifecycle

Every card that sets intervals or event listeners must export `destroy()`.
Check: search for `setInterval` / `addEventListener` without corresponding `clearInterval` / `removeEventListener`.

### C) `data-card-id` matching registry ID

Every `<section data-card-id="X">` must use the canonical ID from `card-registry.ts`.
Forbidden aliases: `hcal`, `cal`, `moti`, `wx`, `curr`.

### D) `createAsyncCardLoader` (Stream D2)

Cards with network fetches should use `createAsyncCardLoader` (not `createCardLoader`).
Check: `grep -r "createCardLoader" src/cards/`

## Steps

1. For each contract, grep for violations across all 11 card files.
2. Produce a table: Card | Contract | Status (✅ / ❌) | Notes.
3. For each ❌, apply the minimum fix.
4. After fixes: `npx tsc --noEmit && npx eslint src tests --max-warnings 0`.

## Output

Full audit table + diff summary of any fixes applied.
