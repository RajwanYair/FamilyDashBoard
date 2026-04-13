---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v5.1.0

Single-file TV dashboard · HTML5 + CSS3 + vanilla JS (ES2020+) · Hebrew RTL · Zero dependencies · 1920×1080+ always-on display · 5 themes · 3 screen modes

## Files

```
BestDashBoard.html          # Dashboard (HTML + CSS + JS, ~6400 lines)
sw.js                       # ServiceWorker v5.0.0 (offline + API cache)
manifest.json / icon.svg    # PWA manifest + app icon
tests/dashboard.test.mjs    # 1084 tests, 61 suites (node --test)
.github/skills/             # add-api, release, debug-fetch, update-tests
.github/agents/             # api-integrator, dashboard-designer
.github/assets/             # SVG docs graphics (5 files)
```

## Architecture

| System | Pattern |
|--------|---------|
| Cache | `cGet(key,TTL)` / `cSet(key,data)` / `cGetStale(key)` — in-memory Map + localStorage (`dash_v2_*`, 7-day eviction) |
| Fetch | Direct → `allorigins` → `codetabs` → `corsproxy.io` · `fetchWithTimeout(url, 8000)` · `diagLog()` |
| SW | APP_SHELL pre-cache, API cache (7 origins), offline HTML fallback, `VERSION_ACTIVATED` broadcast |
| Init | `safeLoad()` wrappers → `Promise.allSettled` · per-pane `setInterval` · startup self-check |
| Keyboard | `T` theme · `D` diagnostics · `A` alerts · `S` config · `N` dimmer · `+/-` font · `P` print · `B` bookmarks · `H/?` help · `Esc` close |
