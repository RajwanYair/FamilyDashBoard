---
mode: agent
description: "Implement the next N roadmap sprints in priority order — commit each sprint, release at end of session."
---

# Sprint Runner — FamilyDashBoard

Implement the next **`${input:count|10}`** roadmap sprints in priority order.

> Read `docs/ROADMAP.md` before starting. Check current test baseline with:
> `npx vitest run 2>&1 | Select-Object -Last 5`
> **Tip**: Use `memory { command: "view", path: "/memories/repo/project-knowledge.md" }` to recall per-sprint facts and previous sprint commit hashes before choosing the next item.

## Sprint Execution Loop

Repeat for each sprint:

### 1. Identify

- Read `docs/ROADMAP.md` to find the next unimplemented priority item.
- Cross-check `src/cards/`, `src/core/`, `src/ui/` to avoid duplicating existing work.
- Verify the target HTML element exists: grep `id="X"` in `src/index.html` before implementing.

### 2. Implement

Choose the correct layer:

| What         | Where                | Pattern                                                                            |
| ------------ | -------------------- | ---------------------------------------------------------------------------------- |
| New card     | `src/cards/<name>/`  | `<name>.ts` + `<name>.css` + register in `src/core/card-registry.ts`               |
| Core utility | `src/core/<name>.ts` | Pure exports, no side-effects                                                      |
| UI overlay   | `src/ui/<name>.ts`   | Uses `<dialog>` + `showModal()` / `close()`                                        |
| Style        | `src/styles/*.css`   | Target correct `@layer`: tokens → themes → base → layout → components → animations |

**Rules (non-negotiable):**

- `textContent` only — no `innerHTML` with unsanitized data
- All colors via CSS custom properties (`--accent`, `--bg-*`, etc.) — no hardcoded hex
- `if (!_pageVisible) return;` guard at top of all async loaders
- All fetches: try/catch + proxy fallback (`PROXIES`) + `diagLog()`
- All API data: `cSet`/`cGet`/`cGetStale` dual-layer cache
- DOM refs in `el` object — no repeated `getElementById` calls
- `_tempUnit` = `'C'`/`'F'` (not `_useFahrenheit`)

### 3. Write / Update Tests

- File: `tests/unit/cards/<name>.test.ts` or `tests/unit/<name>.test.ts`
- Coverage thresholds: 93.2 / 84.7 / 92.0 / 94.6 (statements / branches / functions / lines)
- Run: `npx vitest run tests/unit/<target-file>.test.ts`
- Must show all tests passing with no regressions

### 4. Lint + TypeCheck

```powershell
npx eslint src tests --max-warnings 0
npx tsc --noEmit
```

Both must exit 0 before committing.

### 5. Commit

```powershell
git add -A
git commit -m "feat(sprint-NNN): <description>"
```

### 6. Next Sprint

Update todo list: mark sprint completed, next sprint in-progress.

---

## End of Session

After the final sprint, run the release checklist:

```powershell
# Full quality gate
npx vitest run
npx eslint src tests --max-warnings 0
npx tsc --noEmit
npm run build

# Version bump and release
# (see version-bump.prompt.md or release skill)
```

## Quick Reference

```typescript
// Cache pattern
const cached = cGet(key, TTL_SECONDS);
if (cached !== null) {
  render(cached);
  return;
}
const stale = cGetStale(key);
if (stale !== null) render(stale); // show stale while fetching

// Fetch with proxy fallback
async function fetchData(): Promise<void> {
  if (!_pageVisible) return;
  try {
    const data = await fetchWithTimeout(url, 8000);
    cSet(key, data);
    render(data);
    setSync(id, "ok");
  } catch (err) {
    diagLog("fetchData", err);
    setSync(id, "error");
  }
}

// Worker-first pattern
const data = isWorkerEnabled()
  ? await fetchJSONWithWorker<T>(url)
  : await fetchWithTimeout(url, 8000);
```

## Commit Convention

`feat(sprint-NNN): <domain> — <what was added>`
`fix(sprint-NNN): <domain> — <what was fixed>`
`chore: <summary>`
