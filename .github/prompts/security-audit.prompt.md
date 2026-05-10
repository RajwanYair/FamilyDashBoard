---
description: "Run a targeted OWASP Top 10 security audit against the FamilyDashBoard codebase"
tools:
  [
    "read_file",
    "grep_search",
    "file_search",
    "run_in_terminal",
    "get_terminal_output",
    "get_errors",
    "replace_string_in_file",
    "multi_replace_string_in_file",
    "vscode_listCodeUsages",
    "manage_todo_list",
    "tool_search",
    "memory",
    "runSubagent",
    "view_image",
  ]
---

# Security Audit — FamilyDashBoard

Perform a security review of the FamilyDashBoard codebase against the OWASP Top 10.

> FamilyDashBoard is a **static client-only PWA** with no server, no auth, and no
> user-submitted data. The threat surface is XSS, supply-chain attacks, and
> accidental secret leaks. There is no A01 (access control) or A07 (auth) exposure.

## Automated Checks

Run these first — all must exit 0 before proceeding:

```powershell
# 1. Lint (includes security-related ESLint rules)
npx eslint src tests --max-warnings 0

# 2. TypeScript type safety
npx tsc --noEmit

# 3. npm audit (high+ vulnerabilities)
npm audit --audit-level=high

# 4. OWASP compliance script
node scripts/check-owasp.mjs

# 5. Trusted Types audit
node scripts/check-trusted-types.mjs

# 6. CSP wildcard check
node scripts/check-csp-wildcards.mjs

# 7. Dead exports (no orphaned code surfaces)
node scripts/check-dead-exports.mjs
```

## Manual Review Checklist

### A03 — Injection (XSS)

- [ ] No `innerHTML` with unsanitized data anywhere in `src/` or `worker/`
- [ ] All DOM text insertion uses `textContent` (never `innerHTML` with user data)
- [ ] No `eval()` or `new Function()` calls
- [ ] `diagLog()` messages do not interpolate user-controlled strings into DOM

### A05 — Security Misconfiguration

- [ ] CSP `_headers` is restrictive (no `unsafe-inline`, no wildcards)
- [ ] Service Worker only caches allowed origins (7 API origins in `sw.ts`)
- [ ] `--base ./` local build does not expose file:// path to script injection
- [ ] No debug endpoints or diagnostic info exposed in production bundle

### A06 — Vulnerable Components

- [ ] `npm audit --audit-level=high` returns 0 vulnerabilities
- [ ] Trivy weekly scan shows no HIGH/CRITICAL unpatched CVEs
- [ ] All GitHub Actions pinned to full 40-char SHAs (or `# pin-allow` with justification)
- [ ] `node scripts/check-actions-pinned.mjs` exits 0

### A08 — Software and Data Integrity

- [ ] `npm audit signatures` passes (Sigstore transparency log verification)
- [ ] No `.npmrc` auth tokens in repo
- [ ] `scripts/check-sigstore.mjs` exits 0

### A09 — Security Logging & Monitoring

- [ ] `diagLog()` calls do not leak API keys or user data
- [ ] Error overlay (`D` key) only accessible in non-production or explicitly toggled
- [ ] Service Worker version broadcast (`VERSION_ACTIVATED`) carries no PII

## Reporting

Use `get_errors` to surface webhint + ESLint security-related diagnostics before manual review.
Use `manage_todo_list` to track findings and fixes across the A03–A09 checklist.

For each finding:

1. **Severity**: Critical / High / Medium / Low
2. **Location**: file + line number
3. **Description**: what the vulnerability is
4. **Fix**: exact code change needed

Fix all Critical and High findings before the next release tag.

## FamilyDashBoard-Specific Context

| Area        | Rule                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| API keys    | All keys are public/read-only (weather, stocks, news) — no write-capable secrets |
| Auth        | None — static PWA with no user accounts (Rule 26 in copilot-instructions.md)     |
| Data        | No PII collected or stored — localStorage only stores UI preferences             |
| CSP         | Configured in `_headers` (Cloudflare Pages) or meta tag fallback                 |
| Proxy chain | `allorigins → codetabs → corsproxy.io` — data is read-only API responses         |
