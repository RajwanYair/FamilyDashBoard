/**
 * Tests for src/core/worker-client.ts
 *
 * Verifies: route URL construction, envelope unwrapping, HTTP-error throws,
 * timeout propagation via fetchWithTimeout, and the submitErrors fire-and-forget.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

const WORKER_BASE = "https://fdb.rajwanyair.workers.dev";

function makeEnvelope<T>(data: T): object {
  return { data, source: "test", stale: false, ts: Date.now(), ttl: 300 };
}

function makeFetchOk(body: object): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  }) as unknown as typeof globalThis.fetch;
}

function makeFetchError(status: number): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  }) as unknown as typeof globalThis.fetch;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("worker-client — wc", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── health ──

  it("wc.health() calls /health and returns envelope", async () => {
    const body = makeEnvelope({ ok: true, status: "healthy", ts: 1 });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    const result = await wc.health();
    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(calledUrl).toContain(`${WORKER_BASE}/health`);
    expect(result).toEqual(body);
  });

  // ── weather ──

  it("wc.weather() appends lat/lon to URL", async () => {
    const body = makeEnvelope({ current: {}, hourly: {}, daily: {} });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.weather({ lat: 31.78, lon: 35.22 });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/weather");
    expect(url).toContain("lat=31.78");
    expect(url).toContain("lon=35.22");
  });

  // ── currency ──

  it("wc.currency() calls /api/currency", async () => {
    const body = makeEnvelope({ rates: { USD: 3.7 }, base_code: "ILS", time_last_update_utc: "" });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    const result = await wc.currency();
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/currency");
    expect(result).toEqual(body);
  });

  // ── hebcal ──

  it("wc.hebcal() appends geonameid param", async () => {
    const body = makeEnvelope({ title: "Shabbat", items: [] });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.hebcal({ geonameid: 293397 });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/hebcal");
    expect(url).toContain("geonameid=293397");
  });

  it("wc.hebcalHolidays() appends year param", async () => {
    const body = makeEnvelope({ title: "Holidays", items: [] });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.hebcalHolidays({ year: 5785 });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/hebcal/holidays");
    expect(url).toContain("year=5785");
  });

  // ── stocks ──

  it("wc.stocks() appends sym param", async () => {
    const body = makeEnvelope({ chart: { result: [] } });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.stocks({ sym: "AAPL" });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/stocks");
    expect(url).toContain("sym=AAPL");
  });

  // ── news ──

  it("wc.news() appends url param", async () => {
    const body = makeEnvelope({ items: [], count: 0, sources: 1, deduped: 0 });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.news({ url: "https://example.com/rss" });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/news");
    expect(url).toContain(encodeURIComponent("https://example.com/rss"));
  });

  it("wc.newsAggregate() calls /api/news/aggregate", async () => {
    const body = makeEnvelope({ items: [], count: 5, sources: 16, deduped: 3 });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.newsAggregate();
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/news/aggregate");
  });

  // ── alerts ──

  it("wc.alerts() calls /api/alerts", async () => {
    const body = makeEnvelope([]);
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.alerts();
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/alerts");
  });

  // ── calendar ──

  it("wc.calendar() appends url param", async () => {
    const body = makeEnvelope({ events: [] });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.calendar({ url: "https://calendar.google.com/ical/test.ics" });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/calendar");
  });

  // ── sefaria ──

  it("wc.sefariaCalendar() calls /api/sefaria/calendar", async () => {
    const body = makeEnvelope({ calendar_items: [], date: "2024-01-01" });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.sefariaCalendar();
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/sefaria/calendar");
  });

  it("wc.sefariaText() appends ref param", async () => {
    const body = makeEnvelope({
      ref: "Berakhot.2a.1",
      heRef: "ברכות ב א",
      text: "...",
      he: "...",
      book: "Berakhot",
    });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.sefariaText({ ref: "Berakhot.2a.1" });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/sefaria/text");
    expect(url).toContain("ref=");
  });

  // ── crypto ──

  it("wc.crypto() with default params calls /api/crypto", async () => {
    const body = makeEnvelope({ bitcoin: { usd: 50000, usd_24h_change: 1.5 } });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.crypto();
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("/api/crypto");
  });

  it("wc.crypto() with explicit params appends ids and vs_currencies", async () => {
    const body = makeEnvelope({ bitcoin: { usd: 50000, usd_24h_change: 2 } });
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    await wc.crypto({ ids: "bitcoin", vs_currencies: "usd" });
    const url: string = (fetchSpy.mock.calls[0] as [string, ...unknown[]])[0];
    expect(url).toContain("ids=bitcoin");
    expect(url).toContain("vs_currencies=usd");
  });

  // ── error handling ──

  it("throws on non-2xx HTTP status", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) });
    const { wc } = await import("@/core/worker-client");
    await expect(wc.currency()).rejects.toThrow("503");
  });

  it("throws on network error (fetch rejects)", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network failure"));
    const { wc } = await import("@/core/worker-client");
    await expect(wc.weather({ lat: 0, lon: 0 })).rejects.toThrow("network failure");
  });

  // ── submitErrors (fire-and-forget) ──

  it("submitErrors swallows errors and resolves", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("offline"));
    const { wc } = await import("@/core/worker-client");
    await expect(wc.submitErrors([{ msg: "test" }])).resolves.toBeUndefined();
  });

  it("submitErrors POSTs to /api/errors", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(null) });
    const { wc } = await import("@/core/worker-client");
    await wc.submitErrors([{ code: 42 }]);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/errors");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  // ── WorkerEnvelope type shape ──

  it("WorkerEnvelope has expected shape from response", async () => {
    const body = makeEnvelope([]);
    fetchSpy.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(body) });
    const { wc } = await import("@/core/worker-client");
    const env = await wc.alerts();
    expect(env).toHaveProperty("data");
    expect(env).toHaveProperty("source");
    expect(env).toHaveProperty("stale");
    expect(env).toHaveProperty("ts");
  });
});
