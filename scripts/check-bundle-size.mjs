#!/usr/bin/env node
/**
 * FamilyDashBoard — Bundle Size CI Check
 *
 * Validates that the GitHub Pages production build stays within budget:
 *   JS gzipped:  ≤ 104 KB  (raised from 100 KB in v13.30.0 — 18 sprints of
 *                           configSchema fields + X4 keymap.ts pushed actuals
 *                           to 102.1 KB; new budget = actual + 2 KB headroom)
 *   CSS gzipped: ≤ 29 KB   (raised from 26 KB in v13.30.0 — card configSchema
 *                           form styles and config-panel CSS pushed actual to
 *                           27.8 KB; new budget = actual + 1 KB headroom)
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

const JS_BUDGET_KB = 104;
const CSS_BUDGET_KB = 29;
/** Alert if a bundle type grows more than this fraction vs last baseline. */
const GROWTH_THRESHOLD = 0.1;

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

// ── Per-card JS chunk breakdown ───────────────────────────────────────────────

console.log("\n📊 Per-card chunk breakdown (gzip)\n");

/** Card chunk patterns — maps display label → filename substring. */
const CARD_CHUNKS = [
  ["weather", "weather"],
  ["stocks", "stocks"],
  ["currency", "currency"],
  ["calendar", "calendar"],
  ["hebrew-cal", "hebrew-cal"],
  ["alerts", "alerts"],
  ["motivation", "motivation"],
  ["tasks", "tasks"],
  ["system-info", "system-info"],
  ["countdown", "countdown"],
  ["news", "news"],
];

let chunkFiles;
try {
  chunkFiles = readdirSync(DIST_ASSETS).filter((f) => f.endsWith(".js"));
} catch {
  chunkFiles = [];
}

let cardRows = [];
for (const [label, pattern] of CARD_CHUNKS) {
  const matching = chunkFiles.filter((f) => f.toLowerCase().includes(pattern));
  if (matching.length === 0) continue;
  let totalGz = 0;
  let totalRaw = 0;
  for (const f of matching) {
    const fp = join(DIST_ASSETS, f);
    totalRaw += statSync(fp).size;
    totalGz += gzipSize(fp);
  }
  cardRows.push({ label, rawKb: totalRaw / 1024, gzKb: totalGz / 1024 });
}

// Sort descending by gzip size
cardRows.sort((a, b) => b.gzKb - a.gzKb);

const colW = 14;
const header = `  ${"Card".padEnd(colW)} ${"Raw (KB)".padStart(9)} ${"Gzip (KB)".padStart(10)}`;
console.log(header);
console.log("  " + "─".repeat(colW + 21));
for (const { label, rawKb, gzKb } of cardRows) {
  console.log(
    `  ${label.padEnd(colW)} ${rawKb.toFixed(1).padStart(9)} ${gzKb.toFixed(1).padStart(10)}`,
  );
}
if (cardRows.length === 0) {
  console.log("  (no per-card chunks found — build may use a single IIFE bundle)");
}
console.log();

// ── Per-card 10% delta gate against last baseline ─────────────────────────────
// Fails CI if any card chunk grows > 10% vs the recorded baseline.

if (baseline && baseline.cards && cardRows.length > 0) {
  console.log(`📈 Per-card growth check vs baseline v${baseline.version} (${baseline.date})\n`);
  let cardGrowthOk = true;

  for (const { label, gzKb } of cardRows) {
    const baseKb = baseline.cards[label];
    if (typeof baseKb !== "number" || baseKb === 0) {
      console.log(`  ℹ️   ${label.padEnd(colW)} no baseline — skipping`);
      continue;
    }
    const delta = (gzKb - baseKb) / baseKb;
    const pct = (delta * 100).toFixed(1);
    const sign = delta >= 0 ? "+" : "";
    if (delta > GROWTH_THRESHOLD) {
      console.error(
        `  ❌  ${label.padEnd(colW)} grew ${sign}${pct}% (${baseKb.toFixed(1)} → ${gzKb.toFixed(1)} KB) — exceeds ${GROWTH_THRESHOLD * 100}% limit`,
      );
      cardGrowthOk = false;
    } else {
      console.log(
        `  ✅  ${label.padEnd(colW)} ${sign}${pct}% (${baseKb.toFixed(1)} → ${gzKb.toFixed(1)} KB)`,
      );
    }
  }
  console.log();
  if (!cardGrowthOk) {
    process.exit(1);
  }
}

// ── Per-card SOURCE folder size delta (F17) ────────────────────────────────
// Measures uncompressed source bytes in src/cards/<name>/ for early warning
// before a build.  Fails CI if any card's source grew > 10% vs baseline.

const SRC_CARDS_DIR = resolve(process.cwd(), "src", "cards");
const SOURCE_EXTS = [".ts", ".css", ".html"];

