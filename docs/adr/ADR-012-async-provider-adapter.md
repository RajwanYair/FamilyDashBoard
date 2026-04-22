# ADR-012: Async Provider Adapter Pattern

**Date:** 2026-07-11
**Status:** Accepted
**Deciders:** Project maintainer
**Implements:** ADR-006 (Worker-Normalized Data Model), ADR-010 (IDB-Async Cache)

---

## Context

FamilyDashBoard cards fetch data through `ProviderAdapter<T>` implementations in
`src/cards/<card>/<card>-adapter.ts`. Each adapter's `fetch()` method calls the
upstream API (or worker route) and writes the result to cache.

Prior to Sprint D2.7, adapters used the synchronous `cSet(key, data)` function,
which writes to in-memory and localStorage synchronously, then schedules an
IndexedDB write as a fire-and-forget operation. This meant:

1. The IDB write could fail silently with no way for the adapter to handle the
   error or log it.
2. Tests had no reliable way to `await` the IDB side-effect, causing flaky test
   assertions that depended on IDB state.
3. Adapters that completed their `fetch()` before the IDB write finished could
   return stale cache state on the next hot-path read.

---

## Decision

**All `ProviderAdapter.fetch()` implementations must use `cSetAsync(key, data)`
instead of `cSet(key, data)` when storing fetched data.**

The function signature of `cSetAsync` is:

```ts
async function cSetAsync(key: string, data: unknown): Promise<void>;
```

Adapters must `await cSetAsync(...)` after each successful fetch:

```ts
const data = await fetchJSONWithWorker<T>(url);
await cSetAsync(CACHE_KEY, data); // ✅ correct
// cSet(CACHE_KEY, data);                  // ✗ removed
```

The sync `cSet` remains available for non-adapter call sites (config writes,
counter increments, etc.) where IDB persistence is not required.

---

## Rationale

1. **IDB errors are surfaced** — `await cSetAsync(...)` allows adapters to catch or
   log IDB write failures as part of the normal async error boundary.
2. **Tests are deterministic** — test code can `await` the adapter's `fetch()` and
   know that both the in-memory and IDB writes have completed before asserting.
3. **Consistent with the codebase async contract** — adapter `fetch()` is already
   `async` and uses `await` throughout; awaiting the cache write fits naturally.
4. **Prevents render races** — cards that read from IDB immediately after an
   adapter fetch now see the freshly-written data rather than a prior stale entry.

---

## Consequences

### Positive

- `ProviderAdapter.fetch()` is fully awaitable end-to-end.
- Test mocks become simpler: replace `cSet: vi.fn()` with
  `cSetAsync: vi.fn().mockResolvedValue(undefined)`.
- IDB write failures can be caught in the card's `safeLoad()` wrapper.

### Negative / Trade-offs

- Adapters that previously returned synchronously now have an extra microtask
  delay from the IDB `await`. This is negligible (<1 ms) for TV dashboard
  refresh cycles measured in seconds.
- Callers that do not `await` the adapter's `fetch()` lose the IDB guarantee.
  All known call sites use `await` or `Promise.allSettled`.

### Migration

The migration is complete for all four adapters as of Sprint D2.7:

| Adapter                  | File                                      |
| ------------------------ | ----------------------------------------- |
| Open-Meteo (weather)     | `src/cards/weather/open-meteo-adapter.ts` |
| Alerts (Tzeva Adom)      | `src/cards/alerts/alerts-adapter.ts`      |
| Hebcal (Hebrew calendar) | `src/cards/hebrew-cal/hebcal-adapter.ts`  |
| Google Calendar (ICS)    | `src/cards/calendar/calendar-adapter.ts`  |

Any new `ProviderAdapter` implementation must use `cSetAsync` from the outset.

---

## Test Convention

Adapter tests must mock `cSetAsync` rather than `cSet`:

```ts
vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSetAsync: vi.fn().mockResolvedValue(undefined),
}));
```

The `cSet` mock is no longer needed for adapter tests and may be removed.
