/**
 * Sprint 237 / V14-SECURITY-L3: Hermetic build — --ignore-scripts gate
 *
 * Scans .github/workflows/*.yml for `npm install` / `npm ci` commands that
 * do NOT include --ignore-scripts, flagging unvetted supply-chain script
 * execution in CI. Exits 1 on violations so CI blocks the build.
 *
 * Exemptions (these patterns are intentionally allowed):
 *   - --package-lock-only  (no actual install, just resolves the lockfile)
 *   - --no-save --no-package-lock  (transient dep install, no lifecycle hooks at parent)
 *   - Lines in comments (#)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowsDir = join(__dirname, "..", ".github", "workflows");

const EXEMPT_FLAGS = [
  "--package-lock-only",  // resolves lockfile, no scripts run
  "--no-package-lock",    // transient install (link-check etc.)
];

/** Returns true if the npm command line should be exempt from the --ignore-scripts requirement. */
function isExempt(line) {
  return EXEMPT_FLAGS.some((flag) => line.includes(flag));
}

/** Returns true if the line has an actual npm install/ci command (not a comment). */
function isNpmInstallOrCi(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) return false;
  return /\bnpm\s+(install|ci)\b/.test(trimmed);
}

let violations = 0;
const files = readdirSync(workflowsDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

for (const file of files) {
  const filePath = join(workflowsDir, file);
  const lines = readFileSync(filePath, "utf8").split("\n");

  lines.forEach((line, idx) => {
    if (!isNpmInstallOrCi(line)) return;
    if (isExempt(line)) return;
    if (line.includes("--ignore-scripts")) return;

    violations++;
    console.error(
      `[check-npm-ignore-scripts] VIOLATION: ${file}:${idx + 1}\n` +
        `  ${line.trim()}\n` +
        `  ↳ Add --ignore-scripts to prevent untrusted lifecycle script execution.`,
    );
  });
}

if (violations === 0) {
  console.log(
    `[check-npm-ignore-scripts] OK — ${files.length} workflow(s) scanned, 0 violations.`,
  );
  process.exit(0);
} else {
  console.error(
    `[check-npm-ignore-scripts] FAIL — ${violations} violation(s) found. ` +
      `Add --ignore-scripts to each flagged command or add it to the EXEMPT_FLAGS list ` +
      `with a justification comment.`,
  );
  process.exit(1);
}
