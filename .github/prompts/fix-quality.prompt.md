---
mode: "agent"
description: "Fix linting issues, accessibility problems, security warnings, and performance issues in the FamilyDashBoard. Applies fixes without changing features or layout."
---

# Fix Quality Issues

Scan and fix quality issues in `BestDashBoard.html`:

## Fix Categories

### Security Fixes

- Replace any `innerHTML` used with external API data → `textContent`
- Remove any `eval()` usage
- Ensure all API URLs use HTTPS

### Accessibility Fixes

- Add `alt` text to all images
- Ensure sufficient color contrast (WCAG AA)
- Add `aria-label` to interactive elements if missing

### Performance Fixes

- Add `loading="lazy"` to images/iframes missing it
- Ensure DOM updates compare before setting values
- Check for memory leaks in setInterval patterns

### Code Quality Fixes

- Normalize inconsistent spacing/indentation (2 spaces)
- Replace any hardcoded colors → CSS custom properties
- Remove any dead/unreachable code

## Constraints

- NO feature additions
- NO layout changes
- NO API changes
- Only fix existing issues
