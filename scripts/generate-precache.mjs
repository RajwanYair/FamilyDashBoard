/**
 * generate-precache.mjs — Stream SW.1
 *
 * Reads the Vite build output (dist/assets/) and generates
 * dist/sw-precache-manifest.json containing all hashed asset URLs
 * so the ServiceWorker can precache them without a hardcoded list.
 *
 * Usage:
 *   node scripts/generate-precache.mjs          (standalone)
 *   npm run build && node scripts/generate-precache.mjs  (postbuild)
 *
 * Output: dist/sw-precache-manifest.json
 */

import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = join(rootDir, "dist");
const assetsDir = join(distDir, "assets");

if (!existsSync(distDir)) {
  console.error("❌  dist/ directory not found — run `npm run build` first.");
  process.exit(1);
}

// Collect all JS and CSS hashed assets from dist/assets/.
const assetEntries = existsSync(assetsDir)
  ? readdirSync(assetsDir, { withFileTypes: true })
      .filter((f) => f.isFile() && (f.name.endsWith(".js") || f.name.endsWith(".css")))
      .map((f) => `./assets/${f.name}`)
  : [];

// Root shell files always precached.
const shellFiles = ["./index.html", "./manifest.webmanifest", "./sw.js", "./icon.svg"];

// Deduplicate (safety guard).
const manifest = [...new Set([...shellFiles, ...assetEntries])];

const outPath = join(distDir, "sw-precache-manifest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

console.log(`✅  sw-precache-manifest.json written — ${manifest.length} entries`);
manifest.forEach((u) => console.log(`   ${u}`));
