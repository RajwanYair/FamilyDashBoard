# FamilyDashBoard — Roadmap

> Always-on family TV dashboard · Hebrew RTL · 1920×1080+

![Roadmap timeline](.github/assets/roadmap.svg)

---

## Status at a Glance

| Version    | Status      | Tests                       | Highlights |
| ---------- | ----------- | --------------------------- | ---------- |
| v5.x       | ✅ Released  | 1084 mocha / 61 suites      | Single-file HTML era (archived) |
| v6.0       | ✅ Released  | 510 Vitest / 29 suites      | Full TypeScript modular rewrite |
| v6.1       | ✅ Released  | 574 Vitest / 30 suites      | Birthday chip, bookmarks, market badge, bg rotation |
| v6.2       | ✅ Released  | 849 Vitest / 31 suites      | 50+ features: portfolio, alerts, weather tabs, news search |
| v6.3       | ✅ Released  | 896 Vitest / 31 suites      | Coverage sprint: news, alerts, bg-images, config-panel |
| v6.4       | ✅ Released  | 932 Vitest / 32 suites      | Coverage sprint: stocks, hebrew-cal, ticker, calendar |
| v6.5       | ✅ Released  | 1240 Vitest / 33 suites     | Coverage sprint: cache, base-card, motivation, maximize |
| **v7.0**   | 🔄 Alpha    | 1274 Vitest / 36 suites     | Card type system, tasks card, system-info, CSS @layer, dialog migration |
| v7.1       | 📋 Planned  | —                           | Full card registry UI, drag-and-drop layout, card add/remove |
| v7.2       | 💡 Idea     | —                           | Multi-user profiles, cloud sync via Cloudflare KV |

---

## v7.0 — Alpha (in progress)

### Completed in v7.0-alpha

- [x] **Card type system** (`src/types/card.ts`): `CardDefinition`, `CardSlot`, `CardRegistryEntry`
- [x] **Card registry** (`src/core/card-registry.ts`): dynamic `import()` loader, `registerCard/getCard/listCards`
- [x] **Tasks card** (`src/cards/tasks/`): family chore board, localStorage-persisted, daily 6AM reset
- [x] **System Info card** (`src/cards/system-info/`): battery, network, timing, browser — zero network
- [x] **6th theme "Rose Night"**: deep crimson/burgundy palette
- [x] **CSS `@layer`**: explicit layer order (`tokens→themes→base→layout→components→animations`)
- [x] **CSS `@container`**: card-level inline-size container queries
- [x] **CSS `color-mix()` tokens**: `--accent-subtle`, `--bg-overlay`, `--positive-subtle`, `--negative-subtle`
- [x] **Dialog migration**: `#help-overlay` + `#diag-overlay` → `<dialog>` with `showModal()/close()/::backdrop`
- [x] **Worker-first fetch**: `fetchViaWorker<T>()` + `fetchJSONWithWorker<T>()` using Cloudflare Worker
- [x] **Security**: `renderStocksShell()` replaced `innerHTML` with `DocumentFragment` + `createElement`
- [x] **Shared npm model**: all devDeps at parent `MyScripts/`; CI uses `install-tools.sh`
- [x] **ESLint hardening**: `no-explicit-any` error, `prefer-const` error, `consistent-type-imports` + `no-unnecessary-type-assertion`
- [x] **Tests**: tasks (9), card-registry (12), worker-fetch (9) — 3 new suites

### Remaining for v7.0 release

- [ ] Card registry → HTML: dynamic `data-card-id` slots rendered by registry (replace static HTML)
- [ ] Card add/remove via config panel (registry-aware)
- [ ] Cloudflare Worker migration for all 6 API routes (complete worker-first for all cards)
- [ ] Comprehensive `fetchViaWorker` tests with mock Cloudflare env
- [ ] Final v7.0 release tagging + changelog

---

## v7.1 — Planned

- Layout drag-and-drop (column assignment via config panel, persisted to localStorage)
- Card slot persistence: per-device layout via `dash_v2_layout_*`
- Card size control: s/m/l chips in config panel
- URL-based config sharing (base64-encoded layout in `#hash`)
- **Replace hc-chore with Tasks card integration**: the old `renderChores()` hardcoded wheel (rotated by weekday % array length, stored as raw JSON in `dash_v2_chores`) has been removed. Replace with a live-synced display inside the Hebrew Calendar card that reads from the existing Tasks card store (`src/cards/tasks/`), showing today's pending/assigned tasks without duplicating state. Consider a `getTasksForToday()` bridge function, or a shared observable task store.

---

## v7.2 — Ideas / backlog

- Multi-user profiles (family members, each with own config)
- Cloudflare KV sync (sync config across devices)
- Push notifications via Web Push API + Service Worker
- Offline-first data pre-seeding via SW install event
- Card templates marketplace (community-submitted card definitions)

---

## Design Principles

| Principle | Rule |
| --------- | ---- |
| Zero dependencies | No external JS/CSS libraries or CDNs at runtime |
| Hebrew RTL | Always `dir="rtl"` in HTML; CSS logical properties where possible |
| TV-first | 1920×1080 primary; readable from 3 m; no hover-only affordances |
| Cache everything | Dual-layer (memory + localStorage); stale-while-revalidate |
| 0 lint errors | `npx eslint src tests --max-warnings 0` must pass on every commit |
| 0 TS errors | `npx tsc --noEmit` must pass on every commit |
| No suppressions | Zero `eslint-disable` / `@ts-ignore` / `@ts-expect-error` allowed |
