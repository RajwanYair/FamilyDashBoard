/**
 * Tests for src/core/diag.ts — Diagnostic Ring Buffer
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  diagLog,
  getDiagEntries,
  clearDiag,
  formatDiagEntry,
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
