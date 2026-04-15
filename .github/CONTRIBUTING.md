<div align="center">

# 🤝 Contributing to FamilyDashBoard

![PRs Welcome](https://img.shields.io/badge/PRs-welcome-34d399?style=flat-square)
![HTML Only](https://img.shields.io/badge/Single_File-HTML-E34F26?style=flat-square&logo=html5&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-60a5fa?style=flat-square)

</div>

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

## Questions?

For questions, ideas, or help, please use [GitHub Discussions](https://github.com/RajwanYair/FamilyDashBoard/discussions) instead of opening issues.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Open `BestDashBoard.html` in a browser — that's it, no build step needed
4. Use VS Code with Live Server extension for hot reload during development

## Development Setup

> **Single install point** — All dev tools (Vite, Vitest, ESLint, TypeScript) live in
> `MyScripts/package.json` (one level up). `FamilyDashBoard/package.json` carries only
> project metadata and `scripts`; it has **no `devDependencies`** and **no `package-lock.json`**.
> Node's module resolution walks up the directory tree to find tools automatically.

```bash
# One-time setup (from the parent directory — do this once for ALL sub-projects)
cd MyScripts && npm install

# Daily workflow (from FamilyDashBoard/)
npx vitest run          # 1240+ tests
npx eslint src tests --max-warnings 0
npx tsc --noEmit
npx vite build
```

> **Never run `npm install` inside `FamilyDashBoard/`.**
> If you accidentally do so, delete `node_modules/` and `package-lock.json` here
> and re-run `npm install` from `MyScripts/` instead.

### Recommended VS Code Extensions

Install via the workspace recommendations (`.vscode/extensions.json`):

- **Live Server** — local dev server with auto-reload
- **HTMLHint** — HTML linting
- **Prettier** — code formatting
- **GitHub Copilot** — AI assistance

### Project Structure

```text
MyScripts/                      # Parent workspace — shared node_modules
└── FamilyDashBoard/
    ├── src/                    # TypeScript v6 modular source (Vite build)
    ├── tests/unit/             # Vitest — 1240+ tests / 33 suites
    ├── BestDashBoard.html      # Legacy v5 dashboard (HTML + CSS + JS)
    ├── sw.js                   # ServiceWorker v6
    ├── index.html              # Vite entry point
    ├── .github/                # CI, agents, instructions, skills, prompts
    └── .vscode/                # VS Code workspace + lint config
```

## Coding Standards

### HTML/CSS

- 2-space indentation
- Use CSS custom properties (`--accent`, `--bg-card`, etc.) — never hardcode colors
- RTL layout (`dir="rtl"`, `lang="he"`)
- Responsive design: test at 1920x1080 (TV), 1024px (tablet), 768px (phone)

### JavaScript

- Modern ES2020+ (async/await, optional chaining, nullish coalescing)
- Cache DOM references in the `el` object
- Wrap API calls in try/catch with proxy fallback
- Use `cSet()` / `cGet()` / `cGetStale()` for every API response
- Use `textContent` not `innerHTML` for external data (XSS prevention)

### Commit Messages

Use conventional commits:

```text
feat: add Shabbat candle lighting times
fix: stock chart not rendering on Firefox
style: increase forecast card font size
docs: update README with new section
ci: add Lighthouse performance audit
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make changes following the coding standards
3. Run linters and tests (see below)
4. Test in Chrome + Firefox, full-screen mode
5. Verify RTL layout is intact
6. Open a PR using the template
7. Wait for CI to pass

## Linting

All tools resolve from the parent `MyScripts/node_modules/`:

```bash
npx eslint src tests --max-warnings 0   # 0 errors, 0 warnings
npx tsc --noEmit                         # TypeScript strict check
```

## Testing

1240+ tests / 33 suites via Vitest (happy-dom):

```bash
npx vitest run                  # all tests
npx vitest run --coverage       # with coverage report
```

Requires **Node.js 22+**. All tests must pass with 0 failures before merging.

## What NOT To Do

- Do NOT add external JS/CSS libraries or CDNs
- Do NOT add `devDependencies` here — add to `MyScripts/package.json`
- Do NOT hardcode API keys or colors (use CSS custom properties)
- Do NOT break the RTL layout
- Do NOT remove the auto-refresh mechanism
- Do NOT use `innerHTML` with unsanitized external data
