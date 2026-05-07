#!/usr/bin/env node
/**
 * check-build-artifacts-untracked.mjs — / v13.45.0
 *
 * Fails CI if any build-time artefact has crept into the git index:
 *   - dist/                      (Vite build output)
 *   - coverage/                  (Vitest coverage report)
 *   - *.tsbuildinfo              (TS incremental cache)
 *   - .eslintcache               (ESLint cache)
 *   - cov.log / *.log            (stray test log files)
 *   - test-results/              (Playwright artifact dir)
 *
 * The .gitignore already lists these, but accidental `git add -f` or
 * a misconfigured editor can still slip them in. This guard makes the
 * pre-release zero-tolerance policy mechanical.
 *
 * No external deps; ES modules; PowerShell-friendly.
 */

import { execSync } from "node:child_process";
import process from "node:process";

const FORBIDDEN_PATTERNS = [
  /^dist\//,
  /^coverage\//,
  /^test-results\//,
  /\.tsbuildinfo$/,
  /^\.eslintcache$/,
  /^cov\.log$/,
];

let tracked;
try {
  tracked = execSync("git ls-files", { encoding: "utf8" });
} catch (err) {
  console.error(`✗ git ls-files failed: ${err.message}`);
  process.exit(2);
}

const offenders = tracked
  .split(/\r?\n/)
  .filter((line) => line.length > 0)
  .filter((line) => FORBIDDEN_PATTERNS.some((re) => re.test(line)));

if (offenders.length > 0) {
  console.error("✗ The following build artefacts are tracked in git:");
  for (const f of offenders) console.error(`  - ${f}`);
  console.error("\nRun: git rm -r --cached <path> and commit the removal.");
  process.exit(1);
}

console.log("✓ No tracked build artefacts (dist/, coverage/, *.tsbuildinfo, ...).");
