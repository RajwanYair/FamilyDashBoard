/**
 * FamilyDashBoard v12 — Trusted Types policy (V12-SEC-1)
 *
 * Creates the "dashboard" TrustedTypePolicy used to wrap static/computed HTML
 * strings before assigning to innerHTML. All inputs are app-generated
 * (numbers, computed CSS class names, template structures) — never raw
 * user input. The policy is therefore a safe passthrough.
 *
 * Usage:
 *   import { trustedHTML } from "@/core/trusted-types";
 *   el.innerHTML = trustedHTML(`<span>${computedValue}</span>`);
 *
 * In browsers without the TrustedTypes API the function returns the plain
 * string unchanged — fully backwards-compatible.
 */

// Use unknown to avoid requiring @types/trusted-types in tsconfig lib.
// The TrustedTypes API is feature-detected at runtime.
interface TrustedTypesApi {
  createPolicy(
    name: string,
    rules: { createHTML: (s: string) => string },
  ): { createHTML: (s: string) => unknown };
}

/** Lazily-initialised policy singleton. */
let _policy: { createHTML: (s: string) => unknown } | null = null;

function getPolicy(): { createHTML: (s: string) => unknown } | null {
  if (typeof window === "undefined") return null;
  const tt = (window as unknown as { trustedTypes?: TrustedTypesApi }).trustedTypes;
  if (!tt?.createPolicy) return null;
  if (_policy) return _policy;
  _policy = tt.createPolicy("dashboard", { createHTML: (s: string) => s });
  return _policy;
}

/**
 * Wrap a string in a TrustedHTML via the "dashboard" policy.
 * Falls back to the plain string in environments without TrustedTypes
 * (SSR, tests, older browsers).
 */
export function trustedHTML(s: string): string {
  const policy = getPolicy();
  if (!policy) return s;
  // TrustedHTML is accepted at DOM sink (innerHTML) at runtime.
  // Cast to string to satisfy TypeScript's DOM lib typings.
  return policy.createHTML(s) as string;
}
