#!/usr/bin/env bash
# =============================================================================
# CI Toolchain Installer — FamilyDashBoard
#
# Installs the repository-local root and Worker toolchains from their committed
# lockfiles. The package manifests and lockfiles are the source of truth.
#
# Usage (from repo root):
#   bash .github/ci/install-tools.sh
#
# Local development uses the same root `npm ci`/`npm install` workflow.
#
# Vendored shared configs live in tooling/ (tsconfig/, eslint/, vitest/).
# Vendored shared configs remain repository-local and independent of installation.
# =============================================================================
set -euo pipefail

echo "→ Installing CI toolchain…"

if [[ ! -f package-lock.json ]]; then
  echo "package-lock.json is required at the repository root" >&2
  exit 1
fi

echo "-> Installing root dependencies from package-lock.json..."
npm ci --ignore-scripts

echo "-> Installing Worker dependencies from worker/package-lock.json..."
# Worker source imports `hono` and `valibot`; both need to resolve from
# worker/node_modules when running `tsc --project worker/tsconfig.json`.
# Worker package.json and worker/package-lock.json own those dependencies.
(
  cd worker
  npm ci --ignore-scripts
)

echo "-> Verifying repository-local CLI entry points..."
for binary in \
  tsc vite vitest eslint stylelint markdownlint-cli2 oxlint prettier \
  cyclonedx-npm lhci license-checker markdown-link-check serve changeset \
  commitlint playwright stryker; do
  if [[ ! -x "./node_modules/.bin/$binary" ]]; then
    echo "Missing local CLI: $binary" >&2
    exit 1
  fi
  "./node_modules/.bin/$binary" --version >/dev/null
done

echo "✅ CI toolchain installed"
