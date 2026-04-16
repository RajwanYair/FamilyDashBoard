/**
 * FamilyDashBoard Worker — SSRF allowlists
 */

/** Permitted ICS/calendar URL origins (SSRF prevention). */
export const ALLOWED_CALENDAR_ORIGINS = [
  "calendar.google.com",
  "outlook.office365.com",
  "outlook.live.com",
  "ical.mac.com",
  "apple.com",
];

/** Permitted RSS/news feed origins (SSRF prevention). */
export const ALLOWED_NEWS_ORIGINS = [
  "rss.ynet.co.il",
  "www.ynet.co.il",
  "rss.haaretz.co.il",
  "www.haaretz.co.il",
  "www.mako.co.il",
  "rss.mako.co.il",
  "www.calcalist.co.il",
  "rss.walla.co.il",
  "feeds.walla.co.il",
  "rssfeeds.jpost.com",
  "www.jpost.com",
  "feeds.jpost.com",
  "rss.timesofisrael.com",
  "www.timesofisrael.com",
  "www.ynetnews.com",
  "feeds.ynetnews.com",
  "www.n12.co.il",
  "rss.n12.co.il",
  "www.13tv.co.il",
];
