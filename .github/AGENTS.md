<div align="center">

# 🤖 Agents — FamilyDashBoard

![Copilot](https://img.shields.io/badge/GitHub_Copilot-Agents-8b5cf6?style=flat-square&logo=github&logoColor=white)
![Modes](https://img.shields.io/badge/Copilot_Modes-5-60a5fa?style=flat-square)

</div>

## Available Custom Agents

### `@dashboard-designer`
UI/UX specialist for the glassmorphism theme, CSS custom properties, RTL layout, TV-optimized readability, responsive grid design, 5 theme variants, 3 screen modes, card entrance animations, and phone mode scroll.

**Use when**: redesigning sections, changing themes, adjusting layout, improving responsiveness, card animations, phone mode.

### `@api-integrator`
API integration specialist for client-side data fetching with CORS proxy fallback, dual-layer caching (`cGet`/`cSet`/`cGetStale`), sync indicators, fetch locks, and diagnostic logging.

**Use when**: adding data sources, fixing API calls, debugging fetch errors, optimizing caching, diagnosing with `diagLog()`.

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `T` | Cycle through 5 themes |
| `D` | Toggle diagnostic overlay (per-pane status + fetch log) |
| `Escape` | Close maximized card |

## Available Copilot Modes

| Mode | Focus | Description |
|------|-------|-------------|
| `ui` | 🎨 UI/UX | CSS, layout, responsiveness, glassmorphism |
| `api` | 🌐 APIs | Fetch, caching, proxy fallback, data parsing |
| `fix` | 🔧 Fixes | Bug fixes, error handling, edge cases |
| `docs` | 📖 Docs | README, comments, markdown files |
| `security` | 🔒 Security | XSS, sanitization, HTTPS enforcement |

## Available Prompts (type `/` in chat)

| Prompt | Purpose |
|--------|---------|
| `/code-review` | Full security + UI + API + performance audit |
| `/add-section` | Scaffold a new dashboard widget/card |
| `/fix-quality` | Auto-fix linting, security, and a11y issues |

## Available Skills (type `/` in chat — auto-loaded when relevant)

| Skill | Trigger phrases | Purpose |
|-------|----------------|---------|
| `/add-api` | add API, new data source, new card with data | Full workflow: fetch + cache + sync + display + interval + tests |
| `/release` | new release, bump version, publish, changelog, tag | Version bump → CHANGELOG → SVG assets → tests → git tag |
| `/debug-fetch` | broken API, data not loading, proxy failing, error indicator | Diagnose fetch failures using diagnostic overlay + proxy chain testing |
| `/update-tests` | add tests, fix failing tests, test coverage, test suite | Add/update regex-based tests for HTML/CSS/JS changes |

## Available Instructions (auto-loaded by file pattern)

| Instruction | Applies To | Purpose |
|-------------|-----------|---------|
| `dashboard` | `*.html` | HTML/CSS/JS coding standards |
| `cicd` | `*.yml, *.yaml, .github/**` | CI/CD workflow standards |
| `workspace` | `**` | Project architecture overview |

## MCP Servers (`.vscode/mcp.json`)

| Server | Package | Purpose |
|--------|---------|---------|
| `fetch` | `@modelcontextprotocol/server-fetch` | Test API endpoints (weather, hebcal, stocks) directly in chat |
| `filesystem` | `@modelcontextprotocol/server-filesystem` | Scoped read/write access to the project folder |
