---
description: "Debug a broken Cloudflare Worker route: fetch failures, Zod validation errors, KV read/write, envelope shape mismatches."
tools: ["read_file", "grep_search", "replace_string_in_file", "multi_replace_string_in_file", "run_in_terminal", "get_terminal_output", "get_errors", "file_search", "vscode_listCodeUsages", "manage_todo_list", "tool_search", "fetch_webpage", "memory", "runSubagent"]
---

# Worker Route Debug — FamilyDashBoard

Diagnose and fix a failing Cloudflare Worker route. Follow this checklist in order.

## 1. Identify the Failing Route

- What path is failing? (e.g. `/api/weather`, `/api/currency`)
- What error are clients seeing? (check `diagLog()` in browser devtools)
- Is the Worker deployed? Run `npx wrangler tail` to see live logs.

## 2. Type Check Worker

```sh
cd worker && npx tsc --noEmit
```

Expected: **0 errors**

## 3. Zod Schema Mismatch

- Upstream API may have changed shape.
- Check `worker/src/utils/schemas.ts` for the relevant schema.
- Add a `.passthrough()` temporarily, log the raw response, then tighten the schema.
- Run `npx vitest run tests/unit/worker/` to verify schema tests pass.

## 4. KV Stale Fallback

- Is `CACHE_KV` bound in `wrangler.toml`?
- Is the KV namespace ID correct? (Not a placeholder.)
- `kvGetStale` returns `null` on miss — check callers handle `null`.
- `kvPut` failures are non-fatal (wrapped in try/catch) — confirm they don't surface.

## 5. WorkerEnvelope Shape

Check `workerEnvelope()` in `worker/src/utils/response.ts`:

```ts
{ data: T, stale: boolean, timestamp: number, provider: string }
```

Client-side `fetchJSONWithWorker<T>()` in `src/core/fetch.ts` must unwrap `.data`.

## 6. CORS / Rate Limit

- Is the request hitting the rate limit? Check `X-RateLimit-Remaining` header.
- Is the client origin in the CORS allowlist? Check `CORS_HEADERS` in `response.ts`.

## 7. Local Test

```sh
cd worker && npx wrangler dev --local
curl "http://localhost:8787/api/weather?lat=31.7683&lon=35.2137"
```

Expected: JSON envelope with `data`, `stale: false`, `timestamp`, `provider` fields.

## Output

State the root cause and the exact fix applied.
Show before/after for any changed schema or handler code.
