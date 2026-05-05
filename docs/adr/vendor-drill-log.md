# Vendor-Neutrality Drill Log — ADR-031

Records the results of each annual vendor-neutrality drill per ADR-031 before
major version tags.  Each entry covers one target runtime in the rotation:
Deno Deploy → Bun Deploy → fly.io → repeat.

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
