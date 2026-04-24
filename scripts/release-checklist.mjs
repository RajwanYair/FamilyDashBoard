#!/usr/bin/env node
/**
 * release-checklist.mjs — V13-OPS
 *
 * Reads .github/prompts/release-check.prompt.md and emits it as a GitHub
 * Actions step summary (appended to $GITHUB_STEP_SUMMARY when set, or
 * printed to stdout otherwise).
 *
 * This is purely informational — exits 0 always. The summary is visible in
 * the GitHub Actions run page so release engineers have the checklist at hand.
 *
 * Usage: node scripts/release-checklist.mjs
 */

import { readFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PROMPT_PATH = resolve(ROOT, ".github", "prompts", "release-check.prompt.md");

/** Read the prompt file and return markdown content (strips YAML frontmatter). */
export function readReleaseChecklist() {
  const raw = readFileSync(PROMPT_PATH, "utf-8");
  // Strip YAML frontmatter (--- ... ---)
  const stripped = raw.replace(/^---[\s\S]*?---\n?/, "");
  return stripped.trim();
}

const isMain =
  process.argv[1] != null &&
  (process.argv[1].endsWith("release-checklist.mjs") ||
    process.argv[1].includes("release-checklist"));

if (isMain) {
  const content = readReleaseChecklist();
  const banner =
    "## 📋 Release Checklist\n\n> Auto-generated from `.github/prompts/release-check.prompt.md`\n\n";
  const output = banner + content + "\n";

  if (process.env["GITHUB_STEP_SUMMARY"]) {
    appendFileSync(process.env["GITHUB_STEP_SUMMARY"], output, "utf-8");
    console.log("✅  Release checklist appended to GITHUB_STEP_SUMMARY");
  } else {
    process.stdout.write(output);
  }
}
