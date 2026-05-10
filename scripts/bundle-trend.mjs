#!/usr/bin/env node
/**
 * FamilyDashBoard — Bundle Trend Tracker
 *
 * Appends the current build's gzip sizes to `scripts/bundle-trend.json`
 * so developers can track bundle growth over time.
 *
 * Each record:
 *   { "date": "2026-06-22", "version": "7.16.0", "jsKb": 88.4, "cssKb": 17.2,
 *     "cards": { "weather": 12.3, "stocks": 8.1, ... } }
 *
 * Usage:
 *   node scripts/bundle-trend.mjs [version]
 *   node scripts/bundle-trend.mjs --ci            # output JSON to stdout only (no file write)
 *   node scripts/bundle-trend.mjs --ci [version]
 *
 * Prerequisite: run `npx vite build` first (dist/assets must exist).
 *
 * Output: scripts/bundle-trend.json (created if absent, appended otherwise)
 *         With --ci, writes JSON to stdout and exits without modifying the file.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";

const CI_MODE = process.argv.includes("--ci");
const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const DIST_ASSETS = resolve(process.cwd(), "dist", "assets");
const TREND_FILE = resolve(process.cwd(), "scripts", "bundle-trend.json");

function gzipSize(filePath) {
  const raw = readFileSync(filePath);
  return gzipSync(raw).length;
}

function toKb(bytes) {
  return parseFloat((bytes / 1024).toFixed(1));
}

// ── Collect sizes from dist/assets ─────────────────────────────────────────

if (!existsSync(DIST_ASSETS)) {
  console.error('[bundle-trend] dist/assets not found — run "npx vite build" first.');
  process.exit(1);
}

const files = readdirSync(DIST_ASSETS);
let jsBytes = 0;
let cssBytes = 0;

for (const file of files) {
  const fullPath = join(DIST_ASSETS, file);
  if (!statSync(fullPath).isFile()) continue;
  if (file.endsWith(".js")) jsBytes += gzipSize(fullPath);
  if (file.endsWith(".css")) cssBytes += gzipSize(fullPath);
}

// ── Per-card chunk sizes ───────────────────────────────────────────────────

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

const jsFiles = files.filter((f) => f.endsWith(".js"));
/** @type {Record<string, number>} */
const cardSizes = {};
for (const [label, pattern] of CARD_CHUNKS) {
  const matching = jsFiles.filter((f) => f.toLowerCase().includes(pattern));
  if (matching.length === 0) continue;
  let totalGz = 0;
  for (const f of matching) {
    totalGz += gzipSize(join(DIST_ASSETS, f));
  }
  cardSizes[label] = toKb(totalGz);
}

// ── Per-card source folder sizes (F17) ────────────────────────────────────

const SRC_CARDS_DIR = resolve(process.cwd(), "src", "cards");
const SOURCE_EXTS = [".ts", ".css", ".html"];

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
        /* skip */
      }
    }
  }
  return total;
}

/** @type {Record<string, number>} */
const cardSourceSizes = {};
let srcDirs;
try {
  srcDirs = readdirSync(SRC_CARDS_DIR, { withFileTypes: true });
} catch {
  srcDirs = [];
}
for (const entry of srcDirs) {
  if (!entry.isDirectory()) continue;
  const bytes = cardSourceBytes(join(SRC_CARDS_DIR, entry.name));
  if (bytes > 0) cardSourceSizes[entry.name] = parseFloat((bytes / 1024).toFixed(1));
}

const record = {
  date: new Date().toISOString().slice(0, 10),
  version: process.argv.filter((a) => a !== "--ci")[2] ?? pkg.version,
  jsKb: toKb(jsBytes),
  cssKb: toKb(cssBytes),
  ...(Object.keys(cardSizes).length > 0 && { cards: cardSizes }),
  ...(Object.keys(cardSourceSizes).length > 0 && { cardSource: cardSourceSizes }),
};

// ── CI mode: output JSON to stdout only ────────────────────────────────────

if (CI_MODE) {
  process.stdout.write(JSON.stringify(record, null, 2) + "\n");
  process.exit(0);
}

// ── Read+append or create ──────────────────────────────────────────────────

let history = [];
if (existsSync(TREND_FILE)) {
  try {
    history = JSON.parse(readFileSync(TREND_FILE, "utf-8"));
  } catch {
    console.warn("[bundle-trend] Existing trend file corrupt — resetting.");
  }
}

history.push(record);
writeFileSync(TREND_FILE, JSON.stringify(history, null, 2) + "\n", "utf-8");

console.log(
  `[bundle-trend] Recorded v${record.version} on ${record.date}: ` +
    `JS ${record.jsKb} KB · CSS ${record.cssKb} KB` +
    (record.cards ? ` · ${Object.keys(record.cards).length} card chunks` : "") +
    ` (${history.length} entries total)`,
);
