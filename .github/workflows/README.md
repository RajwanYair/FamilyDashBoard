# Workflows — FamilyDashBoard

This directory contains the operational GitHub Actions workflows for build, validation, deployment, and release automation.

## Principles

- Keep one canonical CI workflow: `ci.yml`
- Use stable major-version action tags already approved for this repository
- Prefer least-privilege permissions
- Keep workflow documentation aligned with the actual YAML files
- Keep local developer tooling and CI tool installation in sync

## Workflow Inventory

| Workflow              | File                        | Purpose                                                                             | Trigger                               |
| --------------------- | --------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------- |
| CI                    | `ci.yml`                    | Typecheck, lint, markdownlint, tests, security scan, worker tests, production build | push, pull_request, manual            |
| Pages Deploy          | `deploy.yml`                | Build `dist/` and publish to GitHub Pages                                           | push to `main`, manual                |
| Release               | `release.yml`               | Build release artifacts, generate changelog body, publish GitHub Release            | tag push                              |
| Worker Deploy         | `deploy-worker.yml`         | Deploy Cloudflare Worker from `worker/`                                             | `worker/**` changes on `main`, manual |
| Auto Label            | `auto-label.yml`            | Apply repository labels automatically                                               | event-driven                          |
| Dependabot Auto Merge | `dependabot-auto-merge.yml` | Controlled automation for dependency PR flow                                        | Dependabot events                     |

## CI Expectations

The main quality gate in `ci.yml` is expected to cover:

1. TypeScript type checking
2. ESLint with zero warnings
3. Markdownlint
4. Vitest on supported Node versions
5. Security scanning and worker-focused validation
6. Production build and bundle-size gate

If a change adds a new required quality gate, add it to `ci.yml` rather than creating a second overlapping CI workflow.

## Deployment Workflows

### Pages Deploy

`deploy.yml` is responsible for publishing the built dashboard to GitHub Pages.

- build with the repository's shared CI toolchain
- upload the `dist/` artifact
- deploy using the Pages actions already pinned in the workflow

### Worker Deploy

`deploy-worker.yml` is separate because the Worker has its own dependency model and lock file.

- `worker/` is the exception to the parent-tooling pattern
- `worker/package-lock.json` is valid and expected
- worker secrets must be documented when changed

## Release Workflow

`release.yml` is triggered by version tags.

- it re-runs validation relevant to tagged builds
- it packages `dist.zip`
- it attaches `dist.zip`, `sw.js`, and `icon.svg`
- it uses generated release notes plus the repository release-note configuration in `.github/release.yml`

## Change Rules

- If you edit a workflow, update `.github/instructions/cicd.instructions.md` when the conventions change.
- If you add or remove a workflow, update this README and `.github/AGENTS.md`.
- If you add a secret or environment requirement, document it here and in the relevant workflow comments.
- Do not silently change action major versions or the Node support matrix without documenting why.

---

## Permissions Matrix

| Workflow                    | contents | pages | id-token | deployments | pull-requests |
| --------------------------- | -------- | ----- | -------- | ----------- | ------------- |
| `ci.yml`                    | read     | —     | —        | —           | —             |
| `deploy.yml`                | read     | write | write    | —           | —             |
| `release.yml`               | write    | —     | —        | write       | —             |
| `deploy-worker.yml`         | read     | —     | —        | —           | —             |
| `auto-label.yml`            | read     | —     | —        | —           | write         |
| `dependabot-auto-merge.yml` | write    | —     | —        | —           | write         |

> Principle: **least privilege**. Only grant the minimum permissions required for the workflow to function.
> The `id-token: write` on `deploy.yml` is required for OIDC authentication with GitHub Pages.

---

## Secrets Inventory

| Secret          | Used by             | Purpose                                                 |
| --------------- | ------------------- | ------------------------------------------------------- |
| `CF_API_TOKEN`  | `deploy-worker.yml` | Cloudflare API token for Worker deployment via Wrangler |
| `CF_ACCOUNT_ID` | `deploy-worker.yml` | Cloudflare account identifier                           |
| _(none others)_ | all others          | Workflows use `GITHUB_TOKEN` (auto-provisioned) only    |

> If you add a new secret, document it here and in the workflow that uses it.
> Never commit secrets as plaintext. Never log secret values.

---

## Concurrency Policy

All push/PR-triggered workflows use `concurrency` to cancel stale runs:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- `ci.yml` — cancel older runs on the same branch. PRs always run to completion.
- `deploy.yml` — cancel older deploys. Only one Pages deploy active at a time.
- `release.yml` — **no cancel** (`cancel-in-progress: false`). Tag builds must always complete.
- `deploy-worker.yml` — cancel older worker deploys on same branch.

---

## Action Version Policy

| Action                          | Pinned version | Notes                               |
| ------------------------------- | -------------- | ----------------------------------- |
| `actions/checkout`              | `v4`           | Do NOT use v5+ (does not exist yet) |
| `actions/setup-node`            | `v4`           | Do NOT use v5+ (does not exist yet) |
| `actions/upload-pages-artifact` | `v3`           | Stable Pages API                    |
| `actions/deploy-pages`          | `v4`           | Stable Pages deploy                 |
| `actions/upload-artifact`       | `v4`           |                                     |
| `actions/download-artifact`     | `v4`           |                                     |

> Update action versions only when there is a clear need. Document the reason in the commit message.
