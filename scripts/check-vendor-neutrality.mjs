#!/usr/bin/env node
/**
 * check-vendor-neutrality.mjs
 *
 * Sprint 228 / ADR-031 — Vendor-neutrality drill for the FamilyDashBoard
 * Cloudflare Worker.  Scans worker/src/ for Cloudflare-specific bindings and
 * APIs, then prints a checklist of alternatives for Deno Deploy and Bun Deploy
 * so the operator can assess portability risk before each major release.
 *
 * This is an INFORMATIONAL script — it always exits 0.
 * It does NOT fail CI.  Run it quarterly as part of the ADR-031 drill:
 *   node scripts/check-vendor-neutrality.mjs
 *
 * ADR reference: docs/adr/ADR-031-vendor-portability.md
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WORKER_SRC = new URL("../worker/src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// ── Cloudflare-specific API catalogue ─────────────────────────────────────
// Each entry describes one CF API and its portability alternatives.

const CF_APIS = [
  {
    name: "KV (Workers KV)",
    pattern: /KVNamespace|\.get\(|\.put\(|\.list\(|\.delete\(/,
    files: ["types.ts", "utils/kv.ts"],
    denoEquivalent: "Deno KV (built-in `Deno.openKv()`) — near-identical API",
    bunEquivalent: "Bun SQLite (bun:sqlite) or external Redis via ioredis",
    portabilityRisk: "LOW — worker already wraps KV behind a `KvStore` interface",
    adapterFile: "worker/src/utils/kv.ts",
  },
  {
    name: "D1 (Cloudflare D1 — SQLite edge DB)",
    pattern: /D1Database|\.prepare\(|\.batch\(/,
    files: ["types.ts", "utils/d1-reports.ts", "utils/d1-telemetry.ts"],
    denoEquivalent: "Deno KV or Turso (libSQL) via HTTP API",
    bunEquivalent: "bun:sqlite (drop-in) — schema migrations portable as-is",
    portabilityRisk: "MEDIUM — D1 batch API differs from standard SQLite; 2 adapter files",
    adapterFile: "worker/src/utils/d1-reports.ts",
  },
  {
    name: "Durable Objects (DO)",
    pattern: /DurableObject|DurableObjectNamespace|DurableObjectState|DurableObjectStorage/,
    files: ["types.ts", "durable-objects/rate-limiter-do.ts", "durable-objects/orchestrator.ts"],
    denoEquivalent: "No direct equivalent — use Deno KV atomic transactions or Deno Cron",
    bunEquivalent: "No direct equivalent — use in-process state + Redis for distributed lock",
    portabilityRisk: "HIGH — Durable Objects are a CF-exclusive primitive; 2 usages (rate-limiter, orchestrator)",
    adapterFile: "worker/src/durable-objects/",
  },
  {
    name: "Analytics Engine",
    pattern: /AnalyticsEngineDataset|\.writeDataPoint\(/,
    files: ["types.ts", "utils/analytics.ts"],
    denoEquivalent: "Deno Observability (preview) or POST to Loki/ClickHouse",
    bunEquivalent: "POST to self-hosted ClickHouse or Grafana Cloud",
    portabilityRisk: "LOW — analytics.ts is already a thin shim; silently no-ops when absent",
    adapterFile: "worker/src/utils/analytics.ts",
  },
  {
    name: "Cloudflare Email Routing (MailChannels)",
    pattern: /EmailMessage|sendEmail|MailChannels/,
    files: ["src/routes/cron.ts"],
    denoEquivalent: "Deno + Resend SDK (resend.com) — same REST shape",
    bunEquivalent: "Bun + Resend SDK or nodemailer",
    portabilityRisk: "LOW — 1 call site in cron.ts; swap send() implementation",
    adapterFile: "worker/src/routes/cron.ts",
  },
  {
    name: "Wrangler / CF runtime globals (caches, cf object)",
    pattern: /caches\.default|event\.waitUntil|request\.cf\b/,
    files: ["index.ts"],
    denoEquivalent: "No Cache API in Deno Deploy — use in-memory LRU or Deno KV",
    bunEquivalent: "No Cache API in Bun — same workaround",
    portabilityRisk: "LOW — only SW-side APP_SHELL pre-cache uses caches; worker bypasses it",
    adapterFile: "worker/src/index.ts",
  },
];

// ── File scanner ───────────────────────────────────────────────────────────

function walkTs(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkTs(full, acc);
    else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) acc.push(full);
  }
  return acc;
}

function scanFiles(apiEntry) {
  const found = [];
  try {
    const files = walkTs(WORKER_SRC);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (apiEntry.pattern.test(src)) {
        found.push(relative(process.cwd(), file));
      }
    }
  } catch {
    // WORKER_SRC missing — treat as no matches
  }
  return found;
}

// ── Report ─────────────────────────────────────────────────────────────────

const DIVIDER = "─".repeat(72);

console.log(`\n${"═".repeat(72)}`);
console.log("  FamilyDashBoard — Worker Vendor-Neutrality Drill  (ADR-031)");
console.log(`  ${new Date().toISOString().slice(0, 10)}  |  Sprint 228 (v13.25.0)`);
console.log(`${"═".repeat(72)}\n`);

let totalApis = 0;
let detectedApis = 0;

for (const api of CF_APIS) {
  totalApis++;
  const hits = scanFiles(api);
  const detected = hits.length > 0;
  if (detected) detectedApis++;

  const icon = detected ? "⚠️ " : "✅";
  const status = detected ? `IN USE (${hits.length} file${hits.length > 1 ? "s" : ""})` : "NOT DETECTED";

  console.log(`${icon}  ${api.name}`);
  console.log(`   Status          : ${status}`);
  if (detected) {
    console.log(`   Found in        : ${hits.join(", ")}`);
  }
  console.log(`   Portability risk: ${api.portabilityRisk}`);
  console.log(`   Deno Deploy alt : ${api.denoEquivalent}`);
  console.log(`   Bun Deploy alt  : ${api.bunEquivalent}`);
  console.log(`   Primary adapter : ${api.adapterFile}`);
  console.log(DIVIDER);
}

console.log(`\nSummary: ${detectedApis}/${totalApis} Cloudflare-specific APIs detected.\n`);

if (detectedApis === 0) {
  console.log("✅  Worker appears vendor-neutral — no CF-specific APIs detected.");
} else {
  console.log("📋  Action items for portability:");
  console.log("     1. Review each ⚠️  entry above before migrating off Cloudflare.");
  console.log("     2. HIGH-risk items require a migration spike (add to ROADMAP).");
  console.log("     3. Update docs/adr/ADR-031-vendor-portability.md after each drill.");
  console.log("     4. Next drill: run quarterly or before any major infra change.\n");
}
console.log("(Script always exits 0 — informational only per ADR-031.)\n");
process.exit(0);
