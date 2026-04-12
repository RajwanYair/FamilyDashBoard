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

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ES2020+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-34d399?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-60a5fa?style=flat-square)
![RTL](https://img.shields.io/badge/Layout-RTL%20Hebrew-fbbf24?style=flat-square)
![Version](https://img.shields.io/badge/Version-4.11-a78bfa?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-746_passing-34d399?style=flat-square)

[![GitHub stars](https://img.shields.io/github/stars/RajwanYair/FamilyDashBoard?style=social)](https://github.com/RajwanYair/FamilyDashBoard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/RajwanYair/FamilyDashBoard?style=social)](https://github.com/RajwanYair/FamilyDashBoard/network/members)
[![GitHub issues](https://img.shields.io/github/issues/RajwanYair/FamilyDashBoard?style=flat-square&color=f87171)](https://github.com/RajwanYair/FamilyDashBoard/issues)
[![Last Commit](https://img.shields.io/github/last-commit/RajwanYair/FamilyDashBoard?style=flat-square&color=60a5fa)](https://github.com/RajwanYair/FamilyDashBoard/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/RajwanYair/FamilyDashBoard?style=flat-square&color=34d399)](https://github.com/RajwanYair/FamilyDashBoard)

**A single-file, zero-dependency family dashboard for always-on TV display.**<br/>
Dark glassmorphism · 5 themes · Hebrew RTL · 17 Hebrew news feeds · Per-pane smart refresh · Diagnostic overlay

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

Auto-scrolling Hebrew news from **17 RSS sources** (Ynet, Walla, Mako, Kan, N12, Rotter, Israel Hayom, Globes, Calcalist, Makor Rishon, Kikar HaShabbat, ICE, Geektime, Channel 14, Arutz 7, Srugim, Behadrei Haredim), sorted newest-first with source labels and relative timestamps. Refreshes every **15 minutes**.

### 📅 Family Calendar

Native **ICS parser** fetches Google Calendar data via direct → 3 CORS proxy fallback chain, renders events in a dark-themed agenda view. Falls back to iframe embed if all ICS fetches fail. Refreshes every **15 minutes**.

### 📈 Stock Tracker

**14 live symbols** (INTC, ^GSPC, BTC, NVDA, VIX, TSLA + top-10 S&P500: AAPL, MSFT, AMZN, GOOGL, META, BRK-B, AVGO, JPM) with **company logos**, **smooth bézier SVG charts**, colored per-symbol accents, Yahoo Finance v8/v6 API with proxy fallback, **8-second fetch timeout** (AbortController) to prevent hanging, and a **market open/closed badge** with smart refresh (5 min during market hours, 30 min off-hours). Loaded via `raceProxies()` batch for fastest response.

### 🚨 Red Alerts (צבע אדום)

Live rocket/UAV alerts from the Home Front Command via [tzevaadom.co.il](https://www.tzevaadom.co.il/). Shows 24h count, last 25 events with city names, threat type, and relative time. Active alerts pulse red. Refreshes every **60 seconds** (5 min when idle).

</td>
<td width="50%">

### 🌤️ Weather + UV

Split-panel layout: **right half** shows current conditions (icon + temperature + description), **left half** shows a 2×2 grid of humidity, wind, UV index, and sunrise. Below: a **12-hour temperature curve** and an enlarged **4-day forecast** with bigger icons. Data from Open-Meteo for Jerusalem.

### 💱 Currency Exchange

Live USD/ILS and EUR/ILS rates from open exchange rate APIs with colored trend indicators. GBP removed; layout optimized for 2-item display.

### 🕯️ Shabbat & Holidays

Candle lighting and havdalah times from Hebcal, plus a **holiday countdown** with days-remaining in the header.

### 💪 Motivation

**50 curated Hebrew quotes** with smooth crossfade animation. No network needed — purely static. Cycles every **2 minutes** for continuous TV display.

### ⏱️ Smart Dashboard

- **Per-pane independent refresh** — no full-page reloads
- **Dual-layer cache** (in-memory Map + localStorage) — survives browser restart, 7-day eviction
- **Stale-while-revalidate** — shows cached data instantly, fetches in background
- **5 themes** (OLED black, blue, matrix, amber, purple) — press `T` to cycle
- **3 screen modes** (TV, tablet, phone) — phone mode enables full-page scroll
- **6 card entrance animations** — random direction per card, attention loop every 5min
- **Card maximize** — click any card header to expand it full-screen (FLIP animation), click again or press `Escape` to restore
- **Alerts toggle** — press `A` or use dropdown to show/hide red alerts pane; **off by default**, persisted in localStorage
- **Auto hard-reload every 1h** — picks up HTML file changes without manual browser refresh; defers when tab is hidden
- **Closest sun event** — weather detail shows next upcoming sunrise or sunset based on current time
- **Daily Halacha ticker** — daily halacha from Sefaria.org with reference badge and numbered segments
- **Animated number transitions** — smooth counting effect on temperature, stock prices, and currency values
- **Exponential backoff** — failed API fetches retry with increasing delays
- **GPU/CPU performance** — GPU-accelerated scroll layers, CPU-aware concurrency pool, `scheduleIdle()`, DocumentFragment batch writes
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

> **Tip:** Press **F11** for full-screen TV mode. Press **T** to cycle themes, **D** for diagnostics, **A** to toggle alerts on/off, **Escape** to close a maximized card. Click any card header to expand it full-screen. For hot-reload during development, use VS Code + Live Server extension.

No npm. No build step. No dependencies. Just **one HTML file**.

>  **Testing:** Requires Node.js 18+ — run `node --test tests/dashboard.test.mjs` (791 tests, 52 suites, zero dependencies).

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
├── BestDashBoard.html              # The entire dashboard (HTML + CSS + JS)
├── index.html                      # GitHub Pages redirect
├── README.md / CHANGELOG.md        # Documentation
├── SUPPORT.md / LICENSE
├── .editorconfig / .markdownlint.json
├── .gitignore / .gitattributes
├── tests/
|   └── dashboard.test.mjs          # 791 tests, 52 suites (Node.js built-in runner)
├── .github/
│   ├── assets/                     # SVG graphics for docs
│   ├── agents/                     # Copilot custom agents
│   ├── instructions/               # Copilot context files
│   ├── prompts/                    # Reusable Copilot prompts
│   ├── copilot/config.json         # Copilot modes
│   ├── hooks/                      # Git hooks
│   ├── workflows/
│   │   ├── ci.yml                  # Lint + unit tests + security + Lighthouse
│   │   ├── deploy.yml              # GitHub Pages deploy
│   │   ├── release.yml             # Auto-release notes
│   │   ├── auto-label.yml          # PR auto-labeling
│   │   └── dependabot-auto-merge.yml
│   ├── ISSUE_TEMPLATE/             # Bug, feature, API issue forms
│   ├── DISCUSSION_TEMPLATE/        # Ideas, Q&A, show-and-tell
│   ├── CONTRIBUTING.md / SECURITY.md / CODE_OF_CONDUCT.md
│   ├── CODEOWNERS / AGENTS.md
│   ├── dependabot.yml / labeler.yml / release.yml
│   └── copilot-instructions.md
└── .vscode/
    ├── settings.json               # Editor + Copilot + testing config
    └── extensions.json             # Recommended extensions
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

`dashboard` `family-dashboard` `tv-display` `smart-home` `hebrew` `rtl` `israel`
`glassmorphism` `single-file` `zero-dependencies` `vanilla-javascript` `html5` `css3`
`weather` `stocks` `news-reader` `dark-theme` `real-time` `github-pages` `open-source`

> These topics are set on the [GitHub repository](https://github.com/RajwanYair/FamilyDashBoard) for discoverability.
> Search GitHub for [`topic:family-dashboard`](https://github.com/topics/family-dashboard) or [`topic:tv-display`](https://github.com/topics/tv-display) to find this project.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

| Version | Highlights |
| --------- | ----------- |
| **v4.11.0** | 🎯 Sprint 8 (F71–80): GBP currency tile, calendar heat-map, news favicons, stock sector headers, AQI sparkline, Shabbat pill, Parasha progress bar, weather tooltip, PWA metas |
| **v4.10.0** | 🏆 Sprints 6–7 (F51–70): Portfolio total, TA-35 index, rel-vol badge, 7-day cal strip, AQI labels+trend, per-stock sparklines, rain probability overlay, news age+share, market countdown, quake 24h count, diag copy-log |
| **v4.9.0** | 🚀 Sprints 1–5 (F1–50): Parasha, Zmanim, Daf Yomi, Psalm, Moon phase, Shabbat countdown, AQI card, Gold/Silver, school holidays, config panel, chore wheel, portfolio P&L, earthquake monitor, news filter, currency sparklines, multi-city weather, pre/after-hours badge, 52-week range, font scale, print mode |
| **v4.8.2** | 🔧 Slim clock header, stock fetch overhaul (v8 per-symbol + CoinGecko BTC), currency side-by-side, card maximize centering, page blink fix, expanded 6-phase roadmap |
| **v4.8.1** | 🔧 Slim card headers, per-card font density, Sefirat HaOmer visible in heb-cal, Shabbat+Havdalah on one line, README roadmap, stale test counts fixed |
| **v4.8** | 🗓️ Hebrew Calendar card (לוח עברי), brand-color stock logos via Google Favicons, 3-column CSS grid layout, alphabetical stocks, no-clone stock scroll, 4 Copilot skills |
| **v4.7** | 🌾 Sefirat HaOmer in header, 14 stock symbols, top-S&P500 added (AAPL MSFT AMZN GOOGL META BRK-B AVGO JPM), stock logos |
| **v4.6** | 🔁 Auto hard-reload every 1h, closest sun event (sunrise↔sunset), 65/35 row split, USD+EUR currency only, 2min motivation cycle |
| **v4.5** | 🚀 Card maximize, animated numbers, exponential backoff, syncBurst, alerts toggle (A key), halacha ticker, 17 news feeds, RTL weather chart, raceProxies |
| **v4.4** | ✨ 5 themes, 3 screen modes, diagnostic overlay (D key), offline banner, startup self-check |
| **v4.3** | ⚡ Performance refactor, cache versioning, ICS calendar renderer |
| **v4.2** | 🚨 Red Alerts panel (tzevaadom.co.il) |
| **v4.1** | ⏱️ Per-pane independent refresh, persistent localStorage cache |
| **v4.0** | 🎉 Holiday countdown, progress bars, market badge |
| **v3.0** | 🏗️ Complete UI/UX refactor, glassmorphism redesign |

---

## 🏗️ GitHub Integration

This project leverages extensive GitHub features:

| Feature | Details |
| --------- | --------- |
| **GitHub Pages** | [Live demo](https://rajwanyair.github.io/FamilyDashBoard/) auto-deployed from `main` |
| **GitHub Actions** | 5 workflows — CI, deploy, release, auto-label, dependabot-auto-merge |
| **Issue Templates** | YAML forms for bugs, features, API issues with auto-labeling |
| **Discussion Templates** | Ideas, Q&A, Show-and-Tell categories |
| **Dependabot** | Weekly updates for GitHub Actions dependencies |
| **Copilot Integration** | 2 custom agents, 4 skills, 3 prompts, 3 instruction files |
| **Community Health** | CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, CODEOWNERS |
| **Auto Release Notes** | 8-category changelog via `release.yml` |

---

## 🗺️ Roadmap

> Each planned item ships as a numbered release with `BestDashBoard.html` attached to the GitHub Release and live on GitHub Pages. No build artifacts — the HTML file IS the deliverable.

### Phase 1 — Jewish Life Enrichment (v4.9) ✅

| Version | Feature | API / Source | Details | Status |
|---------|---------|-------------|---------|--------|
| **v4.8.x** | Card UX polish, font density, Omer fix, stock fetch fix, ticker direction, currency layout | — | ✅ Done | ✅ Done |
| **v4.9** | **פרשת השבוע** — Parashat HaShavua in Hebrew Calendar card | Hebcal `?parsha=on` + Sefaria `/api/calendars` | Show weekly Torah portion name + short summary (Hebrew) in hc-card | ✅ Done |
| **v4.9** | **זמני תפילה** — Zmanim (prayer times) in heb-cal card | Hebcal extended + Open-Meteo sunrise/sunset | Alot, Netz, Sof Zman Shma, Mincha Ged., Plag, Shkia — 6 key times in 3-column grid | ✅ Done |
| **v4.9** | **דף יומי** — Daf Yomi | Sefaria `/api/calendars` | Tractate + folio number with Sefaria deeplink button | ✅ Done |
| **v4.9** | **שיר של יום** — Psalm of the Day | Sefaria `/api/texts/Psalms` | Day-of-week mapped psalm, first verse shown in hc-card | ✅ Done |
| **v4.9** | **פרשת עליות** — Parasha Aliyot first verse | Sefaria `/api/texts/[parasha]` | Opening verse of the week's reading shown in italic | ✅ Done |

### Phase 2 — Daily Life Utilities (v4.10) ✅

| Version | Feature | API / Source | Details | Status |
|---------|---------|-------------|---------|--------|
| **v4.10** | **איכות אוויר** — Air Quality Index card | OpenWeatherMap AQI (free tier, no key) | PM2.5 + AQI number + Hebrew category label + trend arrow (↑/↓/→) | ✅ Done |
| **v4.10** | **°C / °F toggle** — Temperature unit switch | `localStorage` key `dash_tempUnit` | Click any temperature display to toggle; affects all weather displays | ✅ Done |
| **v4.10** | **חופשות בי״ס** — School holiday indicator | Hebcal `?min=on&maj=on` (already fetched) | "חופש [name]" badge in hc-card when within school holiday date range | ✅ Done |
| **v4.10** | **זהב וכסף** — Gold & Silver prices | Yahoo Finance `GC=F`, `SI=F` | Two additional tiles in currency card: gold oz/USD, silver oz/USD | ✅ Done |
| **v4.10** | **פאנל הגדרות** — Config panel | `localStorage` multi-key | Slide-over panel (`S` key): background URL, theme, °C/°F, ticker msg, stock alerts, alert sound | ✅ Done |

### Phase 3 — Data Depth & Visual Polish (v4.11) ✅

| Version | Feature | API / Source | Details | Status |
|---------|---------|-------------|---------|--------|
| **v4.11** | **עליות השבוע** — Parasha Aliyot summary | Sefaria `/api/texts/[parasha]` | Short Hebrew digest of weekly reading, shown below parasha name in hc-card | ✅ Done |
| **v4.11** | **Gold + Silver prices** — Precious metals in currency card | Yahoo Finance `GC=F`, `SI=F` | Two additional rows: gold oz/USD, silver oz/USD | ✅ Done |
| **v4.11** | **Port. P&L overlay** — Per-stock position profit/loss | `localStorage:dash_portfolio` | JSON cost+qty per symbol; real-time P&L % shown per tile | ✅ Done |
| **v4.11** | **Currency sparklines** — 7-day rate history | `localStorage:dash_v2_cur_hist` | Bézier SVG sparkline in each currency tile | ✅ Done |

### Phase 3 Sprint 8 — UX Polish & Smart Tiles (v4.11) ✅

| Version | Feature | Details | Status |
|---------|---------|---------|--------|
| **v4.11** | **F71 — GBP / ILS tile** | 5th currency tile for British Pound; uses existing ER-API rates call | ✅ Done |
| **v4.11** | **F72 — Calendar heat-map** | `.heat-1/2/3` CSS on week strip cells (1 / 2–3 / 4+ events) | ✅ Done |
| **v4.11** | **F73 — News source favicon** | Google S2 favicons in filter chips via `NEWS_SRC_DOMAIN` map | ✅ Done |
| **v4.11** | **F74 — Stock sector headers** | מדדים / מניות separator rows in stocks scroll | ✅ Done |
| **v4.11** | **F75 — AQI sparkline** | 8-reading history sparkline next to AQI label | ✅ Done |
| **v4.11** | **F77 — Shabbat pill in header** | Candle-lighting countdown / Shabbat remaining time in header-right | ✅ Done |
| **v4.11** | **F78 — Parasha progress bar** | Day-in-week 3px bar under parasha name | ✅ Done |
| **v4.11** | **F79 — Weather chart tooltip** | SVG `<title>` on each hour circle (temp + rain%) | ✅ Done |
| **v4.11** | **F80 — PWA meta tags + install** | `apple-mobile-web-app*` metas, `#pwa-install-btn`, `beforeinstallprompt` | ✅ Done |

### Phase 4 — Offline & Installability (v5.0)

| Version | Feature | API / Source | Details | Status |
|---------|---------|-------------|---------|--------|
| **v5.0** | **PWA manifest + ServiceWorker** | Local | `manifest.json` (name, icons, display: standalone), SW caches HTML + serves stale-while-revalidate | 🔜 Planned |
| **v5.0** | **Install prompt** — "Add to Home Screen" for TV browser | PWA `beforeinstallprompt` | One-time prompt, then the dashboard launches like a native app | 🔜 Planned |
| **v5.0** | **Background sync** — SW periodically fetches APIs while tab is hidden | ServiceWorker + `sync` event | Prevents stale data after TV screen wakes from standby | 🔜 Planned |

### Phase 5 — Notifications & Real-Time (v5.1)

| Version | Feature | API / Source | Details | Status |
|---------|---------|-------------|---------|--------|
| **v5.1** | **Push notifications** — Red alerts via Web Push API | `web-push` + own micro-server or Firebase FCM free tier | Browser push even when tab is background; critical for צבע אדום | 🔜 Planned |
| **v5.1** | **SSE/WebSocket for real-time alerts** | Tzevaadom SSE endpoint (if available) or 10s polling | Replace 60s polling with streaming for near-instant alerts | 💡 Idea |

### Phase 6 — Multi-Family & Configurability (v5.2+)

| Version | Feature | API / Source | Details | Status |
|---------|---------|-------------|---------|--------|
| **v5.2** | **Config panel** — settings UI (gear icon or `S` shortcut) | `localStorage` | City, calendar URL, stock symbols, news feed selection, language pref — all in a slide-out panel | 🔜 Planned |
| **v5.2** | **Multi-city** — weather + Shabbat times for any geonameid | Open-Meteo + Hebcal | URL param `?city=281184` or config panel dropdown | 🔜 Planned |
| **v5.2** | **Multi-family config** — family name, ICS URL, alert zones | `?config=` URL param or `localStorage` | Each TV can show different family's calendar + alert zone | 💡 Idea |
| **v5.3** | **Family photo slideshow** — background or dedicated card | GitHub-hosted images or Google Photos (OAuth) | Carousel card with crossfade, configurable image URLs array | 💡 Idea |
| **v5.3** | **Transit departures** — next bus/train from home stop | GTFS-IL open data or Google Maps Embed | Configurable stop ID, show next 3 departures in real-time | 💡 Idea |

### Future Ideas (Backlog)

| Feature | Notes |
|---------|-------|
| **Electricity peak-hour warning** | ✅ Done — `checkElecPeak()` checks IEC seasonal tariff hours (16:00–22:00 summer / 17:00–22:00 winter), shows ⚡ badge |
| **שיר של יום** — Psalm of the day | ✅ Done — Sefaria `/api/texts/Psalms.[day]`, shown daily in hc-card |
| **Daf Yomi tracker** | ✅ Done — Sefaria `/api/calendars`, today's Daf with deeplink in hc-card |
| **Earthquake alerts** | ✅ Done — USGS GeoJSON M2.5+, 500km from Jerusalem; M3.5+ shown; 24h count badge |
| **TA-35 index** | ✅ Done — `^TA35.TA` via Yahoo Finance, TASE favicon, shown in stocks card |
| **Birthdays & anniversaries** | ✅ Done — `checkBirthdays()` parses `dash_birthday` localStorage, shows countdown badge |
| **Chore wheel / family tasks** | ✅ Done — `updateChoreWheel()` rotating daily chore assignments from `CHORES` const |
| **Package tracking** | Israel Post API `israelpost.co.il` — manual tracking number input | 💡 Idea |
| **Mincha/Minyan finder** | GoMinyan or local synagogue API — nearest minyan times | 💡 Idea |

> **Release convention:** Every version bump commits `BestDashBoard.html`, updates `CHANGELOG.md`, bumps the badge in `README.md`, tags `vX.Y.Z`, and pushes. GitHub Actions `release.yml` automatically attaches `BestDashBoard.html` to the GitHub Release. `deploy.yml` publishes to GitHub Pages within ~30 seconds of the push.

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
