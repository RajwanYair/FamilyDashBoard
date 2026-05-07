# Local Development & Verification

> FamilyDashBoard v14.4.0 · TypeScript · Vite 8 · Hebrew RTL

Three verified workflows for running and testing the dashboard locally.

---

## Prerequisites

All dev tools live in the **parent** `MyScripts/` directory:

```powershell
# Run ONCE from the parent directory
cd "C:\Users\ryair\OneDrive - Intel Corporation\Documents\MyScripts"
npm install
```

> **Never run `npm install` inside `FamilyDashBoard/`.**
> There is no `package-lock.json` here — all dependencies resolve from
> `MyScripts/node_modules/`.

---

## Workflow 1 — Hot-Reload Dev Server (recommended)

```powershell
cd FamilyDashBoard
npx vite
```

Open <http://localhost:5173> in Chrome.

**What you get:**

- Instant TypeScript compile (esbuild in memory)
- Hot module replacement on every save
- Live error overlay in the browser
- Real API calls to the Cloudflare Worker proxy (or proxies fallback)

**To stop:** `Ctrl+C` in the terminal.

---

## Workflow 2 — Production Preview Server

Use this to verify the exact production build before tagging a release.

```powershell
cd FamilyDashBoard
npm run build        # tsc -b && vite build --base /FamilyDashBoard/
npx vite preview     # serves dist/ at http://localhost:4173
```

Open <http://localhost:4173/FamilyDashBoard/>.

**Differences from Workflow 1:**

- IIFE bundle (no ES modules)
- Minified CSS + JS
- Service Worker registered from `dist/sw.js`
- All `crossorigin` attrs stripped

---

## Workflow 3 — Local `file://` Access (offline / TV)

For devices where no server is available (e.g., opening on a Smart TV USB drive):

```powershell
cd FamilyDashBoard
npm run build:local     # vite build --base ./
# Open dist/index.html directly in Chrome
Start-Process "dist\index.html"
```

**What differs from Workflow 2:**

- `<base href="./">` instead of `/FamilyDashBoard/`
- CSP meta tag stripped (file:// origin has no 'self')
- `type="module"` → plain `<script>` (Chrome CORS restriction on `file://`)
- All `/FamilyDashBoard/` absolute paths rewritten to `./`

---

## Verification Checklist

After starting any workflow, verify the following:

| Feature                 | How to check                | Expected                                                               |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------- |
| **Dashboard loads**     | Open URL                    | Dark background, card grid visible                                     |
| **Hebrew RTL**          | Check date/time card        | Hebrew date right-aligned                                              |
| **Theme switching**     | Click theme icon (top bar)  | Cycles through 6 themes: black → blue → matrix → amber → purple → rose |
| **Weather card**        | Wait 10 s                   | Shows temperature (°C or °F)                                           |
| **Stocks card**         | Wait 5 s                    | Shows INTC / NVDA / PLTR prices                                        |
| **News ticker**         | Wait 3 s                    | Scrolling Hebrew/English news                                          |
| **Config panel**        | Press `C` or click ⚙        | Slide-in panel, all card toggles visible                               |
| **Diagnostics overlay** | Press `D`                   | Shows proxy health + cache stats                                       |
| **Keyboard shortcuts**  | Press `?`                   | Shortcut list overlay appears                                          |
| **PWA install**         | Address bar                 | Browser shows installable PWA indicator                                |
| **Service Worker**      | DevTools → Application → SW | `familydashboard-vX.Y.Z` registered                                    |
| **Night dimmer**        | Set system time to 23:00+   | Screen dims automatically                                              |

---

## Quality Gate (run before every commit)

```powershell
npm run check
# Runs: tsc + tsc sw + lint + markdownlint + sw-version check + vitest
```

Expected output: all green, **4925+ tests / 159+ suites / 0 failures**.

---

## Corp-Proxy Quickstart

If you're behind a hostile corporate forward proxy (e.g. Intel, Cisco AnyConnect
with TLS-MITM) where public origins are blocked or rewritten, follow this exact
sequence:

1. **Use the dev server**, not the production build:

   ```powershell
   cd FamilyDashBoard
   npx vite
   ```

   The `stripDevCsp` Vite plugin (see `vite.config.ts`, `apply: "serve"`) removes
   the strict CSP `<meta>` tag in dev mode so corp-proxy hosts (e.g.
   `*.intel.com` — see [ADR-041](adr/ADR-041-csp-wildcard-narrowing.md)) can
   serve internal API mirrors without CSP rejection.

2. **Bypass the Service Worker on built `dist/`**: append `?nosw=1` to the URL
   to skip SW registration entirely:

   ```text
   http://localhost:4173/?nosw=1
   ```

3. **Purge a stale SW + caches** in DevTools console:

   ```js
   await __fdbUnregisterSW();
   ```

   This unregisters every FDB Service Worker and clears all FDB caches in one
   call. Reload after.

4. **Per-card "blocked by network" diagnostic**: when an upstream is firewalled,
   the affected card surfaces a non-blocking diag toast (/
   `core/diag.ts`) instead of silently spinning forever. Open `?diag=1` to
   inspect the full provider chain.

5. **CSP allowlist**: `https://*.intel.com` is currently in `connect-src` for
   corp-proxy environments. The phased narrowing plan is documented in
   [ADR-041](adr/ADR-041-csp-wildcard-narrowing.md). When you observe a new
   subdomain in the dev console, add it to the inventory table in that ADR.

---

## Troubleshooting

| Problem                       | Fix                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `npx: not found`              | Run from `MyScripts/` first: `cd ..\; npm install`                                            |
| Cards show "Loading…" forever | Cloudflare Worker may be down — check <https://github.com/RajwanYair/FamilyDashBoard/actions> |
| Blank screen on `file://`     | Use `npm run build:local`, not `npm run build`                                                |
| SW not updating               | DevTools → Application → Service Workers → "Update on reload"                                 |
| Hebrew text garbled           | Ensure `<html lang="he" dir="rtl">` is present in `src/index.html`                            |
| Behind a corporate proxy      | Dev server auto-strips CSP meta (`stripDevCsp` plugin). For built `dist/`, append `?nosw=1` to bypass the SW; in DevTools console run `await __fdbUnregisterSW()` to purge prior registrations + caches. |

---

## VS Code Tasks

All common workflows are wired as VS Code tasks (`Ctrl+Shift+B`):

- **✅ Check All** — `npm run check` (full quality gate)
- **🚀 Dev Server** — `npx vite`
- **🔬 Vitest: Run All Tests** — `npx vitest run`
- **🏗️ Build: GitHub Pages** — `npm run build`
- **🏗️ Build: Local file://** — `npm run build:local`
