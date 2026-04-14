---
applyTo: "**/*.yml,**/*.yaml,.github/**"
description: "Use when: editing CI/CD workflows, GitHub Actions, or any YAML config."
---

# CI/CD Instructions

## Workflow Standards

- Use `actions/checkout@v6` and `actions/setup-node@v6`
- Set `permissions: contents: read` (least privilege)
- **No `npm ci` / no `cache: "npm"` / no `package-lock.json`** in this project
- All workflows install tools via `bash .github/ci/install-tools.sh`
- Run: HTML lint, security scan, Lighthouse, `node --test tests/dashboard.test.mjs` (1084 tests, 61 suites)
- Deploy via GitHub Pages on push to `main`
- Release: `release.yml` auto-attaches 4 artifacts on tags (`vX.Y.Z`)

## Tool Install Model

| Context | How tools are provided |
|---------|------------------------|
| Local dev | `npm install` in `MyScripts/` (parent) — Node walks up to find `node_modules` |
| CI (GitHub Actions) | `.github/ci/install-tools.sh` — `npm install --no-save --no-package-lock` |

> To update tool versions: edit **both** `MyScripts/package.json` AND `.github/ci/install-tools.sh`.

## Commit Convention

`feat:` | `fix:` | `style:` | `docs:` | `ci:` | `chore:`

## Security

- Never log secrets in CI output
- Use `${{ secrets.TOKEN }}` for credentials
- Pin action versions to specific tags
