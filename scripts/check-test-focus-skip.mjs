#!/usr/bin/env node
/**
 * check-test-focus-skip.mjs — / v13.44.0
 *
 * Fails CI if any test file under tests/ contains a focused (`it.only` /
 * `describe.only` / `test.only`) or a skipped (`it.skip` / `describe.skip` /
 * `test.skip`) hook. Both states are forbidden in `main` per the
 * pre-release zero-tolerance policy.
 *
 * No external deps; ES modules; PowerShell-friendly.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const TEST_DIRS = ["tests"];
const FORBIDDEN = [
  /\b(?:it|test|describe)\.only\s*\(/,
  /\b(?:it|test|describe)\.skip\s*\(/,
];
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs"]);

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (EXTS.has(full.slice(full.lastIndexOf("."))) && full.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

let bad = 0;
for (const root of TEST_DIRS) {
  const abs = join(ROOT, root);
  let files;
  try {
    files = walk(abs);
  } catch {
    continue;
  }
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      for (const re of FORBIDDEN) {
        if (re.test(line)) {
          const rel = relative(ROOT, file).split(sep).join("/");
          console.error(`${rel}:${i + 1} forbidden focused/skipped test: ${line.trim()}`);
          bad++;
        }
      }
    });
  }
}

if (bad > 0) {
  console.error(`\n✗ ${bad} forbidden test focus/skip occurrence(s).`);
  process.exit(1);
}
console.log("✓ No focused (.only) or skipped (.skip) tests found.");
