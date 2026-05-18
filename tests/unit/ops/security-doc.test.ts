/**
 * Unit tests — docs/security.md SRI + SLSA provenance section
 *
 * Verifies that:
 *   - docs/security.md contains the SRI policy section (§11)
 *   - SRI section explains that SRI is N/A for the bundled build
 *   - SLSA provenance controls table is present
 *   - CI workflow enforces check:adr and no-external-script checks
 *
 * These are structure/content tests run from the raw source files —
 * no DOM or network needed.
 *
 * / */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");

let secDoc = "";
let ciYaml = "";

beforeAll(() => {
  secDoc = readFileSync(resolve(ROOT, "docs", "security.md"), "utf8");
  ciYaml = readFileSync(resolve(ROOT, ".github", "workflows", "ci.yml"), "utf8");
});

// ── docs/security.md: SRI section ────────────────────────────────────────────

describe("docs/security.md: SRI policy ", () => {
  it("contains SRI Policy section heading", () => {
    expect(secDoc).toMatch(/##\s+\d+\.\s+.*SRI/i);
  });

  it("explains that SRI is N/A for bundled build", () => {
    expect(secDoc).toMatch(/not required|N\/A/);
    expect(secDoc).toMatch(/IIFE|bundled/i);
  });

  it("documents the no-CDN policy rule", () => {
    expect(secDoc).toMatch(/script src|CDN/i);
  });

  it("references the ESLint rule that enforces no CDN references", () => {
    expect(secDoc).toMatch(/no-external-script/);
  });
});

// ── docs/security.md: SLSA provenance table ──────────────────────────────────

describe("docs/security.md: SLSA provenance controls ", () => {
  it("contains SLSA section", () => {
    expect(secDoc).toMatch(/SLSA/i);
  });

  it("mentions dependency pinning control", () => {
    expect(secDoc).toMatch(/Dependabot|dependency pinning/i);
  });

  it("mentions npm audit control", () => {
    expect(secDoc).toMatch(/npm audit/i);
  });

  it("references ADR-027 for SBOM upgrade path", () => {
    expect(secDoc).toMatch(/ADR-027/);
  });
});

// ── CI workflow: adr-index check ──────────────────────────────────────────────

describe("CI workflow: check:adr in ci.yml ", () => {
  it("ci.yml runs check-adr-index.mjs", () => {
    expect(ciYaml).toMatch(/check-adr-index/);
  });
});
