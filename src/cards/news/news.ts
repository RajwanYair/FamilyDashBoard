/**
 * FamilyDashBoard v6 — News Card
 *
 * Aggregates multiple Hebrew RSS feeds, deduplicates, sorts by date,
 * and renders a scrolling news strip with category detection.
 */

import { createCardLoader, scheduleCard } from "../base-card";
import { INTERVALS, PROXIES } from "../../core/constants";
import { runConcurrent } from "../../core/fetch";
import { loadConfig } from "../../core/config";
import { diagLog } from "../../core/diag";
import type { NewsItem } from "../../types/api";

// ── Feed definitions ──
export interface NewsFeed {
  url: string;
  src: string;
}

export const NEWS_FEEDS: NewsFeed[] = [
  {
    url: "https://www.ynet.co.il/Integration/StoryRss1854.xml",
    src: "Ynet מבזקים",
  },
  { url: "https://rss.walla.co.il/feed/1", src: "וואלה" },
  {
    url: "https://www.mako.co.il/AjaxPage?jspName=HPFloatingRSS.jsp",
    src: "מאקו",
  },
  { url: "https://www.kan.org.il/podcast/2578/", src: "כאן חדשות" },
  { url: "https://www.n12.co.il/cmlink/1.6017730", src: "N12" },
  { url: "https://www.rotter.net/scoopscache.xml", src: "רוטר סקופים" },
  { url: "https://www.israelhayom.co.il/rss.xml", src: "ישראל היום" },
  {
    url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585",
    src: "גלובס",
  },
  {
    url: "https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml",
    src: "כלכליסט",
  },
  { url: "https://www.makorrishon.co.il/feed/", src: "מקור ראשון" },
  { url: "https://www.kikar.co.il/rss", src: "כיכר השבת" },
  { url: "https://www.ice.co.il/rss/all", src: "ICE" },
  { url: "https://www.geektime.co.il/feed/", src: "גיקטיים" },
  { url: "https://www.now14.co.il/feed/", src: "ערוץ 14" },
  { url: "https://www.inn.co.il/Rss.aspx", src: "ערוץ 7" },
  { url: "https://www.srugim.co.il/feed", src: "סרוגים" },
  { url: "https://www.bhol.co.il/rss", src: "בחדרי חרדים" },
];

// ── DOM cache ──
let elRssScroll: HTMLElement | null = null;
let elNewsTicker: HTMLElement | null = null;

function cacheDom(): void {
  elRssScroll = document.getElementById("rss-scroll");
  elNewsTicker = document.getElementById("news-ticker");
}

// ── Category detection ──
function detectCategory(title: string): string | null {
  const t = (title || "").toLowerCase();
  if (/ביטחון|צבא|לחימה|טיל|רקטה|מלחמה|חמאס|טרור|נשק|כיבוש|ירי/.test(t))
    return "security";
  if (
    /פוליטיקה|ממשלה|כנסת|קואליציה|אופוזיציה|בחירות|מפלגה|שר|ראש.*ממשלה|נשיא/.test(
      t,
    )
  )
    return "politics";
  if (
    /כלכלה|שוק.*מניה|שקל|בנק|ריבית|תקציב|גז|נפט|ייצוא|ייבוא|שביתה|אינפלציה/.test(
      t,
    )
  )
    return "economy";
  if (
    /ספורט|כדורגל|כדורסל|טניס|אצלתנות|אולימפיאד|ליגה|אלופות|מונדיאל|גביע/.test(
      t,
    )
  )
    return "sport";
  if (
    /טכנולוגיה|סטארטאפ|בינה מלאכותית|ai\b|cyber|קיברנטי|אפליקציה|רובוט/.test(t)
  )
    return "tech";
  return null;
}

// ── Fetch a single RSS feed ──
async function fetchFeed(feed: NewsFeed): Promise<NewsItem[]> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(feed.url));
      if (!res.ok) continue;
      const text = proxy.includes("allorigins")
        ? ((await res.json()) as { contents: string }).contents
        : await res.text();
      const xml = new DOMParser().parseFromString(text, "text/xml");
      const items: NewsItem[] = [];
      xml.querySelectorAll("item").forEach((el) => {
        const title = el.querySelector("title")?.textContent?.trim();
        if (!title) return;
        const link = el.querySelector("link")?.textContent ?? "";
        items.push({
          title,
          link,
          pubDate: el.querySelector("pubDate")?.textContent ?? "",
          source: feed.src,
          category: detectCategory(title) ?? undefined,
        });
      });
      if (items.length) return items;
    } catch {
      continue;
    }
  }
  return [];
}

// ── Get active feeds (excluded feeds filtered by config) ──
function getActiveFeeds(): NewsFeed[] {
  const cfg = loadConfig();
  const disabled = new Set(cfg.disabledFeeds ?? []);
  return NEWS_FEEDS.filter((f) => !disabled.has(f.src));
}

// ── Fetch all feeds concurrently ──
async function fetchAllNews(): Promise<NewsItem[]> {
  const feeds = getActiveFeeds();
  const results = await runConcurrent(feeds.map((f) => () => fetchFeed(f)));

  const allItems: NewsItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }

  // Deduplicate by first 40 chars of title
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    const key = item.title.trim().substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return unique.slice(0, 50);
}

// ── Render news items to scroll container ──
function renderNews(items: NewsItem[]): void {
  if (!elRssScroll) return;

  // Build two copies for seamless scroll loop
  const frag = document.createDocumentFragment();
  for (const isClone of [false, true]) {
    for (const item of items) {
      const div = document.createElement("div");
      div.className = "rss-item" + (isClone ? " clone" : "");
      if (isClone) div.setAttribute("aria-hidden", "true");
      if (item.category) div.dataset["category"] = item.category;

      const sourceEl = document.createElement("span");
      sourceEl.className = "rss-source";
      sourceEl.textContent = item.source;

      const titleEl = document.createElement("a");
      titleEl.className = "rss-title";
      titleEl.textContent = item.title;
      if (item.link) {
        titleEl.href = item.link;
        titleEl.target = "_blank";
        titleEl.rel = "noopener noreferrer";
      }

      div.appendChild(sourceEl);
      div.appendChild(titleEl);
      frag.appendChild(div);
    }
  }

  elRssScroll.innerHTML = "";
  elRssScroll.appendChild(frag);

  // Start scroll animation
  requestAnimationFrame(() => {
    if (!elRssScroll) return;
    const halfH = elRssScroll.scrollHeight / 2;
    const dur = Math.max(60, items.length * 3);
    const style =
      document.getElementById("news-scroll-style") ??
      (() => {
        const s = document.createElement("style");
        s.id = "news-scroll-style";
        document.head.appendChild(s);
        return s;
      })();
    style.textContent = `@keyframes newsScroll { from{transform:translateY(0) translateZ(0)} to{transform:translateY(-${halfH}px) translateZ(0)} }`;
    elRssScroll.style.animation = `newsScroll ${dur}s linear infinite`;
  });

  // Update ticker bar if present
  if (elNewsTicker && items.length) {
    const tickerItems = items.slice(0, 10);
    elNewsTicker.textContent = tickerItems.map((i) => i.title).join("  •  ");
  }

  diagLog(`[news] Rendered ${items.length} items`);
}

const loadNews = createCardLoader<NewsItem[]>(
  { id: "news", ttl: INTERVALS.NEWS, interval: INTERVALS.NEWS },
  fetchAllNews,
  renderNews,
);

export function initNewsCard(): void {
  cacheDom();
  void loadNews();
  scheduleCard(loadNews, INTERVALS.NEWS);
  diagLog("[news] Initialized");
}
