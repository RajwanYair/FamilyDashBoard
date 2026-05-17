# ADR-082: Bun Deploy Vendor-Neutrality Drill — Static-Analysis Pass

| Field        | Value                                                         |
| ------------ | ------------------------------------------------------------- |
| **Date**     | 2026-05-17                                                    |
| **Status**   | Accepted                                                      |
| **Deciders** | @RajwanYair                                                   |
| **Tags**     | infra, vendor, bun, cloudflare, portability, v14.25.0         |
| **Related**  | ADR-031 (vendor-neutrality drill), ADR-003 (Worker-first API) |

---

## Context

ADR-031 mandates an annual vendor-neutrality drill before each major version tag in
the rotation: **Deno Deploy → Bun Deploy → fly.io → repeat**.

- v14.22.0: fly.io drill — PASS (0/6 CF APIs detected)
- v14.23.0: Deno Deploy drill — PASS (0/6 CF APIs detected)
- v14.25.0 (this ADR): **Bun Deploy** — second in the second rotation cycle

`docs/adr/vendor-drill-log.md` (v14.25.0 entry) records the full results.

## Decision

**Gate PASSES.** Bun Deploy static-analysis portability drill completed for v14.25.0.
0/6 Cloudflare-specific APIs detected by `node scripts/check-vendor-neutrality.mjs --gate`.

Worker code remains vendor-neutral by static analysis:

| API                | Portability Risk | Bun Deploy Equivalent                                                  |
| ------------------ | ---------------- | ---------------------------------------------------------------------- |
| Workers KV         | LOW              | `bun:sqlite` in-process (dev) + external Redis/Upstash (prod) via HTTP |
| D1 Database        | MEDIUM           | `bun:sqlite` native driver — schema migrations are vanilla SQL         |
| Durable Objects    | HIGH             | No native equivalent. BroadcastChannel + SQLite for ephemeral state.   |
| Analytics Engine   | LOW              | `structuredClone` + `fetch` to OTLP endpoint — removable               |
| Email Routing      | LOW              | Resend SDK (1 call site in `cron.ts`) — trivial swap                   |
| CF runtime globals | LOW              | `globalThis.caches` stub for SW side — client-only, no runtime risk    |

Hono HTTP framework: fully compatible with Bun via `bun serve` with zero adapter changes
(`Hono` compiles to standard `Request`/`Response`).

Valibot schemas: pure TypeScript, zero CF dependency — fully portable.

### Re-trigger conditions

The next vendor-neutrality drill is **fly.io** before `git tag v15.0.0` (third in rotation).

## Consequences

- Worker architecture remains Cloudflare-first as per ADR-003.
- No production changes. The drill branch is discarded.
- Bun's `bun:sqlite` driver alignment with D1 makes it the lowest-friction alternative
  after Deno Deploy's `Deno.openKv()`.
- Durable Objects remain the sole HIGH-risk portability item — isolated in
  `worker/src/durable-objects/` as designed.
