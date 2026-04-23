/**
 * FamilyDashBoard Worker — Cron pre-warm handler (V12-OPS-1)
 *
 * Triggered by Cloudflare cron at 00:00 UTC, 12:00 UTC, and 23:00 UTC every day.
 * Warms the KV stale-fallback cache for the most-requested API paths so
 * that the first real user request after a cold period returns cached data.
 *
 * Routes warmed (00:00 + 12:00 UTC):
 *   /api/currency          — exchange rates (ILS base, low-traffic but slow upstream)
 *   /api/hebcal            — Shabbat times + weekly parasha (Jerusalem)
 *   /api/hebcal/holidays   — holidays for current Hebrew year
 *   /api/stocks?sym=BTC    — BTC price (always active)
 *
 * Additional route warmed (23:00 UTC):
 *   /api/hebcal/holidays?year=<next>  — pre-warm NEXT Hebrew year on 29 Elul
 *     so the holiday card doesn't cold-start on Rosh Hashana morning.
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
import { pruneOldReports } from "../utils/d1-reports";

/** Synthetic "good enough" URL for warming hebcal (Jerusalem geonameid). */
const HEBCAL_WARM_URL = "https://worker/api/hebcal?geonameid=281184";
const STOCKS_BTC_URL = "https://worker/api/stocks?sym=BTC-USD";

/** Return the ISO year for the current Hebrew year's Gregorian equivalent.
 *  Hebcal numbers Hebrew years; the civil year we need is simply the current
 *  calendar year.  For the 23:00 pre-warm we warm next civil year (+1) so that
 *  if Rosh Hashana falls in the first hours of the day the KV already has it.
 */
function hebcalHolidaysUrl(yearOffset = 0): string {
  const year = new Date().getUTCFullYear() + yearOffset;
  return `https://worker/api/hebcal/holidays?year=${year}`;
}

/**
 * Run a fire-and-forget pre-warm for all hot paths.
 * Errors are swallowed — cron failures must not crash the Worker.
 */
export async function handleScheduled(env: Env): Promise<void> {
  const tasks: Promise<unknown>[] = [
    handleCurrency(env).catch(() => null),
    handleHebcal(new URL(HEBCAL_WARM_URL), env).catch(() => null),
    handleHebcalHolidays(new URL(hebcalHolidaysUrl(0)), env).catch(() => null),
    handleStocks(new URL(STOCKS_BTC_URL), env).catch(() => null),
    // Prune browser_reports older than 30 days (V12-OPS, ADR-028)
    env.DB ? pruneOldReports(env.DB, 30).catch(() => null) : Promise.resolve(),
  ];

  await Promise.allSettled(tasks);
}

/**
 * Pre-warm next Hebrew year's holiday list at 23:00 UTC (V12-DATA).
 * Called only from the 23:00 cron trigger so it doesn't over-warm.
 * Warming the NEXT year's data ensures that Rosh Hashana morning's first
 * request is served from KV cache rather than from a cold Hebcal upstream.
 */
export async function handleNextYearPreWarm(env: Env): Promise<void> {
  await handleHebcalHolidays(new URL(hebcalHolidaysUrl(1)), env).catch(() => null);
}

/**
 * handleWeeklyDigest — Email Workers weekly digest (ADR-033, V13-S27).
 *
 * Triggered by the Saturday 23:00 UTC cron: `"0 23 * * 6"`.
 * Compiles a plain-text summary of the current week's stats and sends it
 * via Email Workers (send_email binding / MailChannels).
 *
 * When EMAIL_SEND_FROM or EMAIL_SEND_TO is not set, this is a no-op so
 * deployments without email configured are unaffected.
 *
 * Current summary includes:
 *  - Today's UTC date
 *  - Error count for today (from KV daily counter)
 *  - Browser report count (from D1 — placeholder)
 *  - A reminder to review the dashboard
 */
export async function handleWeeklyDigest(env: Env): Promise<void> {
  if (!env.EMAIL_SEND_FROM || !env.EMAIL_SEND_TO) {
    // Email not configured — skip silently
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  // Collect stats
  let errorCount = 0;
  if (env.CACHE_KV) {
    try {
      const raw = await env.CACHE_KV.get(`errors:count:${today}`);
      if (raw) {
        const n = parseInt(raw, 10);
        if (!isNaN(n)) errorCount = n;
      }
    } catch {
      // non-fatal
    }
  }

  const subject = `FamilyDashBoard Weekly Digest — ${today}`;
  const body = [
    `FamilyDashBoard Weekly Digest`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `📊 Stats for ${today}:`,
    `  • Client errors (KV counter): ${errorCount}`,
    `  • Browser reports (D1): see /api/reports/digest`,
    ``,
    `🔗 Dashboard: https://rajwanyair.github.io/FamilyDashBoard/`,
    `🔗 Worker: https://fdb.rajwanyair.workers.dev/health`,
    ``,
    `-- FamilyDashBoard automated digest`,
  ].join("\n");

  // Email Workers send_email (ADR-033)
  // The send_email binding is injected by Cloudflare at runtime.
  // We cast env to access it without hard-coding the types package.
  const sendEmail = (env as unknown as Record<string, unknown>)["send_email"] as
    | { send(msg: Record<string, unknown>): Promise<void> }
    | undefined;

  if (!sendEmail) {
    // send_email binding not configured — log and skip
    console.log(`[FDB-digest] send_email binding absent — would have sent:\n${subject}`);
    return;
  }

  try {
    await sendEmail.send({
      from: env.EMAIL_SEND_FROM,
      to: [env.EMAIL_SEND_TO],
      subject,
      text: body,
    });
    console.log(`[FDB-digest] Weekly digest sent to ${env.EMAIL_SEND_TO}`);
  } catch (err) {
    console.error("[FDB-digest] Failed to send weekly digest:", err);
  }
}

