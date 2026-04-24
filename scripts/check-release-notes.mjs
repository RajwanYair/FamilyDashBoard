#!/usr/bin/env node
/**
 * check-release-notes.mjs — V13-OPS CI gate
 *
 * Verifies that the version in package.json has a corresponding
 * `## [X.Y.Z]` entry in CHANGELOG.md.
 *
 * Usage:
 *   node scripts/check-release-notes.mjs
 *
 * Exit codes:
 *   0  — CHANGELOG entry exists for current version
 *   1  — entry missing
 *
 * Pure helpers exported for unit tests (isMain-guarded main).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "..");

const require = createRequire(import.meta.url);

// ── Pure helpers (exported for tests) ─────────────────────────────────────

/**
 * Return true if the changelog text contains a `## [version]` heading.
 */
export function hasChangelogEntry(changelogText, version) {
  return changelogText.includes(`## [${version}]`);
}

/**
 * Extract the changelog section for a given version.
 * Returns empty string if not found.
 */
export function extractChangelogSection(changelogText, version) {
  const start = changelogText.indexOf(`## [${version}]`);
  if (start === -1) return "";
  const after = changelogText.indexOf("\n## [", start + 1);
  return after === -1
    ? changelogText.slice(start).trim()
    : changelogText.slice(start, after).trim();
}

/**
 * Return true if the section has meaningful content (at least one non-empty
 * line after the heading).
 */
export function sectionHasContent(section) {
  const lines = section.split("\n").filter((l) => l.trim().length > 0);
  // At least 2 non-empty lines: the heading + content
  return lines.length >= 2;
}

// ── Main (CI) ─────────────────────────────────────────────────────────────────

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("check-release-notes.mjs") ||
    process.argv[1].endsWith("check-release-notes"));

if (isMain) {
  const pkg = require("../package.json");
  const version = pkg.version;
  const changelogPath = resolve(REPO_ROOT, "CHANGELOG.md");

  let changelog;
  try {
    changelog = readFileSync(changelogPath, "utf8");
  } catch {
    console.error(`❌ release-notes: CHANGELOG.md not found at ${changelogPath}`);
    process.exit(1);
  }

  if (!hasChangelogEntry(changelog, version)) {
    console.error(
      `❌ release-notes: No ## [${version}] entry found in CHANGELOG.md`,
    );
    console.error(
      `   Add a ## [${version}] section before tagging v${version}`,
    );
    process.exit(1);
  }

  const section = extractChangelogSection(changelog, version);
  if (!sectionHasContent(section)) {
    console.error(
      `❌ release-notes: ## [${version}] section in CHANGELOG.md is empty`,
    );
    process.exit(1);
  }

  console.log(
    `✅ release-notes: CHANGELOG.md has a populated entry for v${version}`,
  );
  process.exit(0);
}
