#!/usr/bin/env bash
# =============================================================================
# CI Toolchain Installer — FamilyDashBoard
#
# Installs all build/test/lint tools for CI without a local package-lock.json.
# Source of truth for tool versions in CI.
#
# Usage (from repo root):
#   bash .github/ci/install-tools.sh
#
# Local development: tools are provided by the parent MyScripts/node_modules/.
# Run `npm install` from MyScripts/ — never from this project directory.
#
# Vendored shared configs live in tooling/ (tsconfig/, eslint/, vitest/).
# Keep versions here in sync with MyScripts/tooling/ after upgrades.
# =============================================================================
set -euo pipefail

echo "→ Installing CI toolchain…"

npm install --no-save --no-package-lock \
  "typescript@^6.0.3" \
  "vite@^8.0.9" \
  "vitest@^4.1.5" \
  "@vitest/coverage-v8@^4.1.5" \
  "eslint@^10.2.1" \
  "oxlint@^1.61.0" \
  "typescript-eslint@^8.59.0" \
  "@eslint/js@^10.0.1" \
  "happy-dom@^20.9.0" \
  "prettier@^3.5.0" \
  "markdownlint-cli2@^0.22.0" \
  "zod@^3.24.0" \
  "@cloudflare/workers-types@^4.0.0" \
  "fast-check@^4.7.0"

echo "→ Installing worker runtime + type deps (for worker typecheck + worker tests)…"
# Worker source imports `hono` and `valibot`; both need to resolve from
# worker/node_modules when running `tsc --project worker/tsconfig.json`.
# `@cloudflare/workers-types` provides the runtime ambient types referenced
# in worker/tsconfig.json `"types"` field. Versions kept in sync with
# worker/package.json — bump in both places.
(
  cd worker
  npm install --no-save --no-package-lock \
    "hono@^4.12.14" \
    "valibot@^1.3.1" \
    "@cloudflare/workers-types@^4.0.0" \
    "typescript@^6.0.3"
)

echo "✅ CI toolchain installed"
