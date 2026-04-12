---
applyTo: "**"
description: "Use when: working on any file in the FamilyDashBoard workspace. Provides project context, architecture overview, and cross-cutting concerns."
---

# Workspace Instructions — FamilyDashBoard

## Project Overview

| Property | Value |
|----------|-------|
| **Name** | FamilyDashBoard |
| **Type** | Single-page HTML dashboard |
| **Version** | v4.19.0 |
| **Owner** | @RajwanYair |
| **Stack** | HTML5, CSS3, vanilla JS (ES2020+) |
| **Dependencies** | Zero (no npm, no build) |
| **Target display** | TV screen (1920x1080+), always-on |
| **Language** | Hebrew (RTL), with English dates |
| **Themes** | 5 (black OLED, blue, matrix, amber, purple) |
| **Screen modes** | 3 (tv, tablet, phone) |

## File Structure

```
FamilyDashBoard/
├── BestDashBoard.html    # Dashboard (HTML + CSS + JS)
├── index.html            # GitHub Pages redirect
├── README.md
├── CHANGELOG.md
├── LICENSE / SUPPORT.md
├── .editorconfig
├── .gitignore / .gitattributes
├── .markdownlint.json
├── tests/
|   └── dashboard.test.mjs  # 1112 tests, 60 suites (node --test)
├── .github/
│   ├── copilot-instructions.md
│   ├── copilot/config.json
│   ├── workflows/          # ci, deploy, release, auto-label
│   ├── instructions/
│   ├── prompts/
│   ├── agents/
│   ├── skills/             # add-api, release, debug-fetch, update-tests
│   ├── assets/             # SVG docs graphics
│   ├── ISSUE_TEMPLATE/ / DISCUSSION_TEMPLATE/
│   └── CONTRIBUTING.md / SECURITY.md / CODEOWNERS
└── .vscode/
    ├── settings.json
    ├── extensions.json
    └── mcp.json            # MCP servers (fetch, filesystem)
```

## Key Systems

| System | Details |
|--------|---------|
| **Cache** | Dual-layer: in-memory `Map` + `localStorage` (prefix `dash_v2_`, 7-day eviction) |
| **Fetch** | Direct → CORS proxy fallback (`allorigins` → `codetabs` → `corsproxy.io`) with diagnostic logging |
| **Error handling** | `safeLoad()` async wrapper, startup self-check, global error catchers, auto-show diagnostic overlay |
| **Diagnostics** | Press `D` for overlay: per-pane status + fetch log. Auto-opens on errors. `copyDiagLog()` copies log to clipboard |
| **Offline** | Banner slides down when `navigator.onLine` is false, serves stale cache |
| **Animations** | 6 card entrance variants, random per card, 5min attention re-animation loop, card maximize (FLIP) |
| **Performance** | GPU-accelerated scroll layers, CPU-aware concurrency pool (`runConcurrent`), `scheduleIdle()`, DocumentFragment batch writes |
| **Keyboard** | `T` = cycle themes, `D` = diagnostic overlay, `A` = toggle alerts, `S` = config panel, `N` = night dimmer, `+/-` = font scale, `P` = print, `Escape` = close maximized card, `B` = bookmark filter, `H`/`?` = help overlay |
| **Tests** | 1112 tests, 60 suites — `node --test tests/dashboard.test.mjs` (zero dependencies) |

## What NOT To Do

- Do NOT add npm/node/build tools
- Do NOT use external CSS/JS libraries
- Do NOT hardcode API keys or colors
- Do NOT break the RTL layout or per-pane refresh
- Do NOT use `innerHTML` with unsanitized external data
- Do NOT wrap async loaders in sync try/catch (use `await`)
- Do NOT remove the diagnostic overlay or self-check system
