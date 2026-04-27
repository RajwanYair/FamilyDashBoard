/**
 * FamilyDashBoard Worker — Workers AI routes (ADR-030, V13-AI-1).
 *
 * When AI_ENABLED env var is not "true", both routes return a clear 503 to the
 * client so the dashboard can fall back gracefully.
 *
 * When AI_ENABLED=true and the AI binding is present, both routes call
 * Workers AI (@cf/meta/llama-3.3-70b-instruct) and cache results in KV for 1 hour.
 *
 * Routes:
 *   GET  /api/news/summarise       → Hebrew news summarisation
 *   GET  /api/motivation/hebrew    → Daily Hebrew motivational quote
 */

import type { Env, AiTextGenerationOutput } from "../types";
import { kvGetStale, kvPut } from "../utils/kv";

const AI_DISABLED_RESPONSE = { ok: false, error: "ai_disabled" } as const;
const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct";
const AI_CACHE_TTL = 3600; // 1 hour

/** Extract text from AI output (non-streaming only). */
function extractText(output: AiTextGenerationOutput | ReadableStream): string | null {
  if (output instanceof ReadableStream) return null;
  return output.response ?? null;
}

/**
 * GET /api/news/summarise
 *
 * When AI is enabled: calls Workers AI to produce a 2-sentence Hebrew news summary.
 * Caches result in KV for 1 hour keyed by "ai:news-summary:<date>".
 * When AI is disabled: returns 503 {"ok":false,"error":"ai_disabled"}.
 */
export async function handleNewsSummarise(env: Env): Promise<Response> {
  if (env.AI_ENABLED !== "true") {
    return new Response(JSON.stringify(AI_DISABLED_RESPONSE), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!env.AI) {
    return new Response(JSON.stringify({ ok: false, error: "ai_not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `ai:news-summary:${today}`;

  // Try KV cache first
  const cached = await kvGetStale<{ summary: string }>(env.CACHE_KV, cacheKey);
  if (cached) {
    const { _stale: _, ...data } = cached;
    return new Response(JSON.stringify({ ok: true, data, source: "cache" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const output = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "אתה עוזר חדשות. סכם את חדשות היום בעברית בשתי משפטות קצרות.",
        },
        {
          role: "user",
          content: `סכם את חדשות ${today} בעברית בשתי משפטות.`,
        },
      ],
      max_tokens: 200,
    });
    const text = extractText(output);
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: "ai_empty_response" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = { summary: text };
    await kvPut(env.CACHE_KV, cacheKey, data, AI_CACHE_TTL);
    return new Response(JSON.stringify({ ok: true, data, source: "ai" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "ai_error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * GET /api/motivation/hebrew
 *
 * When AI is enabled: calls Workers AI for a Hebrew motivational quote.
 * Caches result in KV for 1 hour keyed by "ai:motivation-he:<date>".
 * When AI is disabled: returns 503 {"ok":false,"error":"ai_disabled"}.
 */
export async function handleMotivationHebrew(env: Env): Promise<Response> {
  if (env.AI_ENABLED !== "true") {
    return new Response(JSON.stringify(AI_DISABLED_RESPONSE), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!env.AI) {
    return new Response(JSON.stringify({ ok: false, error: "ai_not_configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `ai:motivation-he:${today}`;

  const cached = await kvGetStale<{ quote: string }>(env.CACHE_KV, cacheKey);
  if (cached) {
    const { _stale: _, ...data } = cached;
    return new Response(JSON.stringify({ ok: true, data, source: "cache" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const output = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "אתה מורה מעורר השראה. ספק ציטוט יומי מעורר השראה בעברית.",
        },
        {
          role: "user",
          content: "תן לי ציטוט מעורר השראה קצר בעברית ליום זה.",
        },
      ],
      max_tokens: 150,
    });
    const text = extractText(output);
    if (!text) {
      return new Response(JSON.stringify({ ok: false, error: "ai_empty_response" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const data = { quote: text };
    await kvPut(env.CACHE_KV, cacheKey, data, AI_CACHE_TTL);
    return new Response(JSON.stringify({ ok: true, data, source: "ai" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "ai_error" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
