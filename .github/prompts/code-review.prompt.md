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

## UI Quality
- [ ] RTL layout intact (`dir="rtl"`)
- [ ] CSS custom properties used (no hardcoded colors)
- [ ] Font sizes readable on TV from 3m distance
- [ ] Responsive at 1920x1080, 1024px, 768px, 480px
- [ ] Glassmorphism effects render correctly
- [ ] Emoji icons display properly

## API Reliability
- [ ] All fetch calls have try/catch + proxy fallback (`PROXIES`)
- [ ] All responses cached via `cSet`/`cGet`/`cGetStale`
- [ ] Sync indicators update on every exit path (`setSync`)
- [ ] `fetchWithTimeout()` used (not bare `fetch`) for proxied APIs
- [ ] `safeLoad()` wrapper + `_pageVisible` guard on all async loaders
- [ ] Fetch locks (`acquireLock`/`releaseLock`) where needed

## Performance
- [ ] DOM updates use DocumentFragment for batch writes
- [ ] `contain: layout style` on cards
- [ ] `will-change` on animated elements
- [ ] No memory leaks (intervals cleaned, no growing arrays)

Report: Critical issues first, then suggestions.
