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
  cGetAsync: vi.fn().mockResolvedValue(null),
  cGetStaleAsync: vi.fn().mockResolvedValue(null),
  cSet: vi.fn(),
  cSetAsync: vi.fn().mockResolvedValue(undefined),
}));

import {
  createCardLoader,
  createAsyncCardLoader,
  scheduleCard,
  staleChip,
  createSkeleton,
  createEmptyState,
  createErrorState,
  showCardSkeleton,
  hideCardSkeleton,
} from "@/cards/base-card";
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

// ── staleChip ──────────────────────────────────────────────────────
describe("staleChip ", () => {
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

// ── createSkeleton ─────────────────────────────────────────────
describe("createSkeleton ", () => {
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

// ── createEmptyState ───────────────────────────────────────────
describe("createEmptyState ", () => {
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

// ── createErrorState ───────────────────────────────────────────
describe("createErrorState ", () => {
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

// ── createAsyncCardLoader ────────────────────────────────────────

describe("createAsyncCardLoader", () => {
  beforeEach(() => {
    vi.mocked(idleMod.isPageVisible).mockReturnValue(true);
    vi.mocked(fetchMod.acquireLock).mockReturnValue(true);
    vi.mocked(cacheMod.cGetAsync).mockResolvedValue(null);
    vi.mocked(cacheMod.cGetStaleAsync).mockResolvedValue(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it("serves fresh async cache hit without fetching", async () => {
    vi.mocked(cacheMod.cGetAsync).mockResolvedValue({ v: 1 });
    const fetchFn = vi.fn<() => Promise<{ v: number }>>();
    const renderFn = vi.fn();
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn);
    await load();
    expect(renderFn).toHaveBeenCalledWith({ v: 1 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(syncMod.setSync).toHaveBeenCalledWith("test-card", "ok");
  });

  it("fetches when async cache misses", async () => {
    const fetchFn = vi.fn<() => Promise<number>>().mockResolvedValue(42);
    const renderFn = vi.fn();
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn);
    await load();
    expect(fetchFn).toHaveBeenCalled();
    expect(renderFn).toHaveBeenCalledWith(42);
    expect(cacheMod.cSetAsync).toHaveBeenCalledWith("test-card", 42);
  });

  it("shows stale data while fetching", async () => {
    vi.mocked(cacheMod.cGetStaleAsync).mockResolvedValue("old");
    const fetchFn = vi.fn<() => Promise<string>>().mockResolvedValue("new");
    const renderFn = vi.fn();
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn);
    await load();
    expect(renderFn).toHaveBeenCalledWith("old");
    expect(renderFn).toHaveBeenCalledWith("new");
  });

  it("falls back to stale on fetch error", async () => {
    vi.mocked(cacheMod.cGetStaleAsync).mockResolvedValue("stale");
    const fetchFn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("fail"));
    const renderFn = vi.fn();
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn);
    await load();
    expect(renderFn).toHaveBeenCalledWith("stale");
    expect(syncMod.setSync).toHaveBeenCalledWith("test-card", "ok");
  });

  it("skips when page not visible", async () => {
    vi.mocked(idleMod.isPageVisible).mockReturnValue(false);
    const fetchFn = vi.fn<() => Promise<number>>();
    const renderFn = vi.fn();
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn);
    await load();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(renderFn).not.toHaveBeenCalled();
  });

  it("rejects invalid data via validate callback", async () => {
    const fetchFn = vi.fn<() => Promise<unknown>>().mockResolvedValue("bad");
    const renderFn = vi.fn();
    const validate = (_d: unknown): _d is number => typeof _d === "number";
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn, validate);
    await load();
    expect(renderFn).not.toHaveBeenCalled();
    expect(syncMod.recordFailure).toHaveBeenCalledWith("test-card");
  });

  it("sets ok state when validate fails and stale data exists", async () => {
    vi.mocked(cacheMod.cGetStaleAsync).mockResolvedValue({ stale: true });
    const fetchFn = vi.fn<() => Promise<unknown>>().mockResolvedValue("bad");
    const renderFn = vi.fn();
    const validate = (_d: unknown): _d is number => typeof _d === "number";
    const load = createAsyncCardLoader(OPTS, fetchFn, renderFn, validate);
    await load();
    expect(syncMod.setSync).toHaveBeenCalledWith("test-card", "ok");
    expect(syncMod.recordFailure).toHaveBeenCalledWith("test-card");
  });
});

// ── createCardLoader validate callback ──────────────────────────
describe("Base Card — createCardLoader validate callback", () => {
  it("sets error state when validate rejects and no stale data", async () => {
    const fetchData = vi.fn<() => Promise<unknown>>().mockResolvedValue("bad");
    const renderData = vi.fn();
    const validate = (_d: unknown): _d is number => typeof _d === "number";

    const load = createCardLoader(OPTS, fetchData, renderData, validate);
    await load();

    expect(renderData).not.toHaveBeenCalled();
    expect(syncMod.setSync).toHaveBeenCalledWith(OPTS.id, "error");
    expect(syncMod.recordFailure).toHaveBeenCalledWith(OPTS.id);
  });

  it("sets ok state when validate rejects but stale data exists", async () => {
    vi.mocked(cacheMod.cGetStale).mockReturnValue({ old: true });
    const fetchData = vi.fn<() => Promise<unknown>>().mockResolvedValue("bad");
    const renderData = vi.fn();
    const validate = (_d: unknown): _d is number => typeof _d === "number";

    const load = createCardLoader(OPTS, fetchData, renderData, validate);
    await load();

    expect(syncMod.setSync).toHaveBeenCalledWith(OPTS.id, "ok");
    expect(syncMod.recordFailure).toHaveBeenCalledWith(OPTS.id);
  });
});

describe("showCardSkeleton / hideCardSkeleton", () => {
  it("prepends a skeleton to the container and sets aria-busy", () => {
    const container = document.createElement("div");
    showCardSkeleton("skel-test-1", container);
    expect(container.firstElementChild?.className).toBe("card-skeleton");
    expect(container.getAttribute("aria-busy")).toBe("true");
  });

  it("is idempotent — calling twice does not add a second skeleton", () => {
    const container = document.createElement("div");
    showCardSkeleton("skel-test-2", container);
    showCardSkeleton("skel-test-2", container);
    expect(container.querySelectorAll(".card-skeleton").length).toBe(1);
  });

  it("hideCardSkeleton removes the skeleton element", () => {
    const container = document.createElement("div");
    showCardSkeleton("skel-test-3", container);
    hideCardSkeleton("skel-test-3");
    expect(container.querySelector(".card-skeleton")).toBeNull();
  });

  it("hideCardSkeleton is safe to call when no skeleton exists", () => {
    expect(() => hideCardSkeleton("skel-test-none")).not.toThrow();
  });
});
