# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 6.x (current) | ✅ Active |
| 5.x (BestDashBoard.html) | ❌ End of life |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately via:
[GitHub Security Advisories](https://github.com/rajwanyair/FamilyDashBoard/security/advisories/new)

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You will receive a response within 7 days. If the issue is confirmed, a fix will be published and you will be credited (unless you prefer anonymity).

## Security Design

### Architecture Boundaries

- **Frontend** (GitHub Pages): Static files — no server-side execution, no secrets
- **API Proxy** (Cloudflare Worker): Validates all inputs, allowlists upstream origins, no secrets stored client-side

### Content Security Policy

The dashboard enforces a strict CSP in `src/index.html`:

```http
default-src 'self'
script-src 'self'
style-src 'self' 'unsafe-inline'
img-src 'self' https: data:
connect-src 'self' https:
font-src 'self'
frame-src https://calendar.google.com
base-uri 'self'
form-action 'none'
```

### Cloudflare Worker Security Controls

- Input validation on all parameters (coords, symbols, URLs)
- SSRF prevention: ICS calendar URL allowlist (`ALLOWED_CALENDAR_ORIGINS`)
- CORS locked to `https://rajwanyair.github.io` only
- Security headers on all responses: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`

### Data Handling

- No user authentication — the dashboard is a private family display
- Configuration stored in `localStorage` only (never transmitted)
- No cookies, no tracking, no analytics
- All API calls are read-only; no user data is sent to any upstream service

### Dependencies

This project has **zero runtime npm dependencies**. All packages are development-only (build tools, test frameworks, linters). Dependency security is enforced by:

- `npm audit --audit-level=high` on every CI run
- Dependabot automated PRs for version updates
