---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v8.3.0

TypeScript modular TV dashboard · Vite 8 + TS 5.9 + Vitest 4 · Hebrew RTL · Zero external CDN dependencies · 1920×1080+ always-on display · 6 themes · 3 screen modes

> **Shared deps**: All packages resolve from `MyScripts/node_modules/` (parent). Run `npm install` in `MyScripts/`, never here. No local `package-lock.json` or `devDependencies` in this project. CI uses `.github/ci/install-tools.sh`.
> **Tests**: 3080 / 88 suites / 0 failures · **Lint**: 0 errors · 0 warnings · 0 suppressions

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
tests/unit/                 # Vitest unit tests — 3080 tests / 88 suites
sw.js                       # ServiceWorker v7.20.0 (offline + API cache)
icon.svg                    # App icon (root copy; manifest in src/public/)
BestDashBoard.html          # Legacy dashboard (read-only, preserved)
.github/skills/             # add-api, release, debug-fetch, update-tests
.github/agents/             # api-integrator, dashboard-designer
.github/copilot/            # Copilot repo config + MCP/server guidance docs
.github/assets/             # SVG docs graphics
```

## AI Customizations

| Type | Location | Notes |
|---|---|---|
| Repository instructions | `.github/copilot-instructions.md` | Canonical coding rules |
| Agent-wide instructions | `AGENTS.md` | AI customization map for the repo |
| File-scoped instructions | `.github/instructions/*.instructions.md` | Applied by file pattern or task relevance |
| Prompt files | `.github/prompts/*.prompt.md` | Reusable slash commands |
| Custom agents | `.github/agents/*.agent.md` | Specialist personas for API and UI work |
| Skills | `.github/skills/*/SKILL.md` | Repeatable checklists |
| MCP guidance | `.github/copilot/MCP_SERVERS.md` | How to configure shared versus repo-specific MCP servers |

## Shared Tooling

Common reusable tooling can live in the parent `MyScripts/tooling/` directory.

- Put shared ESLint, TypeScript base, Stylelint, and Vitest base config there.
- Keep repository-specific aliases, include patterns, setup files, coverage settings, and path assumptions here in the workspace.
- When moving config upward, document the split so other repositories can reuse it safely.

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
