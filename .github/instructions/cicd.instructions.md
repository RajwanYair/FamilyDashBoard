---
applyTo: "**/*.yml,**/*.yaml,.github/**"
description: "Use when: editing CI/CD workflows, GitHub Actions, or any YAML config."
---

# CI/CD Instructions

## Workflow Standards

- Use `actions/checkout@v6` and `actions/setup-node@v6`
- Set `permissions: contents: read` (least privilege)
- Run: HTML lint, security scan, Lighthouse, `node --test tests/dashboard.test.mjs` (1084 tests, 61 suites)
- Deploy via GitHub Pages on push to `main`
- Release: `release.yml` auto-attaches 4 artifacts on tags (`vX.Y.Z`)

## Commit Convention

`feat:` | `fix:` | `style:` | `docs:` | `ci:` | `chore:`

## Security

- Never log secrets in CI output
- Use `${{ secrets.TOKEN }}` for credentials
- Pin action versions to specific tags
