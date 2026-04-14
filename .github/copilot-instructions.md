# GitHub Copilot Instructions — FamilyDashBoard v7.0

> TypeScript modular TV dashboard (`src/`) · Hebrew RTL · 6 Themes · Vite 8 + TS 5.9 + Vitest 4
> **All tools installed at parent `MyScripts/`** — run `npm install` from `MyScripts/`, never here
> No local `package-lock.json` or `devDependencies` in `FamilyDashBoard/package.json`
> Tests: `npx vitest run` — 1390+ / 37 suites / 0 failures
> Lint: `npx eslint src tests --max-warnings 0` — 0 errors · 0 warnings · 0 suppressions

## Mandatory Rules

1. No external JS/CSS libraries or CDNs — zero runtime dependencies
2. No hardcoded colors — use CSS custom properties (`--accent`, etc.)
3. No `innerHTML` with unsanitized data — use `textContent`
4. No sync try/catch on async loaders — use `await` + `safeLoad()`
5. No `self.skipWaiting()` in SW install — only via `SKIP_WAITING` message
6. All async loaders: `if (!_pageVisible) return;` guard at top
7. All fetches: try/catch + proxy fallback (`PROXIES`) + `diagLog()`
8. All API data: `cSet`/`cGet`/`cGetStale` dual-layer cache
9. DOM refs in `el` object — no repeated `getElementById`
10. No duplicate CSS selectors — merge properties into the first occurrence
11. Verify function names before wiring (`loadAllStocks()` not `loadStocks()`)
12. `_tempUnit` = `'C'`/`'F'` (NOT `_useFahrenheit`)
13. Stock columns: `width` + `flex-shrink: 0` (NOT `min-width`)
14. Grep `id="X"` in HTML before keeping any loader — dead elements = dead code
15. Dev deps go in `MyScripts/package.json` (parent) — **never** add `devDependencies` to `FamilyDashBoard/package.json`

## Key Names & Gotchas

| Wrong | Correct |
|-------|---------|
| `loadStocks()` | `loadAllStocks()` |
| `_useFahrenheit` | `_tempUnit` (`'C'`/`'F'`) |
| `getCachedData()` | `cGet(key, TTL)` |
| `setCachedData()` | `cSet(key, data)` |
| `setSyncStatus()` | `setSync(id, state)` |

## v7.0 Rules (alpha)

16. Card registry: `registerCard()` / `getCard()` in `src/core/card-registry.ts` — new cards must be registered here
17. New overlays: use `<dialog>` + `showModal()` / `close()` — not `<div>` visibility toggling
18. CSS architecture: `@layer tokens, themes, base, layout, components, animations` — add new rules to correct layer
19. Worker fetch: prefer `fetchJSONWithWorker<T>()` when `isWorkerEnabled()` — fallback to proxy chain otherwise
20. Themes: 6 total — dark · ocean · forest · warm · high-contrast · rose (ThemeName union in `types/config.ts`)
21. After each sprint/set of changes: `git add -A && git commit -m "feat|fix|chore: <description>"` before proceeding to the next sprint
22. `cGet()` and `cGetStale()` return `null` (not `undefined`) for cache misses — always check `!== null`, never `!== undefined`
23. `dist/` is built with `--base ./` for `file://` access; `removeCrossOrigin` Vite plugin strips `crossorigin` attrs
24. After **every** Copilot chat session: commit with `git add -A && git commit -m "chore: <session summary>"` before closing
