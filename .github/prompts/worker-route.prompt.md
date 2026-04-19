---
mode: agent
description: "Add or update a Cloudflare Worker route in worker/src/. Covers route handler, Zod validation, normalized response, KV caching, and worker tests."
---

# Add or Update a Worker Route

## Context

- Worker entry: [worker/src/index.ts](../../worker/src/index.ts)
- Existing route example: look for `router.get("/api/weather"` in worker/src/index.ts
- Worker types: [worker/src/types.ts](../../worker/src/types.ts) (if present)
- Shared normalized types: [src/types/api.ts](../../src/types/api.ts)
- Worker tests: [tests/unit/worker/](../../tests/unit/worker/)
- Worker tsconfig: [worker/tsconfig.json](../../worker/tsconfig.json)

## Instructions

For the route described below, implement the complete handler:

**Route spec:** {{ROUTE_SPEC}}

## Steps

1. **Define Zod schema** for the upstream API response in `worker/src/`.
   - Import `z` from `"zod"` (first and only allowed worker dependency).
   - Keep schemas co-located with the route handler.

2. **Implement the route handler**:

   ```typescript
   router.get("/api/<name>", async (request, env) => {
     // 1. Check KV cache
     // 2. Fetch upstream
     // 3. Validate with Zod schema
     // 4. Normalize to domain type (NormalizedXxx from src/types/api.ts)
     // 5. Store in KV with TTL
     // 6. Return WorkerResponse<NormalizedXxx> envelope
   });
   ```

3. **Return envelope** matching `WorkerResponse<T>` from `src/types/api.ts`:

   ```typescript
   return Response.json({
     data: normalized,
     stale: false,
     timestamp: Date.now(),
     provider: "<upstream-name>",
   } satisfies WorkerResponse<NormalizedXxx>);
   ```

4. **Add worker test** in `tests/unit/worker/`:
   - Mock `fetch` for the upstream response
   - Assert normalized shape matches expected fields
   - Assert stale fallback on upstream error

5. **Wire client card** to use `fetchJSONWithWorker<NormalizedXxx>("/api/<name>")`.
   - Validate response with `isNormalizedXxx()` type guard from `src/types/api.ts`.

## Verification

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run tests/unit/worker/ --reporter=verbose
npx vitest run
```

Expected: 0 type errors · 0 lint errors · 0 test failures.
Worker route must return a `WorkerResponse<T>` envelope — never raw upstream JSON.
