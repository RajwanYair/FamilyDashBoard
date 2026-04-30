# ADR-037 — View Transitions Level 2 (Cross-Document) Opt-In

| Field        | Value                                                                          |
| ------------ | ------------------------------------------------------------------------------ |
| **Date**     | 2026-04-25                                                                     |
| **Status**   | Accepted                                                                       |
| **Sprint**   | 120 (opt-in shipped) / 270 (ADR formalised to fill numbering gap)              |
| **Deciders** | @RajwanYair                                                                    |
| **Tags**     | css, transitions, progressive-enhancement, v14-foundations                     |
| **Supersedes** | n/a                                                                          |
| **Related**  | ADR-036 (WebRTC mirror), ADR-008 (CSS layer governance), Roadmap 1.2           |

---

## Context

FamilyDashBoard is a static single-page app deployed on GitHub Pages. All
navigation happens within a single HTML document — there is no traditional
multi-page routing. However, the v13.13 release added a **Cross-Document
View Transitions Level 2** opt-in via `@view-transition { navigation: auto; }`
in the CSS layer stack. This ADR was omitted from the sequential numbering at
the time of implementation; this document retroactively records the decision
to fill the numbering gap between ADR-036 and ADR-038.

## Decision

Add the following CSS opt-in to `src/styles/transitions.css` inside the
`@layer transitions` block:

```css
@view-transition {
  navigation: auto;
}
```

This is a **progressive enhancement**: browsers that do not support the
`@view-transition` at-rule simply ignore it. No JavaScript is required.
The opt-in enables animated transitions between same-origin navigations when
the user opens external links and returns (e.g. article links in the news
card), giving a native-feeling back-navigation animation in Chrome 111+/Edge
111+/Safari 18+.

## Rationale

| Option                                         | Verdict  | Reason                                              |
| ---------------------------------------------- | -------- | --------------------------------------------------- |
| JavaScript-driven View Transitions Level 1     | Rejected | Requires JS orchestration; incompatible with card transitions already in use |
| CSS `@view-transition { navigation: auto }` (chosen) | Accepted | Zero JS, progressive enhancement, spec-compliant, Baseline 2024 Widely Available |
| No transition                                  | Rejected | Suboptimal UX on supported browsers for zero additional cost |

## Consequences

- **Positive**: Native animated back-navigation on Chromium/WebKit 2024+.
- **Positive**: Zero JS, zero runtime cost, zero bundle impact.
- **Negative**: Feature behaves as no-op on Firefox until cross-document VT lands.
- **Neutral**: `@starting-style` for `<dialog>` (ADR note in Sprint 9) pairs well
  with this — both are in the `@layer animations` / `@layer transitions` layers.
