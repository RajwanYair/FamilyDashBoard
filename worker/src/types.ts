/**
 * FamilyDashBoard Worker — Environment bindings interface.
 *
 * Extracted from index.ts so routes and utilities can import it
 * without creating circular dependencies.
 */

/**
 * Minimal KV namespace interface — only the methods used by this worker.
 * The Cloudflare KVNamespace satisfies this interface via structural typing,
 * so production deployment is unaffected. Defining it here avoids importing
 * the `@cloudflare/workers-types` ambient package in consumer files (e.g. tests).
 */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list(options?: { prefix?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cacheStatus: null | "HIT" | "MISS" | "EXPIRED";
  }>;
}

export interface Env {
  /** Runtime environment label ("production" | "preview" | "development"). */
  ENVIRONMENT: string;
  /** KV namespace for stale-fallback cache (Stream W.2). */
  CACHE_KV: KVStore;
  /**
   * Secret token required to access GET /api/errors/export.
   * Set as a Worker secret (wrangler secret put ERROR_REPORTING_TOKEN).
   * Optional — export endpoint returns 501 when not configured.
   */
  ERROR_REPORTING_TOKEN?: string;
  /**
   * Finnhub API key for backup stock quotes.
   * Set as a Worker secret (wrangler secret put FINNHUB_API_KEY).
   * Optional — Finnhub fallback is skipped when not configured.
   */
  FINNHUB_API_KEY?: string;
  /**
   * Durable Object for alerts SSE fan-out (V12-EDGE-3).
   * Bound in wrangler.toml as [[durable_objects.bindings]].
   * Optional — the DO fan-out path is only exercised when this is present.
   */
  ALERTS_DO?: DurableObjectNamespace;
  /**
   * D1 database for telemetry and error persistence (V12-EDGE-2).
   * Provision via: wrangler d1 create fdb-telemetry
   * Optional — telemetry is silently skipped when not configured.
   */
  DB?: D1Database;
  /**
   * Token required to read metrics/telemetry endpoints.
   * Set as a Worker secret (wrangler secret put METRICS_TOKEN).
   * Optional — metrics endpoint returns 501 when not configured.
   */
  METRICS_TOKEN?: string;
  /**
   * Token required to read the GET /api/reports/digest endpoint.
   * Set as a Worker secret (wrangler secret put REPORTS_TOKEN).
   * Optional — digest endpoint returns 501 when not configured.
   * POST /api/reports does NOT require this token (browsers send reports automatically).
   */
  REPORTS_TOKEN?: string;
}

/**
 * Minimal D1Database interface — only the methods used by this worker.
 * The Cloudflare D1Database satisfies this via structural typing.
 * Defining it here prevents a hard dependency on @cloudflare/workers-types.
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: { duration?: number; rows_written?: number; rows_read?: number };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

/**
 * Minimal DurableObjectNamespace interface — only the methods used here.
 * The Cloudflare DurableObjectNamespace satisfies this via structural typing.
 */
export interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

export interface DurableObjectId {
  toString(): string;
}

export interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
