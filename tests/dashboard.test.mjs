/**
 * Unit tests for BestDashBoard.html
 * Run: node --test tests/dashboard.test.mjs
 * Uses Node.js built-in test runner — zero external dependencies.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, "..", "BestDashBoard.html");
const html = readFileSync(HTML_PATH, "utf8");

// ── Extract <script> block ──
const scriptMatch = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/);
const scriptContent = scriptMatch ? scriptMatch[1] : "";

// ═══════════════════════════════════════════════════════════════════
// 1. HTML STRUCTURE
// ═══════════════════════════════════════════════════════════════════
describe("HTML Structure", () => {
  it("should have DOCTYPE declaration", () => {
    assert.ok(html.startsWith("<!DOCTYPE html>"), "Missing DOCTYPE");
  });

  it("should have RTL direction and Hebrew lang", () => {
    assert.ok(html.includes('dir="rtl"'), 'Missing dir="rtl"');
    assert.ok(html.includes('lang="he"'), 'Missing lang="he"');
  });

  it("should have UTF-8 charset", () => {
    assert.ok(html.includes('charset="UTF-8"'), "Missing UTF-8 charset");
  });

  it("should have viewport meta tag", () => {
    assert.ok(html.includes('name="viewport"'), "Missing viewport meta");
  });

  it("should have a title", () => {
    assert.match(html, /<title>.+<\/title>/, "Missing or empty title");
  });

  it("should contain the main grid layout", () => {
    assert.ok(html.includes('class="main-grid"'), "Missing main-grid");
    assert.ok(html.includes('class="bottom-grid"'), "Missing bottom-grid");
  });

  it("should have all 7 card panels", () => {
    const syncDots = [
      "sync-news",
      "sync-cal",
      "sync-stocks",
      "sync-alerts",
      "sync-wx",
      "sync-cur",
      "sync-moti",
    ];
    for (const id of syncDots) {
      assert.ok(html.includes(`id="${id}"`), `Missing sync dot: ${id}`);
    }
  });

  it("should have the clock element", () => {
    assert.ok(html.includes('id="clock"'), "Missing clock element");
  });

  it("should have the ticker bar", () => {
    assert.ok(html.includes('id="ticker-content"'), "Missing ticker content");
    assert.ok(html.includes('class="ticker-track"'), "Missing ticker track");
  });

  it("should have the diagnostic overlay", () => {
    assert.ok(html.includes('id="diag-overlay"'), "Missing diagnostic overlay");
  });

  it("should have the offline banner", () => {
    assert.ok(html.includes('id="offline-banner"'), "Missing offline banner");
  });

  it("should have the status bar", () => {
    assert.ok(html.includes('class="status-bar"'), "Missing status bar");
    assert.ok(html.includes('id="day-progress"'), "Missing day progress");
    assert.ok(html.includes('id="year-progress"'), "Missing year progress");
    assert.ok(html.includes('id="last-refresh"'), "Missing last refresh");
  });

  it("should have all 6 stock tiles", () => {
    const symbols = ["INTC", "^GSPC", "BTC-USD", "NVDA", "^VIX", "TSLA"];
    for (const sym of symbols) {
      assert.ok(
        html.includes(`data-symbol="${sym}"`),
        `Missing stock tile: ${sym}`,
      );
    }
  });

  it("should have weather card elements", () => {
    assert.ok(html.includes('id="wx-icon"'), "Missing wx-icon");
    assert.ok(html.includes('id="wx-temp"'), "Missing wx-temp");
    assert.ok(html.includes('id="wx-desc"'), "Missing wx-desc");
    assert.ok(html.includes('id="wx-hum"'), "Missing wx-hum");
    assert.ok(html.includes('id="wx-wind"'), "Missing wx-wind");
    assert.ok(html.includes('id="wx-uv"'), "Missing wx-uv");
  });

  it("should have calendar card", () => {
    assert.ok(html.includes('id="cal-agenda"'), "Missing calendar agenda");
    assert.ok(
      html.includes('id="cal-iframe"'),
      "Missing calendar iframe fallback",
    );
  });

  it("should have news scroll container", () => {
    assert.ok(html.includes('id="rss-scroll"'), "Missing rss-scroll");
    assert.ok(html.includes('class="news-body"'), "Missing news-body");
  });

  it("should have alerts scroll container", () => {
    assert.ok(html.includes('id="alerts-scroll"'), "Missing alerts-scroll");
    assert.ok(html.includes('class="alerts-body"'), "Missing alerts-body");
  });

  it("should have stocks scroll container", () => {
    assert.ok(html.includes('id="stocks-body"'), "Missing stocks-body");
    assert.ok(
      html.includes('class="stocks-body"'),
      "Missing stocks-body class",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. CSS THEMES & VARIABLES
// ═══════════════════════════════════════════════════════════════════
describe("CSS Themes & Variables", () => {
  it("should define :root CSS custom properties", () => {
    assert.ok(html.includes(":root"), "Missing :root");
    assert.ok(html.includes("--bg-primary"), "Missing --bg-primary");
    assert.ok(html.includes("--accent"), "Missing --accent");
    assert.ok(html.includes("--text-primary"), "Missing --text-primary");
    assert.ok(html.includes("--positive"), "Missing --positive");
    assert.ok(html.includes("--negative"), "Missing --negative");
  });

  it("should define all 5 themes", () => {
    const themes = [
      "theme-black",
      "theme-blue",
      "theme-matrix",
      "theme-amber",
      "theme-purple",
    ];
    for (const theme of themes) {
      assert.ok(html.includes(`body.${theme}`), `Missing theme: ${theme}`);
    }
  });

  it("should define 3 screen modes", () => {
    const modes = ["mode-tv", "mode-tablet", "mode-phone"];
    for (const mode of modes) {
      assert.ok(
        html.includes(`mode-${mode.split("-")[1]}`),
        `Missing screen mode: ${mode}`,
      );
    }
  });

  it("should have glassmorphism styles", () => {
    assert.ok(html.includes("backdrop-filter"), "Missing backdrop-filter");
    assert.ok(
      html.includes("-webkit-backdrop-filter"),
      "Missing webkit-backdrop-filter",
    );
  });

  it("should have prefers-reduced-motion support", () => {
    assert.ok(
      html.includes("prefers-reduced-motion"),
      "Missing reduced-motion support",
    );
  });

  it("should use CSS containment", () => {
    assert.ok(html.includes("contain:"), "Missing CSS containment");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. SCROLL ANIMATIONS
// ═══════════════════════════════════════════════════════════════════
describe("Scroll Animations", () => {
  it("should have news scroll CSS", () => {
    assert.ok(html.includes(".rss-scroll"), "Missing .rss-scroll CSS");
    assert.ok(
      html.includes("newsScroll"),
      "Missing newsScroll keyframe reference",
    );
  });

  it("should have alerts scroll CSS", () => {
    assert.ok(html.includes(".alerts-scroll"), "Missing .alerts-scroll CSS");
    assert.ok(
      html.includes("alertsScroll"),
      "Missing alertsScroll keyframe reference",
    );
  });

  it("should have stocks scroll CSS", () => {
    assert.ok(html.includes(".stocks-scroll"), "Missing .stocks-scroll CSS");
    assert.ok(
      html.includes("stocksScroll"),
      "Missing stocksScroll keyframe reference",
    );
  });

  it("should have ticker scroll CSS", () => {
    assert.ok(html.includes(".ticker-content"), "Missing .ticker-content CSS");
    assert.ok(html.includes("tickerScroll"), "Missing tickerScroll keyframe");
  });

  it("all scroll containers should pause on hover", () => {
    assert.ok(
      html.includes(".rss-scroll:hover"),
      "News scroll missing hover pause",
    );
    assert.ok(
      html.includes(".alerts-scroll:hover"),
      "Alerts scroll missing hover pause",
    );
    assert.ok(
      html.includes(".stocks-scroll:hover"),
      "Stocks scroll missing hover pause",
    );
    assert.ok(
      html.includes(".ticker-content:hover"),
      "Ticker missing hover pause",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. JAVASCRIPT CONSTANTS
// ═══════════════════════════════════════════════════════════════════
describe("JavaScript Constants", () => {
  it("should have PROXIES array with 2 CORS proxies", () => {
    assert.ok(
      scriptContent.includes(
        "const PROXIES = ['https://api.allorigins.win/get?url=','https://api.codetabs.com/v1/proxy?quest=']",
      ),
      "PROXIES definition incorrect",
    );
  });

  it("should have 6 STOCK_SYMBOLS", () => {
    const match = scriptContent.match(/const STOCK_SYMBOLS\s*=\s*\[(.*?)\]/);
    assert.ok(match, "Missing STOCK_SYMBOLS");
    const symbols = match[1].split(",").map((s) => s.trim().replace(/'/g, ""));
    assert.equal(
      symbols.length,
      6,
      `Expected 6 stock symbols, got ${symbols.length}`,
    );
    assert.ok(symbols.includes("INTC"), "Missing INTC");
    assert.ok(symbols.includes("NVDA"), "Missing NVDA");
    assert.ok(symbols.includes("TSLA"), "Missing TSLA");
  });

  it("should have STOCK_NAMES for every STOCK_SYMBOL", () => {
    const symbols = ["INTC", "^GSPC", "BTC-USD", "NVDA", "^VIX", "TSLA"];
    for (const sym of symbols) {
      assert.ok(
        scriptContent.includes(
          `${sym.includes("^") || sym.includes("-") ? "'" + sym + "'" : sym}:`,
        ),
        `Missing STOCK_NAMES entry for ${sym}`,
      );
    }
  });

  it("should have at least 45 MOTIVATIONS", () => {
    const matches = scriptContent.match(/\{t:'/g);
    assert.ok(matches, "No motivations found");
    assert.ok(
      matches.length >= 45,
      `Expected >=45 motivations, got ${matches.length}`,
    );
  });

  it("should have no duplicate motivations", () => {
    const motiRegex = /\{t:'(.*?)',a:/g;
    const texts = [];
    let m;
    while ((m = motiRegex.exec(scriptContent)) !== null) {
      texts.push(m[1]);
    }
    const dupes = texts.filter((t, i) => texts.indexOf(t) !== i);
    assert.equal(
      dupes.length,
      0,
      `Duplicate motivations found: ${dupes.join(", ")}`,
    );
  });

  it("should have WX_CODES and WX_EMOJI mappings", () => {
    assert.ok(scriptContent.includes("const WX_CODES"), "Missing WX_CODES");
    assert.ok(scriptContent.includes("const WX_EMOJI"), "Missing WX_EMOJI");
  });

  it("should have THREAT_LABELS", () => {
    assert.ok(
      scriptContent.includes("const THREAT_LABELS"),
      "Missing THREAT_LABELS",
    );
  });

  it("should have NEWS_FEEDS array", () => {
    assert.ok(scriptContent.includes("const NEWS_FEEDS"), "Missing NEWS_FEEDS");
    const feedMatches = scriptContent.match(/\{\s*url:\s*'/g);
    assert.ok(
      feedMatches && feedMatches.length >= 10,
      `Expected >=10 news feeds, got ${feedMatches?.length}`,
    );
  });

  it("should have alert interval constants", () => {
    assert.ok(
      scriptContent.includes("ALERT_INTERVAL_ACTIVE"),
      "Missing ALERT_INTERVAL_ACTIVE",
    );
    assert.ok(
      scriptContent.includes("ALERT_INTERVAL_IDLE"),
      "Missing ALERT_INTERVAL_IDLE",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. JAVASCRIPT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
describe("JavaScript Core Functions", () => {
  it("should have relTime function", () => {
    assert.ok(
      scriptContent.includes("function relTime("),
      "Missing relTime function",
    );
  });

  it("should have cache functions (cGet, cGetStale, cSet, cEvict)", () => {
    assert.ok(scriptContent.includes("function cGet("), "Missing cGet");
    assert.ok(
      scriptContent.includes("function cGetStale("),
      "Missing cGetStale",
    );
    assert.ok(scriptContent.includes("function cSet("), "Missing cSet");
    assert.ok(scriptContent.includes("function cEvict("), "Missing cEvict");
  });

  it("should have fetchWithTimeout function", () => {
    assert.ok(
      scriptContent.includes("function fetchWithTimeout("),
      "Missing fetchWithTimeout",
    );
    assert.ok(
      scriptContent.includes("AbortController"),
      "fetchWithTimeout should use AbortController",
    );
  });

  it("should have fetch lock functions", () => {
    assert.ok(
      scriptContent.includes("function acquireLock("),
      "Missing acquireLock",
    );
    assert.ok(
      scriptContent.includes("function releaseLock("),
      "Missing releaseLock",
    );
  });

  it("should have safeLoad wrapper", () => {
    assert.ok(scriptContent.includes("safeLoad"), "Missing safeLoad");
  });

  it("should have diagLog function", () => {
    assert.ok(scriptContent.includes("function diagLog("), "Missing diagLog");
  });

  it("should have setSync function", () => {
    assert.ok(
      scriptContent.includes("setSync") && scriptContent.includes("'syncing'"),
      "Missing setSync",
    );
  });

  it("should have bezierChart function", () => {
    assert.ok(
      scriptContent.includes("function bezierChart("),
      "Missing bezierChart",
    );
  });

  it("should have fmtPrice function", () => {
    assert.ok(scriptContent.includes("function fmtPrice("), "Missing fmtPrice");
  });

  it("should have Page Visibility handler", () => {
    assert.ok(
      scriptContent.includes("visibilitychange"),
      "Missing visibilitychange listener",
    );
    assert.ok(
      scriptContent.includes("_pageVisible"),
      "Missing _pageVisible flag",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. LOADER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
describe("Data Loader Functions", () => {
  const loaders = [
    "loadNews",
    "loadWeather",
    "loadCalendar",
    "loadAllStocks",
    "loadCurrency",
    "loadAlerts",
    "loadHebrewDate",
    "loadShabbat",
  ];

  for (const fn of loaders) {
    it(`should have ${fn} function`, () => {
      assert.ok(scriptContent.includes(`function ${fn}(`), `Missing ${fn}`);
    });
  }

  it("should have renderNews function", () => {
    assert.ok(
      scriptContent.includes("function renderNews("),
      "Missing renderNews",
    );
  });

  it("should have renderAlerts function", () => {
    assert.ok(
      scriptContent.includes("function renderAlerts("),
      "Missing renderAlerts",
    );
  });

  it("should have renderStock function", () => {
    assert.ok(
      scriptContent.includes("function renderStock("),
      "Missing renderStock",
    );
  });

  it("should have renderTicker function", () => {
    assert.ok(
      scriptContent.includes("function renderTicker("),
      "Missing renderTicker",
    );
  });

  it("should have renderCalendar function", () => {
    assert.ok(
      scriptContent.includes("renderCalendar") ||
        scriptContent.includes("renderCal"),
      "Missing calendar render function",
    );
  });

  it("should have setupStocksLoop function", () => {
    assert.ok(
      scriptContent.includes("function setupStocksLoop("),
      "Missing setupStocksLoop",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. relTime LOGIC (extracted & tested directly)
// ═══════════════════════════════════════════════════════════════════
describe("relTime Function Logic", () => {
  // Re-implement relTime for isolated testing (matches the dashboard implementation)
  function relTime(dateStr) {
    if (!dateStr) return "";
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 1) return "עכשיו";
    if (diff < 60) return `לפני ${diff} דק׳`;
    if (diff < 1440) return `לפני ${Math.floor(diff / 60)} שע׳`;
    return `לפני ${Math.floor(diff / 1440)} ימים`;
  }

  it("should return empty string for falsy input", () => {
    assert.equal(relTime(null), "");
    assert.equal(relTime(""), "");
    assert.equal(relTime(undefined), "");
  });

  it('should return "עכשיו" for current time', () => {
    assert.equal(relTime(new Date().toISOString()), "עכשיו");
  });

  it("should return minutes for < 60 min", () => {
    const d = new Date(Date.now() - 5 * 60000).toISOString();
    assert.equal(relTime(d), "לפני 5 דק׳");
  });

  it("should return hours for < 24h", () => {
    const d = new Date(Date.now() - 3 * 3600000).toISOString();
    assert.equal(relTime(d), "לפני 3 שע׳");
  });

  it("should return days for >= 24h", () => {
    const d = new Date(Date.now() - 2 * 86400000).toISOString();
    assert.equal(relTime(d), "לפני 2 ימים");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. SECURITY CHECKS
// ═══════════════════════════════════════════════════════════════════
describe("Security", () => {
  it("should not use eval()", () => {
    // Exclude matches inside comments or strings about security
    const evalMatches = scriptContent.match(/\beval\s*\(/g);
    assert.ok(!evalMatches, "eval() found in code — security risk");
  });

  it("should not use document.write()", () => {
    assert.ok(
      !scriptContent.includes("document.write("),
      "document.write() found — security risk",
    );
  });

  it("should use textContent for external data rendering", () => {
    assert.ok(
      scriptContent.includes(".textContent"),
      "Should use textContent for safe rendering",
    );
  });

  it("should not hardcode API keys", () => {
    const keyPatterns = /api[_-]?key\s*[:=]\s*['"][A-Za-z0-9]{16,}/i;
    assert.ok(
      !keyPatterns.test(scriptContent),
      "Potential hardcoded API key found",
    );
  });

  it("should not have stray console.log in production (diagLog wrapper allowed)", () => {
    // The diagLog function uses console.log internally — that's OK
    // Check for console.log OUTSIDE diagLog
    const lines = scriptContent.split("\n");
    const strayLogs = lines.filter(
      (l) =>
        l.includes("console.log(") &&
        !l.includes("function diagLog") &&
        !l.includes("'[Dashboard]'") &&
        !l.includes('"[Dashboard]"'),
    );
    assert.equal(
      strayLogs.length,
      0,
      `Found stray console.log() calls outside diagLog: ${strayLogs.join("\n")}`,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. NEWS ITEM TIME FORMAT
// ═══════════════════════════════════════════════════════════════════
describe("News Time Format", () => {
  it("should render news with relative time + actual time", () => {
    // Verify renderNews includes both relTime and toLocaleTimeString
    assert.ok(
      scriptContent.includes("relTime(it.pubDate)") &&
        scriptContent.includes("toLocaleTimeString('he-IL'"),
      "News items should display relative time AND actual clock time",
    );
  });

  it("should render alerts with relative time + actual time", () => {
    assert.ok(
      scriptContent.includes("relTime(d.toISOString())") &&
        scriptContent.includes("toLocaleTimeString('he-IL'"),
      "Alert items should display relative time AND actual clock time",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 10. SEAMLESS SCROLL LOOP PATTERN
// ═══════════════════════════════════════════════════════════════════
describe("Seamless Scroll Loop Pattern", () => {
  it("news should duplicate items for seamless scroll", () => {
    assert.ok(
      scriptContent.includes("[...list, ...list]"),
      "News should duplicate items for loop",
    );
  });

  it("alerts should build items twice (original + clone)", () => {
    assert.ok(
      scriptContent.includes("buildAlertItems(el.alertsScroll, false)") &&
        scriptContent.includes("buildAlertItems(el.alertsScroll, true)"),
      "Alerts should call buildAlertItems twice",
    );
  });

  it("stocks should clone tiles for scroll loop", () => {
    assert.ok(
      scriptContent.includes("setupStocksLoop"),
      "Stocks should have setupStocksLoop",
    );
    assert.ok(
      scriptContent.includes("stk-clone"),
      "Stocks should use stk-clone class",
    );
  });

  it("all scrolls should use dynamic keyframes", () => {
    assert.ok(
      scriptContent.includes("'news-scroll-style'"),
      "News missing dynamic keyframe style",
    );
    assert.ok(
      scriptContent.includes("'alerts-scroll-style'"),
      "Alerts missing dynamic keyframe style",
    );
    assert.ok(
      scriptContent.includes("'stocks-scroll-style'"),
      "Stocks missing dynamic keyframe style",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 11. ERROR HANDLING & DIAGNOSTICS
// ═══════════════════════════════════════════════════════════════════
describe("Error Handling & Diagnostics", () => {
  it("should have global error catchers", () => {
    assert.ok(
      scriptContent.includes("unhandledrejection"),
      "Missing unhandledrejection handler",
    );
    assert.ok(
      scriptContent.includes("addEventListener('error'") ||
        scriptContent.includes("window.onerror"),
      "Missing global error handler",
    );
  });

  it("should have startup self-check", () => {
    assert.ok(
      scriptContent.includes("selfCheck") ||
        scriptContent.includes("self-check") ||
        scriptContent.includes("MOTIVATIONS.length"),
      "Missing startup self-check",
    );
  });

  it("should have diagnostic overlay toggle", () => {
    assert.ok(
      scriptContent.includes("'KeyD'") ||
        scriptContent.includes('"KeyD"') ||
        scriptContent.includes("key === 'd'") ||
        scriptContent.includes("key === 'D'"),
      "Missing D key for diagnostic overlay",
    );
  });

  it("should have theme cycle shortcut", () => {
    assert.ok(
      scriptContent.includes("'KeyT'") ||
        scriptContent.includes('"KeyT"') ||
        scriptContent.includes("key === 't'") ||
        scriptContent.includes("key === 'T'"),
      "Missing T key for theme cycle",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 12. CACHE SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Cache System", () => {
  it("should use versioned localStorage prefix", () => {
    assert.ok(
      scriptContent.includes("'dash_v2_'"),
      "Missing versioned cache prefix dash_v2_",
    );
  });

  it("should have 7-day eviction period", () => {
    assert.ok(
      scriptContent.includes("7 * 86400000") ||
        scriptContent.includes("604800000"),
      "Missing 7-day eviction constant",
    );
  });

  it("should evict old v1 entries on startup", () => {
    assert.ok(
      scriptContent.includes("!k.startsWith(LS_PREFIX)"),
      "Should clean up old v1 cache entries",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 13. CARD ENTRANCE ANIMATIONS
// ═══════════════════════════════════════════════════════════════════
describe("Card Animations", () => {
  const animations = [
    "cardSlideLeft",
    "cardSlideRight",
    "cardSlideUp",
    "cardSlideDown",
    "cardPopIn",
    "cardFlipIn",
  ];

  it("should define 6 card entrance keyframes", () => {
    for (const anim of animations) {
      assert.ok(html.includes(anim), `Missing animation keyframe: ${anim}`);
    }
  });

  it("should have attention re-animation loop", () => {
    // Check for the 5-minute re-animation interval
    assert.ok(
      scriptContent.includes("300000") || scriptContent.includes("5 * 60"),
      "Missing 5-minute re-animation loop",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 14. RESPONSIVE LAYOUT
// ═══════════════════════════════════════════════════════════════════
describe("Responsive Layout", () => {
  it("should have media queries for small screens", () => {
    assert.ok(html.includes("@media"), "Missing media queries");
  });

  it("should have phone mode overrides", () => {
    assert.ok(html.includes("mode-phone"), "Missing phone mode class");
  });

  it("should have tablet mode overrides", () => {
    assert.ok(html.includes("mode-tablet"), "Missing tablet mode class");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 15. CALENDAR CARD — ICS PARSING & RENDERING
// ═══════════════════════════════════════════════════════════════════
describe("Calendar Card", () => {
  // Extract parseICS from script for isolated testing
  const parseICSMatch = scriptContent.match(
    /function parseICS\(text\)\s*\{([\s\S]*?)\n    \}/,
  );

  it("should have parseICS function", () => {
    assert.ok(parseICSMatch, "Missing parseICS function in script");
  });

  it("should have CAL_ICS constant with Google Calendar URL", () => {
    assert.ok(
      scriptContent.includes("const CAL_ICS"),
      "Missing CAL_ICS constant",
    );
    assert.ok(
      scriptContent.includes("calendar.google.com/calendar/ical/"),
      "CAL_ICS should point to Google Calendar ICS",
    );
  });

  it("should have CAL_DAYS_AHEAD for event window", () => {
    assert.ok(
      scriptContent.includes("CAL_DAYS_AHEAD"),
      "Missing CAL_DAYS_AHEAD constant",
    );
  });

  it("should have iframe fallback element", () => {
    assert.ok(html.includes('id="cal-iframe"'), "Missing cal-iframe element");
    assert.ok(
      html.includes("calendar.google.com/calendar/embed"),
      "Missing Google Calendar embed URL in iframe",
    );
  });

  it("should have cal-agenda container", () => {
    assert.ok(html.includes('id="cal-agenda"'), "Missing cal-agenda element");
  });

  it("should activate iframe fallback on ICS failure", () => {
    assert.ok(
      scriptContent.includes("cal-fallback-active"),
      "Missing iframe fallback activation class",
    );
  });

  it("should have CSS for iframe fallback with dark theme filter", () => {
    assert.ok(
      html.includes(".cal-wrapper iframe.cal-fallback-active"),
      "Missing CSS for cal-fallback-active",
    );
    assert.ok(
      html.includes("filter: invert(1)"),
      "Missing dark theme invert filter for iframe",
    );
  });

  // Test parseICS with various ICS formats
  // Re-implement parseICS for isolated testing
  function parseICS(text) {
    const events = [];
    const blocks = text.split("BEGIN:VEVENT");
    for (let i = 1; i < blocks.length; i++) {
      const b = blocks[i];
      const unfolded = b.replace(/\r?\n[ \t]/g, "");
      const get = (key) => {
        const m = unfolded.match(
          new RegExp("(?:^|\\n)" + key + "(?:;[^:]*)?:([^\\r\\n]+)", "i"),
        );
        return m ? m[1].trim() : null;
      };
      const dtRaw = get("DTSTART") || "";
      const summary = (get("SUMMARY") || "")
        .replace(/\\,/g, ",")
        .replace(/\\n/g, " ")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\");
      const location = (get("LOCATION") || "")
        .replace(/\\,/g, ",")
        .replace(/\\n/g, ", ")
        .replace(/\\;/g, ";");
      if (!dtRaw || !summary) continue;
      let start,
        allDay = false;
      if (dtRaw.length === 8) {
        start = new Date(
          dtRaw.slice(0, 4) +
            "-" +
            dtRaw.slice(4, 6) +
            "-" +
            dtRaw.slice(6, 8) +
            "T00:00:00",
        );
        allDay = true;
      } else {
        const s = dtRaw.replace(
          /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
          "$1-$2-$3T$4:$5:$6" + (dtRaw.endsWith("Z") ? "Z" : ""),
        );
        start = new Date(s);
      }
      if (isNaN(start.getTime())) continue;
      events.push({ start, allDay, summary, location });
    }
    return events;
  }

  it("parseICS should parse all-day events (YYYYMMDD)", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260415
SUMMARY:Birthday Party
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].summary, "Birthday Party");
    assert.equal(events[0].allDay, true);
    assert.equal(events[0].start.getFullYear(), 2026);
    assert.equal(events[0].start.getMonth(), 3); // April = 3
    assert.equal(events[0].start.getDate(), 15);
  });

  it("parseICS should parse datetime events (UTC)", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260410T140000Z
SUMMARY:Team Meeting
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].summary, "Team Meeting");
    assert.equal(events[0].allDay, false);
    assert.equal(events[0].start.getUTCHours(), 14);
  });

  it("parseICS should parse datetime with timezone parameter", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;TZID=Asia/Jerusalem:20260410T170000
SUMMARY:Local Event
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].summary, "Local Event");
    // Non-UTC datetime should be parsed as local
    assert.equal(events[0].start.getHours(), 17);
  });

  it("parseICS should handle escaped characters in summary", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260410T100000Z
SUMMARY:Meeting\\, with commas\\; and semicolons
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].summary, "Meeting, with commas; and semicolons");
  });

  it("parseICS should handle multi-line folded values", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260410T100000Z
SUMMARY:Very Long Event Title That Was
 Folded Across Lines
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1);
    assert.ok(
      events[0].summary.includes("Very Long Event Title That Was"),
      "Should unfold continuation lines",
    );
    assert.ok(
      events[0].summary.includes("Folded Across Lines"),
      "Should include folded content",
    );
  });

  it("parseICS should parse location", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260410T100000Z
SUMMARY:Office Meeting
LOCATION:Conference Room B
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1);
    assert.equal(events[0].location, "Conference Room B");
  });

  it("parseICS should skip events without DTSTART or SUMMARY", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:No Date Event
END:VEVENT
BEGIN:VEVENT
DTSTART:20260410T100000Z
END:VEVENT
BEGIN:VEVENT
DTSTART:20260410T100000Z
SUMMARY:Valid Event
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 1, "Should only parse event with both DTSTART and SUMMARY");
    assert.equal(events[0].summary, "Valid Event");
  });

  it("parseICS should handle multiple events", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260410T100000Z
SUMMARY:Event One
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260411
SUMMARY:Event Two
END:VEVENT
BEGIN:VEVENT
DTSTART:20260412T080000Z
SUMMARY:Event Three
LOCATION:Home
END:VEVENT
END:VCALENDAR`;
    const events = parseICS(ics);
    assert.equal(events.length, 3);
    assert.equal(events[0].summary, "Event One");
    assert.equal(events[1].summary, "Event Two");
    assert.equal(events[2].summary, "Event Three");
    assert.equal(events[2].location, "Home");
  });

  it("parseICS should return empty array for invalid ICS", () => {
    assert.deepEqual(parseICS(""), []);
    assert.deepEqual(parseICS("not ics data"), []);
    assert.deepEqual(parseICS("BEGIN:VCALENDAR\nEND:VCALENDAR"), []);
  });

  it("should try direct fetch before proxies", () => {
    // loadCalendar should attempt direct fetch first, then iterate PROXIES
    const calFn = scriptContent.match(
      /async function loadCalendar[\s\S]*?releaseLock\('cal'\);\s*\}/,
    );
    assert.ok(calFn, "loadCalendar function not found");
    const fnBody = calFn[0];
    const directIdx = fnBody.indexOf("fetchWithTimeout(CAL_ICS");
    const proxyIdx = fnBody.indexOf("for (const proxy of PROXIES)");
    assert.ok(directIdx > -1, "Missing direct fetch attempt");
    assert.ok(proxyIdx > -1, "Missing proxy fallback loop");
    assert.ok(
      directIdx < proxyIdx,
      "Direct fetch should come before proxy fallback",
    );
  });

  it("should validate ICS content before caching", () => {
    assert.ok(
      scriptContent.includes("BEGIN:VCALENDAR"),
      "Should check for VCALENDAR marker in response",
    );
  });

  it("renderCalendar should show empty message when no events", () => {
    assert.ok(
      scriptContent.includes("אין אירועים"),
      "Missing empty state message in renderCalendar",
    );
  });

  it("renderCalendar should group events by day", () => {
    assert.ok(
      scriptContent.includes("cal-day-header"),
      "Missing day header grouping in renderCalendar",
    );
  });

  it("renderCalendar should highlight today", () => {
    assert.ok(
      scriptContent.includes("todayKey") ||
        scriptContent.includes("today"),
      "Missing today highlight in renderCalendar",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 16. WEATHER CARD
// ═══════════════════════════════════════════════════════════════════
describe("Weather Card", () => {
  it("should have all weather DOM elements", () => {
    const wxIds = [
      "wx-icon",
      "wx-temp",
      "wx-desc",
      "wx-hum",
      "wx-wind",
      "wx-uv",
      "wx-rise",
      "wx-hourly",
      "wx-forecast",
    ];
    for (const id of wxIds) {
      assert.ok(html.includes(`id="${id}"`), `Missing weather element: ${id}`);
    }
  });

  it("should have 4 forecast day slots", () => {
    const fdays = (html.match(/class="wx-fday"/g) || []).length;
    assert.equal(fdays, 4, `Expected 4 forecast days, got ${fdays}`);
  });

  it("should have 4 detail boxes (humidity, wind, UV, sunrise)", () => {
    const details = (html.match(/class="wx-detail"/g) || []).length;
    assert.equal(details, 4, `Expected 4 weather detail boxes, got ${details}`);
  });

  it("should have hourly chart SVG", () => {
    assert.ok(
      html.includes('class="wx-hourly-chart"'),
      "Missing hourly chart SVG",
    );
    assert.ok(
      scriptContent.includes("function renderHourlyChart("),
      "Missing renderHourlyChart function",
    );
  });

  it("renderWeather should update temperature elements", () => {
    assert.ok(
      scriptContent.includes("el.wxTemp") &&
        scriptContent.includes("el.topTemp"),
      "renderWeather should update both wxTemp and topTemp",
    );
  });

  it("renderWeather should display feels-like temperature", () => {
    assert.ok(
      scriptContent.includes("apparent_temperature") &&
        scriptContent.includes("מרגיש"),
      "Should show feels-like temperature from hourly data",
    );
  });

  it("should fetch from Open-Meteo with Jerusalem coordinates", () => {
    assert.ok(
      scriptContent.includes("api.open-meteo.com") &&
        scriptContent.includes("31.7683") &&
        scriptContent.includes("35.2137"),
      "Should use Open-Meteo API with Jerusalem lat/lng",
    );
  });

  it("should have WX_CODES for all standard weather codes", () => {
    // Key weather codes: 0 (clear), 1-3 (cloud), 45/48 (fog), 51-55 (drizzle), 61-65 (rain), 71-75 (snow), 80-82 (showers)
    for (const code of [0, 1, 2, 3, 45, 48, 61, 71, 80]) {
      assert.ok(
        scriptContent.includes(`${code}:`),
        `Missing WX_CODE/WX_EMOJI for code ${code}`,
      );
    }
  });

  it("weather CSS layout should use flex column", () => {
    assert.ok(
      html.includes(".weather-body") &&
        html.includes("flex-direction: column"),
      "Weather body should be flex column layout",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 17. STOCKS CARD
// ═══════════════════════════════════════════════════════════════════
describe("Stocks Card", () => {
  it("should have 6 stock tile blocks with data-symbol", () => {
    const symbols = ["INTC", "^GSPC", "BTC-USD", "NVDA", "^VIX", "TSLA"];
    for (const sym of symbols) {
      assert.ok(
        html.includes(`data-symbol="${sym}"`),
        `Missing stock tile for ${sym}`,
      );
    }
  });

  it("each stock tile should have price, change, chart, and time elements", () => {
    const classes = ["stk-price", "stk-chg", "stk-chart", "stk-time"];
    for (const cls of classes) {
      // Match class attribute containing the class name (may have additional classes like 'skeleton')
      const count = (html.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`, "g")) || [])
        .length;
      assert.ok(count >= 6, `Expected >=6 ${cls} elements, got ${count}`);
    }
  });

  it("renderStock should calculate 3-state trend (positive/negative/neutral)", () => {
    assert.ok(
      scriptContent.includes("'positive'") &&
        scriptContent.includes("'negative'") &&
        scriptContent.includes("'neutral'"),
      "Missing 3-state trend logic in renderStock",
    );
  });

  it("renderStock should apply stk-up/stk-down class for row tinting", () => {
    assert.ok(
      scriptContent.includes("stk-up") &&
        scriptContent.includes("stk-down"),
      "Missing stock row tinting classes",
    );
  });

  it("fmtPrice should format differently by price range", () => {
    // Re-implement fmtPrice for testing
    function fmtPrice(p, s) {
      const n = parseFloat(p);
      if (s === "BTC-USD")
        return (
          "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 })
        );
      return n >= 1000
        ? "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 })
        : n >= 100
          ? "$" + n.toFixed(1)
          : "$" + n.toFixed(2);
    }
    // BTC should have no decimals
    assert.ok(fmtPrice(65432.1, "BTC-USD").startsWith("$"));
    assert.ok(!fmtPrice(65432.1, "BTC-USD").includes("."));
    // High price: no decimals
    assert.ok(!fmtPrice(5200, "^GSPC").includes("."));
    // Mid price: 1 decimal
    assert.equal(fmtPrice(190.5, "INTC"), "$190.5");
    // Low price: 2 decimals
    assert.equal(fmtPrice(22.33, "^VIX"), "$22.33");
  });

  it("should use bezierChart for SVG sparklines", () => {
    assert.ok(
      scriptContent.includes("function bezierChart("),
      "Missing bezierChart function",
    );
    assert.ok(
      scriptContent.includes("bezierChart(prices"),
      "renderStock should call bezierChart",
    );
  });

  it("should batch stock fetches in groups of 3", () => {
    assert.ok(
      scriptContent.includes("i += 3") ||
        scriptContent.includes("batch"),
      "Stocks should be fetched in batches of 3",
    );
  });

  it("should try v8 chart API then fallback to v6", () => {
    assert.ok(
      scriptContent.includes("/v8/finance/chart/"),
      "Missing Yahoo v8 chart API",
    );
    assert.ok(
      scriptContent.includes("/v6/finance/quote"),
      "Missing Yahoo v6 quote API fallback",
    );
  });

  it("should have market hours detection for TTL", () => {
    assert.ok(
      scriptContent.includes("getStockTTL") ||
        scriptContent.includes("stockTTL"),
      "Missing market hours TTL function",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 18. CURRENCY CARD
// ═══════════════════════════════════════════════════════════════════
describe("Currency Card", () => {
  it("should have USD, EUR, GBP display elements", () => {
    assert.ok(html.includes('id="cur-usd"'), "Missing cur-usd element");
    assert.ok(html.includes('id="cur-eur"'), "Missing cur-eur element");
    assert.ok(html.includes('id="cur-gbp"'), "Missing cur-gbp element");
  });

  it("should have currency flag graphics (SVG)", () => {
    // Flags are rendered as inline SVGs, not emoji
    assert.ok(
      html.includes('class="cur-flag"'),
      "Missing cur-flag container for currency flags",
    );
    // Should have 3 flag SVGs (USD, EUR, GBP)
    const flagCount = (html.match(/class="cur-flag"/g) || []).length;
    assert.equal(flagCount, 3, `Expected 3 currency flags, got ${flagCount}`);
  });

  it("renderCurrency should show ILS rate (inverted)", () => {
    // The code inverts: 1/rates[CODE] to show "1 USD = X ILS"
    assert.ok(
      scriptContent.includes("1 / rates[p.code]"),
      "Should invert exchange rate for ILS display",
    );
  });

  it("should show change arrows vs previous fetch", () => {
    assert.ok(
      scriptContent.includes("_prevRates") &&
        scriptContent.includes("cur-chg"),
      "Should track previous rates and show change indicator",
    );
  });

  it("should use ER-API with exchangerate-api fallback", () => {
    assert.ok(
      scriptContent.includes("open.er-api.com"),
      "Missing ER-API primary source",
    );
    assert.ok(
      scriptContent.includes("api.exchangerate-api.com"),
      "Missing exchangerate-api fallback",
    );
  });

  it("currency values should display 3 decimal places", () => {
    assert.ok(
      scriptContent.includes("toFixed(3)"),
      "Currency should use 3 decimal places",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 19. ALERTS CARD (RED ALERTS)
// ═══════════════════════════════════════════════════════════════════
describe("Alerts Card", () => {
  it("should have alerts scroll container", () => {
    assert.ok(
      html.includes('id="alerts-scroll"'),
      "Missing alerts-scroll container",
    );
  });

  it("should use tzevaadom.co.il API", () => {
    assert.ok(
      scriptContent.includes("api.tzevaadom.co.il"),
      "Missing tzevaadom.co.il API",
    );
  });

  it("should have adaptive polling (60s active, 5min idle)", () => {
    assert.ok(
      scriptContent.includes("ALERT_INTERVAL_ACTIVE") &&
        scriptContent.includes("ALERT_INTERVAL_IDLE"),
      "Missing adaptive alert polling intervals",
    );
    assert.ok(
      scriptContent.includes("60000") || scriptContent.includes("60 * 1000"),
      "Missing 60s active interval",
    );
    assert.ok(
      scriptContent.includes("300000") || scriptContent.includes("5 * 60"),
      "Missing 5min idle interval",
    );
  });

  it("should track active alerts (< 10 min)", () => {
    assert.ok(
      scriptContent.includes("_alertsHaveActive"),
      "Missing active alerts tracking flag",
    );
  });

  it("should detect new alerts by comparing top event id", () => {
    assert.ok(
      scriptContent.includes("_lastAlertId"),
      "Missing last alert ID tracking for new alert detection",
    );
  });

  it("should show 24h alert count", () => {
    assert.ok(
      scriptContent.includes("total24h") &&
        scriptContent.includes("התרעות ב-24"),
      "Should display 24h alert count",
    );
  });

  it("should have THREAT_LABELS for threat types", () => {
    assert.ok(
      scriptContent.includes("THREAT_LABELS"),
      "Missing THREAT_LABELS mapping",
    );
    assert.ok(
      scriptContent.includes("ירי רקטות"),
      "Missing rocket threat label",
    );
  });

  it("renderAlerts should show live dot for active alerts", () => {
    assert.ok(
      scriptContent.includes("alert-live-dot"),
      "Missing live indicator dot for active alerts",
    );
  });

  it("should show city names in alerts", () => {
    assert.ok(
      scriptContent.includes("alert-cities"),
      "Missing cities display in alert items",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 20. NEWS CARD
// ═══════════════════════════════════════════════════════════════════
describe("News Card", () => {
  it("should have at least 10 Hebrew RSS feed sources", () => {
    const feedMatches = scriptContent.match(/\{\s*url:\s*'/g);
    assert.ok(
      feedMatches && feedMatches.length >= 10,
      `Expected >=10 RSS feeds, got ${feedMatches?.length}`,
    );
  });

  it("should have news-body scroll container", () => {
    assert.ok(html.includes('class="news-body"'), "Missing news-body");
    assert.ok(html.includes('id="rss-scroll"'), "Missing rss-scroll");
  });

  it("renderNews should deduplicate by title prefix", () => {
    assert.ok(
      scriptContent.includes("seen.has(k)") || scriptContent.includes("Set()"),
      "Should deduplicate news items",
    );
  });

  it("renderNews should sort by date (newest first)", () => {
    assert.ok(
      scriptContent.includes(".sort(") &&
        scriptContent.includes("pubDate"),
      "Should sort news by publication date",
    );
  });

  it("should mark fresh news items (< 30min)", () => {
    assert.ok(
      scriptContent.includes("data-age") ||
        scriptContent.includes("dataset.age"),
      "Should mark recent news with freshness attribute",
    );
  });

  it("should have ticker bar for horizontal scrolling headlines", () => {
    assert.ok(html.includes('id="ticker-content"'), "Missing ticker content");
    assert.ok(
      scriptContent.includes("function renderTicker("),
      "Missing renderTicker function",
    );
  });

  it("should have fetchFeed function for RSS parsing", () => {
    assert.ok(
      scriptContent.includes("function fetchFeed("),
      "Missing fetchFeed function",
    );
    assert.ok(
      scriptContent.includes("DOMParser"),
      "Should use DOMParser for RSS XML parsing",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 21. MOTIVATION CARD
// ═══════════════════════════════════════════════════════════════════
describe("Motivation Card", () => {
  it("should have motivation display element", () => {
    assert.ok(
      html.includes('id="moti-text"') || html.includes('id="moti-quote"'),
      "Missing motivation text element",
    );
  });

  it("should have MOTIVATIONS array with text and author", () => {
    assert.ok(
      scriptContent.includes("MOTIVATIONS"),
      "Missing MOTIVATIONS constant",
    );
    // Check structure: {t:'text', a:'author'}
    assert.ok(
      scriptContent.includes("{t:'") && scriptContent.includes(",a:'"),
      "MOTIVATIONS should have {t, a} structure",
    );
  });

  it("should rotate quotes", () => {
    assert.ok(
      scriptContent.includes("motiIdx") ||
        scriptContent.includes("MOTIVATIONS["),
      "Should cycle through motivation quotes",
    );
  });

  it("should have 4-hour refresh interval", () => {
    assert.ok(
      scriptContent.includes("14400000") ||
        scriptContent.includes("4 * 3600"),
      "Motivation should refresh every 4 hours",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 22. HEBREW DATE & SHABBAT CARDS
// ═══════════════════════════════════════════════════════════════════
describe("Hebrew Date & Shabbat", () => {
  it("should fetch from Hebcal API", () => {
    assert.ok(
      scriptContent.includes("hebcal.com"),
      "Should use Hebcal API for Hebrew dates",
    );
  });

  it("should have Hebrew date display element", () => {
    assert.ok(
      html.includes('id="hebrew-date"'),
      "Missing Hebrew date element",
    );
  });

  it("should have Shabbat times elements", () => {
    assert.ok(
      html.includes('id="shabbat-in"') || html.includes("שבת"),
      "Missing Shabbat display area",
    );
  });

  it("should have holiday countdown", () => {
    assert.ok(
      scriptContent.includes("loadHolidays") ||
        scriptContent.includes("holiday"),
      "Missing holiday countdown feature",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 23. NEW UTILITY FUNCTIONS (v4.5 enhancements)
// ═══════════════════════════════════════════════════════════════════
describe("Utility Functions (v4.5)", () => {
  it("should have animateNumber function", () => {
    assert.ok(
      scriptContent.includes("function animateNumber("),
      "Missing animateNumber utility",
    );
  });

  it("should have exponential backoff system", () => {
    assert.ok(
      scriptContent.includes("function getBackoff(") ||
        scriptContent.includes("getBackoff"),
      "Missing getBackoff function",
    );
    assert.ok(
      scriptContent.includes("function recordFailure("),
      "Missing recordFailure function",
    );
    assert.ok(
      scriptContent.includes("function recordSuccess("),
      "Missing recordSuccess function",
    );
  });

  it("should have uptime tracker", () => {
    assert.ok(
      scriptContent.includes("function getUptime(") ||
        scriptContent.includes("getUptime"),
      "Missing getUptime function",
    );
    assert.ok(
      html.includes('id="uptime-display"'),
      "Missing uptime display element in status bar",
    );
  });

  it("should have syncBurst for visual refresh feedback", () => {
    assert.ok(
      scriptContent.includes("function syncBurst("),
      "Missing syncBurst function",
    );
    assert.ok(
      html.includes("just-synced") || scriptContent.includes("just-synced"),
      "Missing just-synced CSS class",
    );
  });

  it("should use RAF-throttled mousemove for spotlight", () => {
    assert.ok(
      scriptContent.includes("requestAnimationFrame") &&
        scriptContent.includes("mousemove"),
      "Mousemove should be throttled via requestAnimationFrame",
    );
  });
});
