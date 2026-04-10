---
name: update-tests
description: "Add or update tests in the FamilyDashBoard test suite. Use when: adding a new card or API (need new test coverage), changing a CSS property value (regex tests fail), changing a JS constant (STOCK_SYMBOLS, PROXIES, etc.), adding a new HTML element, fixing broken test assertions, or running and triaging test failures. Covers the Node.js built-in test runner, regex-based HTML/CSS/JS test patterns, and suite organization."
argument-hint: "Describe what changed: new card name, changed CSS property, updated constant, etc."
---

# Update Tests — FamilyDashBoard

## When to Use
- After adding a new dashboard card or API integration
- After changing a CSS rule value (font-size, layout percentage, etc.)
- After changing a JS constant (`STOCK_SYMBOLS`, `PROXIES`, `VERSION`, etc.)
- After adding / removing HTML elements
- After a test run reports failures you need to diagnose and fix

---

## Test Infrastructure

**File**: `tests/dashboard.test.mjs`
**Runner**: `node --test tests/dashboard.test.mjs`
**Dependencies**: zero — uses Node.js `node:test` and `node:assert/strict` only
**Suites**: 44 (`describe` blocks) | **Tests**: 398 (`it` calls)

The test file reads `BestDashBoard.html` as a raw string and uses **regex** or **string contains** to assert:
- HTML element existence
- CSS rule values
- JS constant values
- Security patterns (no `innerHTML` with external data, no eval, HTTPS URLs)
- Per-pane refresh intervals

---

## How to Run Tests

```bash
# Run all tests
node --test tests/dashboard.test.mjs

# Run with verbose output
node --test --reporter=spec tests/dashboard.test.mjs

# Run a single suite by name pattern
node --test --test-name-pattern="Stock" tests/dashboard.test.mjs
```

A passing run outputs: `# tests 398 # pass 398 # fail 0`

---

## Test Patterns

### Pattern 1 — Element existence (string contains)

```javascript
it('should have <name> element', () => {
  assert.ok(html.includes('id="<element-id>"'), 'Missing <element-id>');
  assert.ok(html.includes('class="<class-name>"'), 'Missing <class-name>');
});
```

Use for: ID/class checks, sync dot IDs, card layout IDs.

### Pattern 2 — Regex match (CSS rule values)

```javascript
it('should have correct <property> on <selector>', () => {
  assert.match(
    html,
    /\.<css-class>\s*\{[^}]*<property>:\s*<value>/,
    '<selector> <property> should be <value>'
  );
});
```

**Critical**: when you change a CSS value (e.g. `font-size: 2em → 1.8em`), the test regex must also be updated.

Example — matching `font-size: 2em` on `.wx-icon`:
```javascript
assert.match(html, /\.wx-icon\s*\{[^}]*font-size:\s*2em/);
```

### Pattern 3 — JS constant value

```javascript
it('STOCK_SYMBOLS should contain ^GSPC', () => {
  assert.match(html, /STOCK_SYMBOLS\s*=\s*\[.*'\^GSPC'.*\]/s);
});

it('PROXIES should have at least 3 entries', () => {
  const match = html.match(/const PROXIES\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(match, 'PROXIES not found');
  const count = (match[1].match(/https:\/\//g) || []).length;
  assert.ok(count >= 3, `Expected 3+ proxies, got ${count}`);
});
```

### Pattern 4 — Security check

```javascript
it('should not use innerHTML with external API data', () => {
  // Spot-check: no innerHTML = rssText or similar
  assert.doesNotMatch(html, /innerHTML\s*=\s*(rss|news|stock|alert)/i);
});
```

### Pattern 5 — Interval registration

```javascript
it('<name> refresh interval should be <N>ms', () => {
  assert.match(
    html,
    /setInterval\s*\(\s*\(\s*\)\s*=>\s*safeLoad\(load<Name>\)\s*,\s*<N>/,
  );
});
```

---

## Adding Tests for a New Card

Add a new `describe` block at an appropriate section in the file:

```javascript
describe('<Name> Card', () => {
  it('should have <name> card markup', () => {
    assert.ok(html.includes('id="card-<id>"'), 'Missing card-<id>');
    assert.ok(html.includes('id="pane-<id>"'), 'Missing pane-<id>');
    assert.ok(html.includes('id="sync-<id>"'), 'Missing sync-<id>');
  });

  it('should register sync indicator', () => {
    assert.match(html, /'<id>'\s*:\s*document\.getElementById\('sync-<id>'\)/);
  });

  it('should use dash_v2_ cache key prefix', () => {
    assert.match(html, /dash_v2_<service>/);
  });

  it('should register loader with safeLoad', () => {
    assert.match(html, /safeLoad\(load<Name>\)/);
  });

  it('should have refresh interval', () => {
    assert.match(
      html,
      /setInterval\s*\(\s*\(\s*\)\s*=>\s*safeLoad\(load<Name>\)\s*,\s*\d+/,
    );
  });
});
```

Also add the new `sync-<id>` to the "all sync dots" test near the top of `HTML Structure`:
```javascript
const syncDots = [
  // ... existing ...
  'sync-<id>',
];
```

---

## Fixing Broken Tests After CSS/JS Changes

### CSS property value changed
Find the test by: `grep_search pattern: "<old-value>" in tests/dashboard.test.mjs`
Update the regex to match the new value.

### Constant array changed (e.g. STOCK_SYMBOLS)
The "all symbols" test iterates the array. If you added/removed a symbol:
```javascript
// In tests/dashboard.test.mjs — find "stock tiles" test
const symbols = ['^GSPC', '^VIX', 'AAPL', ...]; // update this array
```

### Version string changed
```javascript
// Find and update:
assert.match(html, /VERSION\s*=\s*'v<NEW>'/);
```

### New element added / existing removed
Add or remove `assert.ok(html.includes('id="..."'))` in the appropriate suite.

---

## Suite Organization (current 44 suites)

| # | Suite name | What it covers |
|---|-----------|---------------|
| 1 | HTML Structure | DOCTYPE, RTL, charset, layout, elements |
| 2 | CSS Themes | 5 theme vars, glassmorphism, card CSS |
| 3 | Security | No eval, no unsafe innerHTML, HTTPS |
| 4 | JavaScript | Constants, cache functions, fetch pattern |
| 5 | Weather Card | wx-* elements, layout classes |
| 6 | Stocks | STOCK_SYMBOLS, tiles, intervals |
| 7 | News / RSS | rss-scroll, feed URLs, intervals |
| 8 | Calendar | cal-agenda, iframe fallback, ICS URL |
| 9 | Currency | cur-* elements, exchange rate URLs |
| 10 | Motivation | moti-* elements, quotes array |
| …  | … | … |
| 44 | Performance | will-change, contain, GPU hints |

When adding a new suite, insert it logically — roughly matching the visual order in the dashboard (header → ticker → top row left-to-right → bottom row left-to-right → footer).

---

## Quick Reference

```bash
# Run, then grep failures
node --test tests/dashboard.test.mjs 2>&1 | grep -E "FAIL|Error"

# Count passing tests
node --test tests/dashboard.test.mjs 2>&1 | grep "# pass"
```
