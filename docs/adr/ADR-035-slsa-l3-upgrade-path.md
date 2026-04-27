# ADR-035 — SLSA Level 3 Upgrade Path

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| **Date**     | 2026-04-24                                   |
| **Status**   | Accepted                                     |
| **Deciders** | @RajwanYair                                  |
| **Tags**     | security, supply-chain, slsa, provenance, ci |

---

## Context

[SLSA](https://slsa.dev/) (Supply-chain Levels for Software Artifacts) is a security framework
that specifies requirements for software build integrity. The current CI pipeline satisfies most
SLSA **Level 2** controls (source reviewed, build scripted, CI-hosted). Moving to **Level 3**
requires **provenance attestations** — signed, verifiable metadata that proves each build
artifact was produced by a specific, unmodified build script in a trusted environment.

Previous ADR-027 planned SBOM generation and Dependabot automation (Level 2 equivalent).
This ADR plans the Level 3 step up.

---

## Decision

Adopt the GitHub Actions `slsa-framework/slsa-github-generator` workflow to produce SLSA
Level 3 provenance attestations for every tagged release. The workflow:

1. Runs in a separate, isolated job after the main `ci.yml` gates pass.
2. Uses the **Node.js builder** (`slsa-framework/slsa-github-generator/.../.github/workflow/builder_nodejs_slsa3.yml`).
3. Uploads the provenance attestation (`.intoto.jsonl`) as a GitHub release asset alongside
   the `dist/` tarball.
4. The attestation can be verified by consumers with `slsa-verifier verify-artifact`.

---

## Consequences

### Positive

- Verifiable proof that every release was built from the tagged commit, unmodified, in the
  official GitHub Actions environment — satisfies SLSA Level 3.
- Zero changes to the application source code or Vite build pipeline.
- Consumers (e.g., enterprise IT admins deploying to a TV kiosk) can verify provenance before
  deploying.

### Negative / Trade-offs

- Adds a second CI job (~2 min) to the release workflow — acceptable for release-only runs.
- The `slsa-github-generator` workflow uses `permissions: id-token: write` which must be
  explicitly allowed in the repository settings (already enabled for GitHub Pages deploys).
- SLSA L3 provenance covers only the dist artifact; the Cloudflare Worker deployed with
  `wrangler deploy` remains at Level 2 (Cloudflare's own deploy integrity is out of scope).

---

## Implementation Plan

The upgrade is deferred to v14.x to avoid disrupting the v13.x release cycle. Steps:

1. **Create `.github/workflows/release-provenance.yml`**
   - Trigger: `on: release: types: [published]`
   - Uses: `slsa-framework/slsa-github-generator/.github/workflows/builder_nodejs_slsa3.yml@v2`
   - Inputs: `node-version: "22"`, `build-artifact-name: "dist.tgz"`
   - Uploads the `.intoto.jsonl` attestation as a release asset.

2. **Bundle the dist tarball in `npm run build`**
   - Add a `package` script: `npm run build && tar -czf dist.tgz dist/`
   - This gives the provenance generator a single artifact to sign.

3. **Add a `SLSA Provenance` section to README.md** with verification instructions:

   ```sh
   slsa-verifier verify-artifact dist.tgz \
     --provenance-path dist.tgz.intoto.jsonl \
     --source-uri github.com/RajwanYair/FamilyDashBoard \
     --source-tag v14.0.0
   ```

4. **Update `docs/security.md` Section 11** to reference this ADR instead of ADR-027
   for the Level 3 upgrade path.

5. **Verify** by running the provenance workflow on a pre-release tag and checking the
   uploaded attestation JSON against the released artifact.

---

## Status Tracking

| Step                                               | Target version | Status      |
| -------------------------------------------------- | -------------- | ----------- |
| ADR drafted                                        | v13.2          | ✅ Done     |
| `.github/workflows/release-provenance.yml` created | v14.0          | ⏳ Deferred |
| `dist.tgz` bundle script                           | v14.0          | ⏳ Deferred |
| README provenance section                          | v14.0          | ⏳ Deferred |
| First signed release                               | v14.0          | ⏳ Deferred |

---

## Related ADRs

- ADR-027 — SBOM Generation and Automated Dependency Updates (Level 2 baseline)
- ADR-018 — CSP / COOP / COEP headers (complementary supply-chain hardening)
