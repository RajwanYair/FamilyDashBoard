---
mode: "agent"
description: "Debug a broken card's fetch, cache, render, or sync pipeline. Follow the diagnosis checklist and fix the root cause."
---

# Debug Card — FamilyDashBoard

Diagnose and fix a broken card. Follow this checklist in order — most card failures are caused by one of these issues.

## 1. DOM Contract

- Does `id="X-body"` exist in `src/index.html`? (rule 14: dead elements = dead code)
- Is `data-card-id` on the card element matching the registry ID exactly?
- Run `npx vitest run tests/unit/html/dom-contract.test.ts` — zero failures required.

## 2. Card Registry

- Is the card registered in `src/core/card-registry.ts` via `registerCard()`?
- Does `getCard(id)` return the expected `CardDefinition`?

## 3. Fetch Pipeline

- Is the loader guarded with `if (!_pageVisible) return;` at the top?
- Does the fetch use `try/catch` + proxy fallback + `diagLog()`?
- Is `setSync(id, "loading")` called before fetch, and `setSync(id, "ok")` / `setSync(id, "error")` after?
- Worker-first: is `isWorkerEnabled()` checked before calling `fetchJSONWithWorker<T>()`?

## 4. Cache Layer

- Is `cGet(key, ttl)` checked before triggering a fetch?
- Is `cSet(key, data)` called after a successful fetch?
- Does `cGetStale(key)` render stale data while fresh fetch runs?
- Cache miss: does the function handle `null` (not `undefined`) returns from `cGet` / `cGetStale`?

## 5. Render Function

- Does the render function use `textContent` for user data (no `innerHTML` with untrusted content)?
- Does it bail early on empty/null data with a graceful empty-state render?
- Are DOM refs cached in an `el` object rather than re-queried each render?

## 6. Type Validation

- Is the API response validated with a type guard (`isXyzResponse(data)`) before rendering?
- Does invalid data trigger `diagLog` and a graceful fallback?

## Output

State the root cause (which layer failed).
Show the minimal diff that fixes it.
Confirm `npx vitest run` passes with 0 failures after the fix.
