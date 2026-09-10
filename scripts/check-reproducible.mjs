#!/usr/bin/env node
// @ts-check
/**
 * Reproducible-build manifest and comparison tool.
 *
 * The manifest records the exact source/toolchain inputs and deterministic
 * content hashes. `--compare` compares two files or output directories while
 * ignoring generated manifests, so a clean rebuild can be checked without
 * relying on timestamps or a copied cache.
 *
 * Usage:
 *   node scripts/check-reproducible.mjs
 *   node scripts/check-reproducible.mjs --dry-run
 *   node scripts/check-reproducible.mjs --verify dist/rebuilder-manifest.json
 *   node scripts/check-reproducible.mjs --compare build-a build-b
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const MANIFEST_PATH = join(DIST, "rebuilder-manifest.json");
const MANIFEST_SCHEMA = "fdb-rebuilder-manifest-v2";
const GENERATED_DIST_FILES = new Set(["rebuilder-manifest.json", ".rebuild-hashes.json"]);
const INPUT_FILES = [
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "tsconfig.json",
  "sw.ts",
  "src/main.ts",
  "src/index.html",
];

/**
 * @typedef {{
 *   _schema: string;
 *   generated: string;
 *   source: { repository: string; commit: string; ref: string };
 *   buildEnvironment: {
 *     nodeVersion: string;
 *     npmVersion: string;
 *     os: string;
 *     ci: boolean;
 *     sourceDateEpoch: string | null;
 *   };
 *   buildInputHashes: Record<string, string>;
 *   artefacts: Record<string, string>;
 *   verificationInstructions: { steps: string[]; note: string };
 * }} RebuilderManifest
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {string} filePath
 * @returns {string}
 */
export function sha256File(filePath) {
  if (!existsSync(filePath)) return "file-not-found";
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * Hash a directory using sorted POSIX-relative paths and file content hashes.
 * File timestamps, permissions, and generated manifests are intentionally not
 * part of the digest.
 *
 * @param {string} directory
 * @param {Set<string>} [excluded]
 * @returns {string}
 */
export function hashDirectory(directory, excluded = new Set()) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    return "directory-not-found";
  }

  /** @type {string[]} */
  const entries = [];
  /**
   * @param {string} current
   */
  function visit(current) {
    const children = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    );
    for (const child of children) {
      const fullPath = join(current, child.name);
      const relativePath = relative(directory, fullPath).split(sep).join("/");
      if (excluded.has(relativePath)) continue;
      if (child.isDirectory()) {
        visit(fullPath);
      } else if (child.isFile()) {
        entries.push(`${relativePath}\0${sha256File(fullPath)}`);
      }
    }
  }
  visit(directory);

  return createHash("sha256").update(entries.join("\n")).digest("hex");
}

/**
 * @param {string} root
 * @returns {string}
 */
function getGitHead(root) {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8", cwd: root }).trim();
  } catch {
    return process.env["GITHUB_SHA"] ?? "unknown";
  }
}

/**
 * @param {string} root
 * @returns {string}
 */
