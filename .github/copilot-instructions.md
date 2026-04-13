# GitHub Copilot Instructions — FamilyDashBoard v5.1.0

> Single-file TV dashboard (`BestDashBoard.html`) · Hebrew RTL · 5 Themes · Zero Dependencies
> Tests: `node --test tests/dashboard.test.mjs` — 1084 / 61 / 0

## Mandatory Rules

1. No npm/build tools — zero-dependency project
2. No external JS/CSS libraries or CDNs
3. No hardcoded colors — use CSS custom properties (`--accent`, etc.)
4. No `innerHTML` with unsanitized data — use `textContent`
5. No sync try/catch on async loaders — use `await` + `safeLoad()`
6. No `self.skipWaiting()` in SW install — only via `SKIP_WAITING` message
7. All async loaders: `if (!_pageVisible) return;` guard at top
8. All fetches: try/catch + proxy fallback (`PROXIES`) + `diagLog()`
9. All API data: `cSet`/`cGet`/`cGetStale` dual-layer cache
10. DOM refs in `el` object — no repeated `getElementById`
11. Run `node --check` + ESLint after JS edits
12. No duplicate CSS selectors — merge properties into the first occurrence
13. Verify function names before wiring (`loadAllStocks()` not `loadStocks()`)
13. `_tempUnit` = `'C'`/`'F'` (NOT `_useFahrenheit`)
14. Stock columns: `width` + `flex-shrink: 0` (NOT `min-width`)
15. Grep `id="X"` in HTML before keeping any loader — dead elements = dead code

## Key Names & Gotchas

| Wrong | Correct |
|-------|---------|
| `loadStocks()` | `loadAllStocks()` |
| `_useFahrenheit` | `_tempUnit` (`'C'`/`'F'`) |
| `getCachedData()` | `cGet(key, TTL)` |
| `setCachedData()` | `cSet(key, data)` |
| `setSyncStatus()` | `setSync(id, state)` |

## Upcoming

| Version | Summary | Status |
|---------|---------|--------|
| v5.2 | Web Push notifications for red alerts | 🔜 |
| v5.3 | Refactoring R6–R8: Calendar/Alerts/Motivation cleanup | 🔜 |
