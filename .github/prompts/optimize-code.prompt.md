---
description: "Analyze TypeScript source for code optimization opportunities: dead code, unused imports, redundant patterns, performance improvements."
mode: "agent"
---

# Code Optimization

Analyze the TypeScript source for optimization opportunities without changing behavior.

## Scope

Focus on `src/` directory. Check for:

### Dead Code

- Unused exports (use `node scripts/check-dead-exports.mjs --fail-on-dead`)
- Unreachable code after early returns
- Unused function parameters
- Commented-out code blocks

### Import Optimization

- Unused imports (ESLint catches these, but verify)
- Circular dependencies
- Re-exports that could be direct imports

### Performance

- DOM queries that should be cached in `el` object
- Unnecessary re-renders in card update loops
- Memory leaks (event listeners without cleanup)
- Expensive operations inside intervals that could be debounced

### Pattern Improvements

- Repeated fetch patterns that could use shared utilities
- Inline magic numbers that should be named constants
- Duplicated error handling that could use `safeLoad()`

## Rules

- Never change public API signatures
- Never remove exports that tests depend on
- Always run `vscode_listCodeUsages` before removing any export
- Run tests after each optimization batch
- Keep changes minimal and focused

## Output

List optimizations as actionable items with file:line references.
