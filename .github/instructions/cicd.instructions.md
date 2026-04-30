---
applyTo: "**/*.yml,**/*.yaml,.github/**"
description: "Use when: editing CI/CD workflows, GitHub Actions, or any YAML config."
---

# CI/CD Instructions

## Workflow Standards

- Use **`actions/checkout@v4`** and **`actions/setup-node@v4`** — these are the current stable major versions. Do NOT use @v5/@v6 (they don't exist for these actions).
- Node.js version in CI: **24** — set via `node-version: '24'` in `actions/setup-node@v4`.
- Use the dedicated Pages and Release action majors already present in this repo unless a workflow change explicitly requires otherwise.
- Set `permissions: contents: read` (least privilege)
- **No `npm ci` / no `cache: "npm"` / no `package-lock.json`** in this project (worker/ is the exception — it has its own lock file)
- All workflows install tools via `bash .github/ci/install-tools.sh`
- CI runs: `npx tsc --noEmit` → `npx eslint src tests --max-warnings 0` → `npx markdownlint-cli2 "**/*.md"` → `npx vitest run` → `npx vite build`
- Bundle size violations must `exit 1` — never use `::warning::` for size budget failures
- Deploy via GitHub Pages on push to `main` (`deploy.yml`)
- Release: `release.yml` auto-attaches artifacts on tags (`vX.Y.Z`)
- Single CI file: `ci.yml` covers all checks. `ci-v6.yml` is deleted — do not recreate it.

## Workflow Map

| Workflow                    | Purpose                                                                      | Trigger                               |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| `ci.yml`                    | Quality gate for typecheck, lint, docs, tests, security, worker tests, build | push, pull_request, manual            |
| `deploy.yml`                | Build and publish GitHub Pages artifact                                      | push to `main`, manual                |
| `release.yml`               | Build tagged release assets and publish GitHub Release                       | tag push                              |
| `deploy-worker.yml`         | Deploy Cloudflare Worker                                                     | `worker/**` changes on `main`, manual |
| `auto-label.yml`            | Label PRs and issues                                                         | GitHub events                         |
| `dependabot-auto-merge.yml` | Controlled dependency automation                                             | Dependabot PR events                  |

Keep `.github/workflows/README.md` aligned with any workflow changes.

## Tool Install Model

| Context             | How tools are provided                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| Local dev           | `npm install` in `MyScripts/` (parent) — Node walks up to find `node_modules` |
| CI (GitHub Actions) | `.github/ci/install-tools.sh` — `npm install --no-save --no-package-lock`     |

> To update tool versions: edit **both** `MyScripts/package.json` AND `.github/ci/install-tools.sh`.

## Shared Tooling Layout

- Shared Node-based tools live in `MyScripts/node_modules/`
- Shared reusable config can live in `MyScripts/tooling/`
- Repository-specific workflow logic stays in this workspace
- Do not move project-only paths, aliases, includes, or coverage rules into shared tooling without proving they are reusable

## Commit Convention

`feat:` | `fix:` | `style:` | `docs:` | `ci:` | `chore:`

## Security

- Never log secrets in CI output
- Use `${{ secrets.TOKEN }}` for credentials
- Pin action versions to specific major tags (`@v4`, not `@latest`)
- Prefer explicit job-level permissions if a workflow needs more than `contents: read`

## Editing Rules For `.github/**`

- If you change a workflow, update the markdown that documents it.
- If you add a secret, document where it is required and which workflow consumes it.
- If you change tool versions, keep local developer instructions and CI install instructions in sync.
- Preserve bash syntax inside GitHub Actions even though local interactive commands in this repository use PowerShell.

## GitHub Copilot Code Review

GitHub Copilot can perform PR code reviews. To request one on a PR:

- Use `@github-copilot review` in a PR comment, or enable auto-review in repository settings.
- Copilot review runs after CI passes — treat its output like any reviewer comment.
- Copilot review suggestions are advisory — apply only those that match project rules.
- Do not override Copilot review with `copilot:ignore` without a comment explaining why.
