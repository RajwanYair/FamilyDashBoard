#!/usr/bin/env node
/**
 * Sprint 221 — OWASP Top 10 rotation automated check.
 * Sprint 427 (v14.0.0) — added A03 document.write rule + A05 postMessage(*) rule.
 * Sprint 435 (v14.1.0) — added A01 open-redirect, A02 atob-credential, A03 setTimeout-string.
 * Sprint 444 (v14.2.0) — added A03 createElement-script, A04 __proto__ pollution, A04 defineProperty-prototype.
 * Sprint 450 (v14.2.0) — added A03 insertAdjacentHTML, A05 http-in-fetch, A07 window.opener access.
 * Sprint 456 (v14.2.0) — extended scan scope to `worker/src/` in addition to `src/`.
 * Sprint 464 (v14.3.0) — added A03 srcdoc iframe injection, A02 btoa-credential, A01 hardcoded admin bypass.
 * Sprint 466 (v14.3.0) — extended scan scope to `scripts/*.mjs` (build/CI helpers).
 * Sprint 473 (v14.4.0) — added A01 document.domain assignment, A03 new RegExp() dynamic, A04 Object.assign() prototype-pollution vector.
 * Sprint 482 (v14.5.0) — added A03 DOMParser.parseFromString XSS, A05 referrerPolicy='no-referrer' missing on ext links, A08 importScripts() in workers.
 * Sprint 487 (v14.5.0) — added A03 createContextualFragment XSS, A05 CORS credentials, A02 insecure crypto algorithms.
 *
 * Scans `src/`, `worker/src/`, and `scripts/` for patterns that correspond to OWASP Top 10 (2021) categories
 * relevant to a client-side TypeScript/JavaScript application:
 *
 *   A01 – Broken Access Control:       hardcoded role bypass, admin checks; open redirect
 *   A02 – Cryptographic Failures:      MD5/SHA1 usage, Math.random for secrets, atob for credentials
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
const WORKER_SRC = join(ROOT, "worker", "src");
const SCRIPTS_DIR = join(ROOT, "scripts"); // Sprint 466: also scan build/CI helpers
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
  {
    // Sprint 435: atob() decoding a credential-looking variable is not secure storage
    category: "A02",
    label: "atob() decoding potential credential (not a secure encoding)",
    severity: "warn",
    pattern: /\batob\s*\([^)]*(?:token|secret|password|key|credential)[^)]*\)/i,
  },

  // A01 — Broken Access Control (open redirect — Sprint 435)
  {
    category: "A01",
    label: "Unvalidated redirect via location.href assignment",
    severity: "warn",
    pattern: /\blocation\.href\s*=[^=]/,
  },
  {
    category: "A01",
    label: "Unvalidated redirect via window.location assignment",
    severity: "warn",
    pattern: /\bwindow\.location\s*=[^=]/,
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
    // Sprint 427: document.write() is an injection vector (writes arbitrary HTML)
    category: "A03",
    label: "document.write() call (DOM injection vector)",
    severity: "error",
    pattern: /\bdocument\.write\s*\(/,
  },
  {
    // Sprint 435: setTimeout/setInterval with a string argument is eval-equivalent
    category: "A03",
    label: "setTimeout/setInterval with string argument (eval analogue)",
    severity: "error",
    pattern: /\b(?:setTimeout|setInterval)\s*\(\s*['"`]/,
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
  {
    // Sprint 427: postMessage to wildcard origin broadcasts to any iframe/window
    category: "A05",
    label: "postMessage() with wildcard origin '*'",
    severity: "error",
    pattern: /\.postMessage\s*\([^,)]+,\s*['"]\*['"]/,
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

  // A03 — Injection (Sprint 444)
  {
    // Dynamically creating a <script> element is an XSS/script-injection vector
    category: "A03",
    label: "document.createElement('script') — dynamic script injection",
    severity: "error",
    pattern: /\bdocument\.createElement\s*\(\s*['"]script['"]\s*\)/i,
  },

  // A04 — Insecure Design: prototype pollution (Sprint 444)
  {
    // __proto__ assignment can silently poison every object in the runtime
    category: "A04",
    label: "__proto__ property assignment (prototype pollution vector)",
    severity: "error",
    pattern: /\.__proto__\s*=/,
  },
  {
    // Object.defineProperty(Object.prototype, ...) pollutes all objects
    category: "A04",
    label: "Object.defineProperty on Object.prototype (prototype pollution)",
    severity: "error",
    pattern: /Object\.defineProperty\s*\(\s*Object\.prototype\b/,
  },

  // A03 — Injection (Sprint 450)
  {
    // insertAdjacentHTML injects raw HTML into the DOM — same risk as innerHTML
    category: "A03",
    label: "insertAdjacentHTML() call (DOM injection — use insertAdjacentText or textContent)",
    severity: "error",
    pattern: /\.insertAdjacentHTML\s*\(/,
  },

  // A05 — Security Misconfiguration (Sprint 450)
  {
    // Plain HTTP fetch leaks data in transit; use HTTPS for all network calls
    category: "A05",
    label: "fetch() over plain http:// (unencrypted traffic — upgrade to HTTPS)",
    severity: "warn",
    pattern: /\bfetch\s*\(\s*['"]http:\/\//,
  },

  // A07 — Identification and Authentication Failures (Sprint 450)
  {
    // window.opener can point to the originating page; assigning to it enables reverse tabnapping
    category: "A07",
    label: "window.opener access (reverse tabnapping — ensure opener is null for cross-origin links)",
    severity: "warn",
    pattern: /\bwindow\.opener\b/,
  },

  // A03 — Injection (Sprint 464)
  {
    // iframe.srcdoc = userInput injects arbitrary HTML into an iframe — same risk as innerHTML
    category: "A03",
    label: "element.srcdoc assignment (iframe HTML injection — use textContent or sanitize first)",
    severity: "error",
    pattern: /\.srcdoc\s*=(?!=)/,
  },

  // A02 — Cryptographic Failures (Sprint 464)
  {
    // btoa() is base64, not encryption; storing credentials via btoa() gives a false sense of security
    category: "A02",
    label: "btoa() encoding potential credential (base64 is not encryption)",
    severity: "warn",
    pattern: /\bbtoa\s*\([^)]*(?:token|secret|password|key|credential)[^)]*\)/i,
  },

  // A01 — Broken Access Control (Sprint 464)
  {
    // Hardcoding isAdmin/isRoot/isSuperUser = true bypasses all access control
    category: "A01",
    label: "Hardcoded admin/root privilege bypass (isAdmin/isRoot/isSuperUser = true)",
    severity: "error",
    pattern: /\b(?:isAdmin|isRoot|isSuperUser|isModerator)\s*=\s*true\b/i,
  },

  // A01 — Broken Access Control (Sprint 473)
  {
    // document.domain assignment relaxes the same-origin policy, allowing cross-origin frame access
    category: "A01",
    label: "document.domain assignment — relaxes same-origin policy (use postMessage instead)",
    severity: "error",
    pattern: /\bdocument\.domain\s*=(?!=)/,
  },

  // A03 — Injection (Sprint 473)
  {
    // new RegExp() with a non-literal argument can introduce ReDoS or injection via user-controlled input
    category: "A03",
    label: "new RegExp() with non-literal argument — potential ReDoS or injection vector",
    severity: "warn",
    pattern: /\bnew\s+RegExp\s*\(\s*(?!\/|['"`])[^)]/,
  },

  // A04 — Insecure Design (Sprint 473)
  {
    // Object.assign() called with a variable second argument can smuggle __proto__ when parsing untrusted JSON
    category: "A04",
    label: "Object.assign() with variable source — ensure source is not user-supplied JSON (prototype pollution via __proto__)",
    severity: "warn",
    pattern: /\bObject\.assign\s*\(\s*[^,)]+,\s*(?!{)[a-zA-Z_$][a-zA-Z0-9_.]*\s*\)/,
  },

  // A03 — Injection (Sprint 482)
  {
    // DOMParser.parseFromString with "text/html" can execute scripts if the parsed result
    // is inserted into the live DOM without sanitization
    category: "A03",
    label: "DOMParser.parseFromString('text/html') — parsed DOM must not be inserted unsanitized into live document",
    severity: "warn",
    pattern: /\.parseFromString\s*\([^)]*,\s*['"]text\/html['"]/,
    safeMarkers: ["owasp-allow:A03", "// safe: result not inserted into live DOM"],
  },

  // A05 — Security Misconfiguration (Sprint 482)
  {
    // External links without rel="noopener noreferrer" and proper referrerPolicy leak origin info
    category: "A05",
    label: "window.open() without noopener — allows reverse tabnapping and leaks referrer",
    severity: "warn",
    pattern: /\bwindow\.open\s*\([^)]*\)\s*(?!.*noopener)/,
    safeMarkers: ["noopener"],
  },

  // A08 — Software and Data Integrity Failures (Sprint 482)
  {
    // importScripts() in Workers loads & executes remote code without SRI; prefer static import
    category: "A08",
    label: "importScripts() in Worker — no SRI verification, prefer static ES module import",
    severity: "error",
    pattern: /\bimportScripts\s*\(/,
  },

  // A03 — Injection (Sprint 487)
  {
    // document.createRange().createContextualFragment() parses arbitrary HTML and can execute scripts
    category: "A03",
    label: "createContextualFragment() — parses HTML with script execution, use textContent or Trusted Types",
    severity: "error",
    pattern: /\.createContextualFragment\s*\(/,
  },

  // A05 — Security Misconfiguration (Sprint 487)
  {
    // Setting Access-Control-Allow-Credentials: true with a permissive origin is a CORS credential leak
    category: "A05",
    label: "Access-Control-Allow-Credentials: true — risks credential leak with permissive CORS origin",
    severity: "warn",
    pattern: /['"]Access-Control-Allow-Credentials['"]\s*:\s*['"]true['"]/i,
  },

  // A02 — Cryptographic Failures (Sprint 487)
  {
    // crypto.subtle.importKey with 'raw' format and no length check may accept weak keys (< 128 bits)
    category: "A02",
    label: "crypto.subtle with insecure algorithm (DES/RC4/ECB) — use AES-GCM or ChaCha20",
    severity: "error",
    pattern: /crypto\.subtle\.(?:encrypt|decrypt|importKey)\s*\([^)]*['"](?:DES|RC4|AES-ECB|3DES)['"]/i,
  },
];

/** Exempt source paths (relative to root, forward slashes). */
const EXEMPT_PATHS = [
  "src/core/trusted-types.ts",
  // Sprint 466: exempt the scanner itself and security-checker helpers —
  // they enumerate dangerous patterns by design, so every rule would match their own source.
  "scripts/check-owasp.mjs",
  "scripts/check-trusted-types.mjs",
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

/**
 * Collect all .mjs files (non-recursive) from `dir`. (Sprint 466)
 * @param {string} dir
 * @returns {string[]}
 */
function collectMjsFiles(dir) {
  const st = statSync(dir, { throwIfNoEntry: false });
  if (!st?.isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => join(dir, f));
}

// Collect from src/, worker/src/, and scripts/ (Sprint 466)
const files = [
  ...collectTsFiles(SRC),
  ...(statSync(WORKER_SRC, { throwIfNoEntry: false })?.isDirectory() ? collectTsFiles(WORKER_SRC) : []),
  ...collectMjsFiles(SCRIPTS_DIR),
];

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
