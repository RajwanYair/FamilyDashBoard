/**
 * Stream SW.4 — Compile sw.ts → dist/sw.js using TypeScript's transpileModule.
 *
 * Usage (called by vite.config.ts injectSwVersion plugin after build):
 *   node scripts/build-sw.mjs <version>
 *
 * TypeScript is resolved from the parent node_modules (MyScripts/node_modules).
 * No extra dependencies — typescript is already a dev dep via the monorepo.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/build-sw.mjs <version>");
  process.exit(1);
}

// Resolve typescript from local node_modules first (CI), then parent monorepo (dev).
const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  ts = require("../../node_modules/typescript");
}

const swTs = readFileSync(resolve(ROOT, "sw.ts"), "utf-8");

/** @type {{ outputText: string }} */
const { outputText } = ts.transpileModule(swTs, {
  compilerOptions: {
    // ES2020 = 8, Module.None = 0 (ServiceWorker: no ESM import/export)
    target: 8,
    module: 0,
    removeComments: false,
  },
});

// Replace __APP_VERSION__ (declared via TypeScript declare const) with the real version.
const swOut = outputText.replace(/__APP_VERSION__/g, JSON.stringify(version));

writeFileSync(resolve(ROOT, "dist", "sw.js"), swOut);
console.log(`✔ Built dist/sw.js  (v${version}  ${swOut.length} bytes)`);
