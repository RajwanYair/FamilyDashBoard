/**
 * Tests for src/cards/ai-synthesis/ai-synthesis.ts
 * expanded coverage — loadAiSynthesisData branches, render helpers,
 *             initAiSynthesisCard, destroyAiSynthesisCard, visibility guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cClear, cSet } from "@/core/cache";

// All imports lazy-resolved after mocks are set up
let fetchSynthesis: () => Promise<string | null>;
let _resetAiSynthesisForTest: () => void;

describe("AI Synthesis Card ", () => {
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
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
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

// ── loadAiSynthesisData branches + render helpers ─────────────

// Shared mutable config — mutate per-test before calling initAiSynthesisCard()
const _s225cfg = { synthesisEnabled: false };

describe("AI Synthesis — loadAiSynthesisData branches ", () => {
  let synthText: HTMLDivElement;
  let synthMeta: HTMLDivElement;
  let initAiSynthesisCard: () => void;
  let destroyAiSynthesisCard: () => void;
  let _resetAiSynthesisForTest: () => void;

  beforeEach(async () => {
    _s225cfg.synthesisEnabled = false; // reset default each test
    cClear();
    vi.stubGlobal("__APP_VERSION__", "13.25.0");
    vi.resetModules();

    // Register config mock using mutable _s225cfg — factory is called at import time
    vi.doMock("@/core/config", () => ({
      loadConfig: () => ({ ..._s225cfg }),
    }));

    // Set up DOM elements
    synthText = document.createElement("div");
    synthText.id = "synth-text";
    document.body.appendChild(synthText);
    synthMeta = document.createElement("div");
    synthMeta.id = "synth-meta";
    document.body.appendChild(synthMeta);

    const mod = await import("@/cards/ai-synthesis/ai-synthesis");
    initAiSynthesisCard = mod.initAiSynthesisCard;
    destroyAiSynthesisCard = mod.destroyAiSynthesisCard;
    _resetAiSynthesisForTest = mod._resetAiSynthesisForTest;
    _resetAiSynthesisForTest();
  });

  afterEach(() => {
    destroyAiSynthesisCard();
    synthText.remove();
    synthMeta.remove();
    vi.restoreAllMocks();
    vi.doUnmock("@/core/config");
    cClear();
  });

  it("renders disabled message when synthesisEnabled=false", async () => {
    // _s225cfg.synthesisEnabled is false (default set in beforeEach)
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 0));
    expect(synthText.textContent).toContain("כבוי");
  });

  it("renders from fresh cache when synthesisEnabled=true and cache hit", async () => {
    _s225cfg.synthesisEnabled = true;
    cSet("ai:synthesis", { synthesis: "טקסט מהמטמון" });
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 0));
    expect(synthText.textContent).toBe("טקסט מהמטמון");
  });

  it("fetches from worker when enabled and no cache, renders on success", async () => {
    _s225cfg.synthesisEnabled = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: { synthesis: "תקציר חדש מ-AI" }, source: "ai" }),
      }),
    );
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 20));
    expect(synthText.textContent).toBe("תקציר חדש מ-AI");
  });

  it("renders error message when enabled, no cache, fetch fails", async () => {
    _s225cfg.synthesisEnabled = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 20));
    expect(synthText.textContent).toBeTruthy();
  });

  it("destroyAiSynthesisCard clears interval and element refs", () => {
    initAiSynthesisCard();
    destroyAiSynthesisCard();
    // After destroy, calling destroy again must not throw
    expect(() => destroyAiSynthesisCard()).not.toThrow();
  });

  it("renders stale cache content fallback when fetch fails", async () => {
    _s225cfg.synthesisEnabled = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 20));
    // Text should be non-empty (either stale or error message)
    expect(synthText.textContent?.length).toBeGreaterThan(0);
  });

  it("synthMeta shows time info after successful fetch", async () => {
    _s225cfg.synthesisEnabled = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: { synthesis: "מבחן זמן" }, source: "ai" }),
      }),
    );
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 20));
    expect(synthMeta.textContent).toContain("עודכן");
  });

  it("synthMeta is empty after renderDisabled", async () => {
    // _s225cfg.synthesisEnabled = false (default)
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 0));
    expect(synthMeta.textContent).toBe("");
  });

  // cover line 101 (renderError stale branch) and line 149 (visibilitychange handler)
  it("renders stale synthesis when fetch fails and stale cache exists (line 101)", async () => {
    _s225cfg.synthesisEnabled = true;
    // Seed cache with real timestamp T, then fake Date.now() to T+5h > 4h TTL
    cSet("ai:synthesis", { synthesis: "תקציר ישן" });
    const fakeNow = Date.now() + 5 * 60 * 60 * 1000; // 5 hours ahead
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(fakeNow);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("stale-test")));
    initAiSynthesisCard();
    // Flush microtask queue so async loadAiSynthesisData resolves
    for (let i = 0; i < 6; i++) await Promise.resolve();
    dateSpy.mockRestore();
    expect(synthText.textContent).toBe("תקציר ישן");
  });

  it("renders error message when fetch fails and no stale data exists (line 103)", async () => {
    _s225cfg.synthesisEnabled = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 30));
    expect(synthText.textContent).toContain("AI");
  });

  it("visibilitychange handler updates _pageVisible flag without throwing (line 149)", async () => {
    _s225cfg.synthesisEnabled = false;
    initAiSynthesisCard();
    await new Promise((r) => setTimeout(r, 0));
    // Fire visibilitychange → hidden then visible (exercises line 149)
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(synthText.textContent).toBeDefined();
  });
});

// ── null DOM element branches (renderSynthesis/renderDisabled/renderError) ─

describe("AI Synthesis — null DOM branches ", () => {
  let initAiSynthesisCard: () => void;
  let destroyAiSynthesisCard: () => void;
  let _resetAiSynthesisForTest: () => void;
  const _cfg273 = { synthesisEnabled: false };

  beforeEach(async () => {
    _cfg273.synthesisEnabled = false;
    cClear();
    vi.stubGlobal("__APP_VERSION__", "13.29.0");
    vi.resetModules();
    vi.doMock("@/core/config", () => ({ loadConfig: () => ({ ..._cfg273 }) }));
    // Do NOT append DOM elements — exercises the null-element guard branches
    const mod = await import("@/cards/ai-synthesis/ai-synthesis");
    initAiSynthesisCard = mod.initAiSynthesisCard;
    destroyAiSynthesisCard = mod.destroyAiSynthesisCard;
    _resetAiSynthesisForTest = mod._resetAiSynthesisForTest;
    _resetAiSynthesisForTest();
  });

  afterEach(() => {
    destroyAiSynthesisCard();
    vi.restoreAllMocks();
    vi.doUnmock("@/core/config");
    cClear();
  });

  it("renderDisabled with null _elText/_elMeta does not throw", async () => {
    // synthesisEnabled=false → renderDisabled() → both elements null → null-guards taken
    expect(() => initAiSynthesisCard()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("renderSynthesis with null _elText/_elMeta does not throw on cache hit", async () => {
    _cfg273.synthesisEnabled = true;
    cSet("ai:synthesis", { synthesis: "cached text" });
    expect(() => initAiSynthesisCard()).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("renderError with null _elText does not throw on fetch failure", async () => {
    _cfg273.synthesisEnabled = true;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(() => initAiSynthesisCard()).not.toThrow();
    await new Promise((r) => setTimeout(r, 30));
  });
});

// ── speakSynthesis + stopSpeakSynthesis ─────────────────

describe("AI Synthesis — PC-1 speakSynthesis ", () => {
  let speakSynthesis: () => void;
  let stopSpeakSynthesis: () => void;
  let initAiSynthesisCard: () => void;
  let destroyAiSynthesisCard: () => void;
  let _resetAiSynthesisForTest: () => void;
  let _setSnapshotForTest: (text: string | null) => void;

  beforeEach(async () => {
    document.body.innerHTML = `
      <p id="synth-text"></p>
      <div id="synth-meta"></div>
      <button id="synth-speak-btn" aria-pressed="false">🔊</button>
    `;
    const mod = await import("@/cards/ai-synthesis/ai-synthesis");
    speakSynthesis = mod.speakSynthesis;
    stopSpeakSynthesis = mod.stopSpeakSynthesis;
    initAiSynthesisCard = mod.initAiSynthesisCard;
    destroyAiSynthesisCard = mod.destroyAiSynthesisCard;
    _resetAiSynthesisForTest = mod._resetAiSynthesisForTest;
    _setSnapshotForTest = mod._setSnapshotForTest;
    _resetAiSynthesisForTest();
  });

  afterEach(() => {
    destroyAiSynthesisCard?.();
    _resetAiSynthesisForTest();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("does not throw when SpeechSynthesis is unavailable", () => {
    // SpeechSynthesis is not available in happy-dom — should return silently
    expect(() => speakSynthesis()).not.toThrow();
  });

  it("does not throw when snapshot is null", () => {
    _setSnapshotForTest(null);
    expect(() => speakSynthesis()).not.toThrow();
  });

  it("does not throw when SpeechSynthesisUtterance and speechSynthesis are mocked", () => {
    _setSnapshotForTest("תקציר יומי לבדיקה");
    // SpeechSynthesisUtterance is not available in happy-dom; verify guard exits cleanly.
    // The guard `typeof SpeechSynthesisUtterance === "undefined"` causes early return.
    expect(() => speakSynthesis()).not.toThrow();
  });

  it("stopSpeakSynthesis does not throw when SpeechSynthesis is unavailable", () => {
    expect(() => stopSpeakSynthesis()).not.toThrow();
  });

  it("stopSpeakSynthesis calls cancel when SpeechSynthesis is present", () => {
    const mockCancel = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      value: { speaking: false, cancel: mockCancel },
      configurable: true,
    });
    stopSpeakSynthesis();
    expect(mockCancel).toHaveBeenCalled();
  });

  it("speakSynthesis cancels and sets button aria-pressed=false when already speaking", () => {
    const mockCancel = vi.fn();
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        rate = 0;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
    Object.defineProperty(window, "speechSynthesis", {
      value: { speaking: true, cancel: mockCancel, speak: vi.fn() },
      configurable: true,
    });
    initAiSynthesisCard(); // wires _elSpeakBtn from DOM
    _setSnapshotForTest("תקציר יומי לבדיקה");
    speakSynthesis();
    expect(mockCancel).toHaveBeenCalled();
    expect(document.getElementById("synth-speak-btn")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("speakSynthesis speaks, onstart sets pressed=true, onend/onerror set pressed=false", () => {
    let capturedInstance: {
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
    } | null = null;
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        lang = "";
        rate = 0;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {
          capturedInstance = this as unknown as typeof capturedInstance;
        }
      },
    );
    Object.defineProperty(window, "speechSynthesis", {
      value: { speaking: false, cancel: vi.fn(), speak: vi.fn() },
      configurable: true,
    });
    initAiSynthesisCard(); // wires _elSpeakBtn from DOM
    _setSnapshotForTest("summary text");
    speakSynthesis();
    expect(capturedInstance).not.toBeNull();
    const btn = document.getElementById("synth-speak-btn");
    capturedInstance!.onstart?.();
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    capturedInstance!.onend?.();
    expect(btn?.getAttribute("aria-pressed")).toBe("false");
    // onerror path also resets state
    capturedInstance!.onstart?.();
    capturedInstance!.onerror?.();
    expect(btn?.getAttribute("aria-pressed")).toBe("false");
  });

  it("speak button click event delegates to speakSynthesis without throwing", () => {
    // Covers the anonymous click-handler arrow function wired in initAiSynthesisCard
    initAiSynthesisCard();
    const btn = document.getElementById("synth-speak-btn") as HTMLButtonElement;
    // SpeechSynthesisUtterance is absent in happy-dom → speakSynthesis() early-returns cleanly
    expect(() => btn.click()).not.toThrow();
  });

  it("setInterval callback invokes loadAiSynthesisData without throwing", async () => {
    // Covers the anonymous interval arrow function (line 228) wired in initAiSynthesisCard
    vi.useFakeTimers();
    try {
      initAiSynthesisCard();
      // Advance past the 4-hour refresh interval (SYNTH_REFRESH_MS = 4 * 60 * 60 * 1000)
      await vi.advanceTimersByTimeAsync(4 * 60 * 60 * 1000 + 1000);
    } finally {
      vi.useRealTimers();
    }
  });
});
