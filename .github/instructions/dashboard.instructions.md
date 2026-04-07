---
applyTo: "**/*.html"
description: "Use when: editing the dashboard HTML file. Provides coding standards for the single-file HTML/CSS/JS dashboard including RTL layout, CSS variables, API integration patterns, and DOM caching."
---

# Dashboard HTML Instructions

## Single-File Architecture

Everything lives in `BestDashBoard.html` — HTML structure, CSS styles, and JavaScript logic.

## CSS Rules

- Use CSS custom properties defined in `:root` — never hardcode colors
- Available variables: `--bg-primary`, `--bg-card`, `--accent`, `--text-primary`, `--text-secondary`, `--positive`, `--negative`
- RTL layout: `dir="rtl"`, `lang="he"` — use `border-right` for RTL accent borders
- Glassmorphism: `backdrop-filter: blur(12px)` on cards

## JavaScript Rules

- Cache DOM elements in the `elements` object at startup
- All API calls must use `try/catch` with `proxies` fallback array
- Cache every API response: `setCachedData(key, data)` / `getCachedData(key)`
- Update sync indicators: `setSyncStatus('service', 'syncing'|'success'|'error')`
- Use `textContent` for external API data, never `innerHTML` with unsanitized content
- All dates/times use `Asia/Jerusalem` timezone
- ES2020+: async/await, optional chaining (`?.`), nullish coalescing (`??`)

## Font Size Guidelines (TV-first)

- Base font: 24px
- Clock: 3.2em
- Section headers: 1.3em
- Stock prices: 1.5em
- Fact content: 1.4em
