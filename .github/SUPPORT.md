# Support

<div align="center">

[![Discussions](https://img.shields.io/badge/Ask_a_Question-Discussions-60a5fa?style=flat-square&logo=github)](https://github.com/RajwanYair/FamilyDashBoard/discussions)
[![Issues](https://img.shields.io/badge/Report_a_Bug-Issues-f87171?style=flat-square&logo=github)](https://github.com/RajwanYair/FamilyDashBoard/issues/new/choose)
[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-34d399?style=flat-square&logo=github)](https://rajwanyair.github.io/FamilyDashBoard/)

</div>

## Getting Help

| Channel                                                                                      | Use For                                   |
| -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [README](https://github.com/RajwanYair/FamilyDashBoard#readme)                               | Setup, usage, and feature overview        |
| [Changelog](https://github.com/RajwanYair/FamilyDashBoard/blob/main/CHANGELOG.md)            | Version history and release notes         |
| [Discussions](https://github.com/RajwanYair/FamilyDashBoard/discussions)                     | Questions, ideas, and general help        |
| [Issues](https://github.com/RajwanYair/FamilyDashBoard/issues/new/choose)                    | Bug reports, feature requests, API issues |
| [Security Advisories](https://github.com/RajwanYair/FamilyDashBoard/security/advisories/new) | Private security vulnerability reports    |

## Quick Troubleshooting

### Data not loading?

1. Open browser DevTools (F12) → Console tab
2. Check for CORS or network errors
3. The dashboard uses proxy fallbacks — wait ~30 seconds for retry
4. Check if the API provider is down (Open-Meteo, Hebcal, Yahoo Finance, tzevaadom.co.il, etc.)
5. Cached data from localStorage will display while fetching — if you see stale data, the network may be temporarily unavailable

### Red Alerts not showing?

- The alerts API (api.tzevaadom.co.il) refreshes every 30 seconds
- If no alerts appear, there may be no active alerts in the past 24 hours
- Check DevTools Console for CORS errors — the dashboard will try proxy fallbacks

### Dashboard looks broken on your TV?

- Ensure resolution is 1920×1080 or higher
- Use Chrome or Edge in full-screen mode (F11)
- Disable browser zoom (Ctrl+0 to reset)

### Keyboard Shortcuts

| Key      | Action                                                            |
| -------- | ----------------------------------------------------------------- |
| `T`      | Cycle through 6 themes (black, blue, matrix, amber, purple, rose) |
| `D`      | Toggle diagnostic overlay (per-pane status + fetch log)           |
| `A`      | Toggle red alerts pane                                            |
| `S`      | Open settings / config panel                                      |
| `N`      | Toggle night dimmer                                               |
| `M`      | Toggle video mute (video-news card)                               |
| `V`      | Cycle video channel (C14 → i24 → …)                               |
| `Escape` | Close maximized card / active overlay                             |

> **Tip:** Click any card header to expand it full-screen (FLIP animation). Click again or press `Escape` to restore.

### Running Tests Locally

```bash
npx vitest run
# 3678+ tests, 123 suites, zero failures
```

Requires **Node.js 22+**.

### Live Demo

Visit the [GitHub Pages deployment](https://rajwanyair.github.io/FamilyDashBoard/) to try the dashboard without installing.

## Response Time

This is a personal/family project maintained by [@RajwanYair](https://github.com/RajwanYair). Response times may vary, but issues are typically reviewed within a few days.
