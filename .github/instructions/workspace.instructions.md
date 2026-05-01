---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v13.34.0

TypeScript modular TV dashboard · Vite 8 + TS 6.0.3 + Vitest 4.1.5 · Hebrew RTL · Zero external CDN dependencies · 1920×1080+ always-on display · 6 themes · 3 screen modes · 12 cards

> **Shared deps**: All packages resolve from `MyScripts/node_modules/` (parent). Run `npm install` in `MyScripts/`, never here. No local `package-lock.json` or `devDependencies` in this project. CI uses `.github/ci/install-tools.sh`. Shared tooling configs are vendored into `tooling/` (tsconfig/, eslint/, vitest/).
> **Tests**: 6012 / 186 suites / 0 failures · **Lint**: 0 errors · 0 warnings · 0 suppressions
> **Coverage**: 93.0 / 84.6 / 92.0 / 94.5 (statements / branches / functions / lines) — see `vitest.config.ts`

## Shell / Terminal

> **OS: Windows · Shell: PowerShell** — All terminal commands must be valid PowerShell.

| Unix (FORBIDDEN)      | PowerShell equivalent                        |
| --------------------- | -------------------------------------------- |
| `tail -n 20 file`     | `Get-Content file \| Select-Object -Last 20` |
| `grep pattern file`   | `Select-String -Path file -Pattern pattern`  |
| `grep pattern` (pipe) | `\| Select-String pattern`                   |
| `cat file`            | `Get-Content file`                           |
| `head -n 5 file`      | `Get-Content file \| Select-Object -First 5` |
| `find . -name "*.ts"` | `Get-ChildItem -Recurse -Filter *.ts`        |
| `ls`                  | `Get-ChildItem`                              |
| `rm -rf dir`          | `Remove-Item -Recurse -Force dir`            |
| `cmd1 && cmd2`        | `cmd1 ; cmd2`                                |
| `export VAR=val`      | `$env:VAR = "val"`                           |
| `echo $VAR`           | `Write-Output $env:VAR`                      |

## Files

```text
src/                        # TypeScript v7 modular source (Vite build)
src/public/                 # Vite static dir — icon.svg, manifest.webmanifest (NOT src/assets/)
tests/unit/                 # Vitest unit tests
sw.js                       # ServiceWorker reference (compiled to dist/sw.js by build-sw.mjs)
docs/ARCHITECTURE.md        # Runtime structure, cache layers, worker topology
docs/ROADMAP.md             # Strategic plan, stream priorities, forward release plan
docs/adr/                   # Accepted architectural decisions (ADR-001 → ADR-052)
.github/SUPPORT.md          # Support and operator guidance (GitHub community health file)
.github/skills/             # add-api, release, debug-fetch, update-tests
.github/agents/             # api-integrator, dashboard-designer
.github/copilot/            # Copilot repo config + MCP/server guidance docs
.github/assets/             # SVG docs graphics
```

## AI Customizations

| Type                     | Location                                 | Notes                                                    |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| Repository instructions  | `.github/copilot-instructions.md`        | Canonical coding rules                                   |
| Agent-wide instructions  | `AGENTS.md`                              | AI customization map for the repo                        |
| File-scoped instructions | `.github/instructions/*.instructions.md` | Applied by file pattern or task relevance                |
| Prompt files             | `.github/prompts/*.prompt.md`            | Reusable slash commands                                  |
| Custom agents            | `.github/agents/*.agent.md`              | Specialist personas for API and UI work                  |
| Skills                   | `.github/skills/*/SKILL.md`              | Repeatable checklists                                    |
| MCP guidance             | `.github/copilot/MCP_SERVERS.md`         | How to configure shared versus repo-specific MCP servers |

## Shared Tooling

Common reusable tooling can live in the parent `MyScripts/tooling/` directory.

- Put shared ESLint, TypeScript base, Stylelint, and Vitest base config there.
- Keep repository-specific aliases, include patterns, setup files, coverage settings, and path assumptions here in the workspace.
- When moving config upward, document the split so other repositories can reuse it safely.

## Cards (12 total)

news · weather · stocks · currency · calendar · hebrew-cal · alerts · motivation · tasks · system-info · countdown · video-news

## Architecture

| System   | Pattern                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Cache    | `cGet(key,TTL)` / `cSet(key,data)` / `cGetStale(key)` — in-memory Map + localStorage (`dash_v2_*`, 7-day eviction)                     |
| Fetch    | Direct → `allorigins` → `codetabs` → `corsproxy.io` · `fetchWithTimeout(url, 8000)` · `diagLog()`                                      |
| SW       | APP_SHELL pre-cache, API cache (7 origins), offline HTML fallback, `VERSION_ACTIVATED` broadcast                                       |
| Init     | `safeLoad()` wrappers → `Promise.allSettled` · per-pane `setInterval` · startup self-check                                             |
| Keyboard | `T` theme · `D` diagnostics · `A` alerts · `S` config · `N` dimmer · `+/-` font · `P` print · `B` bookmarks · `H/?` help · `Esc` close |
