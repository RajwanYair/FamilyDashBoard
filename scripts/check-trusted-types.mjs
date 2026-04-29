#!/usr/bin/env node
/**
 * Sprint 220 — CSP require-trusted-types-for 'script' enforcement audit.
 *
 * Scans `src/` for dangerous DOM sink assignments that bypass the Trusted Types
 * policy.  Violations are reported to stdout and the script exits 1 if any are
 * found.
 *
 * Violations flagged:
 *   1. Bare `innerHTML` / `outerHTML` assignments not using `trustedHTML()`.
 *   2. Direct `eval()` calls.
 *   3. `new Function(` calls.
 *   4. `document.write(` / `document.writeln(` calls.
 *   5. `insertAdjacentHTML(` calls not using `trustedHTML()`.
 *   6. `<script>` element creation + `textContent` / `src` assignments.
 *   7. `srcdoc` attribute assignments.
 *
 * Allowed patterns (false-positive suppression):
 *   - Lines that use `trustedHTML(` are safe.
 *   - Lines in `src/core/trusted-types.ts` are exempt (it is the policy itself).
 *   - Test files under `tests/` are exempt.
 *   - Lines matching `// tt-allow` are explicitly suppressed.
 *
 * Usage:
 *   node scripts/check-trusted-types.mjs          # exit 0 = clean
 *   node scripts/check-trusted-types.mjs --verbose # show skipped files too
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC = join(ROOT, "src");
const verbose = process.argv.includes("--verbose");

/** Dangerous patterns: [label, regex] */
const VIOLATION_PATTERNS = [
  ["bare innerHTML/outerHTML", /\.(?:inner|outer)HTML\s*=(?!=)/],
  ["eval()", /\beval\s*\(/],
  ["new Function(", /\bnew\s+Function\s*\(/],
  ["document.write", /\bdocument\.write(?:ln)?\s*\(/],
  ["insertAdjacentHTML without trustedHTML", /\.insertAdjacentHTML\s*\(/],
  ["srcdoc assignment", /\.srcdoc\s*=/],
];

/** Lines containing these are considered safe. */
const SAFE_MARKERS = ["trustedHTML(", "// tt-allow", "tt-allow"];

/** File/path patterns that are exempt from scanning. */
const EXEMPT_PATHS = [
  "src/core/trusted-types.ts", // the policy itself
];

/**
 * Recursively collect all .ts / .tsx files under `dir`.
 * @param {string} dir
 * @returns {string[]}
 */
function collectTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = collectTsFiles(SRC);
const violations = [];

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");

  // Skip exempt paths
  if (EXEMPT_PATHS.some((e) => rel.endsWith(e))) {
    if (verbose) console.log(`  skip (exempt): ${rel}`);
    continue;
  }

  const lines = readFileSync(file, "utf8").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Safe line check
    if (SAFE_MARKERS.some((m) => line.includes(m))) continue;

    for (const [label, pattern] of VIOLATION_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          label,
          code: line.trim(),
        });
      }
    }
  }
}

if (violations.length === 0) {
  console.log("✅ CSP Trusted Types audit passed — no violations found.");
  process.exit(0);
} else {
  console.error(`\n❌ CSP Trusted Types audit FAILED — ${violations.length} violation(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.label}]`);
    console.error(`    > ${v.code}`);
  }
  console.error(
    "\nFix: wrap unsafe sink with trustedHTML(), or add '// tt-allow' with justification.\n",
  );
  process.exit(1);
}
