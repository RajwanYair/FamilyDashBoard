---
description: "Run full production readiness audit: types, lint, tests, security, bundle, docs, and deploy verification."
mode: "agent"
---

# Production Readiness Audit

Run the complete production readiness checklist. Every check must pass with zero errors and zero warnings.

## Gate Checklist

### 1. Type Safety

```powershell
npx tsc --noEmit
npx tsc --project tsconfig.sw.json
```

### 2. Lint (zero warnings)

```powershell
npx eslint . --max-warnings 0 --cache --cache-strategy content
npx stylelint "src/**/*.css" --max-warnings 0
npm run lint:md
npm run lint:instructions
```

### 3. Tests

```powershell
npx vitest run
npx playwright test
```

### 4. Security

```powershell
node scripts/check-owasp.mjs
node scripts/check-trusted-types.mjs
node scripts/check-csp-wildcards.mjs
npm audit --audit-level=high
```

### 5. Bundle & Performance

```powershell
node scripts/check-bundle-size.mjs
node scripts/check-benchmark.mjs
```

### 6. Supply Chain

```powershell
node scripts/check-actions-pinned.mjs
node scripts/check-npm-ignore-scripts.mjs
node scripts/check-reproducible.mjs --dry-run
```

### 7. Documentation

```powershell
node scripts/check-adr-index.mjs
node scripts/check-mermaid.mjs
node scripts/check-reading-level.mjs
```

### 8. Clean Workspace

- No generated files in workspace root
- No `eslint-disable` comments
- No `@ts-ignore` or `@ts-expect-error`
- No dead exports (`node scripts/check-dead-exports.mjs --fail-on-dead`)

## Report Format

| Gate          | Status | Details          |
| ------------- | ------ | ---------------- |
| Types         | ✅/❌  | 0 errors         |
| Lint          | ✅/❌  | 0 warnings       |
| Tests         | ✅/❌  | X passed, 0 fail |
| Security      | ✅/❌  | All checks green |
| Bundle        | ✅/❌  | Under budget     |
| Supply Chain  | ✅/❌  | Pinned + signed  |
| Documentation | ✅/❌  | ADRs indexed     |
| Clean         | ✅/❌  | No debris        |

### Verdict: READY / NOT READY
