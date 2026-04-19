---
mode: "agent"
description: "Perform a thorough code review of the FamilyDashBoard TypeScript source. Check security (XSS, unsanitized innerHTML, eval), UI quality (RTL, responsiveness, TV font sizes), API reliability (caching, proxy fallback, error handling), and performance (DOM updates, lazy loading)."
---

# Code Review — FamilyDashBoard

Review the TypeScript source files in `src/` for the following:

## Security

- [ ] No `eval()` or `Function()` usage
- [ ] No `innerHTML` with unsanitized external API data — use `textContent` or `DocumentFragment`
- [ ] No hardcoded API keys or secrets
- [ ] All external links use HTTPS
- [ ] Content Security Policy (`default-src 'self'`) not weakened

## TypeScript Quality

- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] `npx eslint src tests --max-warnings 0` passes (0 warnings)
- [ ] No `@ts-ignore` or `eslint-disable` suppressions
- [ ] Type imports use `import type` for type-only imports

## UI Quality

- [ ] RTL layout intact (`dir="rtl"`)
- [ ] CSS custom properties used — no hardcoded colors
- [ ] 6 themes covered: black · blue · matrix · amber · purple · rose
- [ ] Font sizes readable on TV from 3m distance
- [ ] New CSS rules in correct `@layer` (tokens → themes → base → layout → components → animations)
- [ ] No duplicate CSS selectors

## API Reliability

- [ ] All fetches use `fetchWithTimeout()` + try/catch + proxy fallback (`PROXIES`)
- [ ] All responses cached via `cSet`/`cGet`/`cGetStale`
- [ ] Sync indicators update on every exit path (`setSync`)
- [ ] `if (!_pageVisible) return;` guard at top of all async loaders
- [ ] Fetch locks (`acquireLock`/`releaseLock`) where needed

## Performance

- [ ] DOM updates use `DocumentFragment` for batch writes
- [ ] `contain: layout style` on cards
- [ ] `will-change` on animated elements only
- [ ] No memory leaks (intervals use `setInterval` reference, no growing arrays)

## Tests

- [ ] `npx vitest run` passes (0 failures)
- [ ] New code has corresponding test in `tests/unit/`

Report: Critical issues first, then warnings, then suggestions.
