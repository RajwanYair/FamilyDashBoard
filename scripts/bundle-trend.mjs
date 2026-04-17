#!/usr/bin/env node
/**
 * FamilyDashBoard — Bundle Trend Tracker (Sprint 61)
 *
 * Appends the current build's gzip sizes to `scripts/bundle-trend.json`
 * so developers can track bundle growth over time.
 *
 * Each record:
 *   { "date": "2026-06-22", "version": "7.16.0", "jsKb": 88.4, "cssKb": 17.2 }
 *
 * Usage:
 *   node scripts/bundle-trend.mjs [version]
 *
 * Prerequisite: run `npx vite build` first (dist/assets must exist).
 *
 * Output: scripts/bundle-trend.json (created if absent, appended otherwise)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";

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

const record = {
  date: new Date().toISOString().slice(0, 10),
  version: process.argv[2] ?? pkg.version,
  jsKb: toKb(jsBytes),
  cssKb: toKb(cssBytes),
};

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
    `JS ${record.jsKb} KB · CSS ${record.cssKb} KB (${history.length} entries total)`,
);