function getNpmVersion(root) {
  try {
    return execSync("npm --version", { encoding: "utf-8", cwd: root }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * @param {{ root?: string; dist?: string; distZipPath?: string }} [options]
 * @returns {RebuilderManifest}
 */
export function createManifest(options = {}) {
  const root = options.root ?? ROOT;
  const dist = options.dist ?? join(root, "dist");
  const distZipPath = options.distZipPath ?? join(root, "dist.zip");
  const sourceDateEpoch = process.env["SOURCE_DATE_EPOCH"] ?? null;
  const generated =
    sourceDateEpoch === null
      ? new Date().toISOString()
      : (() => {
          if (!/^\d+$/.test(sourceDateEpoch)) {
            throw new Error("SOURCE_DATE_EPOCH must be a non-negative integer");
          }
          return new Date(Number(sourceDateEpoch) * 1000).toISOString();
        })();
  const buildInputHashes = Object.fromEntries(
    INPUT_FILES.map((file) => [file, sha256File(join(root, file))]),
  );

  return {
    _schema: MANIFEST_SCHEMA,
    generated,
    source: {
      repository: "https://github.com/RajwanYair/FamilyDashBoard",
      commit: getGitHead(root),
      ref: process.env["GITHUB_REF_NAME"] ?? "local",
    },
    buildEnvironment: {
      nodeVersion: process.version,
      npmVersion: getNpmVersion(root),
      os: process.platform,
      ci: Boolean(process.env["CI"]),
      sourceDateEpoch,
    },
    buildInputHashes,
    artefacts: {
      "dist/": hashDirectory(dist, GENERATED_DIST_FILES),
      "dist.zip": sha256File(distZipPath),
      "sw.js": sha256File(join(root, "sw.js")),
    },
    verificationInstructions: {
      steps: [
        "1. Clone the repository at the exact commit above.",
        "2. Run: bash .github/ci/install-tools.sh --ignore-scripts",
        "3. Set SOURCE_DATE_EPOCH to the exact commit timestamp.",
        "4. Run: npm run build from the repository root.",
        "5. Copy the generated dist/ directory to a clean evidence directory.",
        "6. Run npm run build again and copy the second dist/ directory.",
        "7. Run: node scripts/check-reproducible.mjs --compare build-a build-b",
        "8. Compare dist.zip and Sigstore bundle hashes with the published release.",
      ],
      note: "The comparison ignores only generated manifests. Any source, lockfile, toolchain, or output-content divergence must be investigated before release.",
    },
  };
}

/**
 * @param {unknown} value
 * @returns {value is RebuilderManifest}
 */
function isManifest(value) {
  if (!isRecord(value)) return false;
  if (value["_schema"] !== MANIFEST_SCHEMA) return false;
  if (
    !isRecord(value["source"]) ||
    typeof value["source"]["repository"] !== "string" ||
    typeof value["source"]["commit"] !== "string" ||
    typeof value["source"]["ref"] !== "string"
  ) {
    return false;
  }
  if (
    !isRecord(value["buildEnvironment"]) ||
    typeof value["buildEnvironment"]["nodeVersion"] !== "string" ||
    typeof value["buildEnvironment"]["npmVersion"] !== "string" ||
    typeof value["buildEnvironment"]["os"] !== "string" ||
    typeof value["buildEnvironment"]["ci"] !== "boolean" ||
    (value["buildEnvironment"]["sourceDateEpoch"] !== null &&
      typeof value["buildEnvironment"]["sourceDateEpoch"] !== "string")
  ) {
    return false;
  }
  if (!isRecord(value["buildInputHashes"]) || !isRecord(value["artefacts"])) return false;
  return (
    Object.values(value["buildInputHashes"]).every((hash) => typeof hash === "string") &&
    Object.values(value["artefacts"]).every((hash) => typeof hash === "string")
  );
}

/**
 * Compare all declared inputs and reproducibility artifacts.
 *
 * @param {RebuilderManifest} expected
 * @param {RebuilderManifest} actual
 * @returns {string[]}
 */
export function compareManifests(expected, actual) {
  /** @type {string[]} */
  const diffs = [];
  if (expected.source.commit !== actual.source.commit) {
    diffs.push(`source.commit: expected ${expected.source.commit}, got ${actual.source.commit}`);
  }
  if (expected.buildEnvironment.sourceDateEpoch !== actual.buildEnvironment.sourceDateEpoch) {
    diffs.push(
      `buildEnvironment.sourceDateEpoch: expected ${String(expected.buildEnvironment.sourceDateEpoch)}, got ${String(actual.buildEnvironment.sourceDateEpoch)}`,
    );
  }

  const expectedInputs = Object.keys(expected.buildInputHashes).sort();
  const actualInputs = Object.keys(actual.buildInputHashes).sort();
  if (expectedInputs.join("\n") !== actualInputs.join("\n")) {
    diffs.push(
      `buildInputHashes keys: expected [${expectedInputs.join(", ")}], got [${actualInputs.join(", ")}]`,
    );
  }
  for (const key of expectedInputs) {
    const expectedHash = expected.buildInputHashes[key];
    const actualHash = actual.buildInputHashes[key];
    if (expectedHash !== actualHash) {
      diffs.push(`${key}: expected ${expectedHash}, got ${actualHash ?? "missing"}`);
    }
    if (expectedHash === "file-not-found" || actualHash === "file-not-found") {
      diffs.push(`${key}: missing build input`);
    }
  }

  for (const key of ["dist/", "sw.js"]) {
    const expectedHash = expected.artefacts[key];
    const actualHash = actual.artefacts[key];
    if (
      expectedHash &&
      expectedHash !== "directory-not-found" &&
      expectedHash !== "file-not-found" &&
      expectedHash !== actualHash
    ) {
      diffs.push(`artefacts.${key}: expected ${expectedHash}, got ${actualHash ?? "missing"}`);
    }
  }
  return diffs;
}

/**
 * @param {string} manifestPath
 * @returns {RebuilderManifest}
 */
function readManifest(manifestPath) {
  const parsed = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (!isManifest(parsed)) {
    throw new Error(`invalid ${MANIFEST_SCHEMA} manifest: ${manifestPath}`);
  }
  return parsed;
}

/**
 * @param {string} savedPath
 * @param {string} root
 * @returns {string[]}
 */
export function verifyManifest(savedPath, root = ROOT) {
  const expected = readManifest(resolve(savedPath));
  const actual = createManifest({
    root,
    dist: join(root, "dist"),
    distZipPath: join(root, "dist.zip"),
  });
  return compareManifests(expected, actual);
}

/**
 * Compare two files or two directories by content.
 *
 * @param {string} leftPath
 * @param {string} rightPath
 * @returns {{ match: boolean; left: string; right: string }}
 */
export function comparePaths(leftPath, rightPath) {
  const leftExists = existsSync(leftPath);
  const rightExists = existsSync(rightPath);
  if (!leftExists || !rightExists) {
    return {
      match: false,
      left: leftExists ? "present" : "missing",
      right: rightExists ? "present" : "missing",
    };
  }

  const leftIsDirectory = statSync(leftPath).isDirectory();
  const rightIsDirectory = statSync(rightPath).isDirectory();
  if (leftIsDirectory !== rightIsDirectory) {
    return {
      match: false,
      left: leftIsDirectory ? "directory" : "file",
      right: rightIsDirectory ? "directory" : "file",
    };
  }

  const left = leftIsDirectory
    ? hashDirectory(leftPath, GENERATED_DIST_FILES)
    : sha256File(leftPath);
  const right = rightIsDirectory
    ? hashDirectory(rightPath, GENERATED_DIST_FILES)
    : sha256File(rightPath);
  return { match: left === right, left, right };
}

/**
 * @param {string[]} args
 * @returns {void}
 */
export function main(args = process.argv.slice(2)) {
  const isDryRun = args.includes("--dry-run");
  const verifyIdx = args.indexOf("--verify");
  const compareIdx = args.indexOf("--compare");
  if (verifyIdx !== -1 && compareIdx !== -1) {
    console.error("[check-reproducible] Choose either --verify or --compare, not both.");
    process.exitCode = 1;
    return;
  }

  if (compareIdx !== -1) {
    const leftArg = args[compareIdx + 1];
    const rightArg = args[compareIdx + 2];
    if (!leftArg || !rightArg) {
      console.error("[check-reproducible] --compare requires two files or directories.");
      process.exitCode = 1;
      return;
    }
    const result = comparePaths(resolve(leftArg), resolve(rightArg));
    console.log(`[check-reproducible] left:  ${result.left}`);
    console.log(`[check-reproducible] right: ${result.right}`);
    if (!result.match) {
      console.error("[check-reproducible] Non-reproducible output: content differs.");
      process.exitCode = 1;
    } else {
      console.log("[check-reproducible] Reproducible output: content matches.");
    }
    return;
  }

  if (verifyIdx !== -1) {
    const verifyPath = args[verifyIdx + 1];
    if (!verifyPath) {
      console.error("[check-reproducible] --verify requires a manifest path.");
      process.exitCode = 1;
      return;
    }
    try {
      const diffs = verifyManifest(verifyPath);
      if (diffs.length === 0) {
        console.log("[check-reproducible] All manifest inputs and artifacts match.");
      } else {
        console.error(`[check-reproducible] ${diffs.length} manifest difference(s):`);
        for (const diff of diffs) console.error(`  ${diff}`);
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(
        `[check-reproducible] ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  const manifest = createManifest();
  if (isDryRun) {
    console.log("[check-reproducible] Dry-run mode: manifest not written.");
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  if (!existsSync(DIST)) {
    if (process.env["CI"]) {
      console.error("[check-reproducible] dist/ not found — run build first (npm run build).");
      process.exitCode = 1;
      return;
    }
    mkdirSync(DIST, { recursive: true });
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`[check-reproducible] Manifest written to ${MANIFEST_PATH}`);
  console.log(`[check-reproducible] Commit: ${manifest.source.commit}`);
  console.log(`[check-reproducible] dist.zip SHA-256: ${manifest.artefacts["dist.zip"]}`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}
