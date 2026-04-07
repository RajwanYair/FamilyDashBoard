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
| **Owner** | @RajwanYair |
| **Stack** | HTML5, CSS3, vanilla JS (ES2020+) |
| **Dependencies** | Zero (no npm, no build) |
| **Target display** | TV screen (1920x1080+), always-on |
| **Language** | Hebrew (RTL), with English dates |

## File Structure

```
FamilyDashBoard/
├── BestDashBoard.html    # Dashboard (HTML + CSS + JS)
├── README.md
├── .gitignore
├── .editorconfig
├── .github/
│   ├── copilot-instructions.md
│   ├── copilot/config.json
│   ├── workflows/ci.yml
│   ├── workflows/deploy.yml
│   ├── instructions/
│   ├── prompts/
│   └── agents/
└── .vscode/settings.json
```

## What NOT To Do

- Do NOT add npm/node/build tools
- Do NOT use external CSS/JS libraries
- Do NOT hardcode API keys or colors
- Do NOT break the RTL layout or auto-refresh
- Do NOT use `innerHTML` with unsanitized external data
