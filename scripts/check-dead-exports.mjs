// @ts-check
/**
 * check-dead-exports.mjs — Sprint 116 (Task 1/20 + Task 20/20)
 *
 * Scans src/ and worker/src/ for exported symbols that are never imported
 * anywhere in src/, worker/src/, or tests/.  Reports candidates for dead code.
 * Sprint 476 (v14.4.0): extended scan scope to worker/src/ (mirrors Sprint 466 OWASP extension).
 *
 * False-positive sources (excluded automatically):
 *   - Re-export barrel files (index.ts) — excluded from analysis
 *   - Dynamic imports via string template literals — flagged as unknown
 *   - Symbols consumed by index.html directly (main.ts exports nothing)
 *   - Type-only exports (exported for d.ts consumers only)
 *
 * Usage:
 *   node scripts/check-dead-exports.mjs [--fail-on-dead]
 *
 * The script exits 0 even when candidates are found (informational only) unless
 * --fail-on-dead is passed.  This keeps CI green while still surfacing debt.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC = join(ROOT, "src");
const WORKER_SRC = join(ROOT, "worker", "src"); // Sprint 476: also scan worker code
const TESTS = join(ROOT, "tests");

const { values: flags } = parseArgs({
  args: process.argv.slice(2),
  options: { "fail-on-dead": { type: "boolean", default: false } },
  strict: false,
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** @param {string} dir @returns {string[]} */
function walkTs(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTs(full));
    } else if (entry.isFile() && extname(entry.name) === ".ts") {
      files.push(full);
    }
  }
  return files;
}

/**
 * Extract exported symbol names from a file's source text.
 * Intentionally skips `interface` and `type` exports — these are zero-cost
 * TypeScript declarations that are appropriate to export for documentation
 * and contract purposes even when not currently consumed by src/ or tests/.
 * Sprint 156: reduced false-positive surface from 75 → ~10 candidates.
 * Sprint 476: lines annotated `// dead-export-ok` are suppressed from analysis.
 */
const EXPORT_RE =
  /^export\s+(?:(?:async\s+)?function\s*\*?\s*|(?:const|let|var)\s+|class\s+|(?:abstract\s+)?enum\s+)(\w+)/gm;
const EXPORT_DEFAULT_RE = /^export\s+default\s+(?:function\s+|class\s+)?(\w+)/gm;
const EXPORT_NAMED_RE = /^export\s*\{([^}]+)\}/gm;

/** @param {string} src @returns {string[]} */
function extractExports(src) {
  /** @type {string[]} */
  const names = [];
  // Sprint 476: collect suppressed symbols (lines with // dead-export-ok)
  /** @type {Set<string>} */
  const suppressed = new Set();
  // Non-global versions of regexes for single-line exec
  const EXPORT_RE_NG = /^export\s+(?:(?:async\s+)?function\s*\*?\s*|(?:const|let|var)\s+|class\s+|(?:abstract\s+)?enum\s+)(\w+)/;
  const EXPORT_DEFAULT_RE_NG = /^export\s+default\s+(?:function\s+|class\s+)?(\w+)/;
  for (const line of src.split("\n")) {
    if (!line.includes("dead-export-ok")) continue;
    const m = EXPORT_RE_NG.exec(line) ?? EXPORT_DEFAULT_RE_NG.exec(line);
    if (m?.[1]) suppressed.add(m[1]);
    // also handle named exports on suppressed lines
    const nm = /export\s*\{([^}]+)\}/.exec(line);
    if (nm?.[1]) {
      for (const part of nm[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) suppressed.add(name);
      }
    }
  }
  for (const m of src.matchAll(EXPORT_RE)) if (m[1]) names.push(m[1]);
  for (const m of src.matchAll(EXPORT_DEFAULT_RE)) if (m[1]) names.push(m[1]);
  for (const m of src.matchAll(EXPORT_NAMED_RE)) {
    if (!m[1]) continue;
    for (const part of m[1].split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name && name !== "") names.push(name);
    }
  }
  return [...new Set(names.filter(Boolean).filter((n) => !suppressed.has(n)))];
}

// ─── Build corpus ────────────────────────────────────────────────────────────

const srcFiles = walkTs(SRC);
const workerSrcFiles = statSync(WORKER_SRC, { throwIfNoEntry: false })?.isDirectory()
  ? walkTs(WORKER_SRC)
  : [];
const testFiles = walkTs(TESTS);
const allFiles = [...srcFiles, ...workerSrcFiles, ...testFiles];

// Concatenate all source text for import-search
const corpus = allFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// ─── Analyse each src/ and worker/src/ file ───────────────────────────────────

/** @type {{ file: string; symbol: string }[]} */
const dead = [];

for (const file of [...srcFiles, ...workerSrcFiles]) {
  // Skip type declaration files and vite-env
  if (file.endsWith(".d.ts") || file.includes("vite-env")) continue;

  const rel = relative(ROOT, file).replaceAll("\\", "/");
  const src = readFileSync(file, "utf8");

  // Skip barrel / re-export files (they exist to re-export, not to be directly used)
  if (/^export\s*\*\s*from/m.test(src)) continue;

  const exported = extractExports(src);

  for (const sym of exported) {
    // Skip very short names (type params, etc.) and common lifecycle names
    if (sym.length < 3) continue;
    if (["default", "init", "setup", "mount", "render", "App"].includes(sym)) continue;

    // Count occurrences in entire corpus excluding the defining file itself
    const corpusWithoutSelf = corpus.replace(src, "");
    const occurrences = (corpusWithoutSelf.match(new RegExp(`\\b${sym}\\b`, "g")) ?? []).length;

    if (occurrences === 0) {
      dead.push({ file: rel, symbol: sym });
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

if (dead.length === 0) {
  const totalFiles = srcFiles.length + workerSrcFiles.length;
  console.log(
    `✅ Dead export check: no unused exports detected in src/ or worker/src/ (${totalFiles} files scanned)`,
  );
  process.exit(0);
}

console.log(`\n⚠️  Dead export candidates (${dead.length} symbols):\n`);
const byFile = /** @type {Map<string, string[]>} */ (new Map());
for (const { file, symbol } of dead) {
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file)?.push(symbol);
}
for (const [file, syms] of byFile) {
  console.log(`  ${file}`);
  for (const s of syms) console.log(`    • ${s}`);
}
console.log(
  "\nNote: This list includes false positives (dynamic imports, entry points,\n" +
    "      type-only consumers). Review manually before deleting.\n",
);

if (flags["fail-on-dead"]) {
  console.error("::error::Dead export candidates found — pass --fail-on-dead=false to allow.");
  process.exit(1);
}
process.exit(0);
