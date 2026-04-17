<div align="center">

# 🤖 Agents — FamilyDashBoard v7.10.0

![Copilot](https://img.shields.io/badge/GitHub_Copilot-Agents-8b5cf6?style=flat-square&logo=github&logoColor=white)
![Modes](https://img.shields.io/badge/Copilot_Modes-5-60a5fa?style=flat-square)

</div>

## Custom Agents

### `@dashboard-designer`

UI/UX specialist — CSS custom properties, RTL layout, TV readability, 6 themes, 3 screen modes, glassmorphism, card animations.

### `@api-integrator`

API integration specialist — CORS proxy fallback, dual-layer cache (`cGet`/`cSet`/`cGetStale`), sync indicators, fetch locks, `diagLog()`.

## Copilot Modes

| Mode | Focus |
|------|-------|
| `ui` | CSS, layout, responsiveness, glassmorphism |
| `api` | Fetch, caching, proxy fallback, data parsing |
| `fix` | Bug fixes, error handling, edge cases |
| `docs` | README, comments, markdown files |
| `security` | XSS, sanitization, HTTPS enforcement |

## Prompts (`/` in chat)

| Prompt | Purpose |
|--------|---------|
| `/code-review` | Security + UI + API + performance audit |
| `/add-section` | Scaffold a new dashboard widget/card |
| `/fix-quality` | Auto-fix linting, security, a11y issues |

## Skills (`/` in chat — auto-loaded when relevant)

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `/add-api` | add API, new data source, new card | Fetch + cache + sync + display + interval + tests |
| `/release` | bump version, new release, changelog | Version bump → CHANGELOG → SVGs → tests → git tag |
| `/debug-fetch` | broken API, data not loading, proxy failing | Diagnose fetch failures via overlay + proxy chain |
| `/update-tests` | add tests, fix failing tests, coverage gaps | Add/update Vitest unit tests in `tests/unit/` |

## Instructions (auto-loaded by file pattern)

| Instruction | Applies To | Purpose |
|-------------|-----------|---------|
| `copilot-instructions` | All interactions | Mandatory rules, key names, gotchas |
| `workspace` | `**` | Project overview, file map, architecture |
| `dashboard` | `*.html` | Layout, fonts, patterns, intervals |
| `cicd` | `*.yml, .github/**` | CI/CD workflow standards |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `T` | Cycle 6 themes |
| `D` | Diagnostic overlay |
| `A` | Toggle red alerts |
| `S` | Config panel |
| `N` | Night dimmer |
| `+`/`-` | Font scale |
| `P` | Print mode |
| `B` | Bookmark filter |
| `H`/`?` | Help overlay |
| `Esc` | Close maximized card / overlay |
