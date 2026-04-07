<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/banner.svg">
  <img src=".github/assets/banner.svg" alt="Family Dashboard" width="100%">
</picture>

<br/>

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/ES2020+-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-34d399?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-60a5fa?style=flat-square)
![RTL](https://img.shields.io/badge/Layout-RTL%20Hebrew-fbbf24?style=flat-square)

**A single-file, zero-dependency family dashboard for always-on TV display.**<br/>
Dark glassmorphism · Hebrew RTL · Real-time data from 6 free APIs

[Getting Started](#-getting-started) · [Features](#-features) · [Data Sources](#-data-sources) · [Architecture](#-architecture) · [Contributing](.github/CONTRIBUTING.md)

</div>

---

## 📺 Preview

<div align="center">
<img src=".github/assets/preview.svg" alt="Dashboard Preview" width="100%">
</div>

> The dashboard runs full-screen on a 55" TV in the living room, auto-refreshing every 5 minutes. Designed for comfortable reading from 3 meters away.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 📰 Live News
Auto-scrolling Hebrew news from Rotter RSS feeds, sorted newest-first with source labels. Refreshes every **1 minute**.

### 📅 Family Calendar
Embedded Google Calendar in agenda view with inverted dark theme to match the dashboard.

### 📈 Stock Tracker
6 live symbols (INTC, S&P 500, BTC, NVDA, VIX, PLTR) with **smooth bézier SVG charts** and 3-tier API fallback.

</td>
<td width="50%">

### 🌤️ Weather + UV
Current conditions, 4-day forecast, real humidity, UV index, and a **12-hour temperature curve** for Jerusalem.

### 💱 Currency Exchange
Live USD/ILS, EUR/ILS, GBP/ILS rates from open exchange rate APIs.

### 🕯️ Shabbat Times
Candle lighting and havdalah times from Hebcal, displayed in the header.

### 💪 Motivation
Online quotes (Quotable/ZenQuotes) auto-translated to Hebrew, with 20 curated offline fallbacks.

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

> **Tip:** Press **F11** for full-screen TV mode. For hot-reload during development, use VS Code + Live Server extension.

No npm. No build step. No dependencies. Just **one HTML file**.

---

## 📡 Data Sources

<div align="center">
<img src=".github/assets/data-sources.svg" alt="Data Sources" width="85%">
</div>

All APIs are free and require no API keys. CORS is handled via a proxy fallback chain (`allorigins.win → codetabs.com → direct`). Every response is cached in-memory to reduce load.

---

## 🏗️ Architecture

<div align="center">
<img src=".github/assets/architecture.svg" alt="Architecture Diagram" width="100%">
</div>

### Single-File Design

Everything lives in one file — `BestDashBoard.html` — containing:

| Layer | Description |
|-------|-------------|
| **HTML** | Semantic structure with RTL Hebrew layout |
| **CSS** | Custom properties, glassmorphism cards, responsive grid, animations |
| **JavaScript** | Async data fetching with proxy fallback, DOM caching, SVG chart generation |

### Key Patterns

```javascript
// ✅ Cache-first data loading
const cached = cGet(key);
if (cached) { render(cached); return; }

// ✅ Multi-proxy fallback for CORS
for (const proxy of PROXIES) { /* try each */ }

// ✅ Smooth bézier SVG charts
path += ` C${x1+cp},${y1} ${x2-cp},${y2} ${x2},${y2}`;
```

---

## 📂 Project Structure

```
FamilyDashBoard/
├── 📄 BestDashBoard.html          # The entire dashboard
├── 📖 README.md
├── 📋 .editorconfig
├── 🚫 .gitignore
├── 📁 .github/
│   ├── 🖼️ assets/                  # SVG graphics for docs
│   ├── 🤖 agents/                  # Copilot custom agents
│   ├── 📐 instructions/            # Copilot context files
│   ├── 💬 prompts/                 # Reusable Copilot prompts
│   ├── ⚙️ copilot/config.json      # Copilot modes
│   ├── 🔄 workflows/ci.yml        # Lint + security + Lighthouse
│   ├── 🚀 workflows/deploy.yml    # GitHub Pages deploy
│   ├── 🔒 SECURITY.md
│   ├── 🤝 CONTRIBUTING.md
│   └── 📋 PULL_REQUEST_TEMPLATE.md
└── 📁 .vscode/
    └── ⚙️ settings.json            # Editor + Copilot config
```

---

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#060b14` | Page background |
| `--bg-card` | `rgba(15,23,42,0.78)` | Card panels |
| `--accent` | `#60a5fa` | Headers, borders, links |
| `--positive` | `#34d399` | Stock gains, sync OK |
| `--negative` | `#f87171` | Stock losses, errors |
| `--warning` | `#fbbf24` | Shabbat info, loading |
| `--text-primary` | `#f1f5f9` | Main text |
| `--text-secondary` | `#94a3b8` | Secondary labels |

Cards use `backdrop-filter: blur(16px)` for the glassmorphism effect. All animations use `ease-out` with staggered delays.

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
