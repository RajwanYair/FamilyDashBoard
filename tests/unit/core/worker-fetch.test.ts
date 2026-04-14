/**
 * Tests for worker-first fetch additions:
 *   fetchViaWorker, fetchJSONWithWorker (src/core/fetch.ts)
 *   WORKER_BASE_URL, isWorkerEnabled (src/core/constants.ts)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchViaWorker } from "@/core/fetch";
import { WORKER_BASE_URL, isWorkerEnabled } from "@/core/constants";

// ── WORKER_BASE_URL + isWorkerEnabled ─────────────────────────────────────

describe("WORKER_BASE_URL constant", () => {
  it("is a non-empty string", () => {
    expect(typeof WORKER_BASE_URL).toBe("string");
    expect(WORKER_BASE_URL.length).toBeGreaterThan(0);
  });

  it("starts with https://", () => {
    expect(WORKER_BASE_URL).toMatch(/^https:\/\//);
  });
});

describe("isWorkerEnabled", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when online and WORKER_BASE_URL is set", () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    expect(isWorkerEnabled()).toBe(true);
  });

  it("returns false when navigator.onLine is false", () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    expect(isWorkerEnabled()).toBe(false);
  });
});

// ── fetchViaWorker ─────────────────────────────────────────────────────────

describe("fetchViaWorker", () => {
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
    expect(calledUrl).toContain("/proxy?url=");
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

  it("encodes the target URL in the worker request", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: true });
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    vi.stubGlobal("fetch", mockFetch);
    await fetchViaWorker("https://api.example.com/data?foo=bar&baz=1");
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      encodeURIComponent("https://api.example.com/data?foo=bar&baz=1"),
    );
  });
});
