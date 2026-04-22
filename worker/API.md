# FamilyDashBoard Worker — API Reference

> Worker version: v9.2.0
> Base URL: `https://fdb.rajwanyair.workers.dev`
> All responses include CORS headers (`Access-Control-Allow-Origin: *`).
> Error format: `{ "ok": false, "code": "FDB-0xx", "message": "...", "status": N }`

---

## Data Routes

### `GET /weather`

Proxy to [Open-Meteo](https://open-meteo.com/). Returns current conditions, 8-day forecast, and hourly data.

**Query Parameters:**

| Parameter | Required | Description                    |
| --------- | -------- | ------------------------------ |
| `lat`     | ✅       | Latitude (float, -90 to 90)    |
| `lon`     | ✅       | Longitude (float, -180 to 180) |

**Cache TTL:** 30 minutes

**Example:** `/weather?lat=31.77&lon=35.22`

---

### `GET /currency`

Proxy to [Open Exchange Rates](https://open.er-api.com/) — USD base rates.

**Query Parameters:** none

**Cache TTL:** 1 hour

**Example:** `/currency`

---

### `GET /hebcal`

Proxy to [Hebcal Shabbat API](https://www.hebcal.com/shabbat). Returns candle-lighting, havdalah, and Parasha for a city.

**Query Parameters:**

| Parameter   | Required | Description                                    |
| ----------- | -------- | ---------------------------------------------- |
| `geonameid` | ✅       | Geonames city ID (e.g. `281184` for Jerusalem) |

**Cache TTL:** 6 hours

**Example:** `/hebcal?geonameid=281184`

---

### `GET /hebcal/holidays`

Proxy to Hebcal Hebrew calendar holidays for a full Jewish year.

**Query Parameters:**

| Parameter | Required | Description              |
| --------- | -------- | ------------------------ |
| `year`    | ✅       | Gregorian year (integer) |

**Cache TTL:** 24 hours

**Example:** `/hebcal/holidays?year=2026`

---

## Feed Routes

### `GET /stocks`

Proxy to [Yahoo Finance Chart API](https://finance.yahoo.com/) for a single symbol.

**Query Parameters:**

| Parameter | Required | Description                                                              |
| --------- | -------- | ------------------------------------------------------------------------ |
| `symbol`  | ✅       | Ticker symbol (e.g. `AAPL`, `^GSPC`). Max 10 chars, alphanumeric + `.^-` |

**Cache TTL:** 5 minutes
**KV stale fallback:** Yes — serves last cached value with `stale: true` when Yahoo is unreachable (24 h TTL in KV)

**Example:** `/stocks?symbol=AAPL`

---

### `GET /news`

Proxy to an RSS/Atom feed URL. Origin must be on the permitted allowlist.

**Query Parameters:**

| Parameter | Required | Description                                    |
| --------- | -------- | ---------------------------------------------- |
| `url`     | ✅       | Full HTTPS URL of the RSS feed (`https://...`) |

**Allowed Origins:** `ynet.co.il`, `mako.co.il`, `haaretz.co.il`, `walla.co.il`, `kan.org.il`, `n12.co.il`, `rotter.net`, `globes.co.il`, `calcalist.co.il`, `maariv.co.il`

**Cache TTL:** 15 minutes

**Example:** `/news?url=https://www.ynet.co.il/Integration/StoryRss2.xml`

---

### `GET /alerts`

Proxy to [tzevaadom.co.il](https://www.tzevaadom.co.il/) rocket alert history (IDF Home Front Command data).

**Query Parameters:** none

**Cache TTL:** 1 minute (real-time data)
**KV stale fallback:** Yes — serves last cached alerts with `stale: true` when upstream fails (1 h TTL in KV)

**Response envelope (via `workerEnvelope`):**

```json
{
  "data": [ ...alert objects ],
  "provider": "tzevaadom",
  "stale": false,
  "ts": 1720000000
}
```

**Example:** `/alerts`

---

### `GET /calendar`

Proxy to a Google Calendar or CalDAV feed URL. Origin must be on the calendar allowlist.

**Query Parameters:**

| Parameter | Required | Description                     |
| --------- | -------- | ------------------------------- |
| `url`     | ✅       | Full HTTPS URL of the iCal feed |

**Cache TTL:** 15 minutes

---

### `GET /sefaria/calendar`

Proxy to the [Sefaria](https://www.sefaria.org/) daily learning calendar (Daf Yomi, Parasha, etc.).

**Query Parameters:** none

**Cache TTL:** 6 hours

**Example:** `/sefaria/calendar`

---

### `GET /sefaria/text`

Proxy to a Sefaria text endpoint.

**Query Parameters:**

| Parameter | Required | Description                              |
| --------- | -------- | ---------------------------------------- |
| `ref`     | ✅       | Sefaria text reference (e.g. `Psalms.1`) |

**Cache TTL:** 24 hours

**Example:** `/sefaria/text?ref=Psalms.1`

---

### `GET /crypto`

Proxy to [CoinGecko](https://www.coingecko.com/) simple price API. Only `bitcoin` is supported.

**Query Parameters:**

| Parameter       | Required | Description                                     |
| --------------- | -------- | ----------------------------------------------- |
| `ids`           | ✅       | Must be `bitcoin`                               |
| `vs_currencies` | ❌       | Comma-separated currency codes (default: `usd`) |

**Cache TTL:** 5 minutes
**KV stale fallback:** Yes — serves last cached price with `stale: true` when CoinGecko is unreachable (24 h TTL in KV)

**Example:** `/crypto?ids=bitcoin&vs_currencies=usd,ils`

---

## Error Codes

| Code    | HTTP Status | Meaning                                              |
| ------- | ----------- | ---------------------------------------------------- |
| FDB-070 | 502         | Upstream HTTP error (non-2xx from external API)      |
| FDB-071 | 504         | Upstream timeout                                     |
| FDB-072 | 502         | JSON or XML parse failure                            |
| FDB-073 | 500         | Internal worker error (unexpected)                   |
| FDB-080 | 400         | Missing or invalid `lat` / `lon` parameters          |
| FDB-081 | 400         | Missing or invalid `geonameid` parameter             |
| FDB-082 | 400         | Missing, invalid, or unsupported `symbol` parameter  |
| FDB-083 | 400         | Missing, invalid, or non-allowlisted `url` parameter |
| FDB-084 | 400         | Missing or invalid `year` parameter                  |
| FDB-085 | 400         | `ids` parameter must be `bitcoin`                    |
| FDB-086 | 400         | Missing `ref` parameter for Sefaria text             |
| FDB-087 | 403         | News feed origin not on allowlist                    |
| FDB-088 | 403         | Calendar origin not on allowlist                     |

---

## KV Stale Fallback

Several routes serve a cached copy from Cloudflare KV when the upstream API is unreachable.
The response envelope includes `"stale": true` and the provider field is suffixed with `-kv-stale`.

| Route       | KV key pattern         | KV TTL | Stale provider label  |
| ----------- | ---------------------- | ------ | --------------------- |
| `/stocks`   | `stocks:SYMBOL`        | 24 h   | `yahoo-kv-stale`      |
| `/alerts`   | `alerts:tzevaadom`     | 1 h    | `tzevaadom-kv-stale`  |
| `/crypto`   | `crypto:bitcoin:CURRS` | 24 h   | `coingecko-kv-stale`  |
| `/weather`  | `weather:LAT:LON`      | 30 min | `open-meteo-kv-stale` |
| `/currency` | `currency:usd`         | 1 h    | `er-api-kv-stale`     |

Clients detect stale responses via the `stale` field in the `workerEnvelope` and render a
stale-data badge in the card header. See [ADR-013](../docs/adr/ADR-013-kv-stale-cache.md).

---

## CORS Policy

All routes return:

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

`OPTIONS` pre-flight requests are handled automatically by the routing layer.

---

## Rate Limiting

No per-client rate limiting is enforced at the worker level. Upstream APIs have their own limits:

- Open-Meteo: generous free tier, no key required
- Open Exchange Rates: 1 000 requests/month on free tier
- Hebcal: no public rate limit documented
- Yahoo Finance: unofficial endpoint, may throttle
- News feeds: subject to individual publisher robots.txt
