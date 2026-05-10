/**
 * fast-check property tests — src/ui/document-pip.ts
 *
 * Properties under test:
 *  PIP1. isDocumentPipSupported: returns boolean (never throws)
 *  PIP2. isPipActive: initially false
 *  PIP3. _resetDocumentPip: after reset, isPipActive is false
 */

import { describe, it, expect } from "vitest";
import { isDocumentPipSupported, isPipActive, _resetDocumentPip } from "@/ui/document-pip";

// ── PIP1: isDocumentPipSupported returns boolean ─────────────────────────────

describe("document-pip — PIP1: isDocumentPipSupported returns boolean", () => {
  it("returns a boolean without throwing", () => {
    const result = isDocumentPipSupported();
    expect(typeof result).toBe("boolean");
  });
});

// ── PIP2: isPipActive initially false ────────────────────────────────────────

describe("document-pip — PIP2: isPipActive initial", () => {
  it("returns false when no PiP window is open", () => {
    _resetDocumentPip();
    expect(isPipActive()).toBe(false);
  });
});

// ── PIP3: _resetDocumentPip clears state ─────────────────────────────────────

describe("document-pip — PIP3: reset clears active state", () => {
  it("isPipActive is false after reset", () => {
    _resetDocumentPip();
    expect(isPipActive()).toBe(false);
  });
});
