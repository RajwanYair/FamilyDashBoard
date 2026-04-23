/**
 * FamilyDashBoard Worker — Cron pre-warm handler (V12-OPS-1)
 *
 * Triggered by Cloudflare cron at 00:00 UTC and 12:00 UTC every day.
 * Warms the KV stale-fallback cache for the most-requested API paths so
 * that the first real user request after a cold period returns cached data.
 *
 * Routes warmed:
 *   /api/currency          — exchange rates (ILS base, low-traffic but slow upstream)
 *   /api/hebcal            — Shabbat times + weekly parasha (Jerusalem)
 *   /api/hebcal/holidays   — holidays for current year
 *   /api/stocks?sym=BTC    — BTC price (always active)
 *
 * We do NOT warm /api/weather here because it is per-city and the user's
 * browser sends the lat/lon — the Worker cannot know which cities to warm.
 *
 * /api/news/aggregate is also excluded: RSS feeds update on their own schedule
 * and warming every hour would burn upstream rate limits.
 */

import type { Env } from "../types";
import { handleCurrency, handleHebcal, handleHebcalHolidays } from "./data";
import { handleStocks } from "./feeds";

/** Synthetic "good enough" URL for warming hebcal (Jerusalem geonameid). */
const HEBCAL_WARM_URL = "https://worker/api/hebcal?geonameid=281184";
const HEBCAL_HOLIDAYS_URL = `https://worker/api/hebcal/holidays?year=${new Date().getFullYear()}`;
const STOCKS_BTC_URL = "https://worker/api/stocks?sym=BTC-USD";

/**
 * Run a fire-and-forget pre-warm for all hot paths.
 * Errors are swallowed — cron failures must not crash the Worker.
 */
export async function handleScheduled(env: Env): Promise<void> {
  const tasks: Promise<unknown>[] = [
    handleCurrency(env).catch(() => null),
    handleHebcal(new URL(HEBCAL_WARM_URL), env).catch(() => null),
    handleHebcalHolidays(new URL(HEBCAL_HOLIDAYS_URL), env).catch(() => null),
    handleStocks(new URL(STOCKS_BTC_URL), env).catch(() => null),
  ];

  await Promise.allSettled(tasks);
}
