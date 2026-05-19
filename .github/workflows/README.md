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
| Pages Deploy          | `deploy.yml`                | Build `dist/` and publish to GitHub Pages after successful CI on `main`             | CI workflow success, manual           |
| Release               | `release.yml`               | Re-run the production gate, build release artifacts, and publish GitHub Release     | tag push                              |
| Worker Deploy         | `deploy-worker.yml`         | Deploy Cloudflare Worker from `worker/`                                             | `worker/**` changes on `main`, manual |
| Auto Label            | `auto-label.yml`            | Apply repository labels automatically                                               | event-driven                          |
| Dependabot Auto Merge | `dependabot-auto-merge.yml` | Controlled automation for dependency PR flow                                        | Dependabot events                     |
| CodeQL Analysis       | `codeql.yml`                | SAST security scanning via GitHub CodeQL (TypeScript)                               | `src/**` push/PR, weekly Saturday     |
| OpenSSF Scorecard     | `scorecard.yml`             | Supply-chain security posture score (publishes SARIF to Security tab)               | push to `main`, weekly Monday         |
| Stale Issues          | `stale.yml`                 | Auto-mark stale issues (90 d) and PRs (30 d), close after grace period              | daily schedule, manual                |
| Supply Chain          | `supply-chain.yml`          | npm audit signatures + license compliance + PR dependency review + auto-issue       | `package*.json` push/PR, weekly       |
| Perf Regression       | `perf-regression.yml`       | Bundle size delta + Lighthouse Web Vitals PR comment; fails if JS > 500 KB gzip     | `src/**` / `vite.config.ts` PR        |
| Trivy Scan            | `trivy.yml`                 | CVE + IaC misconfig scan; uploads SARIF to Security tab (HIGH/CRITICAL)             | push/PR/weekly Monday                 |
| TruffleHog            | `trufflehog.yml`            | Full git-history secret scanning (verified findings only)                           | push/PR/weekly Monday, manual         |
| ZAP Baseline          | `zap-baseline.yml`          | OWASP ZAP passive DAST scan against local production build                          | weekly Sunday, manual                 |
| SBOM                  | `sbom.yml`                  | CycloneDX JSON + XML SBOM generation (prod deps only)                               | release tags, weekly Monday           |
| PR SBOM Diff          | `pr-sbom-diff.yml`          | Diff SBOM on dependency-changing PRs; posts comment + blocks on new HIGH/CRITICAL   | `package*.json` change PR             |
| Rebuild Verify        | `rebuild-verify.yml`        | Hermetic reproducibility check: build twice, compare checksums                      | push to `main`, manual                |
| Preview Deploy        | `preview-deploy.yml`        | Deploy PR preview build to a staging URL for visual + functional review             | pull_request                          |
| Link Check            | `link-check.yml`            | Validate internal and external links in `docs/` and README                          | weekly schedule, manual               |
| Visual Baselines      | `visual-baselines.yml`      | Update Linux Playwright VR snapshots on Ubuntu, commit back                         | manual only                           |
| Branch Protection     | `branch-protection.yml`     | Verify + apply minimum branch-protection rules on `main`                            | weekly Monday, manual                 |
| Security Gate         | `security.yml`              | Unified security status check: npm audit + source scan + dep-diff + gate job        | push/PR/weekly Monday, manual         |
| Release Drafter       | `release-drafter.yml`       | Auto-draft next GitHub release from merged PR titles + labels                       | push to `main`, PR closed, manual     |
| Sync Labels           | `sync-labels.yml`           | Sync repository labels with `.github/labels.yml`                                    | `labels.yml` change, manual           |

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

- run only after a successful `ci.yml` completion on `main` (or manual dispatch)
- checkout the exact commit SHA that passed CI
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

- it re-runs the repository's canonical production gate (`npm run check`)
- it runs the CI-only supply-chain checks that are not part of `npm run check`
- it packages `dist.zip`
- it attaches `dist.zip`, `sw.js`, and `dist/icon.svg`
- it uses generated release notes plus the repository release-note configuration in `.github/release.yml`

## Change Rules

- If you edit a workflow, update `.github/instructions/cicd.instructions.md` when the conventions change.
- If you add or remove a workflow, update this README and `.github/AGENTS.md`.
- If you add a secret or environment requirement, document it here and in the relevant workflow comments.
- Do not silently change action major versions or the Node support matrix without documenting why.

---

## Permissions Matrix

| Workflow                    | contents | pages | id-token | deployments | pull-requests | security-events | issues |
| --------------------------- | -------- | ----- | -------- | ----------- | ------------- | --------------- | ------ |
| `ci.yml`                    | read     | —     | —        | —           | read          | —               | —      |
| `deploy.yml`                | read     | write | write    | —           | —             | —               | —      |
| `release.yml`               | write    | —     | —        | write       | —             | —               | —      |
| `deploy-worker.yml`         | read     | —     | —        | —           | —             | —               | —      |
| `auto-label.yml`            | read     | —     | —        | —           | write         | —               | —      |
| `dependabot-auto-merge.yml` | write    | —     | —        | —           | write         | —               | —      |
| `codeql.yml`                | read     | —     | —        | —           | —             | write           | —      |
| `scorecard.yml`             | read-all | —     | write    | —           | —             | write           | —      |
| `stale.yml`                 | —        | —     | —        | —           | write         | —               | write  |
| `supply-chain.yml`          | read     | —     | —        | —           | write         | —               | write  |
| `perf-regression.yml`       | read     | —     | —        | —           | write         | —               | —      |
| `trivy.yml`                 | read     | —     | —        | —           | —             | write           | —      |
| `trufflehog.yml`            | read     | —     | —        | —           | —             | —               | —      |
| `zap-baseline.yml`          | read     | —     | —        | —           | —             | —               | write  |
| `sbom.yml`                  | read     | —     | —        | —           | —             | —               | —      |
| `visual-baselines.yml`      | write    | —     | —        | —           | —             | —               | —      |
| `branch-protection.yml`     | read     | —     | —        | —           | —             | —               | —      |
| `security.yml`              | read     | —     | —        | —           | —             | —               | —      |
| `release-drafter.yml`       | write    | —     | —        | —           | read          | —               | —      |
| `sync-labels.yml`           | —        | —     | —        | —           | —             | —               | write  |

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

- `ci.yml` — cancel older runs on the same branch or PR ref.
- `deploy.yml` — cancel older deploys. Only one Pages deploy active at a time.
- `release.yml` — cancel older in-progress runs for the same tag ref.
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
