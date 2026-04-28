#!/usr/bin/env node
// @ts-check
/**
 * Smart-contrast audit — Roadmap §3 #24.
 *
 * Enforces ROADMAP.md rule #24: every CSS color value on body/card text MUST
 * use a token (`var(--text-primary)`, `var(--text-on-accent)`, etc.), never
 * a bare `#fff`/`#000`/`white`/`black`.
 *
 * Allowlist: files in ALLOWED_FILES below are exempt because the surface is
 * intentionally non-theme-flipping (print stylesheet, night-dimmer overlay,
 * always-dark video panels). All other usages must justify themselves with
 * an inline `/* allow-hardcoded-color: <reason> *​/` comment immediately
 * before the offending declaration, OR be replaced with a semantic token.
 *
 * Failure: exits non-zero with a list of violations. Wired into CI alongside
 * stylelint.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/** Files that legitimately use bare #000/#fff (entire file exempt). */
const ALLOWED_FILES = new Set([
  "src/styles/tokens.css", // token definitions
  "src/styles/print.css", // print is always white bg / black text
  "src/styles/themes.css", // theme color anchors
  "src/styles/preview.css", // preview surface fixed contrast
  "src/styles/sprints.css", // sprint-mode legacy fixed contrast
  "src/styles/inline-utils.css", // utility classes are self-contained badges
  "src/ui/night-dimmer.css", // intentional black overlay
  "src/cards/video-news/video-news.css", // always-dark video panels
]);

/** Color literals that the audit forbids in non-allowlisted files. */
const FORBIDDEN = /\b(?:color|background(?:-color)?)\s*:\s*(#fff(?:fff)?|#000(?:000)?|white|black)\b/gi;

/** Allow-line marker that, if present on the prior non-blank line, exempts
 * the next declaration. Use sparingly. */
const ALLOW_MARKER = /\/\*\s*allow-hardcoded-color\s*:\s*[^*]+\*\//;

/** @returns {string[]} */
function findCss() {
  return globSync("src/**/*.css", { cwd: ROOT });
}

/** @param {string} relPath */
function audit(relPath) {
  if (ALLOWED_FILES.has(relPath.replace(/\\/g, "/"))) return [];
  const abs = join(ROOT, relPath);
  const text = readFileSync(abs, "utf8");
  const lines = text.split(/\r?\n/);
  /** @type {{ file: string; line: number; snippet: string }[]} */
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!FORBIDDEN.test(line)) {
      FORBIDDEN.lastIndex = 0;
      continue;
    }
    FORBIDDEN.lastIndex = 0;
    // Look backwards through whitespace-only lines for an allow marker
    let j = i - 1;
    while (j >= 0 && /^\s*$/.test(lines[j] ?? "")) j--;
    const priorLine = j >= 0 ? (lines[j] ?? "") : "";
    if (ALLOW_MARKER.test(priorLine)) continue;
    violations.push({ file: relPath, line: i + 1, snippet: line.trim() });
  }
  return violations;
}

const files = findCss();
const all = files.flatMap((f) => audit(relative(ROOT, join(ROOT, f))));

if (all.length === 0) {
  process.stdout.write(`smart-contrast: 0 violations across ${String(files.length)} CSS files\n`);
  process.exit(0);
}

process.stderr.write(`smart-contrast: ${String(all.length)} violation(s):\n`);
for (const v of all) {
  process.stderr.write(`  ${v.file}:${String(v.line)}  ${v.snippet}\n`);
}
process.stderr.write(
  "\nFix: replace with a semantic token (var(--text-primary), var(--text-on-accent), …)\n" +
    "      OR add a justification comment on the line above:\n" +
    "      /* allow-hardcoded-color: <reason> */\n",
);
process.exit(1);
