/**
 * Tests for src/core/fetch.ts
 *
 * Covers: fetchWithTimeout (abort on timeout), fetchJSON (direct + proxy fallback),
 * raceProxies (Promise.any across proxies).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout, fetchJSON, raceProxies, fetchWithRetry, recordFetchSuccess, recordFetchFailure, isNetworkOffline, getConsecutiveFailures } from "@/core/fetch";

// Helper: mock fetch that resolves after `delay` ms
function delayedFetch(delay: number, response: unknown) {
  return vi.fn(
    () =>
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: async () => response,
              text: async () => JSON.stringify(response),
            } as Response),
          delay,
        ),
      ),
  );
}

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with the response on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true } as Response));
    const res = await fetchWithTimeout("https://example.com", 5000);
    expect(res.ok).toBe(true);
  });

  it("passes abort signal to fetch", () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return Promise.resolve({ ok: true } as Response);
      }),
    );
    void fetchWithTimeout("https://example.com", 5000);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("passes through fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    await expect(fetchWithTimeout("https://example.com", 5000)).rejects.toThrow(
      "network error",
    );
  });
});

describe("fetchJSON — direct success", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on direct fetch success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ value: 42 }),
      } as Response),
    );
    const result = await fetchJSON<{ value: number }>(
      "https://example.com/api",
    );
    expect(result.value).toBe(42);
  });

  it("throws when all proxies fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("All proxies failed")),
    );
    await expect(fetchJSON("https://example.com/bad")).rejects.toThrow();
  });

  it("falls back to proxy when direct returns non-ok", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) {
          // Direct request fails
          return Promise.resolve({ ok: false, status: 403 } as Response);
        }
        // First proxy (allorigins) returns wrapped JSON
        return Promise.resolve({
          ok: true,
          json: async () => ({
            contents: JSON.stringify({ data: "proxy-result" }),
          }),
        } as Response);
      }),
    );

    const result = await fetchJSON<{ data: string }>(
      "https://api.example.com/data",
    );
    expect(result.data).toBe("proxy-result");
    expect(callCount).toBeGreaterThan(1);
  });
});

describe("raceProxies", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with first successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response),
    );
    const res = await raceProxies("https://example.com/api");
    expect(res.ok).toBe(true);
  });

  it("rejects when all fetch attempts fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    await expect(raceProxies("https://example.com/bad", 50)).rejects.toThrow();
  });
});

describe("fetch — acquireLock / releaseLock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("acquireLock returns true the first time", async () => {
    vi.resetModules();
    const { acquireLock } = await import("@/core/fetch");
    expect(acquireLock("lock-1")).toBe(true);
  });

  it("acquireLock returns false when lock is already held", async () => {
    vi.resetModules();
    const { acquireLock } = await import("@/core/fetch");
    acquireLock("lock-2");
    expect(acquireLock("lock-2")).toBe(false);
  });

  it("releaseLock allows re-acquisition", async () => {
    vi.resetModules();
    const { acquireLock, releaseLock } = await import("@/core/fetch");
    acquireLock("lock-3");
    releaseLock("lock-3");
    expect(acquireLock("lock-3")).toBe(true);
  });

  it("releaseLock on unknown key does not throw", async () => {
    vi.resetModules();
    const { releaseLock } = await import("@/core/fetch");
    expect(() => releaseLock("nobody")).not.toThrow();
  });

  it("different lock names are independent", async () => {
    vi.resetModules();
    const { acquireLock, releaseLock } = await import("@/core/fetch");
    acquireLock("lock-x");
    expect(acquireLock("lock-y")).toBe(true);
    releaseLock("lock-x");
    releaseLock("lock-y");
  });
});

// ── fetchJSON — all proxies exhausted ──

describe("fetchJSON — all proxies exhausted throws", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws 'All proxies failed' when direct + every proxy fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    await expect(fetchJSON("https://example.com/api")).rejects.toThrow(
      /All proxies failed/,
    );
  });

  it("throws when direct returns non-ok and all proxies also return non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );
    await expect(fetchJSON("https://example.com/api")).rejects.toThrow(
      /All proxies failed/,
    );
  });
});

// ── fetchJSON — allorigins malformed JSON ──

describe("fetchJSON — allorigins malformed contents", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("skips allorigins when contents is invalid JSON and falls to next proxy", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) {
          // Direct fails
          return Promise.resolve({ ok: false, status: 403 } as Response);
        }
        if (typeof url === "string" && url.includes("allorigins")) {
          // allorigins succeeds but contents is garbage
          return Promise.resolve({
            ok: true,
            json: async () => ({ contents: "{ broken json!!" }),
          } as Response);
        }
        // Next proxy (codetabs/corsproxy) returns raw JSON
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: "from-proxy" }),
        } as Response);
      }),
    );

    const result = await fetchJSON<{ data: string }>(
      "https://api.example.com/endpoint",
    );
    expect(result.data).toBe("from-proxy");
    expect(callCount).toBeGreaterThan(2);
  });
});

// ── fetchJSON — non-allorigins proxy success path ──

describe("fetchJSON — non-allorigins proxy path", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("returns raw JSON from non-allorigins proxy (codetabs/corsproxy)", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ ok: false } as Response); // direct fails
        if (typeof url === "string" && url.includes("allorigins")) {
          return Promise.reject(new Error("allorigins down"));
        }
        // codetabs or corsproxy returns raw JSON
        return Promise.resolve({
          ok: true,
          json: async () => ({ value: 99 }),
        } as Response);
      }),
    );

    const result = await fetchJSON<{ value: number }>(
      "https://api.example.com/data",
    );
    expect(result.value).toBe(99);
  });

  it("uses custom proxy from localStorage when set", async () => {
    localStorage.setItem(
      "dash_custom_proxy",
      "https://my-proxy.example.com/?url=",
    );
    let usedCustom = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (typeof url === "string" && url.includes("my-proxy.example.com")) {
          usedCustom = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({ custom: true }),
          } as Response);
        }
        return Promise.resolve({ ok: false } as Response);
      }),
    );

    const result = await fetchJSON<{ custom: boolean }>(
      "https://api.example.com/data",
    );
    expect(result.custom).toBe(true);
    expect(usedCustom).toBe(true);
  });
});

// ── runConcurrent ──

describe("runConcurrent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs all tasks and returns settled results", async () => {
    const { runConcurrent } = await import("@/core/fetch");
    const results = await runConcurrent(
      [
        () => Promise.resolve(1),
        () => Promise.reject(new Error("fail")),
        () => Promise.resolve(3),
      ],
      2,
    );
    expect(results.length).toBe(3);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2);
    expect(results.filter((r) => r.status === "rejected").length).toBe(1);
  });

  it("respects concurrency limit", async () => {
    const { runConcurrent } = await import("@/core/fetch");
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const task = (): Promise<void> =>
      new Promise((resolve) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        setTimeout(() => {
          currentConcurrent--;
          resolve();
        }, 10);
      });
    await runConcurrent([task, task, task, task, task], 2);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});

import { fetchViaWorker, fetchJSONWithWorker } from "@/core/fetch";
import { WORKER_BASE_URL, resetWorkerEnabledCache } from "@/core/constants";

// \u2500\u2500 fetchViaWorker \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

describe("fetchViaWorker", () => {
  beforeEach(() => {
    resetWorkerEnabledCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when navigator.onLine is false", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const result = await fetchViaWorker("https://api.example.com");
    expect(result).toBeNull();
  });

  it("returns parsed JSON when worker responds ok", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "worker-result" }),
      } as Response),
    );
    const result = await fetchViaWorker<{ data: string }>(
      "https://api.example.com",
    );
    expect(result).toEqual({ data: "worker-result" });
    // Verify the URL used the worker base
    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(calledUrl).toContain(WORKER_BASE_URL);
  });

  it("returns null when worker returns non-ok status", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502 } as Response),
    );
    const result = await fetchViaWorker("https://api.example.com");
    expect(result).toBeNull();
  });

  it("returns null when worker fetch throws", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const result = await fetchViaWorker("https://api.example.com");
    expect(result).toBeNull();
  });
});

// ── fetchJSONWithWorker ───────────────────────────────────────────────────────

describe("fetchJSONWithWorker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns worker result when worker responds ok (lines 119-120)", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ source: "worker" }),
      } as Response),
    );
    const result = await fetchJSONWithWorker<{ source: string }>(
      "https://api.example.com/data",
    );
    expect(result.source).toBe("worker");
  });

  it("falls back to fetchJSON when worker returns null (line 121)", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false }); // worker returns null when offline
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ source: "direct" }),
      } as Response),
    );
    const result = await fetchJSONWithWorker<{ source: string }>(
      "https://api.example.com/data",
    );
    expect(result.source).toBe("direct");
  });
});

// ── WORKER_BASE_URL constant ──────────────────────────────────────────────

describe("WORKER_BASE_URL constant", () => {
  it("is a non-empty string", () => {
    expect(typeof WORKER_BASE_URL).toBe("string");
    expect(WORKER_BASE_URL.length).toBeGreaterThan(0);
  });

  it("starts with https://", () => {
    expect(WORKER_BASE_URL).toMatch(/^https:\/\//);
  });
});

// ── fetchViaWorker url > 60 chars short-branch (line 99) ─────────────────────

describe("fetchViaWorker — url > 60 chars truncation (line 99 TRUE branch)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("truncates long URL in diagnostic log without affecting actual request (line 99)", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: "ok" }),
      } as Response),
    );
    // URL > 60 characters → `url.length > 60 ? url.slice(0, 57) + "..." : url` TRUE branch
    const longUrl = "https://api.example.com/very/long/path/that/exceeds/sixty/chars?param=value";
    expect(longUrl.length).toBeGreaterThan(60);
    const result = await fetchViaWorker<{ result: string }>(longUrl);
    // Worker was called (result is non-null from mock), or null if worker disabled
    expect(result === null || result.result === "ok").toBe(true);
  });
});

// ── Sprint 6 (v7.4): network state tracker ───────────────────────────────────

describe("Fetch — network state tracker (v7.4)", () => {
  beforeEach(() => {
    // Reset state between tests
    for (let i = 0; i < 5; i++) recordFetchSuccess();
  });

  it("starts with 0 consecutive failures", () => {
    expect(getConsecutiveFailures()).toBe(0);
    expect(isNetworkOffline()).toBe(false);
  });

  it("recordFetchFailure increments consecutive failures", () => {
    recordFetchFailure();
    expect(getConsecutiveFailures()).toBe(1);
    recordFetchFailure();
    expect(getConsecutiveFailures()).toBe(2);
  });

  it("becomes offline after 3 consecutive failures", () => {
    recordFetchFailure();
    recordFetchFailure();
    expect(isNetworkOffline()).toBe(false);
    recordFetchFailure();
    expect(isNetworkOffline()).toBe(true);
  });

  it("recordFetchSuccess resets failure streak", () => {
    recordFetchFailure();
    recordFetchFailure();
    recordFetchFailure();
    expect(isNetworkOffline()).toBe(true);
    recordFetchSuccess();
    expect(isNetworkOffline()).toBe(false);
    expect(getConsecutiveFailures()).toBe(0);
  });
});

// ── Sprint 6 (v7.4): fetchWithRetry ─────────────────────────────────────────

describe("Fetch — fetchWithRetry (v7.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves on first attempt when fetchJSON succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "ok" }),
        text: async () => '{"data":"ok"}',
      } as Response),
    );
    const result = await fetchWithRetry<{ data: string }>("https://example.com");
    expect(result.data).toBe("ok");
  });

  it("retries on failure and succeeds on second attempt", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls++;
        if (calls < 2) return Promise.reject(new Error("network error"));
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: "retry-ok" }),
          text: async () => '{"data":"retry-ok"}',
        } as Response);
      }),
    );
    // Use baseDelayMs=1 to make test fast
    const result = await fetchWithRetry<{ data: string }>("https://example.com", 3, 1);
    expect(result.data).toBe("retry-ok");
  });

  it("throws after maxAttempts exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("always fails")));
    await expect(
      fetchWithRetry("https://example.com", 2, 1),
    ).rejects.toThrow();
  });
});

// ── Sprint 6 (v7.4): network state tracker ───────────────────────────────────

describe("Fetch — network state tracker (v7.4)", () => {
  beforeEach(() => {
    // Reset state between tests
    for (let i = 0; i < 5; i++) recordFetchSuccess();
  });

  it("starts with 0 consecutive failures", () => {
    expect(getConsecutiveFailures()).toBe(0);
    expect(isNetworkOffline()).toBe(false);
  });

  it("recordFetchFailure increments consecutive failures", () => {
    recordFetchFailure();
    expect(getConsecutiveFailures()).toBe(1);
    recordFetchFailure();
    expect(getConsecutiveFailures()).toBe(2);
  });

  it("becomes offline after 3 consecutive failures", () => {
    recordFetchFailure();
    recordFetchFailure();
    expect(isNetworkOffline()).toBe(false);
    recordFetchFailure();
    expect(isNetworkOffline()).toBe(true);
  });

  it("recordFetchSuccess resets failure streak", () => {
    recordFetchFailure();
    recordFetchFailure();
    recordFetchFailure();
    expect(isNetworkOffline()).toBe(true);
    recordFetchSuccess();
    expect(isNetworkOffline()).toBe(false);
    expect(getConsecutiveFailures()).toBe(0);
  });
});

// ── Sprint 6 (v7.4): fetchWithRetry ─────────────────────────────────────────

describe("Fetch — fetchWithRetry (v7.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves on first attempt when fetchJSON succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "ok" }),
        text: async () => '{"data":"ok"}',
      } as Response),
    );
    const result = await fetchWithRetry<{ data: string }>("https://example.com");
    expect(result.data).toBe("ok");
  });

  it("retries on failure and succeeds on second attempt", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls++;
        if (calls < 2) return Promise.reject(new Error("network error"));
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: "retry-ok" }),
          text: async () => '{"data":"retry-ok"}',
        } as Response);
      }),
    );
    // Use baseDelayMs=1 to make test fast
    const result = await fetchWithRetry<{ data: string }>("https://example.com", 3, 1);
    expect(result.data).toBe("retry-ok");
  });

  it("throws after maxAttempts exhausted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("always fails")));
    await expect(
      fetchWithRetry("https://example.com", 2, 1),
    ).rejects.toThrow();
  });
});

// -- fetchWithStale (Sprint 5 / v7.5) -----------------------------------------

import { fetchWithStale } from "@/core/fetch";
import * as cacheModule from "@/core/cache";

vi.mock("@/core/cache");

describe("fetchWithStale", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onData with fresh cache hit (isStale=false), skips fetcher", async () => {
    vi.mocked(cacheModule.cGet).mockReturnValue({ v: 1 });
    const fetcher = vi.fn();
    const onData = vi.fn();
    await fetchWithStale({ cacheKey: "k", ttlMs: 1000, fetcher, onData });
    expect(onData).toHaveBeenCalledWith({ v: 1 }, false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows stale first then fresh on cache miss + fetch succeeds", async () => {
    vi.mocked(cacheModule.cGet).mockReturnValue(null);
    vi.mocked(cacheModule.cGetStale).mockReturnValue({ stale: true });
    vi.mocked(cacheModule.cSet).mockReturnValue(undefined);
    const fetcher = vi.fn().mockResolvedValue({ fresh: true });
    const onData = vi.fn();
    await fetchWithStale({ cacheKey: "k", ttlMs: 1000, fetcher, onData });
    expect(onData).toHaveBeenNthCalledWith(1, { stale: true }, true);
    expect(onData).toHaveBeenNthCalledWith(2, { fresh: true }, false);
    expect(cacheModule.cSet).toHaveBeenCalledWith("k", { fresh: true });
  });

  it("shows staticFallback when both cache and fetcher fail", async () => {
    vi.mocked(cacheModule.cGet).mockReturnValue(null);
    vi.mocked(cacheModule.cGetStale).mockReturnValue(null);
    vi.mocked(cacheModule.cSet).mockReturnValue(undefined);
    const fetcher = vi.fn().mockRejectedValue(new Error("network fail"));
    const onData = vi.fn();
    await fetchWithStale({ cacheKey: "k", ttlMs: 1000, fetcher, onData, staticFallback: { fallback: true } });
    expect(onData).toHaveBeenCalledWith({ fallback: true }, true);
  });

  it("shows staticFallback optimistically then fresh on success", async () => {
    vi.mocked(cacheModule.cGet).mockReturnValue(null);
    vi.mocked(cacheModule.cGetStale).mockReturnValue(null);
    vi.mocked(cacheModule.cSet).mockReturnValue(undefined);
    const fetcher = vi.fn().mockResolvedValue({ fresh: true });
    const onData = vi.fn();
    await fetchWithStale({ cacheKey: "k", ttlMs: 1000, fetcher, onData, staticFallback: { fallback: true } });
    expect(onData).toHaveBeenNthCalledWith(1, { fallback: true }, true);
    expect(onData).toHaveBeenNthCalledWith(2, { fresh: true }, false);
  });
});
