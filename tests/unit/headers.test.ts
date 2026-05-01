/**
 * Tests for `_headers` (Cloudflare Pages security baseline).
 *
 * Sprint 327 (D5): Origin-Agent-Cluster: ?1 enables process isolation per
 * origin (defends against Spectre-class side-channels). Verified alongside
 * the existing CSP / COOP / COEP / CORP / HSTS / Permissions-Policy chain.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADERS = readFileSync(resolve(process.cwd(), "_headers"), "utf-8");

describe("_headers — security baseline (Sprint 327)", () => {
  it("declares Origin-Agent-Cluster: ?1", () => {
    expect(HEADERS).toMatch(/Origin-Agent-Cluster:\s*\?1/);
  });

  it("preserves the COOP/COEP/CORP isolation chain", () => {
    expect(HEADERS).toMatch(/Cross-Origin-Opener-Policy:\s*same-origin/);
    expect(HEADERS).toMatch(/Cross-Origin-Embedder-Policy:\s*credentialless/);
    expect(HEADERS).toMatch(/Cross-Origin-Resource-Policy:\s*same-site/);
  });

  it("preserves the HSTS + Trusted Types + nosniff baseline", () => {
    expect(HEADERS).toMatch(/Strict-Transport-Security:.*max-age=\d+/);
    expect(HEADERS).toMatch(/X-Content-Type-Options:\s*nosniff/);
    expect(HEADERS).toMatch(/require-trusted-types-for 'script'/);
  });

  it("denies new 2026 sensor / privacy / clipboard APIs by default (Sprint 331)", () => {
    // Hard-deny: empty allowlist
    for (const directive of [
      "attribution-reporting",
      "browsing-topics",
      "idle-detection",
      "interest-cohort",
      "storage-access",
      "unload",
      "clipboard-read",
      "private-state-token-issuance",
      "private-state-token-redemption",
      "keyboard-map",
      "speaker-selection",
      "gamepad",
    ]) {
      expect(HEADERS).toMatch(new RegExp(`${directive}=\\(\\)`));
    }
    // Self-only: Compute Pressure (used by system-info card) and clipboard-write
    expect(HEADERS).toMatch(/compute-pressure=\(self\)/);
    expect(HEADERS).toMatch(/clipboard-write=\(self\)/);
  });
});
