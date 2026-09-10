// @ts-check

/**
 * Independently verifies the signed and attested files published for a tag.
 *
 * This verifier intentionally shells out to the supported Sigstore and GitHub
 * CLIs instead of reimplementing their cryptographic verification logic.
 */

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const COSIGN_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const SLSA_PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";

/**
 * @param {string} repository
 * @param {string} workflow
 * @param {string} tag
 */
export function expectedIdentity(repository, workflow, tag) {
  if (!/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error(`Repository must use owner/name form: ${repository}`);
  }
  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error(`Release tag is not a semantic version tag: ${tag}`);
  }

  const workflowPath = workflow.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!workflowPath.startsWith(".github/workflows/")) {
    throw new Error(`Workflow must be under .github/workflows/: ${workflow}`);
  }

  return `https://github.com/${repository}/${workflowPath}@refs/tags/${tag}`;
}

/**
 * @param {string} text
 */
export function parseChecksums(text) {
  /** @type {Map<string, string>} */
  const checksums = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (match) {
      checksums.set(basename(match[2]), match[1]);
    }
  }
  return checksums;
}

/**
 * @param {string} filePath
 */
export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

/**
 * @param {unknown} value
 */
function sortJson(value) {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortJson(entry)]),
    );
  }
  return value;
}

/**
 * Remove fields generated uniquely for each SBOM invocation.
 *
 * @param {unknown} value
 */
export function normalizeSbom(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SBOM must be a JSON object");
  }

  const normalized = structuredClone(value);
  if (normalized.metadata && typeof normalized.metadata === "object") {
    delete normalized.metadata.timestamp;
  }
  delete normalized.serialNumber;
  return JSON.stringify(sortJson(normalized));
}

/**
 * @param {string[]} args
 */
export function buildCosignVerifyArgs(args) {
  const {
    artifact,
    bundle,
    identity,
    issuer = COSIGN_OIDC_ISSUER,
  } = /** @type {{
    artifact: string;
    bundle: string;
    identity: string;
    issuer?: string;
  }} */ (Object.fromEntries(args.map((entry) => entry.split("=", 2))));

  return [
    "verify-blob",
    `--bundle=${bundle}`,
    `--certificate-identity=${identity}`,
    `--certificate-oidc-issuer=${issuer}`,
    artifact,
  ];
}

/**
 * @param {string[]} argv
 */
export function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const options = {
    workflow: ".github/workflows/release.yml",
    cosign: "cosign",
    gh: "gh",
    negativeFixtures: false,
  };
  const valueFlags = new Set([
    "artifact",
    "rebuilt-artifact",
    "bundle",
    "service-worker",
    "service-worker-bundle",
    "checksum",
    "sbom",
    "expected-sbom",
    "tag",
    "repository",
    "workflow",
    "cosign",
    "gh",
    "provenance-output",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) {
      throw new Error(`Unexpected argument: ${raw}`);
    }
    const name = raw.slice(2);
    if (name === "negative-fixtures") {
      options.negativeFixtures = true;
      continue;
    }
    if (!valueFlags.has(name)) {
      throw new Error(`Unknown option: --${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name] = value;
    index += 1;
  }

  return options;
}

/**
 * @param {Record<string, string | boolean>} options
 * @param {string} name
 */
function requiredOption(options, name) {
  const value = options[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required option: --${name}`);
  }
  return value;
}

/**
 * @param {string} filePath
 * @param {string} label
 */
function assertFile(filePath, label) {
  if (!existsSync(filePath) || statSync(filePath).size === 0) {
    throw new Error(`${label} is missing or empty: ${filePath}`);
  }
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("node:child_process").SpawnSyncOptions} [options]
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error) {
    throw new Error(`Could not execute ${command}: ${result.error.message}`);
  }
  return result;
}

/**
 * @param {string} cosign
 * @param {string} artifact
 * @param {string} bundle
 * @param {string} identity
 */
function verifyCosign(cosign, artifact, bundle, identity) {
  assertFile(artifact, "Signed artifact");
  assertFile(bundle, "Cosign bundle");
  const result = run(
    cosign,
    buildCosignVerifyArgs([`artifact=${artifact}`, `bundle=${bundle}`, `identity=${identity}`]),
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`Cosign verification failed for ${artifact}`);
  }
}

/**
 * @param {string} cosign
 * @param {string[]} args
 * @param {string} label
 */
function expectCosignFailure(cosign, args, label) {
  const result = run(cosign, args, { stdio: "ignore" });
  if (result.status === 0) {
    throw new Error(`${label} unexpectedly passed Cosign verification`);
  }
  console.log(`[verify-release-provenance] OK    ${label} rejected`);
}

/**
 * @param {string} sbomPath
 * @param {string} expectedVersion
 */
function validateSbom(sbomPath, expectedVersion) {
  assertFile(sbomPath, "Published SBOM");
  const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
  if (
    sbom.bomFormat !== "CycloneDX" ||
    typeof sbom.specVersion !== "string" ||
    !Array.isArray(sbom.components) ||
    sbom.components.length === 0
  ) {
    throw new Error("Published SBOM is not a populated CycloneDX document");
  }
  if (
    sbom.metadata?.component?.name !== "familydashboard" ||
    sbom.metadata?.component?.version !== expectedVersion
  ) {
    throw new Error("Published SBOM root component does not match the release version");
  }
  return sbom;
}

/**
 * @param {string} publishedSbomPath
 * @param {string} expectedSbomPath
 */
