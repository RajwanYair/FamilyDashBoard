# ADR-041 — CSP `https://*.intel.com` Wildcard Narrowing Plan

| Field      | Value                            |
| ---------- | -------------------------------- |
| Date       | 2026-04-28                       |
| Status     | Accepted (Plan)                  |
| Sprint     | 133              |
| Supersedes | n/a                              |
| Related    | ADR-018 (CSP), Roadmap item #25  |

## Context

The production CSP `connect-src` directive currently includes
`https://*.intel.com` to allow developers behind the Intel corporate proxy to fetch
through internal API mirrors when the public origins are blocked at the corporate
egress (see / v13.13.1 changelog).

`*.intel.com` is broad: it grants subdomain-wildcard access to **any** future host
under `intel.com`, including marketing, ad-tech, and CDN subdomains over which we
exercise no control. While the value to corp-proxy devs is real, the wildcard's blast
radius is larger than the value justifies on the long term.

## Decision

Adopt a phased narrowing plan for `https://*.intel.com`:

### Phase 1 — Inventory (this ADR)

Document, in this file, the **exact set of intel.com subdomains we have observed
the dashboard fetching through** in the last 30 days of corp-network use:

| Subdomain                   | Purpose                                  | First seen |
| --------------------------- | ---------------------------------------- | ---------- |
| `proxy-dmz.intel.com`       | corp HTTPS forward proxy                 | 2025-Q4    |
| `proxy-prc.intel.com`       | corp HTTPS forward proxy (Asia)          | 2025-Q4    |
| `proxy-chain.intel.com`     | fallback HTTPS proxy                     | 2026-Q1    |

(Add to this table when a new subdomain surfaces. Empty rows = no traffic in window.)

### Phase 2 — Narrow (gated)

When (a) the inventory is stable for **two consecutive quarters** AND (b) no new
subdomain has been observed for 90 days, replace the wildcard with the explicit list:

```http
connect-src 'self' ...
  https://proxy-dmz.intel.com
  https://proxy-prc.intel.com
  https://proxy-chain.intel.com
  ;
```

### Phase 3 — Removal (long-term)

When the dashboard is no longer being developed primarily on the corporate network
(or when an HSTS-aware corporate split-horizon proxy is removed), remove all
`*.intel.com` entries entirely. CSP returns to public-origin allowlist only.

## Consequences

### Positive

- Reduces XSS-amplification blast radius from "all `*.intel.com` subdomains" to a
  **finite explicit list of 3**.
- Forces a quarterly review cadence — we have to re-justify each entry.
- Aligns with OWASP Top-10 2021 A05 (Security Misconfiguration) recommendations on
  CSP source-list specificity.

### Negative

- New corp subdomains will need an explicit CSP update + redeploy — friction for the
  rare case of corp-proxy infra changes.
- Phase 2 cannot ship before two stable quarters of telemetry; this is a
  **plan-track** ADR, not an immediate code change.

### Neutral

- The corp-proxy dev experience (`docs/local-dev.md` corp-proxy quickstart, )
  is unaffected — the same hosts work; only the wildcard collapses.

## Verification

- Inventory table above is reviewed each quarter alongside the OWASP rotation in
  `.github/instructions/security-audit.instructions.md`.
- Phase 2 trigger: `gh issue` opened with title `CSP wildcard narrowing — Phase 2`
  citing this ADR and the two-quarter telemetry window.

## Quarterly review log

| Quarter | Date       | Sprint | Reviewer | New subdomains observed | Stable? | Phase-2 gate progress |
| ------- | ---------- | ------ | -------- | ----------------------- | ------- | --------------------- |
| 2026-Q2 | 2026-04-29 | 163    | self     | None                    | ✅ Yes  | **1 of 2** stable quarters |

> **Phase 2 readiness**: 1 of 2 required stable quarters completed. Re-review in 2026-Q3. If Q3 is
> also stable, open the narrowing PR replacing `https://*.intel.com` with the 3 explicit hosts above.
