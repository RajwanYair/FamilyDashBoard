/**
 * FamilyDashBoard v7 — News Card
 *
 * Aggregates multiple Hebrew RSS feeds, deduplicates, sorts by date,
 * and renders a scrolling news strip with category detection.
 */

import { createAsyncCardLoader, scheduleCard } from "../base-card";
import "./news.css";
import {
  INTERVALS,
  PROXIES,
  LS_NEWS_VISITED,
  LS_NEWS_BOOKMARKS,
  LS_NEWS_FONT,
  MS_PER_HOUR,
} from "../../core/constants";
import { runConcurrent } from "../../core/fetch";
import { loadConfig } from "../../core/config";
import { diagLog } from "../../core/diag";
import type { NewsItem } from "../../types/api";
import type { CardConfigField, CardDefinition } from "../../types/card";

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
let elBkmPill: HTMLElement | null = null;
let elSearchInput: HTMLInputElement | null = null;
let elSearchClear: HTMLElement | null = null;
let elSearchCount: HTMLElement | null = null;
let elNewsCount: HTMLElement | null = null;
let _newsRefreshInterval: number | null = null;

// ── Search ──
let _searchQuery = "";

export function filterBySearch(items: NewsItem[], query: string): NewsItem[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(
    (i) => i.title.toLowerCase().includes(q) || i.source.toLowerCase().includes(q),
  );
}

export function getSearchQuery(): string {
  return _searchQuery;
}

/**
 * Populate an anchor element with highlighted text.
 * Matches of `query` are wrapped in <mark class="rss-highlight">.
 * Uses DOM text nodes — no innerHTML with user data.
 */
export function highlightTitle(el: HTMLAnchorElement, title: string, query: string): void {
  if (!query) {
    el.textContent = title;
    return;
  }
  el.textContent = "";
  const q = query.toLowerCase();
  const lower = title.toLowerCase();
  let last = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > last) {
      el.appendChild(document.createTextNode(title.slice(last, idx)));
    }
    const mark = document.createElement("mark");
    mark.className = "rss-highlight";
    mark.textContent = title.slice(idx, idx + q.length);
    el.appendChild(mark);
    last = idx + q.length;
    idx = lower.indexOf(q, last);
  }
  if (last < title.length) {
    el.appendChild(document.createTextNode(title.slice(last)));
  }
}

// ── News article age (F67) ──
/**
 * Returns a Hebrew relative-time string for a news pubDate stamp.
 * Returns "" for missing/invalid dates.
 */
export function relativeAge(pubDate: string): string {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const h = Math.floor((Date.now() - d.getTime()) / MS_PER_HOUR);
  if (h < 0) return "";
  if (h < 1) return "עכשיו";
  if (h < 24) return `לפני ${h}ש׳`;
  const days = Math.floor(h / 24);
  if (days === 1) return "אתמול";
  return `לפני ${days} ימ׳`;
}

// ── Visited articles (session-scoped) ──
// LS_NEWS_VISITED imported from constants
let _visited: Set<string> = new Set();

/**
 * Estimate reading time in minutes from a description/body string.
 * Assumes average reading speed of 200 words per minute.
 * Returns 0 when text is empty.
 */
export function readingTimeMinutes(text: string): number {
  if (!text) return 0;
  const words = text.trim().split(/\s+/u).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Returns true when the item is likely "breaking news":
 * published within the past 30 minutes or title contains a breaking keyword.
 */
export function isBreaking(title: string, pubDate: string): boolean {
  const BREAKING_KEYWORDS = ["בזק", "דחוף", "breaking", "urgent", "flash"];
  const lc = title.toLowerCase();
  if (BREAKING_KEYWORDS.some((kw) => lc.includes(kw))) return true;
  if (!pubDate) return false;
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return false;
  const ageMs = Date.now() - d.getTime();
  return ageMs >= 0 && ageMs < 30 * 60 * 1000;
}

/**
 * Extract the bare domain (without "www.") from a URL.
 * Returns the full URL on failure.
 */
export function newsSourceDomain(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return url;
  }
}

