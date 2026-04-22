# ADR-017 — Lightning CSS Adoption at Build Time

**Date:** 2026-04-22
**Status:** Accepted
**Deciders:** Reuven Airhar
**Tags:** build, css, performance

---

## Context

At v10.0.0 CSS is built via Vite's default pipeline (esbuild for JS, PostCSS + a basic CSS minifier
for CSS). The CSS stack is split across 13 stylesheets under `src/styles/` plus co-located card
CSS files. Total CSS after minification is approximately **52 KB gzip**.

Opportunities:

1. **Autoprefixing** — Vite/PostCSS does _not_ autoprefix by default unless `autoprefixer` is
   configured; we rely on evergreen-browser targets where vendor prefixes are rarely needed,
   but `color-mix()` and `@layer` still occasionally require vendor handling on Safari < 16.4
2. **Better minification** — esbuild's CSS minifier is conservative; Lightning CSS produces
   5–15 % smaller output by merging redundant rules and exploiting modern selector optimisations
3. **Unused-at-rule removal** — Lightning CSS can tree-shake `@keyframe` declarations that are
   never referenced by `animation-name`; several legacy animation names remain in `animations.css`

---

## Decision

Add `lightningcss` as a dev-dependency in `MyScripts/package.json` (parent) and configure Vite
to use it via `css.transformer: 'lightningcss'` + `css.lightningcss.targets` set to our
supported browser matrix (> 0.5%, last 2 versions, not dead).

```ts
// vite.config.ts additions
css: {
  transformer: 'lightningcss',
  lightningcss: {
    targets: browserslistToTargets(browserslist('> 0.5%, last 2 versions, not dead')),
    drafts: { customMedia: true },
  },
},
```

### Rejected alternatives

| Alternative                         | Why rejected                                              |
| ----------------------------------- | --------------------------------------------------------- |
| PostCSS + autoprefixer              | Additional config; slower than Lightning CSS (Rust-based) |
| Stylelint transforms                | Stylelint is a linter, not a transformer                  |
| Stay on esbuild CSS                 | Leaves ~10 % file size on the table; no autoprefixing     |
| Parcel CSS (alias for lightningcss) | Same library, just older API name                         |

---

## Consequences

- **~8–12 % CSS gzip reduction** at build time (estimated from test runs)
- **Autoprefixing included** — no separate PostCSS plugin needed
- Browserslist-driven targets: `lightning/browserslist-rs` converts browserslist queries; requires
  `lightningcss` and `browserslist` packages in parent `MyScripts/package.json`
- Local build plugin (`removeCrossOrigin`) unaffected — operates on HTML, not CSS
- No runtime change — the output is still plain CSS; all themes and token layers preserved
- If a Lightning CSS transform breaks a visual, `css.transformer` can be removed and the
  esbuild default restored in one config line (low risk)
