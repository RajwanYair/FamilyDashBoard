import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

vi.mock("@/core/constants", () => ({
  WORKER_BASE_URL: "https://worker.test",
  isWorkerEnabled: vi.fn().mockReturnValue(true),
}));
vi.mock("@/core/provider", () => ({
  recordProviderLatency: vi.fn(),
  recordProviderSuccess: vi.fn(),
  recordProviderFailure: vi.fn(),
}));
vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

import { isWorkerEnabled } from "@/core/constants";
import {
  recordProviderFailure,
  recordProviderLatency,
  recordProviderSuccess,
} from "@/core/provider";
import { diagLog } from "@/core/diag";
import { _stopHealthProbe, initHealthProbe } from "@/core/health-probe";

describe("health probe response validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isWorkerEnabled).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    _stopHealthProbe();
    vi.unstubAllGlobals();
  });

  it("ingests a valid provider snapshot", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          probed: 1,
          ttl: 300,
          providers: [
            {
              id: "weather",
              status: "ok",
              latencyMs: 125.4,
              httpStatus: 200,
              probedAt: "2026-09-09T10:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    initHealthProbe();
    await flushMicrotasks();

    expect(recordProviderLatency).toHaveBeenCalledWith("weather", 125.4);
    expect(recordProviderSuccess).toHaveBeenCalledWith("weather");
    expect(recordProviderFailure).not.toHaveBeenCalled();
  });

  it("ignores a malformed top-level response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ providers: "bad" }), { status: 200 }),
    );

    initHealthProbe();
    await flushMicrotasks();

    expect(recordProviderLatency).not.toHaveBeenCalled();
    expect(diagLog).toHaveBeenCalledWith("[health-probe] Ignored malformed Worker response");
  });

  it("ignores a provider with invalid latency or status", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          probed: 1,
          ttl: 300,
          providers: [
            {
              id: "weather",
              status: "unknown",
              latencyMs: Number.NaN,
              httpStatus: 200,
              probedAt: "2026-09-09T10:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    initHealthProbe();
    await flushMicrotasks();

    expect(recordProviderLatency).not.toHaveBeenCalled();
    expect(recordProviderSuccess).not.toHaveBeenCalled();
    expect(recordProviderFailure).not.toHaveBeenCalled();
  });
});
