# Privacy Notice — FamilyDashBoard

> This document describes the privacy practices of the FamilyDashBoard project.
> Plain language; no legal jargon. Updated: 2026-04-22.

---

## What data does FamilyDashBoard collect?

**Almost none.** FamilyDashBoard is a private, offline-capable PWA that you self-host on a single
household device. It has no user accounts, no sign-in, and no centralised server.

| Data                     | Where it lives                               | Shared with anyone?                     |
| ------------------------ | -------------------------------------------- | --------------------------------------- |
| Family name              | Your browser's `localStorage`                | No                                      |
| Calendar ICS URL         | Your browser's `localStorage`                | No — proxied anonymously via the worker |
| City names / coordinates | Your browser's `localStorage`                | No — proxied anonymously via the worker |
| Stock ticker symbols     | Your browser's `localStorage`                | No — proxied anonymously via the worker |
| Birthdays                | Your browser's `localStorage`                | No                                      |
| Runtime error messages   | Briefly via `POST /api/errors` to the worker | Error text only — no PII (see below)    |

---

## Error telemetry (opt-in by default in production)

When a JavaScript error occurs, FamilyDashBoard may send:

- The error message (truncated to 500 characters)
- The source file name and line number
- A timestamp

It does **not** send:

- Your family name
- Your calendar URL
- Your IP address (not stored on the worker; visible only in transient CF logs)
- Your location, device info, or browsing history

The error telemetry is best-effort and fire-and-forget. If the worker is unreachable, the data
is silently discarded. No error data is ever sold, shared with third parties, or used for
advertising.

---

## Cookies

None. FamilyDashBoard uses no cookies.

---

## Analytics

No analytics or tracking scripts are included. The project deliberately uses zero third-party
scripts to eliminate any supply-chain privacy risk.

If Cloudflare Web Analytics is enabled in a future version, it will be noted in this document.
Cloudflare Web Analytics is cookie-free and does not track individuals — it reports only
aggregate page-load metrics (LCP, FID, CLS). No PII is collected.

---

## External requests

When the dashboard loads data, it makes requests to the Cloudflare Worker
(`https://fdb.rajwanyair.workers.dev`). The worker then proxies requests to third-party APIs
(Open-Meteo, Hebcal, CoinGecko, etc.) on your behalf. Your browser **never connects directly**
to any third-party API in production — so third parties cannot see your IP address.

---

## Your rights

Since all configuration lives in your browser's `localStorage` / IndexedDB, you can delete all
data at any time by clearing the browser storage for this site. No request to an external server
is needed.

---

## Changes

This document is versioned with the codebase. Significant changes will be noted in `CHANGELOG.md`.
