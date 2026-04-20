/**
 * Stream D2.8 — localStorage discipline audit
 *
 * Rules enforced:
 *   1. No src/ file (outside core/cache.ts) calls localStorage.setItem with a
 *      raw "dash_v2_" string literal — all data cache writes must go through
 *      cSet / cSetAsync in core/cache.ts.
 *   2. No card file (src/cards/**) calls localStorage.setItem with a raw
 *      string literal at all (must use named LS_* constants).
 *   3. The LS_PREFIX constant in core/constants.ts equals "dash_v2_" (sanity).
 *   4. Every LS_* constant exported from constants.ts is used somewhere in src/.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(__dirname, "../../../src");

/** Recursively collect all .ts files under a directory. */
function collectTs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTs(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      results.push(full);
    }
  }
  return results;
}

/** Return all lines matching a pattern, with file path and line number. */
function grep(
  files: string[],
  pattern: RegExp,
): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const file of files) {
    const lines = readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        hits.push({ file: file.replace(ROOT, "src"), line: i + 1, text: lines[i].trim() });
      }
    }
  }
  return hits;
}

// File sets collected once at module level
const allSrcTs = collectTs(ROOT);
const cardTs = collectTs(join(ROOT, "cards"));
const cacheFile = join(ROOT, "core", "cache.ts");
const nonCacheTs = allSrcTs.filter((f) => f !== cacheFile);

describe("localStorage discipline audit (Stream D2.8)", () => {
  it("LS_PREFIX in constants.ts equals 'dash_v2_'", () => {
    const constants = readFileSync(join(ROOT, "core", "constants.ts"), "utf-8");
    expect(constants).toMatch(/export const LS_PREFIX = "dash_v2_"/);
  });

  it("no file outside core/cache.ts uses raw 'dash_v2_' strings in localStorage.setItem", () => {
    const rawDataWrites = grep(
      nonCacheTs,
      /localStorage\.setItem\s*\(\s*["']dash_v2_/,
    );
    if (rawDataWrites.length > 0) {
      const report = rawDataWrites
        .map((h) => `  ${h.file}:${h.line} → ${h.text}`)
        .join("\n");
      throw new Error(
        "Raw 'dash_v2_' string passed to localStorage.setItem outside core/cache.ts.\n" +
        "Use a named LS_* constant from core/constants.ts instead:\n" + report,
      );
    }
    expect(rawDataWrites).toHaveLength(0);
  });

  it("card files do not call localStorage.setItem with inline string literals", () => {
    const inlineStringWrites = grep(
      cardTs,
      /localStorage\.setItem\s*\(\s*["']/,
    );
    if (inlineStringWrites.length > 0) {
      const report = inlineStringWrites
        .map((h) => `  ${h.file}:${h.line} → ${h.text}`)
        .join("\n");
      throw new Error(
        "Card file uses localStorage.setItem with an inline string literal.\n" +
        "Use a named LS_* constant from core/constants.ts instead:\n" + report,
      );
    }
    expect(inlineStringWrites).toHaveLength(0);
  });

  it("every LS_* constant exported from constants.ts is used somewhere in src/", () => {
    const constants = readFileSync(join(ROOT, "core", "constants.ts"), "utf-8");
    const lsExports = [...constants.matchAll(/export const (LS_[A-Z_]+) =/g)].map(
      (m) => m[1],
    );
    // LS_PREFIX and LS_MAX_AGE are internal — cache.ts uses them implicitly
    const excluded = new Set(["LS_PREFIX", "LS_MAX_AGE"]);
    const nonConstantsSrc = allSrcTs
      .filter((f) => !f.includes("constants.ts"))
      .map((f) => readFileSync(f, "utf-8"))
      .join("\n");
    const unused: string[] = [];
    for (const name of lsExports) {
      if (!excluded.has(name) && !nonConstantsSrc.includes(name)) {
        unused.push(name);
      }
    }
    if (unused.length > 0) {
      throw new Error(
        "Unused LS_* constants in core/constants.ts (dead config keys):\n" +
        unused.map((n) => "  " + n).join("\n"),
      );
    }
    expect(unused).toHaveLength(0);
  });
});
