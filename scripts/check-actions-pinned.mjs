#!/usr/bin/env node
/**
 * GitHub Actions SHA-pin enforcement check.
 *
 * Scans every `.github/workflows/*.yml` and `.github/workflows/*.yaml` for
 * `uses:` references that are NOT pinned to a full 40-character commit SHA.
 * Exits 1 if any unpinned actions are found, preventing supply-chain attacks
 * via mutable tag references (e.g. `actions/checkout@v4`).
 *
 * Allowed:   actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
 * Violation: actions/checkout@v4
 * Violation: actions/checkout@main
 * Violation: actions/checkout  (no ref at all)
 *
 * Suppress a line with:  # pin-allow  (with justification comment)
 *
 * Usage:
 *   node scripts/check-actions-pinned.mjs
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WORKFLOWS_DIR = join(ROOT, ".github", "workflows");

/** Matches a full 40-hex-char SHA. */
const SHA_RE = /^[0-9a-f]{40}$/i;

/** Parse `uses: owner/repo@REF` from a YAML line. */
const USES_RE = /^\s*-?\s*uses:\s*(\S+)/;

/**
 * Collect all .yml / .yaml files under a directory (non-recursive).
 * @param {string} dir
 * @returns {string[]}
 */
function collectYmlFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

const files = collectYmlFiles(WORKFLOWS_DIR);

if (files.length === 0) {
  console.log("⚠️  No workflow files found in .github/workflows/ — skipping.");
  process.exit(0);
}

/** @type {{ file: string; line: number; ref: string; code: string }[]} */
const violations = [];

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Explicit suppression
    if (line.includes("pin-allow")) continue;

    const m = USES_RE.exec(line);
    if (!m) continue;

    const usesValue = m[1]; // e.g. "actions/checkout@v4"
    const atIdx = usesValue.lastIndexOf("@");

    if (atIdx === -1) {
      // No ref at all
      violations.push({ file: rel, line: i + 1, ref: "(none)", code: line.trim() });
      continue;
    }

    const ref = usesValue.slice(atIdx + 1);
    if (!SHA_RE.test(ref)) {
      violations.push({ file: rel, line: i + 1, ref, code: line.trim() });
    }
  }
}

if (violations.length === 0) {
  console.log(
    `✅ Actions SHA-pin check passed — all ${files.length} workflow file(s) use SHA-pinned actions.`,
  );
  process.exit(0);
}

console.error(`\n❌ Unpinned GitHub Actions found (${violations.length} violation(s)):\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  ref="${v.ref}"`);
  console.error(`    > ${v.code}`);
}
console.error(`
Fix: pin each action to its full commit SHA and add a version comment.
Example:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

To suppress a known exception, add:  # pin-allow  with a justification.
`);
process.exit(1);
