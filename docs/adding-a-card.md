# Adding a New Card to FamilyDashBoard

This guide walks through every step needed to add a fully functional card to the
dashboard. Follow the steps in order — each builds on the previous.

---

## 1. Plan the Card

Before writing any code decide:

- **Card ID** — lowercase kebab-case, e.g. `my-card`. This becomes the `data-card-id`
  attribute, the registry key, and the localStorage cache prefix.
- **Data source** — will data come from the Cloudflare Worker, a public API, or be
  purely local/static?
- **Refresh interval** — how often should data refresh? (common: 60 s, 300 s)
- **Tile layout** — card content must use a `display: grid` or `display: flex; flex-wrap: wrap`
  tile layout, not a plain vertical list (per rule 25).

---

## 2. Create the Card Folder

```text
src/cards/my-card/
  index.ts          ← loader: fetch, cache, render
  my-card.css       ← card-specific styles (optional)
```

---

## 3. Write the Loader (`index.ts`)

Minimal template:

```typescript
import { cGet, cSet, cGetStale } from "@/core/cache";
import { setSync } from "@/core/sync";
import { diagLog } from "@/core/diag";
import { fetchWithTimeout } from "@/core/fetch";

const CARD_ID = "my-card";
const CACHE_KEY = "my_card_data";
const CACHE_TTL = 300; // seconds

let _pageVisible = true;
export function setPageVisible(v: boolean) { _pageVisible = v; }

export async function loadMyCard(): Promise<void> {
  if (!_pageVisible) return;

  const cached = cGet<MyCardData>(CACHE_KEY, CACHE_TTL);
  if (cached !== null) { render(cached); return; }

  setSync(CARD_ID, "loading");
  try {
    const res = await fetchWithTimeout("https://api.example.com/data", 8000);
    const data = await res.json() as MyCardData;
    cSet(CACHE_KEY, data);
    render(data);
    setSync(CARD_ID, "ok");
  } catch (err) {
    diagLog(`${CARD_ID}: fetch failed`, err);
    const stale = cGetStale<MyCardData>(CACHE_KEY);
    if (stale !== null) render(stale);
    setSync(CARD_ID, "error");
  }
}

function render(data: MyCardData): void {
  const el = document.getElementById("my-card-content");
  if (!el) return;
  // Use textContent, never innerHTML with unsanitized data.
  el.textContent = data.value;
}
```

Key rules to follow:

- `cGet`/`cSet`/`cGetStale` — never roll your own cache.
- `setSync(id, state)` — not `setSyncStatus()`.
- `if (!_pageVisible) return;` at the top of every loader.
- All fetches wrapped in `try/catch` with `diagLog()`.
- `textContent` for DOM updates with external data.

---

## 4. Add the HTML Slot

Open `src/index.html` and add the card element in the correct grid region:

```html
<fdb-card data-card-id="my-card" data-label="My Card">
  <div id="my-card-content" class="tile-grid"></div>
</fdb-card>
```

The `data-card-id` value must match the registry ID exactly (kebab-case, no aliases).

---

## 5. Register the Card

Open `src/core/card-registry.ts` and register the new card:

```typescript
import { loadMyCard } from "@/cards/my-card";

registerCard({
  id: "my-card",
  label: "My Card",
  load: loadMyCard,
  intervalMs: 300_000,
});
```

---

## 6. Add CSS

In `src/cards/my-card/my-card.css` (or in `src/styles/components.css`):

```css
@layer components {
  .my-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-2);
  }
}
```

Import it in `src/main.ts` or directly in `index.ts` (Vite handles CSS imports).

---

## 7. Add Config Support (optional)

If the card has user-configurable settings:

1. Add the field(s) to `DashboardConfig` in `src/types/config.ts`.
2. Add defaults to `DEFAULT_CONFIG`.
3. Bump `configVersion` by 1.
4. Add a migration entry in `src/core/config.ts` (see ADR-009).
5. Wire the config field to the config panel in `src/ui/config-auto-render.ts`.

---

## 8. Write Tests

Create `tests/unit/cards/my-card/my-card.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCardDOM, cleanupDOM, createMockFetch, createMockCache }
  from "@tests/helpers";

describe("my-card", () => {
  beforeEach(() => cleanupDOM());
  // ...
});
```

Run: `npx vitest run tests/unit/cards/my-card/`

---

## 9. Update Documentation

- Add the card to the **Cards** table in `README.md`.
- Add a one-line entry in `CHANGELOG.md` under the `[Unreleased]` section.
- If the card introduces a new architectural pattern, consider an ADR in `docs/adr/`.

---

## 10. Validate

```powershell
npx tsc --noEmit
npx eslint src tests --max-warnings 0
npx vitest run
npx vite build
node scripts/check-bundle-size.mjs
node scripts/check-sw-version.mjs
```

All must pass with 0 errors, 0 warnings, 0 test failures before committing.
