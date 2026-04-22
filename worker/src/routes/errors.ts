/**
 * FamilyDashBoard Worker — POST /api/errors · GET /api/errors/export
 *
 * POST /api/errors
 *   Accepts ErrorPayload[] from the dashboard client, validates, logs to
 *   Worker console, and persists each entry to KV with a 7-day TTL.
 *   Also maintains a daily counter key (errors:count:YYYY-MM-DD, 7-day TTL).
 *   Rate-limited to 1000 entries/day via the counter; excess entries are
 *   still logged but not stored.
 *
 * GET /api/errors/export?token=<SECRET>
 *   Returns the KV entries stored today as JSON array.
 *   Requires ERROR_REPORTING_TOKEN env secret.  Returns 501 when not set.
 */

import { jsonResponse, CORS_HEADERS } from "../utils/response";
import type { Env, KVStore } from "../types";

/** Minimal shape of an error entry sent by the client. */
interface ErrorPayload {
  ts: number;
  message: string;
  source?: string;
  lineno?: number;
}

const MAX_ERRORS_PER_REQUEST = 20;
const MAX_MESSAGE_LENGTH = 500;
/** Daily write cap — prevents KV quota exhaustion from a single client loop. */
const MAX_ERRORS_PER_DAY = 1000;
/** KV TTL for persisted error entries and counters: 7 days. */
const ERROR_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Validate and sanitize a single error entry. */
function isValidEntry(e: unknown): e is ErrorPayload {
  if (typeof e !== "object" || e === null) return false;
  const entry = e as Record<string, unknown>;
  return (
    typeof entry["ts"] === "number" &&
    isFinite(entry["ts"] as number) &&
    typeof entry["message"] === "string" &&
    (entry["source"] === undefined || typeof entry["source"] === "string") &&
    (entry["lineno"] === undefined || typeof entry["lineno"] === "number")
  );
}

/** Return today's date string in UTC (YYYY-MM-DD). */
function utcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Generate an 8-character random hex ID for KV key uniqueness. */
function shortId(): string {
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
}

/**
 * Read the daily error counter from KV.
 * Returns 0 on miss or parse failure.
 */
async function getDailyCount(kv: KVStore, dateKey: string): Promise<number> {
  try {
    const raw = await kv.get(`errors:count:${dateKey}`);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/**
 * Increment the daily error counter by `delta`.
 * Non-fatal — KV write failures are silently ignored.
 */
async function incrementDailyCount(
  kv: KVStore,
  dateKey: string,
  current: number,
  delta: number,
): Promise<void> {
  try {
    await kv.put(`errors:count:${dateKey}`, String(current + delta), {
      expirationTtl: ERROR_TTL_SECONDS,
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Handle POST /api/errors
 *
 * Expects: Content-Type application/json, body = ErrorPayload[]
 * Returns: 204 on success, 400 on invalid input, 413 if too many entries.
 */
export async function handleErrors(request: Request, env?: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!Array.isArray(body)) {
    return jsonResponse({ error: "Expected array of error entries" }, 400);
  }

  if (body.length > MAX_ERRORS_PER_REQUEST) {
    return jsonResponse({ error: "Too many error entries" }, 413);
  }

  const valid: ErrorPayload[] = [];
  for (const entry of body) {
    if (isValidEntry(entry)) {
      valid.push({
        ts: entry.ts,
        message: entry.message.slice(0, MAX_MESSAGE_LENGTH),
        source: entry.source,
        lineno: entry.lineno,
      });
    }
  }

  if (valid.length === 0) {
    return jsonResponse({ error: "No valid error entries" }, 400);
  }

  // Log to Worker console (visible in CF logpush / live tail)
  for (const e of valid) {
    const src = e.source ? ` @ ${e.source}` : "";
    const line = e.lineno != null ? `:${e.lineno}` : "";
    console.error(`[FDB-error] ${new Date(e.ts).toISOString()}${src}${line} ${e.message}`);
  }

  // Persist to KV if available
  if (env?.CACHE_KV) {
    const dateKey = utcDateKey();
    const dailyCount = await getDailyCount(env.CACHE_KV, dateKey);

    if (dailyCount < MAX_ERRORS_PER_DAY) {
      // Write each entry under errors:YYYY-MM-DD:<8-char-id>
      const writePromises = valid.map((e) =>
        env.CACHE_KV.put(`errors:${dateKey}:${shortId()}`, JSON.stringify(e), {
          expirationTtl: ERROR_TTL_SECONDS,
        }).catch(() => {
          /* non-fatal */
        }),
      );
      await Promise.allSettled(writePromises);
      await incrementDailyCount(env.CACHE_KV, dateKey, dailyCount, valid.length);
    }
  }

  return new Response(null, { status: 204 });
}

/**
 * Handle GET /api/errors/export?token=<SECRET>
 *
 * Lists all error entries stored today and returns them as JSON.
 * Requires ERROR_REPORTING_TOKEN to be configured as a Worker secret.
 */
export async function handleErrorsExport(request: Request, env: Env): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  if (!env.ERROR_REPORTING_TOKEN) {
    return jsonResponse({ error: "Export endpoint not configured" }, 501);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token || token !== env.ERROR_REPORTING_TOKEN) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const dateKey = utcDateKey();
  const prefix = `errors:${dateKey}:`;
  let entries: ErrorPayload[] = [];

  try {
    const list = await env.CACHE_KV.list({ prefix });
    const fetchPromises = list.keys.map((k) =>
      env.CACHE_KV.get(k.name).then((raw) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw) as ErrorPayload;
        } catch {
          return null;
        }
      }),
    );
    const results = await Promise.all(fetchPromises);
    entries = results.filter((r): r is ErrorPayload => r !== null);
    // Sort newest first
    entries.sort((a, b) => b.ts - a.ts);
  } catch {
    return jsonResponse({ error: "KV list failed" }, 502);
  }

  return new Response(JSON.stringify({ date: dateKey, count: entries.length, entries }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

