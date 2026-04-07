<div align="center">

# 🤝 Contributing to FamilyDashBoard

![PRs Welcome](https://img.shields.io/badge/PRs-welcome-34d399?style=flat-square)
![HTML Only](https://img.shields.io/badge/Single_File-HTML-E34F26?style=flat-square&logo=html5&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-60a5fa?style=flat-square)

</div>

## Code of Conduct

Be respectful, inclusive, and constructive.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Open `BestDashBoard.html` in a browser — that's it, no build step needed
4. Use VS Code with Live Server extension for hot reload during development

## Development Setup

### Recommended VS Code Extensions

Install via the workspace recommendations (`.vscode/extensions.json`):
- **Live Server** — local dev server with auto-reload
- **HTMLHint** — HTML linting
- **Prettier** — code formatting
- **GitHub Copilot** — AI assistance

### Project Structure

```
FamilyDashBoard/
├── 📄 BestDashBoard.html    # The entire dashboard (HTML + CSS + JS)
├── 📖 README.md             # Project documentation
├── � CHANGELOG.md          # Version history
├── 📋 SUPPORT.md            # Support channels
├── 📋 CITATION.cff          # Software citation metadata
├── 🐋 Dockerfile / nginx.conf  # Docker containerization
├── 📁 .github/
│   ├── 🖼️ assets/           # SVG graphics for docs
│   ├── 🤖 agents/           # Copilot custom agents
│   ├── 📐 instructions/     # Copilot context files
│   ├── 💬 prompts/          # Reusable Copilot prompts
│   ├── ⚙️ copilot/          # Copilot modes config
│   ├── 🪝 hooks/            # Git hooks
│   ├── 🔄 workflows/        # 11+ CI/CD + automation workflows
│   ├── 📋 ISSUE_TEMPLATE/   # Bug, feature, API issue forms
│   ├── 💬 DISCUSSION_TEMPLATE/ # Ideas, Q&A, show-and-tell
│   ├── 🔒 SECURITY.md
│   ├── 🤝 CONTRIBUTING.md
│   ├── 🤝 CODE_OF_CONDUCT.md
│   └── 📋 PULL_REQUEST_TEMPLATE.md
└── 📁 .vscode/              # VS Code workspace settings
```

## Coding Standards

### HTML/CSS

- 2-space indentation
- Use CSS custom properties (`--accent`, `--bg-card`, etc.) — never hardcode colors
- RTL layout (`dir="rtl"`, `lang="he"`)
- Responsive design: test at 1920x1080 (TV), 1024px (tablet), 768px (phone)

### JavaScript

- Modern ES2020+ (async/await, optional chaining, nullish coalescing)
- Cache DOM references in the `elements` object
- Wrap API calls in try/catch with proxy fallback
- Use `setCachedData` / `getCachedData` for every API response
- Use `textContent` not `innerHTML` for external data (XSS prevention)

### Commit Messages

Use conventional commits:
```
feat: add Shabbat candle lighting times
fix: stock chart not rendering on Firefox
style: increase forecast card font size
docs: update README with new section
ci: add Lighthouse performance audit
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make changes following the coding standards
3. Test in Chrome + Firefox, full-screen mode
4. Verify RTL layout is intact
5. Open a PR using the template
6. Wait for CI to pass

## What NOT To Do

- Do NOT add npm, webpack, or any build tools
- Do NOT add external JS/CSS frameworks
- Do NOT hardcode API keys
- Do NOT break the RTL layout
- Do NOT remove the auto-refresh mechanism
- Do NOT use `innerHTML` with unsanitized external data
