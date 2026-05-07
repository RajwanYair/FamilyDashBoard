#!/usr/bin/env node
// @ts-check
/**
 * scripts/check-container-queries.mjs — (V14-FOUNDATIONS)
 *
 * Per ROADMAP §2.2 + ADR-008: every card stylesheet must use @container
 * queries, never viewport-based @media (min-width|max-width) rules.
 * Viewport queries are reserved for top-level page chrome (layout.css,
 * components.css for the chrome bar / ticker / status bar).
 *
 * This guard prevents regression by failing CI if any file under
 * src/cards/** introduces a viewport-based media query.
 *
 * Exit 0 on clean, 1 on violation.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src", "cards");
/** Match @media (min-width: ...) or @media (max-width: ...) — including
 *  forms with `screen and`, `,` lists, and `(width >= ...)` syntax. */
const VIEWPORT_RE = /@media[^{]*\b(?:min-width|max-width|width\s*[<>])[^{]*\{/;

/**
 * @param {string} dir
 * @param {string[]} acc
 * @returns {Promise<string[]>}
 */
async function walk(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    const path = join(dir, name);
    const st = await stat(path);
    if (st.isDirectory()) await walk(path, acc);
    else if (name.endsWith(".css")) acc.push(path);
  }
  return acc;
}

async function main() {
  const files = await walk(ROOT);
  let violations = 0;
  for (const file of files) {
    const src = await readFile(file, "utf8");
    const lines = src.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (VIEWPORT_RE.test(line)) {
        violations += 1;
        const rel = file.replace(process.cwd() + "\\", "").replace(process.cwd() + "/", "");

        console.error(
          `${rel}:${idx + 1}: viewport @media query in card stylesheet — use @container instead`,
        );
      }
    });
  }
  if (violations > 0) {
    console.error(`✖ Container-query audit: ${violations} viewport query/queries in src/cards/**`);
    process.exit(1);
  }

  console.log(`✅ Container-query audit: ${files.length} card stylesheet(s) clean`);
}

main().catch((err) => {
  console.error("check-container-queries failed:", err);
  process.exit(1);
});
