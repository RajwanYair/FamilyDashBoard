# ADR-022: CSS `@scope` for Per-Card Style Isolation

**Date:** 2026-04-23
**Status:** Accepted
**Deciders:** Project maintainer
**Supersedes:** Nothing — additive
**Context:** V12-MODERNISE-5b

---

## Context

FamilyDashBoard has 12 cards, each with its own CSS file (e.g. `weather.css`,
`stocks.css`). Rules in those files are scoped by convention through class-name
prefixes (`wx-*`, `stk-*`, `cur-*`, etc.). This convention works but:

1. **It is a social contract, not a technical constraint.** A mistyped prefix causes
   silent cross-card style bleed.
2. **Specificity skirmishes** arise when global `components.css` and per-card sheets
   both target the same element without a shared specificity model.
3. **Shadow DOM** (ADR-001) was rejected precisely because it breaks the global `@layer`
   theming. CSS `@scope` provides the same isolation benefit _inside_ the existing
   `@layer` cascade — without any Shadow DOM overhead.

The **CSS `@scope` rule** (`@scope (<selector>)`) landed in all major engines in
2024–2025. It scopes a block of CSS rules to a subtree rooted at the `<selector>`,
with proximity-based cascade semantics: a scoped rule wins over an equally specific
unscoped rule in the same `@layer` when both apply to the same element.

---

## Decision

**Wrap each card's inner CSS rules in `@scope ([data-card-id="..."])` inside a
new `@layer components` block in a dedicated `src/styles/scope.css` file.**

The approach is **additive**:

- Existing per-card CSS files are left intact (they continue to work in all browsers).
- `scope.css` adds stronger cascade containment for browsers that support `@scope`.
- No functional change — only specificity containment.

Scoping is by `data-card-id` attribute (already present on every `.card` wrapper)
rather than a numeric `id` to avoid binding CSS to potentially-clashing ID specificity.

---

## Implementation

`src/styles/scope.css` — imported by `main.ts` after existing card CSS.

Example:

```css
@layer components {
  @scope ([data-card-id="weather"]) {
    .wx-wind-dir { ... }
    .wx-sky-pill { ... }
  }
  @scope ([data-card-id="stocks"]) {
    .stk-row { ... }
  }
  /* ... 12 cards total */
}
```

For the initial ship, each card gets an `@scope` block that contains only its
**most-specific selectors** (the ones that have historically leaked or collided).
A full migration of all card rules is a v12.1 follow-up.

---

## Consequences

**Good:**

- Cross-card style bleed becomes structurally impossible inside the scoped blocks.
- Developers get a clear declaration of "these rules belong to this card" in the cascade.
- Zero runtime cost — `@scope` is a CSS parsing hint, not a JS wrapper.

**Neutral:**

- Browsers without `@scope` support (Firefox < 117, Safari < 17.4) fall back to the
  unscoped rules in per-card CSS files — identical behaviour to today.
- Full migration of all card rules to `@scope` is deferred to v12.1.

**Bad:**

- Two sources of truth for card styles during the migration window (per-card `.css` +
  `scope.css`). Addressed in v12.1 when per-card files are merged into `@scope` blocks.

---

## Alternatives considered

| Option | Verdict |
| --- | --- |
| Shadow DOM for isolation | Rejected (ADR-001 — breaks global `@layer` theming) |
| CSS Modules | Rejected — requires build-time class mangling, incompatible with our runtime DOM refs |
| BEM naming (`.card__weather__wind-dir`) | Rejected — verbose, still social contract, no cascade containment |
| Full `@scope` migration in one sprint | Deferred — too large; additive approach ships faster |

---

## References

- CSS Scoping Level 1 spec: <https://drafts.csswg.org/css-cascade-6/#scope-atrule>
- Browser compat: Chrome 117+, Safari 17.4+, Firefox 117+
- ADR-001 (Shadow DOM rejected)
- ADR-008 (CSS layer governance)
