# ADR-070: X15 — Semantic Clipboard (Adopt v14.x)

- **Status**: Accepted — core implementation shipped v13.38.0 Sprints 367–369
- **Date**: 2026-05-04 (v13.37.0 patch series)
- **Sprints**: 359 (spec), 367–369 (impl), 371 (docs)
- **Related**: ROADMAP §4.5 X15, ADR-067 (X12 signal protocol)
- **Implementation note**: Bound to `Y` (yank), not `C`, because `C`
  was already taken by the clock-seconds toggle in v13. References
  to `C` below are historical.

## Context

Today, when an operator wants to share dashboard state with a chat
or email — e.g. "the next zman is mincha at 18:42" — they must
re-type it. A few cards have a basic "copy on tile" that copies the
visible text only, missing context (date, time-zone, severity, link).

ROADMAP §4.5 X15 proposes a **semantic clipboard**: keyboard `C`
while focused on a card copies a context-rich payload — both
human-readable text **and** a JSON-LD block — to the clipboard.
Pasting into a chat client surfaces the text; pasting into a
schema-aware tool surfaces structured data.

## Decision

**Adopt** X15 in v14.x. This is the smallest of the X11–X15 cohort
(estimated ≤ 2 KB gzip, single keymap entry, single new core file)
and has clear single-keypress UX.

### File plan

```text
src/core/
  semantic-clipboard.ts       # ~80 LoC
  semantic-clipboard.types.ts # SemanticPayload union
src/types/
  semantic-clipboard.ts       # public re-export
tests/unit/core/
  semantic-clipboard.test.ts
docs/keyboard.md               # add `C` shortcut
```

### Payload shape

```ts
type SemanticPayload = {
  /** Plain-text representation, ready for chat/email paste. */
  readonly text: string;
  /** JSON-LD block — schema.org Event/Place/Action. */
  readonly jsonLd: Record<string, unknown>;
  /** Source card registry ID. */
  readonly cardId: string;
  /** Wall-clock ts of the snapshot. */
  readonly ts: number;
};
```

### Producer protocol

Each card opting in implements:

```ts
export function getSemanticPayload(): SemanticPayload | null;
```

Returns `null` if the card has no shareable state right now (e.g.
loading). The card-registry exposes a `getSemanticPayload(cardId)`
helper so the clipboard core can dispatch by focused card.

### Keyboard binding

- `C` — when focus is inside a card with `data-card-id`, copy.
- Fallback: when no card is focused, `C` is ignored.
- Toast confirmation: "הועתק לזיכרון" via existing `#refresh-toast`
  pattern, 1500 ms.

### Clipboard API

Uses `navigator.clipboard.write([new ClipboardItem({ "text/plain":
text, "application/ld+json": jsonLd })])`. Falls back to `text/plain`
only when `ClipboardItem` is unavailable (Safari < 16).

CSP: clipboard-write is already allowed via Permissions-Policy
`clipboard-write=(self)` (ADR-056 / ).

### Per-card adoption (v14.x rollout)

| Card | Producer | Notes |
| ---- | -------- | ----- |
| `hebrew-cal` | next zman | schema.org `Event` |
| `calendar` | focused event | schema.org `Event` |
| `weather` | current condition | schema.org `WeatherForecast` |
| `alerts` | active alert | schema.org `EmergencyService` |
| `countdown` | focused countdown | schema.org `Event` |

Other cards (news, stocks, etc.) implement opportunistically — not
gating release.

### Bundle delta

- Core: ≤ 2 KB gzip.
- Per-card producer: ≤ 0.3 KB gzip each.
- Total v14.x estimate: ≤ 4 KB gzip across 5 cards. Well inside the
  D13 per-card warn-cap.

## Consequences

- **Pro:** Single new keystroke with universal mental model
  ("C copies the focused card").
- **Pro:** JSON-LD payload is forward-looking — assistants and
  schema-aware tools (Google Workspace, Notion) can auto-extract.
- **Pro:** Reuses existing `clipboard-write=(self)` allowance —
  no Permissions-Policy edit needed.
- **Con:** Per-card producer adds 0.3 KB to each adopting card.
  Mitigated by the bounded 5-card initial rollout.
- **Con:** JSON-LD shapes are opinionated; we may need to revise as
  schema.org evolves. Versioned via `SemanticPayload.v` in v15.

## Open Questions

- Whether to include a `url` field in `SemanticPayload` for
  permalinks. Default: no — dashboard has no permalinks. Re-evaluate
  if X14 phone-pairing introduces shareable URLs.

## References

- ROADMAP §4.5 X15
- ADR-056 (clipboard-write Permissions-Policy)
- ADR-067 (X12 signal protocol — sibling shape pattern)
- schema.org: <https://schema.org/>
- ClipboardItem: <https://developer.mozilla.org/docs/Web/API/ClipboardItem>
