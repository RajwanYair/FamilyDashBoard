/**
 * Sprint 101 — Config export validation tests
 */
import { describe, it, expect } from "vitest";
import { buildExportEnvelope, validateExportPayload } from "@/core/config";
import { DEFAULT_CONFIG } from "@/types/config";

describe("validateExportPayload (Sprint 101)", () => {
  it("accepts a valid envelope", () => {
    const env = buildExportEnvelope({ ...DEFAULT_CONFIG });
    const result = validateExportPayload(env);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object input", () => {
    expect(validateExportPayload("string").ok).toBe(false);
    expect(validateExportPayload(null).ok).toBe(false);
    expect(validateExportPayload([]).ok).toBe(false);
  });

  it("reports missing appVersion", () => {
    const env = buildExportEnvelope({ ...DEFAULT_CONFIG });
    delete (env as Record<string, unknown>)["appVersion"];
    const result = validateExportPayload(env);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing or invalid appVersion");
  });

  it("reports invalid configSchemaVersion", () => {
    const env = { ...buildExportEnvelope({ ...DEFAULT_CONFIG }), configSchemaVersion: "bad" };
    const result = validateExportPayload(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("configSchemaVersion"))).toBe(true);
  });

  it("reports future configSchemaVersion", () => {
    const env = { ...buildExportEnvelope({ ...DEFAULT_CONFIG }), configSchemaVersion: 999 };
    const result = validateExportPayload(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("exceeds"))).toBe(true);
  });

  it("reports invalid exportedAt", () => {
    const env = { ...buildExportEnvelope({ ...DEFAULT_CONFIG }), exportedAt: "not-a-date" };
    const result = validateExportPayload(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("exportedAt"))).toBe(true);
  });

  it("reports invalid theme in config payload", () => {
    const env = buildExportEnvelope({ ...DEFAULT_CONFIG, theme: "neon" as never });
    const result = validateExportPayload(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("theme"))).toBe(true);
  });

  it("reports missing config payload", () => {
    const env = { ...buildExportEnvelope({ ...DEFAULT_CONFIG }) };
    delete (env as Record<string, unknown>)["config"];
    const result = validateExportPayload(env);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("config payload"))).toBe(true);
  });
});
