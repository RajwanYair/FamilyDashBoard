# ADR-044 — `exactOptionalPropertyTypes: true` in tsconfig.json

- **Status**: Accepted
- **Date**: 2026-04-29
- **Sprint**: 148 (enabled), 152 (documented)

## Context

TypeScript's default behaviour for optional properties (`prop?: T`) treats
them as `T | undefined`, meaning it allows explicitly passing `undefined` for
an optional key.  This is a known source of subtle bugs:

```ts
// default strictness — both compile without error:
obj.prop = undefined;  // OK — but writes an explicit undefined key
delete obj.prop;       // OK — removes the key entirely
```

When `exactOptionalPropertyTypes: true` is enabled, TypeScript distinguishes
between "property absent" and "property present with value `undefined`".
Passing `undefined` to an `?: T` slot becomes a type error unless the
property is declared `?: T | undefined`.

## Decision

Enable `exactOptionalPropertyTypes: true` in `tsconfig.json` .

All optional properties that legitimately accept `undefined` as an explicit
value must be declared `?: T | undefined`.  Properties that are purely absent
(never written as `undefined`) stay `?: T`.

### Files changed in Six source files required `prop?: T → prop?: T | undefined` annotations

(15 total property sites):

| File | Properties updated |
| --- | --- |
| `src/types/config.ts` | `cardSizes`, `cardOrder`, `hiddenCards`, `cardPositions` |
| `src/core/config.ts` | `cardSizes`, `cardOrder`, `hiddenCards` |
| `src/cards/countdown/countdown.ts` | `targetDate` |
| `src/cards/tasks/tasks.ts` | `lastSync` |
| `src/cards/weather/weather.ts` | `forecastData` |
| `src/ui/config-panel.ts` | `pendingConfig` |

## Consequences

### Positive

- Eliminates a class of silent bugs where `undefined` keys were written to
  `localStorage` config objects.
- Aligns with TypeScript's strictest recommended settings.
- Easier to reason about whether a property can be omitted vs. explicitly
  set to `undefined`.

### Negative

- Requires `?: T | undefined` syntax in places that intentionally accept
  `undefined` — slightly more verbose.
- Third-party type packages that are not `exactOptionalPropertyTypes`-clean
  may require casting at the boundary; monitor for regressions after
  dependency bumps.

## Policy (ongoing)

> **Rule**: Any new optional property must use `?: T | undefined` if the
> code ever assigns `undefined` to it explicitly.  Use `?: T` only if the
> property is always either set to a real value or omitted entirely.

## Alternatives Considered

| Option | Outcome |
| --- | --- |
| Keep default strictness | Silent `undefined`-key bugs remain possible |
| Add lint rule instead | ESLint cannot replicate TS structural check at type level |
| Gradual migration with `// @ts-ignore` | Adds suppressions; violates zero-suppression rule |

## Status history

| Date       | Status   | Note                                          |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-28 | Draft    | enabled in tsconfig.json; 15 fixes |
| 2026-04-28 | Accepted | all tests and type-check pass    |
| 2026-04-29 | Accepted | ADR written and committed        |
