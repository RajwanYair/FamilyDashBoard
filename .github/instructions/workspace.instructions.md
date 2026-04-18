---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v7.17.0

TypeScript modular TV dashboard · Vite 8 + TS 5.9 + Vitest 4 · Hebrew RTL · Zero external CDN dependencies · 1920×1080+ always-on display · 6 themes · 3 screen modes

> **Shared deps**: All packages resolve from `MyScripts/node_modules/` (parent). Run `npm install` in `MyScripts/`, never here. No local `package-lock.json` or `devDependencies` in this project. CI uses `.github/ci/install-tools.sh`.
> **Tests**: 2562+ / 56 suites / 0 failures · **Lint**: 0 errors · 0 warnings · 0 suppressions

## Shell / Terminal

> **OS: Windows · Shell: PowerShell** — All terminal commands must be valid PowerShell.

| Unix (FORBIDDEN) | PowerShell equivalent |
|---|---|
| `tail -n 20 file` | `Get-Content file \| Select-Object -Last 20` |
| `grep pattern file` | `Select-String -Path file -Pattern pattern` |
| `grep pattern` (pipe) | `\| Select-String pattern` |
| `cat file` | `Get-Content file` |
| `head -n 5 file` | `Get-Content file \| Select-Object -First 5` |
| `find . -name "*.ts"` | `Get-ChildItem -Recurse -Filter *.ts` |
| `ls` | `Get-ChildItem` |
| `rm -rf dir` | `Remove-Item -Recurse -Force dir` |
| `cmd1 && cmd2` | `cmd1 ; cmd2` |
| `export VAR=val` | `$env:VAR = "val"` |
| `echo $VAR` | `Write-Output $env:VAR` |

## Files

```text
src/                        # TypeScript v7 modular source (Vite build)
src/public/                 # Vite static dir — icon.svg, manifest.webmanifest (NOT src/assets/)
tests/unit/                 # Vitest unit tests — 2571+ tests / 56 suites
sw.js                       # ServiceWorker v7.17.0 (offline + API cache)
manifest.json / icon.svg    # PWA manifest + app icon (root copies)
BestDashBoard.html          # Legacy dashboard (read-only, preserved)
.github/skills/             # add-api, release, debug-fetch, update-tests
.github/agents/             # api-integrator, dashboard-designer
.github/assets/             # SVG docs graphics
```

## Cards (11 total)

news · weather · stocks · currency · calendar · hebrew-cal · alerts · motivation · tasks · system-info · countdown

## Architecture

| System | Pattern |
|--------|---------|
| Cache | `cGet(key,TTL)` / `cSet(key,data)` / `cGetStale(key)` — in-memory Map + localStorage (`dash_v2_*`, 7-day eviction) |
| Fetch | Direct → `allorigins` → `codetabs` → `corsproxy.io` · `fetchWithTimeout(url, 8000)` · `diagLog()` |
| SW | APP_SHELL pre-cache, API cache (7 origins), offline HTML fallback, `VERSION_ACTIVATED` broadcast |
| Init | `safeLoad()` wrappers → `Promise.allSettled` · per-pane `setInterval` · startup self-check |
| Keyboard | `T` theme · `D` diagnostics · `A` alerts · `S` config · `N` dimmer · `+/-` font · `P` print · `B` bookmarks · `H/?` help · `Esc` close |
