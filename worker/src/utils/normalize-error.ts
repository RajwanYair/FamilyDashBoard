/**
 * FamilyDashBoard Worker — Error normalization (Sprint 71)
 *
 * Converts any thrown value into a structured error object that can be
 * safely serialized to JSON and returned to the dashboard client.
 *
 * Error codes follow the FDB-0xx convention:
 *   FDB-070  upstream HTTP error
 *   FDB-071  upstream timeout
 *   FDB-072  upstream parse / validation failure
 *   FDB-073  internal worker error (unexpected)
 */

import { jsonResponse } from "./response";

/** Normalized error shape returned to the dashboard client. */
export interface NormalizedError {
  ok: false;
  code: string;
  message: string;
  status: number;
}

/**
 * Classify and normalize any thrown value into a {@link NormalizedError}.
 *
 * @param err       - The thrown value (unknown type)
 * @param routeName - Worker route or context name for logging (e.g. "weather")
 */
export function normalizeWorkerError(
  err: unknown,
  routeName: string,
): NormalizedError {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("timeout") || msg.includes("Timeout")) {
    return {
      ok: false,
      code: "FDB-071",
      message: `[${routeName}] upstream timeout: ${msg}`,
      status: 504,
    };
  }

  if (
    msg.includes("JSON") ||
    msg.includes("parse") ||
    msg.includes("SyntaxError")
  ) {
    return {
      ok: false,
      code: "FDB-072",
      message: `[${routeName}] parse error: ${msg}`,
      status: 502,
    };
  }

  if (msg.match(/HTTP \d{3}|status \d{3}|upstream/i)) {
    return {
      ok: false,
      code: "FDB-070",
      message: `[${routeName}] upstream error: ${msg}`,
      status: 502,
    };
  }

  return {
    ok: false,
    code: "FDB-073",
    message: `[${routeName}] internal error: ${msg}`,
    status: 500,
  };
}

/**
 * Convert a {@link NormalizedError} to a JSON `Response` with correct
 * HTTP status code.
 */
export function errorResponse(err: NormalizedError): Response {
  return jsonResponse(err, err.status);
}
