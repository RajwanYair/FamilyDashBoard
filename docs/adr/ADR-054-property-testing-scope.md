# ADR-054 — Property-Based Testing Scope Map

| Field      | Value                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| Date       | 2026-05-03                                                                               |
| Status     | Accepted                                                                                 |
| Sprint     | 313 (ADR formalised) / Sprints 307–310 (implementation — Stream G.2.2)                  |
| Supersedes | n/a                                                                                      |
| Related    | ADR-003 (worker-first API), ADR-008 (CSS layer governance), ROADMAP §G.2.2               |

## Context

The test suite reached 5957 tests / 175 suites by v13.31.0, with coverage
at 93.17 / 84.73 / 92.02 / 94.55 (statements / branches / functions / lines).
The existing suites are almost entirely example-based (concrete inputs with
concrete expected outputs). Three categories of logic are difficult to
cover exhaustively with examples alone:

1. **Pure algorithmic functions** — `sparklineSvg`, exponential backoff,
   ring-buffer management — where the invariant is a mathematical property
   (monotonicity, boundedness, idempotence) rather than a specific output
   value.
2. **Stateful lock primitives** — `acquireLock` / `releaseLock` /
   `clearFetchLocks` — where the interesting behaviour is the ordering of
   state transitions, not a single call.
3. **Diagnostic classifiers** — `classifyProviderError` — where the
   exhaustive input space (all `unknown` values) is far larger than any
   realistic example set.

Property-based testing (PBT) with **fast-check 3.x** fills this gap by
generating hundreds of random inputs and asserting high-level invariants
rather than specific outputs.

## Decision

Sprints 307–310 introduced four property test files under `tests/unit/core/`:

| File                          | Suite prefix | Target module        | Tests |
| ----------------------------- | ------------ | -------------------- | ----- |
| `history-props.test.ts`       | HP1–HP6      | `src/core/history.ts`  | 6     |
| `sync-props.test.ts`          | SYP1–SYP6   | `src/core/sync.ts`     | 6     |
| `diag-props.test.ts`          | DP1–DP5     | `src/core/diag.ts`     | 6     |
| `fetch-props.test.ts`         | FP1–FP5     | `src/core/fetch.ts`    | 5     |

**Total**: 23 new property tests added in Sprints 307–310.

### Scope: what is property-tested

| Module          | Properties verified                                                                       |
| --------------- | ----------------------------------------------------------------------------------------- |
| `history.ts`    | HP1: empty/singleton → ""; HP2: ≥2 points → non-empty; HP3: contains `<polyline`;        |
|                 | HP4: viewBox matches w/h params; HP5: x-coords monotonically non-decreasing;             |
|                 | HP6: stroke attribute contains the supplied color string                                  |
| `sync.ts`       | SYP1: recordFailure monotonically increases delay; SYP2: recordSuccess resets to 1;      |
|                 | SYP3: delay is always a power of 2; SYP4: delay is bounded [1, 32];                      |
|                 | SYP5: getFailedPanes includes keys with ≥1 failure; SYP6: N failures → delay = min(2^N, 32) |
| `diag.ts`       | DP1: messages retrievable within buffer capacity; DP2: getDiagEntries respects limit;    |
|                 | DP3: buffer never exceeds DIAG_BUFFER_SIZE (80); DP4: formatDiagEntry embeds original msg; |
|                 | DP5a: classifyProviderError returns a known kind; DP5b: non-Error → "unknown"            |
| `fetch.ts`      | FP1: first acquireLock returns true; FP2: duplicate lock returns false;                  |
|                 | FP3: acquire after release returns true; FP4: clearFetchLocks re-enables all keys;       |
|                 | FP5: N recordFetchFailure → getConsecutiveFailures === N; isNetworkOffline iff N ≥ 3     |

### Scope: what is NOT property-tested (and why)

| Module / concern        | Rationale for exclusion                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| DOM / card render logic | Requires happy-dom + full page wiring — covered by Playwright VR tests instead    |
| API fetch / proxy chain | Side-effectful; property tests must be deterministic — covered by integration tests |
| CSS correctness         | Structural, not algorithmic — covered by VR baselines                              |
| Worker message protocol | Async message-passing with serialisation — covered by `worker.test.ts`             |
| Cache (`cGet`/`cSet`)   | Already at 100% branch coverage in `cache.test.ts`                                |

### Conventions

- Each property test file lives in `tests/unit/core/` beside its target's
  example-based counterpart (e.g., `history.test.ts` + `history-props.test.ts`).
- `numRuns: 200` is the default run count for all `fc.assert` calls. Increase
  to 500 only for deeply non-obvious invariants.
- **Module state isolation**: stateful core modules (`sync`, `diag`, `fetch`)
  must be reset in `beforeEach` / `afterEach` blocks. Use `fc.uuid()` for keys
  to prevent cross-test state bleed.
- Import pattern: named imports only — never `import * as`. This keeps tree-
  shaking deterministic and avoids exposing private symbols.
- No `@ts-ignore` or `eslint-disable` in property test files — ever.

## Consequences

### Positive

- 23 additional test cases probe algorithmic invariants that are difficult to
  cover with examples — e.g., monotonicity of sparkline x-coordinates across
  all point configurations.
- Invariant-level tests act as living documentation of module contracts.
- fast-check's shrinking capability produces minimal failing inputs when a
  regression is introduced, dramatically shortening debug cycles.
- Property tests run inside Vitest 4 alongside example tests — no separate
  tooling or CI step required.

### Negative / trade-offs

- Each `fc.assert` with `numRuns: 200` adds ~20–80 ms to the test run
  (vs. < 1 ms for a single example). 23 property tests add < 2 s total — acceptable.
- Property tests require understanding of fast-check arbitraries; onboarding
  cost is slightly higher than for example tests.
- Module-state-dependent modules (`sync`, `diag`, `fetch`) require careful
  teardown — omitting cleanup causes cross-test pollution (documented in
  test files via inline comments).

## Future Scope

Candidate modules for future property test expansion (not yet decided):

- `src/core/cache.ts` — cache eviction ordering properties (LRU / 7-day TTL)
- `src/core/config.ts` — round-trip serialisation: `save(load(x)) === x`
- `src/cards/stocks/` — price formatting invariants (no negative width, valid precision)
- `src/ui/theme-picker.ts` — theme toggle cycle is idempotent after 6 presses
