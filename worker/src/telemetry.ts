/**
 * FamilyDashBoard Worker — OpenTelemetry OTLP/JSON exporter (ADR-079)
 *
 * v14.32.0: fully dep-free OTLP/HTTP JSON implementation.
 *
 * Uses only native `fetch` — no npm dependencies.
 * OTLP/JSON spec: https://opentelemetry.io/docs/specs/otlp/#otlphttp
 *
 * Enabled when BOTH env vars are set:
 *   OTEL_ENABLED=true
 *   OTEL_ENDPOINT=https://your-collector.example.com
 *
 * Usage:
 *   const otel = initOtel(env);
 *   const span = otel.span("route:weather", async (s) => {
 *     s.setAttribute("lat", params.lat);
 *     return fetchWeather(params);
 *   });
 *   // At end-of-request (ctx.waitUntil):
 *   await otel.flush();
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
  /** True only when `env.OTEL_ENABLED === "true"` and OTEL_ENDPOINT is set. */
  readonly enabled: boolean;
}

// ── Internal types ─────────────────────────────────────────────────────────────

type OtelAttrValue =
  | { stringValue: string }
  | { intValue: string }
  | { boolValue: boolean }
  | { doubleValue: number };

interface OtelAttr {
  key: string;
  value: OtelAttrValue;
}

interface CollectedSpan {
  traceId: string;
  spanId: string;
  name: string;
  startNs: string;
  endNs: string;
  attrs: OtelAttr[];
  /** 0=UNSET 1=OK 2=ERROR */
  statusCode: 0 | 1 | 2;
  statusMessage?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _hex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Nanoseconds since UNIX epoch as a string (avoids BigInt precision loss). */
function _nowNs(): string {
  // Date.now() gives ms; multiply to ns
  return (Date.now() * 1_000_000).toString();
}

function _attrValue(v: string | number | boolean): OtelAttrValue {
  if (typeof v === "boolean") return { boolValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { intValue: v.toString() } : { doubleValue: v };
  }
  return { stringValue: v };
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

// ── Live handle ───────────────────────────────────────────────────────────────

function _makeLiveHandle(endpoint: string, traceId: string): OtelHandle {
  const collected: CollectedSpan[] = [];

  function makeSpan(name: string): { span: OtelSpan; finish: () => void } {
    const spanId = _hex(8);
    const startNs = _nowNs();
    const attrs: OtelAttr[] = [];
    let statusCode: 0 | 1 | 2 = 0;
    let statusMessage: string | undefined;

    const span: OtelSpan = {
      setAttribute(key, value) {
        attrs.push({ key, value: _attrValue(value) });
      },
      setStatus(code, message) {
        statusCode = code === "ok" ? 1 : 2;
        statusMessage = message;
      },
    };

    const finish = () => {
      collected.push({ traceId, spanId, name, startNs, endNs: _nowNs(), attrs, statusCode, statusMessage });
    };

    return { span, finish };
  }

  return {
    enabled: true,

    span<T>(name: string, fn: (span: OtelSpan) => T): T {
      const { span, finish } = makeSpan(name);
      let result: T;
      try {
        result = fn(span);
      } finally {
        finish();
      }
      return result!;
    },

    async flush(): Promise<void> {
      if (collected.length === 0) return;

      const spans = collected.splice(0);
      const body = JSON.stringify({
        resourceSpans: [
          {
            resource: {
              attributes: [{ key: "service.name", value: { stringValue: "fdb-worker" } }],
            },
            scopeSpans: [
              {
                scope: { name: "fdb-worker" },
                spans: spans.map((s) => ({
                  traceId: s.traceId,
                  spanId: s.spanId,
                  name: s.name,
                  kind: 1, // SPAN_KIND_INTERNAL
                  startTimeUnixNano: s.startNs,
                  endTimeUnixNano: s.endNs,
                  attributes: s.attrs,
                  status: {
                    code: s.statusCode,
                    ...(s.statusMessage !== undefined ? { message: s.statusMessage } : {}),
                  },
                })),
              },
            ],
          },
        ],
      });

      try {
        await fetch(`${endpoint}/v1/traces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      } catch {
        // Best-effort — never throw from flush
      }
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise the OTel handle for the current request.
 *
 * Returns a zero-cost no-op handle when disabled or misconfigured.
 * Returns a live span-collecting handle that exports to OTLP/HTTP JSON
 * when `OTEL_ENABLED === "true"` and `OTEL_ENDPOINT` is set.
 *
 * @param env - Cloudflare Worker environment bindings.
 * @returns An `OtelHandle` for the current request lifetime.
 */
export function initOtel(env: Env): OtelHandle {
  if (env.OTEL_ENABLED !== "true" || !env.OTEL_ENDPOINT) {
    return _noopHandle;
  }
  return _makeLiveHandle(env.OTEL_ENDPOINT, _hex(16));
}