/**
 * Strip HTML entities from a news title and truncate to `maxLen` chars.
 * Uses only safe text operations — no innerHTML / DOMParser.
 */
export function sanitizeNewsTitle(title: string, maxLen = 120): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  let out = title;
  for (const [ent, ch] of Object.entries(entities)) {
    out = out.split(ent).join(ch);
  }
  // Strip any remaining numeric entities (&#NN;)
  out = out.replace(/&#\d+;/gu, "").trim();
  if (out.length > maxLen) return `${out.slice(0, maxLen - 1)}…`;
  return out;
}

function loadVisited(): void {
  try {
    const s = sessionStorage.getItem(LS_NEWS_VISITED) ?? "[]";
    _visited = new Set(JSON.parse(s) as string[]);
  } catch {
    _visited = new Set();
  }
}

export function markVisited(key: string): void {
  _visited.add(key);
  try {
    sessionStorage.setItem(LS_NEWS_VISITED, JSON.stringify([..._visited]));
  } catch {
    /* quota */
  }
}

export function isVisited(key: string): boolean {
  return _visited.has(key);
}

// ── Bookmarks ──
// LS_NEWS_BOOKMARKS imported from constants
let _bkmMode = false;
let _lastItems: NewsItem[] = [];
let _bookmarks: Set<string> = new Set();

function loadBookmarks(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_NEWS_BOOKMARKS) ?? "[]") as string[];
    _bookmarks = new Set(stored);
  } catch {
    _bookmarks = new Set();
  }
  updateBkmCount();
}

function saveBookmarks(): void {
  try {
    localStorage.setItem(LS_NEWS_BOOKMARKS, JSON.stringify([..._bookmarks]));
  } catch {
    /* quota */
  }
  updateBkmCount();
}

function updateBkmCount(): void {
  const el = document.getElementById("news-bkm-count");
  if (!el) return;
  const n = _bookmarks.size;
  if (n > 0) {
    el.textContent = `🔖 ${n}`;
    el.style.display = "";
  } else {
    el.style.display = "none";
  }
}

export function getBookmarkKey(title: string): string {
  return title.trim().substring(0, 60);
}

export function toggleBookmark(key: string): void {
  if (_bookmarks.has(key)) {
    _bookmarks.delete(key);
  } else {
    _bookmarks.add(key);
  }
  saveBookmarks();
  renderNews(_lastItems);
}

export function toggleBookmarkMode(): void {
  // Lazy DOM lookup in case cacheDom() hasn't run yet
  if (!elBkmPill) elBkmPill = document.getElementById("news-bkm-pill");
  _bkmMode = !_bkmMode;
  if (elBkmPill) elBkmPill.hidden = !_bkmMode;
  renderNews(_lastItems);
}

export function getBookmarks(): Set<string> {
  return _bookmarks;
}

export function isBookmarkMode(): boolean {
  return _bkmMode;
}

export function cacheDom(): void {
  elRssScroll = document.getElementById("rss-scroll");
  elNewsTicker = document.getElementById("news-ticker");
  elBkmPill = document.getElementById("news-bkm-pill");
  elSearchInput = document.getElementById("news-search") as HTMLInputElement | null;
  elSearchClear = document.getElementById("news-search-clear");
  elSearchCount = document.getElementById("news-search-count");
  elNewsCount = document.getElementById("news-count");
  if (elBkmPill) elBkmPill.hidden = true;
  loadBookmarks();
  loadVisited();
}

// ── F9 (v7.2): Source filter chips with favicons ──────────────────────────

