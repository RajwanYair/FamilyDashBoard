#!/usr/bin/env node
/**
 * check-module-boundaries.mjs — D12
 *
 * Enforces the architectural rule that:
 *   - `src/cards/*` MUST NOT import from `src/ui/*`
 *   - `src/ui/*`    MUST NOT import from `src/cards/*`
 *   - `src/core/*`  MUST NOT import from `src/cards/*` (core is card-agnostic)
 *   - `src/cards/X/*` MUST NOT import from `src/cards/Y/*` (cross-card coupling)
 *   - `worker/src/*` MUST NOT import from `src/*` (worker is a separate runtime) [D12-W1]
 *
 * Cards talk to UI through the registry (`src/core/card-registry.ts`),
 * the lifecycle (`src/core/fdb-card.ts`), and shared helpers under
 * `src/core/`. Bypassing those creates hidden coupling and breaks
 * per-card bundle splitting.
 *
 * Worker code is a Cloudflare Worker runtime — it must be fully independent
 * of the browser client source tree. Shared types must live in
 * `worker/src/types.ts`, never in `src/`.
 *
 * BASELINE MODE: 9 pre-existing violations are grandfathered (see
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
const WORKER_SRC = join(ROOT, "worker", "src");

const FORBIDDEN = [
  {
    from: /[\\/]src[\\/]cards[\\/]/,
    importing: /from\s+["'][^"']*[\\/]ui[\\/]/,
    why: "src/cards/* must not import from src/ui/*",
  },
  {
    from: /[\\/]src[\\/]ui[\\/]/,
    importing: /from\s+["'][^"']*[\\/]cards[\\/]/,
    why: "src/ui/* must not import from src/cards/*",
  },
  {
    from: /[\\/]src[\\/]core[\\/]/,
    importing: /from\s+["'][^"']*[\\/]cards[\\/]/,
    why: "src/core/* must not import from src/cards/* (core is card-agnostic)",
  },
  // D12-W1: worker code must be fully independent of client source tree.
  // Shared types must live in worker/src/types.ts — never in src/.
  {
    from: /[\\/]worker[\\/]src[\\/]/,
    importing: /from\s+["'](?:\.\.\/)*src[\\/]/,
    why: "worker/src/* must not import from src/* (worker is a separate runtime)",
  },
  // D12-T1 (v14.30.0): production code must not import test helpers or test utils.
  {
    from: /[\\/]src[\\/]/,
    importing: /from\s+["'][^"']*[\\/]tests[\\/]/,
    why: "src/* must not import from tests/* (production code must not depend on test infrastructure)",
  },
];

/**
 * Cross-card import detector: a file in `src/cards/X/` must not import
 * from `src/cards/Y/` (where X ≠ Y). Shared card utilities belong in
 * `src/core/` or `src/cards/base-card.ts`.
 * @param {string} filePath - absolute path
 * @param {string} fileText - file contents
 * @returns {string|null} violation description or null
 */
function detectCrossCardImport(filePath, fileText) {
  const cardDirMatch = filePath.replace(/\\/g, "/").match(/src\/cards\/([^/]+)\//);
  if (!cardDirMatch) return null;
  const ownCard = cardDirMatch[1];
  // Match imports from other card directories
  const crossImportRe = /from\s+["']([^"']*\/cards\/([^/"']+)\/[^"']*)['"]/g;
  let m;
  while ((m = crossImportRe.exec(fileText)) !== null) {
    const importedCard = m[2];
    if (importedCard !== ownCard) {
      return `imports from src/cards/${importedCard}/ (cross-card coupling forbidden)`;
    }
  }
  // Also check relative imports that resolve to a sibling card dir.
  // Cards live at depth src/cards/X/file.ts, so a sibling card import
  // looks like `from "../Y/..."` (single ../ then a sibling dir).
  // We must NOT flag `../../core/` or `../../ui/` (those go above cards/).
  const relCrossRe = /from\s+["'](\.\/\.\.\/([^/"']+)\/[^"']*|\.\.\/([^/"'.]+)\/[^"']*)['"]/g;
  while ((m = relCrossRe.exec(fileText)) !== null) {
    const importedCard = m[2] || m[3];
    // Skip if import goes up two levels (../../) — that leaves the cards/ dir
    if (m[1].startsWith("../../")) continue;
    if (importedCard !== ownCard) {
      return `imports from sibling card "${importedCard}" via relative path (cross-card coupling forbidden)`;
    }
  }
  return null;
}

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
  // D12-cross: pre-existing cross-card imports (refactor tracked in ROADMAP §3)
  "src/cards/hebrew-cal/hebrew-cal.ts", // imports from tasks
  "src/cards/stocks/tase-adapter.ts", // imports from currency
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

const files = [...walk(SRC), ...walk(WORKER_SRC)];
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
  // Cross-card import check (D12-cross)
  const crossViolation = detectCrossCardImport(file, text);
  if (crossViolation) {
    if (BASELINE.has(rel)) {
      baselined++;
    } else {
      console.error(`❌ ${rel}: ${crossViolation}`);
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
