# FamilyDashBoard Worker — API Reference

> Cloudflare Worker · Edge-deployed · CORS-enabled · Rate-limited (120 req/min per IP)

Configured Worker name: `familydashboard-api`. Verify the deployed URL in the target Cloudflare account; this repository configuration alone does not establish a live endpoint.

---

## Deployment Readiness

`npm run deploy` uses the root configuration in `wrangler.toml`, where `ENVIRONMENT` is `production`. There is no named `[env.production]` section. Do not pass `--env production` without defining that environment and its required bindings.

Before deployment:

1. Install the committed Worker dependency set with `npm ci --ignore-scripts` and run `npm run typecheck`.
2. Replace the KV/D1 placeholder IDs with provisioned resources in the intended account. Confirm all declared Durable Objects, queues, R2, Vectorize, analytics, AI permissions, and associated operating costs. Do not invent IDs or create billable services just to pass CI.
3. Configure the repository's `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets directly in GitHub settings. Never place their values in source, logs, or chat.
4. Run `npx wrangler deploy --dry-run` before the authorized deployment, then verify the actual health endpoint and rollback procedure.

API cache lifetimes are controlled by route response headers and KV TTLs, not an unsupported `[cache].default_ttl` Wrangler setting. A successful typecheck does not validate account bindings or prove deployment readiness.

## Operational budgets and safe shutdown

The Worker keeps optional services bounded and independently disableable. These
limits are operational guardrails, not a promise that a Cloudflare free tier
will absorb every workload:

| Budget                    | Current guardrail                                                                                                                              | Alert or shutdown signal                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Requests                  | 120 requests/minute/IP, with `429` and `Retry-After: 60`                                                                                       | Monitor 429 rate; reduce traffic or disable the affected optional route                                 |
| Upstream work             | 8 s timeout on dynamic news/calendar/R2 requests; synthetic provider probes cache for 5 minutes                                                | `provider-health` reports `degraded`/`down`; disable probes at the route layer if quota or terms change |
| Response memory           | RSS 1 MiB, ICS 2 MiB, R2 assets 10 MiB; oversized bodies return `413`                                                                          | Alert on repeated `413` responses; reject the provider or lower the route scope                         |
| Error storage             | 20 entries/request, 1000 persisted entries/day, 7-day KV TTL                                                                                   | `POST /api/errors` remains `204` but stops persisting after the daily cap                               |
| Browser reports           | 50 reports/request, D1 retention 30 days                                                                                                       | `POST /api/reports` truncates excess input; the daily cron prunes old rows                              |
| Telemetry                 | Route-hit counters retain 30 days; latency samples retain 7 days                                                                               | D1 failures are non-fatal; inspect `/api/metrics` with its secret                                       |
| Push                      | Disabled unless `VAPID_ENABLED=true`; subscriptions expire after 90 days and can be deleted explicitly                                         | Unset `VAPID_ENABLED` to stop registration and sending without affecting the dashboard                  |
| Workers AI                | Disabled unless `AI_ENABLED=true`; text-generation calls are cached (1 hour, or 4 hours for synthesis) and capped at 150/200/250 output tokens | Unset `AI_ENABLED` to return the documented `503 ai_disabled` fallback                                  |
| Optional telemetry/export | OTel requires both `OTEL_ENABLED=true` and an HTTPS endpoint; metrics/reports exports require separate secrets                                 | Unset the feature flag or secret to fail closed                                                         |

The synthetic provider probes use fixed public URLs and coordinates only; they
never receive household configuration. KV cache corruption or unavailability
falls back to an isolate-local five-minute snapshot, so a cache fault does not
turn each health request into a new seven-provider fan-out. The daily cron
warms only fixed, low-volume routes and deliberately excludes per-household
weather and news aggregation.

### Limit and retention drill

The repeatable local drill is:

```powershell
npm exec --no -- vitest run tests/unit/worker/middleware.property.test.ts tests/unit/worker/errors-route.property.test.ts tests/unit/worker/reports.test.ts tests/unit/worker/health-probes.test.ts
```

The expected evidence is a `429` after the configured request window, `413`
for oversized error batches, report truncation at 50 items, and one probe
batch per five-minute cache window even when KV fails.

Stored optional data has an explicit deletion path:

| Data                 | Retention/deletion walkthrough                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Client error entries | Verify the 7-day KV TTL, then use the token-gated export only for today’s review; the daily counter and entries expire automatically    |
| Browser reports      | Verify the 30-day D1 query window and run the daily prune; `pruneOldReports(db, 30)` deletes older rows                                 |
| Route telemetry      | Verify 30-day hit-counter and 7-day latency pruning; unset `METRICS_TOKEN` to disable the metrics view                                  |
| Push subscriptions   | Send `DELETE /api/push/subscribe` with the endpoint, or unset `VAPID_ENABLED`; expired subscriptions are removed after a `410` response |
| AI/probe caches      | Allow their 1-hour/4-hour and 5-minute TTLs to expire; unset `AI_ENABLED` or remove the Worker binding for immediate shutdown           |

The operational owner reviews quota errors, 429/413 rates, provider-health
failures, D1/R2/KV usage, and optional-feature flags before enabling any
additional provider or paid binding.

## Overview

