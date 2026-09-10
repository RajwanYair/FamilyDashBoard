/**
 * Tests for worker/src/routes/health-probes.ts.
 *
 * These tests keep synthetic probes deterministic and verify that cache faults
 * cannot turn one health request into an unbounded upstream fan-out.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetProviderHealthForTest,
  handleProviderHealth,
  PROVIDER_PROBE_TARGETS,
  PROBE_CACHE_TTL_S,
} from "../../../worker/src/routes/health-probes";
import type { Env } from "../../../worker/src/types";

function makeEnv(overrides?: Partial<Env>): Env {
  return {
    ENVIRONMENT: "test",
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
    },
    ...overrides,
  } as unknown as Env;
}

describe("handleProviderHealth — operational probe limits", () => {
  beforeEach(() => {
    _resetProviderHealthForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetProviderHealthForTest();
  });

  it("uses fixed, household-free HTTPS probe targets", () => {
    expect(PROVIDER_PROBE_TARGETS.length).toBeGreaterThan(0);
    expect(
      PROVIDER_PROBE_TARGETS.every(
        ({ url }) => url.startsWith("https://") && !url.includes("worker"),
      ),
    ).toBe(true);
  });

  it("serves a valid fresh KV snapshot without probing upstreams", async () => {
    const snapshot = {
      probed: Date.now(),
      providers: [
        {
          id: "open-meteo",
          status: "ok",
          latencyMs: 20,
          httpStatus: 200,
          probedAt: new Date().toISOString(),
        },
      ],
    };
    const env = makeEnv({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(JSON.stringify(snapshot)),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      } as unknown as Env["CACHE_KV"],
    });
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const res = await handleProviderHealth(env);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-FDB-Source")).toBe("kv-cache");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores malformed KV and runs one bounded probe per target", async () => {
    const env = makeEnv({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue("{not-json"),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      } as unknown as Env["CACHE_KV"],
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const res = await handleProviderHealth(env);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-FDB-Source")).toBe("live-probe");
    expect(fetchMock).toHaveBeenCalledTimes(PROVIDER_PROBE_TARGETS.length);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\//),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("uses the isolate-local snapshot when KV is unavailable", async () => {
    const env = makeEnv({
      CACHE_KV: {
        get: vi.fn().mockRejectedValue(new Error("KV unavailable")),
        put: vi.fn().mockRejectedValue(new Error("KV unavailable")),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      } as unknown as Env["CACHE_KV"],
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await handleProviderHealth(env);
    const firstProbeCount = fetchMock.mock.calls.length;
    const res = await handleProviderHealth(env);

    expect(firstProbeCount).toBe(PROVIDER_PROBE_TARGETS.length);
    expect(fetchMock).toHaveBeenCalledTimes(firstProbeCount);
    expect(res.headers.get("X-FDB-Source")).toBe("memory-cache");
  });

  it("refreshes an expired snapshot rather than serving it indefinitely", async () => {
    const snapshot = {
      probed: Date.now() - (PROBE_CACHE_TTL_S + 1) * 1000,
      providers: [],
    };
    const env = makeEnv({
      CACHE_KV: {
        get: vi.fn().mockResolvedValue(JSON.stringify(snapshot)),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
      } as unknown as Env["CACHE_KV"],
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    const res = await handleProviderHealth(env);
    expect(res.headers.get("X-FDB-Source")).toBe("live-probe");
    expect(fetchMock).toHaveBeenCalledTimes(PROVIDER_PROBE_TARGETS.length);
  });
});
