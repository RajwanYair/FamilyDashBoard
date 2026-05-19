# ADR-062: D9 — CSS `if()` and `@function` for Theme-Token Compression (Track)

- **Status**: Partial (v14.19.0 @supports-gated --theme identifier + if() proof-of-concept; @function sketch updated for 7 themes; full migration deferred until Baseline 2026)
- **Date**: 2026-05-03 (v13.36.0 patch series)
- **Sprints**: 345
- **Related**: ADR-014 (theme system), ROADMAP §1.11 D9, §5.1 themes

## Context

The dashboard ships **7 themes** (black, blue, matrix, amber, purple,
rose, high-contrast) implemented as `body.theme-<name>` selectors over a
base set of ~40 CSS custom properties (`--accent`, `--bg`, `--fg`,
etc.). Each theme block today is approximately 40 lines of `--name:
value;` declarations — seven near-identical blocks total.

CSS `if()` (CSS Values L5) and `@function` (CSS Functions L1) would
collapse these to a single declarative table:

```css
@function --accent() {
  return if(theme(matrix), #0f0; theme(amber), #ffb000; #7c5cff);
}
```

Bundle estimate: theme block compresses from ~1.8 KB to ~0.6 KB raw
(~0.3 KB gzip). Modest savings but materially cleaner authoring.

## Decision

**Track** D9. Do **not** adopt yet. Conditions to adopt:

1. CSS `if()` reaches **Baseline 2026** (Chrome + Firefox + Safari all
   shipping stable for two release cycles).
2. CSS `@function` reaches the same milestone.
3. The tooling pipeline can lint `@function` declarations
   (Stylelint plugin available in the parent `MyScripts/tooling/`).
4. A measured bundle delta of ≥ 1 KB gzip in `src/styles/theme.css`
   justifies the migration cost.

Until then, the existing six theme blocks remain authoritative. They
live behind `@layer themes` (per ADR-014) so future migration is
isolated to a single layer.

## Consequences

- **Pro (when adopted):** Single source of truth per token; adding a
  seventh theme means editing one row per token, not a full block.
- **Pro (when adopted):** ~0.3 KB gzip CSS savings; modest but free.
- **Con (today):** Browser support is currently Chrome-only (137+).
  Adopting now would create a dual-codepath maintenance burden.
- **Con (today):** Stylelint cannot validate `@function` syntax in the
  current parser; manual review only.

## Migration Sketch (when adopted)

1. Add `@function --token()` declarations into `src/styles/theme.css`
   under `@layer themes`.
2. Keep the existing `body.theme-<name>` blocks as fallback inside an
   `@supports not (top: if(true; 0; 0))` wrapper.
3. Bundle-size CI check confirms ≥ 1 KB gzip delta before the fallback
   is removed.
4. Stylelint config in `tooling/eslint/` (parent) gains the
   `at-function` rule once available.

## References

- ROADMAP §1.11 D9
- CSS Values L5 (`if()`): <https://www.w3.org/TR/css-values-5/#if-function>
- CSS Functions L1 (`@function`): <https://www.w3.org/TR/css-mixins-1/>
- ADR-014 (theme system, `@layer themes` architecture)
