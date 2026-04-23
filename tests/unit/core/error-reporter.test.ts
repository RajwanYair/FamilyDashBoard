/**
 * tests/unit/core/error-reporter.test.ts — v7.10
 *
 * Tests for the lightweight client-side error reporter.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  reportErrors,
  flushErrorReport,
  _resetReporter,
  _getPending,
} from "../../../src/core/error-reporter";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../../src/core/constants", () => ({
  WORKER_BASE_URL: "https://worker.test",
  isWorkerEnabled: vi.fn().mockReturnValue(true),
}));

const { isWorkerEnabled } = await import("../../../src/core/constants");

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Error Reporter — reportErrors", () => {
  beforeEach(() => {
    _resetReporter();
    vi.useFakeTimers();
    vi.mocked(isWorkerEnabled).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("queues errors into pending", () => {
    reportErrors([{ ts: 1000, message: "boom" }]);
    expect(_getPending()).toHaveLength(1);
  });

  it("does not queue when worker is disabled", () => {
    vi.mocked(isWorkerEnabled).mockReturnValue(false);
    reportErrors([{ ts: 1000, message: "boom" }]);
    expect(_getPending()).toHaveLength(0);
  });

  it("does not queue empty array", () => {
    reportErrors([]);
    expect(_getPending()).toHaveLength(0);
  });

  it("deduplicates errors by ts+message", () => {
    reportErrors([{ ts: 1000, message: "boom" }]);
    reportErrors([{ ts: 1000, message: "boom" }]);
    expect(_getPending()).toHaveLength(1);
  });

  it("accepts multiple distinct errors", () => {
    reportErrors([{ ts: 1000, message: "a" }]);
    reportErrors([{ ts: 2000, message: "b" }]);
    expect(_getPending()).toHaveLength(2);
  });

  it("flushes via fetch after debounce timer fires", async () => {
    reportErrors([{ ts: 1000, message: "err" }]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://worker.test/api/errors");
    expect(opts.method).toBe("POST");
  });

  it("clears pending after flush", async () => {
    reportErrors([{ ts: 1000, message: "err" }]);
    await vi.runAllTimersAsync();
    expect(_getPending()).toHaveLength(0);
  });
});

describe("Error Reporter — flushErrorReport", () => {
  beforeEach(() => {
    _resetReporter();
    vi.useFakeTimers();
    vi.mocked(isWorkerEnabled).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("flushes pending errors immediately without waiting for timer", async () => {
    reportErrors([{ ts: 1000, message: "urgent" }]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    flushErrorReport();
    await Promise.resolve(); // let async flush settle
    await vi.runAllTimersAsync();
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("is a no-op when pending is empty", async () => {
    flushErrorReport();
    await Promise.resolve();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("Error Reporter — network failure resilience", () => {
  beforeEach(() => {
    _resetReporter();
    vi.useFakeTimers();
    vi.mocked(isWorkerEnabled).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not throw when fetch fails", async () => {
    reportErrors([{ ts: 1000, message: "err" }]);
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
  });
});

// ── Sprint 38: request shape + batch cap tests ─────────────────────────────

describe("Error Reporter — request shape", () => {
  beforeEach(() => {
    _resetReporter();
    vi.useFakeTimers();
    vi.mocked(isWorkerEnabled).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends Content-Type: application/json", async () => {
    reportErrors([{ ts: 1000, message: "test" }]);
    await vi.runAllTimersAsync();
    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sets keepalive: true on fetch", async () => {
    reportErrors([{ ts: 1000, message: "test" }]);
    await vi.runAllTimersAsync();
    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(opts.keepalive).toBe(true);
  });

  it("caps batch at 20 errors even when 25 are pending", async () => {
    const errors = Array.from({ length: 25 }, (_, i) => ({ ts: i, message: `err${i}` }));
    reportErrors(errors);
    await vi.runAllTimersAsync();
    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(opts.body as string) as unknown[];
    expect(body).toHaveLength(20);
  });

  it("sends POST to /api/errors endpoint", async () => {
    reportErrors([{ ts: 1000, message: "test" }]);
    await vi.runAllTimersAsync();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/errors$/);
  });
});
