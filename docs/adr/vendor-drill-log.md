# Vendor-Neutrality Drill Log — ADR-031

Records the results of each annual vendor-neutrality drill per ADR-031 before
major version tags.  Each entry covers one target runtime in the rotation:
Deno Deploy → Bun Deploy → fly.io → repeat.

---

## v14.1.0 — Static-Analysis Pass (2026-05-05)

**Target runtime this cycle**: Bun Deploy (second in rotation)

**Drill type**: Static portability assessment (no live deploy)

**Operator**: @RajwanYair

### Cloudflare-Specific APIs Re-audit

No new Cloudflare-specific APIs introduced since v14.0.0.
Sprints 430–435 added property tests, bundle ratchet, and OWASP expansion — all
pure TypeScript tooling with zero worker-layer changes.

| API | Portability Risk | In Use | Delta Since v14.0.0 | Mitigation |
| --- | --- | --- | --- | --- |
| Workers KV | MEDIUM | ✅ Yes | No change | `StorageAdapter` / `MemoryKVAdapter` intact |
| D1 Database | MEDIUM | ✅ Yes | No change | `D1Adapter` intact; `bun:sqlite` covers Bun |
| Durable Objects | HIGH | ✅ Yes | No change | Still isolated; migration spike ROADMAP §4.4 |
| Analytics Engine | LOW | ✅ Yes | No change | Removable with no functional impact |

### Bun Deploy Portability Notes

- `worker/package.json` uses `"main": "src/index.ts"` — compatible with `bun run`.
- `Hono` (HTTP framework) supports Bun's native `Bun.serve()` adapter via `@hono/node-server`.
- `Valibot` schemas are pure TypeScript — fully portable.
- `fetch()` global is built into Bun — no polyfill needed.
- `crypto.randomUUID()` and `crypto.subtle` are available in Bun >= 0.5.9.
- **Blocker**: `wrangler.toml` bindings (`KV_NAMESPACE`, `D1_DATABASE`, `DURABLE_OBJECT`) have
  no Bun equivalent. Requires adapter swap (`MemoryKVAdapter`, in-memory SQLite, WebSocket server).
- **Verdict**: Technically portable with adapter layer already in place; live build deferred to
  `drill/vendor-2026-09` branch before v15.0.0.

### Gate Result

```sh
node scripts/check-vendor-neutrality.mjs --gate
# → ❌ Gate failed: 1 unmitigated HIGH-risk API detected. (Durable Objects)
```

Same single HIGH-risk item as v14.0.0 (Durable Objects).  No regression.
Release proceeds — risk accepted as documented in v14.0.0 entry.

### Next Drill Target

**fly.io** — before `git tag v15.0.0`.

---

## v14.0.0 — Static-Analysis Pass (2026-05-30)

**Target runtime this cycle**: Deno Deploy (first entry in rotation)

**Drill type**: Static portability assessment (no live deploy — scaffolding sprint)

**Operator**: @RajwanYair

### Cloudflare-Specific APIs Detected

| API | Portability Risk | In Use | Mitigation |
| --- | --- | --- | --- |
| Workers KV | MEDIUM | ✅ Yes | `StorageAdapter` interface wraps all KV calls in `worker/src/adapters/kv.ts`; a `MemoryKVAdapter` stub covers Deno/Bun builds |
| D1 Database | MEDIUM | ✅ Yes | `D1Adapter` in `worker/src/adapters/d1.ts`; SQLite-over-fetch covers Deno; `bun:sqlite` covers Bun |
| Durable Objects | HIGH | ✅ Yes | No direct Deno/Bun equivalent; WebSocket fanout logic isolated in `worker/src/durable-objects/`; migration spike documented in ROADMAP §4.4 (DO→Partykit/Rivet fallback) |
| Analytics Engine | LOW | ✅ Yes | Pure logging — removable with no functional impact |
| Email Routing | LOW | ❌ No | Not detected in source |
| CF-specific globals (`caches`, `scheduler`) | LOW | ❌ No | Not detected in source |

### Gate Result

```sh
node scripts/check-vendor-neutrality.mjs --gate
# → ❌ Gate failed: 1 unmitigated HIGH-risk API detected. (Durable Objects)
```

**Decision**: Release proceeds because DO is isolated behind an adapter boundary
and a migration spike is tracked in the ROADMAP.  The gate result is logged here
as documented evidence; the release owner (@RajwanYair) accepts the risk.

### Live-Drill Status

Live Deno Deploy build is **deferred** to a `drill/vendor-2026-06` branch.
Full `deno task serve` + integration test run to be recorded in the next entry.

### Next Drill Target

**Bun Deploy** — before `git tag v15.0.0`.

---

<!-- Add new entries above this line in reverse-chronological order -->
