#!/usr/bin/env node
/**
 * FamilyDashBoard — Bundle Size CI Check
 *
 * Validates that the GitHub Pages production build stays within budget:
 *   JS gzipped:  ≤ 100 KB
 *   CSS gzipped: ≤ 25 KB
 *
 * Also checks for 10% growth regression against the last baseline recorded
 * in scripts/bundle-trend.json.  Exit 1 on budget exceeded OR on > 10% growth.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs
 *
 * Prerequisite: run `npx vite build` first.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST_ASSETS = resolve(process.cwd(), "dist", "assets");
const TREND_FILE = resolve(process.cwd(), "scripts", "bundle-trend.json");

const JS_BUDGET_KB = 100;
const CSS_BUDGET_KB = 25;
/** Alert if a bundle type grows more than this fraction vs last baseline. */
const GROWTH_THRESHOLD = 0.10;

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
// ── 10% growth regression check against last trend baseline ────────────────

/** @returns {{ jsKb: number, cssKb: number } | null} */
function loadLastBaseline() {
  if (!existsSync(TREND_FILE)) return null;
  try {
    const history = JSON.parse(readFileSync(TREND_FILE, "utf-8"));
    if (!Array.isArray(history) || history.length === 0) return null;
    return history[history.length - 1];
  } catch {
    return null;
  }
}

/** Measure current totals without re-printing per-file lines. */
function measureTotal(ext) {
  let totalGz = 0;
  try {
    const files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(ext));
    for (const file of files) {
      totalGz += gzipSize(join(DIST_ASSETS, file));
    }
  } catch {
    // dist not found — already caught above
  }
  return totalGz / 1024;
}

const baseline = loadLastBaseline();
if (baseline) {
  console.log(`\n📈 Growth check vs baseline v${baseline.version} (${baseline.date})\n`);
  let growthOk = true;

  const currentJs = measureTotal(".js");
  const currentCss = measureTotal(".css");

  const jsDelta = baseline.jsKb > 0 ? (currentJs - baseline.jsKb) / baseline.jsKb : 0;
  const cssDelta = baseline.cssKb > 0 ? (currentCss - baseline.cssKb) / baseline.cssKb : 0;

  const jsPct = (jsDelta * 100).toFixed(1);
  const cssPct = (cssDelta * 100).toFixed(1);

  if (jsDelta > GROWTH_THRESHOLD) {
    console.error(
      `❌  JS grew ${jsPct}% (${baseline.jsKb} → ${currentJs.toFixed(1)} KB) — exceeds ${GROWTH_THRESHOLD * 100}% limit`,
    );
    growthOk = false;
  } else {
    const sign = jsDelta >= 0 ? "+" : "";
    console.log(`✅  JS growth ${sign}${jsPct}% (${baseline.jsKb} → ${currentJs.toFixed(1)} KB)`);
  }

  if (cssDelta > GROWTH_THRESHOLD) {
    console.error(
      `❌  CSS grew ${cssPct}% (${baseline.cssKb} → ${currentCss.toFixed(1)} KB) — exceeds ${GROWTH_THRESHOLD * 100}% limit`,
    );
    growthOk = false;
  } else {
    const sign = cssDelta >= 0 ? "+" : "";
    console.log(
      `✅  CSS growth ${sign}${cssPct}% (${baseline.cssKb} → ${currentCss.toFixed(1)} KB)`,
    );
  }

  if (!growthOk) {
    process.exit(1);
  }
} else {
  console.log(
    "ℹ️   No baseline found in bundle-trend.json — skipping growth check.\n" +
      "    Run `npm run bundle:trend` after a successful build to record one.",
  );
}
