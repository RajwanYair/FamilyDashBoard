/**
 * FamilyDashBoard v7 — News RSS Provider Adapter (Sprint 97)
 *
 * Implements ProviderAdapter for aggregated RSS news feeds.
 * Delegates to the existing NEWS_FEEDS + fetchFeed pipeline.
 */

import type { ProviderAdapter, ProviderResult } from "../../types/provider";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { INTERVALS } from "../../core/constants";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
} from "../../core/provider";
import { runConcurrent } from "../../core/fetch";
import { diagLog } from "../../core/diag";
import type { ProviderStatus } from "../../core/provider";
import type { NewsItem } from "../../types/api";
import { NEWS_FEEDS, fetchFeed } from "./news";
import type { NewsFeed } from "./news";
import { loadConfig } from "../../core/config";

const PROVIDER_ID = "news-rss";
const CACHE_KEY = "news";

function getActiveFeeds(): NewsFeed[] {
  const cfg = loadConfig();
  const disabled = new Set(cfg.disabledFeeds ?? []);
  return NEWS_FEEDS.filter((f) => !disabled.has(f.src));
}

export function createNewsAdapter(): ProviderAdapter<NewsItem[]> {
  const cacheTtl = INTERVALS.NEWS;

  return {
    id: PROVIDER_ID,
    displayName: "News RSS Feeds",
    cacheKey: CACHE_KEY,
    cacheTtl,

    async fetch(): Promise<ProviderResult<NewsItem[]>> {
      const cached = cGet<NewsItem[]>(CACHE_KEY, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      try {
        const feeds = getActiveFeeds();
        const results = await runConcurrent(
          feeds.map((f) => () => fetchFeed(f)),
        );

        const allItems: NewsItem[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") allItems.push(...r.value);
        }

        if (allItems.length === 0) {
          recordProviderFailure(PROVIDER_ID);
          const stale = cGetStale<NewsItem[]>(CACHE_KEY);
          return {
            ok: false,
            error: "No news items fetched from any feed",
            stale: stale ?? undefined,
          };
        }

        // Deduplicate by first 40 chars of title
        const seen = new Set<string>();
        const unique = allItems.filter((item) => {
          const key = item.title.trim().substring(0, 40);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort by pubDate descending
        unique.sort(
          (a, b) =>
            new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
        );

        cSet(CACHE_KEY, unique);
        recordProviderSuccess(PROVIDER_ID);
        diagLog(`FDB-097: [news] Fetched ${unique.length} items from ${feeds.length} feeds`);
        return { ok: true, data: unique };
      } catch (err) {
        recordProviderFailure(PROVIDER_ID);
        const stale = cGetStale<NewsItem[]>(CACHE_KEY);
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          stale: stale ?? undefined,
        };
      }
    },

    status(): ProviderStatus {
      return getProviderHealth(PROVIDER_ID).status;
    },
  };
}
