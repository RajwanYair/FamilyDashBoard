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
# =============================================================================
set -euo pipefail

echo "→ Installing CI toolchain…"

npm install --no-save --no-package-lock \
  "typescript@^5.9.3" \
  "vite@^8.0.8" \
  "vitest@^4.1.4" \
  "@vitest/coverage-v8@^4.1.4" \
  "eslint@^10.2.0" \
  "typescript-eslint@^8.31.0" \
  "@eslint/js@^10.2.0" \
  "happy-dom@^20.8.9"

echo "✅ CI toolchain installed"
