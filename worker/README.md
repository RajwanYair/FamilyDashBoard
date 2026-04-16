# FamilyDashBoard Worker — API Reference

> Cloudflare Worker · Edge-deployed · CORS-enabled · Rate-limited (120 req/min per IP)

Base URL: `https://family-dashboard-worker.rajwanyair.workers.dev`

---

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

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `lat` | float | `31.7683` | Latitude (-90..90) |
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

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `geonameid` | integer | `281184` (Jerusalem) | GeoNames ID |

**Cache**: 6 hours (`max-age=21600`)

**Errors**: `400` if geonameid is not digits-only

---

### `GET /api/hebcal/holidays`

Proxies Hebcal yearly holiday list.

**Parameters**:

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `year` | integer | current year | Gregorian year (2000–2100) |

**Cache**: 12 hours (`max-age=43200`)

**Errors**: `400` if year out of range

---

### `GET /api/stocks`

Proxies Yahoo Finance v8 chart data for a single ticker.

**Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sym` | string | ✅ | Ticker symbol (1–20 chars, `A-Z 0-9 . - ^`) |

**Cache**: 5 minutes (`max-age=300`)

**Errors**: `400` if sym missing or has invalid characters

---

### `GET /api/news`

Proxies RSS/Atom news feeds. Origin must be in the allowlist.

**Parameters**:

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string (HTTPS) | ✅ | Full RSS feed URL |

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

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | string (HTTPS) | ✅ | Full `.ics` URL |

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
