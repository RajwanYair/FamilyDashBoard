# ADR-009: Config Schema Evolution

**Date:** 2026-07-10
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

`DashboardConfig` in `src/types/config.ts` is a large interface (60+ fields) that is persisted to `localStorage`. Over time fields are added, renamed, and removed. Without a migration strategy, users upgrading from an older version can get stuck with stale configs that cause runtime errors or silently ignore new features.

---

## Decision

**Use a `configVersion` integer as a monotone migration key. On startup, compare `configVersion` from storage against `DEFAULT_CONFIG.configVersion`. If they differ, run the appropriate migration functions and persist the updated config.**

### Schema rules

1. **Additive changes** (new fields with defaults): bump `configVersion` by 1. No migration function needed — `DEFAULT_CONFIG` merge fills missing fields.
2. **Renames / removals**: bump `configVersion` by 1 and add a migration entry in `src/core/config.ts` that transforms the old shape.
3. **Breaking changes** (e.g., type change on an existing field): bump `configVersion` and provide a migration that coerces or resets the affected field.
4. Never decrement `configVersion`.
5. The `DEFAULT_CONFIG` object is the canonical source of truth for initial values.

### Migration pattern

```typescript
// src/core/config.ts
type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  8: (cfg) => ({ ...cfg, newField: 'default' }),
  // next: 9: ...
};
```

On load: apply migrations for all versions from `stored + 1` to `current` in order.

---

## Rationale

1. **User data preservation** — resetting config on every version bump would wipe user preferences (hidden cards, selected theme, custom intervals). Sequential migrations preserve intent.
2. **Testability** — each migration function is a pure transformation on a plain object and trivially unit-testable.
3. **Forward safety** — a config version higher than the running app's `DEFAULT_CONFIG.configVersion` is treated as unknown and left untouched, preventing data corruption on rollback.

---

## Consequences

- `DEFAULT_CONFIG.configVersion` is the single version source of truth (currently `8`).
- Every PR that adds, renames, or removes a config field MUST bump `configVersion` and update `MIGRATIONS`.
- Tests for each migration function are required in `tests/unit/core/config.test.ts`.
