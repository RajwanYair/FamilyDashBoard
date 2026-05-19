/**
 * Tests for /health route (S24 — enhanced binding status + version, worker/src/index.ts).
 *
 * Tests the Hono app's /health endpoint response shape, binding flags, and version field.
 */

import { describe, it, expect } from "vitest";
import worker from "../../../worker/src/index";
import type { Env } from "../../../worker/src/types";

// ── Env stubs ─────────────────────────────────────────────────────────────────

function makeMinimalEnv(overrides: Partial<Env> = {}): Env {
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

function makeRequest(path: string): Request {
  return new Request(`https://fdb.workers.dev${path}`, { method: "GET" });
}

function makeCtx(): ExecutionContext {
  return { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext;
}

// ── /health base shape ────────────────────────────────────────────────────────

describe("/health — base response shape", () => {
  it("returns 200 with ok:true and status:healthy", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.status).toBe("healthy");
  });

  it("includes a numeric ts field", async () => {
    const before = Date.now();
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const after = Date.now();
    const body = await res.json() as { ts: number };
    expect(body.ts).toBeGreaterThanOrEqual(before);
    expect(body.ts).toBeLessThanOrEqual(after);
  });

  it("includes version string", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const body = await res.json() as { version: string };
    expect(typeof body.version).toBe("string");
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("includes environment from env.ENVIRONMENT", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv({ ENVIRONMENT: "staging" }), makeCtx());
    const body = await res.json() as { environment: string };
    expect(body.environment).toBe("staging");
  });

  it("environment defaults to 'production' when ENVIRONMENT is unset", async () => {
    const env = makeMinimalEnv();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (env as any).ENVIRONMENT;
    const res = await worker.fetch(makeRequest("/health"), env, makeCtx());
    const body = await res.json() as { environment: string };
    expect(body.environment).toBe("production");
  });
});

// ── /health — bindings object ─────────────────────────────────────────────────

describe("/health — bindings flags", () => {
  it("cache_kv is always true", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.cache_kv).toBe(true);
  });

  it("analytics is false when ANALYTICS is absent", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.analytics).toBe(false);
  });

  it("analytics is true when ANALYTICS is bound", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv({ ANALYTICS: { writeDataPoint: () => undefined } as never }), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.analytics).toBe(true);
  });

  it("r2_assets is false when R2_ASSETS is absent", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.r2_assets).toBe(false);
  });

  it("r2_assets is true when R2_ASSETS is bound", async () => {
    const env = makeMinimalEnv({ R2_ASSETS: {} as never });
    const res = await worker.fetch(makeRequest("/health"), env, makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.r2_assets).toBe(true);
  });

  it("vapid is false when VAPID_ENABLED is absent", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.vapid).toBe(false);
  });

  it("vapid is true when VAPID_ENABLED='true'", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv({ VAPID_ENABLED: "true" }), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.vapid).toBe(true);
  });

  it("otel is true when OTEL_ENABLED='true'", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv({ OTEL_ENABLED: "true" }), makeCtx());
    const body = await res.json() as { bindings: Record<string, boolean> };
    expect(body.bindings.otel).toBe(true);
  });

  it("bindings object includes all expected keys", async () => {
    const res = await worker.fetch(makeRequest("/health"), makeMinimalEnv(), makeCtx());
    const body = await res.json() as { bindings: Record<string, unknown> };
    const keys = Object.keys(body.bindings);
    expect(keys).toContain("cache_kv");
    expect(keys).toContain("analytics");
    expect(keys).toContain("r2_assets");
    expect(keys).toContain("vectorize");
    expect(keys).toContain("ai");
    expect(keys).toContain("alerts_live_do");
    expect(keys).toContain("vapid");
    expect(keys).toContain("otel");
  });
});
