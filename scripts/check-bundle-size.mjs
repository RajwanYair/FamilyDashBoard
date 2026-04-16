#!/usr/bin/env node
/**
 * FamilyDashBoard — Bundle Size CI Check
 *
 * Validates that the GitHub Pages production build stays within budget:
 *   JS gzipped:  ≤ 100 KB
 *   CSS gzipped: ≤ 25 KB
 *
 * Exits 1 if any budget is exceeded (hard failure, not just a warning).
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *
 * Prerequisite: run `npx vite build` first.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST_ASSETS = resolve(process.cwd(), "dist", "assets");

const JS_BUDGET_KB = 100;
const CSS_BUDGET_KB = 25;

function toKb(bytes) {
  return (bytes / 1024).toFixed(1);
}

function gzipSize(filePath) {
  const contents = readFileSync(filePath);
  return gzipSync(contents).length;
}

function checkAssets(ext, budgetKb) {
  let totalGz = 0;
  let files;
  try {
    files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(ext));
  } catch {
    console.error(`\u274C  dist/assets/ not found — run 'npx vite build' first`);
    process.exit(1);
  }

  for (const file of files) {
    const filePath = join(DIST_ASSETS, file);
    const raw = statSync(filePath).size;
    const gz = gzipSize(filePath);
    totalGz += gz;
    console.log(`  ${file}: ${toKb(raw)} KB raw / ${toKb(gz)} KB gzip`);
  }

  const totalKb = totalGz / 1024;
  if (totalKb > budgetKb) {
    console.error(
      `\u274C  ${ext.toUpperCase()} gzip total ${totalKb.toFixed(1)} KB exceeds budget ${budgetKb} KB`,
    );
    return false;
  }
  console.log(
    `\u2705  ${ext.toUpperCase()} gzip total ${totalKb.toFixed(1)} KB \u2264 ${budgetKb} KB budget`,
  );
  return true;
}

console.log("\n\uD83D\uDCE6 Bundle size check\n");
const jsOk = checkAssets(".js", JS_BUDGET_KB);
const cssOk = checkAssets(".css", CSS_BUDGET_KB);

if (!jsOk || !cssOk) {
  process.exit(1);
}
