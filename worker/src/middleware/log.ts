/**
 * FamilyDashBoard Worker — Request logging middleware
 *
 * Emits structured console logs for every request (visible in `wrangler tail`).
 * Format: [METHOD] /path → status ms
 *
 * Query strings are deliberately excluded because routes can receive
 * bearer-like calendar URLs and other user-configured values.
 */

export interface LogEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
  ts: string;
}

/** Log a completed request. Called after the handler returns. */
export function logRequest(
  request: Request,
  response: Response,
  startMs: number,
  ip: string,
): void {
  const url = new URL(request.url);
  const entry: LogEntry = {
    method: request.method,
    path: url.pathname,
    status: response.status,
    durationMs: Date.now() - startMs,
    ip,
    ts: new Date().toISOString(),
  };
  console.log(
    `[${entry.ts}] ${entry.method} ${entry.path} → ${entry.status} (${entry.durationMs}ms) ip=${entry.ip}`,
  );
}
