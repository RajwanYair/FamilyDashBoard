---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v14.4.0

TypeScript modular TV dashboard · Vite 8 + TS 6.0.3 + Vitest 4.1.5 · Hebrew RTL · Zero external CDN dependencies · 1920×1080+ always-on display · 6 themes · 3 screen modes · 12 cards

> **Shared deps**: All packages resolve from `MyScripts/node_modules/` (parent). Run `npm install` in `MyScripts/`, never here. No local `package-lock.json` or `devDependencies` in this project. CI uses `.github/ci/install-tools.sh`. Shared tooling configs are vendored into `tooling/` (tsconfig/, eslint/, vitest/).
> **Tests**: 6387 / 214 suites / 0 failures · **Lint**: 0 errors · 0 warnings · 0 suppressions
> **Coverage**: 94.2 / 85.4 / 94.5 / 95.6 (statements / branches / functions / lines) — see `vitest.config.ts`

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
docs/adr/                   # Accepted architectural decisions (ADR-001 → ADR-073)
.github/SUPPORT.md          # Support and operator guidance (GitHub community health file)
.github/skills/             # add-api, release, debug-fetch, update-tests
.github/agents/             # api-integrator, dashboard-designer, quality-reviewer
.github/copilot/            # Copilot repo config + MCP/server guidance docs
.github/assets/             # SVG docs graphics
```

## AI Customizations

| Type                     | Location                                 | Notes                                                                    |
| ------------------------ | ---------------------------------------- | ------------------------------------------------------------------------ |
| Repository instructions  | `.github/copilot-instructions.md`        | Canonical coding rules                                                   |
| Agent-wide instructions  | `AGENTS.md`                              | AI customization map for the repo                                        |
| File-scoped instructions | `.github/instructions/*.instructions.md` | Applied by `applyTo:` glob pattern or semantic task relevance            |
| Prompt files             | `.github/prompts/*.prompt.md`            | Reusable slash commands (`mode: agent`, optional `model:`)               |
| Custom agents            | `.github/agents/*.agent.md`              | Specialist personas with `tools:` allowlist and `handoffs:`              |
| Skills                   | `.github/skills/*/SKILL.md`              | Repeatable checklists (auto-discovered by `description:` match)          |
| MCP guidance             | `.github/copilot/MCP_SERVERS.md`         | How to configure shared versus repo-specific MCP servers                 |
| Edit-time hooks          | `.github/hooks/*.json`                   | PostToolUse reminders (RTL, CSS vars, TV readability)                    |

## Extension Integration (Token-Saving Shortcuts)

| Extension             | Copilot Surface                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ |
| ESLint                | `get_errors` for inline diagnostics — skip terminal eslint for single-file checks    |
| Vitest Explorer       | `run_task` tasks: "🔬 Vitest: Run All Tests" / "Current File" / "Coverage Report"    |
| Playwright            | `run_task` "🎭 Playwright: E2E Tests"; MCP `playwright` server for chat automation   |
| Stylelint             | `get_errors` on CSS files — validates layer order + custom-property usage             |
| Markdownlint          | `get_errors` on `.md` files; `run_task` "📝 Markdownlint: Docs" for full sweep       |
| webhint               | Browser-compat warnings in `get_errors` (validates `.browserslistrc` targets)        |
| Spell Checker         | Hebrew+English diagnostics in `get_errors` on markdown/comments                      |
| GitLens + GitKraken   | MCP `gitkraken` for blame/log/diff; supplements `vscode_listCodeUsages`              |
| Git Graph             | Visual branch topology; supplements gitkraken MCP for commit history                 |
| GitHub Actions ext    | YAML validation + auto-complete in workflow files via `get_errors`                    |
| Todo Tree             | `TODO`/`FIXME`/`HACK` tracking for pre-release dead-code sweeps                     |
| Edge DevTools         | Local Lighthouse/axe; supplements CI LHCI checks                                     |
| PowerShell            | Terminal profile; all `run_in_terminal` → PowerShell (never bash)                    |
| EditorConfig          | Format-on-save eliminates whitespace/EOL fixups from Copilot edits                   |
| HTML CSS Support      | Class/ID completion — reduces `semantic_search` for style lookups                    |

## Token Optimization Strategy

- **`get_errors`** over terminal lint/tsc for single-file validation (zero output parsing)
- **`get_errors`** aggregates ESLint + Stylelint + webhint + markdownlint + spell-check in one call
- **`run_task`** over `run_in_terminal` for workspace-defined commands (cleaner output, task reuse)
- **`multi_replace_string_in_file`** for 2+ edits (one tool call vs N sequential)
- **`runSubagent`** for multi-file exploration (keeps main context clean)
- **`tool_search`** with broad queries (one call discovers all MCP tools in a family)
- **Instructions `applyTo`** globs ensure only relevant rules load (not all 8 instruction files)
- **Agent `handoffs:`** delegate specialized sub-tasks without repeating domain rules
- **`memory` repo scope** for frequently-referenced facts (avoids repeated file reads)

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
| Browsers | Chrome 114+ · Edge 114+ · Firefox 128+ · Firefox ESR · Safari 17.4+ · Opera 100+ · Samsung 23+ · iOS 17.4+ (see `.browserslistrc`)     |
| E2E      | Playwright: Chromium (all tests) · Firefox/WebKit/Edge/Mobile-Chrome/Mobile-Safari/Tablet-Safari (smoke + a11y only)                   |
