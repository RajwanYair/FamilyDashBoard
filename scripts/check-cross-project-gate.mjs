/**
 * Cross-project release gate script
 *
 * Verifies that the shared tooling presets vendored into this repo haven't
 * drifted unexpectedly from their last-known sizes, and prints an advisory
 * listing sibling projects that should adopt the shared presets.
 *
 * This script is INFORMATIONAL — it always exits 0 even if drift is detected,
 * so it never blocks CI. Instead it prints warnings to aid manual review.
 *
 * Run:  node scripts/check-cross-project-gate.mjs
 * npm:  npm run check:cross-project
 */

import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Known tooling file checksums (sizes in bytes at / v13.26.0) ──
// Update these when a tooling file is intentionally changed.
const TOOLING_BASELINE = [
  { path: "tooling/ci/check.yml",                  size: 3114  },
  { path: "tooling/eslint/web-ts-app.mjs",          size: 6562  },
  { path: "tooling/eslint/node-ts-app.mjs",         size: 4425  },
  { path: "tooling/eslint/js-browser-app.mjs",      size: 1857  },
  { path: "tooling/tsconfig/base-typescript.json",  size: 478   },
  { path: "tooling/tsconfig/base-node.json",        size: 473   },
  { path: "tooling/vitest/base.mjs",                size: 1544  },
  { path: "tooling/vitest/happy-dom.mjs",           size: 501   },
  { path: "tooling/vitest/node.mjs",                size: 472   },
];

// ── Sibling repos that should adopt these presets (V14-HARMONISE backlog) ──
const SIBLING_REPOS = [
  {
    name: "BudgetManager",
    status: "pending",
    notes: "Needs to adopt tooling/eslint/node-ts-app.mjs and tooling/vitest/node.mjs",
  },
  {
    name: "CrossTideWeb",
    status: "pending",
    notes: "Needs to adopt tooling/ci/check.yml composite action",
  },
  {
    name: "Wedding",
    status: "pending",
    notes:
      "Needs to adopt tooling/eslint/web-ts-app.mjs and tooling/vitest/happy-dom.mjs",
  },
];

const TOLERANCE_BYTES = 50; // allow ±50 bytes before flagging drift

let driftCount = 0;
let missingCount = 0;

console.log(
  "╔═══════════════════════════════════════════════════════════════╗",
);
console.log("║  Cross-project tooling drift & adoption check (V14-HARMONISE) ║");
console.log(
  "╚═══════════════════════════════════════════════════════════════╝\n",
);

// ── Check tooling file drift ──────────────────────────────────────────────
console.log("── Tooling baseline drift check ────────────────────────────────");
for (const entry of TOOLING_BASELINE) {
  const fullPath = join(root, entry.path);
  let actualSize = 0;
  try {
    actualSize = statSync(fullPath).size;
  } catch {
    missingCount++;
    console.warn(`  [MISSING] ${entry.path} (expected ${entry.size} bytes)`);
    continue;
  }

  const delta = Math.abs(actualSize - entry.size);
  if (delta > TOLERANCE_BYTES) {
    driftCount++;
    const sign = actualSize > entry.size ? "+" : "-";
    console.warn(
      `  [DRIFT]   ${entry.path}\n` +
        `            baseline=${entry.size}B  actual=${actualSize}B  (${sign}${delta}B)\n` +
        `            → Update TOOLING_BASELINE if this change is intentional.`,
    );
  } else {
    console.log(`  [OK]      ${entry.path} (${actualSize}B, Δ${delta}B)`);
  }
}

// ── Sibling adoption advisory ─────────────────────────────────────────────
console.log("\n── Sibling project adoption advisory ───────────────────────────");
for (const repo of SIBLING_REPOS) {
  const icon = repo.status === "done" ? "✅" : "⏳";
  console.log(`  ${icon} ${repo.name} [${repo.status}]`);
  console.log(`     ${repo.notes}`);
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log("\n── Summary ─────────────────────────────────────────────────────");
if (driftCount === 0 && missingCount === 0) {
  console.log(
    `  All ${TOOLING_BASELINE.length} tooling files match baseline (±${TOLERANCE_BYTES}B tolerance).`,
  );
} else {
  console.warn(
    `  ${driftCount} file(s) drifted, ${missingCount} missing — review before releasing.`,
  );
}

const siblingPending = SIBLING_REPOS.filter((r) => r.status !== "done").length;
if (siblingPending > 0) {
  console.log(
    `  ${siblingPending} sibling repo(s) still pending tooling adoption (V14-HARMONISE backlog).`,
  );
}

// Always informational — exit 0
process.exit(0);
