---
applyTo: "**/*.yml,**/*.yaml,.github/**"
description: "Use when: editing CI/CD workflows, GitHub Actions, or any YAML config. Provides patterns for the FamilyDashBoard CI pipeline."
---

# CI/CD Instructions

## Workflow Standards

- Use `actions/checkout@v4` for all jobs
- Set `permissions: contents: read` (least privilege)
- Run validation: HTML lint, security scan, Lighthouse
- Deploy via GitHub Pages on push to `main`

## Commit Convention

Use Conventional Commits:
- `feat:` — new feature or section
- `fix:` — bug fix
- `style:` — visual/CSS changes
- `docs:` — documentation
- `ci:` — workflow changes
- `chore:` — maintenance

## Security

- Never log secrets or API keys in CI output
- Use `${{ secrets.TOKEN }}` for any credentials
- Pin action versions to specific tags (e.g., `@v4`)
