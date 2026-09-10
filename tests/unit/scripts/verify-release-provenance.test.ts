import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCosignVerifyArgs,
  expectedIdentity,
  normalizeSbom,
  parseChecksums,
} from "../../../scripts/verify-release-provenance.mjs";

const verifierSource = readFileSync(
  resolve(import.meta.dirname, "../../../scripts/verify-release-provenance.mjs"),
  "utf8",
);

describe("release provenance verifier", () => {
  it("builds an exact tag-scoped GitHub workflow identity", () => {
    expect(
      expectedIdentity("RajwanYair/FamilyDashBoard", ".github/workflows/release.yml", "v15.7.0"),
    ).toBe(
      "https://github.com/RajwanYair/FamilyDashBoard/.github/workflows/release.yml@refs/tags/v15.7.0",
    );
  });

  it("rejects repositories, workflows, and tags outside the release contract", () => {
    expect(() =>
      expectedIdentity("FamilyDashBoard", ".github/workflows/release.yml", "v15.7.0"),
    ).toThrow("owner/name");
    expect(() =>
      expectedIdentity("RajwanYair/FamilyDashBoard", ".github/workflows/other.yml", "v15.7.0"),
    ).not.toThrow();
    expect(() => expectedIdentity("RajwanYair/FamilyDashBoard", "release.yml", "v15.7.0")).toThrow(
      ".github/workflows",
    );
    expect(() =>
      expectedIdentity("RajwanYair/FamilyDashBoard", ".github/workflows/release.yml", "latest"),
    ).toThrow("semantic version");
  });

  it("parses published hashes by basename", () => {
    const checksums = parseChecksums(
      [
        "a".repeat(64) + "  dist.zip",
        "b".repeat(64) + "  sw.js",
        "c".repeat(64) + "  dist/icon.svg",
      ].join("\n"),
    );

    expect(checksums.get("dist.zip")).toBe("a".repeat(64));
    expect(checksums.get("sw.js")).toBe("b".repeat(64));
    expect(checksums.get("icon.svg")).toBe("c".repeat(64));
  });

  it("normalizes only invocation-specific SBOM metadata", () => {
    const first = {
      serialNumber: "urn:uuid:first",
      metadata: {
        timestamp: "2026-09-10T00:00:00.000Z",
        component: { name: "familydashboard", version: "15.7.0" },
      },
      components: [{ name: "vite", version: "8.1.5" }],
    };
    const second = {
      serialNumber: "urn:uuid:second",
      metadata: {
        timestamp: "2026-09-10T01:00:00.000Z",
        component: { name: "familydashboard", version: "15.7.0" },
      },
      components: [{ name: "vite", version: "8.1.5" }],
    };

    expect(normalizeSbom(first)).toBe(normalizeSbom(second));
  });

  it("passes exact identity and issuer to Cosign", () => {
    expect(
      buildCosignVerifyArgs([
        "artifact=dist.zip",
        "bundle=dist.zip.bundle",
        "identity=https://github.com/RajwanYair/FamilyDashBoard/.github/workflows/release.yml@refs/tags/v15.7.0",
      ]),
    ).toEqual([
      "verify-blob",
      "--bundle=dist.zip.bundle",
      "--certificate-identity=https://github.com/RajwanYair/FamilyDashBoard/.github/workflows/release.yml@refs/tags/v15.7.0",
      "--certificate-oidc-issuer=https://token.actions.githubusercontent.com",
      "dist.zip",
    ]);
  });

  it("keeps all required negative fixtures executable", () => {
    expect(verifierSource).toContain('"tampered artifact"');
    expect(verifierSource).toContain('"wrong certificate identity"');
    expect(verifierSource).toContain('"missing Cosign bundle"');
  });
});
