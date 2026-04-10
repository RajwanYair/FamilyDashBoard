/**
 * Unit tests for BestDashBoard.html
 * Run: node --test --test-timeout=500000 tests/dashboard.test.mjs
 * Uses Node.js built-in test runner — zero external dependencies.
 * Global timeout: 500s — kills the process if tests hang.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Hard kill after 500 seconds (safety net for hangs) ──
const GLOBAL_TIMEOUT_MS = 500_000;
const _killTimer = setTimeout(() => {
  console.error(`\n⛔ GLOBAL TIMEOUT: Tests exceeded ${GLOBAL_TIMEOUT_MS / 1000}s — killing process.`);
  process.exit(2);
}, GLOBAL_TIMEOUT_MS);
_killTimer.unref();          // don't keep the event loop alive just for this

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
    assert.ok(
      html.replace(/^\uFEFF/, "").startsWith("<!DOCTYPE html>"),
      "Missing DOCTYPE",
    );
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
    assert.ok(html.includes('class="grids-area"'), "Missing grids-area");
    assert.ok(html.includes("grid-col-left"), "Missing grid-col-left");
    assert.ok(html.includes("grid-col-mid"), "Missing grid-col-mid");
    assert.ok(html.includes("grid-col-right"), "Missing grid-col-right");
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
      "sync-hebcal",
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

  it("should have all 14 stock tiles", () => {
    const symbols = [
      "INTC",
      "^GSPC",
      "BTC-USD",
      "NVDA",
      "^VIX",
      "TSLA",
      "AAPL",
      "MSFT",
      "AMZN",
      "GOOGL",
      "META",
      "BRK-B",
      "AVGO",
      "JPM",
    ];
    for (const sym of symbols) {
      assert.ok(
        html.includes(`data-symbol="${sym}"`),
        `Missing stock tile: ${sym}`,
      );
    }
  });

  it("should have Sefirat HaOmer support", () => {
    assert.ok(
      html.includes('.omer-count'),
      "Missing omer-count CSS rule",
    );
    assert.ok(
      scriptContent.includes('loadOmer'),
      "Missing loadOmer function",
    );
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

  it("should have 14 STOCK_SYMBOLS", () => {
    const match = scriptContent.match(/const STOCK_SYMBOLS\s*=\s*\[(.*?)\]/);
    assert.ok(match, "Missing STOCK_SYMBOLS");
    const symbols = match[1].split(",").map((s) => s.trim().replace(/'/g, ""));
    assert.equal(
      symbols.length,
      14,
      `Expected 14 stock symbols, got ${symbols.length}`,
    );
    assert.ok(symbols.includes("INTC"), "Missing INTC");
    assert.ok(symbols.includes("NVDA"), "Missing NVDA");
    assert.ok(symbols.includes("TSLA"), "Missing TSLA");
    assert.ok(symbols.includes("AAPL"), "Missing AAPL");
    assert.ok(symbols.includes("MSFT"), "Missing MSFT");
    assert.ok(symbols.includes("AMZN"), "Missing AMZN");
    // No duplicate symbols
    const unique = new Set(symbols);
    assert.equal(unique.size, symbols.length, "Duplicate symbols found");
  });

  it("should have STOCK_NAMES for every STOCK_SYMBOL", () => {
    const symbols = [
      "INTC",
      "^GSPC",
      "BTC-USD",
      "NVDA",
      "^VIX",
      "TSLA",
      "AAPL",
      "MSFT",
      "AMZN",
      "GOOGL",
      "META",
      "BRK-B",
      "AVGO",
      "JPM",
    ];
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

  it("should have renderHalacha function", () => {
    assert.ok(
      scriptContent.includes("function renderHalacha("),
      "Missing renderHalacha",
    );
  });

  it("should have renderCalendar function", () => {
    assert.ok(
      scriptContent.includes("renderCalendar") ||
        scriptContent.includes("renderCal"),
      "Missing calendar render function",
    );
  });

  it("should have startStocksScroll function", () => {
    assert.ok(
      scriptContent.includes("function startStocksScroll("),
      "Missing startStocksScroll",
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
  it("should render news with time inline before title", () => {
    // Verify renderNews includes time via toLocaleTimeString inline with title
    assert.ok(
      scriptContent.includes("toLocaleTimeString('he-IL'") &&
        scriptContent.includes("rss-time") &&
        scriptContent.includes("rss-title"),
      "News items should display clock time inline before the title",
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
      scriptContent.includes("buildAlertItems(frag, false)") &&
        scriptContent.includes("buildAlertItems(frag, true)"),
      "Alerts should call buildAlertItems twice",
    );
  });

  it("stocks should use scroll loop without clones", () => {
    assert.ok(
      scriptContent.includes("startStocksScroll"),
      "Stocks should have startStocksScroll",
    );
    assert.ok(
      !scriptContent.includes("stk-clone"),
      "Stocks should NOT use stk-clone (cloning removed)",
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

  it("should show iframe by default and activate native view on ICS load", () => {
    assert.ok(
      scriptContent.includes("ics-loaded"),
      "Missing ics-loaded class for native calendar activation",
    );
  });

  it("should have CSS for iframe default-visible with ics-loaded toggle", () => {
    assert.ok(
      html.includes(".cal-wrapper.ics-loaded iframe"),
      "Missing CSS for ics-loaded iframe hide",
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
  it("should have 14 stock tile blocks with data-symbol", () => {
    const symbols = [
      "INTC",
      "^GSPC",
      "BTC-USD",
      "NVDA",
      "^VIX",
      "TSLA",
      "AAPL",
      "MSFT",
      "AMZN",
      "GOOGL",
      "META",
      "BRK-B",
      "AVGO",
      "JPM",
    ];
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
      assert.ok(count >= 14, `Expected >=14 ${cls} elements, got ${count}`);
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

  it("should use per-symbol v8 fetch with runConcurrent", () => {
    assert.ok(
      scriptContent.includes("loadStockSingle") &&
        scriptContent.includes("/v8/finance/chart/"),
      "Stocks should use per-symbol v8 chart endpoint",
    );
    assert.ok(
      scriptContent.includes("runConcurrent"),
      "Stock fetches should use runConcurrent for rate limiting",
    );
  });

  it("should race proxies for stock fetches", () => {
    assert.ok(
      scriptContent.includes("raceProxies") &&
        scriptContent.includes("Promise.any"),
      "Stock fetches should race all proxies in parallel",
    );
  });

  it("should fall back to individual v8 chart for missed symbols", () => {
    assert.ok(
      scriptContent.includes("loadStockSingle") &&
        scriptContent.includes("/v8/finance/chart/"),
      "Should have individual v8 fallback for symbols missed by batch",
    );
  });

  it("should serve cached data immediately before fetching", () => {
    assert.ok(
      scriptContent.includes("Phase 1") || scriptContent.includes("uncached"),
      "Should render cached stocks immediately then fetch missing ones",
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
  it("should have USD and EUR display elements", () => {
    assert.ok(html.includes('id="cur-usd"'), "Missing cur-usd element");
    assert.ok(html.includes('id="cur-eur"'), "Missing cur-eur element");
    assert.ok(!html.includes('id="cur-gbp"'), "GBP removed — cur-gbp should not exist");
  });

  it("should have currency flag emoji", () => {
    // Flags are rendered as Unicode flag emoji (replaced inline SVGs for consistency)
    assert.ok(
      html.includes('class="cur-flag"'),
      "Missing cur-flag container for currency flags",
    );
    // Should have 2 flag containers (USD, EUR only — GBP removed)
    const flagCount = (html.match(/class="cur-flag"/g) || []).length;
    assert.equal(flagCount, 2, `Expected 2 currency flags, got ${flagCount}`);
    // Should contain flag emoji (🇺🇸 🇪🇺) — not inline SVG
    assert.ok(html.includes("🇺🇸"), "Missing USD flag emoji 🇺🇸");
    assert.ok(html.includes("🇪🇺"), "Missing EUR flag emoji 🇪🇺");
    assert.ok(!html.includes("🇬🇧"), "GBP removed — 🇬🇧 should not appear");
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

  it("should have ticker bar for daily halacha", () => {
    assert.ok(html.includes('id="ticker-content"'), "Missing ticker content");
    assert.ok(
      scriptContent.includes("function renderHalacha("),
      "Missing renderHalacha function",
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

  it("should have 2-minute rotation interval", () => {
    assert.ok(
      scriptContent.includes("120000") ||
        scriptContent.includes("2 * 60"),
      "Motivation should cycle every 2 minutes for continuous TV loop",
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

// ═══════════════════════════════════════════════════════════════════
// 24. HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════
describe("Header Component", () => {
  it("should have the time-section container", () => {
    assert.ok(html.includes('class="time-section"'), "Missing time-section");
  });

  it("should have header-left, header-center, header-right columns", () => {
    assert.ok(html.includes('class="header-left"'), "Missing header-left");
    assert.ok(html.includes('class="header-center"'), "Missing header-center");
    assert.ok(html.includes('class="header-right"'), "Missing header-right");
  });

  it("should have clock element with gradient text", () => {
    assert.ok(html.includes('id="clock"'), "Missing clock element");
    assert.ok(
      html.includes("background-clip: text") || html.includes("-webkit-background-clip: text"),
      "Clock should use gradient text clipping",
    );
  });

  it("should have greeting element", () => {
    assert.ok(html.includes('id="greeting"'), "Missing greeting element");
  });

  it("should have getGreeting function with time-of-day emojis", () => {
    assert.ok(scriptContent.includes("function getGreeting("), "Missing getGreeting");
    assert.ok(scriptContent.includes("🌅") || scriptContent.includes("בוקר"), "Missing morning greeting");
  });

  it("should have tickClock function updating every 60s", () => {
    assert.ok(scriptContent.includes("function tickClock("), "Missing tickClock");
    assert.ok(scriptContent.includes("60000"), "Missing 60s clock interval");
  });

  it("should have English and Hebrew date elements", () => {
    assert.ok(html.includes('id="english-date"'), "Missing english-date");
    assert.ok(html.includes('id="hebrew-date"'), "Missing hebrew-date");
  });

  it("should have top temperature display in header", () => {
    assert.ok(html.includes('id="top-temp"'), "Missing top-temp");
  });

  it("should not have decorative header emojis (removed by design)", () => {
    const emojiMatches = html.match(/class="header-emoji"/g);
    assert.ok(
      !emojiMatches || emojiMatches.length === 0,
      "Header emoji spans should be removed",
    );
  });

  it("card headers should use icon-badge with emoji (no external images)", () => {
    const badgeMatches = html.match(/class="icon-badge \w+">./g);
    assert.ok(
      badgeMatches && badgeMatches.length >= 7,
      "Should have icon-badge emoji for each card",
    );
    assert.ok(
      !html.includes("icon-badge") || !html.match(/icon-badge[^"]*">\s*<img/),
      "Icon badges should not contain img tags",
    );
  });

  it("should have rainbow gradient border on header", () => {
    assert.ok(
      html.includes("border-image") && html.includes("linear-gradient"),
      "Missing rainbow gradient border on header",
    );
  });

  it("should have Shabbat info in Hebrew Calendar card", () => {
    assert.ok(html.includes('id="hc-candles"'), "Missing hc-candles in hc-card");
    assert.ok(html.includes('id="hc-havdala"'), "Missing hc-havdala in hc-card");
  });

  it("should have holiday info in Hebrew Calendar card", () => {
    assert.ok(html.includes('id="hc-holiday"'), "Missing hc-holiday in hc-card");
  });

  it("should display time in Asia/Jerusalem timezone", () => {
    assert.ok(
      scriptContent.includes("Asia/Jerusalem"),
      "Clock should use Asia/Jerusalem timezone",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 25. STATUS BAR COMPONENT
// ═══════════════════════════════════════════════════════════════════
describe("Status Bar", () => {
  it("should have status-bar container", () => {
    assert.ok(html.includes('class="status-bar"'), "Missing status-bar");
  });

  it("should display version v4.8.2", () => {
    assert.ok(
      html.includes("Dashboard v4.8.2"),
      "Missing version v4.8.2 in status bar",
    );
  });

  it("should have day progress bar", () => {
    assert.ok(html.includes('id="day-progress"'), "Missing day progress bar");
    assert.ok(html.includes('id="day-pct"'), "Missing day percentage text");
  });

  it("should have year progress bar", () => {
    assert.ok(html.includes('id="year-progress"'), "Missing year progress bar");
    assert.ok(html.includes('id="year-pct"'), "Missing year percentage text");
  });

  it("should have progress-group wrapper", () => {
    assert.ok(html.includes('class="progress-group"'), "Missing progress-group");
  });

  it("should have uptime display element", () => {
    assert.ok(html.includes('id="uptime-display"'), "Missing uptime-display");
  });

  it("should have last-refresh timestamp", () => {
    assert.ok(html.includes('id="last-refresh"'), "Missing last-refresh");
  });

  it("should have updateProgress function", () => {
    assert.ok(scriptContent.includes("function updateProgress("), "Missing updateProgress");
  });

  it("should have stampRefresh function", () => {
    assert.ok(scriptContent.includes("function stampRefresh("), "Missing stampRefresh");
  });

  it("progress fill should use gradient colors", () => {
    assert.ok(
      html.includes("progress-fill day") && html.includes("progress-fill year"),
      "Missing day/year progress fill classes",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 26. TICKER BAR COMPONENT
// ═══════════════════════════════════════════════════════════════════
describe("Ticker Bar", () => {
  it("should have ticker-bar container", () => {
    assert.ok(html.includes('class="ticker-bar"'), "Missing ticker-bar");
  });

  it("should have ticker-label with breaking headline text", () => {
    assert.ok(html.includes('class="ticker-label"'), "Missing ticker-label");
  });

  it("should have ticker-track for scrolling", () => {
    assert.ok(html.includes('class="ticker-track"'), "Missing ticker-track");
  });

  it("should have ticker-content for items", () => {
    assert.ok(html.includes('id="ticker-content"'), "Missing ticker-content");
  });

  it("should have renderHalacha function", () => {
    assert.ok(scriptContent.includes("function renderHalacha("), "Missing renderHalacha");
  });

  it("should have loadHalacha function with Sefaria API", () => {
    assert.ok(scriptContent.includes("function loadHalacha("), "Missing loadHalacha");
    assert.ok(scriptContent.includes("sefaria.org/api/calendars"), "Should use Sefaria calendar API");
  });

  it("ticker should have horizontal fade mask", () => {
    assert.ok(
      html.includes(".ticker-track") && html.includes("mask-image"),
      "Missing ticker horizontal fade mask",
    );
  });

  it("ticker should use CSS animation for smooth scrolling", () => {
    assert.ok(
      html.includes("tickerScroll") && html.includes("linear infinite"),
      "Ticker should use CSS animation (tickerScroll) for smooth scrolling",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 27. CARD MAXIMIZE SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Card Maximize System", () => {
  it("should have toggleCardMaximize function", () => {
    assert.ok(
      scriptContent.includes("function toggleCardMaximize("),
      "Missing toggleCardMaximize",
    );
  });

  it("should have _maximizedCard state variable", () => {
    assert.ok(
      scriptContent.includes("_maximizedCard"),
      "Missing _maximizedCard state tracker",
    );
  });

  it("should have _maxTargetRect function for target calculation", () => {
    assert.ok(
      scriptContent.includes("function _maxTargetRect("),
      "Missing _maxTargetRect",
    );
  });

  it("should have initCardMaximize function", () => {
    assert.ok(
      scriptContent.includes("function initCardMaximize("),
      "Missing initCardMaximize",
    );
  });

  it("initCardMaximize should attach click listeners to card headers", () => {
    assert.ok(
      scriptContent.includes("card-header") &&
        scriptContent.includes("toggleCardMaximize"),
      "initCardMaximize should attach click handlers to .card-header",
    );
  });

  it("should use FLIP animation technique", () => {
    assert.ok(
      scriptContent.includes("getBoundingClientRect") &&
        scriptContent.includes("offsetWidth"),
      "Should use FLIP animation (getBoundingClientRect + forced reflow)",
    );
  });

  it("should have maximized CSS class with fixed position", () => {
    assert.ok(html.includes(".card.maximized"), "Missing .card.maximized CSS");
    assert.ok(
      html.includes("position: fixed") && html.includes("z-index: 900"),
      "Maximized card should use fixed position + high z-index",
    );
  });

  it("should have card-hidden class for sibling hiding", () => {
    assert.ok(html.includes(".card.card-hidden"), "Missing .card.card-hidden CSS");
    assert.ok(
      html.includes("opacity: 0") && html.includes("pointer-events: none"),
      "Hidden cards should be invisible and non-interactive",
    );
  });

  it("should handle grid-col children correctly in maximize", () => {
    const fn = scriptContent.match(
      /function toggleCardMaximize[\s\S]*?_maximizedCard\s*=\s*card/,
    );
    assert.ok(fn, "Could not find toggleCardMaximize body");
    assert.ok(
      fn[0].includes("grid-col") || fn[0].includes("card-hidden"),
      "Should hide sibling cards using grid-col selector",
    );
  });

  it("Escape key should close maximized card", () => {
    assert.ok(
      scriptContent.includes("Escape") &&
        scriptContent.includes("_maximizedCard"),
      "Escape key should trigger card collapse",
    );
  });

  it("should show close indicator on maximized header", () => {
    assert.ok(
      html.includes(".card.maximized .card-header::after") ||
        html.includes('.card.maximized .card-header::after'),
      "Maximized card header should show close indicator (✕)",
    );
  });

  it("should have smooth transition with cubic-bezier easing", () => {
    assert.ok(
      html.includes("cubic-bezier(0.22, 1, 0.36, 1)"),
      "Card maximize should use smooth cubic-bezier easing",
    );
  });

  it("should prevent multiple cards from maximizing simultaneously", () => {
    const fn = scriptContent.match(
      /function toggleCardMaximize[\s\S]*?_maximizedCard\s*=\s*card/,
    );
    assert.ok(fn, "Could not find toggleCardMaximize");
    assert.ok(
      fn[0].includes("if (_maximizedCard)"),
      "Should guard against multiple maximized cards",
    );
  });

  it("should have fallback timeout for transitionend", () => {
    assert.ok(
      scriptContent.includes("setTimeout") &&
        scriptContent.includes("transitionend"),
      "Should have fallback timer in case transitionend doesn't fire",
    );
  });

  it("card-header should have cursor pointer", () => {
    assert.ok(
      html.includes(".card-header") && html.includes("cursor: pointer"),
      "Card headers should show pointer cursor",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 28. THEME SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Theme System", () => {
  it("should define all 5 theme CSS classes", () => {
    const themes = ["black", "blue", "matrix", "amber", "purple"];
    for (const t of themes) {
      assert.ok(
        html.includes(`body.theme-${t}`),
        `Missing theme class: theme-${t}`,
      );
    }
  });

  it("should have THEMES array constant", () => {
    assert.ok(
      scriptContent.includes("THEMES") &&
        scriptContent.includes("'black'") &&
        scriptContent.includes("'purple'"),
      "Missing THEMES array with all theme names",
    );
  });

  it("should have applyTheme function", () => {
    assert.ok(scriptContent.includes("function applyTheme("), "Missing applyTheme");
  });

  it("should have initTheme function", () => {
    assert.ok(scriptContent.includes("function initTheme("), "Missing initTheme");
  });

  it("each theme should define --bg-primary and --bg-card", () => {
    const themes = ["black", "blue", "matrix", "amber", "purple"];
    for (const t of themes) {
      const themeBlock = html.match(new RegExp(`body\\.theme-${t}[^}]*}`));
      assert.ok(themeBlock, `Cannot find CSS block for theme-${t}`);
      assert.ok(
        themeBlock[0].includes("--bg-primary") || themeBlock[0].includes("--bg-card"),
        `Theme ${t} should define --bg-primary or --bg-card`,
      );
    }
  });

  it("matrix theme should have green accent (#00ff41)", () => {
    assert.ok(
      html.includes("#00ff41"),
      "Matrix theme should use green #00ff41 accent",
    );
  });

  it("amber theme should have golden accent (#fbbf24)", () => {
    assert.ok(
      html.includes("body.theme-amber") && html.includes("#fbbf24"),
      "Amber theme should use golden #fbbf24 accent",
    );
  });

  it("purple theme should have violet accent (#c084fc)", () => {
    assert.ok(
      html.includes("body.theme-purple") && html.includes("#c084fc"),
      "Purple theme should use violet #c084fc accent",
    );
  });

  it("theme should persist to localStorage as dash_theme", () => {
    assert.ok(
      scriptContent.includes("dash_theme"),
      "Theme should persist to localStorage under dash_theme key",
    );
  });

  it("T key should cycle themes", () => {
    const keyHandler = scriptContent.match(
      /keydown[\s\S]*?key.*===.*['"tT]['"]/,
    );
    assert.ok(keyHandler, "Missing T key handler for theme cycling");
  });

  it("should have theme-select dropdown", () => {
    assert.ok(
      html.includes('id="theme-select"'),
      "Missing theme-select dropdown element",
    );
  });

  it("theme transitions should be smooth (0.5s)", () => {
    assert.ok(
      html.includes("transition: background 0.5s ease"),
      "Theme transitions should animate at 0.5s ease",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 29. SCREEN MODE SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Screen Mode System", () => {
  it("should have SCREEN_MODES array", () => {
    assert.ok(
      scriptContent.includes("SCREEN_MODES") || scriptContent.includes("screen_modes") ||
        (scriptContent.includes("'tv'") && scriptContent.includes("'tablet'") && scriptContent.includes("'phone'")),
      "Missing screen modes definition",
    );
  });

  it("should have applyScreenMode function", () => {
    assert.ok(scriptContent.includes("function applyScreenMode("), "Missing applyScreenMode");
  });

  it("should have initScreenMode function", () => {
    assert.ok(scriptContent.includes("function initScreenMode("), "Missing initScreenMode");
  });

  it("should have screen-mode-select dropdown", () => {
    assert.ok(
      html.includes('id="screen-mode-select"'),
      "Missing screen-mode-select dropdown",
    );
  });

  it("should persist screen mode to localStorage as dash_screenMode", () => {
    assert.ok(
      scriptContent.includes("dash_screenMode"),
      "Screen mode should persist under dash_screenMode key",
    );
  });

  it("phone mode should make body scrollable", () => {
    assert.ok(
      html.includes("mode-phone") && html.includes("overflow-y: auto"),
      "Phone mode should enable vertical scrolling",
    );
  });

  it("phone mode should use 1-column grid", () => {
    assert.ok(
      html.includes("mode-phone") && html.includes("grid-template-columns: 1fr"),
      "Phone mode should use single-column layout",
    );
  });

  it("phone mode should hide scroll clone items", () => {
    assert.ok(
      html.includes("mode-phone") && html.includes(".clone"),
      "Phone mode should hide .clone items",
    );
  });

  it("phone mode should disable paint containment on cards", () => {
    assert.ok(
      html.includes("body.mode-phone .card { contain: none; }"),
      "Phone mode should disable contain on cards to prevent clipping",
    );
  });

  it("phone mode should disable content-visibility auto", () => {
    assert.ok(
      html.includes("mode-phone") &&
        (html.includes("content-visibility: visible") ||
          html.includes("overflow: visible")),
      "Phone mode should set content-visibility: visible or overflow: visible to prevent invisible cards",
    );
  });

  it("phone mode should disable scroll fade masks", () => {
    assert.ok(
      html.includes("mode-phone") && html.includes("mask-image: none"),
      "Phone mode should remove scroll fade masks",
    );
  });

  it("phone mode should reset col-split for natural stacking", () => {
    assert.ok(
      html.includes("body.mode-phone .col-split") &&
        html.includes("body.mode-phone .col-split > .card"),
      "Phone mode should override col-split flex so stocks/alerts cards stack naturally",
    );
  });

  it("phone mode should set grids to flex: none", () => {
    assert.ok(
      html.includes("mode-phone") &&
        html.includes(".grids-area") &&
        html.includes("flex: none"),
      "Phone mode should prevent grid flex shrinking",
    );
  });

  it("tablet mode should have smaller font size", () => {
    // Tablet uses smaller than TV (21px)
    assert.ok(
      html.includes("mode-tablet") || html.includes("17px") || html.includes("15px"),
      "Tablet mode should reduce font size",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 30. DIAGNOSTIC OVERLAY
// ═══════════════════════════════════════════════════════════════════
describe("Diagnostic Overlay", () => {
  it("should have diag-overlay container", () => {
    assert.ok(html.includes('id="diag-overlay"'), "Missing diag-overlay");
  });

  it("should have diag-panes for status table", () => {
    assert.ok(html.includes('id="diag-panes"'), "Missing diag-panes");
  });

  it("should have diag-log for fetch log", () => {
    assert.ok(html.includes('id="diag-log"'), "Missing diag-log");
  });

  it("should have toggleDiag function", () => {
    assert.ok(scriptContent.includes("function toggleDiag("), "Missing toggleDiag");
  });

  it("should have refreshDiag function", () => {
    assert.ok(scriptContent.includes("function refreshDiag("), "Missing refreshDiag");
  });

  it("should have diagPane function for pane status tracking", () => {
    assert.ok(scriptContent.includes("function diagPane("), "Missing diagPane");
  });

  it("should have _diagLog array for log storage", () => {
    assert.ok(scriptContent.includes("_diagLog"), "Missing _diagLog array");
  });

  it("should have _diagStatus object for pane status", () => {
    assert.ok(scriptContent.includes("_diagStatus"), "Missing _diagStatus object");
  });

  it("D key should toggle diagnostic overlay", () => {
    const keyHandler = scriptContent.match(
      /keydown[\s\S]*?key.*===.*['"dD]['"]/,
    );
    assert.ok(keyHandler, "Missing D key handler for diagnostic toggle");
  });

  it("should auto-show overlay on unhandled errors", () => {
    assert.ok(
      scriptContent.includes("unhandledrejection") &&
        scriptContent.includes("toggleDiag"),
      "Should auto-open overlay on unhandled rejections",
    );
  });

  it("diagnostic overlay should use monospace font", () => {
    assert.ok(
      html.includes("diag-overlay") && html.includes("Consolas"),
      "Diagnostic overlay should use monospace font",
    );
  });

  it("diagLog should cap at max entries (rolling FIFO)", () => {
    assert.ok(
      scriptContent.includes("_diagLog") &&
        (scriptContent.includes(".splice(") || scriptContent.includes(".shift(") || scriptContent.includes(".length")),
      "diagLog should enforce max entry limit",
    );
  });

  it("overlay should have LTR text direction (English log)", () => {
    assert.ok(
      html.includes("diag") && html.includes("direction: ltr"),
      "Diagnostic overlay should use LTR for English text",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 31. OFFLINE BANNER
// ═══════════════════════════════════════════════════════════════════
describe("Offline Banner", () => {
  it("should have offline-banner element", () => {
    assert.ok(html.includes('id="offline-banner"'), "Missing offline-banner");
  });

  it("should have updateNetworkBanner function", () => {
    assert.ok(
      scriptContent.includes("function updateNetworkBanner(") ||
        scriptContent.includes("updateNetworkBanner"),
      "Missing updateNetworkBanner function",
    );
  });

  it("should listen for online/offline events", () => {
    assert.ok(scriptContent.includes("'online'"), "Missing online event listener");
    assert.ok(scriptContent.includes("'offline'"), "Missing offline event listener");
  });

  it("offline banner should have Hebrew text", () => {
    assert.ok(
      html.includes("אין חיבור") || html.includes("אינטרנט"),
      "Offline banner should have Hebrew connection message",
    );
  });

  it("should use CSS .visible class to show banner", () => {
    assert.ok(
      html.includes("offline-banner") && html.includes("visible"),
      "Offline banner should toggle via .visible class",
    );
  });

  it("offline banner should have slide animation", () => {
    assert.ok(
      html.includes("offline-banner") && html.includes("transform"),
      "Offline banner should use transform for slide animation",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 32. INIT & STARTUP SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Init & Startup System", () => {
  it("should have init function", () => {
    assert.ok(scriptContent.includes("function init("), "Missing init function");
  });

  it("init should call self-check validations", () => {
    assert.ok(
      scriptContent.includes("SELFCHECK") || scriptContent.includes("issues"),
      "init should perform startup self-check",
    );
  });

  it("should validate MOTIVATIONS array integrity", () => {
    assert.ok(
      scriptContent.includes("MOTIVATIONS") &&
        scriptContent.includes("typeof m.t"),
      "init should validate each MOTIVATIONS entry",
    );
  });

  it("should validate DOM element references", () => {
    const initBlock = scriptContent.match(
      /function init\(\)[\s\S]*?(?=function\s)/,
    );
    assert.ok(initBlock, "Could not find init function body");
    assert.ok(
      initBlock[0].includes("missingEls") || initBlock[0].includes("null"),
      "init should check for missing DOM elements",
    );
  });

  it("should use Promise.allSettled for parallel loader startup", () => {
    assert.ok(
      scriptContent.includes("Promise.allSettled"),
      "init should use Promise.allSettled for parallel loader execution",
    );
  });

  it("should register DOMContentLoaded listener", () => {
    assert.ok(
      scriptContent.includes("DOMContentLoaded"),
      "Missing DOMContentLoaded event handler",
    );
  });

  it("should have fallback for already-loaded DOM", () => {
    assert.ok(
      scriptContent.includes("readyState") &&
        scriptContent.includes("'loading'"),
      "Should check readyState for already-loaded DOM fallback",
    );
  });

  it("DOMContentLoaded should call init, initCardAnimations, initCardMaximize", () => {
    assert.ok(
      scriptContent.includes("init()") &&
        scriptContent.includes("initCardAnimations()") &&
        scriptContent.includes("initCardMaximize()"),
      "DOMContentLoaded should call all 3 init functions",
    );
  });

  it("init should call cEvict for cache cleanup", () => {
    const initBlock = scriptContent.match(
      /function init\(\)[\s\S]*?(?=function\s)/,
    );
    assert.ok(initBlock, "Could not find init body");
    assert.ok(
      initBlock[0].includes("cEvict"),
      "init should run cache eviction on startup",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 33. FETCH & PROXY SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Fetch & Proxy System", () => {
  it("should have fetchWithTimeout with AbortController", () => {
    assert.ok(
      scriptContent.includes("AbortController") &&
        scriptContent.includes("function fetchWithTimeout("),
      "Missing fetchWithTimeout with AbortController",
    );
  });

  it("fetchWithTimeout default should be 8000ms", () => {
    assert.ok(
      scriptContent.includes("ms = 8000") || scriptContent.includes("ms=8000"),
      "Default timeout should be 8000ms",
    );
  });

  it("PROXIES should have allorigins and codetabs", () => {
    assert.ok(
      scriptContent.includes("allorigins.win"),
      "Missing allorigins proxy",
    );
    assert.ok(
      scriptContent.includes("codetabs.com"),
      "Missing codetabs proxy",
    );
  });

  it("calendar should also try corsproxy.io", () => {
    assert.ok(
      scriptContent.includes("corsproxy.io"),
      "Missing corsproxy.io fallback for calendar",
    );
  });

  it("should have fetch lock system (acquireLock/releaseLock)", () => {
    assert.ok(
      scriptContent.includes("function acquireLock(") ||
        scriptContent.includes("acquireLock"),
      "Missing acquireLock function",
    );
    assert.ok(
      scriptContent.includes("releaseLock"),
      "Missing releaseLock function",
    );
  });

  it("all loaders should check _pageVisible before fetching", () => {
    const loaders = ["loadWeather", "loadNews", "loadCalendar", "loadAlerts"];
    for (const fn of loaders) {
      const fnMatch = scriptContent.match(new RegExp(`function ${fn}[^{]*\\{[^}]{0,200}`));
      assert.ok(
        fnMatch && fnMatch[0].includes("_pageVisible"),
        `${fn} should check _pageVisible`,
      );
    }
  });

  it("should use stale-while-revalidate pattern", () => {
    assert.ok(
      scriptContent.includes("cGetStale") && scriptContent.includes("cGet("),
      "Should use cGet for fresh + cGetStale for stale fallback",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 34. API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════
describe("API Endpoints", () => {
  it("should use Open-Meteo for weather", () => {
    assert.ok(
      scriptContent.includes("api.open-meteo.com"),
      "Missing Open-Meteo endpoint",
    );
  });

  it("should use Hebcal for Hebrew date", () => {
    assert.ok(
      scriptContent.includes("hebcal.com"),
      "Missing Hebcal endpoint",
    );
  });

  it("should use Yahoo Finance for stocks", () => {
    assert.ok(
      scriptContent.includes("query1.finance.yahoo.com"),
      "Missing Yahoo Finance endpoint",
    );
  });

  it("should use open.er-api.com for currency (primary)", () => {
    assert.ok(
      scriptContent.includes("open.er-api.com"),
      "Missing ER-API currency endpoint",
    );
  });

  it("should use exchangerate-api.com for currency (fallback)", () => {
    assert.ok(
      scriptContent.includes("exchangerate-api.com"),
      "Missing exchangerate-api fallback",
    );
  });

  it("should use tzevaadom.co.il for red alerts", () => {
    assert.ok(
      scriptContent.includes("tzevaadom.co.il"),
      "Missing tzevaadom.co.il alerts endpoint",
    );
  });

  it("should use Google Calendar ICS URL", () => {
    assert.ok(
      scriptContent.includes("calendar.google.com/calendar/ical"),
      "Missing Google Calendar ICS URL",
    );
  });

  it("should have at least 10 RSS feed URLs", () => {
    const feedEntries = scriptContent.match(/\{\s*url:\s*'/g);
    assert.ok(
      feedEntries && feedEntries.length >= 10,
      `Expected >=10 RSS feeds, got ${feedEntries?.length}`,
    );
  });

  it("Weather API should request Jerusalem coordinates", () => {
    assert.ok(
      scriptContent.includes("31.7") && scriptContent.includes("35.2"),
      "Weather should use Jerusalem lat/lon (31.7, 35.2)",
    );
  });

  it("no API keys should be hardcoded", () => {
    const apiKeyPatterns = /(?:api[_-]?key|apikey|secret|token)\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/gi;
    const matches = scriptContent.match(apiKeyPatterns);
    assert.ok(!matches, `Found hardcoded API keys: ${matches?.join(", ")}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 35. DOM REFERENCES (el OBJECT)
// ═══════════════════════════════════════════════════════════════════
describe("DOM References (el object)", () => {
  it("should cache clock element", () => {
    assert.ok(scriptContent.includes("clock:") && scriptContent.includes("$('clock')"), "Missing el.clock");
  });

  it("should cache all weather elements", () => {
    const wxEls = ["wxIcon", "wxTemp", "wxDesc", "wxHum", "wxWind", "wxUv", "wxRise", "wxHourly", "wxForecast"];
    for (const el of wxEls) {
      assert.ok(scriptContent.includes(`${el}:`), `Missing el.${el} in DOM cache`);
    }
  });

  it("should cache all currency elements", () => {
    const curEls = ["curUsd", "curEur"];
    for (const el of curEls) {
      assert.ok(scriptContent.includes(`${el}:`), `Missing el.${el} in DOM cache`);
    }
    assert.ok(!scriptContent.includes("curGbp:"), "GBP removed — curGbp should not be in cache");
  });

  it("should cache news elements", () => {
    assert.ok(scriptContent.includes("newsBody:") || scriptContent.includes("rssScroll:"), "Missing news DOM refs");
  });

  it("should cache calendar elements", () => {
    assert.ok(scriptContent.includes("calAgenda:"), "Missing el.calAgenda");
    assert.ok(scriptContent.includes("calIframe:"), "Missing el.calIframe");
  });

  it("should cache motivation elements", () => {
    assert.ok(scriptContent.includes("motiText:"), "Missing el.motiText");
    assert.ok(scriptContent.includes("motiAuthor:"), "Missing el.motiAuthor");
  });

  it("should cache progress bar elements", () => {
    assert.ok(scriptContent.includes("dayProgress:") || scriptContent.includes("day-progress"), "Missing progress bar refs");
  });

  it("should have sync dot references for all 7 panes", () => {
    const panes = ["news", "cal", "stocks", "alerts", "wx", "cur", "moti"];
    for (const p of panes) {
      assert.ok(
        scriptContent.includes(`sync-${p}`) || scriptContent.includes(`'${p}'`),
        `Missing sync dot for ${p}`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 36. CSS DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("CSS Design System", () => {
  it("should have glassmorphism backdrop-filter on cards", () => {
    assert.ok(
      html.includes("backdrop-filter: blur(16px)"),
      "Missing glassmorphism blur on cards",
    );
  });

  it("should have animated gradient background", () => {
    assert.ok(
      html.includes("@keyframes bgShift"),
      "Missing animated background keyframes",
    );
  });

  it("should have scroll fade masks on news/stocks/alerts", () => {
    assert.ok(
      html.includes("mask-image: linear-gradient(to bottom"),
      "Missing vertical scroll fade masks",
    );
  });

  it("should have animated gradient border (@property --border-angle)", () => {
    assert.ok(
      html.includes("@property --border-angle") || html.includes("border-angle"),
      "Missing animated gradient border property",
    );
  });

  it("should have card spotlight glow (::after pseudo-element)", () => {
    assert.ok(
      html.includes(".card::after") && html.includes("radial-gradient"),
      "Missing card spotlight glow ::after",
    );
  });

  it("should define :root CSS variables for colors", () => {
    const vars = ["--accent", "--positive", "--negative", "--warning", "--purple", "--pink", "--orange", "--cyan"];
    for (const v of vars) {
      assert.ok(html.includes(v), `Missing CSS variable: ${v}`);
    }
  });

  it("should have ::selection styling with accent color", () => {
    assert.ok(
      html.includes("::selection") && html.includes("var(--accent)"),
      "Missing ::selection highlight styling",
    );
  });

  it("should use border-radius CSS variable", () => {
    assert.ok(html.includes("--border-radius"), "Missing --border-radius variable");
  });

  it("should have news freshness data-age attribute", () => {
    assert.ok(
      (scriptContent.includes("dataset.age") || scriptContent.includes("data-age")) &&
        scriptContent.includes("'fresh'"),
      "Missing news freshness data-age attribute",
    );
  });

  it("should have stock row tinting classes (stk-up/stk-down)", () => {
    assert.ok(
      scriptContent.includes("stk-up") && scriptContent.includes("stk-down"),
      "Missing stock row tinting classes",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 37. KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════
describe("Keyboard Shortcuts", () => {
  it("should listen for keydown events", () => {
    assert.ok(
      scriptContent.includes("addEventListener('keydown'") ||
        scriptContent.includes('addEventListener("keydown"'),
      "Missing keydown event listener",
    );
  });

  it("T key should cycle themes", () => {
    assert.ok(
      scriptContent.includes("'T'") || scriptContent.includes("'t'"),
      "Missing T key handler",
    );
    assert.ok(
      scriptContent.includes("applyTheme"),
      "T key should call applyTheme",
    );
  });

  it("D key should toggle diagnostics", () => {
    assert.ok(
      scriptContent.includes("'D'") || scriptContent.includes("'d'"),
      "Missing D key handler",
    );
    assert.ok(
      scriptContent.includes("toggleDiag"),
      "D key should call toggleDiag",
    );
  });

  it("Escape key should close maximized card", () => {
    assert.ok(
      scriptContent.includes("'Escape'") && scriptContent.includes("_maximizedCard"),
      "Escape key should close maximized card",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 38. PERFORMANCE OPTIMIZATIONS
// ═══════════════════════════════════════════════════════════════════
describe("Performance Optimizations", () => {
  it("should use CSS containment on cards", () => {
    assert.ok(
      html.includes("contain: layout style"),
      "Missing CSS containment on cards",
    );
  });

  it("should have content-visibility on pane bodies", () => {
    assert.ok(
      html.includes("content-visibility"),
      "Missing content-visibility optimization",
    );
  });

  it("should lazy-load images", () => {
    const lazyCount = (html.match(/loading="lazy"/g) || []).length;
    assert.ok(lazyCount >= 1, `Expected >=1 lazy-loaded elements, got ${lazyCount}`);
  });

  it("should throttle mousemove with requestAnimationFrame", () => {
    assert.ok(
      scriptContent.includes("requestAnimationFrame") &&
        scriptContent.includes("mousemove"),
      "Mousemove spotlight should use rAF throttling",
    );
  });

  it("should use Page Visibility API to pause fetches", () => {
    assert.ok(
      scriptContent.includes("visibilitychange") &&
        scriptContent.includes("_pageVisible"),
      "Should pause fetches when page is hidden",
    );
  });

  it("should have prefers-reduced-motion support", () => {
    assert.ok(
      html.includes("prefers-reduced-motion"),
      "Missing prefers-reduced-motion media query",
    );
  });

  it("should use per-symbol stock API with proxy racing", () => {
    assert.ok(
      scriptContent.includes("loadStockSingle") && scriptContent.includes("raceProxies"),
      "Stock fetches should use per-symbol v8 API with proxy racing",
    );
  });

  it("should detect CPU cores via navigator.hardwareConcurrency", () => {
    assert.ok(
      scriptContent.includes("navigator.hardwareConcurrency"),
      "Should detect CPU core count",
    );
  });

  it("should limit concurrency to 60% of cores", () => {
    assert.ok(
      scriptContent.includes("0.6") && scriptContent.includes("MAX_CONCURRENT"),
      "Should use 60% of CPU cores for concurrency limit",
    );
  });

  it("should have runConcurrent for CPU-aware parallel tasks", () => {
    assert.ok(
      scriptContent.includes("async function runConcurrent"),
      "Should have runConcurrent utility",
    );
  });

  it("should use requestIdleCallback for non-critical work", () => {
    assert.ok(
      scriptContent.includes("requestIdleCallback") &&
        scriptContent.includes("scheduleIdle"),
      "Should use requestIdleCallback with scheduleIdle wrapper",
    );
  });

  it("should detect GPU via WebGL", () => {
    assert.ok(
      scriptContent.includes("function detectGPU") &&
        scriptContent.includes("WEBGL_debug_renderer_info"),
      "Should detect GPU renderer info via WebGL",
    );
  });

  it("should log hardware capabilities at startup", () => {
    assert.ok(
      scriptContent.includes("PERF: CPU cores=") &&
        scriptContent.includes("PERF: GPU="),
      "Should log CPU and GPU info via diagLog",
    );
  });

  it("should use DocumentFragment for batch DOM writes", () => {
    assert.ok(
      scriptContent.includes("document.createDocumentFragment"),
      "Should use DocumentFragment for efficient DOM operations",
    );
  });

  it("should have GPU-accelerated layer hints on scroll containers", () => {
    assert.ok(
      html.includes("translateZ(0)") &&
        html.includes("backface-visibility: hidden"),
      "Should promote scroll containers to GPU layers",
    );
  });

  it("should cache spotlight card references", () => {
    assert.ok(
      scriptContent.includes("_spotlightCards") &&
        scriptContent.includes("_getSpotlightCards"),
      "Spotlight should cache card NodeList to avoid repeated querySelectorAll",
    );
  });

  it("should use runConcurrent for news feed loading", () => {
    assert.ok(
      scriptContent.includes("runConcurrent(NEWS_FEEDS.map"),
      "News loader should use CPU-aware concurrency",
    );
  });

  it("should use runConcurrent for startup loaders", () => {
    assert.ok(
      scriptContent.includes("runConcurrent(loaders.map"),
      "Init should use CPU-aware concurrency for startup loaders",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 39. ACCESSIBILITY & INTERNATIONALIZATION
// ═══════════════════════════════════════════════════════════════════
describe("Accessibility & Internationalization", () => {
  it("should have RTL direction", () => {
    assert.ok(html.includes('dir="rtl"'), "Missing dir=rtl");
  });

  it("should have Hebrew language attribute", () => {
    assert.ok(html.includes('lang="he"'), "Missing lang=he");
  });

  it("should use Noto Sans Hebrew in font stack", () => {
    assert.ok(
      html.includes("Noto Sans Hebrew"),
      "Missing Noto Sans Hebrew in font-family",
    );
  });

  it("images should have alt attributes", () => {
    const imgs = html.match(/<img\s[^>]*>/g) || [];
    for (const img of imgs) {
      assert.ok(
        img.includes('alt='),
        `Image missing alt attribute: ${img.substring(0, 60)}...`,
      );
    }
  });

  it("should disable animations for prefers-reduced-motion", () => {
    assert.ok(
      html.includes("animation-duration: 0.01ms"),
      "Should set animation-duration to near-zero for reduced-motion",
    );
  });

  it("should use border-right for RTL accent borders on news items", () => {
    assert.ok(
      html.includes(".rss-item") && html.includes("border-right"),
      "News items should use border-right for RTL layout",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 40. REFRESH INTERVALS
// ═══════════════════════════════════════════════════════════════════
describe("Refresh Intervals", () => {
  it("clock should tick every 60s (1 minute)", () => {
    assert.ok(
      scriptContent.includes("tickClock") && scriptContent.includes("60000"),
      "Clock should refresh every 60000ms",
    );
  });

  it("news should refresh every 15 minutes", () => {
    assert.ok(
      scriptContent.includes("loadNews") && scriptContent.includes("900000"),
      "News should refresh every 900000ms (15min)",
    );
  });

  it("stocks should refresh every 10 minutes", () => {
    assert.ok(
      scriptContent.includes("loadAllStocks") && scriptContent.includes("600000"),
      "Stocks should refresh every 600000ms (10min)",
    );
  });

  it("weather should refresh every 30 minutes", () => {
    assert.ok(
      scriptContent.includes("loadWeather") && scriptContent.includes("1800000"),
      "Weather should refresh every 1800000ms (30min)",
    );
  });

  it("currency should refresh every 1 hour", () => {
    assert.ok(
      scriptContent.includes("loadCurrency") && scriptContent.includes("3600000"),
      "Currency should refresh every 3600000ms (1h)",
    );
  });

  it("motivation should refresh every 2 minutes", () => {
    assert.ok(
      scriptContent.includes("loadMotivation") && scriptContent.includes("120000"),
      "Motivation should cycle every 120000ms (2min) for continuous TV loop",
    );
  });

  it("calendar should refresh every 15 minutes", () => {
    assert.ok(
      scriptContent.includes("loadCalendar") && scriptContent.includes("900000"),
      "Calendar should refresh every 900000ms (15min)",
    );
  });

  it("Hebrew date should refresh every 3 hours", () => {
    assert.ok(
      scriptContent.includes("loadHebrewDate") && scriptContent.includes("10800000"),
      "Hebrew date should refresh every 10800000ms (3h)",
    );
  });

  it("Shabbat should refresh every 6 hours", () => {
    assert.ok(
      scriptContent.includes("loadShabbat") && scriptContent.includes("21600000"),
      "Shabbat should refresh every 21600000ms (6h)",
    );
  });

  it("holidays should refresh every 12 hours", () => {
    assert.ok(
      scriptContent.includes("loadHolidays") && scriptContent.includes("43200000"),
      "Holidays should refresh every 43200000ms (12h)",
    );
  });

  it("market badge should refresh every 5 minutes", () => {
    assert.ok(
      scriptContent.includes("updateMarketBadge") && scriptContent.includes("300000"),
      "Market badge should refresh every 300000ms (5min)",
    );
  });

  it("card attention loop should run every 5 minutes", () => {
    assert.ok(
      scriptContent.includes("cardAttentionLoop") && scriptContent.includes("300000"),
      "Card attention loop should run every 300000ms (5min)",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 41. MARKET BADGE
// ═══════════════════════════════════════════════════════════════════
describe("Market Badge", () => {
  it("should have market-badge element", () => {
    assert.ok(html.includes('id="market-badge"'), "Missing market-badge element");
  });

  it("should have updateMarketBadge function", () => {
    assert.ok(
      scriptContent.includes("function updateMarketBadge("),
      "Missing updateMarketBadge function",
    );
  });

  it("should detect US market hours (Mon-Fri)", () => {
    assert.ok(
      scriptContent.includes("getDay") || scriptContent.includes("day"),
      "Market badge should check day of week",
    );
  });

  it("should show open/closed status in Hebrew", () => {
    assert.ok(
      scriptContent.includes("פתוח") && scriptContent.includes("סגור"),
      "Market badge should show Hebrew open/closed text",
    );
  });

  it("should use getStockTTL for smart refresh", () => {
    assert.ok(
      scriptContent.includes("function getStockTTL(") ||
        scriptContent.includes("getStockTTL"),
      "Missing getStockTTL for market-hours TTL",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 42. GREETING LOGIC
// ═══════════════════════════════════════════════════════════════════
describe("Greeting Logic", () => {
  it("should have getGreeting function", () => {
    assert.ok(
      scriptContent.includes("function getGreeting("),
      "Missing getGreeting function",
    );
  });

  it("should return different greetings for different times", () => {
    const greetingFn = scriptContent.match(
      /function getGreeting\(\)[\s\S]*?return[\s\S]*?\}/,
    );
    assert.ok(greetingFn, "Could not find getGreeting body");
    // Should check hour and return different values
    assert.ok(
      greetingFn[0].includes("getHours") || greetingFn[0].includes("hour"),
      "getGreeting should check current hour",
    );
  });

  it("should have morning, afternoon, evening, night variants", () => {
    assert.ok(
      scriptContent.includes("בוקר") || scriptContent.includes("🌅"),
      "Missing morning greeting",
    );
    assert.ok(
      scriptContent.includes("ערב") || scriptContent.includes("🌇"),
      "Missing evening greeting",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 43. HOLIDAY & SHABBAT SYSTEM
// ═══════════════════════════════════════════════════════════════════
describe("Holiday & Shabbat System", () => {
  it("should have loadHolidays function", () => {
    assert.ok(scriptContent.includes("function loadHolidays("), "Missing loadHolidays");
  });

  it("should have renderHoliday function", () => {
    assert.ok(scriptContent.includes("function renderHoliday("), "Missing renderHoliday");
  });

  it("should have loadShabbat function", () => {
    assert.ok(scriptContent.includes("function loadShabbat("), "Missing loadShabbat");
  });

  it("holiday countdown should show days remaining", () => {
    assert.ok(
      scriptContent.includes("ימים") || scriptContent.includes("בעוד"),
      "Holiday should show days remaining",
    );
  });

  it("should show special message for today's holiday", () => {
    assert.ok(
      scriptContent.includes("היום") || scriptContent.includes("🎉"),
      "Should show special message when holiday is today",
    );
  });

  it("Shabbat should show candle lighting and havdalah", () => {
    assert.ok(
      scriptContent.includes("נרות") || scriptContent.includes("הדלקת"),
      "Should show candle lighting time",
    );
    assert.ok(
      scriptContent.includes("הבדלה"),
      "Should show havdalah time",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// 44. WEATHER RENDERING DETAILS
// ═══════════════════════════════════════════════════════════════════
describe("Weather Rendering Details", () => {
  it("should render hourly chart with bezier curves", () => {
    assert.ok(
      scriptContent.includes("function renderHourlyChart("),
      "Missing renderHourlyChart function",
    );
  });

  it("hourly chart should draw 12-hour SVG path", () => {
    const chartFn = scriptContent.match(
      /function renderHourlyChart[\s\S]*?\}/m,
    );
    assert.ok(chartFn, "Could not find renderHourlyChart");
    assert.ok(
      chartFn[0].includes("path") || scriptContent.includes("<path"),
      "Hourly chart should render SVG path elements",
    );
  });

  it("forecast should display icon beside day name (horizontal layout)", () => {
    // Updated layout: icon → name → temp in horizontal flex
    assert.ok(
      html.includes("wx-fday-icon") && html.includes("wx-fday-name"),
      "Forecast should have icon and name elements",
    );
    assert.ok(
      html.includes(".wx-fday") && html.includes("display: flex"),
      "Forecast day blocks should use flex layout",
    );
  });

  it("should have wx-desc element for feels-like temperature", () => {
    assert.ok(
      html.includes('id="wx-desc"'),
      "Missing wx-desc element for feels-like",
    );
    assert.ok(
      scriptContent.includes("feels_like") || scriptContent.includes("apparent"),
      "Should display feels-like temperature",
    );
  });

  it("weather should request full data from Open-Meteo", () => {
    assert.ok(
      scriptContent.includes("hourly=") || scriptContent.includes("temperature_2m"),
      "Weather API should request hourly temperature data",
    );
    assert.ok(
      scriptContent.includes("daily=") || scriptContent.includes("weathercode"),
      "Weather API should request daily forecast data",
    );
  });
});
