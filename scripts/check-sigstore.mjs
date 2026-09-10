#!/usr/bin/env node
// @ts-check
/**
 * Sigstore/cosign signing gate (V14-SECURITY-L3).
 *
 * Verifies that the release workflow contains the required Sigstore cosign
 * artifact-signing steps for dist.zip and sw.js. Any release without these
 * steps produces unsigned artefacts that cannot be independently verified
 * by third parties.
 *
 * Exit 1 if:
 *   - release.yml does not exist
 *   - cosign sign-blob step for dist.zip is missing
 *   - cosign sign-blob step for sw.js is missing
 *   - dist.zip.bundle is not listed as a release artefact
 *   - exact identity/issuer verification is missing
 *   - a permissive identity regexp is still used
 *
 * Usage:
 *   node scripts/check-sigstore.mjs
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_YML = join(ROOT, ".github", "workflows", "release.yml");

let exitCode = 0;

/**
 * @param {string} msg
 */
function fail(msg) {
  console.error(`[check-sigstore] FAIL  ${msg}`);
  exitCode = 1;
}

/**
 * @param {string} msg
 */
function pass(msg) {
  console.log(`[check-sigstore] OK    ${msg}`);
}

if (!existsSync(RELEASE_YML)) {
  fail("release.yml not found — cannot verify Sigstore signing steps");
  process.exit(1);
}

const content = readFileSync(RELEASE_YML, "utf-8");

// ── Check 1: cosign-installer action or cosign binary installation ─────────
const hasCosignInstall = content.includes("cosign-installer") || content.includes("cosign version");
if (hasCosignInstall) {
  pass("cosign installer step is present in release.yml");
} else {
  fail("cosign installer step is missing from release.yml — add sigstore/cosign-installer action");
}

// ── Check 2: cosign sign-blob for dist.zip ─────────────────────────────────
const hasSignDist = content.includes("cosign sign-blob") && content.includes("dist.zip");
if (hasSignDist) {
  pass("cosign sign-blob dist.zip step is present");
} else {
  fail("cosign sign-blob for dist.zip is missing from release.yml — artefacts are unsigned");
}

// ── Check 3: cosign sign-blob for sw.js ───────────────────────────────────
const hasSignSw = content.includes("cosign sign-blob") && content.includes("sw.js.bundle");
if (hasSignSw) {
  pass("cosign sign-blob sw.js step is present");
} else {
  fail("cosign sign-blob for sw.js is missing from release.yml — service worker is unsigned");
}

// ── Check 4: bundle files included in release artefacts ────────────────────
const hasBundleFiles = content.includes("dist.zip.bundle");
if (hasBundleFiles) {
  pass("dist.zip.bundle is listed as a release artefact");
} else {
  fail(
    "dist.zip.bundle is not listed in release artefacts — Sigstore verification bundles will not be downloadable",
  );
}

// ── Check 5: exact identity and issuer verification ────────────────────────
const hasExactIdentity = content.includes('--certificate-identity="$EXPECTED_COSIGN_IDENTITY"');
const hasExactIssuer = content.includes('--certificate-oidc-issuer="$COSIGN_OIDC_ISSUER"');
if (hasExactIdentity && hasExactIssuer) {
  pass("release verification pins the exact GitHub workflow identity and OIDC issuer");
} else {
  fail(
    "release verification must pass --certificate-identity and --certificate-oidc-issuer explicitly",
  );
}

if (content.includes('certificate-identity-regexp=".*"')) {
  fail("release workflow still accepts any certificate identity");
} else {
  pass("release workflow has no permissive certificate identity regexp");
}

if (exitCode === 0) {
  console.log("\n[check-sigstore] Signing and exact-identity verification checks passed.");
} else {
  console.error(
    "\n[check-sigstore] Sigstore gate FAILED. Fix signing and verification before tagging.",
  );
}
process.exit(exitCode);
