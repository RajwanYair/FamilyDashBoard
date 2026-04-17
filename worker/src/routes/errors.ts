/**
 * FamilyDashBoard Worker — POST /api/errors
 *
 * Lightweight error ingestion endpoint. Accepts an array of ErrorEntry objects
 * from the dashboard client, logs them to Worker console (appears in CF logpush
 * and live tail), and returns 204 No Content.
 *
 * No persistence required — this is a best-effort telemetry signal.
 * Rate-limiting is handled by the shared middleware in index.ts.
 */

import { jsonResponse } from "../utils/response";

/** Minimal shape of an error entry sent by the client. */
interface ErrorPayload {
  ts: number;
  message: string;
  source?: string;
  lineno?: number;
}

const MAX_ERRORS_PER_REQUEST = 20;
const MAX_MESSAGE_LENGTH = 500;

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

/**
 * Handle POST /api/errors
 *
 * Expects: Content-Type application/json, body = ErrorPayload[]
 * Returns: 204 on success, 400 on invalid input, 413 if too many entries.
 */
export async function handleErrors(request: Request): Promise<Response> {
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

  return new Response(null, { status: 204 });
}
