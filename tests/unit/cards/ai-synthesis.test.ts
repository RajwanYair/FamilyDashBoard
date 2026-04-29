/**
 * Tests for src/cards/ai-synthesis/ai-synthesis.ts (Sprint 202 / X9)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cClear } from "@/core/cache";

// All imports lazy-resolved after mocks are set up
let fetchSynthesis: () => Promise<string | null>;
let _resetAiSynthesisForTest: () => void;

describe("AI Synthesis Card (Sprint 202 / X9)", () => {
  beforeEach(async () => {
    cClear();
    vi.stubGlobal("__APP_VERSION__", "13.22.0");

    // Reset module to clear any cached singleton state
    vi.resetModules();

    // Re-import after reset
    const mod = await import("@/cards/ai-synthesis/ai-synthesis");
    fetchSynthesis = mod.fetchSynthesis;
    _resetAiSynthesisForTest = mod._resetAiSynthesisForTest;

    _resetAiSynthesisForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cClear();
  });

  it("fetchSynthesis returns null when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const result = await fetchSynthesis();
    expect(result).toBeNull();
  });

  it("fetchSynthesis returns null when server returns !ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );
    const result = await fetchSynthesis();
    expect(result).toBeNull();
  });

  it("fetchSynthesis returns null when json ok=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: "ai_disabled" }),
      }),
    );
    const result = await fetchSynthesis();
    expect(result).toBeNull();
  });

  it("fetchSynthesis returns synthesis string on success", async () => {
    const expected = "היום הוא יום נפלא לפעילות משפחתית";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: { synthesis: expected }, source: "ai" }),
      }),
    );
    const result = await fetchSynthesis();
    expect(result).toBe(expected);
  });

  it("fetchSynthesis returns null when data.synthesis is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: {} }),
      }),
    );
    const result = await fetchSynthesis();
    expect(result).toBeNull();
  });
});
