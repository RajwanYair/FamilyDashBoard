---
applyTo: "**/*.yml,**/*.yaml,.github/**"
description: "Use when: editing CI/CD workflows, GitHub Actions, or any YAML config."
---

# CI/CD Instructions

## Workflow Standards

- Use `actions/checkout@v4` and `actions/setup-node@v4` minimum; upgrade to latest stable when available
- Set `permissions: contents: read` (least privilege)
- **No `npm ci` / no `cache: "npm"` / no `package-lock.json`** in this project
- All workflows install tools via `bash .github/ci/install-tools.sh`
- CI runs: `npx tsc --noEmit` → `npx eslint src tests --max-warnings 0` → `npx vitest run` → `npx vite build`
- Lint command matches local: `npx eslint src tests --max-warnings 0` (covers both src and tests)
- Deploy via GitHub Pages on push to `main` (`deploy.yml`)
- Release: `release.yml` auto-attaches artifacts on tags (`vX.Y.Z`)

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
