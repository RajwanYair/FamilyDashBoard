/**
 * Tests for src/core/diag.ts — Diagnostic Ring Buffer
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  diagLog,
  getDiagEntries,
  clearDiag,
  formatDiagEntry,
  classifyProviderError,
  buildDiagExport,
  exportDiagJson,
  DIAG_EXPORT_SCHEMA_VERSION,
} from "@/core/diag";

describe("DiagLog", () => {
  beforeEach(() => {
    clearDiag();
  });

  it("logs a message and retrieves it", () => {
    diagLog("test message");
    const entries = getDiagEntries();
    expect(entries.length).toBe(1);
    expect(entries[0]?.msg).toBe("test message");
  });

  it("maintains order (newest first)", () => {
    diagLog("first");
    diagLog("second");
    const entries = getDiagEntries();
    expect(entries[0]?.msg).toBe("second");
    expect(entries[1]?.msg).toBe("first");
  });

  it("clears all entries", () => {
    diagLog("a");
    diagLog("b");
    clearDiag();
    expect(getDiagEntries().length).toBe(0);
  });

  it("respects ring buffer size (max 80 entries)", () => {
    for (let i = 0; i < 100; i++) {
      diagLog(`msg-${i}`);
    }
    const entries = getDiagEntries();
    expect(entries.length).toBeLessThanOrEqual(80);
    // Newest entry should be at index 0 (reversed)
    expect(entries[0]?.msg).toBe("msg-99");
  });

  it("formatDiagEntry returns a string with timestamp and message", () => {
    diagLog("formatted");
    const entry = getDiagEntries()[0];
    if (entry) {
      const formatted = formatDiagEntry(entry);
      expect(formatted).toContain("formatted");
      expect(formatted.length).toBeGreaterThan(10); // has timestamp prefix
    }
  });

  it("handles empty string without throwing", () => {
    expect(() => diagLog("")).not.toThrow();
  });

  it("empty string message stored correctly", () => {
    diagLog("non-empty");
    diagLog("");
    const entries = getDiagEntries();
    expect(entries[0]?.msg).toBe("");
  });

  it("handles special characters", () => {
    diagLog("test <script>alert(1)</script>");
    const entry = getDiagEntries()[0];
    expect(entry?.msg).toBe("test <script>alert(1)</script>");
  });

  it("each entry has a numeric ts field", () => {
    diagLog("ts-check");
    const entry = getDiagEntries()[0];
    expect(typeof entry?.ts).toBe("number");
  });

  it("ts is a recent timestamp", () => {
    const before = Date.now();
    diagLog("time-check");
    const after = Date.now();
    const entry = getDiagEntries()[0];
    expect(entry?.ts).toBeGreaterThanOrEqual(before);
    expect(entry?.ts).toBeLessThanOrEqual(after);
  });

  it("getDiagEntries returns array type", () => {
    expect(Array.isArray(getDiagEntries())).toBe(true);
  });

  it("formatDiagEntry result contains the timestamp", () => {
    diagLog("with-ts");
    const entry = getDiagEntries()[0]!;
    const formatted = formatDiagEntry(entry);
    expect(formatted).toMatch(/\d/); // contains digits (timestamp)
  });
});

// ── classifyProviderError ─────────────────────────────────────
describe("classifyProviderError ", () => {
  beforeEach(() => clearDiag());

  it("classifies network errors", () => {
    expect(classifyProviderError(new Error("Failed to fetch"), "p")).toBe("network");
    expect(classifyProviderError(new Error("NetworkError"), "p")).toBe("network");
    expect(classifyProviderError(new Error("CORS error"), "p")).toBe("network");
  });

  it("classifies timeout errors", () => {
    expect(classifyProviderError(new Error("Request timeout"), "p")).toBe("timeout");
    expect(classifyProviderError(new Error("aborted"), "p")).toBe("timeout");
  });

  it("classifies parse errors", () => {
    expect(classifyProviderError(new SyntaxError("JSON parse error"), "p")).toBe("parse");
    expect(classifyProviderError(new Error("syntax error in response"), "p")).toBe("parse");
  });

  it("classifies upstream errors", () => {
    expect(classifyProviderError(new Error("HTTP 503"), "p")).toBe("upstream");
  });

  it("classifies unknown errors", () => {
    expect(classifyProviderError(new Error("something else"), "p")).toBe("unknown");
    expect(classifyProviderError("a string error", "p")).toBe("unknown");
    expect(classifyProviderError(undefined, "p")).toBe("unknown");
  });

  it("logs FDB-062 for every call", () => {
    classifyProviderError(new Error("boom"), "test-provider");
    const entries = getDiagEntries();
    expect(entries[0]?.msg).toMatch(/FDB-062/);
    expect(entries[0]?.msg).toContain("test-provider");
  });
});

// ── Structured JSON export  ─────────────────────────────

describe("buildDiagExport", () => {
  beforeEach(() => {
    clearDiag();
  });

  it("returns schemaVersion 1", () => {
    const ex = buildDiagExport();
    expect(ex.schemaVersion).toBe(DIAG_EXPORT_SCHEMA_VERSION);
    expect(ex.schemaVersion).toBe(1);
  });

  it("entries array is ordered oldest-first", () => {
    diagLog("alpha");
    diagLog("beta");
    const ex = buildDiagExport();
    expect(ex.entries[0]?.msg).toBe("alpha");
    expect(ex.entries[1]?.msg).toBe("beta");
  });

  it("respects limit parameter", () => {
    diagLog("a");
    diagLog("b");
    diagLog("c");
    const ex = buildDiagExport(2);
    expect(ex.entries.length).toBe(2);
    expect(ex.entries[0]?.msg).toBe("b");
    expect(ex.entries[1]?.msg).toBe("c");
  });

  it("totalCount matches buffer length", () => {
    diagLog("x");
    diagLog("y");
    const ex = buildDiagExport();
    expect(ex.totalCount).toBe(2);
  });

  it("exportedAt is a recent timestamp", () => {
    const before = Date.now();
    const ex = buildDiagExport();
    expect(ex.exportedAt).toBeGreaterThanOrEqual(before);
    expect(ex.exportedAt).toBeLessThanOrEqual(Date.now() + 100);
  });

  it("includes appVersion field", () => {
    const ex = buildDiagExport();
    expect(typeof ex.appVersion).toBe("string");
    expect(ex.appVersion.length).toBeGreaterThan(0);
  });

  it("includes userAgent string", () => {
    const ex = buildDiagExport();
    expect(typeof ex.userAgent).toBe("string");
  });

  it("includes pageUrl without query params", () => {
    const ex = buildDiagExport();
    expect(ex.pageUrl).not.toContain("?");
  });
});

describe("exportDiagJson", () => {
  beforeEach(() => {
    clearDiag();
  });

  it("returns valid JSON string", () => {
    diagLog("test");
    expect(() => JSON.parse(exportDiagJson())).not.toThrow();
  });

  it("JSON has schemaVersion 1", () => {
    const parsed = JSON.parse(exportDiagJson()) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(1);
  });

  it("JSON is pretty-printed (has newlines)", () => {
    const json = exportDiagJson();
    expect(json).toContain("\n");
  });
});
