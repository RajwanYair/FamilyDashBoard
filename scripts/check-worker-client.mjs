#!/usr/bin/env node
/**
 * check-worker-client.mjs — F18 (v12.9.0)
 *
 * Ensures that src/core/worker-client.ts is in sync with worker/openapi.yaml.
 * The script hashes the sorted list of path keys from openapi.yaml and compares
 * it to the `// @openapi-paths-hash:` annotation in worker-client.ts.
 *
 * If the hash is missing or mismatched the script exits 1, blocking CI.
 *
 * Usage:
 *   node scripts/check-worker-client.mjs          # verify
 *   node scripts/check-worker-client.mjs --update # write current hash
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const OPENAPI_PATH = resolve(ROOT, "worker", "openapi.yaml");
const CLIENT_PATH = resolve(ROOT, "src", "core", "worker-client.ts");
const HASH_TAG = "// @openapi-paths-hash:";

// ── Pure helpers (exported-by-convention for unit tests) ─────────────────────

/**
 * Extract sorted API path keys from an openapi.yaml text string.
 * Matches lines with 2-space indent followed by `/...:`
 * e.g. `  /api/weather:` → `/api/weather`
 */
export function extractPathKeys(yamlText) {
  const keys = [];
  for (const line of yamlText.split("\n")) {
    const m = line.match(/^  (\/[^:]+):/);
    if (m) keys.push(m[1]);
  }
  return keys.sort();
}

/**
 * Compute the SHA-256 hash of the sorted path-key list.
 * @param {string[]} pathKeys - sorted array of openapi path keys
 * @returns {string} hex digest
 */
export function hashPathKeys(pathKeys) {
  return createHash("sha256").update(pathKeys.join("\n")).digest("hex");
}

/**
 * Read the stored @openapi-paths-hash comment from a source file.
 * Returns null if the annotation is absent.
 */
export function readStoredHash(fileText) {
  const m = fileText.match(/^\/\/ @openapi-paths-hash: ([0-9a-f]{64})/m);
  return m ? m[1] : null;
}

// ── Main runner ───────────────────────────────────────────────────────────────

const isMain =
  process.argv[1] === fileURLToPath(import.meta.url) ||
  process.argv[1]?.endsWith("check-worker-client.mjs");

if (isMain) {
  const update = process.argv.includes("--update");

  const yamlText = readFileSync(OPENAPI_PATH, "utf8");
  const clientText = readFileSync(CLIENT_PATH, "utf8");

  const pathKeys = extractPathKeys(yamlText);
  const computedHash = hashPathKeys(pathKeys);
  const storedHash = readStoredHash(clientText);

  if (update) {
    let newClientText;
    if (storedHash !== null) {
      newClientText = clientText.replace(
        /^\/\/ @openapi-paths-hash: [0-9a-f]{64}/m,
        `${HASH_TAG} ${computedHash}`,
      );
    } else {
      // Insert the annotation after the opening `/**` block comment
      newClientText = clientText.replace(/^( \*\/)\n/m, `$1\n${HASH_TAG} ${computedHash}\n`);
    }
    writeFileSync(CLIENT_PATH, newClientText, "utf8");
    console.log(`✅  Updated @openapi-paths-hash → ${computedHash}`);
    console.log(`    Paths (${pathKeys.length}): ${pathKeys.join(", ")}`); // owasp-allow:A09 — route path-keys, not credentials
    process.exit(0);
  }

  if (storedHash === null) {
    console.error(`❌  worker-client.ts is missing the ${HASH_TAG} annotation.`);
    console.error(`   Run: node scripts/check-worker-client.mjs --update`);
    process.exit(1);
  }

  if (storedHash !== computedHash) {
    console.error(`❌  worker-client.ts is out of sync with worker/openapi.yaml.`);
    console.error(`   Stored hash  : ${storedHash}`);
    console.error(`   Current hash : ${computedHash}`);
    console.error(`   Routes in openapi.yaml (${pathKeys.length}): ${pathKeys.join(", ")}`);
    console.error(`   Run: node scripts/check-worker-client.mjs --update`);
    process.exit(1);
  }

  console.log(
    `✅  worker-client.ts is in sync with worker/openapi.yaml` +
      ` (${pathKeys.length} routes, hash ${computedHash.slice(0, 8)}…)`,
  );
}
