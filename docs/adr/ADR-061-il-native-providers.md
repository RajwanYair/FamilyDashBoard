# ADR-061: D8 — IMS / TASE / BoI Native Sources for IL Geo Users

- **Status**: Adopt v14.0 (contract specified now; implementation in v14.0)
- **Date**: 2026-05-02 (v13.35.0 patch series)
- **Sprints**: 341
- **Related**: ADR-040 (provider-health envelope), ADR-052 (KV stale chain), ROADMAP §1.11 D8, §3 W-IMS, §3 S-TASE, §3 C-BoI

## Context

For IL-located dashboards three native authoritative sources are
strictly better than the current internationally generic providers:

| Card       | Current primary   | Authoritative IL source                 | Why                                                                            |
| ---------- | ----------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `weather`  | Open-Meteo        | **IMS (Israel Meteorological Service)** | Native forecast model, Hebrew warnings, official heatwave / khamsin advisories |
| `stocks`   | Yahoo / Stooq     | **TASE (Tel-Aviv Stock Exchange)**      | Authoritative `.TA` ticker prices, native ILS denomination, no FX round-trip   |
| `currency` | Frankfurter / ECB | **Bank of Israel**                      | Official daily ILS reference rate; legally referenced rate in IL               |

D8 in `docs/ROADMAP.md` selected these as v14.0 adoption candidates.
The challenge is that the existing card pipeline assumes a **single
adapter contract** — all providers must emit the same envelope so that
KV-stale + provider-health + the front-end are unchanged.

## Decision

**Adopt** D8 in v14.0 with a strict adapter contract. All three native
sources will be implemented as drop-in providers that satisfy the
existing `ProviderHealthEnvelope` (ADR-040). Front-end card code,
cache layer, and SW must remain unmodified.

### Adapter Contract (binding)

Every native adapter (`worker/src/providers/{ims,tase,boi}.ts`) MUST:

1. Export a single function `fetch{Provider}({geo, ticker, base})` that
   returns `Promise<ProviderHealthEnvelope<T>>` where `T` is the
   card-specific payload type already exported from `src/types/`.
2. Honor the existing **stale-while-revalidate** KV pattern:
   `cf.cache.put(key, value, { expirationTtl: 7*86400 })` with
   `swr_after_seconds` matching the card's existing TTL.
3. Emit identical `provider`, `fetched_at`, `status` (`fresh|stale|fail`),
   and `error_code` fields. No card-specific extra fields at the
   envelope level.
4. Geo-gate inside the **provider chain**, not inside the card. The
   chain order for `weather`:
   - if `geonameid ∈ IL_GEONAMES` → `ims → openmeteo → openweather`
   - else → `openmeteo → openweather`
5. Localize **once**, at the provider boundary. IMS warnings are
   Hebrew-native; the adapter passes them through untranslated.
   English UI users see the existing Open-Meteo string fallback.

### Per-Card Chain Order (v14.0)

- `weather` (IL): `ims → openmeteo → openweather`
- `stocks` (`.TA` suffix): `tase → yahoo → stooq`
- `currency` (base/quote includes ILS): `boi → frankfurter → ecb → exchangerate.host`

### Test Requirements

Each adapter MUST ship with three test files in `tests/unit/worker/providers/`:

1. `{provider}.fresh.test.ts` — happy path returns `status: 'fresh'`
2. `{provider}.stale.test.ts` — KV hit + upstream fail returns `status: 'stale'`
3. `{provider}.fail.test.ts` — KV miss + upstream fail returns
   `status: 'fail'` and the existing chain falls through correctly.

### Bundle Budget

Each adapter ≤ **2 KB gzip** in the Worker bundle (≤ 6 KB total
overhead). Worker ceiling stays at 75 KB.

## Consequences

- **Pro:** IL users get authoritative national data without changing
  card UI, SW, or KV layout.
- **Pro:** International users are unaffected — chain order falls back
  to the existing global providers.
- **Pro:** Adapter contract is enforced by ADR + tests, not by a
  TypeScript abstract class. Keeps the provider directory flat and
  greppable.
- **Con:** Three new upstream relationships: IMS API key registration
  (none required, public endpoint), TASE rate limits (60 req/min,
  fits inside the existing per-IP RL), BoI XML feed (daily refresh,
  requires XML→JSON adapter — adds ~0.5 KB).
- **Con:** Hebrew-only IMS strings appear directly in the card. The
  card already supports RTL Hebrew; no UI work needed, but the i18n
  ratchet (separate stream) excludes IMS strings as "authoritative,
  do not translate".

## Implementation Order (v14.0)

1. **C-BoI** first — smallest scope (single XML endpoint, single rate
   per day). Validates the contract.
2. **W-IMS** second — same KV pattern but multi-field payload
   (forecast + warnings + indices).
3. **S-TASE** last — needs ILS conversion cross-link to currency card,
   so depends on BoI being live.

## References

- ROADMAP §1.11 D8
- ROADMAP §3 W-IMS, S-TASE, C-BoI
- ADR-040 (provider-health envelope contract)
- ADR-052 (KV stale chain)
- IMS API: <https://ims.gov.il/he/data_gov>
- TASE API: <https://api.tase.co.il/>
- BoI exchange rates: <https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/>
