/**
 * FamilyDashBoard v6 — Constants & Configuration
 *
 * All magic numbers, URLs, symbol lists, and static lookup tables
 * extracted from the monolith for type-safe reuse.
 */

// ── Cache ──
export const CACHE_TTL = 5 * 60_000; // 5 minutes
export const LS_PREFIX = "dash_v2_";
export const LS_MAX_AGE = 7 * 86_400_000; // 7 days

// ── Fetch ──
export const FETCH_TIMEOUT_MS = 8_000;
export const WAKE_REFRESH_MS = 30 * 60 * 1_000; // 30 minutes

export const PROXIES: readonly string[] = [
  "https://api.allorigins.win/get?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://corsproxy.io/",
] as const;

// ── Cloudflare Worker (Phase 4 migration target) ──
/** Base URL for the FamilyDashBoard Cloudflare Worker proxy. Set to empty string to disable. */
export const WORKER_BASE_URL = "https://fdb.rajwanyair.workers.dev";

/**
 * True when the worker is enabled (non-empty URL and we're online).
 * Cards that support worker-first fetch check this before using direct/proxy.
 */
export function isWorkerEnabled(): boolean {
  return WORKER_BASE_URL.length > 0 && navigator.onLine;
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
export const MAX_CONCURRENT = Math.max(
  2,
  Math.min(8, Math.floor(CPU_CORES * 0.6)),
);

// ── Diagnostics ──
export const DIAG_BUFFER_SIZE = 80;
export const DIAG_DISPLAY_LIMIT = 20;

// ── Refresh Intervals (ms) ──
export const INTERVALS = {
  CLOCK: 60_000,
  ALERTS_ACTIVE: 60_000,
  ALERTS_IDLE: 5 * 60_000,
  MARKET_BADGE: 60_000,
  NEWS: 15 * 60_000,
  STOCKS_OPEN: 5 * 60_000,
  STOCKS_CLOSED: 30 * 60_000,
  CALENDAR: 15 * 60_000,
  WEATHER: 30 * 60_000,
  CURRENCY: 60 * 60_000,
  HEBREW_CAL: 6 * 60 * 60_000,
  HALACHA: 12 * 60 * 60_000,
  MOTIVATION: 2 * 60_000,
} as const;

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
