---
mode: "agent"
description: "Perform a thorough code review of the FamilyDashBoard. Check security (XSS, unsanitized innerHTML, eval), UI quality (RTL, responsiveness, font sizes for TV), API reliability (caching, proxy fallback, error handling), and performance (DOM updates, lazy loading)."
---

# Code Review — FamilyDashBoard

Review the dashboard HTML file for the following:

## Security
- [ ] No `eval()` or `Function()` usage
- [ ] No `innerHTML` with unsanitized external API data
- [ ] No hardcoded API keys or secrets
- [ ] All external links use HTTPS
- [ ] No inline event handlers (`onclick`, etc.)

## UI Quality
- [ ] RTL layout intact (`dir="rtl"`)
- [ ] CSS custom properties used (no hardcoded colors)
- [ ] Font sizes readable on TV from 3m distance
- [ ] Responsive at 1920x1080, 1024px, 768px, 480px
- [ ] Glassmorphism effects render correctly
- [ ] Emoji icons display properly

## API Reliability
- [ ] All fetch calls have try/catch
- [ ] Proxy fallback mechanism for each API
- [ ] Cache used for all API responses
- [ ] Sync indicators update correctly (syncing → success/error)
- [ ] Staggered stock requests to avoid rate limits

## Performance
- [ ] DOM updates compare before setting (`.textContent` check)
- [ ] Images use `loading="lazy"`
- [ ] `will-change` hint on animated elements
- [ ] No memory leaks (intervals cleaned, no growing arrays)

Report: Critical issues first, then suggestions.
