# ADR-053 — Card configSchema Architecture

| Field      | Value                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- |
| Date       | 2026-04-30                                                                            |
| Status     | Accepted                                                                              |
| Sprint     | 297 (ADR formalised) / Sprints 277–289 (implementation — SETTINGS stream)             |
| Supersedes | n/a                                                                                   |
| Related    | ADR-004 (config namespacing), ADR-009 (config schema evolution), ROADMAP §3.13, §6.11 |

## Context

Before v13.30.0 every user-visible card behaviour was either hardcoded or
only accessible via direct `localStorage` manipulation. The per-card ⚙
settings dialog existed in the DOM (`card-settings-dialog.ts`) but had no
typed schema to drive its auto-render logic. 19 settings were "UI-gap"
items — typed in `DashboardConfig` or a card-level type, but absent from
any `configSchema` array.

The SETTINGS stream (Sprints 277–289, 13 configSchema sprints) filled
every gap and added planned new settings, producing a fully driven settings UI
for all 12 cards.

## Decision

Every `FdbCard` subclass **must** export a `configSchema: CardConfigField[]`
constant (from `src/types/card.ts`). The `card-settings-dialog.ts` driver
auto-renders the settings dialog exclusively from this typed array — no
imperative DOM manipulation is permitted for settings fields.

### `CardConfigField` shape

```ts
interface CardConfigField {
  key: string; // DashboardConfig key or card-level settings key
  type: "boolean" | "number" | "select" | "text" | "range";
  label: string; // Hebrew-first display label
  default: unknown; // Must match the type literal
  // type-specific extras:
  min?: number; // range
  max?: number; // range
  step?: number; // range
  options?: { value: string; label: string }[]; // select
  maxLength?: number; // text
}
```

### Naming conventions

| Setting category        | Key pattern         | Example                  |
| ----------------------- | ------------------- | ------------------------ |
| Card feature toggle     | `cardIdShowFeature` | `weatherShowAqi`         |
| Card display toggle     | `cardIdShowField`   | `sysInfoShowBattery`     |
| Card sort/order         | `cardIdSortOrder`   | `tasksSortOrder`         |
| Card interval/refresh   | `cardIdInterval`    | `sysInfoRefreshInterval` |
| Card base/root selector | `cardIdBase`        | `currencyBase`           |

### Mandatory export structure (per card file)

```ts
// At top of card module — exported so settings dialog can auto-render
export const configSchema: CardConfigField[] = [
  { key: "...", type: "boolean", label: "...", default: true },
  ...
];
```

Cards with `configSchema.length === 0` **fail the CI check** added by
`scripts/check-dead-exports.mjs`.

## Consequences

### Positive

- **Zero manual dialog HTML** — all settings dialogs are auto-rendered from
  the typed schema, eliminating divergence between code and UI.
- **Type-safety** — `CardConfigField` is checked at compile time. Wrong
  `type` / `default` combinations produce a TS error.
- **Property-testable** — `fast-check` can verify field structure invariants
  across all 12 cards in a single test suite (`config-schema-props.test.ts`).
- **Extensible** — adding a new setting requires one object in
  `configSchema[]`; the dialog renders it automatically.
- **Auditable** — `docs/ROADMAP.md §3.13` tracks the
  exposed (E) / gap (G) / planned (P) count per card, updated per sprint.

### Negative

- The `key` string must stay in sync with `DashboardConfig` type manually —
  no compile-time check that `key` resolves to a valid config path.
- `label` strings are not i18n-extracted (Hebrew inline only); a proper
  i18n pipeline would require a second pass.

### Neutral

- `CardConfigField.default` is typed as `unknown` to allow heterogeneous
  arrays. Dialog consumers must narrow via `field.type`.

## Compliance checklist (updated each release)

| Card        | `configSchema.length` | Status (v13.30.0) |
| ----------- | --------------------- | ----------------- |
| news        | 6                     | ✅ CS-N1          |
| weather     | 12                    | ✅ CS-W1 + CS-W2  |
| stocks      | 5                     | ✅ CS-S1          |
| currency    | 6                     | ✅ CS-C1          |
| calendar    | 6                     | ✅ CS-CAL1        |
| hebrew-cal  | 8                     | ✅ CS-H1          |
| alerts      | 8                     | ✅ CS-A1          |
| motivation  | 6                     | ✅ CS-M1          |
| tasks       | 7                     | ✅ CS-T1          |
| system-info | 8                     | ✅ CS-SI1         |
| countdown   | 5                     | ✅ CS-CD1         |
| video-news  | 6                     | ✅ CS-VN1         |

All 19 UI-gap (G) items from §3.13 are resolved as of v13.30.0.
