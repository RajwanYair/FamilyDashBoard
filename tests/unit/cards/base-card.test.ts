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

import { createCardLoader, scheduleCard } from "@/cards/base-card";
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
