/**
 * Sprint 97 — News RSS Adapter tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNewsAdapter } from "@/cards/news/news-adapter";
import { cClear, cSet, cGet } from "@/core/cache";
import { _resetProviderHealth, getProviderHealth } from "@/core/provider";

// Mock fetchFeed and runConcurrent so we don't hit the network
vi.mock("@/cards/news/news", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/cards/news/news")>();
  return {
    ...actual,
    fetchFeed: vi.fn(() =>
      Promise.resolve([
        {
          title: "Test News",
          link: "https://example.com",
          pubDate: new Date().toISOString(),
          source: "Test",
        },
      ]),
    ),
  };
});

vi.mock("@/core/config", () => ({
  loadConfig: () => ({}),
  getConfig: () => ({}),
}));

describe("createNewsAdapter (Sprint 97)", () => {
  const adapter = createNewsAdapter();

  beforeEach(() => {
    cClear();
    _resetProviderHealth();
  });

  it("has correct id and displayName", () => {
    expect(adapter.id).toBe("news-rss");
    expect(adapter.displayName).toBe("News RSS Feeds");
  });

  it("returns cached data when fresh", () => {
    const items = [{ title: "cached", link: "", pubDate: "", source: "c" }];
    cSet("news", items);
    return adapter.fetch().then((r) => {
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data).toEqual(items);
    });
  });

  it("fetches from feeds when cache is empty", async () => {
    const result = await adapter.fetch();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("records success in provider health", async () => {
    await adapter.fetch();
    expect(getProviderHealth("news-rss").status).toBe("ok");
  });

  it("status() returns provider health status", () => {
    expect(adapter.status()).toBe("ok");
  });
});
