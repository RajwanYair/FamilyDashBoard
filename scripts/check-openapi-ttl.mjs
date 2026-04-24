#!/usr/bin/env node
/**
 * check-openapi-ttl.mjs — V13-EDGE CI gate
 *
 * Verifies that every GET route in worker/openapi.yaml has an explicit
 * `x-kv-ttl` annotation (0 = uncached, positive integer = TTL in seconds).
 *
 * Usage:
 *   node scripts/check-openapi-ttl.mjs          # verify (CI)
 *
 * Exit codes:
 *   0  — all GET routes have x-kv-ttl
 *   1  — one or more GET routes missing x-kv-ttl
 *
 * Pure helpers exported for unit tests (isMain-guarded main).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "..");
const OPENAPI_PATH = resolve(REPO_ROOT, "worker", "openapi.yaml");

// ── Pure helpers (exported for tests) ────────────────────────────────────────

/**
 * Parse an OpenAPI YAML text and return every path that has a `get:` method.
 * Returns an array of `{ path, hasKvTtl }` objects.
 *
 * This is a lightweight line-by-line parser — it does NOT require a YAML lib.
 * It relies on the consistent indentation of the openapi.yaml in this project.
 *
 * Structure expected:
 *   paths:
 *     /some/route:
 *       get:
 *         x-kv-ttl: 300   ← must be present within the `get:` block
 *         ...
 */
export function parseGetRoutes(yamlText) {
  const lines = yamlText.split("\n");
  /** @type {Array<{path: string, hasKvTtl: boolean}>} */
  const routes = [];

  let currentPath = null;
  let inGet = false;
  let getIndent = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Path key: "  /some/route:" (indented by 2 spaces under `paths:`)
    const pathMatch = trimmed.match(/^  (\/[^\s:]+):$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      inGet = false;
      continue;
    }

    // HTTP method block: "    get:"
    const methodMatch = trimmed.match(/^(\s+)(get):\s*$/);
    if (methodMatch && currentPath) {
      if (methodMatch[2] === "get") {
        inGet = true;
        getIndent = methodMatch[1].length;
        routes.push({ path: currentPath, hasKvTtl: false });
      }
      continue;
    }

    if (inGet && currentPath) {
      const indentMatch = trimmed.match(/^(\s+)/);
      const lineIndent = indentMatch ? indentMatch[1].length : 0;

      // Once indentation drops back to getIndent or less, we've left the get block
      if (trimmed.length > 0 && lineIndent <= getIndent && !trimmed.startsWith(" ".repeat(getIndent + 1))) {
        inGet = false;
        continue;
      }

      if (trimmed.match(/^\s+x-kv-ttl:\s*\d+/)) {
        routes[routes.length - 1].hasKvTtl = true;
      }
    }
  }

  return routes;
}

/**
 * Validate that all GET routes have x-kv-ttl.
 * Returns array of path strings that are missing the annotation.
 */
export function findMissingTtl(routes) {
  return routes.filter((r) => !r.hasKvTtl).map((r) => r.path);
}

// ── Main (CI) ─────────────────────────────────────────────────────────────────

const isMain =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("check-openapi-ttl.mjs") ||
    process.argv[1].endsWith("check-openapi-ttl"));

if (isMain) {
  const yaml = readFileSync(OPENAPI_PATH, "utf8");
  const routes = parseGetRoutes(yaml);
  const missing = findMissingTtl(routes);

  if (missing.length === 0) {
    console.log(
      `✅ openapi-ttl: all ${routes.length} GET route(s) have x-kv-ttl annotation`
    );
    process.exit(0);
  } else {
    console.error(
      `❌ openapi-ttl: ${missing.length} GET route(s) missing x-kv-ttl annotation:`
    );
    for (const p of missing) console.error(`   ${p}`);
    console.error(
      "   Add x-kv-ttl: <seconds> (0 = uncached) to each route in worker/openapi.yaml"
    );
    process.exit(1);
  }
}
