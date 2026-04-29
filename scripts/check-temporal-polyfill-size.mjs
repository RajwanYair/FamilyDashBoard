#!/usr/bin/env node
/**
 * FamilyDashBoard — Temporal Polyfill Size Gate
 *
 * Roadmap item #3: "Replace ad-hoc date math with TC39 Temporal in
 * hebrew-cal / calendar / countdown once @js-temporal/polyfill ≤ 10 KB gzip."
 *
 * Checks the installed (or npm-resolved) size of @js-temporal/polyfill
 * and reports whether the adoption gate is met.
 *
 * Exit codes:
 *   0 — polyfill ≤ GATE_KB gzip   → gate OPEN  (safe to adopt)
 *   1 — polyfill > GATE_KB gzip   → gate CLOSED (too large, skip)
 *   2 — polyfill not installed     → gate CLOSED (not yet published/installed)
 *
 * Usage:
 *   node scripts/check-temporal-polyfill-size.mjs
 *
 * CI integration (optional): add to package.json scripts and call from
 * the quarterly dependency-review step; it is NOT a blocking CI check
 * because the gate is informational — the dependency is not a build input.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";

/** Adoption gate: polyfill must be ≤ this size (gzip) to proceed. */
const GATE_KB = 10;

/**
 * Candidate module entry points for @js-temporal/polyfill — the package
 * has changed its main export across versions.
 */
const CANDIDATE_DIRS = [
  // Sibling MyScripts node_modules (shared deps convention)
  resolve(process.cwd(), "..", "node_modules", "@js-temporal", "polyfill"),
  // Local (should not exist per project rules, but handle gracefully)
  resolve(process.cwd(), "node_modules", "@js-temporal", "polyfill"),
];

const ENTRY_CANDIDATES = ["lib/index.umd.js", "lib/index.cjs", "index.js"];

function toKb(bytes) {
  return (bytes / 1024).toFixed(2);
}

function findPolyfillEntry() {
  for (const dir of CANDIDATE_DIRS) {
    if (!existsSync(dir)) continue;

    // Try known entry candidates
    for (const entry of ENTRY_CANDIDATES) {
      const p = join(dir, entry);
      if (existsSync(p)) return p;
    }

    // Fall back to package.json "main"
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        const main = pkg.module ?? pkg.main;
        if (main) {
          const p = join(dir, main);
          if (existsSync(p)) return p;
        }
      } catch {
        // Malformed package.json — skip
      }
    }
  }
  return null;
}

const entryPath = findPolyfillEntry();

if (!entryPath) {
  console.log(
    "ℹ️  @js-temporal/polyfill not found in node_modules.\n" +
      "   Gate status: CLOSED (not installed)\n" +
      "   Roadmap #3: adoption blocked — install polyfill to measure.\n" +
      `   Gate threshold: ${GATE_KB} KB gzip`
  );
  process.exit(2);
}

let rawSize;
try {
  const contents = readFileSync(entryPath);
  rawSize = gzipSync(contents).length;
} catch (err) {
  console.error(`❌  Failed to read/compress polyfill entry: ${entryPath}`);
  console.error(err.message);
  process.exit(1);
}

const rawKb = parseFloat(toKb(rawSize));
const gateMet = rawKb <= GATE_KB;
const status = gateMet ? "OPEN ✅" : "CLOSED ❌";
const verdict = gateMet
  ? "Gate MET — safe to adopt Temporal in hebrew-cal / calendar / countdown (Roadmap #3)."
  : `Gate NOT met — polyfill too large. Wait for a smaller release.\n` +
    `   Roadmap #3: adoption blocked until ≤ ${GATE_KB} KB gzip.`;

console.log(
  `📦  @js-temporal/polyfill entry: ${entryPath}\n` +
    `    Gzip size:       ${rawKb} KB\n` +
    `    Gate threshold:  ${GATE_KB} KB\n` +
    `    Gate status:     ${status}\n` +
    `    ${verdict}`
);

process.exit(gateMet ? 0 : 1);
