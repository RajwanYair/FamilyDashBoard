---
name: update-tests
description: "Add or update tests in the FamilyDashBoard test suite. Use when: adding a new card or API (need new test coverage), changing a CSS property value (regex tests fail), changing a JS constant (STOCK_SYMBOLS, PROXIES, etc.), adding a new HTML element, fixing broken test assertions, or running and triaging test failures. Covers the Node.js built-in test runner, regex-based HTML/CSS/JS test patterns, and suite organization."
argument-hint: "Describe what changed: new card name, changed CSS property, updated constant, etc."
---

# Update Tests — FamilyDashBoard

## Infrastructure

- **File**: `tests/dashboard.test.mjs`
- **Runner**: `node --test tests/dashboard.test.mjs` (zero dependencies)
- **Current**: 1084 tests / 61 suites (`describe` blocks)
- **Method**: Reads `BestDashBoard.html` as raw string -> regex + string assertions

## How to Run

```bash
node --test tests/dashboard.test.mjs                              # all
node --test --test-name-pattern="Stock" tests/dashboard.test.mjs  # one suite
```

## Test Patterns

### Element existence
```javascript
assert.ok(html.includes('id="card-<id>"'));
```

### CSS rule value
```javascript
assert.match(html, /\.<class>\s*\{[^}]*<property>:\s*<value>/);
```

### JS constant
```javascript
assert.match(html, /STOCK_SYMBOLS\s*=\s*\[.*'\^GSPC'.*\]/s);
```

### Security check
```javascript
assert.doesNotMatch(html, /innerHTML\s*=\s*(rss|news|stock|alert)/i);
```

### Interval registration
```javascript
assert.match(html, /setInterval\s*\(\s*\(\s*\)\s*=>\s*safeLoad\(load<Name>\)\s*,\s*<N>/);
```

## Adding Tests for a New Card

Add a `describe` block:

```javascript
describe('<Name> Card', () => {
  it('card markup', () => {
    assert.ok(html.includes('id="card-<id>"'));
    assert.ok(html.includes('id="pane-<id>"'));
    assert.ok(html.includes('id="sync-<id>"'));
  });
  it('sync indicator registered', () => {
    assert.match(html, /'<id>'\s*:\s*document\.getElementById\('sync-<id>'\)/);
  });
  it('cache key prefix', () => {
    assert.match(html, /dash_v2_<service>/);
  });
  it('loader with safeLoad', () => {
    assert.match(html, /safeLoad\(load<Name>\)/);
  });
  it('refresh interval', () => {
    assert.match(html, /setInterval\s*\(\s*\(\s*\)\s*=>\s*safeLoad\(load<Name>\)\s*,\s*\d+/);
  });
});
```

Also add `'sync-<id>'` to the `syncDots` array in the "HTML Structure" suite.

## Fixing Broken Tests

| What changed | Find in test file | Fix |
|-------------|-------------------|-----|
| CSS value | `grep "<old-value>"` | Update regex to new value |
| JS constant array | Find "symbols" or constant name | Update expected array |
| Element added/removed | Find `includes('id="..."')` | Add/remove assertion |
| Version bumped | Find `Dashboard v` string | Update version string |