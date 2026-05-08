---
applyTo: "**"
description: "Project context and file map for FamilyDashBoard."
---

# FamilyDashBoard — v14.13.0

TypeScript modular TV dashboard · Vite 8 + TS 6.0.3 + Vitest 4.1.5 · Hebrew RTL · Zero external CDN dependencies · 1920×1080+ always-on display · 6 themes · 3 screen modes · 12 cards

> **Shared deps**: All packages resolve from `MyScripts/node_modules/` (parent). Run `npm install` in `MyScripts/`, never here. No local `package-lock.json` or `devDependencies` in this project. CI uses `.github/ci/install-tools.sh`. Shared tooling configs are vendored into `tooling/` (tsconfig/, eslint/, vitest/).
> **Tests**: 7221 / 282 suites / 0 failures · **Lint**: 0 errors · 0 warnings · 0 suppressions
> **Coverage**: 95.7 / 88.8 / 95.1 / 96.7 (statements / branches / functions / lines) — see `vitest.config.ts`

## Shell / Terminal

> **OS: Windows · Shell: PowerShell** — See `copilot-instructions.md` Rule 31 for full translation table. Never use Unix commands.

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

## Extension Integration (Token-Saving Shortcuts)

Prefer `get_errors` over terminal for lint/tsc/CSS/spell/compat checks. Use `run_task` for Vitest/Playwright/build commands. Use MCP `gitkraken` for git history. See `AGENTS.md` for full extension map.

Key extensions installed: ESLint, Stylelint, webhint, markdownlint, Spell Checker (EN+HE), Error Lens, Coverage Gutters, Console Ninja, Baseline Lens, Version Lens, TODO Tree, Bookmarks, Mermaid Chart, Draw.io, SVG Preview, Path IntelliSense, npm IntelliSense, caniuse, browserslist. Full config in `.github/copilot/config.json`.

## Token Optimization Strategy

- `get_errors` aggregates ESLint + Stylelint + webhint + markdownlint + spell-check
- `run_task` over `run_in_terminal` for workspace tasks
- `multi_replace_string_in_file` for batch edits
- `runSubagent` for multi-file exploration
- `tool_search` with broad queries (discovers MCP tool families)
- `applyTo` globs ensure only relevant instruction files load
- Error Lens / Coverage Gutters / Console Ninja / Version Lens / Baseline Lens reduce Copilot round-trips (user sees data inline)
- `PreToolUse` hooks guard duplicate files, missing context, and terminal misuse
- `PostToolUse` hooks auto-remind conventions after edits

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
| Browsers | Chrome 114+ · Edge 114+ · Firefox 128+ · Firefox ESR · Safari 17.4+ · Opera 100+ · Samsung 23+ · iOS 17.4+ · Android 114+ · ChromeAndroid 114+ · FirefoxAndroid 128+ · OperaMobile 80+ |
| E2E      | Playwright: Chromium (all tests) · Firefox/WebKit/Edge/Mobile-Chrome/Mobile-Safari/Tablet-Safari/Tablet-Android/Mobile-Samsung (smoke + a11y) |
