# ADR-076 — TC39 Temporal Migration Scaffold

**Status**: Accepted · **Date**: 2026-05-17 · **Drivers**: TC39 Temporal Stage 4 promotion, date-math correctness, UTC-midnight alignment.

## Context

FamilyDashBoard uses `new Date()` and raw `Date.now()` arithmetic throughout three date-sensitive cards:

| Card | Date-math usage |
|---|---|
| `countdown` | Target date parsing, recurrence advance, days-remaining countdown |
| `calendar` | Event overlap detection, week-view boundary calculations |
| `hebrew-cal` | Shabbat detection, Rosh Chodesh calculation, zmanim display |

Several bugs traced back to the raw `Date` API:

1. **UTC-midnight skew** — `new Date(dateStr)` (date-only ISO string) is interpreted as UTC midnight; `.toLocaleDateString()` then shifts it by the local timezone offset, producing "yesterday" on machines west of UTC when viewed after midnight local.
2. **Mutating date objects** — `getRoshChodesh` and `nextHolidayName` in `hebrew-cal.ts` called `.setDate()` / `.setFullYear()` on the same `Date` instance used in outer-loop comparisons, corrupting iteration state.
3. **Scattered `new Date()` / `Date.now()` calls** — 27 independent call sites with no shared contract for "what timezone is today?", making future DST or locale changes a multi-file surgery.

TC39 Temporal is at Stage 4 (May 2025) but not yet available in the minimum browser targets (`Chrome 114`, `Firefox 128`, `Safari 17.4`).
Polyfill (`@js-temporal/polyfill`) is 47 KB gzip — above the 10 KB per-card budget gate — so the polyfill import is **CLOSED** until the bundle gate opens.

## Decision

Introduce a **thin adapter layer** (`src/core/temporal.ts`) that wraps the current `Date` API with function signatures that **match TC39 Temporal semantics exactly**, enabling a one-file swap when the polyfill gate opens.

### Adapter contract

```ts
nowMs(): number                                          // Date.now()
today(): { year: number; month: number; day: number }   // local wall-clock date
startOfDayMs(y, m, d): number                           // midnight of given date (local)
parsePlainDateMs(dateStr): number                        // "YYYY-MM-DD" → local midnight ms
parsePlainDateTime(dateStr, timeStr): number             // "YYYY-MM-DD"+"HH:MM" → local ms
addYears(y, m, d, n): { year, month, day }              // advance by n calendar years
addMonths(y, m, d, n): { year, month, day }             // advance by n calendar months
toISODateString(y, m, d): string                        // → "YYYY-MM-DD"
```

All functions return plain values (numbers or plain objects), **never mutable `Date` instances**, eliminating the mutation class of bugs at source.

### Migration scope (v14.22.0)

| File | Functions migrated | Bugs fixed |
|---|---|---|
| `src/cards/countdown/countdown.ts` | `parsePlainDateTime`, `addYears`, `addMonths`, `toISODateString` | UTC-midnight skew in date parsing |
| `src/cards/calendar/calendar.ts` | `nowMs`, `today`, `startOfDayMs`, `parsePlainDateMs` | UTC-midnight "yesterday" shift |
| `src/cards/hebrew-cal/hebrew-cal.ts` | `nowMs`, `today`, `startOfDayMs`, `parsePlainDateMs`, `parsePlainDateTime` | Mutating-date loop corruption in `nextHolidayName` + `getRoshChodesh` |

Raw `new Date()` / `Date.now()` calls in these three files are replaced with adapter calls.
All other files are **unchanged** — scope is limited to date-sensitive card logic.

### Polyfill gate (re-checked 2026-05-17)

`npx bundlesize --files node_modules/@js-temporal/polyfill/dist/index.cjs`:
**47.2 KB gzip** — CLOSED (threshold: 10 KB).

Gate will be re-evaluated each minor release. When the gate opens:

1. `import { Temporal } from '@js-temporal/polyfill'` in `src/core/temporal.ts`
2. Replace each function body with the corresponding `Temporal.Now.*` / `Temporal.PlainDate.*` call
3. All 27+ call sites in card code are unaffected — only `temporal.ts` changes

## Consequences

**Positive:**

- All three date-bug classes (UTC-midnight skew, mutation, scattered call sites) are eliminated
- 27 unit tests in `tests/unit/core/temporal.test.ts` lock down adapter semantics
- One-file TC39 swap path is documented and verified

**Negative / trade-offs:**

- Adapter functions are a thin wrapper — they do not expose full Temporal richness (e.g. `ZonedDateTime`, calendar arithmetic). Cards needing that power must wait for the polyfill gate to open.
- The adapter layer adds a file to maintain; it should be deleted (not emptied) once native Temporal is available in all targets.

## Related

- ADR-068 (X13 Time Machine) — time-shift feature; also benefits from Temporal semantics
- ROADMAP §3: CAL-T · H-T marked "scaffolded v14.22.0"
- `src/core/temporal.ts`, `tests/unit/core/temporal.test.ts`
- Commits: `ca1cd13` (temporal.ts + alerts CSS) · `0d0005e` (countdown) · `ea35078` (calendar) · `bdba24c` (hebrew-cal) · `8744745` (27 unit tests)
