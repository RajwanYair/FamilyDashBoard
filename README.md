<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner.svg">
  <img src=".github/assets/banner.svg" alt="Family Dashboard" width="100%">
</picture>

<br/>

[![CI](https://github.com/RajwanYair/FamilyDashBoard/actions/workflows/ci.yml/badge.svg)](https://github.com/RajwanYair/FamilyDashBoard/actions/workflows/ci.yml)
[![Deploy](https://github.com/RajwanYair/FamilyDashBoard/actions/workflows/deploy.yml/badge.svg)](https://github.com/RajwanYair/FamilyDashBoard/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/Live_Demo-GitHub_Pages-2ea44f?style=flat-square&logo=github)](https://rajwanyair.github.io/FamilyDashBoard/)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/RajwanYair/FamilyDashBoard/pkgs/container/familydashboard)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ES2020+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-34d399?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-60a5fa?style=flat-square)
![RTL](https://img.shields.io/badge/Layout-RTL%20Hebrew-fbbf24?style=flat-square)
![Version](https://img.shields.io/badge/Version-4.5-a78bfa?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-164_passing-34d399?style=flat-square)

[![GitHub stars](https://img.shields.io/github/stars/RajwanYair/FamilyDashBoard?style=social)](https://github.com/RajwanYair/FamilyDashBoard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/RajwanYair/FamilyDashBoard?style=social)](https://github.com/RajwanYair/FamilyDashBoard/network/members)
[![GitHub issues](https://img.shields.io/github/issues/RajwanYair/FamilyDashBoard?style=flat-square&color=f87171)](https://github.com/RajwanYair/FamilyDashBoard/issues)
[![Last Commit](https://img.shields.io/github/last-commit/RajwanYair/FamilyDashBoard?style=flat-square&color=60a5fa)](https://github.com/RajwanYair/FamilyDashBoard/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/RajwanYair/FamilyDashBoard?style=flat-square&color=34d399)](https://github.com/RajwanYair/FamilyDashBoard)

**A single-file, zero-dependency family dashboard for always-on TV display.**<br/>
Dark glassmorphism · 5 themes · Hebrew RTL · 20 Hebrew news feeds · Per-pane smart refresh · Diagnostic overlay

[Getting Started](#-getting-started) · [Features](#-features) · [Data Sources](#-data-sources) · [Architecture](#-architecture) · [Changelog](#-changelog) · [Contributing](.github/CONTRIBUTING.md)

</div>

---

## 📺 Preview

<div align="center">
<img src=".github/assets/preview.svg" alt="Dashboard Preview" width="100%">
</div>

> The dashboard runs full-screen on a 55" TV in the living room with **per-pane smart refresh** (no full-page reloads). Designed for comfortable reading from 3 meters away.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📰 Live News

Auto-scrolling Hebrew news from **20 RSS sources** (Rotter, Ynet, Walla, Maariv, Calcalist, Globes, Kan, Israel Hayom, Channel 13, Geektime, Ynet Economy, Walla Economy, Haaretz, Makor Rishon, Kikar HaShabbat, ICE, Sport5), sorted newest-first with source labels and relative timestamps. Refreshes every **15 minutes**.

### 📅 Family Calendar

Native **ICS parser** fetches Google Calendar data via direct → 3 CORS proxy fallback chain, renders events in a dark-themed agenda view. Falls back to iframe embed if all ICS fetches fail. Refreshes every **15 minutes**.

### 📈 Stock Tracker

6 live symbols (INTC, S&P 500, BTC, NVDA, VIX, TSLA) with **smooth bézier SVG charts**, colored per-symbol accents, Yahoo Finance v8/v6 API with proxy fallback, **8-second fetch timeout** (AbortController) to prevent hanging, and a **market open/closed badge** with smart refresh (10 min during market hours, 30 min off-hours). Loaded in parallel batches of 3.

### 🚨 Red Alerts (צבע אדום)

Live rocket/UAV alerts from the Home Front Command via [tzevaadom.co.il](https://www.tzevaadom.co.il/). Shows 24h count, last 25 events with city names, threat type, and relative time. Active alerts pulse red. Refreshes every **60 seconds** (5 min when idle).

</td>
<td width="50%">

### 🌤️ Weather + UV

Split-panel layout: **right half** shows current conditions (icon + temperature + description), **left half** shows a 2×2 grid of humidity, wind, UV index, and sunrise. Below: a **12-hour temperature curve** and an enlarged **4-day forecast** with bigger icons. Data from Open-Meteo for Jerusalem.

### 💱 Currency Exchange

Live USD/ILS, EUR/ILS, GBP/ILS rates from open exchange rate APIs with colored trend indicators.

### 🕯️ Shabbat & Holidays

Candle lighting and havdalah times from Hebcal, plus a **holiday countdown** with days-remaining in the header.

### 💪 Motivation

**50 curated Hebrew quotes** with smooth crossfade animation. No network needed — purely static. Refreshes every **4 hours**.

### ⏱️ Smart Dashboard

- **Per-pane independent refresh** — no full-page reloads
- **Dual-layer cache** (in-memory Map + localStorage) — survives browser restart, 7-day eviction
- **Stale-while-revalidate** — shows cached data instantly, fetches in background
- **5 themes** (OLED black, blue, matrix, amber, purple) — press `T` to cycle
- **3 screen modes** (TV, tablet, phone) — phone mode enables full-page scroll
- **6 card entrance animations** — random direction per card, attention loop every 5min
- **Card maximize** — click any card header to expand it full-screen (FLIP animation), click again or press `Escape` to restore
- **Animated number transitions** — smooth counting effect on temperature, stock prices, and currency values
- **Exponential backoff** — failed API fetches retry with increasing delays
- **Diagnostic overlay** — press `D` for per-pane status + fetch log, auto-opens on errors
- **Offline banner** — slides down when internet is lost, serves stale cache
- **Startup self-check** — validates MOTIVATIONS, DOM refs, PROXIES, STOCK_SYMBOLS
- **Day & year progress bars** in the status bar
- **Blinking clock** with gradient text effect

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

<div align="center">
<img src=".github/assets/tech-stack.svg" alt="Tech Stack" width="100%">
</div>

---

## 🚀 Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/RajwanYair/FamilyDashBoard.git

# 2. Open in browser — that's it!
open BestDashBoard.html        # macOS
start BestDashBoard.html       # Windows
xdg-open BestDashBoard.html   # Linux
```

> **Tip:** Press **F11** for full-screen TV mode. Press **T** to cycle themes, **D** for diagnostics, **Escape** to close a maximized card. Click any card header to expand it full-screen. For hot-reload during development, use VS Code + Live Server extension.

No npm. No build step. No dependencies. Just **one HTML file**.

---

## 📡 Data Sources

<div align="center">
<img src=".github/assets/data-sources.svg" alt="Data Sources" width="85%">
</div>

All APIs are free and require no API keys. CORS is handled via a proxy fallback chain (`direct → allorigins.win → codetabs.com → corsproxy.io`). Every response is cached in localStorage with stale-while-revalidate for instant display.

---

## 🏗️ Architecture

<div align="center">
<img src=".github/assets/architecture.svg" alt="Architecture Diagram" width="100%">
</div>

### Single-File Design

Everything lives in one file — `BestDashBoard.html` — containing:

| Layer | Description |
| ------- | ------------- |
| **HTML** | Semantic structure with RTL Hebrew layout |
| **CSS** | Custom properties, glassmorphism cards, responsive grid, animations |
| **JavaScript** | Async data fetching with proxy fallback, DOM caching, SVG chart generation |

### Key Patterns

```javascript
// ✅ Persistent cache with stale-while-revalidate
const cached = cGet(key, TTL);
if (cached) { render(cached); return; }
const stale = cGetStale(key);
if (stale) render(stale); // show old data while fetching

// ✅ Multi-proxy fallback for CORS
for (const proxy of PROXIES) { /* try each */ }

// ✅ Fetch timeout (prevents hanging on slow proxies)
function fetchWithTimeout(url, ms = 8000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}

// ✅ Smooth bézier SVG charts
path += ` C${x1+cp},${y1} ${x2-cp},${y2} ${x2},${y2}`;
```

---

## 📂 Project Structure

```text
FamilyDashBoard/
├── 📄 BestDashBoard.html          # The entire dashboard (HTML + CSS + JS)
├── � index.html                  # GitHub Pages redirect → BestDashBoard.html
├── �📖 README.md                   # Project documentation
├── 📋 CHANGELOG.md                # Version history
├── 📋 SUPPORT.md                  # Support channels & troubleshooting
├── 📋 CITATION.cff                # Software citation metadata
├── 📋 LICENSE                     # MIT License
├── 🐋 Dockerfile                  # Docker containerization
├── 🐋 nginx.conf                  # Nginx serving config
├── 📋 .editorconfig
├── 🚫 .gitignore / .gitattributes / .dockerignore
├── 📁 tests/
│   └── dashboard.test.mjs        # 164 tests, 23 suites (Node.js built-in runner)
├── 📁 .github/
│   ├── 🖼️ assets/                  # SVG graphics for docs
│   ├── 🤖 agents/                  # Copilot custom agents
│   ├── 📐 instructions/            # Copilot context files
│   ├── 💬 prompts/                 # Reusable Copilot prompts
│   ├── ⚙️ copilot/config.json      # Copilot modes
│   ├── 🪝 hooks/                   # Git hooks
│   ├── 🔄 workflows/
│   │   ├── ci.yml                 # Lint + security + Lighthouse
│   │   ├── deploy.yml             # GitHub Pages deploy
│   │   ├── docker-publish.yml     # GHCR Docker publish
│   │   ├── release.yml            # Auto-release notes
│   │   ├── auto-assign.yml        # PR/issue auto-assign
│   │   ├── auto-label.yml         # PR auto-labeling
│   │   ├── stale.yml              # Stale issue management
│   │   ├── welcome.yml            # First-contributor greeting
│   │   └── ...                    # + dependabot-auto-merge, auto-close, track-changes
│   ├── 📋 ISSUE_TEMPLATE/          # Bug, feature, API issue forms
│   ├── 💬 DISCUSSION_TEMPLATE/     # Ideas, Q&A, show-and-tell
│   ├── 📋 PULL_REQUEST_TEMPLATE.md
│   ├── 🤝 CONTRIBUTING.md
│   ├── 🔒 SECURITY.md
│   ├── 🤝 CODE_OF_CONDUCT.md
│   ├── 📋 CODEOWNERS
│   ├── 📋 AGENTS.md
│   ├── 💰 FUNDING.yml
│   ├── 📋 dependabot.yml / labeler.yml / release.yml
│   └── 📋 copilot-instructions.md
└── 📁 .vscode/
    └── ⚙️ settings.json            # Editor + Copilot config
```

---

## 🎨 Design System

| Token | Value | Usage |
| ------- | ------- | ------- |
| `--bg-primary` | `#060b14` | Page background |
| `--bg-card` | `rgba(15,23,42,0.78)` | Card panels |
| `--accent` | `#60a5fa` | Headers, borders, links |
| `--positive` | `#34d399` | Stock gains, sync OK |
| `--negative` | `#f87171` | Stock losses, errors |
| `--warning` | `#fbbf24` | Shabbat info, loading |
| `--purple` | `#a78bfa` | Accents, stock colors |
| `--pink` | `#f472b6` | Motivation, greeting |
| `--orange` | `#fb923c` | Weather, stock accent |
| `--cyan` | `#22d3ee` | Weather, news accent |
| `--text-primary` | `#f1f5f9` | Main text |
| `--text-secondary` | `#94a3b8` | Secondary labels |

Cards use `backdrop-filter: blur(16px)` for the glassmorphism effect. All animations use `ease-out` with staggered delays.

---

## 🏷️ Topics & Keywords

> **Suggested GitHub repo topics** — add these via Settings → Topics for discoverability:

`dashboard` `family-dashboard` `tv-display` `hebrew` `rtl` `israel`
`glassmorphism` `single-file` `zero-dependencies` `vanilla-javascript`
`weather` `stocks` `news` `currency` `shabbat` `red-alerts` `smart-home`
`open-meteo` `hebcal` `css-custom-properties` `dark-theme` `real-time`

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

| Version | Highlights |
| --------- | ----------- |
| **v4.5** | 🚀 Card maximize (click header to expand), animated number transitions, exponential backoff, syncBurst, corsproxy.io fallback, calendar resilience, 164 tests/23 suites, uptime tracker, RAF-throttled mousemove, scroll fade masks, animated gradient borders, GitHub Pages index.html |
| **v4.4** | ✨ 5 CSS themes, 3 screen modes, diagnostic overlay (D key), offline banner, card spotlight glow, async-safe loaders, startup self-check, 6 card entrance animations, 20 news feeds, faster ticker |
| **v4.3** | ⚡ Performance refactor, cache versioning (dash_v2_), ICS calendar renderer, DOMContentLoaded fix, seamless scroll loops |
| **v4.2** | 🚨 Red Alerts panel (tzevaadom.co.il), colorful icon badges, gradient accents |
| **v4.1** | ⏱️ Per-pane independent refresh, persistent localStorage cache |
| **v4.0** | 🎉 Holiday countdown, progress bars, market badge, feels-like temp, crossfade quotes |
| **v3.0** | 🏗️ Complete UI/UX refactor, glassmorphism redesign |

---

## 🏗️ GitHub Integration

This project leverages extensive GitHub features:

| Feature | Details |
| --------- | --------- |
| **GitHub Pages** | [Live demo](https://rajwanyair.github.io/FamilyDashBoard/) auto-deployed from `main` |
| **GitHub Actions** | 11+ workflows — CI, deploy, Docker publish, auto-label, stale, welcome |
| **Issue Templates** | YAML forms for bugs, features, API issues with auto-label & auto-assign |
| **Discussion Templates** | Ideas, Q&A, Show-and-Tell categories |
| **Dependabot** | Weekly updates for Actions & Docker dependencies |
| **GHCR Docker** | Container published to `ghcr.io/rajwanyair/familydashboard` |
| **Copilot Integration** | 2 custom agents, 5 modes, 3 prompts, 3 instruction files |
| **Community Health** | CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, CODEOWNERS |
| **Auto Release Notes** | 8-category changelog via `release.yml` |

---

## 🤝 Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for development setup and coding standards.

**Quick rules:**

- Use CSS custom properties — never hardcode colors
- Use `textContent` — never `innerHTML` with external data
- Keep it zero-dependency — no npm, no frameworks
- Test RTL layout + full-screen TV mode

---

## 📄 License

MIT © [RajwanYair](https://github.com/RajwanYair)

---

<div align="center">

**Built with ❤️ for the Rajwan family**

<sub>Designed for a 55" TV in the living room · Always on · Always updated</sub>

</div>
