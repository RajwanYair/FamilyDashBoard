/**
 * fast-check property tests — src/core/fs-access.ts
 *
 * Properties under test:
 *  FSA1. saveTextFile (fallback path): always returns true when FSA API unavailable
 *  FSA2. saveTextFile (fallback path): never throws for arbitrary text content
 *  FSA3. saveTextFile (fallback path): never throws for arbitrary suggestedName strings
 *  FSA4. pickTextFile (fallback path): returns a Promise (never throws synchronously)
 *  FSA5. saveTextFile opts: arbitrary mimeType strings don't throw
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stub the DOM APIs that fs-access.ts uses in its fallback path. */
function stubFallbackDOM(): void {
  // Ensure FSA picker is absent so fallback is taken
  Object.defineProperty(window, "showSaveFilePicker", {
    value: undefined,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "showOpenFilePicker", {
    value: undefined,
    writable: true,
    configurable: true,
  });

  // Stub URL.createObjectURL / revokeObjectURL without replacing the constructor
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);

  // Stub document.createElement to return a minimal anchor
  const origCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      const a = origCreate("a");
      a.click = vi.fn();
      return a;
    }
    return origCreate(tag);
  });
}

// ── FSA1: fallback saveTextFile always returns true ──────────────────────────

describe("fs-access — FSA1: saveTextFile fallback always returns true", () => {
  beforeEach(() => stubFallbackDOM());
  afterEach(() => vi.restoreAllMocks());

  it("resolves to true for arbitrary text content", async () => {
    const { saveTextFile } = await import("@/core/fs-access");
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 200 }), async (text) => {
        const result = await saveTextFile(text, { suggestedName: "test.txt" });
        expect(result).toBe(true);
      }),
      { numRuns: 20 },
    );
  }, 30000);
});

// ── FSA2: fallback saveTextFile never throws for arbitrary content ────────────

describe("fs-access — FSA2: saveTextFile fallback never throws", () => {
  beforeEach(() => stubFallbackDOM());
  afterEach(() => vi.restoreAllMocks());

  it("never throws for arbitrary text", async () => {
    const { saveTextFile } = await import("@/core/fs-access");
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 100 }), async (text) => {
        await expect(saveTextFile(text, {})).resolves.toBeDefined();
      }),
      { numRuns: 20 },
    );
  }, 30000);
});

// ── FSA3: arbitrary suggestedName strings don't throw ────────────────────────

describe("fs-access — FSA3: saveTextFile accepts arbitrary suggestedName", () => {
  beforeEach(() => stubFallbackDOM());
  afterEach(() => vi.restoreAllMocks());

  it("never throws for arbitrary filename strings", async () => {
    const { saveTextFile } = await import("@/core/fs-access");
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 64 }).filter((s) => s.length > 0),
        async (name) => {
          await expect(saveTextFile("hello", { suggestedName: name })).resolves.toBeDefined();
        },
      ),
      { numRuns: 20 },
    );
  }, 30000);
});

// ── FSA4: pickTextFile fallback returns a Promise (never throws sync) ─────────

describe("fs-access — FSA4: pickTextFile fallback returns Promise", () => {
  beforeEach(() => stubFallbackDOM());
  afterEach(() => vi.restoreAllMocks());

  it("returns a Promise object synchronously", async () => {
    const { pickTextFile } = await import("@/core/fs-access");
    fc.assert(
      fc.property(fc.constantFrom(".json", ".txt", ".csv", ".md"), (ext) => {
        const result = pickTextFile({ extensions: [ext] });
        expect(result).toBeInstanceOf(Promise);
      }),
      { numRuns: 10 },
    );
  }, 30000);
});

// ── FSA5: arbitrary mimeType strings don't cause sync throw ──────────────────

describe("fs-access — FSA5: saveTextFile accepts arbitrary mimeType", () => {
  beforeEach(() => stubFallbackDOM());
  afterEach(() => vi.restoreAllMocks());

  it("never throws for arbitrary mimeType strings", async () => {
    const { saveTextFile } = await import("@/core/fs-access");
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 40 }).filter((s) => !s.includes("\0")),
        async (mimeType) => {
          await expect(
            saveTextFile("content", { mimeType, suggestedName: "file.bin" }),
          ).resolves.toBeDefined();
        },
      ),
      { numRuns: 15 },
    );
  }, 30000);
});