The Worker acts as a secure CORS proxy and data aggregator for the FamilyDashBoard.
All routes return JSON unless otherwise noted.

**Common response headers**:

```text
Access-Control-Allow-Origin: *
X-Content-Type-Options: nosniff
Cache-Control: public, max-age=<TTL>
```

**Error response body** (all 4xx/5xx):

```json
{ "error": "Description", "param": "paramName" }
```

---

## Routes

### `GET /health`

Health check. Always returns 200.

**Response**:

```json
{ "ok": true, "status": "healthy", "ts": 1714123456789 }
```

---

### `GET /api/weather`

Proxies Open-Meteo forecast for a coordinate.

**Parameters**:

| Name  | Type  | Default   | Description           |
| ----- | ----- | --------- | --------------------- |
| `lat` | float | `31.7683` | Latitude (-90..90)    |
| `lon` | float | `35.2137` | Longitude (-180..180) |

**Cache**: 30 minutes (`max-age=1800`)

**Errors**: `400` if lat/lon out of range

---

### `GET /api/currency`

Proxies ER-API latest exchange rates (USD base).

**Parameters**: none

**Cache**: 1 hour (`max-age=3600`)

---

### `GET /api/hebcal`

Proxies Hebcal Shabbat times for a location.

**Parameters**:

| Name        | Type    | Default              | Description |
| ----------- | ------- | -------------------- | ----------- |
| `geonameid` | integer | `281184` (Jerusalem) | GeoNames ID |

**Cache**: 6 hours (`max-age=21600`)

**Errors**: `400` if geonameid is not digits-only

---

### `GET /api/hebcal/holidays`

Proxies Hebcal yearly holiday list.

**Parameters**:

| Name   | Type    | Default      | Description                |
| ------ | ------- | ------------ | -------------------------- |
| `year` | integer | current year | Gregorian year (2000–2100) |

**Cache**: 12 hours (`max-age=43200`)

**Errors**: `400` if year out of range

---

### `GET /api/stocks`

Proxies Yahoo Finance v8 chart data for a single ticker.

**Parameters**:

| Name  | Type   | Required | Description                                 |
| ----- | ------ | -------- | ------------------------------------------- |
| `sym` | string | ✅       | Ticker symbol (1–20 chars, `A-Z 0-9 . - ^`) |

**Cache**: 5 minutes (`max-age=300`)

**Errors**: `400` if sym missing or has invalid characters

---

### `GET /api/news`

Proxies RSS/Atom news feeds. Origin must be in the allowlist.

**Parameters**:

| Name  | Type           | Required | Description       |
| ----- | -------------- | -------- | ----------------- |
| `url` | string (HTTPS) | ✅       | Full RSS feed URL |

**Cache**: 15 minutes (`max-age=900`)

**Errors**:

- `400` if URL is missing, invalid, or not HTTPS
- `403` if the origin hostname is not in the allowlist

**Allowlisted origins** (19 total): `rss.ynet.co.il`, `www.mako.co.il`, `www.haaretz.co.il`, `www.jpost.com`, `feeds.bbci.co.uk`, `rss.cnn.com`, `feeds.reuters.com`, `rss.nytimes.com`, `feeds.washingtonpost.com`, `www.theguardian.com`, `rss.timesofisrael.com`, `www.calcalist.co.il`, `www.globes.co.il`, `www.hamodia.com`, `news.walla.co.il`, `www.n12.co.il`, `www.kan.org.il`, `feeds.20min.co.il`, `rss.kan.org.il`

---

### `GET /api/alerts`

Proxies Tzeva Adom (Israeli rocket alert) history.

**Parameters**: none

**Cache**: 1 minute (`max-age=60`)

---

### `GET /api/calendar`

Proxies Google Calendar ICS feeds.

**Parameters**:

| Name  | Type           | Required | Description     |
| ----- | -------------- | -------- | --------------- |
| `url` | string (HTTPS) | ✅       | Full `.ics` URL |

**Cache**: 15 minutes (`max-age=900`)

**Response**: `text/calendar` (ICS format)

**Errors**:

- `400` if URL is missing, invalid, or not HTTPS
- `403` if the origin hostname is not in the allowlist
- `502` if upstream returns non-2xx or non-ICS content

**Allowlisted origins**: `calendar.google.com`, `outlook.live.com`, `outlook.office365.com`, `ics.teamup.com`, `webcal.fi`

---

### `GET /api/sefaria/calendar`

Proxies the Sefaria daily calendar (Daf Yomi, Parashat HaShavua, etc.).

**Parameters**: none

**Cache**: 24 hours (`max-age=86400`)

---

## Rate Limiting

Each IP is limited to **120 requests per minute** (sliding window).

Exceeded requests return:

```text
HTTP 429 Too Many Requests
Retry-After: 60
```

---

## Middleware

Requests flow through:

1. **CORS preflight** — `OPTIONS` requests get 204 + access-control headers
2. **Rate limiter** — blocks IPs exceeding 120 req/min
3. **Router** — dispatches to the correct handler
4. **Request logger** — logs method, path, status, duration to `wrangler tail`

---

## Development

```bash
cd worker
npx wrangler dev        # local dev server
npx wrangler deploy     # deploy to Cloudflare
npx wrangler tail       # stream live request logs
```

See `worker/wrangler.toml` for environment config.
