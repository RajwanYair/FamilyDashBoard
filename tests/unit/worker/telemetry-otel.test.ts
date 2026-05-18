/**
 * Tests for worker/src/telemetry.ts — OTel OTLP/JSON dep-free exporter (ADR-088).
 *
 * Covers:
 *   - no-op path (OTEL_ENABLED not set, or OTEL_ENDPOINT missing)
 *   - live path: span creation, attribute/status setting, flush OTLP/JSON payload
 *   - flush error tolerance (fetch failure must not throw)
 *   - flush no-op when span list is empty
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initOtel } from "../../../worker/src/telemetry";
import type { Env } from "../../../worker/src/types";

// ── Minimal Env stub ──────────────────────────────────────────────────────────

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: async () => null,
      put: async () => undefined,
      list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    },
    ...overrides,
  } as unknown as Env;
}

// ── No-op path ────────────────────────────────────────────────────────────────

describe("initOtel — no-op when disabled", () => {
  it("enabled=false when OTEL_ENABLED not set", () => {
    const h = initOtel(makeEnv());
    expect(h.enabled).toBe(false);
  });

  it("enabled=false when OTEL_ENABLED=true but OTEL_ENDPOINT missing", () => {
    const h = initOtel(makeEnv({ OTEL_ENABLED: "true" }));
    expect(h.enabled).toBe(false);
  });

  it("no-op span executes fn and returns result", () => {
    const h = initOtel(makeEnv());
    const result = h.span("test", () => 42);
    expect(result).toBe(42);
  });

  it("no-op flush resolves immediately", async () => {
    const h = initOtel(makeEnv());
    await expect(h.flush()).resolves.toBeUndefined();
  });
});

// ── Live path ─────────────────────────────────────────────────────────────────

describe("initOtel — live OTLP/JSON exporter", () => {
  let fetchCalls: Array<{ url: string; init: RequestInit }>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init: init ?? {} });
      return new Response(null, { status: 200 });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeLiveEnv(endpoint = "https://otel.example.com") {
    return makeEnv({ OTEL_ENABLED: "true", OTEL_ENDPOINT: endpoint });
  }

  it("enabled=true when OTEL_ENABLED=true and OTEL_ENDPOINT set", () => {
    const h = initOtel(makeLiveEnv());
    expect(h.enabled).toBe(true);
  });

  it("span executes fn and returns its result", () => {
    const h = initOtel(makeLiveEnv());
    const result = h.span("greet", () => "hello");
    expect(result).toBe("hello");
  });

  it("flush sends OTLP/JSON POST to /v1/traces", async () => {
    const h = initOtel(makeLiveEnv("https://col.example.com"));
    h.span("route:weather", (s) => {
      s.setAttribute("lat", 32.1);
      s.setStatus("ok");
    });
    await h.flush();

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("https://col.example.com/v1/traces");
    expect(fetchCalls[0].init.method).toBe("POST");

    const body = JSON.parse(fetchCalls[0].init.body as string) as {
      resourceSpans: Array<{
        resource: { attributes: Array<{ key: string }> };
        scopeSpans: Array<{
          spans: Array<{
            name: string;
            attributes: Array<{ key: string; value: unknown }>;
            status: { code: number };
          }>;
        }>;
      }>;
    };
    const spans = body.resourceSpans[0].scopeSpans[0].spans;
    expect(spans).toHaveLength(1);
    expect(spans[0].name).toBe("route:weather");
    expect(spans[0].attributes).toContainEqual(
      expect.objectContaining({
        key: "lat",
        value: expect.objectContaining({ doubleValue: 32.1 }),
      }),
    );
    expect(spans[0].status.code).toBe(1); // OK
  });

  it("flush includes service.name resource attribute", async () => {
    const h = initOtel(makeLiveEnv());
    h.span("health", () => undefined);
    await h.flush();

    const body = JSON.parse(fetchCalls[0].init.body as string) as {
      resourceSpans: Array<{
        resource: { attributes: Array<{ key: string; value: { stringValue?: string } }> };
      }>;
    };
    const svcAttr = body.resourceSpans[0].resource.attributes.find((a) => a.key === "service.name");
    expect(svcAttr?.value.stringValue).toBe("fdb-worker");
  });

  it("setStatus error sets code=2 with message", async () => {
    const h = initOtel(makeLiveEnv());
    h.span("route:stocks", (s) => {
      s.setStatus("error", "timeout");
    });
    await h.flush();

    const body = JSON.parse(fetchCalls[0].init.body as string) as {
      resourceSpans: Array<{
        scopeSpans: Array<{ spans: Array<{ status: { code: number; message?: string } }> }>;
      }>;
    };
    const status = body.resourceSpans[0].scopeSpans[0].spans[0].status;
    expect(status.code).toBe(2); // ERROR
    expect(status.message).toBe("timeout");
  });

  it("flush is no-op when no spans were created", async () => {
    const h = initOtel(makeLiveEnv());
    await h.flush();
    expect(fetchCalls).toHaveLength(0);
  });

  it("flush clears spans after sending (double flush sends empty)", async () => {
    const h = initOtel(makeLiveEnv());
    h.span("s1", () => undefined);
    await h.flush();
    expect(fetchCalls).toHaveLength(1);
    await h.flush(); // second flush — spans already drained
    expect(fetchCalls).toHaveLength(1);
  });

  it("flush does not throw when fetch fails", async () => {
    globalThis.fetch = async () => {
      throw new Error("network error");
    };
    const h = initOtel(makeLiveEnv());
    h.span("risky", () => undefined);
    await expect(h.flush()).resolves.toBeUndefined();
  });

  it("span attributes: boolean stored as boolValue", async () => {
    const h = initOtel(makeLiveEnv());
    h.span("bool-test", (s) => {
      s.setAttribute("cached", true);
    });
    await h.flush();

    const body = JSON.parse(fetchCalls[0].init.body as string) as {
      resourceSpans: Array<{
        scopeSpans: Array<{ spans: Array<{ attributes: Array<{ key: string; value: unknown }> }> }>;
      }>;
    };
    const attr = body.resourceSpans[0].scopeSpans[0].spans[0].attributes.find(
      (a) => a.key === "cached",
    );
    expect(attr?.value).toEqual({ boolValue: true });
  });

  it("span attributes: integer stored as intValue string", async () => {
    const h = initOtel(makeLiveEnv());
    h.span("int-test", (s) => {
      s.setAttribute("count", 5);
    });
    await h.flush();

    const body = JSON.parse(fetchCalls[0].init.body as string) as {
      resourceSpans: Array<{
        scopeSpans: Array<{ spans: Array<{ attributes: Array<{ key: string; value: unknown }> }> }>;
      }>;
    };
    const attr = body.resourceSpans[0].scopeSpans[0].spans[0].attributes.find(
      (a) => a.key === "count",
    );
    expect(attr?.value).toEqual({ intValue: "5" });
  });

  it("span finishes even if fn throws (span recorded)", async () => {
    const h = initOtel(makeLiveEnv());
    expect(() => {
      h.span("throws", () => {
        throw new Error("boom");
      });
    }).toThrow("boom");
    await h.flush();
    expect(fetchCalls).toHaveLength(1);
    const body = JSON.parse(fetchCalls[0].init.body as string) as {
      resourceSpans: Array<{ scopeSpans: Array<{ spans: unknown[] }> }>;
    };
    expect(body.resourceSpans[0].scopeSpans[0].spans).toHaveLength(1);
  });
});
