# ADR-071: X12 + X15 Per-Card Adoption Pattern

- **Status**: Accepted (codifies pattern used in v13.39.0 Sprints 376–379)
- **Date**: 2026-05-26 (v13.39.0 patch series)
- **Sprints**: 381 (this ADR), 376–379 (pattern crystallised)
- **Related**: ADR-067 (X12 protocol), ADR-070 (X15 clipboard)

## Context

ADR-067 specifies the X12 `card-signal-protocol` and ADR-070 the X15
semantic clipboard. Both now have working core implementations
(v13.38.0) and 2 of 12 cards have producer adoption (v13.39.0).
The remaining 10 cards will migrate over v14.x. This ADR locks
the **adoption pattern** so each migration is mechanical and
predictable.

## Decision

Every card that holds a "current state" worth sharing or copying
follows this 4-step pattern.

### Step 1 — imports

```ts
import { setCardSignal } from "../../core/card-signal-protocol";
import { registerSemanticProducer } from "../../core/semantic-clipboard";
import type { SemanticPayload } from "../../types/semantic-clipboard";
```

### Step 2 — publish a typed signal on every render/tick

```ts
setCardSignal("<cardId>", "<key>", {
  /* shape stable across releases; bump key when shape changes */
});
```

- `cardId` MUST equal the registry ID (e.g. `"hebrew-cal"`, never
  `"hcal"`). Rule 33 from `.github/copilot-instructions.md`.
- `key` is short, kebab-case, scoped to the card (e.g. `"next"`,
  `"next-holiday"`, `"current"`, `"top-mover"`).
- Value is plain JSON — no functions, no DOM nodes. Frozen at
  publish time.

### Step 3 — semantic-clipboard producer

```ts
function buildXxxPayload(): SemanticPayload | null {
  if (/* nothing meaningful yet */) return null;
  return {
    cardId: "<cardId>",
    text: "<short Hebrew sentence ready to paste into chat/email>",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Event" /* or Place / Action / DataFeedItem */,
      /* schema.org fields */
    },
    ts: Date.now(),
  };
}
```

### Step 4 — register in `init`

```ts
export function initXxxCard(): void {
  cacheDom();
  registerSemanticProducer("<cardId>", buildXxxPayload);
  // …existing init…
}
```

`registerSemanticProducer` is **idempotent** — re-registration replaces
the previous function. Cards MUST NOT gate registration behind a
module-level boolean (lesson from S378 — tests reset producers
between cases and the gate would prevent re-registration).

## Per-card key conventions (current + planned)

| cardId | X12 keys | X15 producer |
| --- | --- | --- |
| `countdown` | `next` (primary) | ✅ (v13.39.0 S377) |
| `hebrew-cal` | `next-holiday`, `next-zman` (planned) | ✅ (v13.39.0 S379) |
| `weather` | `current`, `nowcast` (planned) | planned v14.x |
| `calendar` | `next-event` (planned) | planned v14.x |
| `alerts` | `active` (planned) | planned v14.x |
| `stocks` | `top-mover` (planned) | planned v14.x |
| `currency` | `usd-ils`, `eur-ils` (planned) | planned v14.x |
| `news` | `top` (planned) | planned v14.x |
| `motivation` | — (no shareable state) | planned v14.x (current quote) |
| `tasks` | `pending-count` (planned) | planned v14.x (today's tasks) |
| `system-info` | `health` (planned) | not planned (debug-only) |
| `video-news` | — | not planned (audio/video) |

## Test pattern

Each card-level adoption ships with an integration test pair under
`tests/unit/cards/<card>-signals.test.ts`:

```ts
beforeEach(() => {
  _resetCardSignals();
  _resetSemanticProducers();
});

it("publishes signal on tick", () => { /* … */ });
it("getSemanticPayload returns null before init", () => { /* … */ });
it("returns SemanticPayload after init+tick", () => { /* … */ });
```

See `tests/unit/cards/countdown-signals.test.ts` for the canonical
example.

## Consequences

- Every card migration is ≤ 50 LoC plus ≤ 80 LoC of tests.
- The `Y` (yank) key works the moment a card has a registered
  producer — no per-card key wiring required.
- The MCP read-only server (X11) and the today-pane composer (PC-1)
  consume `getCardSignal` directly — no per-consumer adapter code
  needed.
- Per-card source budget (D13) absorbs the ≤ 50 LoC easily; the
  current 42 KB warn-cap is unchanged by this pattern.

## Status flag in card files

Cards that have completed this migration carry a top-of-file marker
comment:

```ts
// X12/X15 ADOPTED — v13.39.0 Sprint <N>
```

This makes audit grep-friendly: `grep -r "X12/X15 ADOPTED" src/cards/`.
