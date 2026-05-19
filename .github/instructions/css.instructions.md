---
applyTo: "src/styles/**/*.css,src/cards/**/*.css,src/ui/**/*.css"
description: "Use when: editing CSS files in src/styles/, src/cards/, or src/ui/. CSS architecture rules, layer order, custom properties, and TV-display conventions."
---

# CSS Conventions — FamilyDashBoard

## Layer Order (strict — never reorder)

```text
@layer tokens, themes, base, layout, components, animations
```

New rules must go into the appropriate layer. Never add rules outside a layer.

## Custom Properties

- **All colors** via CSS custom properties defined in `src/styles/tokens.css`. Never hardcode `#hex`, `rgb()`, or `hsl()` values.
- **Accent colors**: `--accent`, `--accent-light`, `--accent-dark`
- **Backgrounds**: `--bg-primary`, `--bg-card`, `--bg-card-hover`
- **Text**: `--text-primary`, `--text-secondary`, `--text-muted`
- **Theme variants** use `body[data-theme="black"]` / `blue` / `matrix` / `amber` / `purple` / `rose` selectors scoped inside the `themes` layer.

## Themes (7 total — see ADR-074 for high-contrast addition)

```text
black · blue · matrix · amber · purple · rose · high-contrast
```

All theme tokens must be defined in `src/styles/tokens.css` inside the `themes` layer.

## RTL First

FamilyDashBoard is Hebrew RTL. The layout is `dir="rtl"` `lang="he"`.

- Use `inset-inline-start` / `inset-inline-end` instead of `left` / `right`
- Use `margin-inline-start` / `margin-inline-end` instead of `margin-left` / `margin-right`
- Use `text-align: start` not `text-align: right`
- Icons implying direction (arrows) may need `transform: scaleX(-1)` under `[dir="ltr"]`

## TV Display Rules

FamilyDashBoard targets 1920×1080+ always-on TV displays.

- Minimum font size: `1rem` for data, `0.85rem` for labels — never smaller
- Prefer `rem` over `px` in components (respects `+/-` font-size keyboard shortcuts)
- Never use `pointer: fine` media queries for hover-only interactions — TV has no pointer
- Card tiles must be legible from 2–3 m: use high contrast, large text, `--accent` colors

## Card Tile Layout (Rule 25 from copilot-instructions.md)

Card content must use rectangular tile/grid blocks — never plain vertical line lists.

```css
/* ✅ Correct — grid of self-contained tiles */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-md);
}

/* ❌ Wrong — plain list */
.card-list {
  display: flex;
  flex-direction: column;
}
```

Exception: sequential content (news feed, stock rows).

## Stock Column Widths

Use `width` + `flex-shrink: 0` for stock table columns — never `min-width`:

```css
/* ✅ */
.stock-col-symbol {
  width: 6ch;
  flex-shrink: 0;
}

/* ❌ */
.stock-col-symbol {
  min-width: 6ch;
}
```

## Animation

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    transition: none;
  }
}
```

Animation rules belong in the `animations` layer.

## No Duplicate Selectors

Never duplicate a CSS selector — merge properties into the first occurrence.
CI runs a duplicate-selector check that will fail on violations.

## Breakpoints

FamilyDashBoard targets full-screen TV. Do not add mobile breakpoints unless
explicitly required by a 3-screen-mode feature. Screen modes are handled via
`body[data-screen-mode="compact"]` / `standard` / `spacious`.

## Extension Integration

- **Stylelint** (`stylelint.vscode-stylelint`): diagnostics surface in `get_errors` — use it to verify layer order, custom-property usage, and no-hardcoded-colors compliance before terminal lint.
- **Baseline Lens** (`kwesinavilot.baseline-lens`): inline CSS compat annotations — verifies feature availability against `.browserslistrc` targets (Chrome 114+, Firefox 128+, Safari 17.4+).
- **Color Highlight** (`naumovs.color-highlight`): visually reveals hardcoded colors that should be CSS custom properties — user sees them inline, Copilot can skip grepping for hex values.
- **Error Lens** (`usernamehw.errorlens`): shows Stylelint errors inline in the editor — user already sees issues, Copilot confirms via `get_errors`.
- **TODO Tree** (`gruntfuggly.todo-tree`): tracks `TODO`, `FIXME` comments in CSS files — use for pre-release cleanup audits.
