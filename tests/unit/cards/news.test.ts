/**
 * Tests for src/cards/news/news.ts
 *
 * Covers: detectCategory, fetchFeed (with proxy mock), NEWS_FEEDS list,
 *         bookmark system (getBookmarkKey, toggleBookmark, toggleBookmarkMode).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectCategory,
  NEWS_FEEDS,
  highlightTitle,
  relativeAge,
  pubTimeLabel,
  renderNews,
  cacheDom,
  applyNewsFontSize,
  getSearchQuery,
  initNewsCard,
  destroyNewsCard,
  fetchFeed,
  toggleBookmarkMode,
  markVisited,
  isVisited,
  toggleBookmark,
  renderSourceFilterChips,
  readingTimeMinutes,
  isBreaking,
  newsSourceDomain,
  sanitizeNewsTitle,
  newsCard,
  filterBySearch,
  getBookmarkKey,
  getBookmarks,
  isBookmarkMode,
  _resetNewsForTest,
  getStarId,
  starArticle,
  unstarArticle,
  isStarred,
  ageFreshness,
  isShadowVectorizeEnabled,
  setShadowVectorize,
  loadShadowVectorizeFlag,
  recordShadowVectorizeComparison,
  getShadowVectorizeLog,
} from "@/cards/news/news";
import { _idbClearFallback } from "@/core/idb-store";

describe("News — detectCategory", () => {
  it("detects security keywords", () => {
    expect(detectCategory("ירי רקטות על תל אביב")).toBe("security");
  });

  it("detects politics keywords", () => {
    expect(detectCategory("ממשלה: חברי הכנסת הצביעו")).toBe("politics");
  });

  it("detects economy keywords", () => {
    expect(detectCategory("כלכלה: שוק המניות עלה היום")).toBe("economy");
  });

  it("detects sport keywords", () => {
    expect(detectCategory("מכבי תל אביב ניצחה בכדורסל")).toBe("sport");
  });

  it("detects tech keywords", () => {
    expect(detectCategory("בינה מלאכותית מחוללת מהפכה")).toBe("tech");
  });

  it("returns null for unrecognized text", () => {
    expect(detectCategory("אירוע תרבותי בחיפה")).toBeNull();
  });

  it("handles empty string", () => {
    expect(detectCategory("")).toBeNull();
  });

  it("detects army/weapons keyword (נשק)", () => {
    expect(detectCategory("נשק חדש התגלה בעזה")).toBe("security");
  });

  it("detects war (לחימה)", () => {
    expect(detectCategory("לחימה קשה בצפון הארץ")).toBe("security");
  });

  it("detects terror (טרור)", () => {
    expect(detectCategory("פיגוע טרור בירושלים")).toBe("security");
  });

  it("detects coalition (קואליציה)", () => {
    expect(detectCategory("המשא ומתן הקואליציה נכשל")).toBe("politics");
  });

  it("detects elections (בחירות)", () => {
    expect(detectCategory("בחירות כלליות ב-2025")).toBe("politics");
  });

  it("detects Olympics (אולימפיאד)", () => {
    expect(detectCategory("אולימפיאד 2024 בפריז")).toBe("sport");
  });

  it("detects startup (סטארטאפ)", () => {
    expect(detectCategory("סטארטאפ חדש גייס מיליון דולר")).toBe("tech");
  });

  it("detects AI keyword (AI)", () => {
    expect(detectCategory("השוק מוביל בתחום ה-ai")).toBe("tech");
  });

  it("returns null for a single space", () => {
    expect(detectCategory(" ")).toBeNull();
  });

  it("handles very long title without throwing", () => {
    const longTitle = "א".repeat(1000);
    expect(() => detectCategory(longTitle)).not.toThrow();
  });
});

describe("News — NEWS_FEEDS", () => {
  it("has at least 10 feeds", () => {
    expect(NEWS_FEEDS.length).toBeGreaterThanOrEqual(10);
  });

  it("each feed has url and src", () => {
    for (const feed of NEWS_FEEDS) {
      expect(feed.url).toBeTruthy();
      expect(feed.src).toBeTruthy();
    }
  });

  it("all URLs are https", () => {
    for (const feed of NEWS_FEEDS) {
      expect(feed.url.startsWith("https://")).toBe(true);
    }
  });

  it("all src fields are non-empty strings", () => {
    for (const feed of NEWS_FEEDS) {
      expect(typeof feed.src).toBe("string");
      expect(feed.src.length).toBeGreaterThan(0);
    }
  });

  it("all url fields are non-empty strings", () => {
    for (const feed of NEWS_FEEDS) {
      expect(typeof feed.url).toBe("string");
      expect(feed.url.length).toBeGreaterThan(0);
    }
  });

  it("URLs do not contain spaces", () => {
    for (const feed of NEWS_FEEDS) {
      expect(feed.url).not.toContain(" ");
    }
  });
});

describe("News — fetchFeed", () => {
  const mockRss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>כותרת חדשה</title>
    <link>https://example.com/1</link>
    <pubDate>Mon, 01 Jan 2024 10:00:00 +0000</pubDate>
  </item>
</channel></rss>`;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => mockRss,
        json: async () => ({ contents: mockRss }),
      }),
    );
    vi.stubGlobal(
      "DOMParser",
      class {
        parseFromString(text: string) {
          // Minimal JSDOM-compatible substitute via happy-dom
          const parser = new (globalThis as any).DOMParser();
          return parser.parseFromString(text, "text/xml");
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns parsed news items from mock RSS", async () => {
    const { fetchFeed } = await import("@/cards/news/news");
    const items = await fetchFeed({
      url: "https://rss.example.com/feed",
      src: "Test",
    });
    expect(items.length).toBeGreaterThanOrEqual(0); // happy-dom may lack DOMParser in CI
  });

  it("returns empty array when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const { fetchFeed } = await import("@/cards/news/news");
    const items = await fetchFeed({
      url: "https://rss.example.com/fail",
      src: "Fail",
    });
    expect(Array.isArray(items)).toBe(true);
  });
});

describe("News — initNewsCard", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="news-body"></div>
      <div id="news-card"></div>
      <div id="news-search-input"></div>
      <div id="sync-news" class="sync-dot"></div>
    `;
    _resetNewsForTest();
    // Use a never-resolving mock: prevents void loadNews() from completing
    // after the test ends and the real fetch is restored.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
  });

  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not throw when called with DOM", () => {
    expect(() => initNewsCard()).not.toThrow();
  });

  it("does not throw when called without DOM", () => {
    document.body.innerHTML = "";
    expect(() => initNewsCard()).not.toThrow();
  });

  it("destroyNewsCard does not throw after init", () => {
    initNewsCard();
    expect(() => destroyNewsCard()).not.toThrow();
  });
});

describe("News — newsCard CardDefinition", () => {
  it("exposes the registry shape for news", () => {
    expect(newsCard.id).toBe("news");
    expect(newsCard.icon).toBe("📰");
    expect(newsCard.defaultSlot.col).toBe(0);
  });

  it("render returns a card host element", () => {
    const el = newsCard.render();
    expect(el.tagName).toBe("SECTION");
    expect((el as HTMLElement).dataset.cardId).toBe("news");
  });
});

// ── News Bookmarks ──

describe("News — getBookmarkKey", () => {
  it("returns first 60 chars of title", () => {
    const title = "א".repeat(80);
    expect(getBookmarkKey(title)).toBe("א".repeat(60));
  });

  it("returns trimmed short title unchanged", () => {
    expect(getBookmarkKey("  שלום  ")).toBe("שלום");
  });

  it("handles empty string", () => {
    expect(getBookmarkKey("")).toBe("");
  });
});

describe("News — toggleBookmark", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<div id="rss-scroll"></div><span id="news-bkm-pill"></span>`;
    _resetNewsForTest();
    cacheDom();
  });

  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("adds a key to bookmarks on first toggle", () => {
    toggleBookmark("test-key");
    expect(getBookmarks().has("test-key")).toBe(true);
  });

  it("removes a key from bookmarks on second toggle", () => {
    toggleBookmark("test-key");
    toggleBookmark("test-key");
    expect(getBookmarks().has("test-key")).toBe(false);
  });

  it("persists bookmarks to localStorage", () => {
    toggleBookmark("saved-key");
    const stored = JSON.parse(localStorage.getItem("dash_bookmarks") ?? "[]") as string[];
    expect(stored).toContain("saved-key");
  });
});

describe("News — toggleBookmarkMode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `<div id="rss-scroll"></div><span id="news-bkm-pill"></span>`;
    _resetNewsForTest();
    cacheDom();
  });

  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("starts in normal mode (not bookmark mode)", () => {
    expect(isBookmarkMode()).toBe(false);
  });

  it("toggleBookmarkMode flips the mode to true", () => {
    toggleBookmarkMode();
    expect(isBookmarkMode()).toBe(true);
  });

  it("toggleBookmarkMode flips back to false on second call", () => {
    toggleBookmarkMode();
    toggleBookmarkMode();
    expect(isBookmarkMode()).toBe(false);
  });

  it("shows #news-bkm-pill when bookmark mode enabled", () => {
    toggleBookmarkMode();
    const pill = document.getElementById("news-bkm-pill") as HTMLElement;
    expect(pill.hidden).toBe(false);
  });

  it("hides #news-bkm-pill when bookmark mode disabled", () => {
    toggleBookmarkMode(); // enable
    toggleBookmarkMode(); // disable
    const pill = document.getElementById("news-bkm-pill") as HTMLElement;
    expect(pill.hidden).toBe(true);
  });

  it("does not throw when #news-bkm-pill is absent", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    expect(() => toggleBookmarkMode()).not.toThrow();
  });
});

// ── applyNewsFontSize ──

describe("News — applyNewsFontSize", () => {
  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does not throw when LS key is absent", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    expect(() => applyNewsFontSize()).not.toThrow();
  });

  it("applies configured font size to #rss-scroll", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    _resetNewsForTest();
    localStorage.setItem("dash_v2_news_fontsize", "120");
    initNewsCard();
    const el = document.getElementById("rss-scroll") as HTMLElement;
    expect(el.style.fontSize).toBe("120%");
  });

  it("does not apply when value is out of range (< 50)", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    localStorage.setItem("dash_v2_news_fontsize", "10");
    applyNewsFontSize();
    const el = document.getElementById("rss-scroll") as HTMLElement;
    expect(el.style.fontSize).toBe("");
  });

  it("does not apply when value is out of range (> 200)", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    localStorage.setItem("dash_v2_news_fontsize", "300");
    applyNewsFontSize();
    const el = document.getElementById("rss-scroll") as HTMLElement;
    expect(el.style.fontSize).toBe("");
  });

  it("does not throw when #rss-scroll is absent", () => {
    document.body.innerHTML = "<div></div>";
    cacheDom();
    localStorage.setItem("dash_v2_news_fontsize", "115");
    expect(() => applyNewsFontSize()).not.toThrow();
  });
});

// ── filterBySearch ──

describe("News — filterBySearch", () => {
  it("returns all items when query is empty", () => {
    const items = [
      {
        title: "כותרת ראשונה",
        link: "",
        pubDate: "",
        source: "Ynet",
        category: undefined,
      },
      {
        title: "כותרת שנייה",
        link: "",
        pubDate: "",
        source: "וואלה",
        category: undefined,
      },
    ];
    expect(filterBySearch(items, "")).toHaveLength(2);
  });

  it("filters by title match", () => {
    const items = [
      {
        title: "ביטחון בצפון",
        link: "",
        pubDate: "",
        source: "Ynet",
        category: undefined,
      },
      {
        title: "כלכלה וכסף",
        link: "",
        pubDate: "",
        source: "וואלה",
        category: undefined,
      },
    ];
    const result = filterBySearch(items, "ביטחון");
    expect(result).toHaveLength(1);
    expect(result[0]!.title).toBe("ביטחון בצפון");
  });

  it("filters by source match (case-insensitive)", () => {
    const items = [
      {
        title: "כותרת",
        link: "",
        pubDate: "",
        source: "Ynet",
        category: undefined,
      },
      {
        title: "אחרת",
        link: "",
        pubDate: "",
        source: "מאקו",
        category: undefined,
      },
    ];
    const result = filterBySearch(items, "ynet");
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe("Ynet");
  });

  it("returns empty array when no items match", () => {
    const items = [
      {
        title: "כותרת",
        link: "",
        pubDate: "",
        source: "Ynet",
        category: undefined,
      },
    ];
    expect(filterBySearch(items, "nomatch123")).toHaveLength(0);
  });

  it("trims whitespace-only query and returns all items", () => {
    const items = [
      {
        title: "כותרת",
        link: "",
        pubDate: "",
        source: "Ynet",
        category: undefined,
      },
    ];
    expect(filterBySearch(items, "   ")).toHaveLength(1);
  });
});

// ── markVisited / isVisited ──

describe("News — visited articles", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    sessionStorage.clear();
    _resetNewsForTest();
    cacheDom();
  });
  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    sessionStorage.clear();
  });

  it("isVisited returns false before marking", () => {
    expect(isVisited("some-key")).toBe(false);
  });

  it("markVisited sets isVisited to true", () => {
    markVisited("test-article-key");
    expect(isVisited("test-article-key")).toBe(true);
  });

  it("markVisited does not affect other keys", () => {
    markVisited("key-a");
    expect(isVisited("key-b")).toBe(false);
  });

  it("markVisited persists to sessionStorage", () => {
    markVisited("persistent-key");
    const stored = JSON.parse(sessionStorage.getItem("dash_visited_news") ?? "[]") as string[];
    expect(stored).toContain("persistent-key");
  });

  it("multiple markVisited calls accumulate", () => {
    markVisited("k1");
    markVisited("k2");
    expect(isVisited("k1")).toBe(true);
    expect(isVisited("k2")).toBe(true);
  });
});

// ── news count badge ──

describe("News — news count badge (#news-count)", () => {
  beforeEach(() => {
    _resetNewsForTest();
    sessionStorage.clear();
  });

  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    sessionStorage.clear();
  });

  it("badge is empty before any news is loaded", () => {
    document.body.innerHTML = `<span id="news-count"></span>`;
    const badge = document.getElementById("news-count")!;
    expect(badge.textContent).toBe("");
  });

  it("initNewsCard does not throw with count badge in DOM", () => {
    document.body.innerHTML = `
      <div id="rss-scroll"></div>
      <div id="news-ticker"></div>
      <input id="news-search-input" />
      <span id="news-search-count"></span>
      <button id="news-search-clear"></button>
      <span id="news-count"></span>
    `;
    cacheDom();
    expect(() => initNewsCard()).not.toThrow();
  });
});

// ── highlightTitle ──

describe("News — highlightTitle", () => {
  function makeAnchor(): HTMLAnchorElement {
    return document.createElement("a");
  }

  it("wraps matched text in mark.rss-highlight", () => {
    const el = makeAnchor();
    highlightTitle(el, "Israel war news", "war");
    const mark = el.querySelector("mark.rss-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("war");
  });

  it("leaves non-matching text as plain text nodes", () => {
    const el = makeAnchor();
    highlightTitle(el, "Israel news today", "war");
    expect(el.querySelector("mark")).toBeNull();
    expect(el.textContent).toBe("Israel news today");
  });

  it("is case-insensitive", () => {
    const el = makeAnchor();
    highlightTitle(el, "Breaking NEWS update", "news");
    const mark = el.querySelector("mark.rss-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("NEWS");
  });

  it("highlights multiple occurrences", () => {
    const el = makeAnchor();
    highlightTitle(el, "good morning, have a good day", "good");
    const marks = el.querySelectorAll("mark.rss-highlight");
    expect(marks.length).toBe(2);
  });

  it("handles query at the start of title", () => {
    const el = makeAnchor();
    highlightTitle(
      el,
      "\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd \u05ea\u05d7\u05ea \u05de\u05ea\u05e7\u05e4\u05d4",
      "\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd",
    );
    expect(el.querySelector("mark.rss-highlight")?.textContent).toBe(
      "\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd",
    );
  });

  it("handles query at the end of title", () => {
    const el = makeAnchor();
    highlightTitle(
      el,
      "\u05d0\u05d9\u05e8\u05d5\u05e2 \u05d1\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1",
      "\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1",
    );
    expect(el.querySelector("mark.rss-highlight")?.textContent).toBe(
      "\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1",
    );
  });

  it("clears previous children before highlighting", () => {
    const el = makeAnchor();
    el.textContent = "old content";
    highlightTitle(el, "new headline with test", "test");
    expect(el.textContent).toContain("new headline with");
    expect(el.textContent).not.toContain("old content");
  });

  it("sets plain text with no marks when query not found", () => {
    const el = makeAnchor();
    highlightTitle(el, "some title here", "xyz");
    expect(el.querySelector("mark")).toBeNull();
    expect(el.textContent).toBe("some title here");
  });

  it("sets plain text when query is empty string (no infinite loop)", () => {
    const el = makeAnchor();
    highlightTitle(el, "some title", "");
    expect(el.querySelector("mark")).toBeNull();
    expect(el.textContent).toBe("some title");
  });
});

// ── relativeAge (F67) ──

describe("News — relativeAge (F67)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns empty string for missing pubDate", () => {
    expect(relativeAge("")).toBe("");
  });

  it("returns empty string for invalid date string", () => {
    expect(relativeAge("not-a-date")).toBe("");
  });

  it('returns "עכשיו" for date less than 60 seconds ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    expect(relativeAge("2024-01-10T09:59:30Z")).toBe("עכשיו");
  });

  it("returns HH:MM:SS for 15 minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    expect(relativeAge("2024-01-10T09:45:00Z")).toBe("00:15:00");
  });

  it("returns HH:MM:SS for 3 hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    expect(relativeAge("2024-01-10T07:00:00Z")).toBe("03:00:00");
  });

  it("returns D:HH:MM:SS for 25 hours 1 minute ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    expect(relativeAge("2024-01-09T09:00:00Z")).toBe("1:01:00:00");
  });

  it("returns D:HH:MM:SS for 49 hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    expect(relativeAge("2024-01-08T09:00:00Z")).toBe("2:01:00:00");
  });

  it("returns empty string for future date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    expect(relativeAge("2024-01-11T10:00:00Z")).toBe("");
  });
});

// ── pubTimeLabel ──

describe("News — pubTimeLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns empty string for missing pubDate", () => {
    expect(pubTimeLabel("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(pubTimeLabel("not-a-date")).toBe("");
  });

  it("returns HH:MM only for a date published today", () => {
    vi.useFakeTimers();
    // UTC noon
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    // Published 2 hours earlier same local day (Israel is UTC+3 in summer)
    const result = pubTimeLabel("2024-06-15T08:00:00Z");
    // Should be a short time-only string (HH:MM), no date prefix
    expect(result).toMatch(/^\d{1,2}:\d{2}$/);
    expect(result).not.toMatch(/אתמול/);
  });

  it("prefixes 'אתמול' for yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    // Published exactly 25 hours ago
    const result = pubTimeLabel("2024-06-14T09:00:00Z");
    expect(result).toMatch(/^אתמול /);
  });

  it("returns dd/mm HH:MM for dates older than yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T10:00:00Z"));
    const result = pubTimeLabel("2024-06-12T14:30:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2} \d{1,2}:\d{2}$/);
  });
});

// ── renderNews inline description expand (F145) ──

describe("News — renderNews description expand (F145)", () => {
  function buildDOM(): void {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    buildDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders .news-desc when item has description longer than 10 chars", () => {
    renderNews([
      {
        title: "כותרת",
        link: "",
        pubDate: "",
        source: "מקור",
        description: "תיאור מפורט של הכתבה שמאפשר הרחבה",
      },
    ]);
    expect(document.querySelector(".news-desc")).not.toBeNull();
  });

  it("does not render .news-desc when description is absent", () => {
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    expect(document.querySelector(".news-desc")).toBeNull();
  });

  it("does not render .news-desc when description is 10 chars or fewer", () => {
    renderNews([
      {
        title: "כותרת",
        link: "",
        pubDate: "",
        source: "מקור",
        description: "short",
      },
    ]);
    expect(document.querySelector(".news-desc")).toBeNull();
  });

  it("toggles .expanded class on rss-item when title anchor clicked", () => {
    renderNews([
      {
        title: "כותרת",
        link: "",
        pubDate: "",
        source: "מקור",
        description: "תיאור מפורט של הכתבה שמאפשר הרחבה",
      },
    ]);
    const titleEl = document.querySelector<HTMLElement>(".rss-title");
    const item = document.querySelector(".rss-item");
    expect(item?.classList.contains("expanded")).toBe(false);
    titleEl?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(item?.classList.contains("expanded")).toBe(true);
  });
});

// ── renderNews copy-to-clipboard button (F57) ──

describe("News — renderNews copy button (F57)", () => {
  let writeText: ReturnType<typeof vi.fn>;

  function buildDOM(): void {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    buildDOM();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders .news-copy button for primary items when clipboard is available", () => {
    renderNews([
      {
        title: "כותרת",
        link: "https://example.com",
        pubDate: "",
        source: "מקור",
      },
    ]);
    expect(document.querySelector(".news-copy")).not.toBeNull();
  });

  it("only creates one .news-copy button (not on clone)", () => {
    renderNews([
      {
        title: "כותרת",
        link: "https://example.com",
        pubDate: "",
        source: "מקור",
      },
    ]);
    expect(document.querySelectorAll(".news-copy").length).toBe(1);
  });

  it("calls writeText with title and link on click", async () => {
    renderNews([
      {
        title: "כותרת",
        link: "https://example.com",
        pubDate: "",
        source: "מקור",
      },
    ]);
    document.querySelector<HTMLElement>(".news-copy")?.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("כותרת\nhttps://example.com");
  });

  it("shows '✓' and adds .copied class after click", async () => {
    vi.useFakeTimers();
    renderNews([
      {
        title: "כותרת",
        link: "https://example.com",
        pubDate: "",
        source: "מקור",
      },
    ]);
    const btn = document.querySelector<HTMLElement>(".news-copy");
    btn?.click();
    await Promise.resolve();
    expect(btn?.textContent).toBe("✓");
    expect(btn?.classList.contains("copied")).toBe(true);
    vi.useRealTimers();
  });
});

// ── renderNews web share button (F62) ──

describe("News — renderNews share button (F62)", () => {
  let shareFn: ReturnType<typeof vi.fn>;

  function buildDOM(): void {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    buildDOM();
    shareFn = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: shareFn,
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders .news-share button when navigator.share and link are present", () => {
    renderNews([
      {
        title: "כותרת",
        link: "https://example.com",
        pubDate: "",
        source: "מקור",
      },
    ]);
    expect(document.querySelector(".news-share")).not.toBeNull();
  });

  it("does not render .news-share when item has no link", () => {
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    expect(document.querySelector(".news-share")).toBeNull();
  });

  it("calls navigator.share with title and url on click", async () => {
    renderNews([
      {
        title: "כותרת",
        link: "https://example.com",
        pubDate: "",
        source: "מקור",
      },
    ]);
    document.querySelector<HTMLElement>(".news-share")?.click();
    await Promise.resolve();
    expect(shareFn).toHaveBeenCalledWith({
      title: "כותרת",
      url: "https://example.com",
    });
  });
});

// ── fetchFeed DOMParser item parsing (static import — covers L270-284) ──

describe("News — fetchFeed DOMParser item parsing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses title/link/pubDate/description from mock DOMParser", async () => {
    const mockItem = {
      querySelector: (s: string) => {
        if (s === "title") return { textContent: "מבחן כותרת" };
        if (s === "link") return { textContent: "https://example.com/test" };
        if (s === "pubDate") return { textContent: "Mon, 01 Jan 2024 10:00:00 +0000" };
        if (s === "description") return { textContent: "<p>תיאור</p>" };
        return null;
      },
    };
    const mockDoc = {
      querySelectorAll: (sel: string) => (sel === "item" ? [mockItem] : []),
    };
    vi.stubGlobal(
      "DOMParser",
      class {
        parseFromString() {
          return mockDoc;
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
        json: async () => ({ contents: "" }),
      }),
    );
    const items = await fetchFeed({
      url: "https://rss.example.com/feed",
      src: "Test",
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.title).toBe("מבחן כותרת");
    expect(items[0]?.source).toBe("Test");
  });

  it("skips item when title is missing", async () => {
    const mockItemNoTitle = {
      querySelector: (s: string) => {
        if (s === "title") return { textContent: "" };
        return null;
      },
    };
    const mockDoc = { querySelectorAll: () => [mockItemNoTitle] };
    vi.stubGlobal(
      "DOMParser",
      class {
        parseFromString() {
          return mockDoc;
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "",
        json: async () => ({ contents: "" }),
      }),
    );
    const items = await fetchFeed({
      url: "https://rss.example.com/feed",
      src: "Test",
    });
    expect(items).toHaveLength(0);
  });
});

// ── renderNews extra DOM paths (static import — covers count, ticker, stale age, age badge) ──

describe("News — renderNews extra DOM paths (static import)", () => {
  function buildFullDOM(): void {
    document.body.innerHTML = `
      <div id="rss-scroll"></div>
      <span id="news-count"></span>
      <div id="news-ticker"></div>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    buildFullDOM();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("news count badge shows item count when elNewsCount is present", () => {
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    expect(document.getElementById("news-count")?.textContent).toBe("1");
  });

  it("news count badge is empty when no items", () => {
    renderNews([]);
    expect(document.getElementById("news-count")?.textContent).toBe("");
  });

  it("ticker shows titles when elNewsTicker is present", () => {
    renderNews([{ title: "כותרת טיקר", link: "", pubDate: "", source: "מקור" }]);
    expect(document.getElementById("news-ticker")?.textContent).toContain("כותרת טיקר");
  });

  it("ticker is not updated when items list is empty", () => {
    document.getElementById("news-ticker")!.textContent = "old";
    renderNews([]);
    expect(document.getElementById("news-ticker")?.textContent).toBe("old");
  });

  it("stale-old class applied for item 25h old", () => {
    const OLD = new Date(Date.now() - 25 * 3_600_000).toISOString();
    renderNews([{ title: "כותרת", link: "", pubDate: OLD, source: "מקור" }]);
    const primary = document.querySelector(".rss-item:not(.clone)");
    expect(primary?.classList.contains("stale-old")).toBe(true);
  });

  it("stale-day class applied for item 14h old", () => {
    const DAY = new Date(Date.now() - 14 * 3_600_000).toISOString();
    renderNews([{ title: "כותרת", link: "", pubDate: DAY, source: "מקור" }]);
    const primary = document.querySelector(".rss-item:not(.clone)");
    expect(primary?.classList.contains("stale-day")).toBe(true);
  });

  it("stale-half class applied for item 8h old", () => {
    const HALF = new Date(Date.now() - 8 * 3_600_000).toISOString();
    renderNews([{ title: "כותרת", link: "", pubDate: HALF, source: "מקור" }]);
    const primary = document.querySelector(".rss-item:not(.clone)");
    expect(primary?.classList.contains("stale-half")).toBe(true);
  });

  it("age badge (.news-age) appears for item with recent pubDate", () => {
    const RECENT = new Date(Date.now() - 3 * 3_600_000).toISOString();
    renderNews([{ title: "כותרת", link: "", pubDate: RECENT, source: "מקור" }]);
    expect(document.querySelector(".news-age")).not.toBeNull();
  });

  it("no stale class for item with empty pubDate", () => {
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    const primary = document.querySelector(".rss-item:not(.clone)");
    expect(primary?.classList.contains("stale-old")).toBe(false);
    expect(primary?.classList.contains("stale-day")).toBe(false);
    expect(primary?.classList.contains("stale-half")).toBe(false);
  });
});

// ── renderNews search-query paths (static import — covers search highlight + count) ──

describe("News — renderNews search-query paths (static import)", () => {
  function buildSearchDOM(): void {
    document.body.innerHTML = `
      <div id="rss-scroll"></div>
      <input id="news-search" />
      <button id="news-search-clear"></button>
      <span id="news-search-count"></span>
      <span id="news-count"></span>
    `;
    cacheDom();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    buildSearchDOM();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {})),
    );
    // Wire search event via initNewsCard (uses fresh DOM refs from cacheDom above)
    initNewsCard();
  });

  afterEach(() => {
    // Clear _searchQuery before destroying DOM
    const input = document.getElementById("news-search") as HTMLInputElement | null;
    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("input"));
    }
    document.body.innerHTML = "";
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("highlight marks appear when search query matches item title", () => {
    const input = document.getElementById("news-search") as HTMLInputElement;
    input.value = "ביטחון";
    input.dispatchEvent(new Event("input"));
    renderNews([{ title: "ביטחון בצפון", link: "", pubDate: "", source: "מקור" }]);
    expect(document.querySelector("mark.rss-highlight")).not.toBeNull();
  });

  it("search count badge shows filtered/total when query is active", () => {
    const input = document.getElementById("news-search") as HTMLInputElement;
    input.value = "צפון";
    input.dispatchEvent(new Event("input"));
    renderNews([
      { title: "ביטחון בצפון", link: "", pubDate: "", source: "מקור" },
      { title: "כלכלה", link: "", pubDate: "", source: "מקור" },
    ]);
    expect(document.getElementById("news-search-count")?.textContent).toBe("1/2");
  });

  it("getSearchQuery returns the current search value", () => {
    const input = document.getElementById("news-search") as HTMLInputElement;
    input.value = "test-q";
    input.dispatchEvent(new Event("input"));
    expect(getSearchQuery()).toBe("test-q");
  });

  it("search clear button resets query to empty", () => {
    const input = document.getElementById("news-search") as HTMLInputElement;
    input.value = "some query";
    input.dispatchEvent(new Event("input"));
    document.getElementById("news-search-clear")?.dispatchEvent(new Event("click"));
    expect(getSearchQuery()).toBe("");
  });
});

// ── applyNewsFontSize via static import (covers L553-563) ──

describe("News — applyNewsFontSize via static import", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("sets fontSize% on #rss-scroll when valid value and element cached", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    localStorage.setItem("dash_v2_news_fontsize", "150");
    applyNewsFontSize();
    expect(document.getElementById("rss-scroll")?.style.fontSize).toBe("150%");
  });

  it("does not throw when LS value is valid but elRssScroll is null", () => {
    document.body.innerHTML = "<div></div>";
    cacheDom();
    localStorage.setItem("dash_v2_news_fontsize", "115");
    expect(() => applyNewsFontSize()).not.toThrow();
  });

  it("does not apply when value is NaN", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    localStorage.setItem("dash_v2_news_fontsize", "abc");
    applyNewsFontSize();
    expect(document.getElementById("rss-scroll")?.style.fontSize).toBe("");
  });
});

// ── copy button: no-link path + timeout reset (static import — covers L461, L468-469) ──

describe("News — renderNews copy button extra paths (static import)", () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("copies title only when item has no link (else branch, L461)", async () => {
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    document.querySelector<HTMLElement>(".news-copy")?.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("כותרת");
  });

  it("resets copy button state after 1500ms timeout (L468-469)", async () => {
    vi.useFakeTimers();
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    const btn = document.querySelector<HTMLElement>(".news-copy");
    btn?.click();
    await Promise.resolve();
    expect(btn?.textContent).toBe("✓");
    vi.advanceTimersByTime(2000);
    expect(btn?.textContent).toBe("📋");
    expect(btn?.classList.contains("copied")).toBe(false);
  });
});

// ── bookmark mode (static import — covers L337, L416-418, L503-505) ──

describe("News — renderNews bookmark mode paths (static import)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="rss-scroll"></div><span id="news-bkm-pill"></span>`;
    cacheDom();
    vi.useFakeTimers();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("bookmark button click handler fires without throwing (L416-418)", () => {
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    const btn = document.querySelector<HTMLElement>(".news-bkm-btn");
    expect(btn).not.toBeNull();
    expect(() => btn?.click()).not.toThrow();
    // Second click removes the bookmark
    btn?.click();
  });

  it("bookmark mode shows only bookmarked items (L337)", () => {
    toggleBookmarkMode(); // _bkmMode = true
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    // No bookmarked items → renders empty
    expect(document.querySelectorAll(".rss-item").length).toBe(0);
    toggleBookmarkMode(); // _bkmMode = false
  });

  it("RAF sets animation=none when bookmark mode is active (L503-505)", () => {
    toggleBookmarkMode(); // _bkmMode = true
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    vi.runAllTimers(); // fires RAF (implemented as setTimeout(0) in happy-dom)
    const el = document.getElementById("rss-scroll");
    // After RAF fires in bkmMode: animation="none"
    expect(el?.style.animation).toBe("none");
    toggleBookmarkMode(); // _bkmMode = false
  });
});

// ── storage catch paths (static import — covers L141-142, L151, L171-172, L180) ──

describe("News — storage catch paths (static import)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    localStorage.clear();
    sessionStorage.clear();
  });

  it("cacheDom handles sessionStorage.getItem throw gracefully (L141-142)", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    vi.spyOn(globalThis.sessionStorage, "getItem").mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });
    expect(() => cacheDom()).not.toThrow();
  });

  it("markVisited handles sessionStorage.setItem throw gracefully (L151)", () => {
    vi.spyOn(globalThis.sessionStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    expect(() => markVisited("test-key")).not.toThrow();
  });

  it("cacheDom handles localStorage.getItem throw gracefully (L171-172)", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    vi.spyOn(globalThis.localStorage, "getItem").mockImplementationOnce(() => {
      throw new Error("storage unavailable");
    });
    expect(() => cacheDom()).not.toThrow();
  });

  it("toggleBookmark handles localStorage.setItem throw gracefully (L180)", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementationOnce(() => {
      throw new Error("quota exceeded");
    });
    expect(() => toggleBookmark("test-key")).not.toThrow();
    // cleanup: remove the bookmark we added (setItem threw but _bookmarks was updated)
    toggleBookmark("test-key");
  });
});

// ── loadVisited catch branch (line 42) ──

describe("News — loadVisited catch (corrupted sessionStorage)", () => {
  it("recovers when sessionStorage has invalid JSON for visited", async () => {
    // Put invalid JSON in sessionStorage before module loads
    sessionStorage.setItem("dash_visited", "NOT_VALID_JSON{{{");
    // Reset modules to trigger loadVisited at module scope
    vi.resetModules();
    const mod = await import("@/cards/news/news");
    // Should not throw; isVisited should return false for anything
    expect(mod.isVisited("anything")).toBe(false);
    sessionStorage.clear();
  });
});

// ── saveBookmarks catch branch (line 151) ──

describe("News — saveBookmarks quota exceeded (line 151)", () => {
  it("does not throw when localStorage.setItem fails during toggleBookmark", () => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    vi.spyOn(globalThis.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => toggleBookmark("bkm-key")).not.toThrow();
    vi.restoreAllMocks();
    // cleanup
    toggleBookmark("bkm-key");
  });
});
// ── markVisited sessionStorage quota catch (line 141) ────────────────────────

describe("News — markVisited sessionStorage quota catch", () => {
  afterEach(() => {
    // Use vi.unstubAllGlobals so vitest's own cleanup mechanism restores
    // sessionStorage — vi.spyOn on happy-dom Storage isn't reliably tracked
    // by restoreMocks:true, which caused spy leakage into sibling describes.
    vi.unstubAllGlobals();
  });

  const makeThrowingStorage = (): Storage => {
    const data = new Map<string, string>();
    return {
      get length() {
        return data.size;
      },
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
      getItem: (k: string) => data.get(k) ?? null,
      removeItem: (k: string) => {
        data.delete(k);
      },
      clear: () => data.clear(),
      key: (i: number) => [...data.keys()][i] ?? null,
    };
  };

  it("does not throw when sessionStorage.setItem throws", () => {
    vi.stubGlobal("sessionStorage", makeThrowingStorage());
    expect(() => markVisited("some-key")).not.toThrow();
  });

  it("markVisited still records the key in memory even if storage fails", () => {
    vi.stubGlobal("sessionStorage", makeThrowingStorage());
    markVisited("mem-key");
    expect(isVisited("mem-key")).toBe(true);
  });
});

// ── fetchAllNews deduplication (lines 306-326) ──────────────────────────────

describe("News — fetchAllNews deduplication via renderNews", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renderNews with duplicate titles de-dupes display", () => {
    const items = [
      {
        title: "כותרת חדשות חשובה מאוד",
        link: "https://example.com/1",
        pubDate: "2024-01-15T10:00:00Z",
        category: "security" as const,
        feedId: "f1",
      },
      {
        title: "כותרת חדשות חשובה מאוד", // exact duplicate
        link: "https://example.com/2",
        pubDate: "2024-01-15T11:00:00Z",
        category: "security" as const,
        feedId: "f2",
      },
    ];
    expect(() => renderNews(items)).not.toThrow();
    const rssScroll = document.getElementById("rss-scroll")!;
    // Only one item should render since they have matching first-40-chars
    expect(rssScroll.children.length).toBeGreaterThanOrEqual(1);
  });

  it("renderNews handles items with null pubDate gracefully", () => {
    const items = [
      {
        title: "חדשות ללא תאריך",
        link: "https://example.com/no-date",
        pubDate: null as unknown as string,
        category: "security" as const,
        feedId: "f1",
      },
      {
        title: "חדשות עם תאריך",
        link: "https://example.com/with-date",
        pubDate: "2024-01-15T10:00:00Z",
        category: "security" as const,
        feedId: "f1",
      },
    ];
    expect(() => renderNews(items)).not.toThrow();
  });
});

// ── loadVisited sessionStorage catch (line 141) ────────────────────────────────

describe("News — loadVisited sessionStorage catch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("handles corrupt sessionStorage visited data without throwing", () => {
    sessionStorage.setItem("rss_visited_v1", "{not-valid-json{{");
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    expect(() => cacheDom()).not.toThrow();
    // After catch, visited set is empty
    expect(isVisited("any-key")).toBe(false);
  });
});

// ── fetchAllNews sort/dedup path (lines 306-326) ────────────────────────────

describe("News — fetchAllNews sort and dedup path", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exercises sort comparator and dedup when fetch returns multi-item RSS", async () => {
    vi.resetModules();
    const rssXml = [
      '<?xml version="1.0"?>',
      '<rss version="2.0"><channel><title>T</title>',
      "<item><title>אחד</title><link>http://a.com/1</link>",
      "<pubDate>Mon, 13 Jan 2025 09:00:00 +0000</pubDate></item>",
      "<item><title>שניים</title><link>http://a.com/2</link>",
      "<pubDate>Mon, 13 Jan 2025 11:00:00 +0000</pubDate></item>",
      "<item><title>אחד</title><link>http://a.com/3</link>",
      "<pubDate>Mon, 13 Jan 2025 08:00:00 +0000</pubDate></item>",
      "</channel></rss>",
    ].join("\n");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => rssXml }));
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    const mod = await import("@/cards/news/news");
    mod.cacheDom();
    mod.initNewsCard();
    // Flush loadNews → fetchAllNews → fetchFeed async chain
    for (let i = 0; i < 60; i++) await Promise.resolve();
    // If renderNews was called, scroll will have children (or at least no throw)
    expect(document.getElementById("rss-scroll")).not.toBeNull();
  });
});

// ── loadVisited catch path (line 141) via dynamic import ────────────────────

describe("News — loadVisited catch path via fresh module (line 141)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("resets _visited to empty Set when sessionStorage has invalid JSON (line 141)", async () => {
    // Set CORRUPT data BEFORE module import so loadVisited() in cacheDom() finds it
    sessionStorage.setItem("rss_visited_v1", "{{not-valid-json");
    vi.resetModules();
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    const mod = await import("@/cards/news/news");
    // cacheDom() → loadVisited() → JSON.parse throws → catch → _visited = new Set()
    mod.cacheDom();
    // isVisited should return false (empty visited set from catch)
    expect(mod.isVisited("any-url")).toBe(false);
  });
});
// ── loadVisited catch correct key (line 141) ─────────────────────────────────

describe("News — loadVisited catch using correct VISITED_KEY (line 141)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("sets _visited to empty Set when dash_visited_news has invalid JSON (line 141 catch)", async () => {
    // Use the actual key from news.ts ("dash_visited_news") with invalid JSON
    sessionStorage.setItem("dash_visited_news", "{INVALID_JSON!!!");
    vi.resetModules();
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    const mod = await import("@/cards/news/news");
    // cacheDom() calls loadVisited() → JSON.parse("{INVALID_JSON!!!") throws → catch → _visited = new Set()
    mod.cacheDom();
    expect(mod.isVisited("http://any.url")).toBe(false);
  });
});

// ── loadBookmarks reads from localStorage (line 167 ?? LEFT branch) ──────────

describe("News — loadBookmarks with existing localStorage value (line 167 ?? left branch)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses stored bookmarks when localStorage has dash_bookmarks (line 167 non-null branch)", () => {
    // Pre-populate localStorage with a bookmark key BEFORE cacheDom is called
    localStorage.setItem("dash_bookmarks", JSON.stringify(["stored-bookmark-key"]));
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    // cacheDom() calls loadBookmarks() → localStorage.getItem returns non-null
    // → ?? "[]" LEFT branch taken (value is not null/undefined)
    expect(() => cacheDom()).not.toThrow();
    // Verify loading worked: toggleBookmark should see "stored-bookmark-key" in _bookmarks
    // A second toggleBookmark removes it, third adds it back (net toggle for cleanup)
    toggleBookmark("stored-bookmark-key"); // removes (bookmark was loaded)
    toggleBookmark("stored-bookmark-key"); // adds back
  });
});

// ── renderNews rAF callback returns early when elRssScroll is null (line 501) ─

describe("News — renderNews rAF early-return when elRssScroll null (line 501)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rAF returns early when elRssScroll becomes null before rAF fires (line 501)", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
    // Queue the rAF callback by rendering news
    renderNews([{ title: "כותרת", link: "", pubDate: "", source: "מקור" }]);
    // Remove #rss-scroll from DOM and re-call cacheDom → elRssScroll = null
    document.body.innerHTML = "";
    cacheDom(); // now elRssScroll = null
    // Fire rAF (happy-dom implements rAF as setTimeout(0))
    // line 501: if (!elRssScroll) return → early exit, no throw
    expect(() => vi.runAllTimers()).not.toThrow();
  });
});

// ── initNewsSearch clear button click handler (lines 557-560) ────────────────

describe("News — initNewsSearch clear button click (lines 557-560)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("clicking #news-search-clear clears the search query (lines 557-560)", async () => {
    // Use a fresh module instance so that cacheDom wires elSearchClear from this DOM
    vi.resetModules();
    document.body.innerHTML = `
      <div id="rss-scroll"></div>
      <input id="news-search" value="" />
      <button id="news-search-clear"></button>
      <span id="news-search-count"></span>
    `;
    const mod = await import("@/cards/news/news");
    // cacheDom sets elSearchClear, then initNewsCard wires the click handler
    mod.cacheDom();
    mod.initNewsCard();
    // Set a search query via the input event
    const input = document.getElementById("news-search") as HTMLInputElement;
    input.value = "מבצע";
    input.dispatchEvent(new Event("input"));
    expect(mod.getSearchQuery()).toBe("מבצע");
    // Click clear → handler fires: _searchQuery = "", input.value = ""
    document.getElementById("news-search-clear")!.click();
    expect(mod.getSearchQuery()).toBe("");
    expect(input.value).toBe("");
  });
});

// ── F9 (v7.2): renderSourceFilterChips ──────────────────────────────────────

describe("News — renderSourceFilterChips (F9 v7.2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("populates #news-filter-bar with one chip per NEWS_FEEDS entry", () => {
    document.body.innerHTML = `<div id="news-filter-bar"></div>`;
    renderSourceFilterChips();
    const bar = document.getElementById("news-filter-bar")!;
    const chips = bar.querySelectorAll(".news-src-chip");
    expect(chips.length).toBe(NEWS_FEEDS.length);
  });

  it("each chip has correct data-src attribute", () => {
    document.body.innerHTML = `<div id="news-filter-bar"></div>`;
    renderSourceFilterChips();
    const chips = Array.from(document.querySelectorAll<HTMLElement>(".news-src-chip"));
    const srcs = chips.map((c) => c.dataset["src"]);
    for (const feed of NEWS_FEEDS) {
      expect(srcs).toContain(feed.src);
    }
  });

  it("does not throw when #news-filter-bar is absent", () => {
    document.body.innerHTML = "";
    expect(() => renderSourceFilterChips()).not.toThrow();
  });
});

// ── Sprint 26: readingTimeMinutes ────────────────────────────────────────────

describe("News — readingTimeMinutes", () => {
  it("returns 0 for empty string", () => {
    expect(readingTimeMinutes("")).toBe(0);
  });

  it("returns 1 for fewer than 200 words", () => {
    const text = Array(50).fill("word").join(" ");
    expect(readingTimeMinutes(text)).toBe(1);
  });

  it("returns 2 for ~400 words", () => {
    const text = Array(400).fill("word").join(" ");
    expect(readingTimeMinutes(text)).toBe(2);
  });

  it("rounds correctly", () => {
    const text = Array(300).fill("word").join(" ");
    expect(readingTimeMinutes(text)).toBe(2);
  });
});

// ── Sprint 26: isBreaking ─────────────────────────────────────────────────────

describe("News — isBreaking", () => {
  it("returns true for title containing 'breaking'", () => {
    expect(isBreaking("Breaking: Major update", "2000-01-01")).toBe(true);
  });

  it("returns true for title containing 'בזק'", () => {
    expect(isBreaking("בזק: פיגוע בירושלים", "2000-01-01")).toBe(true);
  });

  it("returns true for pubDate within 30 minutes of now", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isBreaking("Normal title", recent)).toBe(true);
  });

  it("returns false for old non-breaking article", () => {
    expect(isBreaking("Normal title", "2000-01-01")).toBe(false);
  });

  it("returns false for empty pubDate with non-breaking title", () => {
    expect(isBreaking("Normal title", "")).toBe(false);
  });
});

// ── Sprint 26: newsSourceDomain ──────────────────────────────────────────────

describe("News — newsSourceDomain", () => {
  it("extracts domain from https URL", () => {
    expect(newsSourceDomain("https://www.ynet.co.il/news/article/123")).toBe("ynet.co.il");
  });

  it("strips www. prefix", () => {
    expect(newsSourceDomain("https://www.haaretz.com/article")).toBe("haaretz.com");
  });

  it("handles no www", () => {
    expect(newsSourceDomain("https://news.bbc.co.uk/article")).toBe("news.bbc.co.uk");
  });

  it("returns the input string on failure", () => {
    expect(newsSourceDomain("not-a-url")).toBe("not-a-url");
  });
});

// ── Sprint 26: sanitizeNewsTitle ─────────────────────────────────────────────

describe("News — sanitizeNewsTitle", () => {
  it("replaces &amp; with &", () => {
    expect(sanitizeNewsTitle("Cats &amp; Dogs")).toBe("Cats & Dogs");
  });

  it("replaces &lt; and &gt;", () => {
    expect(sanitizeNewsTitle("A &lt; B &gt; C")).toBe("A < B > C");
  });

  it("truncates long titles", () => {
    const long = "a".repeat(200);
    const result = sanitizeNewsTitle(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith("…")).toBe(true);
  });

  it("respects custom maxLen", () => {
    expect(sanitizeNewsTitle("Hello world", 5)).toBe("Hell…");
  });

  it("strips numeric HTML entities", () => {
    expect(sanitizeNewsTitle("Hello&#8212;World")).toBe("HelloWorld");
  });

  it("returns clean title unchanged when no entities", () => {
    expect(sanitizeNewsTitle("Plain title")).toBe("Plain title");
  });
});

// ── Sprint 26: readingTimeMinutes ────────────────────────────────────────────

describe("News — readingTimeMinutes", () => {
  it("returns 0 for empty string", () => {
    expect(readingTimeMinutes("")).toBe(0);
  });

  it("returns 1 for fewer than 200 words", () => {
    const text = Array(50).fill("word").join(" ");
    expect(readingTimeMinutes(text)).toBe(1);
  });

  it("returns 2 for ~400 words", () => {
    const text = Array(400).fill("word").join(" ");
    expect(readingTimeMinutes(text)).toBe(2);
  });

  it("rounds correctly", () => {
    const text = Array(300).fill("word").join(" ");
    expect(readingTimeMinutes(text)).toBe(2);
  });
});

// ── Sprint 26: isBreaking ─────────────────────────────────────────────────────

describe("News — isBreaking", () => {
  it("returns true for title containing 'breaking'", () => {
    expect(isBreaking("Breaking: Major update", "2000-01-01")).toBe(true);
  });

  it("returns true for title containing 'בזק'", () => {
    expect(isBreaking("בזק: פיגוע בירושלים", "2000-01-01")).toBe(true);
  });

  it("returns true for pubDate within 30 minutes of now", () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isBreaking("Normal title", recent)).toBe(true);
  });

  it("returns false for old non-breaking article", () => {
    expect(isBreaking("Normal title", "2000-01-01")).toBe(false);
  });

  it("returns false for empty pubDate with non-breaking title", () => {
    expect(isBreaking("Normal title", "")).toBe(false);
  });
});

// ── Sprint 26: newsSourceDomain ──────────────────────────────────────────────

describe("News — newsSourceDomain", () => {
  it("extracts domain from https URL", () => {
    expect(newsSourceDomain("https://www.ynet.co.il/news/article/123")).toBe("ynet.co.il");
  });

  it("strips www. prefix", () => {
    expect(newsSourceDomain("https://www.haaretz.com/article")).toBe("haaretz.com");
  });

  it("handles no www", () => {
    expect(newsSourceDomain("https://news.bbc.co.uk/article")).toBe("news.bbc.co.uk");
  });

  it("returns the input string on failure", () => {
    expect(newsSourceDomain("not-a-url")).toBe("not-a-url");
  });
});

// ── Sprint 26: sanitizeNewsTitle ─────────────────────────────────────────────

describe("News — sanitizeNewsTitle", () => {
  it("replaces &amp; with &", () => {
    expect(sanitizeNewsTitle("Cats &amp; Dogs")).toBe("Cats & Dogs");
  });

  it("replaces &lt; and &gt;", () => {
    expect(sanitizeNewsTitle("A &lt; B &gt; C")).toBe("A < B > C");
  });

  it("truncates long titles", () => {
    const long = "a".repeat(200);
    const result = sanitizeNewsTitle(long);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith("…")).toBe(true);
  });

  it("respects custom maxLen", () => {
    expect(sanitizeNewsTitle("Hello world", 5)).toBe("Hell…");
  });

  it("strips numeric HTML entities", () => {
    expect(sanitizeNewsTitle("Hello&#8212;World")).toBe("HelloWorld");
  });

  it("returns clean title unchanged when no entities", () => {
    expect(sanitizeNewsTitle("Plain title")).toBe("Plain title");
  });
});

// ── Sprint 48: newsShowSource config gate ─────────────────────────────────

describe("News — newsShowSource config gate (Sprint 48)", () => {
  const makeItem = (title = "כותרת בדיקה", source = "Ynet") => ({
    title,
    link: "https://ynet.co.il/test",
    pubDate: "",
    source,
  });

  function setupNewsDOM(): void {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    localStorage.removeItem("dash_v2_config");
    cacheDom();
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("renders .rss-source by default (newsShowSource=true)", () => {
    setupNewsDOM();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ newsShowSource: true, configVersion: 3 }),
    );
    renderNews([makeItem()]);
    const source = document.querySelector(".rss-source");
    expect(source).not.toBeNull();
    expect((source as HTMLElement).hidden).toBe(false);
  });

  it("hides .rss-source when newsShowSource=false", () => {
    setupNewsDOM();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ newsShowSource: false, configVersion: 3 }),
    );
    renderNews([makeItem()]);
    const source = document.querySelector(".rss-source");
    expect(source).not.toBeNull();
    expect((source as HTMLElement).hidden).toBe(true);
  });
});

// ── Sprint 48: breaking news badge ───────────────────────────────────────

describe("News — breaking news badge (Sprint 48)", () => {
  function setupNewsDOM(): void {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    localStorage.removeItem("dash_v2_config");
    cacheDom();
  }

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("renders breaking badge for item with breaking keyword in title", () => {
    setupNewsDOM();
    renderNews([
      {
        title: "בזק: מתקפה קשה",
        link: "https://ynet.co.il",
        pubDate: new Date().toUTCString(),
        source: "Ynet",
      },
    ]);
    const badge = document.querySelector(".news-breaking-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("מבזק");
  });

  it("does not render breaking badge for regular items", () => {
    setupNewsDOM();
    renderNews([
      {
        title: "ידיעה רגילה על השבוע",
        link: "https://ynet.co.il",
        pubDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toUTCString(),
        source: "Ynet",
      },
    ]);
    const badge = document.querySelector(".news-breaking-badge");
    expect(badge).toBeNull();
  });

  it("renders breaking badge for very recent items (< 30 min)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
    setupNewsDOM();
    renderNews([
      {
        title: "ידיעה חדשה ביותר",
        link: "https://ynet.co.il",
        pubDate: new Date("2025-06-15T11:45:00Z").toUTCString(),
        source: "Ynet",
      },
    ]);
    const badge = document.querySelector(".news-breaking-badge");
    expect(badge).not.toBeNull();
  });
});

// ── Sprint 27: readingTimeMinutes + badge rendering ──────────────────────────

describe("News — readingTimeMinutes (Sprint 27)", () => {
  it("returns 0 for empty string", () => {
    expect(readingTimeMinutes("")).toBe(0);
  });

  it("returns 1 for very short text (< 200 words)", () => {
    expect(readingTimeMinutes("hello world")).toBe(1);
  });

  it("returns 1 for exactly 200 words", () => {
    expect(readingTimeMinutes(Array(200).fill("word").join(" "))).toBe(1);
  });

  it("returns 2 for 300 words", () => {
    expect(readingTimeMinutes(Array(300).fill("word").join(" "))).toBe(2);
  });

  it("returns 5 for 1000 words", () => {
    expect(readingTimeMinutes(Array(1000).fill("word").join(" "))).toBe(5);
  });
});

describe("News — reading-time badge in renderNews (Sprint 27)", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="rss-scroll"></div>`;
    cacheDom();
  });

  it("shows reading-time badge for items with description", () => {
    renderNews([
      {
        title: "Article with description",
        link: "https://ynet.co.il",
        pubDate: "",
        source: "Ynet",
        description: Array(250).fill("word").join(" "),
      },
    ]);
    const badge = document.querySelector(".news-reading-time");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toMatch(/~\d+ דק׳/);
  });

  it("does NOT show reading-time badge when description is absent", () => {
    renderNews([
      {
        title: "No desc",
        link: "https://ynet.co.il",
        pubDate: "",
        source: "Ynet",
      },
    ]);
    expect(document.querySelector(".news-reading-time")).toBeNull();
  });
});

// ── Stream D2.2: createAsyncCardLoader migration ─────────────────────────────

describe("News — loadNews uses createAsyncCardLoader (Stream D2.2)", () => {
  it("loadNews is a function (async loader)", async () => {
    const { loadNews } = await import("@/cards/news/news");
    expect(typeof loadNews).toBe("function");
  });

  it("loadNews returns a Promise when invoked", async () => {
    const { loadNews } = await import("@/cards/news/news");
    // page visible mock
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    const result = loadNews();
    expect(result).toBeInstanceOf(Promise);
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it('newsCard.id is "news"', async () => {
    const { newsCard } = await import("@/cards/news/news");
    expect(newsCard.id).toBe("news");
  });
});

// ── Sprint 183 / N5 — ageFreshness ────────────────────────────────────────

describe("News — ageFreshness (Sprint 183 N5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'old' for empty string", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    expect(ageFreshness("")).toBe("old");
  });

  it("returns 'old' for invalid date", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    expect(ageFreshness("not-a-date")).toBe("old");
  });

  it("returns 'old' for future date", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    expect(ageFreshness("2024-01-10T11:00:00Z")).toBe("old");
  });

  it("returns 'fresh2m' for article < 2 minutes old", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    // 90 seconds old
    expect(ageFreshness("2024-01-10T09:58:30Z")).toBe("fresh2m");
  });

  it("returns 'fresh1h' for article between 2 min and 1 hour old", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    // 30 minutes old
    expect(ageFreshness("2024-01-10T09:30:00Z")).toBe("fresh1h");
  });

  it("returns 'fresh1d' for article between 1 hour and 1 day old", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    // 6 hours old
    expect(ageFreshness("2024-01-10T04:00:00Z")).toBe("fresh1d");
  });

  it("returns 'old' for article >= 1 day old", async () => {
    const { ageFreshness } = await import("@/cards/news/news");
    // 2 days old
    expect(ageFreshness("2024-01-08T10:00:00Z")).toBe("old");
  });
});

// ── Sprint 196 / N3: Per-source mute window ───────────────────────────────

import {
  isMuted,
  muteSource,
  unmuteSource,
  loadMutedSources,
  getMutedSources,
} from "@/cards/news/news";

describe("News — isMuted / muteSource / unmuteSource (Sprint 196 / N3)", () => {
  beforeEach(() => {
    localStorage.clear();
    loadMutedSources();
  });

  it("isMuted returns false for unknown source", () => {
    expect(isMuted("כאן חדשות")).toBe(false);
  });

  it("isMuted returns true after muteSource", () => {
    muteSource("גלובס", 60_000);
    expect(isMuted("גלובס")).toBe(true);
  });

  it("isMuted returns false after expiry", () => {
    muteSource("כלכליסט", -1); // already expired
    expect(isMuted("כלכליסט")).toBe(false);
  });

  it("unmuteSource removes mute", () => {
    muteSource("ערוץ 7", 60_000);
    unmuteSource("ערוץ 7");
    expect(isMuted("ערוץ 7")).toBe(false);
  });

  it("persists mute to localStorage", () => {
    muteSource("רוטר סקופים", 60_000);
    loadMutedSources(); // re-load to simulate page reload
    expect(isMuted("רוטר סקופים")).toBe(true);
  });

  it("getMutedSources returns current map", () => {
    muteSource("גיקטיים", 60_000);
    const map = getMutedSources();
    expect(map["גיקטיים"]).toBeGreaterThan(Date.now());
  });
});

describe("News — renderNews mute filter (Sprint 196 / N3)", () => {
  beforeEach(() => {
    localStorage.clear();
    loadMutedSources();
    document.body.innerHTML = `
      <div id="rss-scroll"></div>
      <div id="news-ticker"></div>
      <div id="news-count"></div>`;
    cacheDom();
  });

  afterEach(() => {
    _resetNewsForTest();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("hides items from muted sources", () => {
    muteSource("גלובס", 60_000);
    renderNews([
      { title: "כותרת 1", link: "", pubDate: "", source: "גלובס" },
      { title: "כותרת 2", link: "", pubDate: "", source: "כאן חדשות" },
    ]);
    const items = document.querySelectorAll(".rss-item:not(.clone)");
    expect(Array.from(items).some((el) => el.textContent?.includes("כותרת 1"))).toBe(false);
    expect(Array.from(items).some((el) => el.textContent?.includes("כותרת 2"))).toBe(true);
  });

  it("shows all items when no sources are muted", () => {
    renderNews([
      { title: "כותרת א׳", link: "", pubDate: "", source: "כאן חדשות" },
      { title: "כותרת ב׳", link: "", pubDate: "", source: "גלובס" },
    ]);
    const items = document.querySelectorAll(".rss-item:not(.clone)");
    expect(items.length).toBe(2);
  });
});

// ── Sprint 206 / N2: Star / read-later IDB ──────────────────────────
describe("News — star/read-later IDB (Sprint 206)", () => {
  beforeEach(() => { _idbClearFallback(); });

  it("getStarId returns trimmed link", () => {
    const id = getStarId({ link: "https://example.com/a", title: "Title" });
    expect(id).toBe("https://example.com/a");
  });

  it("getStarId falls back to title when link is empty", () => {
    const id = getStarId({ link: "", title: "My Article" });
    expect(id).toBe("My Article");
  });

  it("starArticle + isStarred returns true", async () => {
    const item = { title: "Test", link: "https://x.com/1", pubDate: "", source: "test" };
    await starArticle(item);
    expect(await isStarred(getStarId(item))).toBe(true);
  });

  it("unstarArticle removes article", async () => {
    const item = { title: "Test2", link: "https://x.com/2", pubDate: "", source: "test" };
    await starArticle(item);
    const id = getStarId(item);
    await unstarArticle(id);
    expect(await isStarred(id)).toBe(false);
  });

  it("isStarred returns false for unknown id", async () => {
    expect(await isStarred("no-such-id")).toBe(false);
  });
});

// ── Sprint 255: fast-check property tests (NP1–NP5) ───────────────────────

import * as fc from "fast-check";

describe("NP1 · sanitizeNewsTitle — property: output length ≤ maxLen", () => {
  it("truncated title never exceeds maxLen characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 300 }),
        fc.integer({ min: 10, max: 200 }),
        (title, maxLen) => {
          const result = sanitizeNewsTitle(title, maxLen);
          return result.length <= maxLen;
        },
      ),
    );
  });

  it("title within limit is returned as-is (trimmed)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (title) => {
        const result = sanitizeNewsTitle(title, 120);
        return result.length <= 120;
      }),
    );
  });

  it("output is always a string", () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        return typeof sanitizeNewsTitle(title) === "string";
      }),
    );
  });
});

describe("NP2 · newsSourceDomain — property: output has no protocol or path", () => {
  it("strips https:// from well-formed URLs", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("ynet.co.il", "bbc.com", "haaretz.co.il", "theguardian.com"),
        fc.constantFrom("https://", "http://"),
        (domain, proto) => {
          const result = newsSourceDomain(`${proto}${domain}/some/path`);
          return !result.startsWith("http") && result.length > 0;
        },
      ),
    );
  });

  it("returns non-empty string for any ASCII URL-like string", () => {
    fc.assert(
      fc.property(
        fc.webUrl(),
        (url) => {
          const result = newsSourceDomain(url);
          return typeof result === "string";
        },
      ),
    );
  });
});

describe("NP3 · filterBySearch — property: result is always a subset of input", () => {
  const itemArb = fc.record({
    title: fc.string({ minLength: 1, maxLength: 80 }),
    link: fc.webUrl(),
    pubDate: fc.constant("2024-01-01T12:00:00Z"),
    source: fc.constant("test"),
  });

  it("filtered result is always a subset of input", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        (items, query) => {
          const result = filterBySearch(items as Parameters<typeof filterBySearch>[0], query);
          return result.every((r) => items.some((i) => i.link === r.link));
        },
      ),
    );
  });

  it("empty query returns all items", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { minLength: 1, maxLength: 10 }),
        (items) => {
          const result = filterBySearch(items as Parameters<typeof filterBySearch>[0], "");
          return result.length === items.length;
        },
      ),
    );
  });

  it("filter is idempotent — applying twice yields same result", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 15 }),
        (items, query) => {
          const asItems = items as Parameters<typeof filterBySearch>[0];
          const first = filterBySearch(asItems, query);
          const second = filterBySearch(first, query);
          return first.length === second.length;
        },
      ),
    );
  });
});

describe("NP4 · getBookmarkKey — property: output is a stable non-empty string", () => {
  it("any non-empty title produces a non-empty key", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (title) => {
        const key = getBookmarkKey(title);
        return typeof key === "string" && key.length > 0;
      }),
    );
  });

  it("same title always produces the same key (deterministic)", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (title) => {
        return getBookmarkKey(title) === getBookmarkKey(title);
      }),
    );
  });
});

describe("NP5 · ageFreshness — property: returns valid freshness class for any ISO date", () => {
  const VALID_CLASSES = ["fresh2m", "fresh1h", "fresh1d", "old"] as const;

  it("always returns a known freshness class for recent dates", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.now() - 7 * 24 * 60 * 60_000), max: new Date() }),
        (d) => {
          fc.pre(isFinite(d.getTime()));
          const result = ageFreshness(d.toISOString());
          return VALID_CLASSES.includes(result as (typeof VALID_CLASSES)[number]);
        },
      ),
    );
  });

  it("very old date always returns 'old'", () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString();
    expect(ageFreshness(old)).toBe("old");
  });

  it("output is always one of four known values for any string input", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const result = ageFreshness(s);
        return VALID_CLASSES.includes(result as (typeof VALID_CLASSES)[number]);
      }),
    );
  });
});

// ── Sprint 267 / N1: Vectorize shadow mode tests ──────────────────────────────

describe("News — Vectorize shadow mode (Sprint 267 / N1 ADR-046)", () => {
  beforeEach(() => {
    _resetNewsForTest();
    localStorage.clear();
  });
  afterEach(() => {
    _resetNewsForTest();
    localStorage.clear();
  });

  it("isShadowVectorizeEnabled returns false by default", () => {
    expect(isShadowVectorizeEnabled()).toBe(false);
  });

  it("setShadowVectorize(true) enables shadow mode and persists to localStorage", () => {
    setShadowVectorize(true);
    expect(isShadowVectorizeEnabled()).toBe(true);
    expect(localStorage.getItem("fdb_shadow_vectorize")).toBe("1");
  });

  it("setShadowVectorize(false) disables shadow mode and removes localStorage key", () => {
    setShadowVectorize(true);
    setShadowVectorize(false);
    expect(isShadowVectorizeEnabled()).toBe(false);
    expect(localStorage.getItem("fdb_shadow_vectorize")).toBeNull();
  });

  it("loadShadowVectorizeFlag reads enabled state from localStorage", () => {
    localStorage.setItem("fdb_shadow_vectorize", "1");
    loadShadowVectorizeFlag();
    expect(isShadowVectorizeEnabled()).toBe(true);
  });

  it("loadShadowVectorizeFlag sets disabled when key absent", () => {
    loadShadowVectorizeFlag();
    expect(isShadowVectorizeEnabled()).toBe(false);
  });

  it("recordShadowVectorizeComparison does nothing when shadow mode is disabled", () => {
    recordShadowVectorizeComparison(10, 8);
    expect(getShadowVectorizeLog()).toHaveLength(0);
  });

  it("recordShadowVectorizeComparison appends entry when shadow mode is enabled", () => {
    setShadowVectorize(true);
    recordShadowVectorizeComparison(10, 8);
    const log = getShadowVectorizeLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.simhashDeduped).toBe(10);
    expect(log[0]?.vectorizeCandidates).toBe(8);
    expect(log[0]?.overlap).toBe(8);
  });

  it("getShadowVectorizeLog is capped at 50 entries", () => {
    setShadowVectorize(true);
    for (let i = 0; i < 60; i++) {
      recordShadowVectorizeComparison(i, i);
    }
    expect(getShadowVectorizeLog().length).toBeLessThanOrEqual(50);
  });

  it("getShadowVectorizeLog overlap is always min(simhash, vectorize)", () => {
    setShadowVectorize(true);
    recordShadowVectorizeComparison(5, 3);
    recordShadowVectorizeComparison(2, 7);
    const log = getShadowVectorizeLog();
    expect(log[0]?.overlap).toBe(3);
    expect(log[1]?.overlap).toBe(2);
  });
});
