---
name: add-api
description: "Add a new API data source to the FamilyDashBoard. Use when: integrating a new external data provider, adding a new dashboard card/widget with live data, wiring a new fetch with caching, proxy fallback, sync indicator, diagnostic logging, and refresh interval. Produces a complete, production-ready integration."
argument-hint: "Describe the new data source: name, URL, what it returns, desired refresh interval"
---

# Add API — FamilyDashBoard

> Coding rules (cache, fetch, proxy, security) are in `copilot-instructions.md` and `dashboard.instructions.md`. This skill covers the step-by-step integration checklist.

Use this skill when the task is not just "make a fetch work", but "ship a complete, maintainable data flow".

## Step 1 — Plan

| Decision | Value |
|----------|-------|
| Card ID | kebab-case slug used in `data-card-id`, registry, sync dots |
| Cache key | Short unique string passed to `cGet`/`cSet` (e.g. `"weather"`, `"parasha"`) |
| Cache TTL | Use existing `INTERVALS.*` constant from `src/core/constants.ts`, or add a new one |
| Fetch method | `fetchJSONWithWorker<T>()` or the current worker-backed helper when available; `fetchWithTimeout()` only when a worker route does not fit |
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

If the payload needs normalization, create or extend an adapter rather than mixing parsing, rendering, and transport logic in one function.

## Step 3 — Register Card

In `src/core/card-registry.ts`, add to the registry:

```typescript
registerCard({
  id: "<id>",
  loader: () => import("../cards/<name>/<name>"),
});
```

If the card exposes configuration, also update the relevant config types, defaults, and any form bindings.

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

If the card needs a card-specific stylesheet, co-locate `src/cards/<name>/<name>.css` and import it from the module.

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

Minimum test coverage for a new integration:

- Fresh cache hit path
- Stale cache render path
- Successful fetch path
- Error or non-OK path
- Sync indicator behavior for success and failure
- Any adapter or normalization edge case that could silently regress

## Step 6 — Constants

Add to `src/core/constants.ts`:

- API URL in `API` object (if new endpoint)
- Refresh interval in `INTERVALS` object
- Any new localStorage keys as `LS_*` constants

## Step 7 — Verification

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run tests/unit/cards/<name>.test.ts --reporter=verbose
```

Run the full test suite only after the targeted card tests pass:

```powershell
npx vitest run
```

Expected: 0 type errors · 0 lint errors/warnings · 0 test failures.
New card must have at minimum: fresh-cache path · stale-cache path · fetch-success path · fetch-error path.

## Definition Of Done

- Registry wiring is correct
- DOM IDs exist in `src/index.html`
- Cache, sync, and diagnostics paths are implemented
- Fetch path uses the existing platform conventions
- Focused tests cover the happy path and failure path
- The card renders without introducing hardcoded colors or invalid IDs

## Verification

Run these commands in order. All must exit 0.

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run tests/unit/cards/<name>.test.ts --reporter=verbose
npx vitest run
```

Checklist before closing the task:

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint src tests --max-warnings 0` — 0 errors, 0 warnings
- [ ] Targeted card tests pass with verbose output confirming all describe/it blocks
- [ ] Full suite passes — test count increased (not decreased) vs. baseline
- [ ] `data-card-id` attribute matches the registry ID exactly
- [ ] No hardcoded colors in the new `.css` file (use `var(--accent)` etc.)
- [ ] No `innerHTML` with unsanitized data in the new card module
- [ ] New card appears in `listCards()` return value
