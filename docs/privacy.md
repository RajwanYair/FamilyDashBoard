# 🔏 Privacy Notice — FamilyDashBoard

![Privacy Notice](../.github/assets/privacy.svg)

> This document describes the privacy practices of the FamilyDashBoard project.
> Plain language; no legal jargon. Updated: 2026-06-08.

---

## 📊 What data does FamilyDashBoard collect?

FamilyDashBoard is a private, offline-capable PWA that you self-host on a single
household device. It has no user accounts, no sign-in, and no cloud profile.
Configuration and ordinary card caches stay in the browser unless a network
request or an explicitly enabled optional Worker service needs a value.

| Data class                                                 | Local storage and default                                                                           | Recipient and trigger                                                                                                                                                                                                                                     | Retention, deletion, and logging                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Family name, members, birthdays, tasks, and countdown text | Browser localStorage/IndexedDB; no network request by default                                       | No remote recipient. A user-triggered snapshot can contain household configuration; the user controls whether the downloaded file is shared.                                                                                                              | Clear site storage or delete the snapshot file. Support snapshots redact configured calendar/custom-proxy URLs but intentionally retain household fields needed for local troubleshooting.                                                                                                       |
| Calendar URL and ICS contents                              | URL in browser storage; ICS response in the browser cache                                           | On calendar refresh, the Worker receives the configured URL in `/api/calendar?url=...` when Worker-first succeeds. Direct mode sends it to the calendar provider. If public/custom proxy fallback is enabled, that proxy receives the encoded target URL. | Worker calendar content is stale-cached in KV for 15 minutes under an opaque hash of the complete URL; browser cache follows its normal eviction rules. Clear browser storage and wait for provider/proxy/Worker TTLs. Worker request logs omit query strings; public proxies are not anonymous. |
| City name, geoname ID, latitude, and longitude             | Browser configuration                                                                               | Weather requests send coordinates to the Worker route or directly to the selected weather provider. A public proxy may receive the encoded target URL after direct failure.                                                                               | Provider/Worker cache TTLs are route-specific and documented in [data sources](data-sources.md). No household identity is attached. Clear browser storage; remote cache entries expire automatically.                                                                                            |
| Stock and currency symbols                                 | Browser configuration and card cache                                                                | The Worker or direct provider receives the requested symbol/pair during refresh. Symbols are not written to request logs or Analytics Engine; route paths and status are recorded when telemetry bindings are enabled.                                    | Browser cache eviction and provider/Worker TTLs apply. Clear browser storage; no per-household server profile is created.                                                                                                                                                                        |
| Background image URLs                                      | Browser configuration                                                                               | When the Worker is enabled, the R2 asset route receives the configured HTTPS URL during image rotation and the allowlisted image origin receives the fetch. Otherwise the browser requests the image directly.                                            | R2 may retain a hashed object until operator cleanup; clearing local configuration stops future requests but cannot delete a remote public cache. The Worker logs only the route path and records only asset host/length in the optional trace span.                                             |
| Web Vitals                                                 | Not persisted in the browser beyond the in-memory page measurement                                  | After 30 seconds, or when the page becomes hidden, the Worker receives numeric vitals through `POST /api/errors` when Worker-first is enabled.                                                                                                            | KV entries expire after 7 days and are capped at 1000 entries/day. Worker console logs contain the numeric batch only. There is no user identity.                                                                                                                                                |
| Browser Reporting API reports                              | Browser-generated and optional; no dashboard configuration fields                                   | Browsers may send CSP/deprecation/intervention reports to `POST /api/reports` when the endpoint is configured. The Worker stores a sanitized report in D1 only when the DB binding is enabled.                                                            | D1 rows are pruned after 30 days. The digest is token-gated. Query strings are removed from URLs and URL-bearing report fields are redacted before storage; request logs omit query strings.                                                                                                     |
| Route metrics and health probes                            | Worker-side operational storage only                                                                | When provisioned, Analytics Engine receives method, normalized route, environment, and status; D1 receives route-hit/day and latency aggregates. Synthetic probes use fixed public targets and never receive household configuration.                     | Route hits are retained for 30 days; latency samples for 7 days. Metrics export is token-gated. Delete D1 datasets or disable the optional binding through the operator procedures in `worker/README.md`.                                                                                        |
| Workers AI prompts and outputs                             | No browser persistence unless the card cache stores the returned card data                          | Only when `AI_ENABLED=true` and the relevant opt-in card is enabled. Current prompts contain generic news/date/season text, not family configuration.                                                                                                     | News/motivation results expire from KV after 1 hour; synthesis after 4 hours. Disable `AI_ENABLED` to fail closed; KV expiry or operator deletion removes cached results.                                                                                                                        |
| Web Push subscription                                      | Not currently created by the default client flow; feature is disabled unless explicitly provisioned | If a separately deployed client opts in while `VAPID_ENABLED=true`, the Worker receives the browser PushSubscription and stores it in KV.                                                                                                                 | Subscription entries expire after 90 days, and `DELETE /api/push/subscribe` removes one endpoint. Push send is token-gated. The endpoint and transient request IP are visible to the Worker provider.                                                                                            |

---

## 📡 Error and performance telemetry

The default client currently schedules a Web Vitals report, not a runtime-error
upload. Runtime errors remain in a bounded in-memory diagnostics buffer unless
another integration explicitly calls the reporter. If a caller does use
`POST /api/errors`, the client and Worker:

- truncate messages to 500 characters;
- remove query strings from URL-bearing messages and sources;
- cap each request at 20 entries; and
- retain accepted entries in KV for 7 days, subject to the daily cap.

The Worker receives the source and line number supplied by the caller. It does
not intentionally receive:

- Your family name
- Your configuration or calendar contents
- A persistent IP address (the address can be visible in transient Cloudflare
  request logs used for rate limiting)
- Browsing history

Telemetry is best-effort and fire-and-forget. If the Worker is unreachable, the
client discards the batch. No telemetry is sold or used for advertising.

---

## 🍪 Cookies

None. FamilyDashBoard uses no cookies.

---

## 📊 Analytics

No client analytics or tracking scripts are included. The optional Worker
Analytics Engine integration records aggregate route/method/status data, not
household values or query strings. It is disabled when the binding is absent.

If Cloudflare Web Analytics is enabled in a future version, it will be noted in this document.
Cloudflare Web Analytics is cookie-free and does not track individuals — it reports only
aggregate page-load metrics (LCP, FID, CLS). No PII is collected.

---

## 🌐 External requests

When the Worker is enabled, the dashboard sends route requests to
`https://fdb.rajwanyair.workers.dev`, which may fetch third-party APIs
(Open-Meteo, Hebcal, CoinGecko, news feeds, and others) on the dashboard's
behalf. If the Worker is unavailable, the selected route may fall back to a
direct provider request or to a configured/public CORS proxy. Direct requests
and proxy requests are not anonymous: those recipients can see the device's
network address and the request fields. A private calendar URL must not be
sent through a public proxy.

The exact path, trigger, fields, retention, and logging policy are maintained in
the [data-source inventory](data-sources.md) and the Worker
[operational guide](../worker/README.md).

---

## ⚖️ Your rights

Since all configuration lives in your browser's `localStorage` / IndexedDB, you can delete all
data at any time by clearing the browser storage for this site. No request to an external server
is needed.

---

## 📝 Changes

This document is versioned with the codebase. Significant changes will be noted in `CHANGELOG.md`.