/** Render per-source toggle chips into #news-filter-bar. */
export function renderSourceFilterChips(): void {
  const bar = document.getElementById("news-filter-bar");
  if (!bar) return;
  bar.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const feed of NEWS_FEEDS) {
    const domain = (() => {
      try {
        return new URL(feed.url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "news-src-chip";
    chip.title = feed.src;
    chip.dataset["src"] = feed.src;
    if (domain) {
      const img = document.createElement("img");
      img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
      img.alt = "";
      img.width = 14;
      img.height = 14;
      img.style.cssText = "margin-inline-end:3px;vertical-align:middle;border-radius:2px";
      chip.appendChild(img);
    }
    chip.appendChild(document.createTextNode(feed.src));
    frag.appendChild(chip);
  }
  bar.appendChild(frag);
}

// ── Category detection ──
export function detectCategory(title: string): string | null {
  const t = (title || "").toLowerCase();
  if (/ביטחון|צבא|לחימה|טיל|רקטה|מלחמה|חמאס|טרור|נשק|כיבוש|ירי/.test(t)) return "security";
  if (/פוליטיקה|ממשלה|כנסת|קואליציה|אופוזיציה|בחירות|מפלגה|שר|ראש.*ממשלה|נשיא/.test(t))
    return "politics";
  if (/כלכלה|שוק.*מניה|שקל|בנק|ריבית|תקציב|גז|נפט|ייצוא|ייבוא|שביתה|אינפלציה/.test(t))
    return "economy";
  if (/ספורט|כדורגל|כדורסל|טניס|אצלתנות|אולימפיאד|ליגה|אלופות|מונדיאל|גביע/.test(t)) return "sport";
  if (/טכנולוגיה|סטארטאפ|בינה מלאכותית|ai\b|cyber|קיברנטי|אפליקציה|רובוט/.test(t)) return "tech";
  return null;
}

// ── Fetch a single RSS feed ──
export async function fetchFeed(feed: NewsFeed): Promise<NewsItem[]> {
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
          description:
            (el.querySelector("description")?.textContent ?? "")
              .replace(/<[^>]+>/g, "")
              .trim()
              .slice(0, 200) || undefined,
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
export function renderNews(items: NewsItem[]): void {
  if (!elRssScroll) return;

  _lastItems = items;
  const cfg = loadConfig();

  // In bookmark mode show only bookmarked items as a static list (no clone loop).
  const baseItems = _bkmMode ? items.filter((i) => _bookmarks.has(getBookmarkKey(i.title))) : items;

  // Apply search filter
  const displayItems = _searchQuery ? filterBySearch(baseItems, _searchQuery) : baseItems;

  // Update search count and clear button visibility
  if (elSearchCount) {
    elSearchCount.textContent = _searchQuery ? `${displayItems.length}/${items.length}` : "";
  }
  if (elSearchClear) {
    elSearchClear.style.display = _searchQuery ? "" : "none";
  }

  // Update news count badge
  if (elNewsCount) {
    elNewsCount.textContent = items.length > 0 ? String(items.length) : "";
  }

  // Build one copy (+ clone) for seamless scroll; bookmark mode uses one copy only.
  const frag = document.createDocumentFragment();
  const passes = _bkmMode ? [false] : [false, true];
  for (const isClone of passes) {
    for (const item of displayItems) {
      const div = document.createElement("div");
      const key0 = getBookmarkKey(item.title);
      const visitedCls = !isClone && _visited.has(key0) ? " visited" : "";
      div.className = "rss-item" + (isClone ? " clone" : "") + visitedCls;
      if (isClone) div.setAttribute("aria-hidden", "true");
      if (item.category) div.dataset["category"] = item.category;

      // Stale age tinting (F136) — primary items only
      if (!isClone && item.pubDate) {
        const ageH = Math.floor((Date.now() - new Date(item.pubDate).getTime()) / MS_PER_HOUR);
        if (ageH >= 24) div.classList.add("stale-old");
        else if (ageH >= 12) div.classList.add("stale-day");
        else if (ageH >= 6) div.classList.add("stale-half");
      }

      const sourceEl = document.createElement("span");
      sourceEl.className = "rss-source";
      sourceEl.textContent = item.source;
      // Sprint 48: gate source display on cfg.newsShowSource
      if (!cfg.newsShowSource) sourceEl.hidden = true;

      // Sprint 48: breaking news badge
      if (!isClone && isBreaking(item.title, item.pubDate)) {
        const breakingBadge = document.createElement("span");
        breakingBadge.className = "news-breaking-badge";
        breakingBadge.textContent = "🔴 מבזק";
        div.appendChild(breakingBadge);
      }

      const titleEl = document.createElement("a");
      titleEl.className = "rss-title";
      if (_searchQuery && !isClone) {
        highlightTitle(titleEl, item.title, _searchQuery);
      } else {
        titleEl.textContent = item.title;
      }
      if (item.link) {
        titleEl.href = item.link;
        titleEl.target = "_blank";
        titleEl.rel = "noopener noreferrer";
      }
      // Mark as visited when opening
      if (!isClone) {
        titleEl.addEventListener("click", () => {
          markVisited(getBookmarkKey(item.title));
          div.classList.add("visited");
        });
      }

      // Bookmark toggle button (primary items only)
      if (!isClone) {
        const key = getBookmarkKey(item.title);
        const bkmBtn = document.createElement("button");
        bkmBtn.type = "button";
        bkmBtn.className = "news-bkm-btn" + (_bookmarks.has(key) ? " active" : "");
        bkmBtn.textContent = "🔖";
        bkmBtn.title = _bookmarks.has(key) ? "הסר מהמועדפים" : "הוסף למועדפים";
        bkmBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleBookmark(key);
        });
        div.appendChild(bkmBtn);
      }

      div.appendChild(sourceEl);
      div.appendChild(titleEl);

      // Age badge (F67) — primary items only
      if (!isClone) {
        const age = relativeAge(item.pubDate);
        if (age) {
          const ageEl = document.createElement("span");
          ageEl.className = "news-age";
          ageEl.textContent = age;
          div.appendChild(ageEl);
        }
      }

      // Reading-time badge (Sprint 27) — primary items with description
      if (!isClone && item.description && item.description.length > 10) {
        const mins = readingTimeMinutes(item.description);
        const rtEl = document.createElement("span");
        rtEl.className = "news-reading-time";
        rtEl.textContent = `~${mins} דק׳`;
        rtEl.title = `זמן קריאה משוער: ${mins} דקות`;
        div.appendChild(rtEl);
      }

      // Inline description expand (F145) — primary items with description only
      if (!isClone && item.description && item.description.length > 10) {
        const descEl = document.createElement("div");
        descEl.className = "news-desc";
        descEl.textContent = item.description.slice(0, 220);
        div.appendChild(descEl);
        titleEl.addEventListener("click", (e) => {
          e.stopPropagation();
          div.classList.toggle("expanded");
        });
      }

      // Copy-to-clipboard button (F57) — primary items only
      if (!isClone && navigator.clipboard) {
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "news-copy";
        copyBtn.textContent = "📋";
        copyBtn.title = "העתק כותרת וקישור";
        copyBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const text = item.link ? `${item.title}\n${item.link}` : item.title;
          navigator.clipboard
            .writeText(text)
            .then(() => {
              copyBtn.textContent = "✓";
              copyBtn.classList.add("copied");
              setTimeout(() => {
                copyBtn.textContent = "📋";
                copyBtn.classList.remove("copied");
              }, 1500);
            })
            .catch(() => {
              /* clipboard unavailable */
            });
        });
        div.appendChild(copyBtn);
      }

      // Web Share button (F62) — primary items with navigator.share + link only
      if (!isClone && navigator.share && item.link) {
        const shareBtn = document.createElement("button");
        shareBtn.type = "button";
        shareBtn.className = "news-share";
        shareBtn.textContent = "📤";
        shareBtn.title = "שתף";
        shareBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          navigator.share({ title: item.title, url: item.link }).catch(() => {
            /* cancelled or unsupported */
          });
        });
        div.appendChild(shareBtn);
      }

      frag.appendChild(div);
    }
  }

  elRssScroll.innerHTML = "";
  elRssScroll.scrollTop = 0;
  elRssScroll.appendChild(frag);

  // Start scroll animation (pause in bookmark mode)
  requestAnimationFrame(() => {
    if (!elRssScroll) return;
    if (_bkmMode) {
      elRssScroll.style.animation = "none";
      return;
    }
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

  diagLog(`FDB-042: [news] Rendered ${items.length} items`);
}

export const loadNews = createAsyncCardLoader<NewsItem[]>(
  { id: "news", ttl: INTERVALS.NEWS, interval: INTERVALS.NEWS },
  fetchAllNews,
  renderNews,
);

function bindOnce(
  element: HTMLElement | null,
  eventName: string,
  marker: string,
  handler: EventListener,
): void {
  if (!element || element.dataset[marker] === "1") return;
  element.addEventListener(eventName, handler);
  element.dataset[marker] = "1";
}

// ── News font size ──
// LS_NEWS_FONT imported from constants

/**
 * Apply the user-configured news font size from localStorage.
 * Value is a percentage (50–200); default is 100 (no change).
 */
export function applyNewsFontSize(): void {
  const raw = localStorage.getItem(LS_NEWS_FONT);
  if (!raw) return;
  const pct = parseInt(raw, 10);
  if (isNaN(pct) || pct < 50 || pct > 200) return;
  if (elRssScroll) elRssScroll.style.fontSize = `${pct}%`;
}

// ── News search ──
function initNewsSearch(): void {
  if (!elSearchInput) return;
  bindOnce(elSearchInput, "input", "fdbNewsInputBound", (() => {
    _searchQuery = elSearchInput!.value;
    renderNews(_lastItems);
  }) as EventListener);
  if (elSearchClear) {
    bindOnce(elSearchClear, "click", "fdbNewsClickBound", (() => {
      _searchQuery = "";
      if (elSearchInput) elSearchInput.value = "";
      renderNews(_lastItems);
    }) as EventListener);
  }
}

export function initNewsCard(): void {
  cacheDom();
  applyNewsFontSize();
  initNewsSearch();
  renderSourceFilterChips();
  void loadNews();
  if (_newsRefreshInterval !== null) clearInterval(_newsRefreshInterval);
  _newsRefreshInterval = scheduleCard(loadNews, INTERVALS.NEWS);
  diagLog("FDB-043: [news] Initialized");
}

export function destroyNewsCard(): void {
  if (_newsRefreshInterval !== null) {
    clearInterval(_newsRefreshInterval);
    _newsRefreshInterval = null;
  }
}

// ── Sprint 135: configSchema ────────────────────────────────────────────────

export const newsConfigSchema: CardConfigField[] = [
  {
    key: "newsMaxItems",
    labelHe: "כמות כתבות מקסימלית",
    labelEn: "Max news items",
    type: "range",
    defaultValue: 5,
    min: 1,
    max: 10,
    step: 1,
    group: "תצוגה",
    groupOpenByDefault: true,
  },
  {
    key: "newsShowSource",
    labelHe: "הצג מקור כתבה",
    labelEn: "Show article source",
    type: "boolean",
    defaultValue: true,
    group: "תצוגה",
  },
];

export const newsCard: CardDefinition = {
  id: "news",
  icon: "📰",
  titleHe: "חדשות",
  titleEn: "News",
  defaultSlot: { col: 0, order: 0, flexGrow: 65, hidden: false },
  defaultSize: "md",
  render(): HTMLElement {
    const section = document.createElement("section");
    section.className = "card";
    section.dataset.cardId = "news";
    section.setAttribute("aria-label", "News");
    return section;
  },
  init: initNewsCard,
  destroy: destroyNewsCard,
  configSchema: newsConfigSchema,
};

// ── Test isolation (Stream G.1) ───────────────────────────────────────────────

/**
 * Reset all module-level mutable state to defaults.
 * Use in `beforeEach` instead of `vi.resetModules()` to avoid costly
 * module re-evaluation.
 *
 * @internal — test use only
 */
export function _resetNewsForTest(): void {
  if (_newsRefreshInterval !== null) {
    clearInterval(_newsRefreshInterval);
    _newsRefreshInterval = null;
  }
  _searchQuery = "";
  _visited = new Set();
  _bkmMode = false;
  _lastItems = [];
  _bookmarks = new Set();
  elRssScroll = null;
  elNewsTicker = null;
  elBkmPill = null;
  elSearchInput = null;
  elSearchClear = null;
  elSearchCount = null;
  elNewsCount = null;
}
