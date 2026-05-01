/**
 * Unit tests — V13-SEC: Permissions-Policy in _headers
 *
 * Verifies that newly-shipped browser APIs are explicitly denied in the
 * Permissions-Policy header and that the total count meets the target (≥28).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "..", "..", "..");
const HEADERS = readFileSync(resolve(ROOT, "_headers"), "utf-8");

/** Extract the Permissions-Policy value from the _headers file. */
function getPermissionsPolicy(): string {
  const match = HEADERS.match(/Permissions-Policy:\s*(.+)/);
  return match?.[1]?.trim() ?? "";
}

/** Parse individual API names from a Permissions-Policy value string. */
function parseAPIs(policy: string): string[] {
  return policy.split(",").map((s) =>
    s
      .trim()
      .replace(/=\(\)$/, "")
      .trim(),
  );
}

describe("_headers: Permissions-Policy — legacy APIs", () => {
  const policy = getPermissionsPolicy();

  it("denies geolocation", () => {
    expect(policy).toContain("geolocation=()");
  });

  it("denies microphone", () => {
    expect(policy).toContain("microphone=()");
  });

  it("denies camera", () => {
    expect(policy).toContain("camera=()");
  });

  it("denies payment", () => {
    expect(policy).toContain("payment=()");
  });

  it("denies usb", () => {
    expect(policy).toContain("usb=()");
  });

  it("denies sync-xhr", () => {
    expect(policy).toContain("sync-xhr=()");
  });

  it("denies screen-wake-lock", () => {
    expect(policy).toContain("screen-wake-lock=()");
  });
});

describe("_headers: Permissions-Policy — newly-shipped APIs (V13-SEC)", () => {
  const policy = getPermissionsPolicy();

  it("denies serial", () => {
    expect(policy).toContain("serial=()");
  });

  it("denies hid", () => {
    expect(policy).toContain("hid=()");
  });

  it("denies bluetooth", () => {
    expect(policy).toContain("bluetooth=()");
  });

  it("denies window-management", () => {
    expect(policy).toContain("window-management=()");
  });

  it("denies local-fonts", () => {
    expect(policy).toContain("local-fonts=()");
  });

  it("denies identity-credentials-get", () => {
    expect(policy).toContain("identity-credentials-get=()");
  });
});

describe("_headers: Permissions-Policy — total API count", () => {
  const policy = getPermissionsPolicy();
  const apis = parseAPIs(policy);

  it("has at least 28 API entries", () => {
    expect(apis.length).toBeGreaterThanOrEqual(28);
  });

  it("all entries follow name=() or name=(self) format", () => {
    // Sprint 331: Compute Pressure + clipboard-write are self-allowed for first-party cards
    const raw = policy.split(",").map((s) => s.trim());
    for (const entry of raw) {
      expect(entry).toMatch(/^[\w-]+=\((?:|self)\)$/);
    }
  });

  it("no duplicate API names", () => {
    const seen = new Set<string>();
    for (const api of apis) {
      expect(seen.has(api)).toBe(false);
      seen.add(api);
    }
  });
});
