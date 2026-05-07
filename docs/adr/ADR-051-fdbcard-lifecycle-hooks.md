# ADR-051 — FdbCard Lifecycle Hook Protocol (onThemeChange + onAlert)

| Field      | Value                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| Date       | 2026-05-28                                                                     |
| Status     | Accepted                                                                       |
| Sprint     | 253 (hooks added) / 270 (ADR formalised)                                       |
| Supersedes | n/a                                                                            |
| Related    | ADR-001 (Shadow DOM rejected), card-registry (`src/core/card-registry.ts`)     |

## Context

FamilyDashBoard cards are plain `HTMLElement` instances registered in the card
registry (`registerCard` / `getCard`). Prior to cards had no
standard way to react to cross-card runtime events:

- **Theme change** — a user cycling themes (key `t`) or the auto-theme rule
  firing should allow each card to update dynamic CSS variables or swap
  icon sets without a full re-render.
- **Alert state change** — the alerts card broadcasts security/weather alerts
  via the `alertRingSet` / `alertRingGet` API. Other cards (e.g. news,
  stocks) should be able to dim, highlight, or suppress content when a
  high-urgency alert is active.

Without a formal protocol, components coupled directly to the `EventBus` with
ad-hoc event names, leading to undiscoverable contracts and test friction.

## Decision

Extend `CardDefinition` (in `src/types/config.ts`) with two optional lifecycle
hooks:

```typescript
export interface CardDefinition {
  // ... existing fields ...

  /**
   * Called by the theme manager after a theme transition completes.
   * Receives the new theme name; the DOM `data-theme` attribute is already
   * updated before this hook fires.
   */
  onThemeChange?: (theme: ThemeName) => void;

  /**
   * Called by the alerts card when the highest-urgency active alert changes.
   * `urgency` is `null` when all alerts are cleared.
   */
  onAlert?: (urgency: AlertUrgency | null) => void;
}
```

The card registry iterates over all registered cards and calls the hooks via
`fireThemeChange(theme)` and `fireAlertChange(urgency)` helpers defined in
`src/core/card-registry.ts`. Cards that do not need the hook simply omit it.

## Rationale

| Option                                  | Verdict  | Reason                                                      |
| --------------------------------------- | -------- | ----------------------------------------------------------- |
| Direct EventBus subscription per card  | Rejected | Undiscoverable, no type safety, hard to test in isolation   |
| Custom DOM events on `document`         | Rejected | Violates "no DOM pollution" principle; no TypeScript types  |
| Registry lifecycle hooks (chosen)       | Accepted | Type-safe, tree-shakeable, easy to mock in unit tests       |
| Framework-style context/provider        | Rejected | Violates ADR-002 (zero client dependencies)                 |

## Consequences

- **Positive**: New cards automatically participate in theme and alert
  reactions by declaring the hooks — no manual event subscription needed.
- **Positive**: `fireThemeChange` / `fireAlertChange` are synchronous and
  have O(n) complexity over registered cards (n ≤ 12 in current config).
- **Negative**: Cards that hold expensive references must be careful not to
  cause layout thrash inside `onThemeChange`.
- **Neutral**: Legacy cards without hooks continue to work unchanged.

## Implementation Notes

- `CardDefinition.onThemeChange` and `onThemeChange` are called **after** the
  `data-theme` attribute is set on `<html>`, so `getComputedStyle` returns
  the new token values.
- `onAlert` receives `null` when `alertRingGet()` returns an empty ring —
  cards should treat `null` as "all-clear".
- Both hooks are fire-and-forget; exceptions bubble to `diagLog` but do not
  interrupt the loop.
- Tests: use `vi.fn()` stubs passed as `onThemeChange`/`onAlert` in
  `registerCard(...)` calls within `beforeEach` blocks.
