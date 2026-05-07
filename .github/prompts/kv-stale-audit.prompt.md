---
description: "Audit or debug Cloudflare KV stale-fallback for a worker route (stocks, crypto, alerts, or a new route)."
tools: ["read_file", "grep_search", "file_search", "replace_string_in_file", "multi_replace_string_in_file", "run_in_terminal", "get_terminal_output", "get_errors", "manage_todo_list", "tool_search", "fetch_webpage", "memory", "vscode_listCodeUsages", "runSubagent"]
---

# KV Stale-Fallback Audit — FamilyDashBoard Worker

Diagnose or implement KV stale-fallback for a Cloudflare Worker route.
Reference: [ADR-013](../docs/adr/ADR-013-kv-stale-cache.md) · [ADR-015](../docs/adr/ADR-015-env-type-isolation.md)

## 1. Identify the Route

Which route is missing or has a broken KV fallback?

- `/api/stocks?sym=X` — implemented in `worker/src/routes/feeds.ts:handleStocks`
- `/api/crypto?ids=bitcoin` — `feeds.ts:handleCrypto`
- `/api/alerts` — `feeds.ts:handleAlerts`
- `/api/weather` — `routes/data.ts:handleWeather`
- `/api/currency` — `routes/data.ts:handleCurrency`

## 2. Check Env Binding

```sh
cd worker && npx tsc --noEmit
```

- `Env` must be imported from `worker/src/types.ts` — **not** from `index.ts`
- Confirm `CACHE_KV: KVNamespace` is in the `Env` interface

## 3. Verify KV Helpers Usage

Check `worker/src/utils/kv.ts`:

```typescript
// Read stale value
const stale = await kvGetStale<MyType>(env.CACHE_KV, "route:key");
if (stale) return workerEnvelope(stale, "source-kv-stale", true, 60);

// Write fresh value (non-fatal)
void kvPut(env.CACHE_KV, "route:key", freshData, 86400); // 24 h
```

- `kvGetStale` returns `null` on miss or JSON parse failure — never `undefined`
- `kvPut` wraps `kv.put` in try/catch; failures are logged, not thrown

## 4. Check Provider Name Convention

The stale provider name must follow `"<upstream>-kv-stale"`:

| Route    | Fresh provider | Stale provider          |
| -------- | -------------- | ----------------------- |
| stocks   | `"yahoo"`      | `"yahoo-kv-stale"`      |
| crypto   | `"coingecko"`  | `"coingecko-kv-stale"`  |
| alerts   | `"tzevaadom"`  | `"tzevaadom-kv-stale"`  |
| weather  | `"open-meteo"` | `"open-meteo-kv-stale"` |
| currency | `"er-api"`     | `"er-api-kv-stale"`     |

## 5. Verify Router Passes `env`

In `worker/src/index.ts`, the router must pass `env` to the handler:

```typescript
case "/api/stocks":
  return handleStocks(url, env); // ← env required
```

## 6. Check TTL Values

| Data type                  | TTL    | Reason                                 |
| -------------------------- | ------ | -------------------------------------- |
| Financial (stocks, crypto) | 24 h   | Data changes infrequently              |
| Time-sensitive (alerts)    | 1 h    | Stale alerts are potentially dangerous |
| Calendar / prayer times    | 6 h    | Changes daily at most                  |
| Weather                    | 30 min | Forecasts shift more often             |

## 7. Run Tests

```sh
npx vitest run tests/unit/worker/
```

Expected: all KV stale tests pass. The test pattern to look for:

```typescript
it("returns stale KV envelope when upstream fails and KV has data", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 502 }));
  const kvGet = vi.fn().mockResolvedValue(JSON.stringify(staleData));
  const envWithKv: Env = {
    ...mockEnv,
    CACHE_KV: { ...mockEnv.CACHE_KV, get: kvGet } as unknown as KVNamespace,
  };
  const res = await handleRoute(url, envWithKv);
  expect(res.status).toBe(200);
  const body = (await res.json()) as { provider: string; stale: boolean };
  expect(body.provider).toBe("source-kv-stale");
  expect(body.stale).toBe(true);
});
```

## 8. Check wrangler.toml

```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "<production-kv-id>"
preview_id = "<preview-kv-id>"
```

If the binding is missing or uses a placeholder ID, the worker will throw at runtime.
