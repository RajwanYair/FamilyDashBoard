/**
 * Worker unit tests — AI stub routes (V13-S20)
 *
 * Tests that /api/news/summarise and /api/motivation/hebrew return 503 when
 * AI_ENABLED is absent/false, and 501 when AI_ENABLED is "true" (future impl).
 */

import { describe, it, expect } from "vitest";
import { handleNewsSummarise, handleMotivationHebrew } from "../../../worker/src/routes/ai";
import type { Env } from "../../../worker/src/types";

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

// ── /api/news/summarise ───────────────────────────────────────────────────────

describe("handleNewsSummarise — AI disabled (no AI_ENABLED)", () => {
  it("returns 503 status", async () => {
    const res = handleNewsSummarise(makeEnv());
    expect(res.status).toBe(503);
  });

  it("returns JSON body with ok:false and error:ai_disabled", async () => {
    const res = handleNewsSummarise(makeEnv());
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_disabled" });
  });

  it("sets Content-Type: application/json", () => {
    const res = handleNewsSummarise(makeEnv());
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});

describe("handleNewsSummarise — AI explicitly disabled (AI_ENABLED='false')", () => {
  it("returns 503 when AI_ENABLED is 'false'", () => {
    const res = handleNewsSummarise(makeEnv({ AI_ENABLED: "false" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when AI_ENABLED is empty string", () => {
    const res = handleNewsSummarise(makeEnv({ AI_ENABLED: "" }));
    expect(res.status).toBe(503);
  });
});

describe("handleNewsSummarise — AI enabled (AI_ENABLED='true')", () => {
  it("returns 501 (not yet implemented) when AI_ENABLED is 'true'", () => {
    const res = handleNewsSummarise(makeEnv({ AI_ENABLED: "true" }));
    expect(res.status).toBe(501);
  });

  it("returns JSON body with ok:false and error:ai_not_implemented", async () => {
    const res = handleNewsSummarise(makeEnv({ AI_ENABLED: "true" }));
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_not_implemented" });
  });
});

// ── /api/motivation/hebrew ────────────────────────────────────────────────────

describe("handleMotivationHebrew — AI disabled (no AI_ENABLED)", () => {
  it("returns 503 status", async () => {
    const res = handleMotivationHebrew(makeEnv());
    expect(res.status).toBe(503);
  });

  it("returns JSON body with ok:false and error:ai_disabled", async () => {
    const res = handleMotivationHebrew(makeEnv());
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_disabled" });
  });

  it("sets Content-Type: application/json", () => {
    const res = handleMotivationHebrew(makeEnv());
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });
});

describe("handleMotivationHebrew — AI explicitly disabled (AI_ENABLED='false')", () => {
  it("returns 503 when AI_ENABLED is 'false'", () => {
    const res = handleMotivationHebrew(makeEnv({ AI_ENABLED: "false" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when AI_ENABLED is empty string", () => {
    const res = handleMotivationHebrew(makeEnv({ AI_ENABLED: "" }));
    expect(res.status).toBe(503);
  });
});

describe("handleMotivationHebrew — AI enabled (AI_ENABLED='true')", () => {
  it("returns 501 (not yet implemented) when AI_ENABLED is 'true'", () => {
    const res = handleMotivationHebrew(makeEnv({ AI_ENABLED: "true" }));
    expect(res.status).toBe(501);
  });

  it("returns JSON body with ok:false and error:ai_not_implemented", async () => {
    const res = handleMotivationHebrew(makeEnv({ AI_ENABLED: "true" }));
    const body = await res.json<{ ok: boolean; error: string }>();
    expect(body).toEqual({ ok: false, error: "ai_not_implemented" });
  });
});
