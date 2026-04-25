#!/usr/bin/env node
// @ts-check
/**
 * check-sw-version.mjs — Sprint 1, Item 5 (v7.4)
 *
 * Ensures the Service Worker cache name in sw.js matches the version in
 * package.json. Fails with exit code 1 if they diverge, which blocks `npm
 * run check` and CI from passing with a stale SW version string.
 *
 * Usage: node scripts/check-sw-version.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const sw = readFileSync(resolve(root, "sw.js"), "utf-8");

const appVersion = pkg.version;
const expectedCacheName = `familydashboard-v${appVersion}`;

// The SW declares: const CACHE_NAME = "familydashboard-vX.Y.Z";
const cacheNameMatch = sw.match(/const CACHE_NAME\s*=\s*["']([^"']+)["']/);
if (!cacheNameMatch) {
  console.error("❌  Could not find CACHE_NAME declaration in sw.js");
  process.exit(1);
}

const actualCacheName = cacheNameMatch[1];
// Accept either the exact version OR the build-time placeholder (used in source sw.js).
const placeholder = "familydashboard-v__APP_VERSION__";
if (actualCacheName !== expectedCacheName && actualCacheName !== placeholder) {
  console.error(
    `❌  SW version mismatch!\n` +
      `    package.json version : ${appVersion}\n` +
      `    expected CACHE_NAME  : ${expectedCacheName} (or placeholder)\n` +
      `    actual   CACHE_NAME  : ${actualCacheName}\n` +
      `\n    Fix: update CACHE_NAME in sw.js to "${expectedCacheName}" or use the __APP_VERSION__ placeholder`,
  );
  process.exit(1);
}

if (actualCacheName === placeholder) {
  console.log(
    `✅  SW version: using __APP_VERSION__ placeholder — will resolve to v${appVersion} at build time`,
  );
} else {
  console.log(`✅  SW version matches package.json: v${appVersion}`);
}
