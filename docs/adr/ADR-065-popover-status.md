# ADR-065: D11 — `popover=` Attribute Status and Remaining Migration Candidates

- **Status**: Partially shipped (2 popovers live; remaining tracked here)
- **Date**: 2026-05-03 (v13.36.0 patch series)
- **Sprints**: 348
- **Related**: ROADMAP §1.11 D11, §5.1 platform primitives

## Context

ROADMAP item **D11** calls for using the platform `popover=`
attribute in place of ad-hoc focus-traps for "diag toasts and
bookmark menu". Two popovers are already live in `src/index.html`:

1. **`#cur-reload-popover`** — Currency card quick-reload status
   (`popover="auto"`, light-dismiss).
2. **`#stk-detail-popover`** — Stocks card detail panel
   (`popover`, default auto, light-dismiss).

The remaining D11 candidates fall into two groups:

### Group A — Safe migration candidates

| Element | Current pattern | Notes |
| - | - | - |
| News bookmark menu | Custom `<div>` + focus-trap | Trigger button is per-article; auto-dismiss fits the use case. |
| Halacha overlay (`#halacha-overlay`) | `role="dialog" aria-modal="true"` | Modal-style; would need `popover="manual"` and a custom backdrop. |

### Group B — Do NOT migrate

| Element | Why not |
| - | - |
| `#alerts-takeover` (`<dialog>`) | Civil-defense modal — `<dialog>.showModal()` already provides the right semantics + inert backdrop. `popover` would lose the inert behavior. |
| `#refresh-toast`, `#offline-banner` | Opacity-driven transient toasts — `popover` adds UA `display:none` that conflicts with the existing show/hide animation (this is the original Sprint 332 finding from ADR-056). |
| `#diag-overlay`, `#help-overlay`, `#tour-overlay`, `#ecfg-dialog` | Already native `<dialog>` — `popover` would be a downgrade. |
| `#config-overlay` | `role="dialog" aria-modal="true"` div with screen-reader-tested keyboard handling. Migration risk > savings. |

## Decision

- **Bookmark menu** — migrate to `popover="auto"` in v14.x. Low-risk
  per-article popover; existing focus-trap can be removed in the same
  sprint.
- **Halacha overlay** — keep as-is for v14.x. Future migration to
  `popover="manual"` + custom `::backdrop` styling is plausible but
  needs an a11y review against the Hebrew RTL screen-reader path
  (`docs/screen-reader.md`). Not worth the risk for the modest
  benefit.
- **All Group B elements** — explicitly **out of scope** for D11. ADR
  serves as the negative-decision record so the question is not
  re-litigated each release.

## Consequences

- **Pro:** Clear scope for the remaining D11 work — one popover
  migration, not seven.
- **Pro:** Codifies the negative decisions so future contributors do
  not waste a sprint trying to migrate `<dialog>` elements that are
  already correct.
- **Con:** D11 is "partial" until the bookmark migration lands.
  Acceptable — the original ROADMAP target was "diag toasts + bookmark
  menu", and diag toasts proved to be the wrong candidate.

## References

- ROADMAP §1.11 D11
- ADR-056 (Sprint 332 popover= rejection on toasts)
- `src/index.html` lines 822-880 (existing popovers)
- `src/index.html` lines 91-1050 (full overlay inventory)
- `docs/screen-reader.md` (a11y review checklist for any new modal)
