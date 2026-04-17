#!/usr/bin/env node
/**
 * FamilyDashBoard — Release Report (Sprint 75)
 *
 * Reads package.json, CHANGELOG.md, and the current git status to print
 * a concise release summary for use in GitHub release notes.
 *
 * Usage:
 *   node scripts/release-report.mjs
 *
 * Output: Markdown summary to stdout (pipe to a file if needed).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const ROOT = resolve(process.cwd());

// ── Helpers ────────────────────────────────────────────────────────────────

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "(unavailable)";
  }
}

function extractChangelogSection(version) {
  const path = resolve(ROOT, "CHANGELOG.md");
  if (!existsSync(path)) return "(CHANGELOG.md not found)";
  const content = readFileSync(path, "utf-8");
  const start = content.indexOf(`## [${version}]`);
  if (start === -1) return `(No entry found for v${version})`;
  const after = content.indexOf("\n## [", start + 1);
  return after === -1 ? content.slice(start) : content.slice(start, after);
}

// ── Collect data ───────────────────────────────────────────────────────────

const version = pkg.version;
const date = new Date().toISOString().slice(0, 10);
const commit = run("git rev-parse --short HEAD");
const branch = run("git rev-parse --abbrev-ref HEAD");
const tag = run(`git tag -l v${version}`);
const changelogSection = extractChangelogSection(version);

// ── Build trend summary ────────────────────────────────────────────────────

const trendPath = resolve(ROOT, "scripts", "bundle-trend.json");
let bundleInfo = "";
if (existsSync(trendPath)) {
  try {
    const trend = JSON.parse(readFileSync(trendPath, "utf-8"));
    const last = trend.filter((r) => r.version === version).at(-1);
    if (last) {
      bundleInfo = `\n**Bundle (gzipped):** JS ${last.jsKb} KB · CSS ${last.cssKb} KB`;
    }
  } catch {
    // ignore
  }
}

// ── Print report ───────────────────────────────────────────────────────────

console.log(`# Release Report — v${version}`);
console.log();
console.log(`**Date:** ${date}  `);
console.log(`**Commit:** \`${commit}\` (branch: \`${branch}\`)  `);
console.log(`**Tag:** ${tag || "(not yet tagged)"}${bundleInfo}`);
console.log();
console.log("---");
console.log();
console.log(changelogSection.trim());
