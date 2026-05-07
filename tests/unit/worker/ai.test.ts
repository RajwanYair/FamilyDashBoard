/**
 * Worker unit tests — Workers AI routes (ADR-030, )
 *
 * Tests that /api/news/summarise and /api/motivation/hebrew:
 *   - Return 503 when AI_ENABLED is absent/false (ai_disabled)
 *   - Return 503 when AI_ENABLED=true but AI binding absent (ai_not_configured)
 *   - Return 200 with AI text when AI binding is present and returns a response
 *   - Serve from KV cache when a cached entry exists
 *   - Return 502 when AI.run() throws
 * added handleAiSynthesis describe block (lines 174-229 coverage).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleNewsSummarise,
  handleMotivationHebrew,
  handleAiSynthesis,
} from "../../../worker/src/routes/ai";
import type { Env, AiBinding } from "../../../worker/src/types";

/** Minimal Env stub with no AI_ENABLED set. */
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: async () => null,
      put: async () => undefined,
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    },
    ...overrides,
  } as unknown as Env;
}

/** Minimal AiBinding stub that returns a given text. */
function makeAiBinding(text: string): AiBinding {
  return {
    run: vi.fn().mockResolvedValue({ response: text }),
  };
}

// ── /api/news/summarise — AI disabled ─────────────────────────────────────────

describe("handleNewsSummarise — AI disabled (no AI_ENABLED)", () => {
  it("returns 503 status", async () => {
    const res = await handleNewsSummarise(makeEnv());
    expect(res.status).toBe(503);
  });

  it("returns JSON body with ok:false and error:ai_disabled", async () => {
    const res = await handleNewsSummarise(makeEnv());
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_disabled" });
  });

  it("sets Content-Type: application/json", async () => {
    const res = await handleNewsSummarise(makeEnv());
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});

describe("handleNewsSummarise — AI explicitly disabled (AI_ENABLED='false')", () => {
  it("returns 503 when AI_ENABLED is 'false'", async () => {
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "false" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when AI_ENABLED is empty string", async () => {
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "" }));
    expect(res.status).toBe(503);
  });
});

// ── /api/news/summarise — AI enabled but binding absent ──────────────────────

describe("handleNewsSummarise — AI_ENABLED=true but no AI binding", () => {
  it("returns 503 with ai_not_configured", async () => {
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "true" }));
    expect(res.status).toBe(503);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_not_configured" });
  });
});

// ── /api/news/summarise — AI enabled with binding ────────────────────────────

