# Agents — FamilyDashBoard

## Available Custom Agents

### `@dashboard-designer`
UI/UX specialist for the glassmorphism theme, CSS custom properties, RTL layout, TV-optimized readability, and responsive grid design.

**Use when**: redesigning sections, changing theme, adjusting layout, improving responsiveness.

### `@api-integrator`
API integration specialist for client-side data fetching with CORS proxy fallback, caching, and sync indicators.

**Use when**: adding data sources, fixing API calls, debugging fetch errors, optimizing caching.

## Available Prompts (type `/` in chat)

| Prompt | Purpose |
|--------|---------|
| `/code-review` | Full security + UI + API + performance audit |
| `/add-section` | Scaffold a new dashboard widget/card |
| `/fix-quality` | Auto-fix linting, security, and a11y issues |

## Available Instructions (auto-loaded by file pattern)

| Instruction | Applies To | Purpose |
|-------------|-----------|---------|
| `dashboard` | `*.html` | HTML/CSS/JS coding standards |
| `cicd` | `*.yml, *.yaml, .github/**` | CI/CD workflow standards |
| `workspace` | `**` | Project architecture overview |
