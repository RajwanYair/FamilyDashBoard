---
description: "Identify gaps in test coverage for a given module or card and add targeted tests to meet the 94.2%/85.4%/94.5%/95.6% thresholds (canonical source: vitest.config.ts)."
tools: ["read_file", "grep_search", "file_search", "get_errors", "create_file", "replace_string_in_file", "multi_replace_string_in_file", "run_in_terminal", "get_terminal_output", "vscode_listCodeUsages", "manage_todo_list", "tool_search", "memory", "runSubagent"]
---

# Test Coverage — FamilyDashBoard

Analyse the current test coverage for the specified module and add the minimum set of tests needed to meet the project thresholds.

## Coverage Thresholds

| Metric     | Threshold |
| ---------- | --------- |
| Statements | 94.2%     |
| Branches   | 85.4%     |
| Functions  | 94.5%     |
| Lines      | 95.6%     |

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
