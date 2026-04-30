/**
 * FamilyDashBoard v13 — News RSS Provider Adapter (Sprint 97)
 *
 * Implements ProviderAdapter for aggregated RSS news feeds.
 * Delegates to the existing NEWS_FEEDS + fetchFeed pipeline.
 */

import type { ProviderAdapter } from "../../types/provider";
import { INTERVALS } from "../../core/constants";
import { runConcurrent } from "../../core/fetch";
import type { NewsItem } from "../../types/api";
import { NEWS_FEEDS, fetchFeed } from "./news";
import type { NewsFeed } from "./news";
import { loadConfig } from "../../core/config";
import { createCachedProviderAdapter } from "../../core/provider-adapter";

const PROVIDER_ID = "news-rss";
const CACHE_KEY = "news";

function getActiveFeeds(): NewsFeed[] {
  const cfg = loadConfig();
  const disabled = new Set(cfg.disabledFeeds ?? []);
  return NEWS_FEEDS.filter((f) => !disabled.has(f.src));
}

export function createNewsAdapter(): ProviderAdapter<NewsItem[]> {
  const cacheTtl = INTERVALS.NEWS;

  return createCachedProviderAdapter({
    id: PROVIDER_ID,
    displayName: "News RSS Feeds",
    cacheKey: CACHE_KEY,
    cacheTtl,
    async fetchFresh(): Promise<NewsItem[]> {
      const feeds = getActiveFeeds();
      const results = await runConcurrent(feeds.map((f) => () => fetchFeed(f)));

      const allItems: NewsItem[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") allItems.push(...result.value);
      }

      if (allItems.length === 0) {
        throw new Error("No news items fetched from any feed");
      }

      const seen = new Set<string>();
      const unique = allItems.filter((item) => {
        const key = item.title.trim().substring(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      unique.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

      return unique;
    },
    successLog: (data) => {
      const feedCount = getActiveFeeds().length;
      return `FDB-097: [news] Fetched ${data.length} items from ${feedCount} feeds`;
    },
  });
}
