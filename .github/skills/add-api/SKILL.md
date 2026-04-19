---
name: add-api
description: "Add a new API data source to the FamilyDashBoard. Use when: integrating a new external data provider, adding a new dashboard card/widget with live data, wiring a new fetch with caching, proxy fallback, sync indicator, diagnostic logging, and refresh interval. Produces a complete, production-ready integration."
argument-hint: "Describe the new data source: name, URL, what it returns, desired refresh interval"
---

# Add API — FamilyDashBoard

> Coding rules (cache, fetch, proxy, security) are in `copilot-instructions.md` and `dashboard.instructions.md`. This skill covers the step-by-step integration checklist.

## Step 1 — Plan

| Decision | Value |
|----------|-------|
| Card ID | kebab-case slug used in `data-card-id`, registry, sync dots |
| Cache key | Short unique string passed to `cGet`/`cSet` (e.g. `"weather"`, `"parasha"`) |
| Cache TTL | Use existing `INTERVALS.*` constant from `src/core/constants.ts`, or add a new one |
| Fetch method | `fetchJSONWithWorker<T>()` (preferred) or `fetchWithTimeout()` for non-JSON |
| Refresh interval | Match to TTL — pass to `scheduleCard()` |

## Step 2 — Create Card Module

Create `src/cards/<name>/<name>.ts` (and optional `<name>.css`):

```typescript
import { scheduleCard } from "../base-card";
import { INTERVALS } from "../../core/constants";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { fetchJSONWithWorker } from "../../core/fetch";
import { setSync, syncBurst, recordSuccess, recordFailure } from "../../core/sync";
import { diagLog } from "../../core/diag";
import { isPageVisible } from "../../core/idle";
import type { CardDefinition } from "../../types/card";

async function load<Name>(): Promise<void> {
  if (!isPageVisible()) return;
  const key = "<cache-key>";
  const fresh = cGet<ResponseType>(key, INTERVALS.<NAME>);
  if (fresh) { render(fresh); return; }
  const stale = cGetStale<ResponseType>(key);
  if (stale) render(stale);

  setSync("<id>", "syncing");
  try {
    const data = await fetchJSONWithWorker<ResponseType>("<url>");
    cSet(key, data);
    render(data);
    setSync("<id>", "success");
    recordSuccess("<id>");
    syncBurst("<id>");
    diagLog("[<name>] OK");
  } catch (e) {
    setSync("<id>", stale ? "stale" : "error");
    recordFailure("<id>");
    diagLog(`[<name>] ERR: ${(e as Error).message}`);
  }
}

function render(data: ResponseType): void {
  // Use textContent (not innerHTML) for user data
  // Use DocumentFragment for lists
}

export function init<Name>Card(): void {
  void load<Name>();
  scheduleCard(load<Name>, INTERVALS.<NAME>);
}

export const <name>Card: CardDefinition = {
  id: "<id>",
  init: init<Name>Card,
};
```

## Step 3 — Register Card

In `src/core/card-registry.ts`, add to the registry:

```typescript
registerCard({
  id: "<id>",
  loader: () => import("../cards/<name>/<name>"),
});
```

## Step 4 — HTML Markup

Add inside `src/index.html` in the appropriate column:

```html
<section class="card" data-card-id="<id>" aria-label="<Name>">
  <div class="card-header">
    <span class="card-title"><icon> <Hebrew Name></span>
    <span class="sync-dot" id="sync-<id>"></span>
  </div>
  <div class="card-body" id="<id>-body">
    <div class="loading-placeholder">טוען...</div>
  </div>
</section>
```

## Step 5 — Tests

Create `tests/unit/cards/<name>.test.ts` (see `update-tests` skill for full patterns):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));
vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createCardLoader: vi.fn(),
}));
vi.mock("@/core/fetch", () => ({
  fetchJSONWithWorker: vi.fn().mockResolvedValue({}),
  acquireLock: vi.fn().mockReturnValue(false),
  releaseLock: vi.fn(),
}));

describe("<Name> Card", () => {
  // ... test init, render, cache hit, fetch error paths
});
```

## Step 6 — Constants

Add to `src/core/constants.ts`:

- API URL in `API` object (if new endpoint)
- Refresh interval in `INTERVALS` object
- Any new localStorage keys as `LS_*` constants

## Verification

```bash
npx tsc --noEmit          # type-check
npx eslint src tests --max-warnings 0  # lint
npx vitest run            # tests
```
