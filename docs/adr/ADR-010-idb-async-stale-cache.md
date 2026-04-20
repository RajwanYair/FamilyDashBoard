# ADR-010: IDB-Async Stale Cache Pattern

**Status**: Accepted
**Date**: 2025-07
**Deciders**: FamilyDashBoard maintainers

---

## Context

FamilyDashBoard uses a three-tier cache: in-memory → localStorage → IndexedDB.
`cSet()` has always written to all three tiers, but the IDB write was fire-and-forget.
Card loaders used `cGet()` (memory + localStorage only) for the hot-path read, so IDB
was only useful as a warm-up source at startup (`hydrateFromIdb()`).

Two gaps remain:

1. **Read**: `cGet` skips IDB during card load, so large payloads evicted from localStorage
   (5 MB limit) were lost until the next network fetch.
2. **Write**: `cSet` does not await the IDB write, so the app cannot confirm persistence
   before marking sync-ok.

---

## Decision

Introduce **`cSetAsync`** — an awaitable variant of `cSet` that resolves only after the
IDB write completes. This complements the existing `cGetAsync`/`cGetStaleAsync` helpers.

Introduce **`createAsyncCardLoader`** (already existed) as the canonical factory for
network-backed cards. It uses `cGetAsync` → IDB-first read on every load, and `cSetAsync`
for writes. Cards should migrate to this factory when they have one or more of:

- Large payload (> 10 KB)
- Long TTL (> 30 min)
- Offline-critical (must survive browser restart)

The **first adopter** is the currency card (`src/cards/currency/currency.ts`).

---

## Storage Tier Policy

| Tier | API | Access pattern | Max size |
|------|-----|---------------|----------|
| Memory (`Map`) | `mem.get/set` | Synchronous, fastest, volatile | RAM |
| localStorage | `LS_PREFIX + key` | Synchronous, persistent | ~5 MB total |
| IndexedDB | `idbGet/idbSet` | Asynchronous, persistent | ~50 MB+ |

**Read priority** (createAsyncCardLoader): memory → IDB → localStorage
**Write**: all three tiers — IDB awaited in `cSetAsync`, fire-and-forget in `cSet`

---

## Migration Path

| Phase | Scope | Target |
|-------|-------|--------|
| Phase 1 (this ADR) | currency card | `createAsyncCardLoader` + `cSetAsync` |
| Phase 2 | news, stocks | Same migration |
| Phase 3 | weather | Same migration (complex due to city state) |
| Phase 4 | All 11 cards | localStorage used for config/flags only |

---

## Consequences

**Positive**:

- Large payloads survive localStorage quota errors
- App can confirm persistence before sync-ok indicator
- Offline recovery is more reliable (IDB survives browser restart)

**Negative**:

- Async card loaders add a micro-delay on first read (IDB open + get)
- `hydrateFromIdb()` at startup remains important for sync `cGet` callers

**Rejected alternatives**:

- Replace localStorage entirely with IDB — rejected because config reads (LS keys)
  must remain synchronous at init time before the async IDB layer is open.