/**
 * Sum the sizes of all source files (by extension) inside a directory tree.
 * @param {string} dir
 * @returns {number} total bytes
 */
function cardSourceBytes(dir) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += cardSourceBytes(fullPath);
    } else if (entry.isFile() && SOURCE_EXTS.some((ext) => entry.name.endsWith(ext))) {
      try {
        total += statSync(fullPath).size;
      } catch {
        // skip unreadable
      }
    }
  }
  return total;
}

console.log("📂 Per-card source folder sizes\n");

/** @type {Array<{name: string, sourceKb: number}>} */
const cardSourceRows = [];
let srcEntries;
try {
  srcEntries = readdirSync(SRC_CARDS_DIR, { withFileTypes: true });
} catch {
  srcEntries = [];
}

for (const entry of srcEntries) {
  if (!entry.isDirectory()) continue;
  if (entry.name === "base-card.ts") continue; // file, not dir
  const bytes = cardSourceBytes(join(SRC_CARDS_DIR, entry.name));
  if (bytes === 0) continue;
  cardSourceRows.push({ name: entry.name, sourceKb: bytes / 1024 });
}

cardSourceRows.sort((a, b) => b.sourceKb - a.sourceKb);
const srcColW = 14;
const srcHeader = `  ${"Card".padEnd(srcColW)} ${"Source (KB)".padStart(12)}`;
console.log(srcHeader);
console.log("  " + "─".repeat(srcColW + 14));
for (const { name, sourceKb } of cardSourceRows) {
  console.log(`  ${name.padEnd(srcColW)} ${sourceKb.toFixed(1).padStart(12)}`);
}
console.log();

// ── Per-card source delta gate ────────────────────────────────────────────────

if (baseline && baseline.cardSource && cardSourceRows.length > 0) {
  console.log(
    `📈 Per-card source growth check vs baseline v${baseline.version} (${baseline.date})\n`,
  );
  let srcGrowthOk = true;

  for (const { name, sourceKb } of cardSourceRows) {
    const baseKb = baseline.cardSource[name];
    if (typeof baseKb !== "number" || baseKb === 0) {
      console.log(`  ℹ️   ${name.padEnd(srcColW)} no baseline — skipping`);
      continue;
    }
    const delta = (sourceKb - baseKb) / baseKb;
    const pct = (delta * 100).toFixed(1);
    const sign = delta >= 0 ? "+" : "";
    if (delta > GROWTH_THRESHOLD) {
      console.error(
        `  ❌  ${name.padEnd(srcColW)} source grew ${sign}${pct}% (${baseKb.toFixed(1)} → ${sourceKb.toFixed(1)} KB) — exceeds ${GROWTH_THRESHOLD * 100}% limit`,
      );
      srcGrowthOk = false;
    } else {
      console.log(
        `  ✅  ${name.padEnd(srcColW)} ${sign}${pct}% (${baseKb.toFixed(1)} → ${sourceKb.toFixed(1)} KB)`,
      );
    }
  }
  console.log();
  if (!srcGrowthOk) {
    process.exit(1);
  }
}

// ── Sprint 336 / D13: per-card source hard-cap ────────────────────────────
// Hard-cap any single card's raw source at 80 KB. The aspirational target
// (≤ 6 KB gzip ≈ ≤ 24 KB raw) is tracked in ROADMAP §1.11 D13 — this is
// the runaway-growth guardrail, not the destination.
//
// Sprint 349 (v13.36.0): ratchet warn-cap 50 → 48 KB. Each release lowers
// by 2 KB until we reach the v14.0 target of warn 30 / hard 60.
// Sprint 360 (v13.37.0): ratchet 48 → 46 KB.
// Sprint 370 (v13.38.0): ratchet 46 → 44 KB.
// Sprint 380 (v13.39.0): ratchet 44 → 42 KB.
const PER_CARD_HARD_CAP_KB = 80;
const PER_CARD_WARN_KB = 42;
let perCardCapOk = true;
console.log(`📏 Per-card source hard-cap: ${PER_CARD_HARD_CAP_KB} KB (warn ${PER_CARD_WARN_KB} KB)\n`);
for (const { name, sourceKb } of cardSourceRows) {
  if (sourceKb > PER_CARD_HARD_CAP_KB) {
    console.error(
      `  ❌  ${name.padEnd(srcColW)} ${sourceKb.toFixed(1)} KB exceeds ${PER_CARD_HARD_CAP_KB} KB hard-cap`,
    );
    perCardCapOk = false;
  } else if (sourceKb > PER_CARD_WARN_KB) {
    console.log(
      `  ⚠️  ${name.padEnd(srcColW)} ${sourceKb.toFixed(1)} KB (over ${PER_CARD_WARN_KB} KB warn — refactor candidate)`,
    );
  }
}
console.log();
if (!perCardCapOk) {
  process.exit(1);
}
