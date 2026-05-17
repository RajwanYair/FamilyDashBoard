/**
 * FamilyDashBoard Worker — OpenTelemetry opt-in scaffold (ADR-079)
 *
 * v14.23.0: no-op implementation behind `OTEL_ENABLED` feature flag.
 *
 * Usage:
 *   import { initOtel } from "./telemetry";
 *   const otel = initOtel(env);
 *   if (otel.enabled) {
 *     const result = otel.span("route:weather", (span) => {
 *       span.setAttribute("lat", params.lat);
 *       return fetchWeather(params);
 *     });
 *   }
 *
 * v15 sprint will replace the no-op body with a real OTLPTraceExporter
 * once `@opentelemetry/otlp-exporter-proto` is added to worker/package.json
 * and the R2 ingestor bucket `fdb-otel-traces` is provisioned.
 */

import type { Env } from "./types";

// ── Public types ──────────────────────────────────────────────────────────────

/** Attribute setter + status setter for a single span. */
export interface OtelSpan {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: "ok" | "error", message?: string): void;
}

/** Handle returned by `initOtel` for the lifetime of a request. */
export interface OtelHandle {
  /** Execute `fn` within a named span, return its result. */
  span<T>(name: string, fn: (span: OtelSpan) => T): T;
  /** Flush pending spans to the OTLP exporter. No-op when disabled. */
  flush(): Promise<void>;
  /** True only when `env.OTEL_ENABLED === "true"`. */
  readonly enabled: boolean;
}

// ── No-op implementations ─────────────────────────────────────────────────────

const _noopSpan: OtelSpan = {
  setAttribute: () => undefined,
  setStatus: () => undefined,
};

const _noopHandle: OtelHandle = {
  enabled: false,
  span: <T>(_name: string, fn: (span: OtelSpan) => T): T => fn(_noopSpan),
  flush: (): Promise<void> => Promise.resolve(),
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the OTel handle for the current request.
 *
 * When `env.OTEL_ENABLED !== "true"` (the default for all current deployments),
 * the returned handle is a zero-cost no-op: `enabled === false`, every method
 * returns immediately, and no spans are created or exported.
 *
 * The real implementation will be introduced in the v15 OTel sprint.
 *
 * @param env - Cloudflare Worker environment bindings.
 * @returns An `OtelHandle` for the current request lifetime.
 */
export function initOtel(env: Env): OtelHandle {
  if (env.OTEL_ENABLED !== "true") {
    return _noopHandle;
  }
  // ── TODO (v15 OTel sprint) ──────────────────────────────────────────────
  // 1. Import TracerProvider + OTLPTraceExporter from @opentelemetry/*
  // 2. Create a real span here and wire flush() to the exporter
  // 3. Return a live OtelHandle backed by the real tracer
  // ───────────────────────────────────────────────────────────────────────
  return _noopHandle;
}
