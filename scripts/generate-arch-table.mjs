#!/usr/bin/env node
/**
 * FamilyDashBoard — Architecture Card Table Generator (Sprint 24 V12-DX-2)
 *
 * Scans src/cards/ to discover all card directories and produces a Markdown
 * table suitable for ARCHITECTURE.md.  The table includes:
 *   - Card ID (directory name)
 *   - Source files count
 *   - Whether the card has a worker-layer adapter (*-adapter.ts)
 *   - Whether a Vitest test file exists in tests/unit/cards/
 *   - CSS layer file presence
 *
 * Usage:
 *   node scripts/generate-arch-table.mjs
 *   node scripts/generate-arch-table.mjs --check   (exit 1 if any card has no test)
 *
 * Output goes to stdout so it can be piped:
 *   node scripts/generate-arch-table.mjs >> ARCHITECTURE.md
 */

import { readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CARDS_DIR = join(ROOT, "src", "cards");
const TESTS_DIR = join(ROOT, "tests", "unit", "cards");

const checkMode = process.argv.includes("--check");

/** @param {string} dir */
function countTs(dir) {
  try {
    return readdirSync(dir, { recursive: true })
      .filter((f) => typeof f === "string" && f.endsWith(".ts") && !f.endsWith(".d.ts")).length;
  } catch {
    return 0;
  }
}

/** @param {string} dir */
function hasAdapterFile(dir) {
  try {
    return readdirSync(dir).some((f) => f.endsWith("-adapter.ts"));
  } catch {
    return false;
  }
}

/** @param {string} dir */
function hasCssFile(dir) {
  try {
    return readdirSync(dir).some((f) => f.endsWith(".css"));
  } catch {
    return false;
  }
}

/** @param {string} cardId */
function hasTestFile(cardId) {
  // Tests may be named <card-id>.test.ts or <card-id>-*.test.ts
  try {
    return readdirSync(TESTS_DIR).some(
      (f) => f.startsWith(cardId.replace(/-/g, "")) || f.startsWith(cardId)
    );
  } catch {
    return false;
  }
}

/** @param {boolean} val */
const icon = (val) => (val ? "✅" : "—");

const cardDirs = readdirSync(CARDS_DIR).filter((name) => {
  const full = join(CARDS_DIR, name);
  return statSync(full).isDirectory() && name !== "base-card.ts";
});

/** @type {{ id: string; src: number; adapter: boolean; css: boolean; test: boolean }[]} */
const rows = cardDirs.map((id) => {
  const dir = join(CARDS_DIR, id);
  return {
    id,
    src: countTs(dir),
    adapter: hasAdapterFile(dir),
    css: hasCssFile(dir),
    test: hasTestFile(id),
  };
});

// ── Print table ────────────────────────────────────────────────────────────

const header = "| Card ID | TS files | Worker adapter | CSS | Tests |";
const sep = "|---------|----------|----------------|-----|-------|";
const tableLines = [header, sep, ...rows.map((r) => `| \`${r.id}\` | ${r.src} | ${icon(r.adapter)} | ${icon(r.css)} | ${icon(r.test)} |`)];

// eslint-disable-next-line no-console
console.log(tableLines.join("\n"));

// ── Summary ────────────────────────────────────────────────────────────────
const untested = rows.filter((r) => !r.test);
if (untested.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n⚠️  ${untested.length} card(s) have no unit test file: ${untested.map((r) => r.id).join(", ")}`);
  if (checkMode) process.exit(1);
}
