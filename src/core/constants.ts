/**
 * FamilyDashBoard v7 — Constants & Configuration
 *
 * All magic numbers, URLs, symbol lists, and static lookup tables
 * extracted from the monolith for type-safe reuse.
 */

// ── Time Unit Constants ──
export const MS_PER_MIN = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

// ── Interface Language ──
export const INTERFACE_LANGUAGES = ["he", "en"] as const;
export type InterfaceLanguage = (typeof INTERFACE_LANGUAGES)[number];

// ── Cache ──
export const CACHE_TTL = 5 * MS_PER_MIN; // 5 minutes
export const LS_PREFIX = "dash_v2_";
export const LS_MAX_AGE = 3 * MS_PER_DAY; // 3 days

// ── Fetch ──
export const FETCH_TIMEOUT_MS = 8_000;
export const WAKE_REFRESH_MS = 30 * MS_PER_MIN; // 30 minutes

export const PROXIES: readonly string[] = [
  "https://api.allorigins.win/get?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://corsproxy.io/",
] as const;

// ── Cloudflare Worker (Phase 4 migration target) ──
/** Base URL for the FamilyDashBoard Cloudflare Worker proxy. Set to empty string to disable. */
export const WORKER_BASE_URL = "https://fdb.rajwanyair.workers.dev";

/**
 * True when the worker is enabled (non-empty URL, online, and NOT loading from
 * a local file:// origin — the worker's CORS policy only allows the production
 * domain so attempting it from file:// triggers an 8s timeout per request).
 * Cards that support worker-first fetch check this before using direct/proxy.
 *
 * The static conditions (URL + protocol) are cached for the session.
 * navigator.onLine is re-checked on every call so network changes are honoured.
 */
let _workerStaticOk: boolean | null = null;
export function isWorkerEnabled(): boolean {
  if (_workerStaticOk === null) {
    _workerStaticOk = WORKER_BASE_URL.length > 0 && window.location.protocol !== "file:";
  }
  return _workerStaticOk && navigator.onLine;
}

/** Reset the cached isWorkerEnabled static result (useful in tests). */
export function resetWorkerEnabledCache(): void {
  _workerStaticOk = null;
}

// ── API Endpoints (will migrate to Cloudflare Worker in Phase 4) ──
export const API = {
  WEATHER: "https://api.open-meteo.com/v1/forecast",
  HEBCAL: "https://www.hebcal.com/hebcal",
  ZMANIM: "https://www.hebcal.com/zmanim",
  SEFARIA_CALENDAR: "https://www.sefaria.org/api/calendars",
  SEFARIA_TEXT: "https://www.sefaria.org/api/v3/texts/",
  CURRENCY_PRIMARY: "https://open.er-api.com/v6/latest/ILS",
  CURRENCY_FALLBACK: "https://api.exchangerate-api.com/v4/latest/ILS",
  YAHOO_CHART: "https://query1.finance.yahoo.com/v8/finance/chart/",
  COINGECKO_BTC:
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
  ALERTS: "https://api.tzevaadom.co.il/alerts-history",
} as const;

// ── Stocks ──
export const STOCK_SYMBOLS: readonly string[] = [
  "^GSPC",
  "^VIX",
  "^TA35.TA",
  "AAPL",
  "AMZN",
  "AVGO",
  "BRK-B",
  "BTC-USD",
  "GOOGL",
  "INTC",
  "JPM",
  "META",
  "MSFT",
  "NVDA",
  "TSLA",
] as const;

export interface StockMeta {
  name: string;
  he: string;
  color: string;
  domain: string;
  /** Short display label for the .stk-sym element (defaults to the symbol key). */
  sym?: string;
  /** Override logo image URL (defaults to Google Favicons CDN via `domain`). */
  logoUrl?: string;
}

export const STOCK_META: Record<string, StockMeta> = {
  "^GSPC": {
    name: "S&P 500",
    he: "אס אנד פי 500",
    color: "#e8c07a",
    domain: "spglobal.com",
    sym: "S&P500",
  },
  "^VIX": {
    name: "VIX",
    he: "מדד הפחד",
    color: "#e07070",
    domain: "cboe.com",
    sym: "VIX",
  },
  "^TA35.TA": {
    name: "TA-35",
    he: 'ת"א 35',
    color: "#6abfcf",
    domain: "tase.co.il",
    sym: 'ת"א 35',
  },
  AAPL: { name: "Apple", he: "אפל", color: "#a2aaad", domain: "apple.com" },
  AMZN: { name: "Amazon", he: "אמזון", color: "#ff9900", domain: "amazon.com" },
  AVGO: {
    name: "Broadcom",
    he: "ברודקום",
    color: "#cc092f",
    domain: "broadcom.com",
  },
  "BRK-B": {
    name: "Berkshire",
    he: "ברקשייר",
    color: "#002858",
    domain: "berkshirehathaway.com",
  },
  "BTC-USD": {
    name: "Bitcoin",
    he: "ביטקוין",
    color: "#f7931a",
    domain: "bitcoin.org",
    sym: "BTC",
    logoUrl: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
  },
  GOOGL: {
    name: "Alphabet",
    he: "גוגל",
    color: "#4285f4",
    domain: "google.com",
  },
  INTC: { name: "Intel", he: "אינטל", color: "#0068b5", domain: "intel.com" },
  JPM: {
    name: "JPMorgan",
    he: "ג'יי.פי מורגן",
    color: "#003087",
    domain: "jpmorganchase.com",
  },
  META: { name: "Meta", he: "מטא", color: "#1877f2", domain: "meta.com" },
  MSFT: {
    name: "Microsoft",
    he: "מיקרוסופט",
    color: "#00a4ef",
    domain: "microsoft.com",
  },
  NVDA: {
    name: "NVIDIA",
    he: "אנבידיה",
    color: "#76b900",
    domain: "nvidia.com",
  },
  TSLA: { name: "Tesla", he: "טסלה", color: "#cc0000", domain: "tesla.com" },
};

