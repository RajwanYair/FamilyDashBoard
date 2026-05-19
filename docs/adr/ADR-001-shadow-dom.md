# ADR-001: No Shadow DOM in FdbCard

**Date:** 2026-04-17
**Status:** Accepted
**Deciders:** Project maintainer

---

## Context

`FdbCard extends HTMLElement` was introduced as a Web Component base class for card instances (v7.11). The question arose whether to adopt Shadow DOM for style encapsulation.

Web Components traditionally use Shadow DOM (`this.attachShadow({ mode: 'open' })`) to isolate component CSS from the document.

---

## Decision

**Do not adopt Shadow DOM by default in FdbCard or any card subclass.**

Cards use global CSS from the document stylesheet. No `attachShadow()` calls.

---

## Rationale

1. **Global theming** — The dashboard has 7 themes applied via `[data-theme]` CSS vars on `<html>`. Shadow DOM creates an encapsulation boundary that breaks `:root` / `[data-theme]` token inheritance without explicit `adoptedStyleSheets` plumbing.
2. **Cross-card layout** — Cards are positioned by the parent grid system. Shadow DOM does not help and creates slot/slotted complexity with no benefit.
3. **Typography uniformity** — RTL Hebrew typography depends on global `font-family` and `direction: rtl` set at the document level. Shadow DOM would require duplicating this in each card's shadow root.
4. **Diagnostics and testing** — Global `querySelectorAll` is used in tests and the diagnostic overlay. Shadow DOM piercing requires `shadowRoot.querySelector` on each element, adding test complexity.
5. **No clear encapsulation win** — This is a closed, single-deployable dashboard, not a reusable component library. The encapsulation cost outweighs its benefit here.

---

## Consequences

- FdbCard subclasses render children as regular DOM children (`this.append(...)`, `this.innerHTML = ...`).
- Cards remain visible to global CSS and test utilities.
- Inter-card layout and theme tokens work without adapter code.
- This decision should be revisited if FdbCard cards are ever published as standalone reusable components.

---

## Alternatives Considered

- **Full Shadow DOM adoption**: rejected — see rationale above.
- **Constructable Stylesheets with `adoptedStyleSheets`**: partial mitigation but adds complexity disproportionate to the benefit.
