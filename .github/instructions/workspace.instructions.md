---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v7.0-alpha

TypeScript modular TV dashboard · Vite 8 + TS 5.9 + Vitest 4 · Hebrew RTL · Zero external CDN dependencies · 1920×1080+ always-on display · 6 themes · 3 screen modes

> **Shared deps**: All packages resolve from `MyScripts/node_modules/` (parent). Run `npm install` in `MyScripts/`, never here. No local `package-lock.json` or `devDependencies` in this project. CI uses `.github/ci/install-tools.sh`.
> **Tests**: 1274 / 36 suites / 0 failures · **Lint**: 0 errors · 0 warnings · 0 suppressions

## Files

```
src/                        # TypeScript v7 modular source (Vite build)
tests/unit/                 # Vitest unit tests — 1240+ tests / 33 suites
sw.js                       # ServiceWorker v6.0.0 (offline + API cache)
manifest.json / icon.svg    # PWA manifest + app icon
BestDashBoard.html          # Legacy dashboard (read-only, preserved)
.github/skills/             # add-api, release, debug-fetch, update-tests
.github/agents/             # api-integrator, dashboard-designer
.github/assets/             # SVG docs graphics
```

## Architecture

| System | Pattern |
|--------|---------|
| Cache | `cGet(key,TTL)` / `cSet(key,data)` / `cGetStale(key)` — in-memory Map + localStorage (`dash_v2_*`, 7-day eviction) |
| Fetch | Direct → `allorigins` → `codetabs` → `corsproxy.io` · `fetchWithTimeout(url, 8000)` · `diagLog()` |
| SW | APP_SHELL pre-cache, API cache (7 origins), offline HTML fallback, `VERSION_ACTIVATED` broadcast |
| Init | `safeLoad()` wrappers → `Promise.allSettled` · per-pane `setInterval` · startup self-check |
| Keyboard | `T` theme · `D` diagnostics · `A` alerts · `S` config · `N` dimmer · `+/-` font · `P` print · `B` bookmarks · `H/?` help · `Esc` close |