// ── Weather Codes ──
export const WX_CODES: Record<number, string> = {
  0: "שמיים בהירים",
  1: "בהיר בעיקר",
  2: "מעונן חלקית",
  3: "מעונן",
  45: "ערפל",
  48: "ערפל קפוא",
  51: "טפטוף קל",
  53: "טפטוף",
  55: "טפטוף כבד",
  56: "טפטוף קפוא",
  57: "טפטוף קפוא כבד",
  61: "גשם קל",
  63: "גשם",
  65: "גשם כבד",
  66: "גשם קפוא",
  67: "גשם קפוא כבד",
  71: "שלג קל",
  73: "שלג",
  75: "שלג כבד",
  77: "גרגירי שלג",
  80: "ממטר קל",
  81: "ממטר",
  82: "ממטר כבד",
  85: "שלג קל",
  86: "שלג כבד",
  95: "סופת רעמים",
  96: "סופת ברד",
  99: "סופת ברד כבדה",
};

export const WX_EMOJI: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌧️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  77: "🌨️",
  80: "🌦️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

// ── Concurrency ──
export const CPU_CORES =
  typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 4) : 4;
export const MAX_CONCURRENT = Math.max(2, Math.min(8, Math.floor(CPU_CORES * 0.6)));

// ── Diagnostics ──
export const DIAG_BUFFER_SIZE = 80;
export const DIAG_DISPLAY_LIMIT = 20;

// ── Refresh Intervals (ms) ──
export const INTERVALS = {
  CLOCK: MS_PER_MIN,
  ALERTS_ACTIVE: MS_PER_MIN,
  ALERTS_IDLE: 5 * MS_PER_MIN,
  MARKET_BADGE: MS_PER_MIN,
  NEWS: 15 * MS_PER_MIN,
  STOCKS_OPEN: 5 * MS_PER_MIN,
  STOCKS_CLOSED: 30 * MS_PER_MIN,
  CALENDAR: 15 * MS_PER_MIN,
  WEATHER: 30 * MS_PER_MIN,
  CURRENCY: MS_PER_HOUR,
  HEBREW_CAL: 6 * MS_PER_HOUR,
  HALACHA: 12 * MS_PER_HOUR,
  DAY: MS_PER_DAY,
  MOTIVATION: 2 * MS_PER_MIN,
} as const;

// ── localStorage Keys (canonical — modules must import, not redefine) ──
// Shared keys are prefixed dash_v2_ (versioned) or dash_ (legacy)
export const LS_DIM_START = "dash_v2_dim_start";
export const LS_DIM_END = "dash_v2_dim_end";
export const LS_TICKER_MSG = "dash_v2_ticker_msg";
export const LS_CITY_1 = "dash_v2_city_1";
export const LS_CITY_2 = "dash_v2_city_2";
export const LS_CITY_3 = "dash_v2_city_3";
export const LS_HOME_LAT = "dash_v2_home_lat";
export const LS_HOME_LON = "dash_v2_home_lon";
export const LS_HOME_NAME = "dash_v2_home_name";
export const LS_NEWS_FONT = "dash_v2_news_fontsize";
export const LS_STOCK_ALERTS = "dash_v2_stock_alerts";
export const LS_PORTFOLIO = "dash_v2_portfolio";
export const LS_NEWS_VISITED = "dash_visited_news";
export const LS_NEWS_BOOKMARKS = "dash_bookmarks";
export const LS_CUR_HISTORY = "dash_v2_cur_history";
export const LS_THEME = "dash_theme";
export const LS_COLLAPSED = "dash_v2_collapsed_cards";
export const LS_WX_CHART_MODE = "dash_wx_chart_mode";
export const LS_TASKS_DONE = "dash_tasks_done";
export const LS_TASKS_RESET = "dash_tasks_reset_date";
export const LS_CHORES = "dash_chores";
export const LS_CUSTOM_PROXY = "dash_custom_proxy";
export const LS_ICS_URL = "dash_ics_url";
export const LS_CONFIG = "dash_v2_config";

// ── Themes (single source of truth for theme names) ──
export const THEMES = ["black", "blue", "matrix", "amber", "purple", "rose"] as const;
export type ThemeName = (typeof THEMES)[number];

// ── Screen Modes ──
export const SCREEN_MODES = ["tv", "tablet", "phone"] as const;
export type ScreenModeName = (typeof SCREEN_MODES)[number];

// ── Threat Labels (Alerts) ──
export const THREAT_LABELS: Record<number, string> = {
  0: "🚀 ירי רקטות",
  1: "🚀 ירי רקטות",
  5: "✈️ כלי טיס עוין",
};

// ── Currency Tiles ──
export interface CurrencyTile {
  label: string;
  key: string;
  icon: string;
  precision: number;
}

export const CUR_TILES: readonly CurrencyTile[] = [
  { label: "USD", key: "USD", icon: "$", precision: 3 },
  { label: "EUR", key: "EUR", icon: "€", precision: 3 },
  { label: "GBP", key: "GBP", icon: "£", precision: 3 },
  { label: "Gold", key: "XAU", icon: "🥇", precision: 0 },
  { label: "Silver", key: "XAG", icon: "🥈", precision: 1 },
] as const;
