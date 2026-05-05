---
mode: "agent"
description: "Fix accessibility, performance, and non-lint quality issues in FamilyDashBoard. For lint/type errors use /fix-lint instead."
---

# Fix Quality Issues

Scan and fix quality issues that are **not** covered by ESLint or tsc.
For lint/type errors, run `/fix-lint` first.

## Accessibility Fixes

- Add `alt` text to all images
- Ensure sufficient color contrast (WCAG AA) — `npx axe-core` or browser DevTools audit
- Add `aria-label` to interactive elements that lack visible text
- Verify `role="region"` + `aria-labelledby` on every card shell
- RTL: verify `dir="rtl"` is set on `<html>` and not overridden inline

## Performance Fixes

- Add `loading="lazy"` to images/iframes that are below the fold
- Use `DocumentFragment` for batched DOM writes (lists, table rows)
- Check `setInterval` refs are stored and cleared — no anonymous intervals
- Verify `will-change` is only on actively animated elements

## Constraints

- NO feature additions
- NO layout changes
- NO lint suppression — fix root cause
- Run `/fix-lint` after this to catch any regressions
