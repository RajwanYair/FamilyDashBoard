import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

interface ReleaseStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: {
    files?: string;
    fail_on_unmatched_files?: boolean;
  };
}

const workflow = parse(
  readFileSync(resolve(import.meta.dirname, "../../../.github/workflows/release.yml"), "utf8"),
) as { jobs: { release: { steps: ReleaseStep[] } } };
const steps = workflow.jobs.release.steps;
const publishIndex = steps.findIndex((step) =>
  step.uses?.startsWith("softprops/action-gh-release@"),
);

describe("release workflow", () => {
  it("publishes only after signing and provenance steps complete", () => {
    expect(publishIndex).toBeGreaterThan(0);
    const signingIndex = steps.findIndex((step) => step.run?.includes("cosign sign-blob"));
    const provenanceIndex = steps.findIndex((step) =>
      step.uses?.startsWith("actions/attest-build-provenance@"),
    );
    expect(signingIndex).toBeGreaterThanOrEqual(0);
    expect(provenanceIndex).toBeGreaterThanOrEqual(0);
    expect(publishIndex).toBeGreaterThan(signingIndex);
    expect(publishIndex).toBeGreaterThan(provenanceIndex);
    expect(publishIndex).toBe(steps.length - 1);
  });

  it("requires every declared release attachment", () => {
    const publication = steps[publishIndex];
    expect(publication?.with?.fail_on_unmatched_files).toBe(true);
    expect(publication?.with?.files?.trim().split(/\s+/)).toEqual([
      "dist.zip",
      "dist.zip.sha256",
      "dist.zip.bundle",
      "sw.js",
      "sw.js.bundle",
      "dist/icon.svg",
      "sbom.json",
    ]);
  });
});
