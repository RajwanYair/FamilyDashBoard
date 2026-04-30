# ADR-052 — Shadow-Vectorize 30-Day Client-Side Observation Plan

| Field      | Value                                                                             |
| ---------- | --------------------------------------------------------------------------------- |
| Date       | 2026-05-28                                                                        |
| Status     | Accepted (Active)                                                                 |
| Sprint     | 267 (implementation) / 270 (ADR formalised)                                      |
| Supersedes | n/a                                                                               |
| Related    | ADR-046 (Vectorize shadow run), Roadmap item N1, `src/cards/news/news.ts`         |

## Context

ADR-046 accepted running Cloudflare Vectorize in shadow mode **on the worker**
alongside SimHash v2 to validate near-duplicate detection quality before
retiring SimHash. Sprint 267 added the **client-side companion**: lightweight
plumbing that enables the developer to toggle shadow mode via a `localStorage`
flag and logs comparison statistics to `diagLog` during normal dashboard usage.

The client-side component does **not** replace SimHash. It is a zero-cost
observability layer that fires only when the `fdb_shadow_vectorize` key is
set to `"1"` in `localStorage`. Under normal operation (key absent) all code
paths are no-ops.

## Decision

Implement three exported functions in `src/cards/news/news.ts`:

| Symbol                             | Purpose                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `isShadowVectorizeEnabled()`        | Returns `true` when shadow mode is active (module-level boolean, synced to localStorage). |
| `setShadowVectorize(enabled)`       | Toggles shadow mode; persists flag to `localStorage`.                                     |
| `loadShadowVectorizeFlag()`         | Reads `localStorage` at card init time to restore the flag after a page reload.           |
| `recordShadowVectorizeComparison()` | Appends a `VectorizeShadowEntry` to an in-memory ring buffer (cap 50).                    |
| `getShadowVectorizeLog()`           | Returns a read-only copy of the ring buffer for developer inspection.                     |

### Comparison entry schema

```typescript
interface VectorizeShadowEntry {
  ts: number;           // Unix ms timestamp of the fetch
  simhashDeduped: number;    // Items remaining after SimHash dedup
  vectorizeCandidates: number; // Items Vectorize flagged as near-dup
  overlap: number;      // min(simhashDeduped, vectorizeCandidates) — shared signal
}
```

The ring buffer is capped at 50 entries to prevent unbounded memory growth during
long-running dashboard sessions.

## Activation Protocol

1. Developer opens browser DevTools console on the dashboard.
2. Runs `localStorage.setItem("fdb_shadow_vectorize", "1")` and reloads.
3. Each news fetch that triggers `recordShadowVectorizeComparison()` appends
   to the log visible via `getShadowVectorizeLog()` in the console.
4. After 30 days of data collection, compare `simhashDeduped` vs
   `vectorizeCandidates` distributions to decide whether to retire SimHash.
5. Remove the flag: `localStorage.removeItem("fdb_shadow_vectorize")`.

## Rationale

| Option                                  | Verdict  | Reason                                                              |
| --------------------------------------- | -------- | ------------------------------------------------------------------- |
| No client instrumentation               | Rejected | Worker-only data misses client-perceived duplicate rate             |
| Always-on logging                       | Rejected | Noisy for all users; leaks debug data into production logs          |
| Feature-flag via `localStorage` (chosen)| Accepted | Zero overhead by default; easy to enable/disable per browser        |
| Remote config flag                      | Rejected | Requires network call; adds complexity; violates static PWA rule    |

## Consequences

- **Positive**: Developers can collect real-world near-duplicate comparison
  data without shipping a permanent instrumentation layer.
- **Positive**: The ring buffer and flag are reset by `_resetNewsForTest()`
  ensuring hermetic unit tests.
- **Negative**: Data collected is per-browser-session only; no persistence
  across reloads unless the developer manually exports `getShadowVectorizeLog()`.
- **Neutral**: The `loadShadowVectorizeFlag()` call must be added to the
  news card init path for the flag to survive page reloads.

## Exit Criteria

ADR-052 is complete (and this ADR moves to **Superseded**) when:

1. Worker Vectorize precision@10 ≥ 0.85 across the 30-day window.
2. SimHash and Vectorize agree on ≥ 90% of dedup decisions.
3. ADR-046 status is updated to **Implemented** and SimHash retirement PR
   is merged.
