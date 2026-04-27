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

/**
 * Curated RSS feed list for /api/news/aggregate.
 * Each entry defines the fetch URL and the display source name.
 * All hostnames MUST also appear in ALLOWED_NEWS_ORIGINS below.
 */
export const NEWS_FEED_URLS: Array<{ url: string; src: string }> = [
  { url: "https://www.ynet.co.il/Integration/StoryRss1854.xml", src: "Ynet מבזקים" },
  { url: "https://rss.walla.co.il/feed/1", src: "וואלה" },
  { url: "https://www.mako.co.il/AjaxPage?jspName=HPFloatingRSS.jsp", src: "מאקו" },
  { url: "https://www.kan.org.il/podcast/2578/", src: "כאן חדשות" },
  { url: "https://www.n12.co.il/cmlink/1.6017730", src: "N12" },
  { url: "https://www.israelhayom.co.il/rss.xml", src: "ישראל היום" },
  {
    url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585",
    src: "גלובס",
  },
  { url: "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml", src: "כלכליסט" },
  { url: "https://www.makorrishon.co.il/feed/", src: "מקור ראשון" },
  { url: "https://www.kikar.co.il/rss", src: "כיכר השבת" },
  { url: "https://www.ice.co.il/rss/all", src: "ICE" },
  { url: "https://www.geektime.co.il/feed/", src: "גיקטיים" },
  { url: "https://www.now14.co.il/feed/", src: "ערוץ 14" },
  { url: "https://www.inn.co.il/Rss.aspx", src: "ערוץ 7" },
  { url: "https://www.srugim.co.il/feed", src: "סרוגים" },
  { url: "https://www.bhol.co.il/rss", src: "בחדרי חרדים" },
];

/** Permitted RSS/news feed origins (SSRF prevention). */
export const ALLOWED_NEWS_ORIGINS = [
  "www.rotter.net",
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
  "www.kan.org.il",
  "www.israelhayom.co.il",
  "www.globes.co.il",
  "www.makorrishon.co.il",
  "www.kikar.co.il",
  "www.ice.co.il",
  "www.geektime.co.il",
  "www.now14.co.il",
  "www.inn.co.il",
  "www.srugim.co.il",
  "www.bhol.co.il",
];
