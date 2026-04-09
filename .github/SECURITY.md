<div align="center">

# 🔒 Security Policy — FamilyDashBoard

![Security](https://img.shields.io/badge/XSS-Protected-34d399?style=flat-square)
![HTTPS](https://img.shields.io/badge/APIs-HTTPS_Only-60a5fa?style=flat-square)
![No Secrets](https://img.shields.io/badge/API_Keys-None_Required-fbbf24?style=flat-square)

</div>

## Overview

FamilyDashBoard is a client-side HTML dashboard that fetches data from public APIs. While it doesn't handle authentication or sensitive user data, it follows secure coding practices.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 4.5.x   | ✅ Yes    |
| 4.4.x   | ✅ Yes    |
| < 4.4   | ❌ No     |

## Reporting Vulnerabilities

Please report security vulnerabilities via GitHub Issues with the `security` label, or email the maintainer directly.

**Do NOT** post exploit details publicly.

## Security Best Practices

### For Contributors

- **No hardcoded API keys** — API keys should never appear in source code
- **No `eval()`** — Never use eval() with external data
- **Sanitize external data** — Use `textContent` instead of `innerHTML` for API content
- **No inline event handlers** — Use `addEventListener` in JavaScript
- **CORS proxies** — Only use trusted proxy services (allorigins.win, codetabs.com, corsproxy.io)
- **CSP-safe patterns** — Avoid patterns that would break Content Security Policy

### External API Safety

- All API calls use HTTPS
- API responses are cached client-side only (no server-side storage)
- No personal data is sent to APIs beyond location coordinates (Jerusalem lat/lon)
- Calendar embed uses Google's sandboxed iframe
- Red Alerts (tzevaadom.co.il) data is public Home Front Command information
- CORS proxies (allorigins.win, codetabs.com) are trusted third-party services

## Security Checklist

- [ ] No `eval()`, `Function()`, or `setTimeout(string)`
- [ ] No `innerHTML` with unsanitized external data
- [ ] No hardcoded credentials or API keys
- [ ] HTTPS-only API endpoints
- [ ] No `document.write()` usage
- [ ] External links use `rel="noopener noreferrer"` if clickable
