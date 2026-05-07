#!/usr/bin/env node
/**
 * check-module-boundaries.mjs — D12 
 *
 * Enforces the architectural rule that:
 *   - `src/cards/*` MUST NOT import from `src/ui/*`
 *   - `src/ui/*`    MUST NOT import from `src/cards/*`
 *
 * Cards talk to UI through the registry (`src/core/card-registry.ts`),
 * the lifecycle (`src/core/fdb-card.ts`), and shared helpers under
 * `src/core/`. Bypassing those creates hidden coupling and breaks
 * per-card bundle splitting.
 *
 * BASELINE MODE: 6 pre-existing violations are grandfathered (see
 * BASELINE constant below). The script fails only on NEW violations.
 * Refactoring the baseline files is tracked as backlog item D12-baseline.
 *
 * Exits 1 on the first new violation. Zero npm dependencies.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, "src");

const FORBIDDEN = [
  { from: /[\\/]src[\\/]cards[\\/]/, importing: /from\s+["'][^"']*[\\/]ui[\\/]/, why: "src/cards/* must not import from src/ui/*" },
  { from: /[\\/]src[\\/]ui[\\/]/, importing: /from\s+["'][^"']*[\\/]cards[\\/]/, why: "src/ui/* must not import from src/cards/*" },
];

/**
 * Pre-existing violations grandfathered when this check was introduced.
 * NEW additions to this list are forbidden — fix the import instead.
 * Refactor backlog: D12-baseline (track in ROADMAP §3 backlog).
 */
const BASELINE = new Set([
  "src/cards/motivation/fdb-motivation.ts",
  "src/cards/motivation/motivation.ts",
  "src/cards/stocks/stocks.ts",
  "src/cards/video-news/fdb-video-news.ts",
  "src/ui/ticker.ts",
  "src/ui/today-pane.ts",
]);

/** @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|mts|cts)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
let violations = 0;
let baselined = 0;

for (const file of files) {
  const text = readFileSync(file, "utf-8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  for (const rule of FORBIDDEN) {
    if (!rule.from.test(file)) continue;
    if (rule.importing.test(text)) {
      if (BASELINE.has(rel)) {
        baselined++;
        continue;
      }
      console.error(`❌ ${rel}: ${rule.why}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} new module-boundary violation(s)`);
  process.exit(1);
}
console.log(
  `✅ Module boundaries clean across ${files.length} files ` +
    `(${baselined} pre-existing violations grandfathered)`,
);
