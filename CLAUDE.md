# CLAUDE.md — FamilyDashBoard v5.1.0

> Context file for Claude Code / Claude agents. Lean project brief — see `.github/instructions/` for scoped details.

## Project

Single-file family TV dashboard (`BestDashBoard.html`) — HTML + CSS + JS in one file.
Hebrew RTL, dark glassmorphism, 5 themes, zero dependencies, always-on 1920×1080 display.

## Stack

- HTML5 + CSS3 + vanilla JS (ES2020+)
- No npm, no build tools, no frameworks
- Tests: `node --test tests/dashboard.test.mjs` (1084 tests, 61 suites)
- SW: `sw.js` v5.0.0 (offline + API cache)

## Key Rules

1. No npm/build/external libraries
2. No `innerHTML` with unsanitized data — use `textContent`
3. No hardcoded colors — use CSS custom properties
4. All async loaders: `safeLoad()` + `if (!_pageVisible) return;`
5. All fetches: try/catch + proxy fallback (`PROXIES` array) + `diagLog()`
6. All API data: `cSet`/`cGet`/`cGetStale` cache
7. DOM refs in `el` object — no repeated `getElementById`
8. Run `node --check` + ESLint after JS edits
9. `_tempUnit` = `'C'`/`'F'` (not `_useFahrenheit`)
10. Stock function = `loadAllStocks()` (not `loadStocks()`)

## File Map

```text
BestDashBoard.html   # The dashboard (HTML+CSS+JS)
sw.js                # ServiceWorker
manifest.json        # PWA manifest
icon.svg             # App icon
tests/dashboard.test.mjs  # 1084 tests
```

## Architecture

- **Cache**: in-memory Map + localStorage (prefix `dash_v2_`, 7-day eviction)
- **Fetch**: direct → allorigins → codetabs → corsproxy.io
- **Refresh**: per-pane setInterval (no full-page reload)
- **Performance**: GPU layers, CPU-aware concurrency, `scheduleIdle()`, DocumentFragments

## Release

Artifacts: `BestDashBoard.html` + `sw.js` + `manifest.json` + `icon.svg` (no binaries).
Tag `vX.Y.Z` → GitHub Actions auto-releases + deploys to Pages.
