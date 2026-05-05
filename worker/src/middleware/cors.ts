/**
 * FamilyDashBoard Worker — CORS preflight middleware
 *
 * Handles OPTIONS requests with the correct Access-Control headers.
 * All actual responses have CORS headers added via utils/response.ts.
 */

export const CORS_PREFLIGHT_HEADERS: HeadersInit = { // dead-export-ok: exported for potential external middleware consumers; used internally
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

/** Returns true when the request is a CORS preflight (OPTIONS). */
export function isPreflight(request: Request): boolean {
  return request.method === "OPTIONS";
}

/** Respond to a CORS preflight with 204 No Content. */
export function handlePreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_PREFLIGHT_HEADERS,
  });
}