describe("handleNewsSummarise — AI enabled with binding", () => {
  let ai: AiBinding;

  beforeEach(() => {
    ai = makeAiBinding("סיכום חדשות היום בעברית.");
  });

  it("returns 200 with ok:true when AI responds", async () => {
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "true", AI: ai }));
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; data: { summary: string }; source: string }>();
    expect(body.ok).toBe(true);
    expect(body.data.summary).toBe("סיכום חדשות היום בעברית.");
    expect(body.source).toBe("ai");
  });

  it("stores the result in KV cache", async () => {
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({
      AI_ENABLED: "true",
      AI: ai,
      CACHE_KV: {
        get: async () => null,
        put: mockPut,
        list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    await handleNewsSummarise(env);
    expect(mockPut).toHaveBeenCalledOnce();
    const [key] = mockPut.mock.calls[0] as [string, ...unknown[]];
    expect(key).toMatch(/^ai:news-summary:\d{4}-\d{2}-\d{2}$/);
  });

  it("serves from KV cache when cached entry exists", async () => {
    const cachedData = JSON.stringify({ summary: "cached summary" });
    const env = makeEnv({
      AI_ENABLED: "true",
      AI: ai,
      CACHE_KV: {
        get: async () => cachedData,
        put: async () => undefined,
        list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    const res = await handleNewsSummarise(env);
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; source: string }>();
    expect(body.source).toBe("cache");
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("returns 502 when AI.run() throws", async () => {
    const failingAi: AiBinding = { run: vi.fn().mockRejectedValue(new Error("AI unavailable")) };
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "true", AI: failingAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_error" });
  });

  it("returns 502 ai_empty_response when AI returns undefined response ", async () => {
    const emptyAi: AiBinding = { run: vi.fn().mockResolvedValue({}) };
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "true", AI: emptyAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_empty_response" });
  });

  it("returns 502 ai_empty_response when AI returns a ReadableStream ", async () => {
    const streamAi: AiBinding = {
      run: vi.fn().mockResolvedValue(new ReadableStream()),
    };
    const res = await handleNewsSummarise(makeEnv({ AI_ENABLED: "true", AI: streamAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_empty_response" });
  });
});

describe("handleMotivationHebrew — AI disabled (no AI_ENABLED)", () => {
  it("returns 503 status", async () => {
    const res = await handleMotivationHebrew(makeEnv());
    expect(res.status).toBe(503);
  });

  it("returns JSON body with ok:false and error:ai_disabled", async () => {
    const res = await handleMotivationHebrew(makeEnv());
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_disabled" });
  });

  it("sets Content-Type: application/json", async () => {
    const res = await handleMotivationHebrew(makeEnv());
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});

describe("handleMotivationHebrew — AI explicitly disabled (AI_ENABLED='false')", () => {
  it("returns 503 when AI_ENABLED is 'false'", async () => {
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "false" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when AI_ENABLED is empty string", async () => {
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "" }));
    expect(res.status).toBe(503);
  });
});

// ── /api/motivation/hebrew — AI enabled but binding absent ───────────────────

describe("handleMotivationHebrew — AI_ENABLED=true but no AI binding", () => {
  it("returns 503 with ai_not_configured", async () => {
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "true" }));
    expect(res.status).toBe(503);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_not_configured" });
  });
});

// ── /api/motivation/hebrew — AI enabled with binding ─────────────────────────

describe("handleMotivationHebrew — AI enabled with binding", () => {
  let ai: AiBinding;

  beforeEach(() => {
    ai = makeAiBinding("כל יום הוא מתנה חדשה.");
  });

  it("returns 200 with ok:true when AI responds", async () => {
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "true", AI: ai }));
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; data: { quote: string }; source: string }>();
    expect(body.ok).toBe(true);
    expect(body.data.quote).toBe("כל יום הוא מתנה חדשה.");
    expect(body.source).toBe("ai");
  });

  it("stores the result in KV cache", async () => {
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({
      AI_ENABLED: "true",
      AI: ai,
      CACHE_KV: {
        get: async () => null,
        put: mockPut,
        list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    await handleMotivationHebrew(env);
    expect(mockPut).toHaveBeenCalledOnce();
    const [key] = mockPut.mock.calls[0] as [string, ...unknown[]];
    expect(key).toMatch(/^ai:motivation-he:\d{4}-\d{2}-\d{2}$/);
  });

  it("serves from KV cache when cached entry exists", async () => {
    const cachedData = JSON.stringify({ quote: "cached quote" });
    const env = makeEnv({
      AI_ENABLED: "true",
      AI: ai,
      CACHE_KV: {
        get: async () => cachedData,
        put: async () => undefined,
        list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    const res = await handleMotivationHebrew(env);
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; source: string }>();
    expect(body.source).toBe("cache");
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("returns 502 when AI.run() throws", async () => {
    const failingAi: AiBinding = { run: vi.fn().mockRejectedValue(new Error("AI unavailable")) };
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "true", AI: failingAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_error" });
  });

  it("returns 502 ai_empty_response when AI returns undefined response ", async () => {
    const emptyAi: AiBinding = { run: vi.fn().mockResolvedValue({}) };
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "true", AI: emptyAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_empty_response" });
  });

  it("returns 502 ai_empty_response when AI returns a ReadableStream ", async () => {
    const streamAi: AiBinding = {
      run: vi.fn().mockResolvedValue(new ReadableStream()),
    };
    const res = await handleMotivationHebrew(makeEnv({ AI_ENABLED: "true", AI: streamAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_empty_response" });
  });
});

// ── /api/ai/synthesis — ───────────────────────────────────────────

describe("handleAiSynthesis — AI disabled (no AI_ENABLED)", () => {
  it("returns 503 with ai_disabled", async () => {
    const res = await handleAiSynthesis(makeEnv());
    expect(res.status).toBe(503);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_disabled" });
  });
});

describe("handleAiSynthesis — AI explicitly disabled (AI_ENABLED='false')", () => {
  it("returns 503 when AI_ENABLED is 'false'", async () => {
    const res = await handleAiSynthesis(makeEnv({ AI_ENABLED: "false" }));
    expect(res.status).toBe(503);
  });
});

describe("handleAiSynthesis — AI_ENABLED=true but no AI binding", () => {
  it("returns 503 with ai_not_configured", async () => {
    const res = await handleAiSynthesis(makeEnv({ AI_ENABLED: "true" }));
    expect(res.status).toBe(503);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_not_configured" });
  });
});

describe("handleAiSynthesis — AI enabled with binding", () => {
  let ai: AiBinding;

  beforeEach(() => {
    ai = makeAiBinding("היום הוא יום מיוחד ומלא אפשרויות.");
  });

  it("returns 200 with ok:true and synthesis field", async () => {
    const res = await handleAiSynthesis(makeEnv({ AI_ENABLED: "true", AI: ai }));
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; data: { synthesis: string }; source: string }>();
    expect(body.ok).toBe(true);
    expect(body.data.synthesis).toBe("היום הוא יום מיוחד ומלא אפשרויות.");
    expect(body.source).toBe("ai");
  });

  it("stores the result in KV cache with synthesis key", async () => {
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const env = makeEnv({
      AI_ENABLED: "true",
      AI: ai,
      CACHE_KV: {
        get: async () => null,
        put: mockPut,
        list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    await handleAiSynthesis(env);
    expect(mockPut).toHaveBeenCalledOnce();
    const [key] = mockPut.mock.calls[0] as [string, ...unknown[]];
    expect(key).toMatch(/^ai:synthesis:\d{4}-\d{2}-\d{2}:\d+$/);
  });

  it("serves from KV cache when cached entry exists", async () => {
    const cachedData = JSON.stringify({ synthesis: "cached synthesis" });
    const env = makeEnv({
      AI_ENABLED: "true",
      AI: ai,
      CACHE_KV: {
        get: async () => cachedData,
        put: async () => undefined,
        list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
      },
    });
    const res = await handleAiSynthesis(env);
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean; source: string }>();
    expect(body.source).toBe("cache");
    expect(ai.run).not.toHaveBeenCalled();
  });

  it("returns 502 when AI.run() throws", async () => {
    const failingAi: AiBinding = { run: vi.fn().mockRejectedValue(new Error("AI unavailable")) };
    const res = await handleAiSynthesis(makeEnv({ AI_ENABLED: "true", AI: failingAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_error" });
  });

  it("returns 502 ai_empty_response when AI returns undefined response", async () => {
    const emptyAi: AiBinding = { run: vi.fn().mockResolvedValue({}) };
    const res = await handleAiSynthesis(makeEnv({ AI_ENABLED: "true", AI: emptyAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_empty_response" });
  });

  it("returns 502 ai_empty_response when AI returns a ReadableStream", async () => {
    const streamAi: AiBinding = { run: vi.fn().mockResolvedValue(new ReadableStream()) };
    const res = await handleAiSynthesis(makeEnv({ AI_ENABLED: "true", AI: streamAi }));
    expect(res.status).toBe(502);
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_empty_response" });
  });
});
