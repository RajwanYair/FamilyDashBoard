/**
 * Tests — Calendar/ICS Provider Adapter 
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

(globalThis as Record<string, unknown>).__APP_VERSION__ = "7.18.0";
(globalThis as Record<string, unknown>).__BUILD_TIME__ = "2026-01-01T00:00:00Z";

vi.stubGlobal("fetch", vi.fn());

import { createCalendarAdapter } from "@/cards/calendar/calendar-adapter";
import { _resetProviderHealth, getProviderHealth } from "@/core/provider";
import { cClear } from "@/core/cache";

const VALID_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Test Event
DTSTART:20260101T100000Z
DTEND:20260101T110000Z
END:VEVENT
END:VCALENDAR`;

describe("Calendar Provider Adapter ", () => {
  beforeEach(() => {
    localStorage.clear();
    cClear();
    _resetProviderHealth();
    vi.mocked(fetch).mockReset();
  });

  it("returns adapter with correct id and cacheKey", () => {
    const adapter = createCalendarAdapter("https://example.com/cal.ics", 0);
    expect(adapter.id).toBe("calendar-ics");
    expect(adapter.cacheKey).toBe("cal-ics-0");
    expect(adapter.displayName).toBe("Calendar ICS #0");
  });

  it("returns ok:true for valid ICS response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(VALID_ICS, { status: 200 }));
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("BEGIN:VCALENDAR");
    }
  });

  it("returns ok:false for non-ICS response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("<html>Not Found</html>", { status: 200 }));
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not valid ICS");
    }
  });

  it("returns ok:false and records failure on network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    const health = getProviderHealth("calendar-ics");
    expect(health.consecutiveFails).toBe(1);
  });

  it("records success on valid fetch", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(VALID_ICS, { status: 200 }));
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    await adapter.fetch();
    const health = getProviderHealth("calendar-ics");
    expect(health.status).toBe("ok");
    expect(health.successCount).toBe(1);
  });

  it("status() returns current provider health", () => {
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    expect(adapter.status()).toBe("ok");
  });

  it("returns cached data when cache hit (line 42 TRUE branch)", async () => {
    // First fetch populates cache
    vi.mocked(fetch).mockResolvedValue(new Response(VALID_ICS, { status: 200 }));
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    await adapter.fetch(); // populates cache

    // Second fetch should hit cache without calling fetch again
    vi.mocked(fetch).mockClear();
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("BEGIN:VCALENDAR");
    }
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("returns ok:false when HTTP response is not OK (line 48, !resp.ok branch)", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Not Found", { status: 404 }));
    const adapter = createCalendarAdapter("https://example.com/cal.ics");
    const result = await adapter.fetch();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("HTTP 404");
    }
  });
});
