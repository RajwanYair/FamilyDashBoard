# ADR-008: CSS Layer Governance

**Date:** 2026-07-10
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

FamilyDashBoard uses a `@layer` cascade to control CSS specificity across tokens, themes, base resets, layout, components, and animations. Without documented governance, contributors add rules to the wrong layer or create duplicate selectors, causing specificity conflicts that are hard to debug on the TV display.

---

## Decision

**Enforce a strict six-layer CSS architecture: `@layer tokens, themes, base, layout, components, animations`.**

Layer responsibilities:

| Layer | File(s) | Purpose |
|---|---|---|
| `tokens` | `tokens.css` | Custom property definitions — colors, spacing, radii, fonts |
| `themes` | `themes.css` | Per-theme token overrides (6 themes: black, blue, matrix, amber, purple, rose) |
| `base` | `base.css`, `a11y.css`, `scroll.css` | Element resets, focus styles, scroll behavior |
| `layout` | `layout.css`, `screen-modes.css` | Grid/flexbox page skeleton, responsive breakpoints, screen modes |
| `components` | `components.css`, `config-panel.css`, `diag-overlay.css`, `print.css`, `sprints.css`, `maximize.css` | Card shells, overlays, UI widgets |
| `animations` | `animations.css` | `@keyframes` and `animation:` declarations only |

### Enforcement Rules

1. No hardcoded color values — use `var(--token)` exclusively.
2. No duplicate CSS selectors — merge into the first declaration in the correct layer.
3. Theme overrides go in `themes.css` inside the corresponding `[data-theme="name"]` block, never in component files.
4. `@keyframes` are always in `animations.css`, never inline in components.
5. New overlays use `<dialog>` elements; their CSS goes in `components.css` or a dedicated overlay file.
6. Print overrides go in `print.css` inside `@media print`.

---

## Rationale

1. **Predictable cascade** — `@layer` removes specificity battles: a `.card` rule in `components` can never accidentally override a `base` reset, regardless of selector weight.
2. **TV readability** — the 1920×1080 display has zero tolerance for unintended style bleeds; clear layer boundaries prevent surprises.
3. **Maintainability** — contributors know exactly which file to edit for any visual change.

---

## Consequences

- ESLint/Stylelint rules should flag `color:` declarations with raw hex values outside `tokens.css` or `themes.css`.
- Code review must reject any PR that adds a duplicate CSS selector instead of merging into the existing declaration.
