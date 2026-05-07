#!/usr/bin/env node
/**
 * TC39 Temporal polyfill size gate.
 *
 * The ROADMAP gates adoption of TC39 Temporal (for hebrew-cal, calendar,
 * countdown) on the polyfill being ≤ 10 KB gzip.  This script checks
 * whether `@js-temporal/polyfill` is installed and, if so, measures its
 * gzip size against the budget.
 *
 * If the polyfill is not installed, the gate is CLOSED (prints info, exits 0).
 * If installed and ≤ budget, the gate is OPEN (exits 0 with advisory).
 * If installed and > budget, the gate is CLOSED (exits 0 with warning).
 *
 * This script is INFORMATIONAL — it always exits 0.
 *
 * Usage:
 *   node scripts/check-temporal-polyfill-size.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const BUDGET_KB = 10;

/**
 * Recursively sum file sizes under a directory.
 * @param {string} dir
 * @returns {number}
 */
function totalSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += totalSize(full);
    } else {
      total += statSync(full).size;
    }
  }
  return total;
}

// Check if the polyfill is installed (in parent node_modules per project convention)
const candidates = [
  join(root, "node_modules", "@js-temporal", "polyfill"),
  join(root, "..", "node_modules", "@js-temporal", "polyfill"),
];

const polyDir = candidates.find((c) => existsSync(c));

if (!polyDir) {
  console.log("ℹ️  @js-temporal/polyfill is NOT installed — gate CLOSED (deferred).");
  console.log("   Temporal adoption is gated on polyfill ≤ 10 KB gzip.");
  process.exit(0);
}

// Measure the main entry point gzip size
const pkgPath = join(polyDir, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const mainEntry = pkg.main || pkg.module || "index.js";
const entryPath = join(polyDir, mainEntry);

if (!existsSync(entryPath)) {
  console.log(`⚠️  Polyfill entry ${mainEntry} not found — cannot measure. Gate CLOSED.`);
  process.exit(0);
}

const raw = readFileSync(entryPath);
const gzipped = gzipSync(raw);
const sizeKB = (gzipped.length / 1024).toFixed(1);
const rawSizeKB = (raw.length / 1024).toFixed(1);

console.log(`📦  @js-temporal/polyfill v${pkg.version}`);
console.log(`   Entry: ${mainEntry}`);
console.log(`   Raw: ${rawSizeKB} KB  |  Gzip: ${sizeKB} KB  |  Budget: ${BUDGET_KB} KB`);

if (parseFloat(sizeKB) <= BUDGET_KB) {
  console.log(`✅  Gate OPEN — polyfill fits within ${BUDGET_KB} KB gzip budget.`);
  console.log("   Temporal adoption can proceed per ROADMAP §6.2.");
} else {
  console.log(`⚠️  Gate CLOSED — polyfill exceeds ${BUDGET_KB} KB gzip budget.`);
  console.log("   Temporal adoption remains deferred until size drops.");
}
