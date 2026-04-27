/**
 * Tests for v13.4 network-resilience additions to src/core/fetch.ts + constants.ts:
 *   - getNetworkMode() — reads LS_NETWORK_MODE with fallback to "auto"
 *   - fetchJSON honours "no-proxy" / "worker-only" modes (fail-fast, no proxy chain)
 *   - fetchViaWorker circuit breaker (skip worker after 3 consecutive failures for 5 min)
 *   - isWorkerEnabled honours "no-worker" mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock diagLog to keep output clean
vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

import {
  getNetworkMode,
  isWorkerEnabled,
  resetWorkerEnabledCache,
  LS_NETWORK_MODE,
} from "@/core/constants";
import { fetchJSON, fetchViaWorker, resetWorkerBreaker } from "@/core/fetch";

describe("getNetworkMode (v13.4)", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to 'auto' when LS key is absent", () => {
    expect(getNetworkMode()).toBe("auto");
  });

  it("returns 'worker-only' when set", () => {
    localStorage.setItem(LS_NETWORK_MODE, "worker-only");
    expect(getNetworkMode()).toBe("worker-only");
  });

  it("returns 'no-worker' when set", () => {
    localStorage.setItem(LS_NETWORK_MODE, "no-worker");
    expect(getNetworkMode()).toBe("no-worker");
  });

  it("returns 'no-proxy' when set", () => {
    localStorage.setItem(LS_NETWORK_MODE, "no-proxy");
    expect(getNetworkMode()).toBe("no-proxy");
  });

  it("falls back to 'auto' for unknown values", () => {
    localStorage.setItem(LS_NETWORK_MODE, "bogus-value");
    expect(getNetworkMode()).toBe("auto");
  });
});

describe("isWorkerEnabled — network mode gating (v13.4)", () => {
  afterEach(() => {
    localStorage.clear();
    resetWorkerEnabledCache();
  });

  it("returns false when mode is 'no-worker'", () => {
    localStorage.setItem(LS_NETWORK_MODE, "no-worker");
    expect(isWorkerEnabled()).toBe(false);
  });

  it("returns true when mode is 'auto' (default) on http origin", () => {
    // happy-dom defaults to http://localhost/
    expect(isWorkerEnabled()).toBe(true);
  });

  it("returns true when mode is 'worker-only' on http origin", () => {
    localStorage.setItem(LS_NETWORK_MODE, "worker-only");
    expect(isWorkerEnabled()).toBe(true);
  });

  it("returns true when mode is 'no-proxy' on http origin (worker still allowed)", () => {
    localStorage.setItem(LS_NETWORK_MODE, "no-proxy");
    expect(isWorkerEnabled()).toBe(true);
  });
});

describe("fetchJSON — network mode gating (v13.4)", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("throws without trying proxies when mode is 'no-proxy' and direct fails", async () => {
    localStorage.setItem(LS_NETWORK_MODE, "no-proxy");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchJSON("https://example.com/api")).rejects.toThrow(/mode=no-proxy/);
    // Only ONE call (direct) — no proxy attempts
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws without trying proxies when mode is 'worker-only' and direct fails", async () => {
    localStorage.setItem(LS_NETWORK_MODE, "worker-only");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    await expect(fetchJSON("https://example.com/api")).rejects.toThrow(/mode=worker-only/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("tries proxies when mode is 'auto' (default) and direct fails", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 403 } as Response);
        }
        // allorigins proxy returns wrapped JSON
        if (url.includes("allorigins")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              contents: JSON.stringify({ result: "via-proxy" }),
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      }),
    );

    const result = await fetchJSON<{ result: string }>("https://example.com/api");
    expect(result.result).toBe("via-proxy");
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("tries proxies when mode is 'no-worker' and direct fails (proxy chain remains active)", async () => {
    localStorage.setItem(LS_NETWORK_MODE, "no-worker");
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ ok: false } as Response);
        if (url.includes("allorigins")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              contents: JSON.stringify({ got: "proxy" }),
            }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      }),
    );

    const result = await fetchJSON<{ got: string }>("https://example.com/api");
    expect(result.got).toBe("proxy");
  });
});

describe("fetchViaWorker circuit breaker (v13.4)", () => {
  beforeEach(() => {
    resetWorkerBreaker();
    resetWorkerEnabledCache();
    localStorage.clear();
  });

  afterEach(() => {
    resetWorkerBreaker();
    vi.restoreAllMocks();
  });

  it("opens breaker after 3 consecutive failures and skips worker on next call", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);

    // First 3 calls all fail (try worker each time)
    // Use a Yahoo chart URL so buildWorkerRoute maps it
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/AAPL";
    expect(await fetchViaWorker(url)).toBeNull();
    expect(await fetchViaWorker(url)).toBeNull();
    expect(await fetchViaWorker(url)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // 4th call — breaker is OPEN; worker path is skipped entirely (no fetch)
    expect(await fetchViaWorker(url)).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("resets breaker on a successful worker call", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) return Promise.reject(new Error("transient"));
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      }),
    );

    const url = "https://query1.finance.yahoo.com/v8/finance/chart/AAPL";
    expect(await fetchViaWorker(url)).toBeNull();
    expect(await fetchViaWorker(url)).toBeNull();
    const ok = await fetchViaWorker<{ ok: boolean }>(url);
    expect(ok).toEqual({ ok: true });

    // After success, breaker is closed — next failure starts counter fresh
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down again")));
    expect(await fetchViaWorker(url)).toBeNull();
    // Still CLOSED (only 1 failure since reset) — fetch was attempted
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      1,
    );
  });
});
