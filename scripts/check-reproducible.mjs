#!/usr/bin/env node
// @ts-check
/**
 * Third-party rebuilder reproducibility check (V14-SECURITY-L3).
 *
 * A third party claiming they can reproduce the build must produce a
 * dist.zip whose SHA-256 matches the value in dist.zip.sha256 from the
 * official GitHub Release.
 *
 * This script captures all environment variables relevant to reproducing
 * the build and writes a `rebuilder-manifest.json` that contains:
 *   - Node.js version
 *   - npm version
 *   - Git commit SHA (HEAD)
 *   - Build date (ISO-8601)
 *   - Expected SHA-256 of dist.zip (if dist.zip exists)
 *   - SHA-256 of key build inputs (package.json, vite.config.ts, tsconfig.json)
 *   - A "verification instructions" block for the third-party rebuilder
 *
 * The manifest is written to `dist/rebuilder-manifest.json` (included in
 * dist.zip) so any downloader can verify determinism.
 *
 * Exit 1 if the build environment is unsuitable (no dist/ present).
 * Exit 0 in CI (pre-build) mode — only writes the manifest template.
 *
 * Usage:
 *   node scripts/check-reproducible.mjs            # in CI after build
 *   node scripts/check-reproducible.mjs --dry-run  # pre-build check only
 *   node scripts/check-reproducible.mjs --verify dist/rebuilder-manifest.json  # compare inputs
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const MANIFEST_PATH = join(DIST, "rebuilder-manifest.json");

const isDryRun = process.argv.includes("--dry-run");
const verifyIdx = process.argv.indexOf("--verify");
const verifyPath = verifyIdx !== -1 ? process.argv[verifyIdx + 1] : null;

/** @param {string} filePath  @returns {string} */
function sha256File(filePath) {
  if (!existsSync(filePath)) return "file-not-found";
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/** @returns {string} */
function getGitHead() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: ROOT }).trim();
  } catch {
    return process.env["GITHUB_SHA"] ?? "unknown";
  }
}

/** @returns {string} */
function getNodeVersion() {
  return process.version;
}

/** @returns {string} */
function getNpmVersion() {
  try {
    return execSync("npm --version", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

const gitHead = getGitHead();
const distZipPath = join(ROOT, "dist.zip");

const manifest = {
  _schema: "fdb-rebuilder-manifest-v1",
  generated: new Date().toISOString(),
  source: {
    repository: "https://github.com/RajwanYair/FamilyDashBoard",
    commit: gitHead,
    ref: process.env["GITHUB_REF_NAME"] ?? "local",
  },
  buildEnvironment: {
    nodeVersion: getNodeVersion(),
    npmVersion: getNpmVersion(),
    os: process.platform,
    ci: Boolean(process.env["CI"]),
  },
  buildInputHashes: {
    "package.json": sha256File(join(ROOT, "package.json")),
    "vite.config.ts": sha256File(join(ROOT, "vite.config.ts")),
    "tsconfig.json": sha256File(join(ROOT, "tsconfig.json")),
    "sw.ts": sha256File(join(ROOT, "sw.ts")),
    "src/main.ts": sha256File(join(ROOT, "src", "main.ts")),
    "src/index.html": sha256File(join(ROOT, "src", "index.html")),
    "../package-lock.json": sha256File(join(ROOT, "..", "package-lock.json")),
  },
  artefacts: {
    "dist.zip": sha256File(distZipPath),
    "sw.js": sha256File(join(ROOT, "sw.js")),
  },
  verificationInstructions: {
    steps: [
      "1. Clone the repository at the exact commit above.",
      "2. Run: bash .github/ci/install-tools.sh",
      "3. Run: npm run build (from MyScripts/ parent directory, then cd FamilyDashBoard)",
      "4. Run: node scripts/build-sw.mjs",
      "5. Run: zip -r dist.zip dist/ -x 'dist/**/*.map'",
      "6. Compute: sha256sum dist.zip",
      "7. Compare with dist.zip hash above — must match for reproducible build.",
    ],
    note: "Vite build is deterministic when node version, npm lock, and source commit match. Report any divergence at https://github.com/RajwanYair/FamilyDashBoard/issues",
  },
};

if (isDryRun) {
  console.log("[check-reproducible] Dry-run mode: manifest not written.");
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

// ── Verify mode: compare current hashes against a saved manifest ─────────────

if (verifyPath) {
  if (!existsSync(verifyPath)) {
    console.error(`[check-reproducible] --verify file not found: ${verifyPath}`);
    process.exit(1);
  }
  const saved = JSON.parse(readFileSync(verifyPath, "utf-8"));
  const diffs = [];
  for (const [key, hash] of Object.entries(manifest.buildInputHashes)) {
    const savedHash = saved.buildInputHashes?.[key];
    if (savedHash && savedHash !== hash) {
      diffs.push({ file: key, expected: savedHash, actual: hash });
    }
  }
  if (diffs.length === 0) {
    console.log("[check-reproducible] ✅ All build input hashes match the saved manifest.");
    process.exit(0);
  } else {
    console.error(`[check-reproducible] ❌ ${diffs.length} input hash mismatch(es):`);
    for (const d of diffs) {
      console.error(
        `  ${d.file}: expected ${d.expected.slice(0, 12)}… got ${d.actual.slice(0, 12)}…`,
      );
    }
    process.exit(1);
  }
}

if (!existsSync(DIST)) {
  if (process.env["CI"]) {
    console.error("[check-reproducible] dist/ not found — run build first (npm run build).");
    process.exit(1);
  }
  // Local: create dist/ so the manifest can be written as a template
  mkdirSync(DIST, { recursive: true });
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
console.log(`[check-reproducible] Manifest written to ${MANIFEST_PATH}`);
console.log(`[check-reproducible] Commit: ${gitHead}`);
console.log(`[check-reproducible] dist.zip SHA-256: ${manifest.artefacts["dist.zip"]}`);

if (manifest.artefacts["dist.zip"] === "file-not-found") {
  console.log(
    "[check-reproducible] NOTE: dist.zip not yet built — hash will be populated after 'npm run build'.",
  );
}
