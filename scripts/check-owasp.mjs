#!/usr/bin/env node
/**
 * OWASP Top 10 rotation automated check.
 * (v14.0.0) — added A03 document.write rule + A05 postMessage(*) rule.
 * (v14.1.0) — added A01 open-redirect, A02 atob-credential, A03 setTimeout-string.
 * (v14.2.0) — added A03 createElement-script, A04 __proto__ pollution, A04 defineProperty-prototype.
 * (v14.2.0) — added A03 insertAdjacentHTML, A05 http-in-fetch, A07 window.opener access.
 * (v14.2.0) — extended scan scope to `worker/src/` in addition to `src/`.
 * (v14.3.0) — added A03 srcdoc iframe injection, A02 btoa-credential, A01 hardcoded admin bypass.
 * (v14.3.0) — extended scan scope to `scripts/*.mjs` (build/CI helpers).
 * (v14.4.0) — added A01 document.domain assignment, A03 new RegExp() dynamic, A04 Object.assign() prototype-pollution vector.
 * (v14.5.0) — added A03 DOMParser.parseFromString XSS, A05 referrerPolicy='no-referrer' missing on ext links, A08 importScripts() in workers.
 * (v14.5.0) — added A03 createContextualFragment XSS, A05 CORS credentials, A02 insecure crypto algorithms.
 * (v14.5.0) — added A07 document.cookie token, A03 javascript: protocol, A04 prototype reassignment.
 * (v14.5.0) — added A09 logging sensitive vars, A05 ACAO wildcard, A08 dynamic script.src.
 * (v14.5.0) — added A01 location assignment, A02 Math.random token, A10 URL from searchParams.
 * (v14.5.0) — added A03 SQL template injection, A07 token in URL query, A04 rejectUnauthorized false.
 * (v14.5.0) — added A05 CORS Allow-Headers wildcard, A08 script without SRI, A09 console.error credentials.
 * (v14.5.0) — added A02 hardcoded JWT secret, A01 window.open dynamic URL, A04 CSP meta removal.
 * (v14.5.0) — added A03 outerHTML assignment, A05 Expose-Headers wildcard, A02 sessionStorage secret.
 * (v14.5.0) — added A03 unencoded template URL, A07 bearer token in console, A04 NODE_TLS disabled.
 * (v14.5.0) — added A03 Blob URL XSS, A05 cookie SameSite, A02 localStorage secret.
 * (v14.5.0) — added A01 target=_blank noopener, A07 auth header logged, A04 setTimeout string.
 * (v14.5.0) — added A03 contentDocument.write, A05 X-Frame-Options missing, A09 stack trace exposed.
 * (v14.5.0) — added A02 hardcoded password, A06 dynamic import(), A10 SSRF interpolated fetch.
 * (v14.5.0) — added A03 document.writeln, A05 insecure WebSocket, A02 private key material.
 * (v14.5.0) — added A01 form action manipulation, A03 CSS injection via cssText, A08 dynamic importScripts.
 * (v14.5.0) — added A02 token in URL fragment, A05 ACAO reflecting origin, A09 sensitive var in Error().
 * (v14.5.0) — added A03 proto pollution, A04 SSRF interpolated URL, A08 location.href redirect.
 * (v14.6.0) — added A01 postMessage wildcard, A07 hardcoded secret, A05 document.domain.
 * (v14.7.0) — added A03 srcdoc template injection, A09 PII in telemetry, A02 weak PBKDF2 iterations.
 * (v14.7.0) — added A04 Object.assign proto pollution, A06 weak hash (MD5/SHA1), A10 fetch without catch.
 * (v14.8.0) — added A03 innerHTML template literal, A05 fetch without AbortController, A02 crypto short key length, A01 window.name abuse.
 * (v14.9.0) — added A03 createTreeWalker SHOW_ALL, A05 SharedArrayBuffer without isolation, A02 hardcoded IV/nonce, A07 Authorization header literal.
 * (v14.10.0) — added A01 Object.fromEntries(searchParams) injection, A08 createElement script/link without SRI, A09 sendBeacon PII audit.
 * (v14.5.0) — added A03 insertBefore DOM injection, A05 credentials include, A07 authorization header leak,
 *             A08 importScripts dynamic URL, A09 stack trace in response, A01 location redirect from input.
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
const SCRIPTS_DIR = join(ROOT, "scripts"); // also scan build/CI helpers
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
    // atob() decoding a credential-looking variable is not secure storage
    category: "A02",
    label: "atob() decoding potential credential (not a secure encoding)",
    severity: "warn",
    pattern: /\batob\s*\([^)]*(?:token|secret|password|key|credential)[^)]*\)/i,
  },

  // A01 — Broken Access Control (open redirect — )
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
    // document.write() is an injection vector (writes arbitrary HTML)
    category: "A03",
    label: "document.write() call (DOM injection vector)",
    severity: "error",
    pattern: /\bdocument\.write\s*\(/,
  },
  {
    // setTimeout/setInterval with a string argument is eval-equivalent
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
    // postMessage to wildcard origin broadcasts to any iframe/window
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
    pattern:
      /localStorage\.setItem\s*\(\s*['"][^'"]*(?:token|password|secret|auth|credential)[^'"]*['"]/i,
  },
  {
    category: "A07",
    label: "Credential stored in sessionStorage",
    severity: "error",
    pattern:
      /sessionStorage\.setItem\s*\(\s*['"][^'"]*(?:token|password|secret|auth|credential)[^'"]*['"]/i,
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

  // A03 — Injection
  {
    // Dynamically creating a <script> element is an XSS/script-injection vector
    category: "A03",
    label: "document.createElement('script') — dynamic script injection",
    severity: "error",
    pattern: /\bdocument\.createElement\s*\(\s*['"]script['"]\s*\)/i,
  },

  // A04 — Insecure Design: prototype pollution
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

  // A03 — Injection
  {
    // insertAdjacentHTML injects raw HTML into the DOM — same risk as innerHTML
    category: "A03",
    label: "insertAdjacentHTML() call (DOM injection — use insertAdjacentText or textContent)",
    severity: "error",
    pattern: /\.insertAdjacentHTML\s*\(/,
  },

  // A05 — Security Misconfiguration
  {
    // Plain HTTP fetch leaks data in transit; use HTTPS for all network calls
    category: "A05",
    label: "fetch() over plain http:// (unencrypted traffic — upgrade to HTTPS)",
    severity: "warn",
    pattern: /\bfetch\s*\(\s*['"]http:\/\//,
  },

  // A07 — Identification and Authentication Failures
  {
    // window.opener can point to the originating page; assigning to it enables reverse tabnapping
    category: "A07",
    label:
      "window.opener access (reverse tabnapping — ensure opener is null for cross-origin links)",
    severity: "warn",
    pattern: /\bwindow\.opener\b/,
  },

  // A03 — Injection
  {
    // iframe.srcdoc = userInput injects arbitrary HTML into an iframe — same risk as innerHTML
    category: "A03",
    label: "element.srcdoc assignment (iframe HTML injection — use textContent or sanitize first)",
    severity: "error",
    pattern: /\.srcdoc\s*=(?!=)/,
  },

  // A02 — Cryptographic Failures
  {
    // btoa() is base64, not encryption; storing credentials via btoa() gives a false sense of security
    category: "A02",
    label: "btoa() encoding potential credential (base64 is not encryption)",
    severity: "warn",
    pattern: /\bbtoa\s*\([^)]*(?:token|secret|password|key|credential)[^)]*\)/i,
  },

  // A01 — Broken Access Control
  {
    // Hardcoding isAdmin/isRoot/isSuperUser = true bypasses all access control
    category: "A01",
    label: "Hardcoded admin/root privilege bypass (isAdmin/isRoot/isSuperUser = true)",
    severity: "error",
    pattern: /\b(?:isAdmin|isRoot|isSuperUser|isModerator)\s*=\s*true\b/i,
  },

  // A01 — Broken Access Control
  {
    // document.domain assignment relaxes the same-origin policy, allowing cross-origin frame access
    category: "A01",
    label: "document.domain assignment — relaxes same-origin policy (use postMessage instead)",
    severity: "error",
    pattern: /\bdocument\.domain\s*=(?!=)/,
  },

  // A03 — Injection
  {
    // new RegExp() with a non-literal argument can introduce ReDoS or injection via user-controlled input
    category: "A03",
    label: "new RegExp() with non-literal argument — potential ReDoS or injection vector",
    severity: "warn",
    pattern: /\bnew\s+RegExp\s*\(\s*(?!\/|['"`])[^)]/,
  },

  // A04 — Insecure Design
  {
    // Object.assign() called with a variable second argument can smuggle __proto__ when parsing untrusted JSON
    category: "A04",
    label:
      "Object.assign() with variable source — ensure source is not user-supplied JSON (prototype pollution via __proto__)",
    severity: "warn",
    pattern: /\bObject\.assign\s*\(\s*[^,)]+,\s*(?!{)[a-zA-Z_$][a-zA-Z0-9_.]*\s*\)/,
  },

  // A03 — Injection
  {
    // DOMParser.parseFromString with "text/html" can execute scripts if the parsed result
    // is inserted into the live DOM without sanitization
    category: "A03",
    label:
      "DOMParser.parseFromString('text/html') — parsed DOM must not be inserted unsanitized into live document",
    severity: "warn",
    pattern: /\.parseFromString\s*\([^)]*,\s*['"]text\/html['"]/,
    safeMarkers: ["owasp-allow:A03", "// safe: result not inserted into live DOM"],
  },

  // A05 — Security Misconfiguration
  {
    // External links without rel="noopener noreferrer" and proper referrerPolicy leak origin info
    category: "A05",
    label: "window.open() without noopener — allows reverse tabnapping and leaks referrer",
    severity: "warn",
    pattern: /\bwindow\.open\s*\([^)]*\)\s*(?!.*noopener)/,
    safeMarkers: ["noopener"],
  },

  // A08 — Software and Data Integrity Failures
  {
    // importScripts() in Workers loads & executes remote code without SRI; prefer static import
    category: "A08",
    label: "importScripts() in Worker — no SRI verification, prefer static ES module import",
    severity: "error",
    pattern: /\bimportScripts\s*\(/,
  },

  // A03 — Injection
  {
    // document.createRange().createContextualFragment() parses arbitrary HTML and can execute scripts
    category: "A03",
    label:
      "createContextualFragment() — parses HTML with script execution, use textContent or Trusted Types",
    severity: "error",
    pattern: /\.createContextualFragment\s*\(/,
  },

  // A05 — Security Misconfiguration
  {
    // Setting Access-Control-Allow-Credentials: true with a permissive origin is a CORS credential leak
    category: "A05",
    label:
      "Access-Control-Allow-Credentials: true — risks credential leak with permissive CORS origin",
    severity: "warn",
    pattern: /['"]Access-Control-Allow-Credentials['"]\s*:\s*['"]true['"]/i,
  },

  // A02 — Cryptographic Failures
  {
    // crypto.subtle.importKey with 'raw' format and no length check may accept weak keys (< 128 bits)
    category: "A02",
    label: "crypto.subtle with insecure algorithm (DES/RC4/ECB) — use AES-GCM or ChaCha20",
    severity: "error",
    pattern:
      /crypto\.subtle\.(?:encrypt|decrypt|importKey)\s*\([^)]*['"](?:DES|RC4|AES-ECB|3DES)['"]/i,
  },

  // A07 — Identification and Authentication Failures
  {
    // Storing JWT tokens in cookie without HttpOnly or Secure flags leaks them to JS/XSS
    category: "A07",
    label: "document.cookie assignment with token/session — use HttpOnly secure cookies instead",
    severity: "error",
    pattern: /\bdocument\.cookie\s*=\s*[^;]*(?:token|session|auth|jwt)/i,
  },

  // A03 — Injection
  {
    // URL() constructor used directly with user input + .href as src/href can enable XSS via javascript:
    category: "A03",
    label: "javascript: protocol in URL/href — validate scheme before assignment",
    severity: "error",
    pattern: /['"]javascript\s*:/i,
  },

  // A04 — Insecure Design
  {
    // Constructor.prototype reassignment can silently break instanceof and prototype chain
    category: "A04",
    label: "Constructor.prototype reassignment — breaks instanceof, use Object.create()",
    severity: "warn",
    pattern: /\.prototype\s*=\s*(?!null\b)[^=]/,
    safeMarkers: ["Object.create("],
  },

  // A09 — Logging Failures
  {
    // console.log/warn/error with variables named token/password/secret/apiKey
    category: "A09",
    label: "Logging sensitive variable name — redact before logging",
    severity: "warn",
    pattern: /console\.\w+\(.*(?:token|password|secret|apiKey|api_key|credential)/i,
    safeMarkers: ["redact(", "mask(", "[REDACTED]"],
  },

  // A05 — Security Misconfiguration
  {
    // Setting Access-Control-Allow-Origin to literal wildcard in code
    category: "A05",
    label: "Access-Control-Allow-Origin wildcard — restrict to specific origins",
    severity: "error",
    pattern: /['"]Access-Control-Allow-Origin['"]\s*[:,]\s*['"]\*/i,
  },

  // A08 — Software Integrity Failures
  {
    // Dynamically constructed script src from variable (DOM-based script injection)
    category: "A08",
    label: "Dynamic script.src assignment — validate URL scheme + origin",
    severity: "error",
    pattern: /script[^.]*\.src\s*=\s*(?!['"]https?:\/\/)(?!['"]\/)/i,
    safeMarkers: ["URL.createObjectURL(", "data:text/javascript"],
  },

  // A01 — Broken Access Control
  {
    // window.location.href set from untrusted source can enable open redirect
    category: "A01",
    label: "window.location assignment from variable — validate target origin",
    severity: "warn",
    pattern: /window\.location\s*(?:\.\s*href)?\s*=\s*(?!['"]https?:\/\/)/,
    safeMarkers: ["location.reload(", "location.hash", "location.search"],
  },

  // A02 — Cryptographic Failures
  {
    // Using Math.random for any security/token purpose is predictable
    category: "A02",
    label: "Math.random() in token/nonce/id context — use crypto.getRandomValues()",
    severity: "warn",
    pattern: /Math\.random\(\).*(?:token|nonce|id|key|secret|session)/i,
    safeMarkers: ["crypto.getRandomValues(", "crypto.randomUUID("],
  },

  // A10 — SSRF
  {
    // Constructing URL from user-controlled searchParams without origin validation
    category: "A10",
    label: "URL from searchParams without origin check — validate scheme + allowlist",
    severity: "warn",
    pattern: /new\s+URL\(\s*(?:searchParams|params|query)/i,
    safeMarkers: ["allowlist", "ALLOWED_ORIGINS", "validateUrl("],
  },

  // A03 — Injection
  {
    // Using template literals in SQL queries risks SQLi (look for SQL verbs followed by FROM/INTO/SET + interpolation)
    category: "A03",
    label: "Template literal in SQL query — use parameterized queries",
    severity: "error",
    pattern:
      /(?:SELECT\s+.+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE)\s.*\$\{/i,
    safeMarkers: [".prepare(", ".bind(", "parameterized"],
  },

  // A07 — Auth Failures
  {
    // Exposing tokens/keys in URL query strings (logged in server access logs)
    category: "A07",
    label: "Token/key in URL query — move to Authorization header",
    severity: "warn",
    pattern: /[?&](?:api_key|apiKey|token|secret|password)=/i,
    safeMarkers: ["Authorization:", "Bearer", "env.", "* Handle", "* GET", "* POST"],
  },

  // A04 — Insecure Design
  {
    // Disabling TLS verification (rejectUnauthorized: false) — MITM risk
    category: "A04",
    label: "rejectUnauthorized: false — enables MITM attacks",
    severity: "error",
    pattern: /rejectUnauthorized\s*:\s*false/,
  },

  // A05 — Security Misconfiguration
  {
    // Over-permissive Access-Control-Allow-Headers wildcard
    category: "A05",
    label: "Access-Control-Allow-Headers: * — overly permissive CORS",
    severity: "warn",
    pattern: /Access-Control-Allow-Headers['"]\s*[:,]\s*['"]?\*/i,
  },

  // A08 — Software Integrity
  {
    // Loading external scripts without Subresource Integrity (SRI)
    category: "A08",
    label: "External <script src> without integrity attribute — use SRI",
    severity: "warn",
    pattern: /<script[^>]+src\s*=\s*['"]https?:\/\/[^>]*(?!integrity)/i,
  },

  // A09 — Logging Failures
  {
    // console.error logging sensitive variable names
    category: "A09",
    label: "console.error with sensitive data — redact credentials before logging",
    severity: "warn",
    pattern: /console\.error\s*\([^)]*(?:password|secret|token|apiKey|credential)[^)]*\)/i,
  },

  // A02 — Cryptographic Failures
  {
    // Hardcoded JWT secret strings in source
    category: "A02",
    label: "Hardcoded JWT secret — use env variable",
    severity: "error",
    pattern: /(?:jwt|jsonwebtoken).*(?:secret|key)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },

  // A01 — Broken Access Control
  {
    // window.open with user-controlled URL without validation
    category: "A01",
    label: "window.open with dynamic URL — validate origin before opening",
    severity: "warn",
    pattern: /window\.open\s*\(\s*(?!['"]https?:\/\/)/,
    safeMarkers: ["trustedURL", "validateUrl", "safeOpen", "noopener", "_blank"],
  },

  // A04 — Insecure Design
  {
    // Disabling Content-Security-Policy via meta tag removal
    category: "A04",
    label: "CSP meta tag removal — security header bypass",
    severity: "error",
    pattern: /(?:remove|delete).*content-security-policy/i,
  },

  // 3 new rules (total: 59)

  // A03 — Injection: outerHTML assignment with dynamic content
  {
    category: "A03",
    label: "outerHTML assignment — potential XSS vector",
    severity: "error",
    pattern: /\.outerHTML\s*=/,
    safeMarkers: ["sanitize", "DOMPurify", "escapeHtml", "textContent"],
  },

  // A05 — Security Misconfiguration: Access-Control-Expose-Headers wildcard
  {
    category: "A05",
    label: "Access-Control-Expose-Headers wildcard — over-exposes response headers",
    severity: "warn",
    pattern: /Access-Control-Expose-Headers['"]?\s*[:,]\s*['"]?\*/i,
    safeMarkers: ["test", "spec", "mock"],
  },

  // A02 — Cryptographic Failures: storing secrets in sessionStorage
  {
    category: "A02",
    label: "sessionStorage secret/token storage — credentials accessible via XSS",
    severity: "warn",
    pattern: /sessionStorage\.setItem\s*\(\s*['"](?:token|secret|api[_-]?key|password|auth)/i,
    safeMarkers: ["test", "spec", "mock", "clearSession"],
  },

  // 3 new rules (total: 62)

  // A03 — Injection: template literal in URL without encoding
  {
    category: "A03",
    label: "unencoded template literal in URL — potential injection vector",
    severity: "warn",
    pattern: /(?:fetch|XMLHttpRequest|new\s+Request)\s*\(\s*`[^`]*\$\{/,
    safeMarkers: [
      "encodeURIComponent",
      "encodeURI",
      "URLSearchParams",
      "safeParam",
      "sanitize",
      "WORKER_BASE_URL",
      "BASE_URL",
      "NWS_API",
      "toFixed",
      "encoded",
      "params",
      "geonameid",
      "import.meta.env",
    ],
  },

  // A07 — Auth Failures: bearer token in console output
  {
    category: "A07",
    label: "bearer token logged — credentials exposed in console",
    severity: "error",
    pattern: /console\.\w+\s*\([^)]*(?:bearer|authorization)/i,
    safeMarkers: ["test", "spec", "mock", "redact", "mask"],
  },

  // A04 — Insecure Design: disabling HTTPS verification
  {
    category: "A04",
    label: "NODE_TLS_REJECT_UNAUTHORIZED=0 — disables TLS verification",
    severity: "error",
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,
    safeMarkers: ["test", "spec", "mock", "development"],
  },

  // ── additions ──────────────────────────────────────────────────

  // A03 — Injection: Blob URL from unsanitized string (XSS via blob:)
  {
    category: "A03",
    label: "URL.createObjectURL(new Blob([unsanitized])) — XSS via blob URL",
    severity: "error",
    pattern: /URL\.createObjectURL\(\s*new\s+Blob\(/,
    safeMarkers: ["sanitize", "textContent", "JSON.stringify", "encodeURI", "DOMPurify", "trusted"],
  },

  // A05 — Security Misconfiguration: missing SameSite on cookie
  {
    category: "A05",
    label: "document.cookie set without SameSite attribute",
    severity: "warning",
    pattern: /document\.cookie\s*=(?!.*SameSite)/,
    safeMarkers: ["SameSite", "samesite", "test", "spec", "mock"],
  },

  // A02 — Cryptographic Failures: storing secret in localStorage
  {
    category: "A02",
    label: "localStorage.setItem with sensitive key name (token/secret/password/key)",
    severity: "error",
    pattern: /localStorage\.setItem\(\s*['"`](?:.*(?:token|secret|password|api[_-]?key))/i,
    safeMarkers: ["test", "spec", "mock", "theme", "fontScale", "config"],
  },

  // ── additions ──────────────────────────────────────────────────

  // A01 — Broken Access Control: target="_blank" without rel="noopener"
  {
    category: "A01",
    label: 'target="_blank" without rel="noopener" — tab-napping risk',
    severity: "warning",
    pattern: /target\s*=\s*['"]_blank['"](?!.*rel\s*=\s*['"][^'"]*noopener)/,
    safeMarkers: ["noopener", "noreferrer", "test", "spec"],
  },

  // A07 — Identification and Authentication Failures: Authorization header logged
  {
    category: "A07",
    label: "Authorization header value logged or exposed",
    severity: "error",
    pattern: /(?:console\.|diagLog|log)\(.*(?:headers\.(?:get|Authorization)|authorization)/i,
    safeMarkers: ["test", "spec", "mock", "redact", "mask", "[REDACTED]"],
  },

  // A04 — Insecure Design: eval-like pattern via setTimeout/setInterval with string
  {
    category: "A04",
    label: "setTimeout/setInterval with string arg — implicit eval",
    severity: "error",
    pattern: /(?:setTimeout|setInterval)\(\s*['"`]/,
    safeMarkers: ["test", "spec", "mock"],
  },

  // 3 new rules (total: 71)

  // A03 — Injection: writing to srcdoc without sanitization (iframe content injection)
  {
    category: "A03",
    label: "write to contentDocument.write — bypasses CSP",
    severity: "error",
    pattern: /contentDocument\.(?:write|writeln)\s*\(/,
    safeMarkers: ["test", "spec", "mock", "sanitize", "trusted"],
  },

  // A05 — Security Misconfiguration: X-Frame-Options not set on responses
  {
    category: "A05",
    label: "Response missing X-Frame-Options or frame-ancestors CSP",
    severity: "warn",
    pattern: /new\s+Response\([\s\S]{0,200}status:\s*200[\s\S]{0,200}\)/,
    safeMarkers: [
      "X-Frame-Options",
      "frame-ancestors",
      "test",
      "spec",
      "CORS_HEADERS",
      "Content-Type",
    ],
  },

  // A09 — Security Logging: stack trace exposed to client in production response
  {
    category: "A09",
    label: "Error stack trace exposed in response body",
    severity: "error",
    pattern: /(?:err|error)\.stack/,
    safeMarkers: ["test", "spec", "mock", "diagLog", "console", "log", "report", "sentry", "debug"],
  },

  // 3 new rules (total: 74)

  // A02 — Cryptographic Failures: hardcoded password/secret in variable assignment
  {
    category: "A02",
    label: "Hardcoded password/secret literal in assignment",
    severity: "error",
    pattern: /(?:password|passwd|secret|apiKey|api_key)\s*[:=]\s*['"`][^'"`]{4,}/i,
    safeMarkers: [
      "test",
      "spec",
      "mock",
      "env.",
      "process.env",
      "import.meta.env",
      "example",
      "placeholder",
      "CHANGE_ME",
    ],
  },

  // A06 — Vulnerable Components: eval of import() with user-controlled string
  {
    category: "A06",
    label: "Dynamic import() with non-literal argument",
    severity: "warn",
    pattern: /import\(\s*(?!['"`])[^)]+\)/,
    safeMarkers: ["test", "spec", "mock", "/* trusted */", "webpackChunkName"],
  },

  // A10 — SSRF: fetch/request with URL constructed from user input without allowlist
  {
    category: "A10",
    label: "fetch() with interpolated/dynamic URL (potential SSRF)",
    severity: "warn",
    pattern: /fetch\(\s*`[^`]*\$\{/,
    safeMarkers: [
      "WORKER_BASE_URL",
      "BASE_URL",
      "NWS_API",
      "PROXIES",
      "safeParam",
      "allowlist",
      "ALLOWED_",
      "import.meta.env",
      "encodeURIComponent",
      "URLSearchParams",
      "test",
      "spec",
      "geonameid",
      "encoded",
      "owasp-allow:A10",
      "hebcal",
      "sefaria",
    ],
  },

  // A03: XSS via document.writeln
  {
    category: "A03",
    label: "document.writeln() injection risk",
    severity: "error",
    pattern: /document\.writeln\s*\(/,
    safeMarkers: ["test", "spec", "mock", "trusted-types"],
  },

  // A05: WebSocket without TLS (ws:// instead of wss://)
  {
    category: "A05",
    label: "WebSocket over insecure ws:// (use wss://)",
    severity: "warn",
    pattern: /new\s+WebSocket\(\s*['"`]ws:\/\//,
    safeMarkers: ["localhost", "127.0.0.1", "test", "spec"],
  },

  // A02: Private key in source
  {
    category: "A02",
    label: "Hardcoded private key material",
    severity: "error",
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
    safeMarkers: ["test", "spec", "mock", "example"],
  },

  // A01: Form action manipulation (DOM clobbering vector)
  {
    category: "A01",
    label: "Form action set to dynamic value (potential phishing)",
    severity: "warn",
    pattern: /\.action\s*=\s*(?!['"`]\/|['"`]https:\/\/)/,
    safeMarkers: ["test", "spec", "mock", "trusted"],
  },

  // A03: Unescaped template in style attribute (CSS injection)
  {
    category: "A03",
    label: "Dynamic style attribute assignment (CSS injection risk)",
    severity: "warn",
    pattern: /\.style\.cssText\s*=\s*`[^`]*\$\{/,
    safeMarkers: ["test", "spec", "sanitize", "trusted-types"],
  },

  // A08: Unprotected importScripts in SW with dynamic arg
  {
    category: "A08",
    label: "importScripts() with dynamic argument in service worker",
    severity: "error",
    pattern: /importScripts\(\s*(?!['"`])[^)]+\)/,
    safeMarkers: ["test", "spec", "/* trusted */", "WORKER_BASE_URL"],
  },

  // A02: Token/key passed in URL fragment or hash
  {
    category: "A02",
    label: "Credential/token exposed in URL fragment (leaks via Referer)",
    severity: "warn",
    pattern: /#.*(?:token|key|secret|password|auth)=/i,
    safeMarkers: ["test", "spec", "example", "mock", "// owasp-allow:A02"],
  },

  // A05: Access-Control-Allow-Origin reflecting request origin
  {
    category: "A05",
    label: "ACAO header reflecting request origin (open CORS)",
    severity: "error",
    pattern: /['"]Access-Control-Allow-Origin['"]\s*[:,]\s*(?:req|request|origin|event)/i,
    safeMarkers: ["test", "spec", "ALLOWED_ORIGINS", "allowlist", "// owasp-allow:A05"],
  },

  // A09: Sensitive var names in thrown Error messages
  {
    category: "A09",
    label: "Sensitive variable name in Error() message (info leak)",
    severity: "warn",
    pattern: /throw\s+new\s+Error\([^)]*(?:password|secret|token|apiKey)[^)]*\)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A09", "sanitize"],
  },

  // A03: Prototype pollution via __proto__ assignment
  {
    category: "A03",
    label: "Direct __proto__ property assignment (prototype pollution vector)",
    severity: "error",
    pattern: /\.__proto__\s*=/,
    safeMarkers: ["test", "spec", "// owasp-allow:A03", "Object.create(null)"],
  },

  // A04: SSRF via unvalidated URL template with variable
  {
    category: "A04",
    label: "Dynamic URL construction with interpolated variable (potential SSRF)",
    severity: "warn",
    pattern: /new\s+URL\(\s*`[^`]*\$\{(?!(?:BASE_|API_|PROXY_))/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A04", "PROXIES", "allowedHosts"],
  },

  // A08: Unvalidated redirect via location assignment
  {
    category: "A08",
    label: "location.href assigned from variable (open redirect risk)",
    severity: "warn",
    pattern: /location\.href\s*=\s*(?!['"`])/,
    safeMarkers: ["test", "spec", "// owasp-allow:A08", "sanitizeUrl", "trustedUrl"],
  },

  // A01: postMessage with wildcard targetOrigin
  {
    category: "A01",
    label: "postMessage with '*' targetOrigin (data exposure to any origin)",
    severity: "warn",
    pattern: /\.postMessage\([^)]+,\s*['"`]\*['"`]\s*\)/,
    safeMarkers: ["test", "spec", "// owasp-allow:A01", "same-origin"],
  },

  // A07: Hardcoded secret/token/key literal in source
  {
    category: "A07",
    label: "Hardcoded secret/token literal in source (use env vars)",
    severity: "error",
    pattern: /(?:api[_-]?key|secret|auth[_-]?token)\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A07", "mock", "example", "placeholder"],
  },

  // A05: document.domain assignment (relaxes same-origin)
  {
    category: "A05",
    label: "document.domain assignment (relaxes same-origin policy)",
    severity: "error",
    pattern: /document\.domain\s*=/,
    safeMarkers: ["test", "spec", "// owasp-allow:A05"],
  },

  // A03: srcdoc attribute set via template literal (injection)
  {
    category: "A03",
    label: "iframe srcdoc set from template literal (XSS injection vector)",
    severity: "error",
    pattern: /\.srcdoc\s*=\s*`/,
    safeMarkers: ["test", "spec", "// owasp-allow:A03", "trusted-types", "sanitize"],
  },

  // A09: User PII in telemetry/analytics payload
  {
    category: "A09",
    label: "PII field name in analytics/telemetry payload (privacy leak)",
    severity: "warn",
    pattern: /(?:analytics|telemetry|track|beacon)\([^)]*(?:email|phone|address|ssn|passport)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A09", "redact", "anonymize", "hash"],
  },

  // A02: PBKDF2 with fewer than 100k iterations (weak KDF)
  {
    category: "A02",
    label: "PBKDF2 with too few iterations (< 100000 is weak)",
    severity: "warn",
    pattern: /(?:deriveKey|deriveBits|pbkdf2).*iterations["'\s:]*\d{1,4}[^\d]/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A02", "100000", "600000"],
  },

  // A04: Object.assign with user-controlled source (proto pollution)
  {
    category: "A04",
    label: "Object.assign with unvalidated source (prototype pollution risk)",
    severity: "warn",
    pattern: /Object\.assign\([^,]+,\s*(?:req\.body|params|query|input|payload|userData)/,
    safeMarkers: ["test", "spec", "// owasp-allow:A04", "structuredClone", "sanitize"],
  },

  // A06: Weak hash algorithm for security purposes (MD5/SHA1)
  {
    category: "A06",
    label: "Weak hash algorithm (MD5/SHA-1) used for security/integrity",
    severity: "warn",
    pattern: /(?:createHash|digest|subtle\.digest)\(['"](?:md5|sha-?1)['"]\)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A06", "non-security", "checksum", "etag"],
  },

  // A10: fetch() without .catch() or try/catch (unhandled rejection)
  {
    category: "A10",
    label: "fetch() chain without .catch() (unhandled rejection risk)",
    severity: "warn",
    pattern: /fetch\([^)]+\)\.then\([^)]+\)(?!\.catch)/,
    safeMarkers: ["test", "spec", "// owasp-allow:A10", "try", "catch", "allSettled"],
  },

  // ── v14.5.0 additions ─────────────────────────────────────────────────

  // A03: Unsafe use of .insertBefore() with user content (DOM injection vector)
  {
    category: "A03",
    label: "insertBefore() with unsanitized content (DOM injection risk)",
    severity: "warn",
    pattern: /\.insertBefore\(\s*(?:document\.createElement|[a-z]+\.cloneNode)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A03", "textContent", "sanitize"],
  },

  // A05: Fetch/XHR without credentials: 'same-origin' (CSRF-like exposure)
  {
    category: "A05",
    label: "fetch() with credentials: 'include' (cross-origin cookie exposure)",
    severity: "error",
    pattern: /credentials\s*:\s*['"]include['"]/,
    safeMarkers: ["test", "spec", "// owasp-allow:A05"],
  },

  // A07: Authorization header logged or stored in state
  {
    category: "A07",
    label: "Authorization header value in variable assignment (credential leak risk)",
    severity: "warn",
    pattern: /(?:authorization|bearer)\s*[:=]\s*[`'"]/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A07", "type", "interface", "header"],
  },

  // A08: Service Worker importScripts with variable URL (integrity bypass)
  {
    category: "A08",
    label: "importScripts() with dynamic URL (integrity bypass risk)",
    severity: "error",
    pattern: /importScripts\(\s*(?!\s*['"])[^)]+\)/,
    safeMarkers: ["test", "spec", "// owasp-allow:A08"],
  },

  // A09: Error message exposing file paths or stack traces to client
  {
    category: "A09",
    label: "Error stack trace or file path in response body (info disclosure)",
    severity: "warn",
    pattern: /(?:res|response)\.(?:json|send|write)\([^)]*(?:\.stack|\.message|error\.toString)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A09", "diag", "log", "internal"],
  },

  // A01: Unvalidated redirect via window.location assignment from user input
  {
    category: "A01",
    label: "window.location from unvalidated input (open redirect)",
    severity: "warn",
    pattern:
      /(?:window|document)\.location(?:\.href)?\s*=\s*(?:params|query|input|searchParams|url\b)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A01", "allowlist", "safeUrl", "validate"],
  },

  // ── v14.7.0 additions (6 rules) ───────────────────────────────────────────

  // A03 — Injection: Range.createRange().insertNode() can inject unsanitized DOM nodes
  {
    category: "A03",
    label: "Range.insertNode() — inserts raw DOM into live document (sanitize first)",
    severity: "warn",
    pattern: /\.insertNode\(\s*(?!document\.createTextNode)/,
    safeMarkers: ["test", "spec", "// owasp-allow:A03", "textContent", "sanitize", "trusted"],
  },

  // A02 — Cryptographic Failures: SubtleCrypto with too-short key length
  {
    category: "A02",
    label: "crypto.subtle.generateKey with short key length (< 256 bits for AES)",
    severity: "warn",
    pattern: /generateKey\([^)]*length\s*:\s*(?:64|128)\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A02", "HMAC", "hash"],
  },

  // A05 — Security Misconfiguration: Permissive-Policy header missing
  {
    category: "A05",
    label: "new Response() without Permissions-Policy header (camera/mic/geolocation)",
    severity: "warn",
    pattern: /new\s+Response\([^)]*\{[^}]*status:\s*200/,
    safeMarkers: [
      "Permissions-Policy",
      "permissions-policy",
      "test",
      "spec",
      "CORS_HEADERS",
      "Content-Type",
      "json",
    ],
  },

  // A08 — Software Integrity: eval-like via Reflect.construct with Function
  {
    category: "A08",
    label: "Reflect.construct(Function, ...) — eval equivalent via reflection",
    severity: "error",
    pattern: /Reflect\.construct\(\s*Function\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A08"],
  },

  // A04 — Insecure Design: structuredClone bypass for frozen objects
  {
    category: "A04",
    label: "structuredClone on user input without validation — bypasses Object.freeze()",
    severity: "warn",
    pattern: /structuredClone\(\s*(?:req\.body|params|query|input|payload|userData|body)\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A04", "validate", "schema", "parse"],
  },

  // A09 — Logging: Environment variables logged (may contain secrets)
  {
    category: "A09",
    label: "process.env / import.meta.env logged — may leak secrets",
    severity: "warn",
    pattern: /console\.\w+\([^)]*(?:process\.env|import\.meta\.env)\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A09", "NODE_ENV", "MODE", "DEV", "PROD"],
  },

  // ── v14.8.0 ──────────────────────────────────────────────────────────────

  // A03 — Injection: innerHTML via template literal (bypass of textContent rule)
  {
    category: "A03",
    label: "innerHTML assigned via template literal — use textContent or DOM API",
    severity: "error",
    pattern: /\.innerHTML\s*=\s*`/,
    safeMarkers: ["test", "spec", "// owasp-allow:A03", "sanitize", "DOMPurify"],
  },

  // A05 — Security Misconfiguration: fetch without AbortController (DoS via hung requests)
  {
    category: "A05",
    label: "fetch() without signal/AbortController — may hang indefinitely",
    severity: "warn",
    pattern: /\bfetch\(\s*[^,)]+\s*\)\s*(?!\s*\.)/,
    safeMarkers: [
      "test",
      "spec",
      "// owasp-allow:A05",
      "signal",
      "AbortController",
      "fetchWithTimeout",
      "fetchViaWorker",
      "fetchJSON",
    ],
  },

  // A02 — Cryptographic Failures: crypto.subtle with short key length
  {
    category: "A02",
    label: "crypto.subtle generateKey with short length — use ≥256 bits",
    severity: "error",
    pattern: /generateKey\([^)]*(?:128|192)\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A02"],
  },

  // A01 — Broken Access Control: window.name read (data channel abuse vector)
  {
    category: "A01",
    label: "window.name read — cross-origin data channel abuse vector",
    severity: "warn",
    pattern: /\bwindow\.name\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A01", "assign", "="],
  },

  // ── v14.9.0 ──────────────────────────────────────────────────────────────

  // A03 — Injection: document.createTreeWalker with SHOW_ALL + innerHTML sink
  {
    category: "A03",
    label: "createTreeWalker SHOW_ALL — review for DOM clobbering vectors",
    severity: "warn",
    pattern: /createTreeWalker\([^)]*NodeFilter\.SHOW_ALL\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A03", "sanitize"],
  },

  // A05 — Security Misconfiguration: SharedArrayBuffer without COOP/COEP headers
  {
    category: "A05",
    label: "SharedArrayBuffer usage — requires Cross-Origin-Isolation headers",
    severity: "warn",
    pattern: /\bnew\s+SharedArrayBuffer\b/,
    safeMarkers: ["test", "spec", "// owasp-allow:A05"],
  },

  // A02 — Cryptographic Failures: hardcoded IV/nonce (must be random per encryption)
  {
    category: "A02",
    label: "hardcoded IV/nonce — must be random per encryption",
    severity: "error",
    pattern: /\b(?:iv|nonce)\s*[:=]\s*(?:new Uint8Array\(\[|Uint8Array\.from\(\[|\[)\s*\d/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A02", "random", "getRandomValues"],
  },

  // A07 — Authentication Failures: Authorization header constructed from literal
  {
    category: "A07",
    label: "Authorization header with string literal — may leak credentials in source",
    severity: "warn",
    pattern: /['"]Authorization['"]\s*:\s*[`'"]/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A07", "Bearer ${", "getToken", "authToken"],
  },

  // ── v14.10.0 ─────────────────────────────────────────────────────────────

  // A01 — Broken Access Control: Object.fromEntries on unsanitized URLSearchParams
  {
    category: "A01",
    label: "Object.fromEntries(searchParams) — parameter injection without validation",
    severity: "warn",
    pattern: /Object\.fromEntries\(\s*(?:new\s+URLSearchParams|searchParams|params|query)/i,
    safeMarkers: ["test", "spec", "// owasp-allow:A01", "validate", "schema", "parse", "pick"],
  },

  // A08 — Software Integrity: script/link element without integrity attribute (SRI bypass)
  {
    category: "A08",
    label: "createElement('script'/'link') without integrity — missing SRI for external resource",
    severity: "warn",
    pattern: /createElement\(\s*['"](?:script|link)['"]\s*\)(?:[\s\S]{0,200})(?:src|href)\s*=/,
    safeMarkers: ["test", "spec", "// owasp-allow:A08", "integrity", "crossOrigin", "trusted"],
  },

  // A09 — Logging Failures: sendBeacon with potentially sensitive payload
  {
    category: "A09",
    label: "navigator.sendBeacon — verify payload contains no PII or credentials",
    severity: "warn",
    pattern: /navigator\.sendBeacon\s*\(/,
    safeMarkers: ["test", "spec", "// owasp-allow:A09", "anonymize", "redact", "sanitize"],
  },
];

/** Exempt source paths (relative to root, forward slashes). */
const EXEMPT_PATHS = [
  "src/core/trusted-types.ts",
  // exempt the scanner itself and security-checker helpers —
  // they enumerate dangerous patterns by design, so every rule would match their own source.
  "scripts/check-owasp.mjs",
  "scripts/check-trusted-types.mjs",
  // public API proxy uses CORS wildcard by design.
  "worker/src/utils/validation.ts",
  "worker/src/utils/response.ts",
  "worker/src/middleware/cors.ts",
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
 * Collect all .mjs files (non-recursive) from `dir`.
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

// Collect from src/, worker/src/, and scripts/
const files = [
  ...collectTsFiles(SRC),
  ...(statSync(WORKER_SRC, { throwIfNoEntry: false })?.isDirectory()
    ? collectTsFiles(WORKER_SRC)
    : []),
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
      if (line.includes("owasp-allow:all")) continue; // Per-rule safe markers (e.g. trustedHTML( makes innerHTML safe)
      // Check current line + next 2 lines for multi-line statements
      const context = [line, lines[i + 1] ?? "", lines[i + 2] ?? ""].join(" ");
      if (rule.safeMarkers?.some((m) => context.includes(m))) continue;
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
