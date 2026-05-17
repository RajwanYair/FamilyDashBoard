# ADR-080: CSS `if()` and `@function` — Adopt v15.0.0 Timeline Confirmation

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| **Date**     | 2026-06-20                                                |
| **Status**   | Accepted                                                  |
| **Deciders** | @RajwanYair                                               |
| **Tags**     | css, themes, bundle, v15, track                           |
| **Related**  | ADR-062 (original track decision), ADR-014 (theme system) |

---

## Context

[ADR-062](ADR-062-css-if-function-tracking.md) deferred adoption of CSS
`if()` and `@function` until **Baseline 2026** with four criteria:

1. CSS `if()` reaches Baseline 2026 (Chrome + Firefox + Safari stable).
2. CSS `@function` reaches the same milestone.
3. A Stylelint plugin for `@function` is available in `tooling/`.
4. Measured bundle delta ≥ 1 KB gzip in `src/styles/theme.css`.

**v14.24.0 audit (2026-06-20):**

| Criterion                | Status                                             |
| ------------------------ | -------------------------------------------------- |
| CSS `if()` Baseline      | ❌ Chrome 137+ only; Firefox + Safari not shipping |
| CSS `@function` Baseline | ❌ Draft in CSS Functions L1; no implementation    |
| Stylelint plugin         | ❌ No published plugin for `@function`             |
| Bundle delta ≥ 1 KB gzip | ✅ Estimated ~0.3 KB gzip — threshold not met      |

None of the four criteria are satisfied as of v14.24.0.

## Decision

**Confirm HOLD. Revise adoption gate to v15.0.0 (≥ 2027-Q1).**

Maintain the six existing theme blocks under `@layer themes`. Do not
introduce dual-codepath `@supports`-gated CSS `if()` branches in this
release cycle — the maintenance overhead exceeds the 0.3 KB gzip gain.

Adoption is re-triggered by **all four criteria being met simultaneously**.
The earliest realistic date is when Firefox 142+ and Safari 19+ both ship
`if()` in stable release (estimated H2 2026 per CSS WG charter).

## Consequences

- **No change to `src/styles/theme.css`** in v14.x.
- **Track** continues via [ROADMAP §5.1 D9](../ROADMAP.md).
- When criteria are met, migration scope is `src/styles/theme.css` only
  (isolated in `@layer themes` per ADR-014 — no card-level changes).
- Bundle reduction when adopted: ~0.3 KB gzip CSS (minor; justifies
  cleaner authoring rather than performance goal).
