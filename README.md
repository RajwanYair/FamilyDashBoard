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
![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-34d399?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-60a5fa?style=flat-square)
![RTL](https://img.shields.io/badge/Layout-RTL%20Hebrew-fbbf24?style=flat-square)
![Version](https://img.shields.io/badge/Version-14.24.0-a78bfa?style=flat-square)
![Tests](https://img.shields.io/badge/Vitest-7542_passing-34d399?style=flat-square)

[![GitHub stars](https://img.shields.io/github/stars/RajwanYair/FamilyDashBoard?style=social)](https://github.com/RajwanYair/FamilyDashBoard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/RajwanYair/FamilyDashBoard?style=social)](https://github.com/RajwanYair/FamilyDashBoard/network/members)
[![GitHub issues](https://img.shields.io/github/issues/RajwanYair/FamilyDashBoard?style=flat-square&color=f87171)](https://github.com/RajwanYair/FamilyDashBoard/issues)
[![Last Commit](https://img.shields.io/github/last-commit/RajwanYair/FamilyDashBoard?style=flat-square&color=60a5fa)](https://github.com/RajwanYair/FamilyDashBoard/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/RajwanYair/FamilyDashBoard?style=flat-square&color=34d399)](https://github.com/RajwanYair/FamilyDashBoard)

**A zero-dependency TypeScript family dashboard for always-on TV display.**<br/>
Pastel glassmorphism · 7 themes · Hebrew RTL · 12 cards · Per-pane smart refresh · Drag-and-drop layout · SW auto-reload · Diagnostic overlay

[Getting Started](#-getting-started) · [Features](#-features) · [Data Sources](#-data-sources) · [Architecture](#%EF%B8%8F-architecture) · [Docs](docs/README.md) · [Changelog](#-changelog) · [Contributing](.github/CONTRIBUTING.md)

</div>

---

## 📺 Preview

<div align="center">
<img src=".github/assets/preview.svg" alt="Dashboard Preview" width="100%">
</div>

> The dashboard runs full-screen on a 55" TV in the living room with **per-pane smart refresh** (no full-page reloads). Designed for comfortable reading from 3 meters away.
> Canonical product docs live in [docs/README.md](docs/README.md). The archived [BestDashBoard.html](docs/legacy/BestDashBoard.html) file is preserved for legacy reference only and is not the current app runtime.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📰 Live News

Auto-scrolling Hebrew news from **17 RSS sources** (Ynet, Walla, Mako, Kan, N12, Rotter, Israel Hayom, Globes, Calcalist, Makor Rishon, Kikar HaShabbat, ICE, Geektime, Channel 14, Arutz 7, Srugim, Behadrei Haredim), sorted newest-first with source labels. Each item shows **absolute publication time** (HH:MM / אתמול HH:MM / DD/MM HH:MM) and **elapsed age** (MM:SS · HH:MM:SS · D:HH:MM:SS). Feeds routed through the Cloudflare Worker. Refreshes every **15 minutes**.

### � Stock Tracker

**15 live symbols** (INTC, ^GSPC, ^TA35.TA, BTC, NVDA, VIX, TSLA + top-10 S&P500: AAPL, MSFT, AMZN, GOOGL, META, BRK-B, AVGO, JPM) with **company logos**, **smooth bézier SVG charts**, colored per-symbol accents, Yahoo Finance v8/v6 API with proxy fallback, **8-second fetch timeout** (AbortController) to prevent hanging, and a **market open/closed badge** with smart refresh (5 min during market hours, 30 min off-hours). Loaded via `raceProxies()` batch for fastest response.

### 🚨 Red Alerts (צבע אדום)

Live rocket/UAV alerts from the Home Front Command via [tzevaadom.co.il](https://www.tzevaadom.co.il/). Shows 24h count, last 25 events with city names, threat type, and relative time. Active alerts pulse red. Refreshes every **60 seconds** (5 min when idle).

### 🕯️ Shabbat & Holidays

Candle lighting and havdalah times from Hebcal, plus a **holiday countdown** with days-remaining in the header.

</td>
<td width="50%">

### 🌤️ Weather + UV

Split-panel layout: **right half** shows current conditions (icon + temperature + description), **left half** shows a 2×2 grid of humidity, wind, UV index, and sunrise. Below: a **12-hour temperature curve** and an enlarged **4-day forecast** with bigger icons. Data from Open-Meteo for Jerusalem.

### 📅 Family Calendar

Native **ICS parser** fetches Google Calendar data via Cloudflare Worker (→ direct → 3 CORS proxy fallback chain), renders events in a pastel-themed agenda view. Falls back to iframe embed if all ICS fetches fail. Refreshes every **15 minutes**.

### 💱 Currency Exchange

Live USD/ILS and EUR/ILS rates from open exchange rate APIs with colored trend indicators. GBP removed; layout optimized for 2-item display.

### 💪 Motivation

**50 curated Hebrew quotes** with smooth crossfade animation. No network needed — purely static. Cycles every **2 minutes** for continuous TV display.

</td>
</tr>
</table>

### ⚙️ Platform Capabilities

<table>
<tr>
<td width="50%">

- **Per-pane independent refresh** — no full-page reloads
- **Dual-layer cache** (in-memory Map + localStorage) — survives browser restart, 7-day eviction
- **Stale-while-revalidate** — shows cached data instantly, fetches in background
- **7 themes** (black, blue, matrix, amber, purple, rose, high-contrast) — press `T` to cycle
- **3 screen modes** (TV, tablet, phone) — phone mode enables full-page scroll
- **6 card entrance animations** — random direction per card, attention loop every 5 min
- **Card maximize** — click any card header to expand full-screen (FLIP animation)
- **Alerts toggle** — press `A`; off by default, persisted in localStorage
- **Auto hard-reload every 1h** — picks up HTML changes without manual refresh
- **SW auto-reload** — 10-second countdown on Service Worker update

</td>
<td width="50%">

- **Closest sun event** — weather detail shows next upcoming sunrise or sunset
- **Daily Halacha ticker** — daily halacha from Sefaria.org with reference badge
- **Animated number transitions** — smooth counting effect on prices and temperatures
- **Exponential backoff** — failed API fetches retry with increasing delays
- **GPU/CPU performance** — GPU-accelerated scroll layers, CPU-aware concurrency pool
- **Diagnostic overlay** — press `D` for per-pane status + fetch log; auto-opens on error
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

### ⚡ Quick Start — Download and Run (No Setup Required)

No Node.js, no terminal, no build step needed.

1. Go to the [**latest release**](https://github.com/RajwanYair/FamilyDashBoard/releases/latest)
2. Download **`dist.zip`** from the Assets section
3. Unzip the archive anywhere on your computer
4. Open **`index.html`** in Chrome, Edge, or Firefox

The dashboard runs entirely from local files — no server required. For the
best experience, open in **full-screen mode** (F11) and connect your display
to a large TV.

> **Note:** Some browsers restrict `file://` access for service-worker features.
> For full offline support, serve the folder via a local server:
> `npx serve dist` from the unzipped folder.

---

### 🛠️ Development Setup

```powershell
# 1. Clone the repo
git clone https://github.com/RajwanYair/FamilyDashBoard.git

# 2. Install tools from the parent directory
cd MyScripts
npm install

# 3. Start dev server
cd FamilyDashBoard
npx vite        # → http://localhost:3000/FamilyDashBoard/
```

> **Monorepo note:** `FamilyDashBoard` is a sub-project of `MyScripts/`. There is intentionally **no local `package-lock.json`** and no local `devDependencies`. All dev tools (`typescript`, `vite`, `vitest`, `eslint`, `prettier`, …) resolve from the parent `MyScripts/node_modules/`. The CI pipeline installs them via `.github/ci/install-tools.sh`.
>
> - **Never** run `npm install` inside `FamilyDashBoard/`.
> - Run `npm install` from `MyScripts/` to set up the shared toolchain.

### Available Commands

```powershell
npx vite                              # Dev server
npx tsc --noEmit                      # Type-check (0 errors)
npx eslint src tests --max-warnings 0 # Lint (0 errors, 0 warnings)
npx prettier --check .                # Format check (0 issues)
npx vitest run                        # Run all tests
npx vite build                        # Production build → dist/
npm run check                         # All quality gates
```

---

## 📡 Data Sources

<div align="center">
<img src=".github/assets/data-sources.svg" alt="Data Sources" width="85%">
</div>

All APIs are free and require no API keys. Data goes through the **Cloudflare Workers** proxy at `fdb.rajwanyair.workers.dev`. Client-side fallback chain: `direct → allorigins.win → codetabs.com → corsproxy.io`. Every response is cached in a **3-layer cache** (in-memory → localStorage → IndexedDB) with stale-while-revalidate for instant display.

| Card            | Provider               | Refresh                            |
| --------------- | ---------------------- | ---------------------------------- |
| Weather         | Open-Meteo             | 15 min                             |
| Stocks          | Yahoo Finance v8 chart | 5 min (market), 30 min (off-hours) |
| Currency        | ExchangeRate-API       | 1 hour                             |
| News            | 17 Hebrew RSS feeds    | 15 min                             |
| Calendar        | Google Calendar ICS    | 15 min                             |
| Hebrew Calendar | Hebcal API             | 6 hours                            |
| Red Alerts      | Tzeva Adom             | 60 seconds                         |
| Ticker          | Sefaria.org            | 12 hours                           |

---

## 🏗️ Architecture

<div align="center">
<img src=".github/assets/architecture.svg" alt="Architecture Diagram" width="100%">
</div>

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture guide and [docs/adr/README.md](docs/adr/README.md) for accepted architecture decisions.

### Modular TypeScript Architecture

The dashboard is built as a proper TypeScript SPA, bundled by Vite:

| Layer         | Description                                                                       |
| ------------- | --------------------------------------------------------------------------------- |
| `src/core/`   | 14 core modules — cache, fetch, state, config, registry, FdbCard base, perf, diag |
| `src/cards/`  | 12 card modules — each owns its fetch, render, and refresh schedule               |
| `src/ui/`     | 14 UI modules — theme, keyboard, maximize, header, toast, night-dimmer, ticker    |
| `src/styles/` | 13 CSS modules — `@layer tokens, themes, base, layout, components, animations`    |
| `worker/`     | Cloudflare Worker — per-provider routes, middleware, error reporting              |

### Key Patterns

```typescript
// ✅ 3-layer cache with async IDB L3
const fresh = cGet<WeatherResponse>("weather", TTL_15M);
if (fresh) {
  render(fresh);
  return;
}
const stale = await cGetAsync<WeatherResponse>("weather"); // IDB cold-start
if (stale) render(stale);

// ✅ Reactive config — no page reload needed
state.on("config.tempUnit", (unit) => renderWeather(unit));

// ✅ Priority fetch queue
const data = await enqueueFetch(() => fetchViaWorker("/api/weather"), "high");

// ✅ Hardware-adaptive rendering
applyHardwareTier(); // sets data-hw-tier on <html>, gating CSS animation fidelity
```

---

## 📂 Project Structure

```text
FamilyDashBoard/
├── src/                    # TypeScript source (Vite build → dist/)
│   ├── index.html          # App shell (RTL, CSP, minimal static markup)
│   ├── main.ts             # Startup orchestration
│   ├── cards/              # 12 card modules (news · weather · stocks · ...)
│   ├── core/               # 14 core modules (cache · fetch · state · fdb-card · ...)
│   ├── ui/                 # 14 UI modules (theme · keyboard · maximize · toast · ...)
│   ├── styles/             # 13 CSS modules (@layer tokens → animations)
│   ├── types/              # TypeScript type definitions (api · config · card)
│   └── public/             # Static assets (icon.svg, manifest.webmanifest)
├── tests/
│   ├── unit/               # Vitest — 7542+ tests / 313 suites
│   └── integration/        # Integration-level tests
├── worker/                 # Cloudflare Worker (API proxy + normalization)
│   └── src/routes/         # Per-provider route handlers
├── scripts/                # CI utilities (bundle-size, SW version checks)
├── sw.js                   # Service Worker (offline + API cache)
├── vite.config.ts          # Build configuration
├── vitest.config.ts        # Test configuration + coverage thresholds
├── tsconfig.json           # Strict TypeScript configuration
├── .github/
│   ├── workflows/          # ci.yml · deploy.yml · release.yml
│   ├── assets/             # SVG documentation graphics
│   ├── instructions/       # Copilot context + skill files
│   └── CONTRIBUTING.md     # Contributor guide
└── .vscode/
    └── settings.json       # Editor + Copilot + testing config
```

---

## 🎨 Design System

| Token              | Value                 | Usage                   |
| ------------------ | --------------------- | ----------------------- |
| `--bg-primary`     | `#060b14`             | Page background         |
| `--bg-card`        | `rgba(15,23,42,0.78)` | Card panels             |
| `--accent`         | `#60a5fa`             | Headers, borders, links |
| `--positive`       | `#34d399`             | Stock gains, sync OK    |
| `--negative`       | `#f87171`             | Stock losses, errors    |
| `--warning`        | `#fbbf24`             | Shabbat info, loading   |
| `--purple`         | `#a78bfa`             | Accents, stock colors   |
| `--pink`           | `#f472b6`             | Motivation, greeting    |
| `--orange`         | `#fb923c`             | Weather, stock accent   |
| `--cyan`           | `#22d3ee`             | Weather, news accent    |
| `--text-primary`   | `#f1f5f9`             | Main text               |
| `--text-secondary` | `#94a3b8`             | Secondary labels        |

Cards use `backdrop-filter: blur(16px)` for the glassmorphism effect. All animations use `ease-out` with staggered delays.

---

## 🏷️ Topics & Keywords

`dashboard` `family-dashboard` `tv-display` `smart-home` `hebrew` `rtl` `israel`
`typescript` `vite` `zero-dependencies` `pwa` `cloudflare-workers` `css3`
`weather` `stocks` `news-reader` `dark-theme` `real-time` `github-pages` `open-source`

> These topics are set on the [GitHub repository](https://github.com/RajwanYair/FamilyDashBoard) for discoverability.
> Search GitHub for [`topic:family-dashboard`](https://github.com/topics/family-dashboard) or [`topic:tv-display`](https://github.com/topics/tv-display) to find this project.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history. Summary in the [Roadmap](#%EF%B8%8F-roadmap) section above.

---

## 🏗️ GitHub Integration

This project leverages extensive GitHub features:

| Feature                  | Details                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **GitHub Pages**         | [Live demo](https://rajwanyair.github.io/FamilyDashBoard/) auto-deployed from `main` |
| **GitHub Actions**       | 23 workflows — CI, deploy, release, security, SBOM, scorecard, Trivy, ZAP, Playwright VR, and 14 more |
| **Issue Templates**      | YAML forms for bugs, features, API issues with auto-labeling                         |
| **Discussion Templates** | Ideas, Q&A, Show-and-Tell categories                                                 |
| **Dependabot**           | Weekly updates for GitHub Actions dependencies                                       |
| **Copilot Integration**  | 3 custom agents, 4 skills, 18 prompts, 8 instruction files, copilot-instructions.md  |
| **Community Health**     | CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, SUPPORT, CODEOWNERS                         |
| **Auto Release Notes**   | 8-category changelog via `release.yml`                                               |

---

## 🗺️ Roadmap

> Each release tags `vX.Y.Z`, builds via Vite, and deploys to GitHub Pages. The `dist/` folder is the deliverable.

### Completed

| Version      | Summary                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| v3.0–v4.4    | Glassmorphism redesign, red alerts, per-pane refresh, 5 themes, diagnostic overlay               |
| v4.5–v4.8    | Card maximize, halacha ticker, 17 news feeds, Hebrew Calendar card, stock logos                  |
| v4.9–v4.19   | Zmanim, Daf Yomi, config panel, Gold/Silver, sparklines, P&L, bookmarks, card drag-reorder       |
| v5.0–v5.1    | Corp proxy, SW v5, PWA install, offline fallback, CSS tokens, ARIA, JS constants                 |
| v7.0–v7.17   | Full TypeScript SPA, Vite 8, card registry v7, FdbCard base, CardRuntime interface, domain types |
| v8.0–v8.9    | Architecture convergence, registry-driven shells, namespaced config, IDB L3 cache               |
| v9.0–v9.19   | Cloudflare Worker routing, AES-GCM config encryption, Valibot schemas, error batching            |
| v10.0–v13.42 | TC39 Signals, hardware tiers, OTel scaffold, AI quotes, BTC card, SimHash, OWASP 120 rules       |
| v14.0–v14.14 | TypeScript 6, Vite 8, Rolldown bundler, property-test foundation (fast-check), 83 ADRs           |
| v14.15–v14.21 | Mutation testing (Stryker 89%), 7338+ tests, CSS/bundle ratchet, vendor-neutrality drills        |
| v14.22–v14.24 | Stryker 89%, FSA/D1R/ERT/CRON/OTEL property suites, 7517 tests, 83 ADRs, 136 Stryker files       |

### Upcoming

| Version   | Focus                                                                                  | Status |
| --------- | -------------------------------------------------------------------------------------- | ------ |
| v14.25.0  | Property test expansion, Stryker 90%, Bun Deploy vendor drill, docs refresh           | 🚀     |
| v14.26.0  | Stryker 91%, fly.io vendor drill, coverage ratchet, worker KV depth tests             | 📋     |
| v15.0     | Coverage 97/90/96/98, bundle ≤108 KB, Temporal Polyfill, Stryker 92%, SSRF hardening  | 📋     |

See [ROADMAP.md](docs/ROADMAP.md) for the full strategic plan and stream priorities.

> **Release convention:** Each version bump commits to `main`, runs `npm run check` (0 errors), tags `vX.Y.Z`, and deploys via GitHub Actions.

---

## � Troubleshooting

| Symptom                                         | Likely cause                             | Fix                                                           |
| ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `npm install` fails inside `FamilyDashBoard/`   | All deps live in the parent `MyScripts/` | `cd ..` then `npm install`                                    |
| A card shows the red sync indicator             | Direct fetch + 3 proxies failed          | Press **D** to open diagnostics; reload to retry              |
| Stale data after refresh                        | `cGet` hit a stale cache layer           | Press **D**, click "Clear cache", or wait for next interval   |
| Build complains about per-card warn-cap (38 KB) | A card grew past the budget              | Refactor; warn-cap is informational, hard-cap is 80 KB        |
| `npm run check` fails on `check:test-focus`     | `.only` or `.skip` left in a test        | Remove the focus/skip — both are forbidden in `main`          |
| Service worker won't update                     | Old SW is still controlling the page     | DevTools → Application → Service Workers → "Update on reload" |

---

## �🤝 Contributing

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

Built with ❤️ for the Rajwan family

<sub>Designed for a 55" TV in the living room · Always on · Always updated</sub>

</div>
