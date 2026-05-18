# ADR-084 — Coverage Ratchet v14.26.0 (Branch + All Thresholds)

**Status**: Accepted
**Date**: 2026-05-18
**Deciders**: @RajwanYair

---

## Context

After v14.25.0 shipped, the V8 branch coverage was sitting at exactly 89.70% in CI — the
threshold floor with zero headroom. Three specific issues kept it pinned there:

1. **`createAsyncCardLoader` cache short-circuit** — the in-memory `mem` Map retains data
   between Vitest test runs in the same suite. `motivation.ts` tests called
   `initMotivationCard()` which warm-filled the cache; subsequent `loadMotivation` calls
   returned early via cache hit, so `fetchMotivation()` (the pool / AI branch) was never
   exercised. Branch coverage for `motivation.ts` was 74.71%.

2. **`base-card.ts` validate-error paths** — the `stale !== null ? "ok" : "error"` ternary
   in `createAsyncCardLoader` had only the happy path covered. The error branch and the
   stale-fallback branch (when `validate` rejects) were unreachable without explicit tests.
   Branch coverage for `base-card.ts` was 86.04%.

3. **IDB4 property-test flakiness** — `idb-store-props.test.ts` used
   `nameArb.filter((b) => b !== "a")` to ensure distinct DB names; fast-check found the
   counterexample `["y","y","a","a",false,null]` when timing changed (more tests in suite).
   This caused intermittent CI failures unrelated to branch coverage.

Additionally, `currency.ts` tests used `clearFetchLocks()` but not `_resetForTest()`, so
the in-memory cache from successful prior tests caused `loadCurrency` to skip the
try/catch/finally path. `calendar.ts` had uncovered lines in the non-allorigins proxy path
(`diagLog; return text`) and the stale-render path (`cGetStaleAsync` → `renderCalendar`).

---

## Decision

**Fix the root causes** rather than lowering thresholds:

1. Call `_resetForTest()` (from `@/core/cache`) in `beforeEach` for any loader test whose
   subject function is wrapped by `createAsyncCardLoader`. This clears the `mem` Map and
   localStorage, guaranteeing `fetchData()` is invoked every time.

2. Add explicit tests for `createAsyncCardLoader` validate-reject paths (stale=null →
   "error", stale=truthy → "ok").

3. Replace `nameArb.filter((b) => b !== "a")` with `fc.pre(dbA !== dbB)` inside the async
   property body — the standard fast-check idiom for pre-conditions on dependent arbitraries.

4. Add branch-coverage tests for `currency.ts` (market-hour schedule timer) and
   `calendar.ts` (non-allorigins VCALENDAR success return, stale cache render path).

**Ratchet all four V8 thresholds** in `vitest.config.ts` after confirming the improvements:

| Metric     | v14.24.0 (CI floor) | v14.26.0 (new threshold) | Actual (local) |
| ---------- | ------------------- | ------------------------ | -------------- |
| Statements | 96.4                | 96.5                     | 96.56          |
| Branches   | 89.7                | 89.8                     | 89.83          |
| Functions  | 95.8                | 95.9                     | 95.93          |
| Lines      | 97.4                | 97.5                     | 97.55          |

The thresholds are set ~0.06% below the actual to give CI a safe margin (Linux V8 coverage
can be slightly lower than Windows V8 coverage for the same code).

---

## Consequences

### Positive

- Branch coverage is measurably higher and will not silently regress below 89.8%.
- `motivation.ts` branch coverage raised from 74.71% → 89.65%.
- `base-card.ts` branch coverage raised from 86.04% → 97.67%.
- IDB4 property test is no longer flaky regardless of suite timing or random seed.
- The `currency.ts` and `calendar.ts` proxy / stale paths are now explicitly tested.

### Negative / Trade-offs

- None significant. Adding `_resetForTest()` to `beforeEach` is a minor boilerplate
  addition; the alternative (not calling it) is silent cache pollution between tests.

### Follow-up

- Ratchet branches further to 90.0 in v15 once the remaining ~6% uncovered card branches
  are brought up (Roadmap item #22 — "V15-OPEN: card branch coverage 90%+").
- The Stryker `break: 90` threshold introduced in v14.25.0 is complementary to this ADR;
  Stryker catches surviving mutations even when line/branch coverage looks healthy.
