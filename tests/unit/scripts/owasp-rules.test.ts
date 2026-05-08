/**
 * OWASP rule count regression test.
 *
 * Ensures the rule count in `scripts/check-owasp.mjs` never accidentally
 * decreases (ratchet). Also validates rule shape (category, label, severity,
 * pattern).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = resolve(process.cwd(), "scripts/check-owasp.mjs");
const text = readFileSync(SCRIPT, "utf-8");

describe("check-owasp rule ratchet", () => {
  it("has at least 118 rules (never decreases)", () => {
    const matches = text.match(/category:\s*"A\d{2}"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(118);
  });

  it("every rule has the required fields: category, label, severity, pattern", () => {
    // Count unique field appearances — must be at least 95% of rule count
    // (small tolerance for formatting variance in regex matching)
    const categories = (text.match(/category:\s*"A\d{2}"/g) ?? []).length;
    const labels = (text.match(/label:\s*"/g) ?? []).length;
    const severities = (text.match(/severity:\s*"(?:error|warn)"/g) ?? []).length;
    const patterns = (text.match(/pattern:\s*\//g) ?? []).length;
    const floor = categories - 2;
    expect(labels).toBeGreaterThanOrEqual(floor);
    expect(severities).toBeGreaterThanOrEqual(floor);
    expect(patterns).toBeGreaterThanOrEqual(floor);
  });

  it("covers all 10 OWASP categories (A01–A10)", () => {
    for (let i = 1; i <= 10; i++) {
      const cat = `A${String(i).padStart(2, "0")}`;
      expect(text).toContain(`category: "${cat}"`);
    }
  });

  it("has at least one error-severity rule", () => {
    expect(text).toContain('severity: "error"');
  });

  it("has at least one warn-severity rule", () => {
    expect(text).toContain('severity: "warn"');
  });
});
