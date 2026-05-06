## Description

<!-- What does this PR do and why? Reference any issue numbers with "Closes #123" to auto-close. -->

Closes #

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 💥 Breaking change (change that would break existing functionality)
- [ ] 🎨 UI/Design change (layout, colors, fonts, responsiveness)
- [ ] 🔌 API integration (new data source, proxy, or feed)
- [ ] 📖 Documentation update
- [ ] ⚙️ CI/CD change
- [ ] 🧪 Test changes

## Changes Made

<!-- List specific changes by file or section -->

-

## Testing

- [ ] `npx vitest run` — 0 failures (baseline: 6387 / 214 suites)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx eslint src tests --max-warnings 0` — 0 warnings
- [ ] Tested in Chrome (desktop full-screen, 1920×1080)
- [ ] RTL Hebrew layout verified
- [ ] All relevant cards load correctly
- [ ] No `console.log` left in `src/` (use `diagLog()`)

## Quality Checklist

- [ ] No hardcoded API keys or secrets
- [ ] No `eval()` or `innerHTML` with unsanitized data — use `textContent`
- [ ] No hardcoded colors — uses CSS custom properties (`--accent`, etc.)
- [ ] No external JS/CSS libraries or CDN dependencies added (zero-dep rule)
- [ ] All async loaders have `if (!_pageVisible) return;` guard
- [ ] All fetches: try/catch + proxy fallback + `diagLog()`
- [ ] All API data: `cSet`/`cGet`/`cGetStale` dual-layer cache
- [ ] New cards registered in `src/core/card-registry.ts`
- [ ] New overlays use `<dialog>` + `showModal()` / `close()`
- [ ] New CSS rules go in the correct `@layer` (tokens/themes/base/layout/components/animations)
- [ ] Dev deps go in `MyScripts/package.json`, never in `FamilyDashBoard/package.json`
- [ ] No `eslint-disable`, `@ts-ignore`, or `@ts-expect-error` added

## Screenshots

<!-- If this is a visual change, add before/after screenshots. TV-readable font size (≥18px). -->

## Copilot Review

<!-- Optional: request Copilot review by adding @github-copilot as a reviewer or commenting "@github-copilot review" below. -->
