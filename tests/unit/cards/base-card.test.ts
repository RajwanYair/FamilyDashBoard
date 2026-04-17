/**
 * Tests for src/cards/base-card.ts
 *
 * Covers: createCardLoader (fresh-cache, fetch-success, fetch-error, stale,
 * no-lock, page-hidden) and scheduleCard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/core/idle", () => ({
  isPageVisible: vi.fn().mockReturnValue(true),
}));
vi.mock("@/core/fetch", () => ({
  acquireLock: vi.fn().mockReturnValue(true),
  releaseLock: vi.fn(),
  runConcurrent: vi.fn(),
}));
vi.mock("@/core/sync", () => ({
  setSync: vi.fn(),
  syncBurst: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));
vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));
vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));

import { createCardLoader, scheduleCard, staleChip, createSkeleton, createEmptyState, createErrorState } from "@/cards/base-card";
import * as idleMod from "@/core/idle";
import * as fetchMod from "@/core/fetch";
import * as cacheMod from "@/core/cache";
import * as syncMod from "@/core/sync";

const OPTS = { id: "test-card", ttl: 60_000, interval: 300_000 };

// Reset all mock default return values before each test
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(idleMod.isPageVisible).mockReturnValue(true);
  vi.mocked(fetchMod.acquireLock).mockReturnValue(true);
  vi.mocked(cacheMod.cGet).mockReturnValue(null);
  vi.mocked(cacheMod.cGetStale).mockReturnValue(null);
});

describe("Base Card — createCardLoader fresh cache hit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders from cache without calling fetchData", async () => {
    const cachedData = { value: 42 };
    vi.mocked(cacheMod.cGet).mockReturnValueOnce(cachedData);
    const fetchData = vi.fn().mockResolvedValue({ value: 99 });
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    expect(fetchData).not.toHaveBeenCalled();
    expect(renderData).toHaveBeenCalledWith(cachedData);
    expect(syncMod.setSync).toHaveBeenCalledWith(OPTS.id, "ok");
  });
});

describe("Base Card — createCardLoader fetch success", () => {
  it("fetches, caches, and renders data when cache is empty", async () => {
    const freshData = { score: 100 };
    const fetchData = vi.fn().mockResolvedValue(freshData);
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    expect(fetchData).toHaveBeenCalled();
    expect(cacheMod.cSet).toHaveBeenCalledWith(OPTS.id, freshData);
    expect(renderData).toHaveBeenCalledWith(freshData);
    expect(syncMod.setSync).toHaveBeenCalledWith(OPTS.id, "ok");
    expect(syncMod.recordSuccess).toHaveBeenCalledWith(OPTS.id);
  });
});

describe("Base Card — createCardLoader stale data shown while fetching", () => {
  it("renders stale data before fetch resolves", async () => {
    const staleData = { stale: true };
    vi.mocked(cacheMod.cGetStale).mockReturnValue(staleData);
    const freshData = { fresh: true };
    const fetchData = vi.fn().mockResolvedValue(freshData);
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    // renderData called with stale first, then fresh
    expect(renderData).toHaveBeenCalledTimes(2);
    expect(renderData).toHaveBeenNthCalledWith(1, staleData);
    expect(renderData).toHaveBeenNthCalledWith(2, freshData);
  });
});

describe("Base Card — createCardLoader fetch error", () => {
  it("sets error sync state when fetch throws and no stale data", async () => {
    const fetchData = vi.fn().mockRejectedValue(new Error("Network error"));
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    expect(syncMod.setSync).toHaveBeenCalledWith(OPTS.id, "error");
    expect(syncMod.recordFailure).toHaveBeenCalledWith(OPTS.id);
    expect(renderData).not.toHaveBeenCalled();
  });

  it("sets ok sync state when fetch throws but stale data exists", async () => {
    vi.mocked(cacheMod.cGetStale).mockReturnValue({ old: "data" });
    const fetchData = vi.fn().mockRejectedValue(new Error("Network error"));
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    expect(syncMod.setSync).toHaveBeenCalledWith(OPTS.id, "ok");
  });
});

describe("Base Card — createCardLoader no-lock early return", () => {
  it("does not fetch or render when lock is not acquired", async () => {
    vi.mocked(fetchMod.acquireLock).mockReturnValueOnce(false);
    const fetchData = vi.fn();
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    expect(fetchData).not.toHaveBeenCalled();
    expect(renderData).not.toHaveBeenCalled();
  });
});

describe("Base Card — createCardLoader page hidden early return", () => {
  it("does not fetch or render when page is not visible", async () => {
    vi.mocked(idleMod.isPageVisible).mockReturnValueOnce(false);
    const fetchData = vi.fn();
    const renderData = vi.fn();

    const load = createCardLoader(OPTS, fetchData, renderData);
    await load();

    expect(fetchData).not.toHaveBeenCalled();
    expect(renderData).not.toHaveBeenCalled();
  });
});

describe("Base Card — scheduleCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a truthy timer handle", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    const id = scheduleCard(load, 1000);
    expect(id).toBeTruthy();
  });

  it("calls the load function after the interval passes", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    scheduleCard(load, 1000);
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1001);
    expect(load).toHaveBeenCalledOnce();
  });

  it("calls load function repeatedly on each interval", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    scheduleCard(load, 500);
    vi.advanceTimersByTime(1600);
    expect(load).toHaveBeenCalledTimes(3);
  });
});

// ── Sprint 48: staleChip ──────────────────────────────────────────────────────
describe("staleChip (Sprint 48)", () => {
  // U+05E2 U+05DB U+05E9 U+05D9 U+05D5 = עכשיו
  const NOW = "\u05E2\u05DB\u05E9\u05D9\u05D5";
  // U+05DC U+05E4 U+05E0 U+05D9 = לפני
  const LFNY = "\u05DC\u05E4\u05E0\u05D9";
  // U+05D3 U+05E7 = דק
  const DQ = "\u05D3\u05E7\u0027";
  // U+05E9 U+05E2 U+05D4 = שעה
  const HOUR = "\u05E9\u05E2\u05D4";
  // U+05D9 U+05D5 U+05DD = יום
  const DAY1 = "\u05D9\u05D5\u05DD";
  // U+05D9 U+05DE U+05D9 U+05DD = ימים
  const DAYN = "\u05D9\u05DE\u05D9\u05DD";

  it("returns NOW string for less than 60s", () => {
    expect(staleChip(0)).toBe(NOW);
    expect(staleChip(59_999)).toBe(NOW);
  });

  it("shows minutes for 1-59 minutes", () => {
    expect(staleChip(60_000)).toBe(`${LFNY} 1 ${DQ}`);
    expect(staleChip(3 * 60_000)).toBe(`${LFNY} 3 ${DQ}`);
    expect(staleChip(59 * 60_000)).toBe(`${LFNY} 59 ${DQ}`);
  });

  it("shows 1 hour for 60-119 minutes", () => {
    expect(staleChip(60 * 60_000)).toBe(`${LFNY} ${HOUR}`);
  });

  it("shows N hours for 2+ hours", () => {
    expect(staleChip(2 * 60 * 60_000)).toBe(`${LFNY} ${HOUR} 2`);
    expect(staleChip(5 * 60 * 60_000)).toBe(`${LFNY} ${HOUR} 5`);
  });

  it("shows single day form for 1 day", () => {
    expect(staleChip(24 * 60 * 60_000)).toBe(`${LFNY} 1 ${DAY1}`);
  });

  it("shows plural day form for 2+ days", () => {
    expect(staleChip(2 * 24 * 60 * 60_000)).toBe(`${LFNY} 2 ${DAYN}`);
    expect(staleChip(7 * 24 * 60 * 60_000)).toBe(`${LFNY} 7 ${DAYN}`);
  });
});

// ── Sprint 51: createSkeleton ─────────────────────────────────────────────
describe("createSkeleton (Sprint 51)", () => {
  it("returns a div with class card-skeleton", () => {
    const el = createSkeleton();
    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("card-skeleton");
  });

  it("renders 3 lines by default", () => {
    const el = createSkeleton();
    expect(el.querySelectorAll(".card-skeleton__line")).toHaveLength(3);
  });

  it("renders N lines when specified", () => {
    const el = createSkeleton(5);
    expect(el.querySelectorAll(".card-skeleton__line")).toHaveLength(5);
  });

  it("has aria-hidden=true", () => {
    const el = createSkeleton();
    expect(el.getAttribute("aria-hidden")).toBe("true");
  });
});

// ── Sprint 52: createEmptyState ───────────────────────────────────────────
describe("createEmptyState (Sprint 52)", () => {
  it("returns a div with class card-empty", () => {
    const el = createEmptyState("No data");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("card-empty");
  });

  it("renders the message safely via textContent", () => {
    const el = createEmptyState("<script>alert(1)</script>");
    const msg = el.querySelector(".card-empty__msg");
    expect(msg?.textContent).toBe("<script>alert(1)</script>");
    // Ensure no real script element was injected
    expect(el.querySelector("script")).toBeNull();
  });

  it("contains an icon and message child", () => {
    const el = createEmptyState("Empty");
    expect(el.querySelector(".card-empty__icon")).not.toBeNull();
    expect(el.querySelector(".card-empty__msg")).not.toBeNull();
  });
});

// ── Sprint 53: createErrorState ───────────────────────────────────────────
describe("createErrorState (Sprint 53)", () => {
  it("returns a div with class card-error", () => {
    const el = createErrorState("Failed");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("card-error");
  });

  it("has role=alert for accessibility", () => {
    const el = createErrorState("Failed");
    expect(el.getAttribute("role")).toBe("alert");
  });

  it("renders the error message safely via textContent", () => {
    const el = createErrorState("<img src=x onerror=alert(1)>");
    const msg = el.querySelector(".card-error__msg");
    expect(msg?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(el.querySelector("img")).toBeNull();
  });

  it("contains an icon and message child", () => {
    const el = createErrorState("Error");
    expect(el.querySelector(".card-error__icon")).not.toBeNull();
    expect(el.querySelector(".card-error__msg")).not.toBeNull();
  });
});
