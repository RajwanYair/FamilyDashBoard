/**
 * FamilyDashBoard Worker — Workers AI stub routes (ADR-030, V13-S20).
 *
 * When AI_ENABLED env var is not "true", both routes return a clear 503 to the
 * client so the dashboard can fall back gracefully.
 *
 * Routes:
 *   GET  /api/news/summarise       → Hebrew news summarisation (AI_ENABLED=true)
 *   GET  /api/motivation/hebrew    → Daily Hebrew motivational quote (AI_ENABLED=true)
 */

import type { Env } from "../types";

const AI_DISABLED_RESPONSE = { ok: false, error: "ai_disabled" } as const;

/**
 * GET /api/news/summarise
 *
 * When AI is enabled: placeholder for Workers AI @cf/baai/bge-m3 summarisation.
 * When AI is disabled: returns 503 {"ok":false,"error":"ai_disabled"}.
 */
export function handleNewsSummarise(env: Env): Response {
  if (env.AI_ENABLED !== "true") {
    return new Response(JSON.stringify(AI_DISABLED_RESPONSE), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  // TODO (ADR-030): implement actual Workers AI summarisation when AI binding is live
  return new Response(
    JSON.stringify({ ok: false, error: "ai_not_implemented" }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * GET /api/motivation/hebrew
 *
 * When AI is enabled: placeholder for Workers AI Hebrew motivational quote.
 * When AI is disabled: returns 503 {"ok":false,"error":"ai_disabled"}.
 */
export function handleMotivationHebrew(env: Env): Response {
  if (env.AI_ENABLED !== "true") {
    return new Response(JSON.stringify(AI_DISABLED_RESPONSE), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
  // TODO (ADR-030): implement actual Workers AI Hebrew quote when AI binding is live
  return new Response(
    JSON.stringify({ ok: false, error: "ai_not_implemented" }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}
