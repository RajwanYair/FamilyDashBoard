# CLAUDE.md — FamilyDashBoard v7.17.0

> Context file for Claude Code / Claude agents. Lean project brief — see `.github/instructions/` for scoped details.

## Project

TypeScript modular TV dashboard (`src/`) built with Vite.
Hebrew RTL, dark glassmorphism, 6 themes, always-on 1920×1080 display.
Legacy single-file dashboard (`BestDashBoard.html`) is preserved but inactive.

## Stack

- TypeScript 5.9 + Vite 8 + Vitest 4 (happy-dom)
- ESLint 10 + typescript-eslint 8 (0 errors · 0 warnings · no suppressions)
- **All tools installed at parent `MyScripts/`** — run `npm install` from `MyScripts/`, never here
- No local `package-lock.json` or `devDependencies` in this project
- Tests: `npx vitest run` (2562+ tests, 56 suites, 0 failures)
- SW: `sw.js` v7.17.0 (offline + API cache)

## Key Rules

1. No external JS/CSS libraries or CDNs
2. No `innerHTML` with unsanitized data — use `textContent`
3. No hardcoded colors — use CSS custom properties
4. All async loaders: `safeLoad()` + `if (!_pageVisible) return;`
5. All fetches: try/catch + proxy fallback (`PROXIES` array) + `diagLog()`
6. All API data: `cSet`/`cGet`/`cGetStale` cache
7. DOM refs in `el` object — no repeated `getElementById`
8. `_tempUnit` = `'C'`/`'F'` (not `_useFahrenheit`)
9. Stock function = `loadAllStocks()` (not `loadStocks()`)
10. All tools/devDeps live in `MyScripts/package.json` (parent) — never add `devDependencies` here
11. 6 themes: black · blue · matrix · amber · purple · rose
12. Card registry: `registerCard()` / `getCard()` — use `src/core/card-registry.ts` for new card wiring
13. New overlays use `<dialog>` + `showModal()` / `close()` — not `<div>` with `display:block`
14. `dist/` built with `--base ./` + `removeCrossOrigin` plugin for `file://` compatibility
15. After every Copilot session: `git add -A && git commit -m "chore: <session summary>"`
16. Icons/manifests go in `src/public/` (Vite static dir) — NOT `src/assets/` (fingerprinted)
17. Hebrew date: `Intl.DateTimeFormat('he-u-ca-hebrew', {...})` — never compute manually
18. GitHub Actions: `actions/checkout@v4`, `actions/setup-node@v4` — **not** @v5/@v6
19. Static PWA — no auth. No server/backend. Google/Facebook/Apple sign-in: NOT applicable.
20. Card layout: bordered tile/grid blocks — not vertical lists (except news/stock rows)

## File Map

```text
src/                   # TypeScript v7 modular source (Vite build)
src/public/            # Vite static dir — icon.svg, manifest.webmanifest
tests/unit/            # Vitest — 2571+ tests / 56 suites
sw.js                  # ServiceWorker v7.17.0
manifest.json          # PWA manifest (root copy)
icon.svg               # App icon (root copy)
BestDashBoard.html     # Legacy v5 dashboard (read-only, archived)
```

## Architecture

- **Cache**: in-memory Map + localStorage (prefix `dash_v2_`, 7-day eviction)
- **Fetch**: direct → allorigins → codetabs → corsproxy.io
- **Refresh**: per-pane setInterval (no full-page reload)
- **Performance**: GPU layers, CPU-aware concurrency, `scheduleIdle()`, DocumentFragments

## Commands

```bash
npx vitest run                          # tests
npx vitest run --coverage               # coverage
npx eslint src tests --max-warnings 0   # lint (must be 0)
npx markdownlint-cli2 "**/*.md"         # markdown lint
npx tsc --noEmit                        # type-check
npx vite build                          # production build
npm run check                           # all of the above
```

## Release

Tag `vX.Y.Z` → GitHub Actions auto-releases + deploys to Pages.
