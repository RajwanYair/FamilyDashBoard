#!/usr/bin/env node
// @ts-check
/**
 * check-version-consistency.mjs — Sprint 171
 *
 * Asserts that every documentation file that embeds the project version
 * matches the canonical `version` from package.json. Prevents the recurring
 * problem of stale version strings drifting in `.github/AGENTS.md`,
 * `.github/copilot-instructions.md`, and similar files between releases.
 *
 * Each entry below pins:
 *   - file:    path relative to repo root
 *   - regex:   pattern with one capturing group that yields the version
 *   - label:   human-readable description for error output
 *
 * Exits 1 if any file disagrees with package.json. Wired into CI.
 *
 * Usage: node scripts/check-version-consistency.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
/** @type {string} */
const expected = pkg.version;

/** @type {{file: string, regex: RegExp, label: string}[]} */
const targets = [
  {
    file: "sw.js",
    regex: /FamilyDashBoard ServiceWorker\s+—\s+v(\d+\.\d+\.\d+)/,
    label: "sw.js header comment",
  },
  {
    file: "README.md",
    regex: /badge\/Version-(\d+\.\d+\.\d+)-/,
    label: "README.md Version badge",
  },
  {
    file: ".github/copilot-instructions.md",
    regex: /FamilyDashBoard\s+v(\d+\.\d+\.\d+)/,
    label: ".github/copilot-instructions.md title",
  },
  {
    file: ".github/AGENTS.md",
    regex: /Version:\s*v(\d+\.\d+\.\d+)/,
    label: ".github/AGENTS.md header",
  },
  {
    file: ".github/instructions/workspace.instructions.md",
    regex: /FamilyDashBoard\s+—\s+v(\d+\.\d+\.\d+)/,
    label: ".github/instructions/workspace.instructions.md title",
  },
  {
    file: "docs/ARCHITECTURE.md",
    regex: /Architecture\s*\(v(\d+\.\d+\.\d+)\)/,
    label: "docs/ARCHITECTURE.md title",
  },
  {
    file: "docs/security.md",
    regex: /Security Model\s+—\s+FamilyDashBoard\s+v(\d+\.\d+\.\d+)/,
    label: "docs/security.md title",
  },
];

let failed = 0;
for (const { file, regex, label } of targets) {
  let content;
  try {
    content = readFileSync(resolve(root, file), "utf-8");
  } catch {
    console.error(`❌  ${file} — file not found`);
    failed++;
    continue;
  }
  const match = content.match(regex);
  if (!match || !match[1]) {
    console.error(`❌  ${label}: could not locate version (regex: ${regex.source})`);
    failed++;
    continue;
  }
  if (match[1] !== expected) {
    console.error(
      `❌  ${label}: found v${match[1]}, expected v${expected} (package.json)`,
    );
    failed++;
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} version mismatch${failed === 1 ? "" : "es"} — update files or run /version-bump.`,
  );
  process.exit(1);
}

console.log(`✅  All ${targets.length} files match package.json v${expected}`);
