#!/usr/bin/env node
/**
 * scripts/lint-instructions.mjs
 *
 * Validates YAML frontmatter in all AI customization files:
 *   .github/instructions/*.instructions.md  — must have: description, applyTo
 *   .github/skills/*\/SKILL.md             — must have: name, description
 *   .github/agents/*.agent.md              — must have: name, description
 *   .github/prompts/*.prompt.md            — must have: description
 *
 * Exit 0 = all valid · Exit 1 = one or more violations
 *
 * Usage:
 *   node scripts/lint-instructions.mjs
 *   npm run lint:instructions   (if added to package.json)
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GH = join(ROOT, ".github");

/** Extract YAML frontmatter block from markdown content. Returns null if none found. */
function extractFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(content);
  return match ? match[1] : null;
}

/**
 * Minimal YAML key-value parser.
 * Handles: `key: value` and `key: "value"` lines.
 * Does NOT handle nested YAML — we only need top-level scalar keys.
 */
function parseYamlKeys(yaml) {
  const keys = new Map();
  for (const line of yaml.split(/\r?\n/)) {
    const m = /^([a-zA-Z][\w-]*):\s*(.*)$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    // Strip surrounding quotes if present
    const raw = m[2].trim();
    const val = raw.startsWith('"') ? raw.slice(1, raw.lastIndexOf('"')) : raw;
    keys.set(key, val);
  }
  return keys;
}

/** Return glob-style file list for a pattern like *.instructions.md */
function globFiles(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .map((f) => join(dir, f));
}

/** Return SKILL.md paths from each subdirectory of the skills folder */
function skillFiles(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(skillsDir, e.name, "SKILL.md"))
    .filter((p) => existsSync(p));
}

/** Check a file and return an array of error strings (empty = valid) */
function check(filePath, requiredKeys) {
  const relPath = relative(ROOT, filePath);
  const errors = [];

  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch (err) {
    return [`${relPath}: cannot read file — ${/** @type {Error} */ (err).message}`];
  }

  const fm = extractFrontmatter(content);
  if (fm === null) {
    return [`${relPath}: missing YAML frontmatter (expected opening ---)`];
  }

  const keys = parseYamlKeys(fm);

  for (const required of requiredKeys) {
    if (!keys.has(required)) {
      errors.push(`${relPath}: missing required frontmatter field "${required}"`);
    } else if (!keys.get(required).trim()) {
      errors.push(`${relPath}: frontmatter field "${required}" is empty`);
    }
  }

  return errors;
}

// ────────────────────────────────────────────────────────────────────────────
// Collect all files to lint

const instructionFiles = globFiles(join(GH, "instructions"), ".instructions.md");
const agentFiles = globFiles(join(GH, "agents"), ".agent.md");
const promptFiles = globFiles(join(GH, "prompts"), ".prompt.md");
const skillFileList = skillFiles(join(GH, "skills"));

const tasks = [
  ...instructionFiles.map((f) => ({ file: f, required: ["description", "applyTo"] })),
  ...skillFileList.map((f) => ({ file: f, required: ["name", "description"] })),
  ...agentFiles.map((f) => ({ file: f, required: ["name", "description"] })),
  ...promptFiles.map((f) => ({ file: f, required: ["description"] })),
];

// ────────────────────────────────────────────────────────────────────────────
// Run checks

let totalFiles = 0;
const allErrors = [];

for (const { file, required } of tasks) {
  totalFiles++;
  const errs = check(file, required);
  allErrors.push(...errs);
}

// ────────────────────────────────────────────────────────────────────────────
// Report

if (allErrors.length === 0) {
  console.log(`✅  lint-instructions: ${totalFiles} files checked — no issues found.`);
  process.exit(0);
} else {
  for (const err of allErrors) {
    // GitHub Actions annotation format for CI
    if (process.env["CI"]) {
      console.log(`::error::${err}`);
    } else {
      console.error(`❌  ${err}`);
    }
  }
  console.error(`\nlint-instructions: ${allErrors.length} error(s) in ${totalFiles} files.`);
  process.exit(1);
}
