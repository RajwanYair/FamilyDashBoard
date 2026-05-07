/**
 * Unit tests — release-checklist.mjs
 *
 * Verifies that readReleaseChecklist returns sensible markdown content
 * from the real prompt file.
 */

import { describe, it, expect } from "vitest";
import { readReleaseChecklist } from "../../../scripts/release-checklist.mjs";

describe("readReleaseChecklist", () => {
  it("returns a non-empty string", () => {
    const result = readReleaseChecklist();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(50);
  });

  it("strips YAML frontmatter (no leading ---)", () => {
    const result = readReleaseChecklist();
    expect(result.startsWith("---")).toBe(false);
  });

  it("starts with a markdown heading", () => {
    const result = readReleaseChecklist();
    expect(result).toMatch(/^#/m);
  });

  it("contains the word 'Release'", () => {
    const result = readReleaseChecklist();
    expect(result).toMatch(/Release/i);
  });

  it("contains at least one checklist item indicator", () => {
    const result = readReleaseChecklist();
    // Checklist items are bullets or numbered lists
    expect(result).toMatch(/- |✅|1\./);
  });

  it("does not contain frontmatter key 'mode:'", () => {
    const result = readReleaseChecklist();
    // Frontmatter keys should be stripped
    expect(result).not.toMatch(/^mode:/m);
  });

  it("does not contain frontmatter key 'description:'", () => {
    const result = readReleaseChecklist();
    // Description is only in the frontmatter block, not in the body
    // (the body uses prose, not YAML key format)
    const lines = result.split("\n");
    const yamlLike = lines.filter((l) => /^description:\s*"/.test(l));
    expect(yamlLike.length).toBe(0);
  });
});
