# Support

## Getting Help

| Channel                                                                                      | Use For                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [README](https://github.com/RajwanYair/FamilyDashBoard#readme)                               | Setup, usage, and feature overview        |
| [Discussions](https://github.com/RajwanYair/FamilyDashBoard/discussions)                     | Questions, ideas, and general help        |
| [Issues](https://github.com/RajwanYair/FamilyDashBoard/issues/new/choose)                    | Bug reports, feature requests, API issues |
| [Security Advisories](https://github.com/RajwanYair/FamilyDashBoard/security/advisories/new) | Private security vulnerability reports    |

## Quick Troubleshooting

### Data not loading?

1. Open browser DevTools (F12) → Console tab
2. Check for CORS or network errors
3. The dashboard uses proxy fallbacks — wait ~30 seconds for retry
4. Check if the API provider is down (Open-Meteo, Hebcal, etc.)

### Dashboard looks broken on your TV?

- Ensure resolution is 1920×1080 or higher
- Use Chrome or Edge in full-screen mode (F11)
- Disable browser zoom (Ctrl+0 to reset)

### Running via Docker?

```bash
docker pull ghcr.io/rajwanyair/familydashboard:latest
docker run -p 8080:80 ghcr.io/rajwanyair/familydashboard:latest
```

Then open `http://localhost:8080` in your browser.

## Response Time

This is a personal/family project maintained by [@RajwanYair](https://github.com/RajwanYair). Response times may vary, but issues are typically reviewed within a few days.
