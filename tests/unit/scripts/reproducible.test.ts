/**
 * Unit tests for the reproducibility manifest and comparison helpers.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  compareManifests,
  comparePaths,
  createManifest,
  hashDirectory,
} from "../../../scripts/check-reproducible.mjs";

const repoRoot = resolve(import.meta.dirname, "../../../");
const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = mkdtempSync(join(process.env["TEMP"] ?? process.env["TMP"] ?? ".", "fdb-repro-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("reproducibility directory comparison", () => {
  it("ignores generated manifests and file timestamps", () => {
    const first = makeTempRoot();
    const second = makeTempRoot();
    mkdirSync(join(first, "assets"));
    mkdirSync(join(second, "assets"));
    writeFileSync(join(first, "assets", "main.js"), "const value = 1;\n");
    writeFileSync(join(second, "assets", "main.js"), "const value = 1;\n");
    writeFileSync(join(first, "rebuilder-manifest.json"), '{"generated":"first"}\n');
    writeFileSync(join(second, "rebuilder-manifest.json"), '{"generated":"second"}\n');

    const result = comparePaths(first, second);

    expect(result.match).toBe(true);
    expect(hashDirectory(first)).not.toBe(hashDirectory(second));
  });

  it("reports changed output content", () => {
    const first = makeTempRoot();
    const second = makeTempRoot();
    writeFileSync(join(first, "index.html"), "<main>one</main>\n");
    writeFileSync(join(second, "index.html"), "<main>two</main>\n");

    const result = comparePaths(first, second);

    expect(result.match).toBe(false);
    expect(result.left).not.toBe(result.right);
  });

  it("reports missing files and file-directory mismatches", () => {
    const directory = makeTempRoot();
    const file = join(makeTempRoot(), "dist.zip");
    writeFileSync(file, "zip");

    expect(comparePaths(directory, join(directory, "missing")).match).toBe(false);
    expect(comparePaths(directory, file)).toMatchObject({
      match: false,
      left: "directory",
      right: "file",
    });
  });
});

describe("reproducibility manifest contract", () => {
  it("hashes the repository lockfile under its repository-relative name", () => {
    const manifest = createManifest({
      root: repoRoot,
      dist: makeTempRoot(),
      distZipPath: join(makeTempRoot(), "dist.zip"),
    });

    expect(manifest._schema).toBe("fdb-rebuilder-manifest-v2");
    expect(manifest.buildInputHashes["package-lock.json"]).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.buildInputHashes["../package-lock.json"]).toBeUndefined();
  });

  it("normalizes the generated timestamp when a source epoch is set", () => {
    const previousEpoch = process.env["SOURCE_DATE_EPOCH"];
    process.env["SOURCE_DATE_EPOCH"] = "1700000000";
    try {
      const manifest = createManifest({
        root: repoRoot,
        dist: makeTempRoot(),
        distZipPath: join(makeTempRoot(), "dist.zip"),
      });

      expect(manifest.generated).toBe(new Date(1700000000 * 1000).toISOString());
      expect(manifest.buildEnvironment.sourceDateEpoch).toBe("1700000000");
    } finally {
      if (previousEpoch === undefined) {
        delete process.env["SOURCE_DATE_EPOCH"];
      } else {
        process.env["SOURCE_DATE_EPOCH"] = previousEpoch;
      }
    }
  });

  it("rejects missing and extra input declarations", () => {
    const manifest = createManifest({
      root: repoRoot,
      dist: makeTempRoot(),
      distZipPath: join(makeTempRoot(), "dist.zip"),
    });
    const missing = {
      ...manifest,
      buildInputHashes: { ...manifest.buildInputHashes },
    };
    delete missing.buildInputHashes["package-lock.json"];
    const extra = {
      ...manifest,
      buildInputHashes: { ...manifest.buildInputHashes, "unexpected.txt": "hash" },
    };

    expect(compareManifests(manifest, missing)).toEqual(
      expect.arrayContaining([expect.stringContaining("buildInputHashes keys")]),
    );
    expect(compareManifests(manifest, extra)).toEqual(
      expect.arrayContaining([expect.stringContaining("buildInputHashes keys")]),
    );
  });

  it("reports source and output hash changes", () => {
    const manifest = createManifest({
      root: repoRoot,
      dist: makeTempRoot(),
      distZipPath: join(makeTempRoot(), "dist.zip"),
    });
    const changed = {
      ...manifest,
      source: { ...manifest.source, commit: "different-commit" },
      buildEnvironment: { ...manifest.buildEnvironment, sourceDateEpoch: "different-epoch" },
      artefacts: { ...manifest.artefacts, "dist/": "different-output" },
    };

    const diffs = compareManifests(manifest, changed);

    expect(diffs).toEqual(
      expect.arrayContaining([
        expect.stringContaining("source.commit"),
        expect.stringContaining("buildEnvironment.sourceDateEpoch"),
        expect.stringContaining("artefacts.dist/"),
      ]),
    );
  });
});
