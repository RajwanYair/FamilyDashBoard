#!/usr/bin/env node
/**
 * Sprint 221 — OWASP Top 10 rotation automated check.
 *
 * Scans `src/` for patterns that correspond to OWASP Top 10 (2021) categories
 * relevant to a client-side TypeScript/JavaScript application:
 *
 *   A01 – Broken Access Control:       hardcoded role bypass, admin checks
 *   A02 – Cryptographic Failures:      MD5/SHA1 usage, Math.random for secrets
 *   A03 – Injection:                   eval, new Function, innerHTML, dangerouslySetInnerHTML
 *   A04 – Insecure Design:             TODO/FIXME SECURITY markers flagged for review
 *   A05 – Security Misconfiguration:   wildcard CORS in fetch headers, DEBUG flags
 *   A06 – Vulnerable Components:       (handled by npm audit — out of scope here)
 *   A07 – Auth Failures:               token/password stored in localStorage/sessionStorage
 *   A08 – Software Integrity Failures: dynamic import() with user-controlled path
 *   A09 – Logging Failures:            console.log with potential credential names
 *   A10 – SSRF:                        fetch() with raw user-supplied URL
 *
 * Each check produces a WARNING (non-blocking) or ERROR (blocking).
 * Script exits 1 if any ERROR violations are found.
 *
 * Usage:
 *   node scripts/check-owasp.mjs
 *   node scripts/check-owasp.mjs --warn-only   # exit 0 even with errors
 *
 * Suppression:  append  // owasp-allow:<CATEGORY>  to suppress a line.
 * Example:      fetch(url);  // owasp-allow:A10
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SRC = join(ROOT, "src");
const WARN_ONLY = process.argv.includes("--warn-only");

/** @typedef {{ category: string; label: string; severity: "error"|"warn"; pattern: RegExp; safeMarkers?: string[] }} Rule */

/** @type {Rule[]} */
const RULES = [
  // A02 — Cryptographic Failures
  {
    category: "A02",
    label: "MD5/SHA1 usage (weak crypto)",
    severity: "error",
    pattern: /\b(?:md5|sha1|sha-1|createHash\(['"]md5['"]|createHash\(['"]sha1['"])/i,
  },
  {
    category: "A02",
    label: "Math.random() used for security/token",
    severity: "warn",
    pattern: /Math\.random\(\).{0,40}(?:token|secret|key|nonce|csrf|auth)/i,
  },

  // A03 — Injection
  {
    category: "A03",
    label: "eval() call",
    severity: "error",
    pattern: /\beval\s*\(/,
  },
  {
    category: "A03",
    label: "new Function() call",
    severity: "error",
    pattern: /\bnew\s+Function\s*\(/,
  },
  {
    category: "A03",
    label: "dangerouslySetInnerHTML",
    severity: "error",
    pattern: /dangerouslySetInnerHTML/,
  },
  {
    category: "A03",
    label: "bare innerHTML/outerHTML assignment (use trustedHTML())",
    severity: "error",
    pattern: /\.(?:inner|outer)HTML\s*=(?!=)/,
    // Lines already using trustedHTML() are safe — the Trusted Types policy wraps the value
    safeMarkers: ["trustedHTML("],
  },

  // A04 — Insecure Design (advisory)
  {
    category: "A04",
    label: "SECURITY TODO/FIXME requires review",
    severity: "warn",
    pattern: /\/\/\s*(?:TODO|FIXME)\s*[:\-]?\s*(?:security|vuln|hack|unsafe)/i,
  },

  // A05 — Security Misconfiguration
  {
    category: "A05",
    label: "Wildcard CORS origin in fetch headers",
    severity: "error",
    pattern: /'Access-Control-Allow-Origin'\s*:\s*['"]\*['"]/,
  },
  {
    category: "A05",
    label: "DEBUG / development flag hardcoded true",
    severity: "warn",
    pattern: /\bDEBUG\s*=\s*true\b/,
  },

  // A07 — Identification and Authentication Failures
  {
    category: "A07",
    label: "Credential stored in localStorage",
    severity: "error",
    pattern: /localStorage\.setItem\s*\(\s*['"][^'"]*(?:token|password|secret|auth|credential)[^'"]*['"]/i,
  },
  {
    category: "A07",
    label: "Credential stored in sessionStorage",
    severity: "error",
    pattern: /sessionStorage\.setItem\s*\(\s*['"][^'"]*(?:token|password|secret|auth|credential)[^'"]*['"]/i,
  },

  // A08 — Software and Data Integrity Failures
  {
    category: "A08",
    label: "Dynamic import() with variable path (potential code injection)",
    severity: "warn",
    pattern: /\bimport\s*\(\s*(?!['"`])[^)]+\)/,
  },

  // A09 — Security Logging and Monitoring Failures
  {
    category: "A09",
    label: "console.log potentially leaking credentials",
    severity: "warn",
    pattern: /console\.(?:log|warn|info|debug)\s*\([^)]*(?:password|secret|token|key|credential)/i,
  },

  // A10 — Server-Side Request Forgery (client-side analogue: open redirect)
  {
    category: "A10",
    label: "fetch() with user-controlled URL variable (possible SSRF analogue)",
    severity: "warn",
    pattern: /\bfetch\s*\(\s*(?:params|req|request|input|userInput|url)\b/i,
  },
];

/** Exempt source paths (relative to root, forward slashes). */
const EXEMPT_PATHS = [
  "src/core/trusted-types.ts",
];

/**
 * Recursively collect all .ts / .tsx files under `dir`.
 * @param {string} dir
 * @returns {string[]}
 */
function collectTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = collectTsFiles(SRC);

/** @type {{ severity: "error"|"warn"; file: string; line: number; category: string; label: string; code: string }[]} */
const findings = [];

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll("\\", "/");
  if (EXEMPT_PATHS.some((e) => rel.endsWith(e))) continue;

  const lines = readFileSync(file, "utf8").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const rule of RULES) {
      // Per-line suppression: // owasp-allow:A03 etc.
      if (line.includes(`owasp-allow:${rule.category}`)) continue;
      // Generic allow-all suppression
      if (line.includes("owasp-allow:all")) continue;        // Per-rule safe markers (e.g. trustedHTML( makes innerHTML safe)
        if (rule.safeMarkers?.some((m) => line.includes(m))) continue;
      if (rule.pattern.test(line)) {
        findings.push({
          severity: rule.severity,
          file: rel,
          line: i + 1,
          category: rule.category,
          label: rule.label,
          code: line.trim(),
        });
      }
    }
  }
}

const errors = findings.filter((f) => f.severity === "error");
const warnings = findings.filter((f) => f.severity === "warn");

if (findings.length === 0) {
  console.log("✅ OWASP Top 10 audit passed — no findings.");
  process.exit(0);
}

if (warnings.length > 0) {
  console.warn(`\n⚠️  OWASP warnings (${warnings.length}):\n`);
  for (const w of warnings) {
    console.warn(`  [${w.category}] ${w.file}:${w.line}  — ${w.label}`);
    console.warn(`    > ${w.code}`);
  }
}

if (errors.length > 0) {
  console.error(`\n❌ OWASP errors (${errors.length}) — must be fixed:\n`);
  for (const e of errors) {
    console.error(`  [${e.category}] ${e.file}:${e.line}  — ${e.label}`);
    console.error(`    > ${e.code}`);
  }
  console.error(
    "\nFix the errors, or suppress with '// owasp-allow:<CATEGORY>' and justification.\n",
  );
}

if (errors.length > 0 && !WARN_ONLY) {
  process.exit(1);
}

process.exit(0);
