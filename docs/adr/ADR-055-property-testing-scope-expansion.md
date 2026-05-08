# ADR-055 — Property-Based Testing Scope Expansion (Sprints 317–323)

| Field      | Value                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------- |
| Date       | 2026-05-15                                                                               |
| Status     | Accepted                                                                                 |
| Sprint     | 324 (ADR formalised) / Sprints 317–323 (implementation)                                  |
| Supersedes | n/a (extends ADR-054)                                                                    |
| Related    | ADR-054 (property-testing scope), ROADMAP §G.2.2                                         |

## Context

ADR-054 established the property-based testing pattern with four files
covering `history`, `sync`, `diag`, and `fetch` (23 tests, Sprints 307–310).
Sprints 311–316 stabilised lint/test/coverage but added no new property
tests. With the suite at 5980 tests by v13.32.0, several pure-function
modules in `src/core/` remained covered only by example-based tests.

Seven additional modules were identified as good fits for fast-check
because they expose pure or near-pure functions whose interesting
behaviour is invariant-shaped rather than example-shaped:

- `i18n.ts` — placeholder substitution must be total over arbitrary keys.
- `card-registry.ts` — round-trip register/get and sort stability over
  arbitrary card ID prefixes.
- `anim-level.ts` — clamping logic against arbitrary user/system inputs.
- `provider-health.ts` — exponential backoff bounds and ring-buffer cap.
- `error-tracker.ts` — ring-buffer retention and trend cap.
- `hardware.ts` — tier monotonicity over (cores × memory) tuples.
- `idle.ts` — visibility signal mirroring across arbitrary toggle traces.

## Decision

Sprints 317–323 add seven property test files under `tests/unit/core/`:

| File                                    | Suite prefix  | Target module                | Tests |
| --------------------------------------- | ------------- | ---------------------------- | ----- |
| `i18n-props.test.ts`                    | IP1–IP5       | `src/core/i18n.ts`           | 5     |
| `card-registry-props.test.ts`           | CRP1–CRP5     | `src/core/card-registry.ts`  | 5     |
| `anim-level-props.test.ts`              | ALP1–ALP4     | `src/core/anim-level.ts`     | 4     |
| `provider-props.test.ts`                | PRP1–PRP6     | `src/core/provider-health.ts`| 6     |
| `error-tracker-props.test.ts`           | ETP1–ETP5     | `src/core/error-tracker.ts`  | 5     |
| `hardware-props.test.ts`                | HWP1–HWP4     | `src/core/hardware.ts`       | 4     |
| `idle-props.test.ts`                    | IDP1–IDP3     | `src/core/idle.ts`           | 3     |

**Total**: 32 new property tests across Sprints 317–323. Combined with
ADR-054's 23 tests, the codebase now has **55 fast-check property tests**
covering 11 core modules.

## Rules

The same rules from ADR-054 apply, plus one new constraint exposed by
this sprint set:

**Module-level mutable state must be reset _inside_ each `fc.property`
iteration, not in `beforeEach`.** Modules like `card-registry` use a
module-scoped `Map` that persists across the 20+ iterations a single
`fc.assert` runs. Calling `uniquePrefix()` (or any reset helper) at the
top of the `it()` block is wrong — every iteration shares the prefix and
state accumulates. The fix discovered during development:

```ts
fc.assert(
  fc.property(genCardId(), (id) => {
    const prefix = uniquePrefix(); // ← inside the property body
    register({ id: `${prefix}-${id}`, ... });
    expect(get(`${prefix}-${id}`)).toBeDefined();
  }),
);
```

For modules with a public reset (e.g. `_resetProviderHealth`,
`_resetHardwareProfile`), call the reset at the start of every property
iteration, not in `beforeEach`.

## Consequences

### Positive

- 55 cumulative property tests now guard core invariants. Any future
  change that breaks a mathematical property (cap, ordering, cap)
  surfaces immediately rather than via downstream symptom.
- ADR-054's rules are now battle-tested against state-bearing modules
  (registries, ring buffers, caches), and the per-iteration reset pattern
  is documented above.

### Negative

- Per-iteration resets are slightly slower than `beforeEach` resets, but
  fast-check's default of 100 runs on a 4-test file finishes in <30 ms,
  so the cost is negligible.
- New contributors must read both ADR-054 and ADR-055 to learn the full
  pattern. A consolidation pass may be worthwhile after .

### Neutral

- Coverage thresholds are unchanged for v13.33.0; property tests probe
  existing branches that example tests already covered, so the headline
  numbers move only marginally.
