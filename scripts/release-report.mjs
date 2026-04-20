#!/usr/bin/env node
/**
 * FamilyDashBoard — Release Report
 *
 * Reads package.json, CHANGELOG.md, git status, and runs quality gates to print
 * a concise release summary including pass/fail status for each gate.
 *
 * Usage:
 *   node scripts/release-report.mjs          # full gates + report
 *   node scripts/release-report.mjs --no-gates  # skip gate runs (fast summary only)
 *
 * Exit code: 0 if all gates pass (or skipped), 1 if any gate fails.
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
const RUN_GATES = !process.argv.includes("--no-gates");

// ── Helpers ────────────────────────────────────────────────────────────────

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "(unavailable)";
  }
}

/**
 * Run a command and return { passed, output }.
 * A non-zero exit code means the gate failed.
 */
function gate(cmd) {
  if (!RUN_GATES) return { passed: null, output: "skipped" };
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: "pipe" }).trim();
    return { passed: true, output };
  } catch (err) {
    const output = (err.stdout ?? "") + (err.stderr ?? "");
    return { passed: false, output: output.trim() };
  }
}

function gateRow(label, { passed }) {
  if (passed === null) return `| ${label} | ⏭ skipped |`;
  return `| ${label} | ${passed ? "✅ PASS" : "❌ FAIL"} |`;
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

// ── Collect metadata ───────────────────────────────────────────────────────

const version = pkg.version;
const date = new Date().toISOString().slice(0, 10);
const commit = run("git rev-parse --short HEAD");
const branch = run("git rev-parse --abbrev-ref HEAD");
const tag = run(`git tag -l v${version}`);
const changelogSection = extractChangelogSection(version);

// ── Bundle trend summary ───────────────────────────────────────────────────

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

// ── Quality gates ──────────────────────────────────────────────────────────

process.stderr.write(RUN_GATES
  ? "Running quality gates (use --no-gates to skip)...\n"
  : "Skipping quality gates (--no-gates)\n");

const gates = [
  { label: "TypeScript (tsc --noEmit)",       result: gate("npx tsc --noEmit") },
  { label: "ESLint (0 warnings)",             result: gate("npx eslint src tests --max-warnings 0") },
  { label: "Vitest unit tests",               result: gate("npx vitest run") },
  { label: "Bundle size check",               result: gate("node scripts/check-bundle-size.mjs") },
  { label: "SW version check",                result: gate("node scripts/check-sw-version.mjs") },
];

const allPassed = gates.every((g) => g.result.passed !== false);

// ── Print report ───────────────────────────────────────────────────────────

console.log(`# Release Report — v${version}`);
console.log();
console.log(`**Date:** ${date}  `);
console.log(`**Commit:** \`${commit}\` (branch: \`${branch}\`)  `);
console.log(`**Tag:** ${tag || "(not yet tagged)"}${bundleInfo}`);
console.log();
console.log("## Quality Gates");
console.log();
console.log("| Gate | Status |");
console.log("|------|--------|");
for (const g of gates) {
  console.log(gateRow(g.label, g.result));
}
console.log();

if (!allPassed) {
  console.log("> ⚠️ **One or more quality gates failed.** Do not tag a release until all gates pass.");
  console.log();
  for (const g of gates) {
    if (g.result.passed === false) {
      console.log(`<details><summary>❌ ${g.label}</summary>\n\n\`\`\`\n${g.result.output.slice(0, 2000)}\n\`\`\`\n</details>`);
      console.log();
    }
  }
} else {
  console.log("> ✅ **All quality gates passed.** Safe to tag and release.");
  console.log();
}

console.log("---");
console.log();
console.log(changelogSection.trim());

process.exit(allPassed ? 0 : 1);

