# ADR-067: X12 — Card Signal Protocol Formalisation

- **Status**: Accepted — core API shipped v13.38.0 Sprints 365–366; all 11 applicable producers wired through (motivation + tasks added; system-info + video-news emit no composable signals by design)
- **Date**: 2026-05-04 (v13.37.0 patch series)
- **Sprints**: 356 (spec), 365–366 (impl + tests), 376 (countdown), 379 (hebrew-cal), 415 (today-pane + ai-synthesis consumers), 426 (motivation + tasks producers)
- **Related**: ROADMAP §4.2 X12, ADR-053 (card config schema), ADR-066 (X11 MCP)

## Context

Today, several cross-card features read live state from sibling cards
through ad-hoc per-feature accessors:

- **today-pane** — pulls `weather.current`, `calendar.next`, `alerts.active`.
- **semantic links** — pulls `news.headlines` to detect entity overlap.
- **MCP bridge** (X11, design ADR-066) — will pull all six "today.*"
  signals.
- **daily synthesis** (X9, shipped) — pulls today-pane signals.

Each consumer reaches into the source card via a different pattern
(direct module import, `el.dataset.*`, `localStorage`, registry
lookup). This is the kind of cross-cutting coupling that ADR-002
warns against and that D12 module-boundary lint is meant to surface.

A single typed `CardSignal<T>` contract — produced by cards,
consumed by features — would replace four ad-hoc paths with one.

## Decision

**Adopt** X12 in v14.x with the following protocol.

### File plan

```text
src/core/
  card-signal-protocol.ts    # ~80 LoC, zero deps
  card-signal-protocol.types.ts
src/types/
  card-signal.ts             # public re-export
tests/unit/core/
  card-signal-protocol.test.ts
```

### Protocol

```ts
/**
 * A typed signal exported by a card for sibling consumption.
 * Producers call setCardSignal; consumers call getCardSignal.
 * Versioned for forward-compat — consumers feature-detect.
 */
export type CardSignal<T> = {
  readonly v: 1;            // protocol version
  readonly cardId: string;  // registry ID (matches data-card-id)
  readonly key: string;     // dotted name, e.g. "current"
  readonly value: T;        // deep-frozen
  readonly ts: number;      // wall-clock ms
};

export function setCardSignal<T>(cardId: string, key: string, value: T): void;
export function getCardSignal<T>(cardId: string, key: string): CardSignal<T> | null;
export function onCardSignal<T>(
  cardId: string,
  key: string,
  cb: (s: CardSignal<T>) => void,
): () => void;  // returns unsubscribe
```

### Producer rules

1. Cards set signals via `setCardSignal(cardId, key, value)` whenever
   their visible state changes meaningfully (not on every tick).
2. `value` is deep-frozen automatically by `setCardSignal`. Producer
   must not retain the reference for later mutation.
3. `key` is opaque to the protocol — each card publishes its own
   namespace under its `cardId`.

### Consumer rules

1. Consumers call `getCardSignal(cardId, key)` for one-shot reads.
2. Consumers call `onCardSignal(cardId, key, cb)` to subscribe.
3. Consumers MUST tolerate `null` (signal not yet produced or absent
   card).
4. Subscriptions are weakly held — when the consumer unmounts it must
   call the returned unsubscribe.

### Migration scope (v14.x)

| Consumer | Signals migrated |
| -------- | ---------------- |
| today-pane | `weather.current`, `calendar.next`, `alerts.active` |
| semantic links | `news.headlines` |
| MCP bridge | all six `today.*` tools (ADR-066) |
| daily synthesis | reads through today-pane (no change to synthesis) |

D12 module-boundary baseline shrinks accordingly: `today-pane.ts`
and `ticker.ts` no longer need to import from `src/cards/`.

## Consequences

- **Pro:** Single ~80 LoC contract replaces four ad-hoc paths.
- **Pro:** D12 baseline of 6 grandfathered violations shrinks to 4
  (today-pane.ts, ticker.ts pulled out of `src/cards/` import set).
- **Pro:** MCP bridge (X11) implementation becomes mechanical —
  iterate the registry, call `getCardSignal` per tool.
- **Con:** Cards must learn to publish signals at the right cadence
  (not every tick). Doc + lint rule that flags `setCardSignal` calls
  inside `setInterval(..., < 1000)`.
- **Con:** Adds a `Map<string, CardSignal<unknown>>` global.
  Acceptable — bounded by the registered card count.

## Open Questions

- Whether subscriptions should fire synchronously or via
  `queueMicrotask`. Default: microtask (avoids producer-consumer
  re-entrancy). Confirm at implementation.

## References

- ROADMAP §4.2 X12
- ADR-053 (card config schema — same versioning pattern)
- ADR-066 (X11 — primary downstream consumer)
- `src/core/card-registry.ts` (registry lookup, sibling pattern)
