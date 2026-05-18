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
  list(options?: { prefix?: string; limit?: number }): Promise<{
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
   * Durable Object for globally-consistent rate limiting (V13-EDGE-6).
   * Replaces per-isolate in-memory state with a single globally-serialised DO counter.
   * Bound in wrangler.toml as [[durable_objects.bindings]].
   * Optional — falls back to in-memory rate limiting when not bound.
   */
  RATE_LIMITER_DO?: DurableObjectNamespace;
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
  /**
   * Workers Analytics Engine dataset for per-request hit tracking (V12-EDGE-2b, ADR-029).
   * Bound in wrangler.toml as [[analytics_engine_datasets]] binding name "ANALYTICS".
   * Optional — tracking is silently skipped when not configured.
   */
  ANALYTICS?: AnalyticsEngineDataset;
  /**
   * Canary traffic percentage (0–100) as a string (V12-EDGE-4b ).
   * When set, a random fraction of requests receive the X-Canary: true response header.
   * Example: "10" means 10% of requests are tagged as canary.
   * Optional — canary tagging is disabled when not set or when value is 0.
   */
  CANARY_PCT?: string;
  /**
   * Feature flag: enable Workers AI routes (ADR-030).
   * Set to "true" to activate /api/news/summarise and /api/motivation/hebrew.
   * When absent or not "true", those routes return 503 {"ok":false,"error":"ai_disabled"}.
   */
  AI_ENABLED?: string;
  /**
   * Workers AI binding (ADR-030, V13-AI-1).
   * Bound in wrangler.toml as [ai] with binding name "AI".
   * Optional — AI routes return 503 when not bound.
   */
  AI?: AiBinding;
  /**
   * Workers Queue binding for error fan-out (ADR-032).
   * When bound, each validated error batch is also enqueued for async processing.
   * Optional — silently skipped when not configured.
   */
  ERRORS_QUEUE?: WorkersQueue;
  /**
   * Email Workers "from" address for the weekly digest (ADR-033).
   * Set as a Worker environment variable (wrangler.toml [vars] or wrangler secret put).
   * Optional — weekly digest is skipped when not set.
   */
  EMAIL_SEND_FROM?: string;
  /**
   * Email Workers "to" address for the weekly digest (ADR-033).
   * Set as a Worker environment variable (wrangler.toml [vars] or wrangler secret put).
   * Optional — weekly digest is skipped when not set.
   */
  EMAIL_SEND_TO?: string;
  /**
   * Feature flag: enable opt-in OpenTelemetry spans (ADR-079).
   * Set to "true" to activate OTel tracing via `worker/src/telemetry.ts`.
   * When absent or not "true", `initOtel(env).enabled === false` — zero overhead.
   */
  OTEL_ENABLED?: string;
  /**
   * OTLP endpoint for OpenTelemetry span export (ADR-079).
   * Must be an HTTPS URL accepting OTLP/JSON POST at `/v1/traces`.
   * Optional — OTel export is silently skipped when not set.
   */
  OTEL_ENDPOINT?: string;
  /**
   * Durable Object for Hibernatable WebSocket stock price fan-out (ADR-086, S-DO).
   * Bound in wrangler.toml as [[durable_objects.bindings]] with class StocksLiveDO.
   * Optional — WebSocket upgrade returns 501 when not configured.
   */
  STOCKS_DO?: DurableObjectNamespace;
  /**
   * R2 bucket for static asset background cache (ADR-050).
   * Provision via: wrangler r2 bucket create fdb-static-assets
   * Optional — asset cache helper is a no-op when not configured.
   */
  R2_ASSETS?: R2Bucket;
}

/**
 * Minimal Workers AI binding interface (ADR-030, V13-AI-1).
 * The Cloudflare Ai binding satisfies this via structural typing.
 * Only the text-generation run() signature is modelled here.
 */
export interface AiTextGenerationInput {
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
}
export interface AiTextGenerationOutput {
  response?: string;
}

/** Input for text-embedding models (e.g. @cf/baai/bge-small-en-v1.5). */
export interface AiEmbeddingInput {
  text: string | string[];
}

/** Output for text-embedding models. */
export interface AiEmbeddingOutput {
  shape: number[];
  data: number[][];
}

export interface AiBinding {
  run(
    model: string,
    input: AiTextGenerationInput,
  ): Promise<AiTextGenerationOutput | ReadableStream>;
  run(model: string, input: AiEmbeddingInput): Promise<AiEmbeddingOutput>;
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
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>; // owasp-allow:A10
}

/**
 * Minimal Workers Analytics Engine dataset interface (V12-EDGE-2b, ADR-029).
 * Cloudflare's AnalyticsEngineDataset satisfies this via structural typing.
 */
export interface AnalyticsEngineDataset {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

/**
 * Minimal Workers Queue producer interface (ADR-032).
 * Cloudflare's Queue satisfies this via structural typing.
 * Only the `send` method is used for error fan-out.
 */
export interface WorkersQueue {
  send(body: unknown, options?: { contentType?: string }): Promise<void>;
  sendBatch(messages: Array<{ body: unknown }>): Promise<void>;
}

/**
 * Message body shape sent to the ERRORS_QUEUE (ADR-032).
 */
export interface ErrorQueueMessage {
  /** ISO 8601 timestamp of when the batch was enqueued. */
  enqueuedAt: string;
  /** UTC date key (YYYY-MM-DD) for KV lookup. */
  dateKey: string;
  /** Number of error entries in this batch. */
  count: number;
  /** KV key prefix for this batch (errors:<dateKey>:). */
  kvPrefix: string;
}

/**
 * Minimal R2 bucket interface (ADR-050).
 * The Cloudflare R2Bucket satisfies this via structural typing.
 * Only the get/put/delete methods used by r2-cache.ts are modelled here.
 */
export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string; contentEncoding?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface R2ObjectBody {
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  readonly httpMetadata?: { contentType?: string; contentEncoding?: string };
  readonly customMetadata?: Record<string, string>;
}
