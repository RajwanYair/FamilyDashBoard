# 🔍 Error Viewer — FamilyDashBoard

![Error Viewer](../.github/assets/error-viewer.svg)

> The error viewer surfaces client-side runtime errors that were captured by the
> dashboard and persisted to Cloudflare KV by the worker. It is the primary
> debugging tool for production issues reported by family members.

---

## 📊 Overview

FamilyDashBoard runs a two-tier error pipeline:

1. **Client (`error-reporter.ts`)** — batches `window.onerror` / `unhandledrejection`
   events and POSTs them to `POST /api/errors` on the Cloudflare Worker every 5 s
   (debounced, max 20 entries per batch).
2. **Worker (`routes/errors.ts`)** — validates each entry, logs it to CF Logpush,
   and persists it to Cloudflare KV with a **7-day TTL**.
   - KV key format: `errors:YYYY-MM-DD:<8-char-hex-id>`
   - Daily cap: **1000 entries/day** (subsequent entries are still logged but not stored)
   - Daily counter key: `errors:count:YYYY-MM-DD`

---

## 📤 Exporting Errors via the API

### Endpoint

```text
GET https://fdb.rajwanyair.workers.dev/api/errors/export?token=<TOKEN>
```

### Requirements

- `ERROR_REPORTING_TOKEN` must be set as a Cloudflare Worker secret (see below).
- Requests without a valid token receive `401 Unauthorized`.
- When the token is not configured, the endpoint returns `501 Not Implemented`.

### Response

HTTP 200, `Content-Type: application/json` — an array of error entries, newest first:

```json
[
  {
    "ts": 1714000000000,
    "message": "TypeError: Cannot read properties of null (reading 'textContent')",
    "source": "src/cards/weather/weather.ts",
    "lineno": 123
  }
]
```

| Field     | Type      | Description                            |
| --------- | --------- | -------------------------------------- |
| `ts`      | `number`  | Unix timestamp (ms) of the error       |
| `message` | `string`  | Error message (truncated to 500 chars) |
| `source`  | `string?` | Source file where the error occurred   |
| `lineno`  | `number?` | Line number in the source file         |

### Setting the Token

```sh
cd worker
npx wrangler secret put ERROR_REPORTING_TOKEN
# Paste your secret value at the prompt
```

Choose a long random token (e.g. `openssl rand -hex 32`).
The same value is used in the `?token=` query parameter.

---

## 🖥️ Local Diagnostic Snapshot (`Ctrl+Shift+E`)

For quick diagnosis without the API, press **`Ctrl+Shift+E`** on the dashboard.
This exports a JSON file containing:

- The in-memory `diagLog` buffer (last ~200 entries from the current session)
- Provider health status for all 11 cards
- Config snapshot (redacted)
- Browser + platform info

Share this file with the developer for support.

---

## ☁️ Cloudflare Logpush (Live Tail)

All error entries are also written to the Worker's `console.error` stream.
For real-time monitoring:

```sh
cd worker
npx wrangler tail --format=pretty
# Filter for FDB errors:
npx wrangler tail --format=json | jq 'select(.logs[].message[] | contains("[FDB-error]"))'
```

---

## 📈 Daily Error Count

To check how many errors were stored today without listing all entries:

```sh
# Replace <TOKEN> with your ERROR_REPORTING_TOKEN
curl "https://fdb.rajwanyair.workers.dev/api/errors/export?token=<TOKEN>" | jq 'length'
```

KV also stores a counter at `errors:count:YYYY-MM-DD`. You can read it via the
Cloudflare dashboard (**Workers → KV → CACHE_KV → Filter: errors:count**).

---

## 🗓️ Retention

Error entries are stored for **7 days** (Cloudflare KV `expirationTtl = 604800`).
After 7 days they are automatically evicted. There is no manual deletion endpoint.

---

## 🔏 Privacy

Error payloads contain:

- JavaScript error messages (may include variable names but no PII from our code)
- Source file names and line numbers from the compiled bundle
- A client timestamp (no IP, no user identifier, no personal data)

See [`docs/privacy.md`](privacy.md) for the full privacy policy.

---

## 🔗 See Also

- ADR-016: [Error Reporting Contract & KV Storage Model](adr/ADR-016-error-reporting.md)
- Worker route: [`worker/src/routes/errors.ts`](../worker/src/routes/errors.ts)
- Client reporter: [`src/core/error-reporter.ts`](../src/core/error-reporter.ts)
