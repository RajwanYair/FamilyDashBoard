/**
 * Unit tests — V13-OPS: check-release-notes.mjs
 *
 * Verifies the three pure helpers that enforce CHANGELOG.md completeness
 * before any release tag.
 */

import { describe, it, expect } from "vitest";
import {
  hasChangelogEntry,
  extractChangelogSection,
  sectionHasContent,
} from "../../../scripts/check-release-notes.mjs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CHANGELOG_FULL = `
# Changelog

## [12.9.0] - 2025-08-01

### Added
- Sprint 3: Voice-control aria-labels on all cards
- Sprint 4: Dialog heading hierarchy fixes

### Fixed
- Heading level in diagnostics dialog

## [12.8.0] - 2025-07-01

### Added
- Sparklines in stocks card
- Recurring task support

## [12.7.0] - 2025-06-01

### Fixed
- Minor bug fixes
`.trim();

const CHANGELOG_EMPTY_SECTION = `
# Changelog

## [12.9.0]

## [12.8.0] - 2025-07-01

### Added
- Something
`.trim();

const CHANGELOG_NO_VERSION = `
# Changelog

## [12.8.0] - 2025-07-01

### Added
- Something
`.trim();

// ── hasChangelogEntry ─────────────────────────────────────────────────────────

describe("hasChangelogEntry", () => {
  it("returns true when version heading exists", () => {
    expect(hasChangelogEntry(CHANGELOG_FULL, "12.9.0")).toBe(true);
  });

  it("returns true for an older version heading", () => {
    expect(hasChangelogEntry(CHANGELOG_FULL, "12.8.0")).toBe(true);
  });

  it("returns false when version heading is absent", () => {
    expect(hasChangelogEntry(CHANGELOG_FULL, "13.0.0")).toBe(false);
  });

  it("returns false for empty changelog", () => {
    expect(hasChangelogEntry("", "12.9.0")).toBe(false);
  });

  it("returns false for partial version match", () => {
    // 2.9.0 should not match 12.9.0
    expect(hasChangelogEntry(CHANGELOG_FULL, "2.9.0")).toBe(false);
  });
});

// ── extractChangelogSection ───────────────────────────────────────────────────

describe("extractChangelogSection", () => {
  it("returns the section for the given version", () => {
    const section = extractChangelogSection(CHANGELOG_FULL, "12.9.0");
    expect(section).toContain("Sprint 3");
    expect(section).toContain("Sprint 4");
  });

  it("does not include content from the next version section", () => {
    const section = extractChangelogSection(CHANGELOG_FULL, "12.9.0");
    expect(section).not.toContain("[12.8.0]");
  });

  it("returns empty string when version is not found", () => {
    expect(extractChangelogSection(CHANGELOG_FULL, "99.0.0")).toBe("");
  });

  it("returns content for the last version in the file", () => {
    const section = extractChangelogSection(CHANGELOG_FULL, "12.7.0");
    expect(section).toContain("Minor bug fixes");
  });

  it("starts with the version heading", () => {
    const section = extractChangelogSection(CHANGELOG_FULL, "12.8.0");
    expect(section).toMatch(/^\#\# \[12\.8\.0\]/);
  });
});

// ── sectionHasContent ─────────────────────────────────────────────────────────

describe("sectionHasContent", () => {
  it("returns true for a section with content lines", () => {
    const section = extractChangelogSection(CHANGELOG_FULL, "12.9.0");
    expect(sectionHasContent(section)).toBe(true);
  });

  it("returns false for an empty string", () => {
    expect(sectionHasContent("")).toBe(false);
  });

  it("returns false for a section with only the heading", () => {
    const section = "## [12.9.0]";
    expect(sectionHasContent(section)).toBe(false);
  });

  it("returns false for a section with only blank lines", () => {
    const section = "## [12.9.0]\n\n\n";
    expect(sectionHasContent(section)).toBe(false);
  });

  it("returns true for a section with a single content line", () => {
    const section = "## [12.9.0]\n- One item";
    expect(sectionHasContent(section)).toBe(true);
  });
});

// ── Integration: real CHANGELOG.md ───────────────────────────────────────────

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");

describe("real CHANGELOG.md compliance (V13-OPS)", () => {
  const changelog = readFileSync(resolve(ROOT, "CHANGELOG.md"), "utf8");
  const require = createRequire(import.meta.url);
  const pkg = require("../../../package.json") as { version: string };

  it("CHANGELOG.md has an entry for the current package version", () => {
    expect(hasChangelogEntry(changelog, pkg.version)).toBe(true);
  });

  it("the current version section has content", () => {
    const section = extractChangelogSection(changelog, pkg.version);
    expect(sectionHasContent(section)).toBe(true);
  });
});
