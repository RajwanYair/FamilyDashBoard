---
mode: "agent"
description: "Identify gaps in test coverage for a given module or card and add targeted tests to meet the 93.7%/85.0%/94.1%/95.1% thresholds (canonical source: vitest.config.ts)."
---

# Test Coverage — FamilyDashBoard

Analyse the current test coverage for the specified module and add the minimum set of tests needed to meet the project thresholds.

## Coverage Thresholds

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 93.7%     |
| Branches   | 85.0%     |
| Functions  | 94.1%     |
| Lines      | 95.1%     |

Canonical source: `vitest.config.ts`. The thresholds ratchet upward each sprint — see Roadmap #8.

## Steps

1. Run `npx vitest run --coverage` and locate the module in the report.
2. Identify uncovered branches (look for `0x` in the lcov output or the HTML report).
3. For each uncovered branch write **one focused test** — do not write broad "smoke" tests.
4. Use `makeCacheMocks()` / `makeFetchMocks()` from `@tests/helpers` instead of hand-rolled mocks.
5. After adding tests re-run coverage and confirm the thresholds are met.

## Rules

- No `.only` or `.skip` — all tests must run in CI.
- Use `_resetForTest()` in `afterEach` instead of `vi.resetModules()`.
- Check `cGet()` / `cGetStale()` return `null` on miss — never `undefined`.
- Do not duplicate fixture data — extract to `tests/unit/fixtures/` if reused across files.
- Follow `tests.instructions.md` for all naming and structure conventions.

## Output

List each new test case added with the branch it covers.
State the before/after coverage percentage for the module.
