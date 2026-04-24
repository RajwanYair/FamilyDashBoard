#!/usr/bin/env node
/**
 * install-git-hooks.mjs — Sprint 56
 *
 * Copies scripts/git-hooks/pre-commit into .git/hooks/pre-commit and makes
 * it executable. Run once after cloning:
 *
 *   node scripts/install-git-hooks.mjs
 *
 * The pre-commit hook runs `node scripts/check-worker-client.mjs` to ensure
 * worker-client.ts stays in sync with worker/openapi.yaml before every commit.
 */

import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SRC = resolve(__dirname, "git-hooks", "pre-commit");
const HOOKS_DIR = resolve(ROOT, ".git", "hooks");
const DEST = resolve(HOOKS_DIR, "pre-commit");

if (!existsSync(resolve(ROOT, ".git"))) {
  console.error("❌  .git directory not found — run from the repository root.");
  process.exit(1);
}

if (!existsSync(HOOKS_DIR)) {
  mkdirSync(HOOKS_DIR, { recursive: true });
}

copyFileSync(SRC, DEST);
// chmod +x (owner execute bit — ignored on Windows but harmless)
try {
  chmodSync(DEST, 0o755);
} catch {
  // Windows does not support chmod; the hook will still run via Git for Windows
}

console.log(`✅  Installed pre-commit hook → .git/hooks/pre-commit`);
console.log(`   The hook runs: node scripts/check-worker-client.mjs`);
