# ADR-033 — Email Workers Weekly Digest

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| **Date**     | 2026-04-23                                |
| **Status**   | Accepted                                  |
| **Deciders** | @RajwanYair                               |
| **Tags**     | worker, email, observability, ops, opt-in |

---

## Context

FamilyDashBoard accumulates operational telemetry across the week:

- CSP violations stored in `browser_reports` D1 table (ADR-028).
- Client errors stored in KV with 7-day TTL (ADR-016).
- D1 route hit counters (ADR-024).
- Workers Analytics Engine per-request data (ADR-029).

This data is currently only accessible via:

- `GET /api/reports/digest` (token-gated, manual check).
- `GET /api/metrics` (Prometheus endpoint, manual check).
- Diagnostic overlay (`D` key) in the client.

A weekly digest email surfaces anomalies proactively without requiring the operator to remember
to check dashboards. Cloudflare Email Workers (GA 2024) allow sending email from a Worker with
no SMTP server, using a verified sending domain.

This feature is **opt-in**: the digest is only sent when `DIGEST_TO_EMAIL` Worker secret is set
and `DIGEST_ENABLED === "true"`. No email is sent, no data is collected, for opt-out users.

---

## Decision

Add a weekly email digest on the Saturday 23:00 UTC cron trigger:

1. Add cron `"0 23 * * 6"` to `wrangler.toml`.
2. Worker cron handler `handleWeeklyDigest(env)` in `worker/src/routes/cron.ts`:
   - Query `browser_reports` for last 7 days grouped by type.
   - Query KV error keys for last 7 days.
   - Query D1 route hits for last 7 days.
   - Format a plaintext summary.
   - Call `env.EMAIL.send(...)` (Email Workers binding).
3. `wrangler.toml` declares `[[send_email]]` binding (conditionally active when secret set).
4. `DIGEST_TO_EMAIL` Worker secret — recipient email address.
5. `DIGEST_ENABLED` env var — `"true"` / `"false"` (default absent = disabled).

Security: email content contains **no PII** (counts only, no user-entered data, no error bodies
that might contain family names; error bodies are already stripped of query params at ingestion
per ADR-028).

---

## Consequences

### Good

- Proactive anomaly surfacing (CSP spike, error burst, route failure).
- Zero infrastructure cost (Email Workers free tier: 100 emails/day).
- Entirely opt-in; zero impact on users who don't set the secret.

### Neutral

- Adds fourth cron trigger; cron trigger total = 4.
- Email Workers require a verified sender domain — one-time setup.
- Content is plaintext only (no HTML for security reasons).

**Related ADRs**: ADR-024 (D1 telemetry), ADR-028 (Reporting API), ADR-029 (Analytics Engine).
