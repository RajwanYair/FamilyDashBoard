/**
 * FamilyDashBoard Worker — Shared response helpers
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Cross-Origin-Resource-Policy": "cross-origin",
};

export type LimitedBodyReason = "too_large" | "read_error";

export type LimitedBodyResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: LimitedBodyReason };

/**
 * Read an upstream body without allowing an unbounded response to accumulate
 * in Worker memory.
 */
export async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<LimitedBodyResult> {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  if (!response.body) {
    try {
      const bytes = new Uint8Array(await response.arrayBuffer());
      return bytes.byteLength <= maxBytes
        ? { ok: true, bytes }
        : { ok: false, reason: "too_large" };
    } catch {
      return { ok: false, reason: "read_error" };
    }
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "read_error" };
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

export async function readTextWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; reason: LimitedBodyReason }> {
  const body = await readBodyWithLimit(response, maxBytes);
  return body.ok
    ? { ok: true, text: new TextDecoder().decode(body.bytes) }
    : { ok: false, reason: body.reason };
}

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
export async function proxyResponse(res: Response, cacheTtl: number): Promise<Response> {
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