function compareSbom(publishedSbomPath, expectedSbomPath) {
  assertFile(expectedSbomPath, "Rebuilt SBOM");
  const published = JSON.parse(readFileSync(publishedSbomPath, "utf8"));
  const expected = JSON.parse(readFileSync(expectedSbomPath, "utf8"));
  if (normalizeSbom(published) !== normalizeSbom(expected)) {
    throw new Error("Published SBOM differs from the SBOM regenerated from the release tag");
  }
}

/**
 * @param {string} checksumPath
 * @param {string} artifactPath
 * @param {string} serviceWorkerPath
 */
function verifyChecksums(checksumPath, artifactPath, serviceWorkerPath) {
  assertFile(checksumPath, "Published checksum file");
  const checksums = parseChecksums(readFileSync(checksumPath, "utf8"));
  for (const [filePath, label] of [
    [artifactPath, "dist.zip"],
    [serviceWorkerPath, "sw.js"],
  ]) {
    const expected = checksums.get(label);
    if (!expected) {
      throw new Error(`Published checksum file has no ${label} entry`);
    }
    const actual = sha256File(filePath);
    if (actual !== expected) {
      throw new Error(`${label} digest does not match the published checksum`);
    }
  }
}

/**
 * @param {Record<string, string | boolean>} options
 */
function verify(options) {
  const artifact = resolve(requiredOption(options, "artifact"));
  const rebuiltArtifact = resolve(requiredOption(options, "rebuilt-artifact"));
  const bundle = resolve(requiredOption(options, "bundle"));
  const serviceWorker = resolve(requiredOption(options, "service-worker"));
  const serviceWorkerBundle = resolve(requiredOption(options, "service-worker-bundle"));
  const checksum = resolve(requiredOption(options, "checksum"));
  const sbomPath = resolve(requiredOption(options, "sbom"));
  const expectedSbom = resolve(requiredOption(options, "expected-sbom"));
  const tag = requiredOption(options, "tag");
  const repository = requiredOption(options, "repository");
  const workflow = requiredOption(options, "workflow");
  const cosign = requiredOption(options, "cosign");
  const gh = requiredOption(options, "gh");
  const identity = expectedIdentity(repository, workflow, tag);

  verifyChecksums(checksum, artifact, serviceWorker);
  assertFile(rebuiltArtifact, "Independent rebuild artifact");
  if (sha256File(artifact) !== sha256File(rebuiltArtifact)) {
    throw new Error("Published dist.zip does not match the independent rebuild");
  }
  const publishedSbom = validateSbom(sbomPath, tag.slice(1));
  compareSbom(sbomPath, expectedSbom);
  verifyCosign(cosign, artifact, bundle, identity);
  verifyCosign(cosign, serviceWorker, serviceWorkerBundle, identity);

  const attestation = run(
    gh,
    [
      "attestation",
      "verify",
      artifact,
      "--repo",
      repository,
      "--signer-workflow",
      `${repository}/${workflow.replaceAll("\\", "/")}`,
      "--cert-identity",
      identity,
      "--cert-oidc-issuer",
      COSIGN_OIDC_ISSUER,
      "--source-ref",
      `refs/tags/${tag}`,
      "--predicate-type",
      SLSA_PROVENANCE_PREDICATE,
      "--format",
      "json",
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  if (attestation.status !== 0 || !attestation.stdout) {
    throw new Error("GitHub SLSA provenance attestation verification failed");
  }
  const attestationResult = JSON.parse(attestation.stdout);
  if (!Array.isArray(attestationResult) || attestationResult.length === 0) {
    throw new Error("GitHub attestation verifier returned no verified provenance");
  }
  const provenanceOutput = options["provenance-output"];
  if (typeof provenanceOutput === "string") {
    writeFileSync(resolve(provenanceOutput), attestation.stdout);
  }

  if (options.negativeFixtures === true) {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "familydashboard-provenance-"));
    try {
      const tampered = join(fixtureRoot, "tampered.zip");
      copyFileSync(artifact, tampered);
      appendFileSync(tampered, "\n tampered fixture\n");
      expectCosignFailure(
        cosign,
        buildCosignVerifyArgs([`artifact=${tampered}`, `bundle=${bundle}`, `identity=${identity}`]),
        "tampered artifact",
      );

      const wrongIdentity = expectedIdentity("example/FamilyDashBoard", workflow, tag);
      expectCosignFailure(
        cosign,
        buildCosignVerifyArgs([
          `artifact=${artifact}`,
          `bundle=${bundle}`,
          `identity=${wrongIdentity}`,
        ]),
        "wrong certificate identity",
      );

      expectCosignFailure(
        cosign,
        buildCosignVerifyArgs([
          `artifact=${artifact}`,
          `bundle=${join(fixtureRoot, "missing.bundle")}`,
          `identity=${identity}`,
        ]),
        "missing Cosign bundle",
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }

  console.log(
    `[verify-release-provenance] OK    ${tag} verified for ${repository} (${sha256File(artifact)})`,
  );
  console.log(
    `[verify-release-provenance] OK    SBOM matches ${publishedSbom.metadata.component.name}@${publishedSbom.metadata.component.version}`,
  );
}

const entryPoint = process.argv[1] ? resolve(process.argv[1]) : "";
const modulePath = resolve(fileURLToPath(import.meta.url));
if (entryPoint === modulePath) {
  try {
    verify(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(
      `[verify-release-provenance] FAIL  ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
