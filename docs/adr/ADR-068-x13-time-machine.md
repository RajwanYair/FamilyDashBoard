# ADR-068: X13 — Time-Machine Debug Mode (Track v15)

- **Status**: Tracking (revisit at v15 once X8 snapshot extension lands)
- **Date**: 2026-05-04 (v13.37.0 patch series)
- **Sprints**: 357
- **Related**: ROADMAP §4.3 X13, ADR-067 (X12 signal protocol), `src/core/snapshot.ts` (X8)

## Context

`src/core/snapshot.ts` (X8, shipped v12.x) already captures a single
point-in-time JSON snapshot of all card state on demand for
diagnostics. Operators have asked for the ability to **scrub backward
through the last N hours** of dashboard state to investigate "what
did the screen look like when X happened?"

X13 in `docs/ROADMAP.md` §4.3 proposes a 24h ring buffer in IDB,
sampled every 60 s, with a `Ctrl+Shift+T` keyboard scrub UI. Behind
`?devtime=1` to keep the debug surface off the hot path.

## Decision

**Track** X13 for v15. Do **not** adopt in v14.x.

Conditions to revisit:

1. X12 card-signal protocol (ADR-067) is shipped — provides the
   uniform serialisation surface that snapshot can reuse.
2. Storage Buckets API (D4, ADR-056) reaches widespread support so
   the ring buffer can live in a named partition with explicit quota
   (target: ≤ 50 MB across 1440 snapshots × 24h).
3. At least one operator has requested time-scrub against a real
   incident.

## Rationale for Tracking, Not Adopting

- **No demand signal**: snapshot (X8) has been live for two majors
  without a single time-scrub request.
- **Storage cost**: 1440 snapshots/day × ~30 KB each ≈ 42 MB/day. Even
  with eviction, this is the largest single per-origin storage write
  pattern in the dashboard.
- **Maintenance load**: a debug surface that survives card refactors
  must keep pace with the card-signal protocol. Premature adoption
  ties the protocol design's hands.

## Sketch (when adopted)

### File plan

```text
src/core/
  time-machine.ts         # ~150 LoC, gated by ?devtime=1
  time-machine.types.ts
src/ui/
  time-machine-overlay.ts # scrub UI; opens on Ctrl+Shift+T
src/ui/styles/
  time-machine.css        # belongs to @layer components
tests/unit/core/
  time-machine.test.ts
docs/
  time-machine.md
```

### Storage layout

- Storage Bucket: `fdb-time-machine` (created on first scrub-mode
  load).
- IndexedDB store: `snapshots`, key = `ts: number`, value = compressed
  snapshot JSON.
- Compression: native `CompressionStream("gzip")` — no library.
- Eviction: keep newest 1440 entries (24h). Evict on every write.

### Keyboard

- `Ctrl+Shift+T` toggles the overlay.
- Arrow Left/Right: scrub by 60 s.
- `Esc` closes; dashboard returns to live state.

### Privacy

- Scrub buffer never leaves the device.
- Disabled by default (`?devtime=1` opt-in).
- Cleared on `?devtime=0` or via Storage Buckets eviction.

## Consequences

- **Pro (when adopted):** Operators can reproduce display state for
  any moment in the last 24h — invaluable for civil-defense incident
  reviews.
- **Pro (when adopted):** Reuses X12 + X8 + Storage Buckets — no new
  primitives.
- **Con (today):** Untriggered demand. Adopting now is YAGNI.
- **Con (when adopted):** Largest per-origin storage write pattern
  in the project. Must stay strictly opt-in.

## References

- ROADMAP §4.3 X13
- `src/core/snapshot.ts` (X8 — current single-snapshot path)
- ADR-067 (X12 signal protocol — prerequisite)
- ADR-056 (D4 Storage Buckets — storage layer)
