/**
 * V13-OPS-1: Changesets bootstrap — config validation
 *
 * Verifies .changeset/config.json is valid JSON with required fields.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configPath = resolve(__dirname, "../../../.changeset/config.json");
const raw = readFileSync(configPath, "utf-8");
const config = JSON.parse(raw) as Record<string, unknown>;

describe("Changesets — .changeset/config.json (V13-OPS-1)", () => {
  it("is valid JSON", () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it("has baseBranch set to 'main'", () => {
    expect(config.baseBranch).toBe("main");
  });

  it("has access set to 'restricted' (no registry publish for static PWA)", () => {
    expect(config.access).toBe("restricted");
  });

  it("has commit field (boolean)", () => {
    expect(typeof config.commit).toBe("boolean");
  });

  it("has changelog field (string)", () => {
    expect(typeof config.changelog).toBe("string");
  });

  it("has ignore array (empty by default)", () => {
    expect(Array.isArray(config.ignore)).toBe(true);
  });

  it("has linked array", () => {
    expect(Array.isArray(config.linked)).toBe(true);
  });

  it("has fixed array", () => {
    expect(Array.isArray(config.fixed)).toBe(true);
  });
});

describe("Changesets — package.json scripts (V13-OPS-1)", () => {
  const pkgPath = resolve(__dirname, "../../../package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { scripts: Record<string, string> };

  it("defines 'changeset' script", () => {
    expect(pkg.scripts["changeset"]).toBeDefined();
  });

  it("defines 'changeset:add' script", () => {
    expect(pkg.scripts["changeset:add"]).toBeDefined();
  });

  it("defines 'changeset:version' script", () => {
    expect(pkg.scripts["changeset:version"]).toBeDefined();
  });

  it("defines 'changeset:publish' script", () => {
    expect(pkg.scripts["changeset:publish"]).toBeDefined();
  });
});
