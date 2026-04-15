---
applyTo: "**/*.yml,**/*.yaml,.github/**"
description: "Use when: editing CI/CD workflows, GitHub Actions, or any YAML config."
---

# CI/CD Instructions

## Workflow Standards

- Use **`actions/checkout@v4`** and **`actions/setup-node@v4`** — these are the current stable major versions. Do NOT use @v5/@v6 (they don't exist for these actions).
- Set `permissions: contents: read` (least privilege)
- **No `npm ci` / no `cache: "npm"` / no `package-lock.json`** in this project (worker/ is the exception — it has its own lock file)
- All workflows install tools via `bash .github/ci/install-tools.sh`
- CI runs: `npx tsc --noEmit` → `npx eslint src tests --max-warnings 0` → `npx markdownlint-cli2 "**/*.md"` → `npx vitest run` → `npx vite build`
- Bundle size violations must `exit 1` — never use `::warning::` for size budget failures
- Deploy via GitHub Pages on push to `main` (`deploy.yml`)
- Release: `release.yml` auto-attaches artifacts on tags (`vX.Y.Z`)
- Single CI file: `ci.yml` covers all checks. `ci-v6.yml` is deleted — do not recreate it.

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
- Pin action versions to specific major tags (`@v4`, not `@latest`)
