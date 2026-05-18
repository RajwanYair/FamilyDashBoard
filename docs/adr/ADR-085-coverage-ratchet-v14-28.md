# ADR-085 — Coverage Ratchet v14.28.0 (Statements + Branches + Functions + Lines)

**Status**: Accepted
**Date**: 2026-05-18
**Deciders**: @RajwanYair

---

## Context

After v14.27.0 shipped at **96.91 / 90.32 / 96.24 / 97.94** (statements / branches / functions
/ lines), the thresholds stood at `96.9 / 90.3 / 96.2 / 97.9`. Several gaps remained:

1. **`buildWeatherPayload` partial coverage** — the `wind.speed === 0` early-return and the
   `alerts` array splice path had no explicit tests. `system-info.ts` had uncovered
   `perf.memory` branches (non-Chromium path) and the `prewarm()` default-argument branch.

2. **`getSwState` stale fallback** — the `sw.js` state helper returned early when no
   registration was active; the stale-cache fallback branch was never exercised.

3. **`video-news-adapter.ts` uncovered combinatorics** — `listChannels()` filtering by
   `mode`/`mute` and `getStreamDescriptor()` fallback behavior had only happy-path coverage.
   No property-based tests existed for the adapter.

4. **`buildHebrewCalPayload` semantic path** — calling `getSemanticPayload("hebrew-cal")`
   after initializing the Hebrew Calendar card exercised the registered producer path, but
   the test that forced `_lastHolidayName` to a non-null value (covering the holiday branch)
   was absent.

Additionally, the per-card **source hard-cap** in `check-card-bundle-delta.mjs` had been set
to 65 KB since v14.25.0. The weather card measured 63.8 KB, confirming the cap could be
safely tightened.

---

## Decision

**Sprint 1 — statement/function/lines push to 97.0 / 96.4 / 98.1:**

- Add `buildWeatherPayload` tests covering: `wind.speed === 0` branch, `alerts` splice,
  and the `uvi` rounding path.
- Add `system-info.ts` tests for: `perf.memory` unavailable path (`undefined` guard) and
  the `prewarm()` call with no argument (default-parameter branch).
- Add `getSwState` test for the stale-cache fallback when no SW registration is active.

**Sprint 2 — branch push to 90.5% (property tests):**

- Add `tests/unit/cards/video-news-adapter.property.test.ts` with seven properties (VNA1–VNA7)
  using fast-check covering: channel ID uniqueness, descriptor shape invariants, mode/mute
  filtering, stream fallback, URL validation, and null-safety.
- Extend `tests/unit/cards/hebrew-cal.test.ts` with a `buildHebrewCalPayload via
getSemanticPayload` block. Use static top-of-file imports for shared module state;
  set `_lastHolidayName` via private state injection then verify the holiday field appears
  in the semantic payload.

**Sprint 4 — bundle hard-cap 65 KB → 64 KB:**

- Lower `SOURCE_HARD_CAP_KB` in `scripts/check-card-bundle-delta.mjs` from `65` to `64`.
- All cards confirmed under 64 KB; weather at 63.8 KB provides 200-byte headroom.

**Ratchet all four V8 thresholds** in `vitest.config.ts` after each sprint:

| Metric     | v14.27.0 threshold | v14.28.0 threshold | Actual (local, post-S2) |
| ---------- | ------------------ | ------------------ | ----------------------- |
| Statements | 96.9               | 97.0               | 97.09                   |
| Branches   | 90.3               | 90.5               | 90.54                   |
| Functions  | 96.2               | 96.4               | 96.46                   |
| Lines      | 97.9               | 98.1               | 98.13                   |

Thresholds are set ~0.04–0.09% below actuals to give CI a safe margin.

---

## Consequences

### Positive

- All four coverage dimensions ratcheted upward; statements break the 97% barrier for the
  first time.
- `video-news-adapter.ts` gains property-based test coverage (7 suites, VNA1–VNA7).
- `buildHebrewCalPayload` holiday and non-holiday branches are now explicitly tested via
  the semantic clipboard producer path.
- Bundle hard-cap tightened: any future card that exceeds 64 KB source will fail CI.
- Total test count grew from 7572 to 7591 across 314 suites with 0 failures.

### Negative / Trade-offs

- The branch threshold margin (0.04%) is tighter than preferred. A single uncovered branch
  added in a future PR could trigger a CI failure. Authors must run coverage locally before
  merging branch-heavy changes.
- `buildHebrewCalPayload` tests rely on internal state injection (`_lastHolidayName`). If
  the Hebrew Calendar card is refactored to hide that state, the test must be updated.

---

## References

- `vitest.config.ts` — coverage thresholds (Sprint 1 comment: v14.28.0 Sprint 1; Sprint 2 comment)
- `tests/unit/cards/video-news-adapter.property.test.ts` — VNA1–VNA7
- `tests/unit/cards/hebrew-cal.test.ts` — `buildHebrewCalPayload via getSemanticPayload` block
- `scripts/check-card-bundle-delta.mjs` — `SOURCE_HARD_CAP_KB = 64`
- Supersedes threshold column from ADR-084 (which covered v14.26.0 ratchet decisions)
