#!/usr/bin/env node
/**
 * check-csp-wildcards.mjs
 *
 * Audit the `_headers` file for CSP wildcard entries
 * (e.g. `*.example.com`, `https:`, `http:`, `*`) that could be narrowed to
 * specific origins, reducing the XSS / data-exfiltration attack surface.
 *
 * Exit codes:
 *   0 — no problematic wildcards found (CSP is tight)
 *   1 — one or more wildcard entries found (review required)
 *
 * Usage:
 *   node scripts/check-csp-wildcards.mjs
 *
 * CI integration: add `node scripts/check-csp-wildcards.mjs` to the
 * security step in `.github/workflows/ci.yml` so widening CSP with a new
 * wildcard always triggers a review.
 *
 * ADR reference: docs/adr/ADR-041-csp-wildcard-narrowing.md
 */

import { readFileSync, existsSync } from "node:fs";

const HEADERS_FILE = "_headers";
const SEVERITY = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

// Patterns that indicate a wildcard or overly-broad CSP value.
// Each entry: { pattern: RegExp, label: string, severity, narrowHint: string }
const WILDCARD_PATTERNS = [
  {
    pattern: /\bunsafe-inline\b/,
    label: "unsafe-inline",
    severity: SEVERITY.HIGH,
    narrowHint:
      "Replace with a nonce or hash source. For styles, prefer @layer + CSS custom properties.",
  },
  {
    pattern: /\bunsafe-eval\b/,
    label: "unsafe-eval",
    severity: SEVERITY.HIGH,
    narrowHint:
      "Eliminate eval() / new Function() usage. Vite's dev server needs this — confirm it is dev-only.", // owasp-allow:A03 — advisory text string, not a code call,
  },
  {
    pattern: /(?<![a-zA-Z])\*(?![a-zA-Z.])(?!\s*(\.html|\.js|\.css))/,
    label: "bare wildcard (*)",
    severity: SEVERITY.HIGH,
    narrowHint: "Replace * with an explicit list of allowed origins.",
  },
  {
    pattern: /\bhttps:\s/,
    label: "https: scheme-only source",
    severity: SEVERITY.HIGH,
    narrowHint:
      "Replace 'https:' with explicit host allowlist. Any HTTPS origin is currently allowed.",
  },
  {
    pattern: /\bhttp:\s/,
    label: "http: scheme-only source",
    severity: SEVERITY.HIGH,
    narrowHint: "Replace 'http:' with explicit origins. HTTP sources leak data unencrypted.",
  },
  {
    pattern: /\*\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/,
    label: "subdomain wildcard (*.example.com)",
    severity: SEVERITY.MEDIUM,
    narrowHint:
      "List only the specific subdomains used. Subdomain wildcards allow any future subdomain, including compromised ones.",
  },
  {
    pattern: /\bdata:\b/,
    label: "data: URI scheme",
    severity: SEVERITY.MEDIUM,
    narrowHint:
      "data: URIs in script-src / object-src are equivalent to unsafe-inline. Remove if possible.",
  },
  {
    pattern: /\bblob:\b/,
    label: "blob: URI scheme",
    severity: SEVERITY.LOW,
    narrowHint:
      "Blob URLs are worker-spawned — confirm this is intentional and only in script-src/worker-src.",
  },
  {
    pattern: /\bfilesystem:\b/,
    label: "filesystem: URI scheme",
    severity: SEVERITY.MEDIUM,
    narrowHint: "filesystem: is deprecated and should not appear in CSP.",
  },
];

// Parse _headers file into sections: { path, headers: Map<name, value> }
function parseHeadersFile(content) {
  const sections = [];
  let current = null;
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.trimStart().startsWith("#")) continue;
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      // Path line
      current = { path: line.trim(), headers: new Map() };
      sections.push(current);
    } else if (current) {
      // Header line
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const name = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      current.headers.set(name, value);
    }
  }
  return sections;
}

// Run the audit
function main() {
  if (!existsSync(HEADERS_FILE)) {
    console.log(`[csp-wildcard] ⚠  ${HEADERS_FILE} not found — nothing to audit.`);
    process.exit(0);
  }

  const content = readFileSync(HEADERS_FILE, "utf8");
  const sections = parseHeadersFile(content);

  const findings = [];

  for (const { path, headers } of sections) {
    // Check Content-Security-Policy and Content-Security-Policy-Report-Only
    for (const headerName of ["content-security-policy", "content-security-policy-report-only"]) {
      const cspValue = headers.get(headerName);
      if (!cspValue) continue;

      // Split into directives
      for (const directive of cspValue.split(";")) {
        const trimmed = directive.trim();
        if (!trimmed) continue;
        const [directiveName, ...sourceParts] = trimmed.split(/\s+/);
        const sources = sourceParts.join(" ");

        for (const { pattern, label, severity, narrowHint } of WILDCARD_PATTERNS) {
          if (pattern.test(sources)) {
            findings.push({
              path,
              header: headerName,
              directive: directiveName ?? "(unknown)",
              match: label,
              severity,
              narrowHint,
            });
          }
        }
      }
    }
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log("  FamilyDashBoard — CSP Wildcard Audit  (ADR-041)");
  console.log(`  ${new Date().toISOString().slice(0, 10)}  | (v13.25.0)`);
  console.log(`${"═".repeat(72)}\n`);
  console.log(`  Audited: ${HEADERS_FILE}`);
  console.log(`  Sections scanned: ${String(sections.length)}`);
  console.log(`  Findings: ${String(findings.length)}\n`);

  if (findings.length === 0) {
    console.log("✅  No CSP wildcard issues found — policy is tight.\n");
    process.exit(0);
  }

  // Group by severity
  const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const f of findings) {
    (bySeverity[f.severity] ?? bySeverity.LOW).push(f);
  }

  for (const [sev, list] of Object.entries(bySeverity)) {
    if (list.length === 0) continue;
    const icon = sev === "HIGH" ? "🔴" : sev === "MEDIUM" ? "🟡" : "🔵";
    console.log(`${icon}  ${sev} (${String(list.length)} finding${list.length > 1 ? "s" : ""})`);
    for (const f of list) {
      console.log(`   Path      : ${f.path}`);
      console.log(`   Header    : ${f.header}`);
      console.log(`   Directive : ${f.directive}`);
      console.log(`   Match     : ${f.match}`);
      console.log(`   Fix       : ${f.narrowHint}`);
      console.log(`   ${"─".repeat(64)}`);
    }
  }

  const hasHigh = bySeverity.HIGH.length > 0;
  if (hasHigh) {
    console.error("\n❌  HIGH-severity CSP wildcards found — review required before release.\n");
    process.exit(1);
  } else {
    console.warn("\n⚠  Medium/Low CSP wildcards found — review recommended but not blocking.\n");
    process.exit(0);
  }
}

main();
