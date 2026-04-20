/**
 * FamilyDashBoard Worker — Shared response helpers
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/** Serialize data as JSON with CORS headers. */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

/** Proxy an upstream Response, adding CORS and a Cache-Control TTL. */
export async function proxyResponse(
  res: Response,
  cacheTtl: number,
): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": `public, max-age=${cacheTtl}`,
      ...CORS_HEADERS,
    },
  });
}

/**
 * Wrap parsed upstream data in a WorkerResponse<T> envelope and return as JSON.
 *
 * The envelope mirrors the `WorkerResponse<T>` interface in `src/types/api.ts`.
 * Cards that call `fetchJSONWithWorker<T>()` + `isWorkerEnabled()` depend on
 * this shape being present.
 *
 * @param data     - Normalized payload (already parsed from upstream JSON)
 * @param provider - Upstream origin label, e.g. "open-meteo" or "open.er-api.com"
 * @param stale    - True when serving from Worker cache (upstream unreachable)
 * @param cacheTtl - Cache-Control max-age in seconds
 */
export function workerEnvelope<T>(
  data: T,
  provider: string,
  stale: boolean,
  cacheTtl: number,
): Response {
  const envelope = {
    data,
    stale,
    timestamp: Date.now(),
    provider,
  };
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheTtl}`,
      ...CORS_HEADERS,
    },
  });
}
