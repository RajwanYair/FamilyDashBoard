import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

interface RebuildStep {
  name?: string;
  uses?: string;
  run?: string;
}

const workflow = parse(
  readFileSync(
    resolve(import.meta.dirname, "../../../.github/workflows/rebuild-verify.yml"),
    "utf8",
  ),
) as { jobs: { verify: { steps: RebuildStep[] } } };
const steps = workflow.jobs.verify.steps;

describe("rebuild provenance workflow", () => {
  it("installs Cosign and verifies the published release independently", () => {
    expect(steps.some((step) => step.uses?.startsWith("sigstore/cosign-installer@"))).toBe(true);
    const verifier = steps.find((step) => step.name?.includes("Verify release provenance"));
    expect(verifier?.run).toContain("verify-release-provenance.mjs");
    expect(verifier?.run).toContain("--rebuilt-artifact dist-rebuild.zip");
    expect(verifier?.run).toContain("--negative-fixtures");
    expect(verifier?.run).toContain("--expected-sbom sbom-rebuild.json");
  });

  it("downloads all signed and provenance inputs", () => {
    const download = steps.find((step) => step.name === "Download official release artefact");
    expect(download?.run).toContain('download_asset "dist.zip.bundle"');
    expect(download?.run).toContain('download_asset "dist.zip.sha256"');
    expect(download?.run).toContain('download_asset "sw.js.bundle"');
    expect(download?.run).toContain('download_asset "sbom.json"');
  });

  it("regenerates the SBOM from the exact checked-out tag", () => {
    const sbom = steps.find((step) => step.name === "Regenerate SBOM for source comparison");
    expect(sbom?.run).toContain("--package-lock-only");
    expect(sbom?.run).toContain("--output-file sbom-rebuild.json");
  });

  it("requires read access to GitHub provenance attestations", () => {
    const permissions = parse(
      readFileSync(
        resolve(import.meta.dirname, "../../../.github/workflows/rebuild-verify.yml"),
        "utf8",
      ),
    ) as { permissions: { attestations: string } };
    expect(permissions.permissions.attestations).toBe("read");
  });
});
