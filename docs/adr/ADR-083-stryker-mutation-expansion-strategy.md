# ADR-083: Stryker Mutation Expansion Strategy — Ratchet to ≥ 92% by v15.0.0

| Field        | Value                                            |
| ------------ | ------------------------------------------------ |
| **Date**     | 2026-05-17                                       |
| **Status**   | Accepted                                         |
| **Deciders** | @RajwanYair                                      |
| **Tags**     | testing, mutation, stryker, quality-gate, v15    |
| **Related**  | ADR-058 (Stryker baseline), ROADMAP §1.7 item 20 |

---

## Context

ROADMAP item #20 (P1): _"Stryker mutation expansion to remaining modules"_.

**Current state at v14.25.0:**

| Metric          | Value         |
| --------------- | ------------- |
| Files in scope  | 136           |
| Threshold high  | 90%           |
| Threshold break | 90%           |
| Threshold low   | 82%           |
| Achieved score  | ≥ 90% (green) |

Mutation testing has been incrementally ratcheted from 87% (v14.20.0) → 88% → 89% → 90%
(v14.25.0). Property-based tests (Sprints 1–3 of v14.25.0 session) added 25 new tests
across `fs-access`, `d1-reports`, `errors-route`, `normalize-error`, `cron`, and `telemetry`,
which increase coverage of the mutation surface.

**Gap to v15 target:**

The ROADMAP §1.7 targets ≥ 92% mutation score for the v15.0.0 major release. Current
gap = 2 percentage points. Each 1-point ratchet requires verified actual score (Stryker run)
above the new threshold before bumping `scripts/stryker.config.mjs`.

## Decision

**Accept the incremental ratchet plan: 90% → 91% → 92% by v15.0.0.**

### Ratchet schedule

| Release  | Target | Trigger condition                                                          |
| -------- | ------ | -------------------------------------------------------------------------- |
| v14.26.0 | ≥ 91%  | After property suites for remaining worker utils (validation, kv, schemas) |
| v15.0.0  | ≥ 92%  | After validation + kv + schemas property test suites land                  |

### Files with highest mutation gap (next expansion targets)

Priority order for new property test suites:

1. `worker/src/utils/validation.ts` — already has `validation.property.test.ts`; deepen.
2. `worker/src/utils/kv.ts` — already has `kv.property.test.ts`; deepen.
3. `worker/src/utils/schemas.ts` — already has `schemas.property.test.ts`; deepen.
4. `src/core/cache.ts` — expand property coverage for TTL edge cases.
5. `src/core/history.ts` — expand for arbitrary title/URL length inputs.

### Gate enforcement

Each ratchet bump in `scripts/stryker.config.mjs` must be preceded by a passing
`npx stryker run` with score ≥ new threshold. No speculative ratchets.

The Stryker config path: `scripts/stryker.config.mjs`, `thresholds: { high, break }`.

## Consequences

- Mutation score remains a hard gate in CI (exit 1 on break).
- Property test suites are the primary vehicle for ratchet progression —
  they kill more mutants per LOC than equivalent unit tests.
- The 136-file scope is frozen for v14.x; v15 may expand to include
  `src/ui/` modules currently excluded.
- No speculative thresholds — actual Stryker run required before each bump.
