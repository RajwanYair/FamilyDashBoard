/* ═══════════════════════════════════════════════════════════════
   FAMILY DASHBOARD v5.1.0 — 3-Column Layout · Hebrew Calendar Card · Warm Themes · Bilingual UI
   ═══════════════════════════════════════════════════════════════ */

// ── Config ──
const CACHE_TTL = 5 * 60000;
// ── CORS Proxy list (runtime-mutable — custom proxy prepended at init) ──
// NOTE: Browser/system-level HTTP proxies are used automatically by fetch().
// This list is for CORS bypass proxies only (needed for cross-origin API calls).
// CORS bypass proxies — browser/system HTTP proxy is used automatically by fetch().
// These are for cross-origin API access only.
const PROXIES = ['https://api.allorigins.win/get?url=','https://api.codetabs.com/v1/proxy?quest=','https://corsproxy.io/?'];
const STOCK_SYMBOLS = ['^GSPC','^VIX','^TA35.TA','AAPL','AMZN','AVGO','BRK-B','BTC-USD','GOOGL','INTC','JPM','META','MSFT','NVDA','TSLA'];

// F94: configurable Hebcal geonameid (default: 281184 = Jerusalem)
function getGeonameid() { return localStorage.getItem('dash_geonameid') || '281184'; }

// F93: inject configurable home city into WX_CITIES
function injectHomeCity() {
    const lat = parseFloat(localStorage.getItem('dash_home_lat'));
    const lon = parseFloat(localStorage.getItem('dash_home_lon'));
    const name = localStorage.getItem('dash_home_name') || 'ביתי';
    if (!isNaN(lat) && !isNaN(lon)) {
        WX_CITIES.home = { lat, lon, name };
        // Inject a tab into the weather city-tabs bar if not already present
        const tabs = document.getElementById('wx-city-tabs');
        if (tabs && !tabs.querySelector('[data-city="home"]')) {
            const btn = document.createElement('button');
            btn.className = 'wx-city-tab';
            btn.dataset.city = 'home';
            btn.dataset.lat = String(lat);
            btn.dataset.lon = String(lon);
            btn.textContent = name;
            tabs.insertBefore(btn, tabs.firstChild);
            btn.addEventListener('click', () => switchWxCity('home'));
        }
        // If home was last selected city, restore it
        if (_wxCityKey === 'home') switchWxCity('home');
    }
}

// F95: news feed disable filter
function getActiveFeeds() {
    const dis = (localStorage.getItem('dash_feed_disabled') || '').split(',').map(s => s.trim()).filter(Boolean);
    return dis.length ? NEWS_FEEDS.filter(f => !dis.includes(f.src)) : NEWS_FEEDS;
}

// F96: apply hidden stocks (hide .stk elements for configured symbols)
function applyHiddenStocks() {
    const hidden = (localStorage.getItem('dash_stocks_hidden') || '').split(',').map(s => s.trim()).filter(Boolean);
    STOCK_SYMBOLS.forEach(sym => {
        const blk = document.querySelector(`[data-symbol="${sym}"]`);
        if (blk) blk.style.display = hidden.includes(sym) ? 'none' : '';
    });
}
const WX_CODES = {0:'שמיים בהירים',1:'בהיר בעיקר',2:'מעונן חלקית',3:'מעונן',45:'ערפל',48:'ערפל קפוא',51:'טפטוף קל',53:'טפטוף בינוני',55:'טפטוף כבד',61:'גשם קל',63:'גשם בינוני',65:'גשם כבד',71:'שלג קל',73:'שלג בינוני',75:'שלג כבד',80:'ממטרים קלים',81:'ממטרים בינוניים',82:'ממטרים כבדים'};
const WX_EMOJI = {0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌧️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'🌨️',73:'🌨️',75:'❄️',80:'🌦️',81:'🌧️',82:'⛈️'};
// R5.7: Unified stock metadata — brand color, favicon domain, Hebrew name
const STOCK_META = {
    '^GSPC':    { color: '#1a56db', domain: 'spglobal.com',          name: 'S&P 500 — מדד' },
    '^VIX':     { color: '#e85d04', domain: 'cboe.com',             name: 'מדד הפחד — תנודתיות' },
    '^TA35.TA': { color: '#003876', domain: 'tase.co.il',           name: 'ת"א 35 — בורסה' },
    'AAPL':     { color: '#a3a3a3', domain: 'apple.com',            name: 'אפל — צרכן' },
    'AMZN':     { color: '#ff9900', domain: 'amazon.com',           name: 'אמזון — פלטפורמה' },
    'AVGO':     { color: '#cc0000', domain: 'broadcom.com',         name: 'ברודקום — שבבים' },
    'BRK-B':    { color: '#7b5ea7', domain: 'berkshirehathaway.com', name: 'ברקשייר — בופט' },
    'BTC-USD':  { color: '#f7931a', domain: 'bitcoin.org',          name: 'ביטקוין — קריפטו' },
    'GOOGL':    { color: '#4285f4', domain: 'google.com',           name: 'אלפבית — טכנולוגיה' },
    'INTC':     { color: '#0071c5', domain: 'intel.com',            name: 'אינטל — שבבים' },
    'JPM':      { color: '#004b87', domain: 'jpmorgan.com',         name: 'ג.פ.מורגן — בנקאות' },
    'META':     { color: '#0866ff', domain: 'meta.com',             name: 'מטא — רשתות' },
    'MSFT':     { color: '#00a4ef', domain: 'microsoft.com',        name: 'מיקרוסופט — תוכנה' },
    'NVDA':     { color: '#76b900', domain: 'nvidia.com',           name: 'נבידיה — AI/GPU' },
    'TSLA':     { color: '#e82127', domain: 'tesla.com',            name: 'טסלה — רכב חשמלי' },
};
// Backward-compat alias used by tests
const STOCK_NAMES = Object.fromEntries(Object.entries(STOCK_META).map(([k, v]) => [k, v.name]));
const MOTIVATIONS = [
    {t:'הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו.',a:'אברהם לינקולן'},
    {t:'אל תפחד להיכשל. פחד שלא תנסה.',a:'רוי ט. בנט'},
    {t:'כל יום הוא הזדמנות חדשה לשנות את חייך.',a:''},
    {t:'הצלחה היא לא סופית, כישלון הוא לא קטלני: האומץ להמשיך הוא מה שחשוב.',a:'וינסטון צ\'רצ\'יל'},
    {t:'תאמין שאתה יכול ואתה כבר באמצע הדרך.',a:'תיאודור רוזוולט'},
    {t:'החיים הם 10% מה שקורה לך ו-90% איך אתה מגיב.',a:'צ\'ארלס סווינדול'},
    {t:'הדרך של אלף מיל מתחילה בצעד אחד.',a:'לאו דזה'},
    {t:'המחר שייך לאלה שמתכוננים אליו היום.',a:'מלקולם איקס'},
    {t:'אל תמדוד את עצמך במה שהשגת, אלא במה שהיית צריך להשיג עם היכולות שלך.',a:'ג\'ון וודן'},
    {t:'כשאתה חושב שאתה לא יכול, תזכור למה התחלת.',a:''},
    {t:'אין מעלית להצלחה. אתה צריך לקחת את המדרגות.',a:'זיג זיגלר'},
    {t:'הזמן הטוב ביותר לשתול עץ היה לפני 20 שנה. הזמן הטוב ביותר השני הוא עכשיו.',a:'פתגם סיני'},
    {t:'לא משנה כמה לאט אתה הולך, כל עוד אתה לא עוצר.',a:'קונפוציוס'},
    {t:'תעשה היום את מה שאחרים לא רוצים, ומחר תעשה את מה שאחרים לא יכולים.',a:'ג\'רי רייס'},
    {t:'אופטימיות היא האמונה שמובילה להישגים. שום דבר לא יכול להיעשות בלי תקווה ואמונה.',a:'הלן קלר'},
    {t:'המשפחה היא לא דבר חשוב. המשפחה היא הכל.',a:'מייקל ג\'יי פוקס'},
    {t:'השינוי הוא חוק החיים. ואלה שמסתכלים רק על העבר או ההווה בטוח יפסידו את העתיד.',a:'ג\'ון פ. קנדי'},
    {t:'החוזק לא בא ממה שאתה יכול לעשות. הוא בא מהתגברות על מה שחשבת שלא תוכל.',a:'ריקי רוג\'רס'},
    {t:'הבית הוא המקום שבו המשפחה נמצאת.',a:''},
    {t:'כל מה שאתה יכול לדמיין הוא אמיתי.',a:'פבלו פיקאסו'},
    {t:'ההבדל בין רגיל למיוחד הוא אותו דבר קטן נוסף.',a:'ג\'ימי ג\'ונסון'},
    {t:'אל תחכה. העיתוי לעולם לא יהיה מושלם.',a:'נפוליאון היל'},
    {t:'הסוד של ההתקדמות הוא להתחיל.',a:'מארק טוויין'},
    {t:'מי שמעז לחלום ומאמין בחלומו — כל העולם הוא שלו.',a:''},
    {t:'אתה לא צריך להיות מושלם כדי להיות מדהים.',a:''},
    {t:'החיים קצרים מדי כדי לקום בבוקר עם צער.',a:''},
    {t:'תן לחיוך שלך לשנות את העולם, אבל אל תתן לעולם לשנות את החיוך שלך.',a:''},
    {t:'כשגשם יורד, חפש קשתות. כשחושך, חפש כוכבים.',a:'אוסקר ויילד'},
    {t:'הדבר היחיד שעומד בינך לבין החלום שלך הוא הרצון לנסות.',a:'ג\'ואל בראון'},
    {t:'ברגע שתאמין שכל דבר אפשרי, תגלה שכל דבר אפשרי.',a:''},
    {t:'כל בוקר שאתה קם הוא ניצחון קטן. תחגוג אותו.',a:''},
    {t:'אל תשווה את הפרק שלך לאמצע של הפרק של מישהו אחר.',a:''},
    {t:'האנשים שמשגשגים לא חיכו לתנאים מושלמים — הם יצרו אותם.',a:''},
    {t:'כוחך לא נמדד בכמה פעמים נפלת, אלא בכמה פעמים קמת.',a:''},
    {t:'מה שמרגיש בלתי אפשרי היום יהיה הסיפור שתספר מחר.',a:''},
    {t:'הצמיחה מתחילה בגבול אזור הנוחות שלך.',a:''},
    {t:'לא כל הימים יהיו טובים, אבל יש טוב בכל יום.',a:''},
    {t:'אל תוותר על חלום רק בגלל שהזמן שייקח להגשמתו.',a:''},
    {t:'כל מומחה פעם היה מתחיל שלא ידע דבר.',a:'הלן הייז'},
    {t:'המחסום הגדול ביותר להצלחה הוא הפחד מהכישלון.',a:'סוון גוואן'},
    {t:'עשה זאת בפחד אם צריך, אבל עשה זאת.',a:''},
    {t:'אתה חזק יותר ממה שאתה חושב, ועמיד יותר ממה שאתה יודע.',a:''},
    {t:'עתידך נוצר על ידי מה שאתה עושה היום, לא מחר.',a:'רוברט קיוסאקי'},
    {t:'כשאתה עייף, למד לנוח — לא לוותר.',a:''},
    {t:'הצלחה היא סכום של מאמצים קטנים שחוזרים על עצמם יום אחרי יום.',a:'רוברט קוליר'},
    {t:'תתחיל מאיפה שאתה, תשתמש במה שיש לך, תעשה מה שאתה יכול.',a:'ארתור אש'},
    {t:'לא הנסיבות מעצבות אותנו, אלא ההחלטות שאנחנו מקבלים.',a:'טוני רובינס'},
    {t:'החיים לא מחכים — אתה זה שצריך להתחיל.',a:''},
    {t:'מה שאתה שם בראשך כשהדברים קשים — זה מה שקובע.',a:''},
    {t:'יש לך בדיוק את הכוח שדרוש לך כדי ליצור את החיים שאתה רוצה.',a:''},
];
// F146: Start at same quote each day (day-of-year offset), not random
let motiIdx = Math.floor(Date.now() / 86400000) % MOTIVATIONS.length;
let _todaySunset = null;   // stored from weather data; used by Omer counter
let _todaySunrise = null;  // stored from weather data; used by auto-night theme
let _candleDate = null;    // next candle lighting Date; used by Shabbat countdown
let _tempUnit = localStorage.getItem('dash_tempUnit') || 'C'; // °C or °F
let _autoTheme = localStorage.getItem('dash_autoTheme') !== 'off'; // auto night theme (on by default)
let _themeBeforeDark = null; // saved theme before auto-switch to black
let _shabbatMode = false;     // true during Shabbat hours (candles → havdalah)
let _shabbatEnd = null;       // havdalah Date; used to exit shabbat mode
let _lastHiddenAt = null;     // timestamp when tab became hidden (for smart wake-refresh)
let _psalmLoaded = false;     // prevent re-fetching psalm of the day each minute
let _aliyotLoaded = false;    // prevent re-fetching parasha aliyot opener each refresh

/** Family birthdays — add entries as { name, month (1-12), day (1-31) } */
const BIRTHDAYS = [
    // Example: { name: 'יאיר', month: 6, day: 15 },
];

/** Curated landscape images — cycled every 30 min as background */
const BG_IMAGES = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80', // Yosemite valley
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80', // Alpine meadow
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80', // Forest fog
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80', // Snowy mountain night
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80', // Rainforest path
    'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1920&q=80', // Lavender fields
    'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1920&q=80', // Desert dunes
    'https://images.unsplash.com/photo-1434725039720-aeaee43d5901?w=1920&q=80', // Tropical beach
];

// ── Persistent Cache (localStorage + in-memory) ──
// Data survives page loads — each pane refreshes independently, network failures show stale data
const _mem = new Map();
const LS_PREFIX = 'dash_v2_';
const LS_MAX_AGE = 7 * 86400000; // Evict entries older than 7 days

/** Evict old localStorage entries on startup */
function cEvict() {
    try {
        const now = Date.now();
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (!k?.startsWith('dash_')) continue;
            // Remove old v1 entries (no version prefix)
            if (k.startsWith('dash_') && !k.startsWith(LS_PREFIX)) { localStorage.removeItem(k); continue; }
            try { const p = JSON.parse(localStorage.getItem(k)); if (now - p.ts > LS_MAX_AGE) localStorage.removeItem(k); } catch (_) { localStorage.removeItem(k); }
        }
    } catch (_) {}
}

/** Get cached data if fresh (within TTL) */
function cGet(key, ttl) {
    ttl = ttl || CACHE_TTL;
    const m = _mem.get(key);
    if (m && Date.now() - m.ts < ttl) return m.d;
    try {
        const s = localStorage.getItem(LS_PREFIX + key);
        if (s) { const p = JSON.parse(s); if (Date.now() - p.ts < ttl) { _mem.set(key, p); return p.d; } }
    } catch (_) {}
    return null;
}

/** Get cached data even if expired — last-known-good fallback */
function cGetStale(key) {
    const m = _mem.get(key);
    if (m) return m.d;
    try {
        const s = localStorage.getItem(LS_PREFIX + key);
        if (s) { const p = JSON.parse(s); _mem.set(key, p); return p.d; }
    } catch (_) {}
    return null;
}

/** Store data in both memory and localStorage */
function cSet(key, data) {
    const entry = { d: data, ts: Date.now() };
    _mem.set(key, entry);
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry)); } catch (_) {}
}

// ── Fetch Lock (prevent duplicate concurrent requests per pane) ──
const _fetchLocks = new Set();
function acquireLock(name) { if (_fetchLocks.has(name)) return false; _fetchLocks.add(name); return true; }
function releaseLock(name) { _fetchLocks.delete(name); }

// ── CPU Concurrency Control ──
// Use 60% of available logical cores (min 2, max 8) for parallel work
const CPU_CORES = navigator.hardwareConcurrency || 4;
const MAX_CONCURRENT = Math.max(2, Math.min(8, Math.floor(CPU_CORES * 0.6)));

/** Run async tasks with concurrency limit (CPU-aware throttle) */
async function runConcurrent(tasks, limit = MAX_CONCURRENT) {
    const results = [];
    const executing = new Set();
    for (const task of tasks) {
        const p = Promise.resolve().then(task);
        results.push(p);
        executing.add(p);
        const cleanup = () => executing.delete(p);
        p.then(cleanup, cleanup);
        if (executing.size >= limit) await Promise.race(executing);
    }
    return Promise.allSettled(results);
}

/** Defer non-critical work to idle periods (CPU-friendly scheduling) */
const scheduleIdle = window.requestIdleCallback
    ? (fn, timeout = 2000) => requestIdleCallback(fn, { timeout })
    : (fn) => setTimeout(fn, 50);

// ── GPU Detection & Renderer Info (diagnostic) ──
function detectGPU() {
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return { gpu: 'unknown', renderer: 'no WebGL' };
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return { gpu: vendor, renderer };
    } catch (_) { return { gpu: 'unknown', renderer: 'detection failed' }; }
}

// ── Page Visibility (pause fetches when tab is hidden; smart wake-refresh after 30min) ──
const WAKE_REFRESH_MS = 30 * 60 * 1000; // 30 minutes
let _pageVisible = true;
document.addEventListener('visibilitychange', () => {
    _pageVisible = !document.hidden;
    if (document.hidden) {
        _lastHiddenAt = Date.now();
    } else if (_lastHiddenAt && (Date.now() - _lastHiddenAt) > WAKE_REFRESH_MS) {
        // Hidden for > 30 min — force full refresh on wake
        diagLog('Wake-refresh triggered after ' + Math.round((Date.now() - _lastHiddenAt) / 60000) + 'min hidden');
        _lastHiddenAt = null;
        // Stagger loaders to avoid thundering herd
        setTimeout(() => { safeLoad(loadWeather); }, 200);
        setTimeout(() => { safeLoad(loadNews); }, 600);
        setTimeout(() => { safeLoad(loadAllStocks); safeLoad(loadCurrency); }, 1000);
        setTimeout(() => { safeLoad(loadCalendar); safeLoad(loadHebCal); stampRefresh(); }, 1400);
    } else {
        _lastHiddenAt = null;
    }
});

// ── Network Status Detection ──
let _wasOffline = false; // F105: track offline→online transition for auto-refresh
function updateNetworkBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (navigator.onLine) {
        _recordOnlineTime(); // F90: record last-online timestamp
        banner.classList.remove('visible');
        // F105: Auto-refresh all stale panes on network reconnect
        if (_wasOffline) {
            _wasOffline = false;
            diagLog('Network reconnected — refreshing all panes');
            setTimeout(() => {
                safeLoad(loadWeather);
                safeLoad(loadNews);
                safeLoad(loadAllStocks);
                safeLoad(loadCurrency);
                safeLoad(loadHebCal);
            }, 1500);
        }
    } else {
        _wasOffline = true;
        const ageStr = _getOfflineCacheAgeStr();
        banner.innerHTML = `⚠️ אין חיבור לאינטרנט — מציג נתונים מהמטמון${ageStr ? ` <span class="offline-age">${ageStr}</span>` : ''}`;
        banner.classList.add('visible');
    }
}
window.addEventListener('online', updateNetworkBanner);
window.addEventListener('offline', updateNetworkBanner);

// ── Animated Number Update (smooth digit transition) ──
function animateNumber(el, newText) {
    if (!el || el.textContent === newText) return;
    el.classList.add('num-transition', 'updating');
    setTimeout(() => {
        el.textContent = newText;
        el.classList.remove('updating');
    }, 200);
}

// ── Exponential Backoff for Failed Fetches ──
const _backoff = {};
function recordFailure(key) {
    const b = _backoff[key] || { count: 0, ts: Date.now() };
    b.count++; b.ts = Date.now();
    _backoff[key] = b;
}
function recordSuccess(key) { delete _backoff[key]; }

// ── Uptime Tracker ──
const _startTime = Date.now();
function getUptime() {
    const s = Math.floor((Date.now() - _startTime) / 1000);
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Sync Dot Burst (visual feedback on successful refresh) ──
function syncBurst(name) {
    const dot = sync[name];
    if (!dot) return;
    dot.classList.remove('just-synced');
    void dot.offsetWidth;
    dot.classList.add('just-synced');
}

// ── Card Spotlight (mouse-follow glow) — throttled with rAF, cached card list ──
let _rafSpotlight = 0;
let _spotlightCards = null;
function _getSpotlightCards() {
    if (!_spotlightCards) _spotlightCards = document.querySelectorAll('.card');
    return _spotlightCards;
}
document.addEventListener('mousemove', e => {
    if (_rafSpotlight) return;
    _rafSpotlight = requestAnimationFrame(() => {
        const cards = _getSpotlightCards();
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
            card.style.setProperty('--mouse-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
        }
        _rafSpotlight = 0;
    });
});

// ── DOM Refs ──
const $ = id => document.getElementById(id);
const el = {
    clock: $('clock'), engDate: $('english-date'), hebDate: $('hebrew-date'),
    greeting: $('greeting'), topTemp: $('top-temp'),
    wxIcon: $('wx-icon'), wxTemp: $('wx-temp'), wxDesc: $('wx-desc'),
    wxHum: $('wx-hum'), wxWind: $('wx-wind'), wxUv: $('wx-uv'),
    wxRise: $('wx-rise'), wxHourly: $('wx-hourly'), wxForecast: $('wx-forecast'),
    wxFeels: $('wx-feels'),
    newsBody: $('news-body'), rssScroll: $('rss-scroll'), ticker: $('ticker-content'),
    newsCount: $('news-count'),
    curUsd: $('cur-usd'), curEur: $('cur-eur'),
    curUsdChg: $('cur-usd-chg'), curEurChg: $('cur-eur-chg'),
    curGold: $('cur-gold'), curSilver: $('cur-silver'),
    curGoldChg: $('cur-gold-chg'), curSilverChg: $('cur-silver-chg'),
    motiText: $('moti-text'), motiAuthor: $('moti-author'), motiSrc: $('moti-src'),
    alertsScroll: $('alerts-scroll'),
    refresh: $('last-refresh'), marketBadge: $('market-badge'),
    dayProgress: $('day-progress'), yearProgress: $('year-progress'),
    dayPct: $('day-pct'), yearPct: $('year-pct'),
    calAgenda: $('cal-agenda'), calIframe: $('cal-iframe'),
    calCountdown: $('cal-countdown'),
    omerCount: $('omer-count'),
    hcCandles: $('hc-candles'), hcHavdala: $('hc-havdala'),
    hcHoliday: $('hc-holiday'), hcSpecial: $('hc-special'),
    hcHolidayRow: $('hc-holiday-row'), hcSpecialRow: $('hc-special-row'),
    hcSaying: $('hc-saying'),
    hcCountdown: $('hc-countdown'), hcCountdownRow: $('hc-countdown-row'),
    hcParasha: $('hc-parasha'), hcParashaRow: $('hc-parasha-row'),
    hcParashaRef: $('hc-parasha-ref'),
    hcAliyot: $('hc-aliyot'), hcAliyotRow: $('hc-aliyot-row'),
    hcDaf: $('hc-daf'), hcDafRow: $('hc-daf-row'),
    hcPsalm: $('hc-psalm'), hcPsalmRow: $('hc-psalm-row'),
    hcMoon: $('hc-moon'),
    hcEvent: $('hc-event'), hcEventRow: $('hc-event-row'),
    hcHalacha: $('hc-halacha'), hcHalachaRow: $('hc-halacha-row'),
    zmanimSection: $('zmanim-section'), zmanimGrid: $('zmanim-grid'),
    hcBirthday: $('hc-birthday'),
    hcSchool: $('hc-school'), hcSchoolRow: $('hc-school-row'),
    hcChore: $('hc-chore'), hcChoreRow: $('hc-chore-row'),
    helpOverlay: $('help-overlay'),
    elecBadge: $('elec-badge'),
    hdrEventCount: $('header-event-count'),
    connIndicator: $('conn-indicator'),
    // Sprint 8 additions
    curGbp: $('cur-gbp'), curGbpChg: $('cur-gbp-chg'),
    hcParashaProgressRow: $('hc-parasha-progress-row'),
    hcParashaProgressFill: $('hc-parasha-progress-fill'),
    hdrShabbatPill: $('header-shabbat-pill'),
    // Sprint 11 additions (F101-F110)
    headerBirthdayChip: $('header-birthday-chip'),
    headerNextZman: $('header-next-zman'),
    newsSearch: $('news-search'),
    newsSearchClear: $('news-search-clear'),
    newsSearchCount: $('news-search-count'),
    wxWindHeb: $('wx-wind-heb'),
    notifBell: $('notif-bell'),           // F114
    alertsBadge: $('alerts-badge-count'), // F116
    wxChartToggle: $('wx-chart-toggle'),  // F128
    headerPortfolioPl: $('header-portfolio-pl'), // F132
    headerCountdown: $('header-countdown'),       // F139
    motiShareBtn: $('moti-share-btn'),            // F135
    printDatetime: $('print-datetime'),           // F140
    wxDew: $('wx-dew'),             // F142
    wxGust: $('wx-gust'),           // F143
    wxWeekSummary: $('wx-week-summary'), // F148
    motiNextBtn: $('moti-next-btn'), // F146
    // Sprint 16 additions (F151-F160)
    hcOmerRow: $('hc-omer-row'),         // F151
    wxMinMax: $('wx-minmax'),            // F158
    stkSummary: $('stk-summary'),        // F155
    calTodayStrip: $('cal-today-strip'), // F154
    newsBkmPill: $('news-bkm-pill'),     // F156
    halachaOverlay: $('halacha-overlay'), // F157
    halachaOverlayRef: $('halacha-overlay-ref'), // F157
    halachaOverlayText: $('halacha-overlay-text'), // F157
    // Sprint 17 additions (F161-F170)
    btnInstall: $('btn-install'),                   // F165
};
const sync = { news: $('sync-news'), cal: $('sync-cal'), stocks: $('sync-stocks'), alerts: $('sync-alerts'), wx: $('sync-wx'), cur: $('sync-cur'), hebcal: $('sync-hebcal') };
const setSync = (s, v) => { const d = sync[s]; if (!d) return; d.className = 'sync-dot'; if (v === 'syncing') d.classList.add('syncing'); else if (v === 'error') d.classList.add('error'); };

// ── Fetch Helpers ──
async function fetchJSON(url) {
    const short = url.split('?')[0].split('/').slice(-2).join('/');
    try { const r = await fetch(url); if (r.ok) { diagLog(`fetchJSON direct OK: ${short}`); return await r.json(); } } catch (_) {}
    const _customProxy = localStorage.getItem('dash_custom_proxy');
    const _proxies = _customProxy ? [_customProxy, ...PROXIES] : PROXIES;
    for (const p of _proxies) {
        const pName = p.includes('allorigins') ? 'allorigins' : p.includes('codetabs') ? 'codetabs' : p.includes('corsproxy') ? 'corsproxy' : 'custom';
        try {
            const r = await fetch(p + encodeURIComponent(url));
            if (!r.ok) { diagLog(`fetchJSON ${pName} ${r.status}: ${short}`); continue; }
            if (p.includes('allorigins')) { const w = await r.json(); diagLog(`fetchJSON ${pName} OK: ${short}`); return JSON.parse(w.contents); }
            else { const t = await r.text(); diagLog(`fetchJSON ${pName} OK: ${short}`); try { return JSON.parse(t); } catch { return { text: t }; } }
        } catch (e) { diagLog(`fetchJSON ${pName} ERR: ${short} — ${e.message}`); continue; }
    }
    throw new Error('All fetch attempts failed: ' + short);
}
// ── Clock & Greeting ──
function getGreeting() {
    const fn = localStorage.getItem('dash_family_name') || 'רגואן';
    const members = getMembers(); // F118
    const h = new Date().getHours();
    // Rotate through members by day of month so different person is greeted each day
    const idx = (new Date().getDate() - 1) % Math.max(members.length, 1);
    const greetPerson = members.length > 0 ? members[idx] : null;
    const suffix = greetPerson ? greetPerson + '!' : 'למשפחת ' + fn + '!';
    if (h >= 5 && h < 12)  return '🌅 בוקר טוב ' + suffix;
    if (h >= 12 && h < 17) return '☀️️ צהריים טובים!';
    if (h >= 17 && h < 21) return '🌆 ערב טוב ' + suffix;
    return '🌙 לילה טוב!';
}
function tickClock() {
    const now = new Date();
    // F89: show seconds when _clockSec mode is active
    const fmtOpts = _clockSec
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }
        : { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' };
    const t = now.toLocaleTimeString('he-IL', fmtOpts);
    if (el.clock.textContent !== t) el.clock.textContent = t;
    const d = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' });
    if (el.engDate.textContent !== d) el.engDate.textContent = d;
    const g = getGreeting(); if (el.greeting.textContent !== g) el.greeting.textContent = g;
    updateProgress(now);
    checkElecPeak(); // Feature 22: check IEC peak tariff hours every minute
    updateNextZman(); // F109: refresh next-zman header chip each minute
    updateCountdownChip(now); // F139: custom event countdown
}

// ── Hebrew Date + Shabbat ──
async function loadHebrewDate() {
    const key = 'heb-' + new Date().toDateString();
    const fresh = cGet(key, 3600000); if (fresh) { el.hebDate.textContent = fresh; return; }
    const stale = cGetStale(key); if (stale) el.hebDate.textContent = stale;
    try { const now = new Date(); const d = await fetchJSON(`https://www.hebcal.com/converter?cfg=json&gy=${now.getFullYear()}&gm=${now.getMonth() + 1}&gd=${now.getDate()}&g2h=1`);
        if (d.hebrew) { el.hebDate.textContent = d.hebrew; cSet(key, d.hebrew); }
    } catch (e) { console.error('Hebrew date:', e); }
}
// ── Hebrew Calendar Card ──
async function loadHebCal() {
    setSync('hebcal', 'syncing');
    try {
        // Candles + Havdalah (reuse Shabbat API)
        const shabKey = 'shabbat-' + new Date().toDateString();
        let shabData = cGetStale(shabKey);
        if (!shabData) {
            const d = await fetchJSON(`https://www.hebcal.com/shabbat?cfg=json&geonameid=${getGeonameid()}&M=on`);
            if (d.items) { cSet(shabKey, d.items.map(i => i.category + '|' + i.date).join('§')); }
            shabData = cGet(shabKey, 3600000);
        }
        // Parse candles/havdalah from raw or structured cache
        let candleStr = '--', havdalaStr = '--';
        // Fetch fresh structured data if cache is raw items
        try {
            const d2 = await fetchJSON(`https://www.hebcal.com/shabbat?cfg=json&geonameid=${getGeonameid()}&M=on`);
            if (d2.items) {
                const cndl = d2.items.find(i => i.category === 'candles');
                const hvdl = d2.items.find(i => i.category === 'havdalah');
                if (cndl) {
                    const dt = new Date(cndl.date);
                    candleStr = dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
                    _candleDate = dt; // store for Shabbat countdown
                }
                if (hvdl) {
                    havdalaStr = new Date(hvdl.date).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
                    _shabbatEnd = new Date(hvdl.date); // store for Shabbat mode exit
                }
            }
        } catch (_) {}
        if (el.hcCandles) { el.hcCandles.textContent = candleStr; el.hcCandles.classList.remove('skeleton'); }
        if (el.hcHavdala) el.hcHavdala.textContent = havdalaStr;
        updateShabbatCountdown(); // show countdown immediately if candle time is within 24h
        updateShabbatHeaderPill(); // Feature 77: sync header pill

        // Next holiday
        try {
            const now = new Date();
            const hd = await fetchJSON(`https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&year=${now.getFullYear()}&month=x`);
            if (hd.items) {
                const upcoming = hd.items.filter(i => i.category === 'holiday' && new Date(i.date) >= now)
                    .sort((a, b) => new Date(a.date) - new Date(b.date));
                if (upcoming.length && el.hcHoliday) {
                    const h = upcoming[0];
                    const days = Math.ceil((new Date(h.date) - now) / 86400000);
                    const name = h.hebrew || h.title;
                    el.hcHoliday.textContent = days <= 0 ? name : days === 1 ? 'מחר: ' + name : name + ' — בעוד ' + days + ' ימים';
                    if (el.hcHolidayRow) el.hcHolidayRow.style.display = '';
                }
                // School holidays (Israeli school break marker)
                const schoolItems = hd.items.filter(i =>
                    (i.category === 'holiday' || i.category === 'minor') &&
                    new Date(i.date) >= now &&
                    /chol|vacation|break|school|pesach|sukkot|shavuot|chanukah|purim/i.test(i.title || '')
                ).sort((a, b) => new Date(a.date) - new Date(b.date));
                if (schoolItems.length && el.hcSchool && el.hcSchoolRow) {
                    const sh = schoolItems[0];
                    const daysS = Math.ceil((new Date(sh.date) - now) / 86400000);
                    const nameS = sh.hebrew || sh.title;
                    el.hcSchool.textContent = daysS <= 0 ? nameS : daysS === 1 ? 'מחר: ' + nameS : nameS + ' — בעוד ' + daysS + ' ימים';
                    el.hcSchoolRow.style.display = '';
                }
            }
        } catch (_) {}

        // Special items (Omer, Hanukkah, etc.) from Hebcal today
        try {
            const now = new Date();
            // Use the same sunset-aware date logic as loadOmer
            let afterSunset;
            if (_todaySunset) {
                afterSunset = now > _todaySunset;
            } else {
                const ilTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
                afterSunset = ilTime.getHours() > 19 || (ilTime.getHours() === 19 && ilTime.getMinutes() >= 15);
            }
            const omerDate = afterSunset ? new Date(now.getTime() + 86400000) : now;
            const sd = await fetchJSON(`https://www.hebcal.com/hebcal?v=1&cfg=json&omer=on&maj=off&min=off&ss=off&mf=off&year=${omerDate.getFullYear()}&month=${omerDate.getMonth()+1}&day=${omerDate.getDate()}`);
            const specialItems = (sd.items || []).filter(i => ['omer','holiday'].includes(i.category));
            if (specialItems.length && el.hcSpecial) {
                const texts = specialItems.map(i => (i.category === 'omer' ? '🌾 ' : '✡️ ') + (i.hebrew || i.title));
                el.hcSpecial.textContent = texts.join('  ·  ');
                if (el.hcSpecialRow) el.hcSpecialRow.style.display = '';
            }
        } catch (_) {}

        // Daily saying: rotate through MOTIVATIONS based on day of year
        if (el.hcSaying && MOTIVATIONS?.length) {
            const now = new Date();
            const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
            const hr = now.getHours();
            const idx = (doy * 24 + hr) % MOTIVATIONS.length;
            const m = MOTIVATIONS[idx];
            el.hcSaying.textContent = (m.t || '') + (m.a ? ' — ' + m.a : '');
        }

        // Parasha + Daf Yomi (may fail silently)
        await Promise.all([loadParasha(), loadDafYomi()]);

        setSync('hebcal', 'success'); syncBurst('hebcal');
    } catch (e) {
        setSync('hebcal', 'error'); diagLog('hebcal ERR: ' + e.message);
    }
}



// ── Sefirat HaOmer (Omer Count) ──
// After sunset the count advances to the next day's omer.
// Uses _todaySunset from weather data; falls back to 19:15 Jerusalem time.
async function loadOmer() {
    if (!el.omerCount) return;
    const now = new Date();
    // Determine if we're past sunset (i.e., Hebrew calendar already rolled to next day)
    let afterSunset;
    if (_todaySunset) {
        afterSunset = now > _todaySunset;
    } else {
        // Fallback: approximate Jerusalem sunset as 19:15 Israel time during omer season
        const ilTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        afterSunset = ilTime.getHours() > 19 || (ilTime.getHours() === 19 && ilTime.getMinutes() >= 15);
    }
    // Use tomorrow if after sunset
    const omerDate = afterSunset ? new Date(now.getTime() + 86400000) : now;
    const yr = omerDate.getFullYear();
    const mo = omerDate.getMonth() + 1;
    const dy = omerDate.getDate();
    const key = `omer-${yr}-${mo}-${dy}`;
    const cached = cGet(key, 86400000); // 24h TTL
    if (cached !== null) { _renderOmer(cached); return; }
    const stale = cGetStale(key); if (stale !== null) _renderOmer(stale);
    try {
        const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&omer=on&maj=off&min=off&ss=off&mf=off&year=${yr}&month=${mo}&day=${dy}`;
        const d = await fetchJSON(url);
        const item = d.items?.find(i => i.category === 'omer');
        if (item) { cSet(key, item); _renderOmer(item); }
        else { cSet(key, null); el.omerCount.textContent = ''; } // not omer period
    } catch (e) { console.error('Omer:', e); }
}
function _renderOmer(item) {
    if (!el.omerCount) return;
    if (!item) {
        el.omerCount.textContent = '';
        if (el.hcOmerRow) el.hcOmerRow.style.display = 'none';
        return;
    }
    // item.hebrew e.g. "ח׳ בָּעֹמֶר", item.title e.g. "Omer: day 8 of 49"
    const heb = item.hebrew || '';
    const day = heb || (item.title ? item.title.replace('Omer:', '').trim() : '');
    el.omerCount.textContent = day ? `🌾 ${day}` : '';
    if (item.title) el.omerCount.title = item.title;
    if (el.hcOmerRow) el.hcOmerRow.style.display = day ? '' : 'none';
}

// ── Day / Year Progress ──
function updateProgress(now) {
    const dayPct = Math.round(((now.getHours() * 60 + now.getMinutes()) / 1440) * 100);
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    const yearPct = Math.round(((now - start) / (end - start)) * 100);
    if (el.dayProgress) el.dayProgress.style.width = dayPct + '%';
    if (el.yearProgress) el.yearProgress.style.width = yearPct + '%';
    if (el.dayPct) el.dayPct.textContent = dayPct + '%';
    if (el.yearPct) el.yearPct.textContent = yearPct + '%';
}

// ── Market Open/Closed Badge (Sprint 5: extended to pre/after hours) ──
// updateMarketBadge is defined below in Sprint 5 features block

// ── Relative Time ──
function relTime(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'עכשיו';
    if (diff < 60) return `לפני ${diff} דק׳`;
    if (diff < 1440) return `לפני ${Math.floor(diff / 60)} שע׳`;
    return `לפני ${Math.floor(diff / 1440)} ימים`;
}

// ── Weather (with hourly graph, real humidity, UV) ──
async function loadWeather() {
    if (!_pageVisible || !acquireLock('wx')) return;
    setSync('wx', 'syncing');
    const key = 'wx';
    const fresh = cGet(key, 900000); // 15min TTL
    if (fresh) { renderWeather(fresh); setSync('wx', 'success'); releaseLock('wx'); return; }
    const stale = cGetStale(key); if (stale) renderWeather(stale);
    try {
        // Feature 45: use current city lat/lon
        const city = (typeof getCurrentWxCity === 'function') ? getCurrentWxCity() : { lat: 31.7683, lon: 35.2137 };
        const d = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,uv_index,apparent_temperature,precipitation_probability,dew_point_2m,wind_gusts_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset,precipitation_probability_max,precipitation_sum&timezone=Asia%2FJerusalem&forecast_days=8`).then(r => r.json());
        if (d.current_weather) { cSet(key, d); renderWeather(d); setSync('wx', 'success'); syncBurst('wx'); recordSuccess('wx'); }
    } catch (e) { console.error('Weather:', e); setSync('wx', stale ? 'success' : 'error'); recordFailure('wx'); }
    releaseLock('wx');
}
function renderWeather(d) {
    const cw = d.current_weather;
    const tempC = Math.round(cw.temperature);
    animateNumber(el.topTemp, toDisplayTemp(tempC));
    animateNumber(el.wxTemp, toDisplayTemp(tempC));
    el.wxDesc.textContent = WX_CODES[cw.weathercode] || 'לא ידוע';
    el.wxIcon.textContent = WX_EMOJI[cw.weathercode] || '🌡️';
    animateNumber(el.wxWind, Math.round(cw.windspeed) + ' קמ"ש ' + deg2arrow(cw.winddirection ?? 0));
    // F108: Hebrew wind direction label
    if (el.wxWindHeb) el.wxWindHeb.textContent = deg2hebrewDir(cw.winddirection ?? 0);
    // Feature 32: check for severe weather
    checkSevereWeather(cw.weathercode);
    // Feature 42: update sky color pill
    updateWeatherSkyPill(cw.weathercode);
    // Real humidity, UV, and feels-like from hourly data
    if (d.hourly) {
        const nowH = new Date().getHours();
        if (d.hourly.relativehumidity_2m?.[nowH] != null) el.wxHum.textContent = d.hourly.relativehumidity_2m[nowH] + '%';
        if (d.hourly.uv_index?.[nowH] != null) {
            const uv = d.hourly.uv_index[nowH];
            const uvLvl = uv <= 2 ? 'uv-low' : uv <= 5 ? 'uv-mod' : uv <= 7 ? 'uv-high' : uv <= 10 ? 'uv-vhigh' : 'uv-extreme';
            const uvLabel = uv <= 2 ? 'נמוך' : uv <= 5 ? 'בינוני' : uv <= 7 ? 'גבוה' : uv <= 10 ? 'גבוה מאוד' : 'קיצוני';
            // F122: show UV as colored pill with level label
            el.wxUv.innerHTML = `<span class="uv-pill ${uvLvl}" title="${uvLabel}">${uv.toFixed(1)}</span> <small style="font-size:0.7em;color:var(--text-muted)">${uvLabel}</small>`;
            el.wxUv.className = 'wx-detail-val';
        }
        if (d.hourly.apparent_temperature?.[nowH] != null) {
            const feels = Math.round(d.hourly.apparent_temperature[nowH]);
            el.wxDesc.textContent = (WX_CODES[cw.weathercode] || 'לא ידוע') + ` · מרגיש ${toDisplayTemp(feels)}`;
            // Feature 26: also populate feels-like wx-detail cell
            if (el.wxFeels) el.wxFeels.textContent = toDisplayTemp(feels);
        }
        // F142: Dew point
        if (d.hourly.dew_point_2m?.[nowH] != null && el.wxDew) el.wxDew.textContent = toDisplayTemp(Math.round(d.hourly.dew_point_2m[nowH]));
        // F143: Wind gusts — show warning when gust significantly exceeds current wind speed
        if (el.wxGust) {
            const gust = d.hourly.wind_gusts_10m?.[nowH];
            if (gust != null && gust > cw.windspeed * 1.4 && gust > 25) {
                el.wxGust.textContent = '💨 שרב עד ' + Math.round(gust) + ' קמ"ש';
                el.wxGust.style.display = '';
            } else { el.wxGust.style.display = 'none'; }
        }
        // Hourly temperature graph (next 12h) — Feature 66: also pass precipitation_probability
        const rainProbs = d.hourly.precipitation_probability?.slice(nowH, nowH + 12) || [];
        renderHourlyChart(d.hourly.temperature_2m.slice(nowH, nowH + 12), nowH, rainProbs);
    }
    if (d.daily) {
        const now = new Date();
        const sr = new Date(d.daily.sunrise[0]);
        const ss = new Date(d.daily.sunset[0]);
        _todaySunset = ss;  // store for Omer counter sunset-based switching
        _todaySunrise = sr; // store for auto-night theme
        applyAutoTheme();   // re-evaluate night mode now that we have sunrise/sunset
        // Show whichever sun event is closest and still upcoming.
        // If sunset is in the future and closer than sunrise (or sunrise already passed) → show sunset.
        // Otherwise (before sunrise, or both passed) → show sunrise.
        const srFuture = sr > now;
        const ssFuture = ss > now;
        let showSunset;
        if (srFuture && ssFuture) {
            // Both upcoming — show the sooner one
            showSunset = ss < sr;
        } else if (ssFuture) {
            showSunset = true;   // only sunset still upcoming
        } else {
            showSunset = false;  // both passed (night) — show tomorrow's sunrise label
        }
        const sunTime = showSunset ? ss : sr;
        const riseLabel = document.getElementById('wx-rise-label');
        if (riseLabel) riseLabel.textContent = showSunset ? '🌇 שקיעה' : '🌅 זריחה';
        el.wxRise.textContent = sunTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        // Forecast
        const fDays = el.wxForecast.querySelectorAll('.wx-fday');
        for (let i = 1; i <= 7; i++) {
            if (fDays[i - 1] && d.daily.time[i]) {
                const dn = new Date(d.daily.time[i]).toLocaleDateString('he-IL', { weekday: 'short' });
                const mx = Math.round(d.daily.temperature_2m_max[i]);
                const mn = Math.round(d.daily.temperature_2m_min[i]);
                const wc = d.daily.weathercode[i];
                const rain = d.daily.precipitation_probability_max?.[i];
                // F152: precipitation amount (mm)
                const mm = d.daily.precipitation_sum?.[i];
                const mmTxt = mm != null && mm >= 0.2 ? `<span class="wx-fday-mm">💧 ${mm.toFixed(1)} מ"מ</span>` : '';
                // Feature 56: precipitation bar
                const rainTxt = rain != null && rain >= 20
                    ? `<div class="wx-fday-rain">🌧️ ${rain}%<div class="wx-precip-bar"><div class="wx-precip-fill" style="width:${rain}%"></div></div>${mmTxt}</div>`
                    : rain != null && rain > 0
                    ? `<div class="wx-precip-bar"><div class="wx-precip-fill" style="width:${rain}%"></div></div>${mmTxt}`
                    : '';
                fDays[i - 1].innerHTML = `<div class="wx-fday-icon">${WX_EMOJI[wc] || '🌡️'}</div><div class="wx-fday-name">${dn}</div><div class="wx-fday-temp">${toDisplayTemp(mx)}/${toDisplayTemp(mn)}</div>${rainTxt}`;
            }
        }
        // F158: Today min/max range below main temperature
        if (el.wxMinMax && d.daily.temperature_2m_max?.[0] != null && d.daily.temperature_2m_min?.[0] != null) {
            el.wxMinMax.textContent = `${toDisplayTemp(Math.round(d.daily.temperature_2m_min[0]))} / ${toDisplayTemp(Math.round(d.daily.temperature_2m_max[0]))}`;
        }
        // F148: Weekly weather summary text (below 7-day forecast)
        if (el.wxWeekSummary) {
            const maxTemps = d.daily.temperature_2m_max?.slice(1, 8).filter(Boolean) || [];
            const rainProbs7 = d.daily.precipitation_probability_max?.slice(1, 8).filter(v => v != null) || [];
            const avgMax = maxTemps.length ? maxTemps.reduce((a, b) => a + b, 0) / maxTemps.length : null;
            const maxRain7 = rainProbs7.length ? Math.max(...rainProbs7) : 0;
            const avgRain7 = rainProbs7.length ? rainProbs7.reduce((a, b) => a + b, 0) / rainProbs7.length : 0;
            const isHot = avgMax != null && avgMax > 30;
            const isCold = avgMax != null && avgMax < 12;
            let summary = '';
            if (maxRain7 >= 60) summary = isHot ? '⛈ שבוע גשום וחם' : '🌧 שבוע גשום';
            else if (avgRain7 >= 30) summary = '🌦 שבוע עם גשמים חלקיים';
            else if (isHot) summary = avgRain7 < 10 ? '☀️ שבוע חם ויבש' : '🌤 שבוע חם';
            else if (isCold) summary = '🧥 שבוע קר יחסית';
            else summary = maxRain7 > 20 ? '🌤 שבוע נעים עם אפשרות גשם' : '☀️ שבוע נעים ויבש';
            el.wxWeekSummary.textContent = summary;
        }
    }
}
// F128: Track which hourly chart view is active
let _wxChartView = 'temp'; // 'temp' or 'rain'
let _wxChartLastData = null; // { temps, startH, rainProbs }
function toggleHourlyChartView() {
    _wxChartView = _wxChartView === 'temp' ? 'rain' : 'temp';
    const btn = document.getElementById('wx-chart-toggle');
    if (btn) btn.textContent = _wxChartView === 'temp' ? '🌡️ טמפ׳' : '🌧 גשם';
    if (_wxChartLastData) renderHourlyChart(_wxChartLastData.temps, _wxChartLastData.startH, _wxChartLastData.rainProbs);
}

function renderHourlyChart(temps, startH, rainProbs) {
    if (!temps || temps.length < 2) return;
    // F128: cache for view-toggle re-render
    _wxChartLastData = { temps, startH, rainProbs };
    const W = 500, H = 60, P = 8;

    // F128: precipitation-only view — bar chart of rain probability
    if (_wxChartView === 'rain' && rainProbs && rainProbs.length >= 2) {
        const barW = (W - 2 * P) / rainProbs.length;
        let bars = '', rainLabels = '';
        for (let i = 0; i < rainProbs.length; i++) {
            const prob = rainProbs[i] || 0;
            const barH = Math.max(1, (prob / 100) * (H - 2 * P - 14));
            const bx = P + i * barW;
            const barColor = prob >= 70 ? '#3b82f6' : prob >= 40 ? '#60a5fa' : '#93c5fd';
            bars += `<rect x="${bx.toFixed(1)}" y="${(H - P - 14 - barH).toFixed(1)}" width="${(barW * 0.8).toFixed(1)}" height="${barH.toFixed(1)}" fill="${barColor}" opacity="0.7" rx="2"/>`;
            // F123: label
            if (prob >= 20) rainLabels += `<text x="${(bx + barW * 0.4).toFixed(1)}" y="${(H - P - 14 - barH - 2).toFixed(1)}" fill="#93c5fd" font-size="7" text-anchor="middle">${prob}%</text>`;
            if (i % 2 === 0) rainLabels += `<text x="${(bx + barW * 0.4).toFixed(1)}" y="${H - 1}" fill="#64748b" font-size="8" text-anchor="middle">${String((startH + i) % 24).padStart(2, '0')}</text>`;
        }
        el.wxHourly.innerHTML = bars + rainLabels;
        return;
    }

    const min = Math.min(...temps), max = Math.max(...temps), range = max - min || 1;
    const pts = temps.map((t, i) => ({ x: W - P - (i / (temps.length - 1)) * (W - 2 * P), y: P + (1 - (t - min) / range) * (H - 2 * P - 14) }));
    // Smooth bezier path
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        const cp = (pts[i].x - pts[i - 1].x) / 2;
        path += ` C${pts[i - 1].x + cp},${pts[i - 1].y} ${pts[i].x - cp},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    }
    const areaPath = path + ` L${pts[pts.length - 1].x},${H - P} L${pts[0].x},${H - P} Z`;
    // Hour labels
    let labels = '';
    for (let i = 0; i < temps.length; i += 2) {
        const h = (startH + i) % 24;
        labels += `<text x="${pts[i].x}" y="${H - 1}" fill="#64748b" font-size="8" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
    }
    // Temp labels at peaks
    const maxI = temps.indexOf(Math.max(...temps));
    const minI = temps.indexOf(Math.min(...temps));
    labels += `<text x="${pts[maxI].x}" y="${pts[maxI].y - 4}" fill="#f87171" font-size="8" text-anchor="middle" font-weight="bold">${Math.round(temps[maxI])}°</text>`;
    labels += `<text x="${pts[minI].x}" y="${pts[minI].y - 4}" fill="#60a5fa" font-size="8" text-anchor="middle" font-weight="bold">${Math.round(temps[minI])}°</text>`;
    // Feature 66: rain probability bars at chart bottom (each hour = a thin rect)
    let rainBars = '';
    if (rainProbs && rainProbs.length >= 2) {
        const barW = (W - 2 * P) / (rainProbs.length - 1);
        for (let i = 0; i < rainProbs.length; i++) {
            const prob = rainProbs[i] || 0;
            if (prob >= 10) {
                const barH = Math.max(1, (prob / 100) * 8);
                const bx = W - P - i * barW - barW / 2;
                rainBars += `<rect x="${bx.toFixed(1)}" y="${(H - P - barH).toFixed(1)}" width="${(barW * 0.7).toFixed(1)}" height="${barH.toFixed(1)}" fill="#60a5fa" opacity="${(0.15 + (prob / 100) * 0.45).toFixed(2)}" rx="1"/>`;
                // F123: show % labels for >= 30% rain probability on temp view
                if (prob >= 30) rainBars += `<text x="${bx.toFixed(1)}" y="${(H - P - barH - 2).toFixed(1)}" fill="#93c5fd" font-size="7" text-anchor="middle">${prob}%</text>`;
            }
        }
    }
    el.wxHourly.innerHTML = `
        <defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa" stop-opacity="0.4"/><stop offset="100%" stop-color="#60a5fa" stop-opacity="0.02"/></linearGradient></defs>
        ${rainBars}
        <path d="${areaPath}" fill="url(#hg)" /><path d="${path}" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round"/>
        ${pts.map((p, i) => i % 2 === 0 ? `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#60a5fa"><title>${Math.round(temps[i])}°${_tempUnit === 'F' ? 'F' : 'C'} | ${String((startH + i) % 24).padStart(2, '0')}:00${rainProbs && rainProbs[i] >= 10 ? ' | 🌧 ' + rainProbs[i] + '%' : ''}</title></circle>` : '').join('')}
        ${labels}`;
}

// ── News Sources ──
const NEWS_FEEDS = [
    { url: 'https://www.ynet.co.il/Integration/StoryRss1854.xml', src: 'Ynet מבזקים' },
    { url: 'https://rss.walla.co.il/feed/1', src: 'וואלה' },
    { url: 'https://www.mako.co.il/AjaxPage?jspName=HPFloatingRSS.jsp', src: 'מאקו' },
    { url: 'https://www.kan.org.il/podcast/2578/', src: 'כאן חדשות' },
    { url: 'https://www.n12.co.il/cmlink/1.6017730', src: 'N12' },
    { url: 'https://www.rotter.net/scoopscache.xml', src: 'רוטר סקופים' },
    { url: 'https://www.israelhayom.co.il/rss.xml', src: 'ישראל היום' },
    { url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585', src: 'גלובס' },
    { url: 'https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml', src: 'כלכליסט' },
    { url: 'https://www.makorrishon.co.il/feed/', src: 'מקור ראשון' },
    { url: 'https://www.kikar.co.il/rss', src: 'כיכר השבת' },
    { url: 'https://www.ice.co.il/rss/all', src: 'ICE' },
    { url: 'https://www.geektime.co.il/feed/', src: 'גיקטיים' },
    { url: 'https://www.now14.co.il/feed/', src: 'ערוץ 14' },
    { url: 'https://www.inn.co.il/Rss.aspx', src: 'ערוץ 7' },
    { url: 'https://www.srugim.co.il/feed', src: 'סרוגים' },
    { url: 'https://www.bhol.co.il/rss', src: 'בחדרי חרדים' },
];
// Feature 73: domain map for news source favicons
const NEWS_SRC_DOMAIN = {
    'Ynet מבזקים': 'ynet.co.il', 'וואלה': 'walla.co.il', 'מאקו': 'mako.co.il',
    'כאן חדשות': 'kan.org.il', 'N12': 'n12.co.il', 'רוטר סקופים': 'rotter.net',
    'ישראל היום': 'israelhayom.co.il', 'גלובס': 'globes.co.il', 'כלכליסט': 'calcalist.co.il',
    'מקור ראשון': 'makorrishon.co.il', 'כיכר השבת': 'kikar.co.il', 'ICE': 'ice.co.il',
    'גיקטיים': 'geektime.co.il', 'ערוץ 14': 'now14.co.il', 'ערוץ 7': 'inn.co.il',
    'סרוגים': 'srugim.co.il', 'בחדרי חרדים': 'bhol.co.il',
};

// ── Fetch a single RSS feed (returns array of items) ──
async function fetchFeed(feed) {
    // Try CORS proxies first (direct XML parsing — no rate-limited third-party service)
    for (const p of PROXIES) {
        try {
            const r = await fetch(p + encodeURIComponent(feed.url)); if (!r.ok) continue;
            const txt = p.includes('allorigins') ? (await r.json()).contents : await r.text();
            const xml = new DOMParser().parseFromString(txt, 'text/xml');
            const items = []; xml.querySelectorAll('item').forEach(it => { const t = it.querySelector('title')?.textContent?.trim(); if (t) items.push({ title: t, pubDate: it.querySelector('pubDate')?.textContent || '', link: it.querySelector('link')?.textContent || '', source: feed.src, desc: it.querySelector('description')?.textContent?.replace(/<[^>]+>/g, '').trim().slice(0, 140) || '' }); });
            if (items.length) return items;
        } catch (_) { continue; }
    }
    // Fallback: rss2json (rate-limited free tier — avoid as primary)
    try {
        const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feed.url));
        if (r.ok) { const j = await r.json(); if (j.status === 'ok' && j.items?.length) return j.items.map(x => ({ ...x, source: feed.src })); }
    } catch (_) {}
    return [];
}

// ── News (5-min refresh, aggregates all sources, sorted newest first) ──
async function loadNews() {
    if (!_pageVisible || !acquireLock('news')) return;
    setSync('news', 'syncing');
    const key = 'news';
    const fresh = cGet(key, 300000); // 5min TTL
    if (fresh) { renderNews(fresh); setSync('news', 'success'); releaseLock('news'); return; }
    const stale = cGetStale(key); if (stale) { renderNews(stale); }
    const allItems = [];
        const results = await runConcurrent(getActiveFeeds().map(f => () => fetchFeed(f)));
    for (const r of results) { if (r.status === 'fulfilled' && r.value.length) allItems.push(...r.value); }
    if (allItems.length) {
        const seen = new Set(); const unique = [];
        for (const it of allItems) { const k = it.title.trim().substring(0, 40); if (!seen.has(k)) { seen.add(k); unique.push(it); } }
        unique.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
        const top = unique.slice(0, 50);
        cSet(key, top);
        renderNews(top); setSync('news', 'success'); syncBurst('news'); recordSuccess('news');
    } else { setSync('news', stale ? 'success' : 'error'); recordFailure('news'); }
    releaseLock('news');
}

// F103: News keyword search filter
let _newsKeyword = '';
let _newsSearchDebounce = null;
function applyNewsSearch(kw) {
    _newsKeyword = kw;
    if (el.newsSearchClear) el.newsSearchClear.style.display = kw ? '' : 'none';
    const allItems = el.rssScroll?.querySelectorAll('.rss-item');
    if (!allItems) return;
    const kwLower = kw.toLowerCase();
    let visible = 0;
    const matchedTitles = new Set();
    allItems.forEach(item => {
        if (item.classList.contains('clone')) return;
        const titleEl = item.querySelector('.rss-title');
        const title = titleEl?.textContent || '';
        const src = item.querySelector('.rss-source')?.textContent.toLowerCase() || '';
        const match = !kw || title.toLowerCase().includes(kwLower) || src.includes(kwLower);
        item.classList.toggle('search-hidden', !match);
        if (match) {
            visible++;
            matchedTitles.add(title);
            // F129: highlight matching text in title
            if (titleEl && kw) {
                const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const highlighted = title.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="rss-highlight">$1</mark>');
                titleEl.innerHTML = highlighted;
            } else if (titleEl && !kw) {
                titleEl.textContent = title; // restore plain text when search cleared
            }
        } else if (titleEl) {
            titleEl.textContent = title; // ensure no stale markup on hidden items
        }
    });
    allItems.forEach(item => {
        if (!item.classList.contains('clone')) return;
        const title = item.querySelector('.rss-title')?.textContent || '';
        item.classList.toggle('search-hidden', !matchedTitles.has(title));
    });
    if (el.rssScroll) el.rssScroll.style.animationPlayState = kw ? 'paused' : 'running';
    if (el.newsSearchCount) el.newsSearchCount.textContent = kw ? String(visible) : '';
}

// F110: Track visited news articles
const _NEWS_VISITED_KEY = 'dash_news_visited';
const _NEWS_VISITED_MAX = 200;
function _getVisitedArticles() {
    try { return new Set(JSON.parse(localStorage.getItem(_NEWS_VISITED_KEY) || '[]')); } catch (_) { return new Set(); }
}
function _addVisitedArticle(url) {
    if (!url) return;
    try {
        const arr = JSON.parse(localStorage.getItem(_NEWS_VISITED_KEY) || '[]');
        if (!arr.includes(url)) {
            arr.unshift(url);
            if (arr.length > _NEWS_VISITED_MAX) arr.length = _NEWS_VISITED_MAX;
            localStorage.setItem(_NEWS_VISITED_KEY, JSON.stringify(arr));
        }
    } catch (_) {}
}

// F107: Settings export / import
function exportSettings() {
    const settings = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('dash_')) settings[k] = localStorage.getItem(k);
    }
    const json = JSON.stringify(settings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'familydashboard-settings.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    diagLog('Settings exported: ' + Object.keys(settings).length + ' keys');
}
function importSettings() {
    const input = document.getElementById('cfg-import-file');
    if (!input) return;
    input.onchange = async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const settings = JSON.parse(text);
            let count = 0;
            for (const [k, v] of Object.entries(settings)) {
                if (k.startsWith('dash_') && typeof v === 'string') { localStorage.setItem(k, v); count++; }
            }
            diagLog(`Settings imported: ${count} keys`);
            alert(`ייבוא הושלם — ${count} הגדרות ✓\nהדף יטען מחדש.`);
            location.reload();
        } catch (ex) { alert('שגיאה בייבוא: ' + ex.message); }
        input.value = '';
    };
    input.click();
}

// ── Sprint 12 Functions (F111–F120) ───────────────────────────────────────────

// ── Sprint 13 Functions (F121–F130) ───────────────────────────────────────────

// ── Sprint 14 Functions (F131–F140) ───────────────────────────────────────────

// ── Sprint 15 Functions (F141–F150) ───────────────────────────────────────────

// F144: News category detection — Hebrew keyword matching
function detectNewsCategory(title) {
    const t = (title || '').toLowerCase();
    if (/ביטחון|צבא|לחימה|טיל|רקטה|מלחמה|חמאס|טרור|נשק|כיבוש|חי"ר|חיל|אש|פגיעה|כוחות|ירי/.test(t)) return 'security';
    if (/פוליטיקה|ממשלה|כנסת|קואליציה|אופוזיציה|בחירות|מפלגה|שר.*ה|ראש.*ממשלה|נשיא|וועדה|הצבעה/.test(t)) return 'politics';
    if (/כלכלה|שוק.*מניה|שקל|בנק|ריבית|תקציב|גז|נפט|ייצוא|ייבוא|שביתה|הסתדרות|אינפלציה/.test(t)) return 'economy';
    if (/ספורט|כדורגל|כדורסל|טניס|אצלתנות|אולימפיאד|ליגה|אלופות|מונדיאל|מרוץ|גביע|שחיה/.test(t)) return 'sport';
    if (/טכנולוגיה|סטארטאפ|בינה מלאכותית|ai\b|cyber|קיברנטי|אפליקציה|סמארטפון|מחשב|רובוט/.test(t)) return 'tech';
    return null;
}

// F147: News bookmark helpers (max 15 saved articles)
const NEWS_BOOKMARKS_KEY = 'dash_news_bookmarks';
function _getNewsBookmarks() {
    try { return new Set(JSON.parse(localStorage.getItem(NEWS_BOOKMARKS_KEY) || '[]')); } catch { return new Set(); }
}
function _toggleNewsBookmark(url) {
    const set = _getNewsBookmarks();
    if (set.has(url)) set.delete(url); else { set.add(url); if (set.size > 15) { const [first] = set; set.delete(first); } }
    try { localStorage.setItem(NEWS_BOOKMARKS_KEY, JSON.stringify([...set])); } catch (_) {}
}

// ── Sprint 16 Functions (F151–F160) ───────────────────────────────────────────

// F154: Today's upcoming events strip in calendar card
function _renderCalTodayStrip(events) {
    if (!el.calTodayStrip) return;
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayEvents = events
        .filter(e => !e.allDay && e.start >= now && e.start < endOfDay)
        .sort((a, b) => a.start - b.start)
        .slice(0, 5);
    el.calTodayStrip.innerHTML = '';
    if (!todayEvents.length) return;
    todayEvents.forEach(ev => {
        const pill = document.createElement('span');
        pill.className = 'cal-strip-event';
        const t = ev.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        pill.textContent = `${t} ${ev.title || ''}`;
        if (ev.icsIdx != null) pill.dataset.ics = ev.icsIdx;
        el.calTodayStrip.appendChild(pill);
    });
}

// F155: Stocks gainers/losers summary bar
function updateStockSummary() {
    if (!el.stkSummary) return;
    const stks = document.querySelectorAll('#stocks-body .stk');
    let up = 0, dn = 0, flat = 0;
    stks.forEach(s => {
        if (s.classList.contains('stk-up')) up++;
        else if (s.classList.contains('stk-down')) dn++;
        else flat++;
    });
    if (up + dn + flat === 0) { el.stkSummary.textContent = ''; return; }
    el.stkSummary.textContent = `📈 ${up} עולות  •  📉 ${dn} יורדות  •  ➡️ ${flat} יציבות`;
}

// F156: Toggle bookmarks-only news filter (B key)
function toggleNewsBookmarkFilter() {
    const active = document.body.classList.toggle('news-bkm-mode');
    showToast(active ? '🔖 מציג מועדפים בלבד' : '📰 מציג כל הכתבות');
}

// F157: Halacha overlay helpers
let _halachaData = null;
function _showHalachaOverlay() {
    if (!_halachaData || !el.halachaOverlay) return;
    if (el.halachaOverlayRef) el.halachaOverlayRef.textContent = '📜 ' + (_halachaData.ref || '');
    if (el.halachaOverlayText) el.halachaOverlayText.textContent = (_halachaData.texts || []).map((t, i) => `(${i + 1}) ${t}`).join('\n\n');
    el.halachaOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}
function _closeHalachaOverlay() {
    if (!el.halachaOverlay) return;
    el.halachaOverlay.classList.remove('visible');
    document.body.style.overflow = '';
}

// F159: Card collapse setup (called once at init)
function setupCardCollapse() {
    document.querySelectorAll('.card-collapse-btn').forEach(btn => {
        const card = btn.closest('.card');
        if (!card || !card.dataset.cardId) return;
        const key = `dash_collapsed_${card.dataset.cardId}`;
        // Restore persisted state
        if (localStorage.getItem(key) === '1') card.classList.add('collapsed');
        btn.addEventListener('click', e => {
            e.stopPropagation(); // don't trigger card maximize
            card.classList.toggle('collapsed');
            localStorage.setItem(key, card.classList.contains('collapsed') ? '1' : '0');
        });
    });
}

// F160: Apply saved news font scale on startup
function applyNewsFontScale() {
    const val = parseInt(localStorage.getItem('dash_news_fontsize') || '100', 10);
    document.documentElement.style.setProperty('--news-font-scale', (val / 100).toFixed(2));
    const slider = document.getElementById('cfg-news-fontsize');
    const label  = document.getElementById('cfg-news-fontsize-val');
    if (slider) { slider.value = String(val); slider.oninput = () => {
        const v = parseInt(slider.value, 10);
        if (label) label.textContent = v + '%';
        document.documentElement.style.setProperty('--news-font-scale', (v / 100).toFixed(2));
    }; }
    if (label) label.textContent = val + '%';
}

// F139: Custom event countdown header chip
function updateCountdownChip(now) {
    if (!el.headerCountdown) return;
    const dateStr = localStorage.getItem('dash_countdown_date');
    const label = (localStorage.getItem('dash_countdown_label') || '').trim();
    if (!dateStr || !label) { el.headerCountdown.style.display = 'none'; return; }
    const target = new Date(dateStr + 'T00:00:00');
    if (isNaN(target.getTime())) { el.headerCountdown.style.display = 'none'; return; }
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays < -7) { el.headerCountdown.style.display = 'none'; return; } // hide a week after
    const text = diffDays > 0 ? `⏳ ${diffDays} ${diffDays === 1 ? 'יום' : 'ימים'} ל${label}`
               : diffDays === 0 ? `🎉 היום: ${label}!`
               : `✅ ${label} (לפני ${Math.abs(diffDays)} ימים)`;
    el.headerCountdown.textContent = text;
    el.headerCountdown.style.display = '';
}

// F140: Populate print date element before window.print fires
function initPrintDate() {
    window.addEventListener('beforeprint', () => {
        if (el.printDatetime) {
            const now = new Date();
            el.printDatetime.textContent = 'הדפסה: ' + now.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' });
        }
    });
}

// F121: Toast notification system
let _toastTimer = null;
function showToast(msg, durationMs = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('toast-show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => { t.classList.remove('toast-show'); _toastTimer = null; }, durationMs);
}

// ── Scroll Loop Helper (shared by news, stocks, alerts) ──
function injectScrollKeyframes(styleId, keyframeName, distance) {
    let sEl = document.getElementById(styleId);
    if (!sEl) { sEl = document.createElement('style'); sEl.id = styleId; document.head.appendChild(sEl); }
    sEl.textContent = `@keyframes ${keyframeName} { from { transform: translateY(0); } to { transform: translateY(-${distance}px); } }`;
}

// F124: Calendar event reminder notifications (15min before upcoming events)
const _CAL_REMINDER_KEY = 'dash_cal_reminded'; // comma-separated reminded event keys
function _getRemindedKeys() {
    try { return new Set((localStorage.getItem(_CAL_REMINDER_KEY) || '').split(',').filter(Boolean)); } catch { return new Set(); }
}
function _addRemindedKey(key) {
    const keys = _getRemindedKeys();
    keys.add(key);
    // Keep at most 50 keys to avoid unbounded growth
    const arr = [...keys].slice(-50);
    localStorage.setItem(_CAL_REMINDER_KEY, arr.join(','));
}
function checkCalendarReminders() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const raw = cGetStale('cal-ics');
    if (!raw) return;
    try {
        const events = typeof parseICS === 'function' ? parseICS(raw) : [];
        const now = Date.now();
        const reminded = _getRemindedKeys();
        for (const ev of events) {
            if (ev.allDay || !ev.start) continue;
            const msBefore = ev.start.getTime() - now;
            if (msBefore < 0 || msBefore > 16 * 60000) continue; // 0–16 min ahead
            const key = ev.start.toISOString() + '::' + (ev.summary || '');
            if (reminded.has(key)) continue;
            _addRemindedKey(key);
            const timeStr = ev.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
            try {
                new Notification(`📅 ${ev.summary || 'אירוע'}`, {
                    body: `מתחיל ב-${timeStr} (בעוד ${Math.round(msBefore / 60000)} דק׳)`,
                    dir: 'rtl', lang: 'he', icon: './favicon.ico',
                });
            } catch (_) {}
            diagLog(`F124: Calendar reminder sent for "${ev.summary}" at ${timeStr}`);
        }
    } catch (e) { diagLog('F124 reminder error: ' + e.message); }
}
// F113/F114: Notification bell — show chip if permission not yet decided
function initNotifBell() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') { if (el.notifBell) el.notifBell.style.display = ''; }
}
function requestNotifPermission() {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(p => {
        if (p === 'granted') { if (el.notifBell) el.notifBell.style.display = 'none'; diagLog('F114: Notification permission granted'); }
        else { diagLog('F114: Notification permission ' + p); }
    });
}

// F116: Unread alerts badge counter
let _unreadAlerts = 0;
function resetAlertsBadge() {
    _unreadAlerts = 0;
    if (el.alertsBadge) el.alertsBadge.style.display = 'none';
}

// F117: Apply configured weather city names/coords to wx-city-tab buttons
function initWeatherCities() {
    const tabs = document.querySelectorAll('.wx-city-tab[data-city]');
    const cityKeys = [...tabs].map((_, i) => `dash_city_${i + 1}`);
    tabs.forEach((tab, i) => {
        const stored = localStorage.getItem(cityKeys[i]);
        if (!stored) return;
        const parts = stored.split('|');
        if (parts.length >= 3 && !isNaN(parseFloat(parts[1])) && !isNaN(parseFloat(parts[2]))) {
            tab.textContent = parts[0].trim();
            tab.dataset.lat = parts[1].trim();
            tab.dataset.lon = parts[2].trim();
        }
    });
}

// F118: Get family members array from localStorage
function getMembers() {
    const raw = localStorage.getItem('dash_members');
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// F119: Config panel section tab switcher
function switchCfgTab(tabName) {
    document.querySelectorAll('.cfg-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.cfg-section').forEach(s => s.classList.toggle('active', s.dataset.tab === tabName));
    localStorage.setItem('dash_cfg_tab', tabName);
}

// F120: Share current dashboard settings as a URL hash
function shareSettings() {
    const themes = ['black','blue','matrix','amber','purple'];
    const activeTheme = themes.find(t => document.body.classList.contains('theme-' + t)) || 'black';
    const settings = {
        theme: activeTheme,
        mode: localStorage.getItem('dash_screenMode') || 'tv',
        city: localStorage.getItem('dash_geonameid') || '',
        zone: localStorage.getItem('dash_alert_zone') || '',
    };
    const clean = Object.fromEntries(Object.entries(settings).filter(([, v]) => v));
    const shareURL = location.origin + location.pathname + '#' + new URLSearchParams(clean).toString();
    navigator.clipboard.writeText(shareURL)
        .then(() => showToast('🔗 קישור הועתק ללוח!'))
        .catch(() => { try { prompt('העתק את הקישור:', shareURL); } catch (_) {} });
    diagLog('F120: share URL generated: ' + shareURL);
}

// F120: Apply settings from URL hash (called before init)
function loadFromHash() {
    if (!location.hash) return;
    try {
        const params = new URLSearchParams(location.hash.slice(1));
        if (params.get('theme')) localStorage.setItem('dash_theme', params.get('theme'));
        if (params.get('mode'))  localStorage.setItem('dash_screenMode', params.get('mode'));
        if (params.get('city'))  localStorage.setItem('dash_geonameid', params.get('city'));
        if (params.get('zone'))  localStorage.setItem('dash_alert_zone', params.get('zone'));
        history.replaceState(null, '', location.pathname + location.search); // clean URL
        diagLog('F120: settings loaded from URL hash');
    } catch (_) {}
}

function renderNews(items) {
    const frag = document.createDocumentFragment();
    // F147: sort bookmarked articles to the top of original list
    const bookmarks = _getNewsBookmarks();
    const list = [...items].slice(0, 25).sort((a, b) => {
        const aB = a.link && bookmarks.has(a.link) ? 0 : 1;
        const bB = b.link && bookmarks.has(b.link) ? 0 : 1;
        return aB - bB;
    });
    // Duplicate for seamless scroll loop
    const all = [...list, ...list];
    const now = Date.now();
    all.forEach((it, idx) => {
        const div = document.createElement('div'); div.className = 'rss-item' + (idx >= list.length ? ' clone' : '');
        // F147: mark bookmarked items
        if (it.link && bookmarks.has(it.link)) div.classList.add('bookmarked');
        // Feature 39: data-src for source filter
        if (it.source) { div.dataset.src = it.source; if (idx < list.length) addNewsFilterChip(it.source); }
        // Freshness indicator: items < 30min old get highlighted
        if (it.pubDate) {
            const age = now - new Date(it.pubDate).getTime();
            if (age < 1800000) div.dataset.age = 'fresh';
            // F136: age-based opacity tinting for stale news
            if (idx < list.length) {
                const ageH = age / 3600000;
                if (ageH >= 24) div.classList.add('stale-old');
                else if (ageH >= 12) div.classList.add('stale-day');
                else if (ageH >= 6)  div.classList.add('stale-half');
            }
        }
        const tm = document.createElement('span'); tm.className = 'rss-time';
        if (it.pubDate) {
            const d = new Date(it.pubDate);
            tm.textContent = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
        } else { tm.textContent = '--:--'; }
        div.appendChild(tm);
        // Feature 67: news item age timestamp
        if (idx < list.length && it.pubDate) {
            const ageStr = newsRelAge(it.pubDate);
            if (ageStr) {
                const ageEl = document.createElement('span');
                ageEl.className = 'news-age';
                ageEl.textContent = ageStr;
                div.appendChild(ageEl);
            }
        }
        const ttl = document.createElement('span'); ttl.className = 'rss-title'; ttl.textContent = it.title; if (it.desc) ttl.title = it.desc; div.appendChild(ttl);
        // F144: Category badge (original items only, before source)
        if (idx < list.length) {
            const cat = detectNewsCategory(it.title);
            if (cat) {
                const badge = document.createElement('span');
                badge.className = 'news-cat cat-' + cat;
                const catLabels = { security: '🔴 ביטחון', politics: '🟣 פוליטיקה', economy: '🟢 כלכלה', sport: '🔵 ספורט', tech: '🟡 טכנולוגיה' };
                badge.textContent = catLabels[cat] || cat;
                div.appendChild(badge);
            }
        }
        // F145: Inline description expand (original items with desc only)
        if (idx < list.length && it.desc && it.desc.length > 10) {
            const descEl = document.createElement('div');
            descEl.className = 'news-desc';
            descEl.textContent = it.desc.substring(0, 220);
            div.appendChild(descEl);
            ttl.addEventListener('click', (e) => { e.stopPropagation(); div.classList.toggle('expanded'); });
        }
        const sr = document.createElement('span'); sr.className = 'rss-source'; sr.textContent = it.source || ''; div.appendChild(sr);
        // F147: Bookmark button (original items only)
        if (idx < list.length && it.link) {
            const bkmBtn = document.createElement('button');
            bkmBtn.className = 'news-bkm';
            bkmBtn.textContent = '🔖';
            bkmBtn.title = 'שמור / בטל שמירה — Bookmark';
            bkmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _toggleNewsBookmark(it.link, it.title);
                div.classList.toggle('bookmarked');
                bkmBtn.style.color = div.classList.contains('bookmarked') ? '#60a5fa' : '';
                showToast(div.classList.contains('bookmarked') ? '🔖 נשמר' : '🗑 הוסר');
            });
            div.appendChild(bkmBtn);
        }
        // Feature 57: copy to clipboard button (only on original items, not clones)
        if (idx < list.length && navigator.clipboard) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'news-copy';
            copyBtn.textContent = '📋';
            copyBtn.title = 'העתק כותרת וקישור — Copy headline';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(it.title + (it.link ? '\n' + it.link : ''))
                    .then(() => {
                        copyBtn.textContent = '✓';
                        copyBtn.classList.add('copied');
                        setTimeout(() => { copyBtn.textContent = '📋'; copyBtn.classList.remove('copied'); }, 1500);
                    }).catch(() => {});
            });
            div.appendChild(copyBtn);
        }
        // Feature 62: Web Share API button (only on original items, not clones)
        if (idx < list.length && navigator.share && it.link) {
            const shareBtn = document.createElement('button');
            shareBtn.className = 'news-share';
            shareBtn.textContent = '📤';
            shareBtn.title = 'שתף לאפליקציות — Share article';
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.share({ title: it.title, url: it.link }).catch(() => {});
            });
            div.appendChild(shareBtn);
        }
        // F125: Translate button — opens Google Translate with the article URL
        if (idx < list.length && it.link) {
            const transBtn = document.createElement('button');
            transBtn.className = 'rss-translate-btn';
            transBtn.textContent = '🌐';
            transBtn.title = 'תרגום לאנגלית — Translate to English';
            transBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tUrl = 'https://translate.google.com/translate?sl=iw&tl=en&u=' + encodeURIComponent(it.link);
                try { window.open(tUrl, '_blank', 'noopener,noreferrer'); } catch (_) {}
            });
            div.appendChild(transBtn);
        }
        if (it.link) {
            // F110: mark visited articles (dim on click, restore on re-render)
            const visited = _getVisitedArticles();
            if (visited.has(it.link)) div.classList.add('visited');
            div.addEventListener('click', () => { _addVisitedArticle(it.link); div.classList.add('visited'); window.open(it.link, '_blank'); });
        }
        frag.appendChild(div);
    });
    el.rssScroll.innerHTML = '';
    el.rssScroll.appendChild(frag); // single DOM write via DocumentFragment
    // Feature 29: update news count badge
    if (el.newsCount) el.newsCount.textContent = list.length + ' חדשות';
    // F103: re-apply active search filter after re-render
    if (_newsKeyword) applyNewsSearch(_newsKeyword);
    // Set scroll animation duration based on item count
    const h = el.rssScroll.scrollHeight / 2;
    el.rssScroll.style.animation = `newsScroll ${Math.max(40, list.length * 4)}s linear infinite`;
    injectScrollKeyframes('news-scroll-style', 'newsScroll', h);
}

// ── Ticker (horizontal scroll at the top) ──
// ── Daily Halacha (Sefaria API) ──
const SEFARIA_CALENDAR = 'https://www.sefaria.org/api/calendars';
async function loadHalacha() {
    if (!_pageVisible) return;
    const key = 'halacha';
    const fresh = cGet(key, 43200000); // 12h TTL — changes daily
    if (fresh) { renderHalacha(fresh); return; }
    const stale = cGetStale(key); if (stale) renderHalacha(stale);
    try {
        let calData;
        try { const r = await fetch(SEFARIA_CALENDAR); if (r.ok) calData = await r.json(); } catch (_) {}
        if (!calData) {
            for (const p of PROXIES) {
                try {
                    const r = await fetch(p + encodeURIComponent(SEFARIA_CALENDAR));
                    if (!r.ok) continue;
                    calData = p.includes('allorigins') ? JSON.parse((await r.json()).contents) : JSON.parse(await r.text());
                    break;
                } catch (_) { continue; }
            }
        }
        if (!calData?.calendar_items) return;
        const halachaItem = calData.calendar_items.find(it => it.title?.en === 'Halakhah Yomit');
        if (!halachaItem?.url) return;
        const textUrl = 'https://www.sefaria.org/api/v3/texts/' + encodeURIComponent(halachaItem.url);
        let textData;
        try { const r = await fetch(textUrl); if (r.ok) textData = await r.json(); } catch (_) {}
        if (!textData) {
            for (const p of PROXIES) {
                try {
                    const r = await fetch(p + encodeURIComponent(textUrl));
                    if (!r.ok) continue;
                    textData = p.includes('allorigins') ? JSON.parse((await r.json()).contents) : JSON.parse(await r.text());
                    break;
                } catch (_) { continue; }
            }
        }
        if (!textData?.versions?.length) return;
        const heVer = textData.versions.find(v => v.language === 'he');
        const texts = heVer?.text;
        if (!texts) return;
        const halacha = {
            ref: textData.heRef || halachaItem.displayValue?.he || '',
            category: halachaItem.category?.[1] || halachaItem.category?.[0] || '',
            url: halachaItem.url ? 'https://www.sefaria.org/' + halachaItem.url : '', // F127: Sefaria deeplink
            texts: Array.isArray(texts) ? texts.map(t => t.replace(/<[^>]+>/g, '').trim()).filter(Boolean) : [String(texts).replace(/<[^>]+>/g, '').trim()]
        };
        cSet(key, halacha);
        renderHalacha(halacha);
        diagLog('Halacha loaded: ' + halacha.ref);
    } catch (e) { console.error('Halacha:', e); }
}

function renderHalacha(data) {
    if (!el.ticker || !data?.texts?.length) return;
    _halachaData = data; // F157: store for overlay
    // Feature 48: prepend custom ticker announcement
    const customMsg = localStorage.getItem('dash_ticker_msg');
    function makeSet(isClone) {
        const f = document.createDocumentFragment();
        const refSpan = document.createElement('span'); refSpan.className = 'ticker-item' + (isClone ? ' clone' : '');
        const src = document.createElement('span'); src.className = 'ticker-src'; src.textContent = '📜 ' + data.ref;
        // F82: halacha category badge
        if (data.category && !isClone) {
            const cat = document.createElement('span'); cat.className = 'ticker-halacha-cat'; cat.textContent = data.category;
            // F106: color-code by topic type
            const c = data.category;
            if (/שב[תו]/.test(c)) cat.classList.add('hc-tag-shabbat');
            else if (/תפיל|תפלה|ברכ/.test(c)) cat.classList.add('hc-tag-tefila');
            else if (/כשר|אכיל|מאכל/.test(c)) cat.classList.add('hc-tag-kashrut');
            else if (/משפח|נדה|טהר|אישות/.test(c)) cat.classList.add('hc-tag-family');
            else if (/חג|מועד|פסח|סוכ|ראש השנה|יו"ט/.test(c)) cat.classList.add('hc-tag-moadim');
            refSpan.appendChild(cat);
        }
        // Feature 48: prepend custom announcement
        if (customMsg && !isClone) {
            const chip = document.createElement('span'); chip.className = 'ticker-custom'; chip.textContent = '📢 ' + customMsg;
            refSpan.appendChild(chip);
        }
        refSpan.appendChild(src); f.appendChild(refSpan);
        data.texts.forEach((text, i) => {
            const span = document.createElement('span'); span.className = 'ticker-item' + (isClone ? ' clone' : '');
            span.textContent = '(' + (i + 1) + ') ' + text;
            f.appendChild(span);
        });
        return f;
    }
    const frag = document.createDocumentFragment();
    frag.appendChild(makeSet(false)); // original set
    frag.appendChild(makeSet(true));  // identical clone — seamless wrap
    el.ticker.innerHTML = '';
    el.ticker.appendChild(frag);
    // Speed based on HALF total scrollWidth (content is exactly doubled)
    const w = el.ticker.scrollWidth / 2;
    el.ticker.style.animationDuration = Math.max(30, w / 140) + 's';
    // Feature 30: show first halacha segment in hc-card
    if (data.texts?.length && el.hcHalacha && el.hcHalachaRow) {
        const excerpt = data.texts[0].substring(0, 90);
        el.hcHalacha.textContent = excerpt + (data.texts[0].length > 90 ? '...' : '');
        el.hcHalachaRow.style.display = '';
        // F127: click halacha row to open Sefaria page
        if (data.url) {
            el.hcHalachaRow.onclick = () => { try { window.open(data.url, '_blank', 'noopener,noreferrer'); } catch (_) {} };
            el.hcHalachaRow.title = 'לחץ לקרוא ב-Sefaria';
        } else {
            el.hcHalachaRow.onclick = null;
        }
    }
}

// ── Stocks (multi-fallback, bezier charts) ──
// Refresh faster during market hours (5min), slower when closed (30min)
// R5.6: Shared NY-time helper (used by getStockTTL + updateMarketBadge)
function _getNYTime() {
    const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return { h: ny.getHours(), m: ny.getMinutes(), d: ny.getDay(), t: ny.getHours() * 60 + ny.getMinutes() };
}
function getStockTTL() {
    const { d, t } = _getNYTime();
    return (d >= 1 && d <= 5 && t >= 570 && t <= 960) ? 600000 : 1800000; // 10min open : 30min closed
}

/** Race all proxies for a URL — first successful response wins */
async function raceProxies(url, timeout = 5000) {
    const attempts = PROXIES.map(p => {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), timeout);
        return fetch(p + encodeURIComponent(url), { signal: c.signal })
            .then(async r => {
                const j = await r.json();
                clearTimeout(t);
                return { proxy: p, data: p.includes('allorigins') ? JSON.parse(j.contents) : j };
            })
            .catch(e => { clearTimeout(t); throw e; });
    });
    return Promise.any(attempts);
}

/** Batch-fetch all stock quotes via Yahoo v6 (single request for all symbols) */
async function loadAllStocks() {
    if (!_pageVisible || !acquireLock('stocks')) return;
    setSync('stocks', 'syncing'); let ok = false;
    const ttl = getStockTTL();
    const hiddenStocks = (localStorage.getItem('dash_stocks_hidden') || '').split(',').map(s => s.trim()).filter(Boolean);

    // Phase 1: Serve any cached data immediately (stale or fresh)
    const uncached = [];
    for (const sym of STOCK_SYMBOLS) {
        const blk = document.querySelector(`[data-symbol="${sym}"]`); if (!blk) continue;
        if (hiddenStocks.includes(sym)) { blk.style.display = 'none'; continue; }
        blk.style.display = '';
        const key = 'stk-' + sym;
        const fresh = cGet(key, ttl);
        if (fresh) { renderStock(blk, fresh, sym); ok = true; }
        else {
            const stale = cGetStale(key);
            if (stale) renderStock(blk, stale, sym);
            uncached.push(sym);
        }
    }

    // Phase 2: If all symbols are fresh-cached, we're done
    if (!uncached.length) {
        setSync('stocks', 'success');
        syncBurst('stocks'); recordSuccess('stocks');
        releaseLock('stocks');
        startStocksScroll();
        updateStockSummary(); // F155
        return;
    }

    // Phase 3: Individual v8 chart fetch (proxy-race, concurrency-limited to avoid rate limits)
    if (uncached.length) {
        const results = await runConcurrent(uncached.map(sym => () => loadStockSingle(sym)), 4);
        if (results.some(r => r.status === 'fulfilled' && r.value)) ok = true;
    }

    setSync('stocks', ok ? 'success' : 'error');
    if (ok) { syncBurst('stocks'); recordSuccess('stocks'); } else { recordFailure('stocks'); }
    releaseLock('stocks');
    startStocksScroll();
    updateStockSummary(); // F155: update gainers/losers summary bar
}

/** Load a single stock via Yahoo Finance v8 chart API.
 *  Uses bare URL (no period1/period2/interval params) — allorigins requires this.
 *  BTC-USD falls back to CoinGecko which supports browser CORS.
 */
async function loadStockSingle(sym) {
    const blk = document.querySelector(`[data-symbol="${sym}"]`); if (!blk) return false;
    const key = 'stk-' + sym;
    // BTC-USD: allorigins cannot reach Yahoo crypto tickers — use CoinGecko directly (CORS-enabled)
    if (sym === 'BTC-USD') {
        try {
            const cg = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
            if (cg?.bitcoin?.usd) {
                const price = cg.bitcoin.usd;
                const chgPct = cg.bitcoin.usd_24h_change || 0;
                const prev = price / (1 + chgPct / 100);
                const d = { chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: prev, previousClose: prev }, indicators: { quote: [{ close: [prev, price] }] } }] } };
                diagLog(`stock BTC-USD OK via CoinGecko`);
                cSet(key, d); renderStock(blk, d, sym); return true;
            }
        } catch (_) {}
    }
    try {
        // Bare URL (no query params) — avoids allorigins 522 timeouts caused by long URLs
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`;
        const { data, proxy } = await raceProxies(url, 8000);
        if (data.chart?.result?.[0]) {
            diagLog(`stock ${sym} v8 OK via ${proxy.includes('allorigins') ? 'allorigins' : 'codetabs'}`);
            cSet(key, data); renderStock(blk, data, sym); return true;
        }
    } catch (_) {}
    diagLog(`stock ${sym} FAILED all attempts`);
    if (!cGetStale(key)) {
        blk.querySelector('.stk-price').textContent = 'N/A';
        blk.querySelector('.stk-price').classList.remove('skeleton');
        blk.querySelector('.stk-chg').textContent = '--';
    }
    return false;
}
function startStocksScroll() {
    const cont = document.getElementById('stocks-body'); if (!cont) return;
    cont.style.animation = 'none';
    requestAnimationFrame(() => {
        const panelH = cont.parentElement?.clientHeight || 200;
        const dist = Math.max(0, cont.scrollHeight - panelH);
        if (dist <= 0) return;
        const dur = Math.max(30, STOCK_SYMBOLS.length * 4);
        injectScrollKeyframes('stocks-scroll-style', 'stocksScroll', dist);
        cont.style.animation = `stocksScroll ${dur}s linear infinite`;
    });
}
function fetchWithTimeout(url, ms = 8000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}
// R5.5: Refactored stock renderer — core + 3 extracted helpers
function renderStock(blk, data, sym) {
    const r = data.chart?.result?.[0]; if (!r) return;
    const meta = r.meta || {};
    const prices = (r.indicators?.quote?.[0]?.close || []).filter(p => p !== null && isFinite(p));
    const cur = meta.regularMarketPrice;
    const prev = meta.previousClose || meta.chartPreviousClose || cur;
    let chg = 0;
    if (prev && cur && isFinite(prev) && prev !== 0) chg = ((cur - prev) / prev) * 100;
    // 3-state trend: green (up), red (down), neutral (flat ±0.1%)
    const absChg = Math.abs(chg);
    const trend = (!isFinite(chg) || absChg < 0.1) ? 'neutral' : (chg > 0 ? 'positive' : 'negative');
    const trendColor = trend === 'positive' ? '#34d399' : trend === 'negative' ? '#f87171' : '#94a3b8';
    const brand = STOCK_META[sym] || {};
    const brandColor = brand.color || '#94a3b8';
    blk.style.borderRightColor = brandColor;
    const symEl = blk.querySelector('.stk-sym');
    if (symEl) symEl.style.color = brandColor;
    blk.classList.remove('stk-up', 'stk-down');
    if (trend === 'positive') blk.classList.add('stk-up');
    else if (trend === 'negative') blk.classList.add('stk-down');
    blk.querySelector('.stk-desc').textContent = STOCK_NAMES[sym] || 'מניה';
    const prEl = blk.querySelector('.stk-price');
    animateNumber(prEl, cur ? fmtPrice(cur, sym) : 'N/A');
    prEl.classList.remove('skeleton');
    const chEl = blk.querySelector('.stk-chg');
    if (isFinite(chg) && absChg >= 0.1) {
        animateNumber(chEl, `${chg > 0 ? '▲' : '▼'} ${chg > 0 ? '+' : ''}${chg.toFixed(2)}%`);
        chEl.className = `stk-chg ${trend}`;
    } else if (isFinite(chg)) {
        animateNumber(chEl, `● ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`);
        chEl.className = 'stk-chg neutral';
    } else { animateNumber(chEl, '—'); chEl.className = 'stk-chg'; }
    if (prices.length >= 2) { blk.querySelector('.stk-chart').innerHTML = bezierChart(prices, trendColor); }
    else if (prices.length === 1 && cur) { blk.querySelector('.stk-chart').innerHTML = bezierChart([prices[0], prices[0] * 0.999, prices[0] * 1.001, cur], trendColor); }
    blk.querySelector('.stk-time').textContent = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    if (cur) { updatePortfolioPnL(sym, cur); _stkPrices[sym] = cur; checkStockAlerts(sym, cur); updatePortfolioTotal(); }
    const low52 = meta.fiftyTwoWeekLow, high52 = meta.fiftyTwoWeekHigh;
    if (cur && low52 && high52) updateStockRange(blk, cur, low52, high52);
    _renderStockExtended(blk, meta, sym, cur);
    if (cur) recordStkPrice(sym, cur);
    drawStkSpark(blk, sym);
    _initStockLogo(blk, sym, brand, brandColor);
}
// R5.5 helper: after-hours/pre-market price + portfolio position + volume badge
function _renderStockExtended(blk, meta, sym, cur) {
    // F137: after-hours / pre-market secondary price line
    const extPrice = meta.postMarketPrice || meta.preMarketPrice;
    const extChg = meta.postMarketChangePercent ?? meta.preMarketChangePercent;
    const extLbl = meta.postMarketPrice ? '(after)' : meta.preMarketPrice ? '(pre)' : null;
    let afterEl = blk.querySelector('.stk-after-price');
    if (extPrice && extLbl) {
        if (!afterEl) { afterEl = document.createElement('div'); afterEl.className = 'stk-after-price'; blk.querySelector('.stk-vals')?.appendChild(afterEl); }
        const sign = (extChg ?? 0) >= 0 ? '+' : '';
        afterEl.textContent = `${fmtPrice(extPrice, sym)} ${extLbl} ${isFinite(extChg) ? sign + extChg.toFixed(2) + '%' : ''}`;
        afterEl.style.color = !isFinite(extChg) || Math.abs(extChg) < 0.1 ? '' : extChg > 0 ? '#34d399' : '#f87171';
    } else if (afterEl) { afterEl.remove(); }
    // F149: Per-stock portfolio position P&L row
    const pos = _getPortfolio()[sym];
    if (pos?.qty && pos?.cost && cur && isFinite(cur)) {
        const posPnl = (cur - pos.cost) * pos.qty;
        const posPct = pos.cost > 0 ? ((cur - pos.cost) / pos.cost) * 100 : 0;
        let posEl = blk.querySelector('.stk-pos-pnl');
        if (!posEl) { posEl = document.createElement('div'); posEl.className = 'stk-pos-pnl'; blk.querySelector('.stk-vals')?.appendChild(posEl); }
        const posSign = posPnl >= 0 ? '+' : '';
        posEl.textContent = `פוז׳: ${posSign}$${Math.abs(posPnl).toFixed(0)} (${posSign}${posPct.toFixed(1)}%)`;
        posEl.className = 'stk-pos-pnl ' + (posPnl >= 0 ? 'gain' : 'loss');
    }
    // Feature 61: Relative volume badge
    const regVol = meta.regularMarketVolume;
    const avgVol = meta.averageDailyVolume3Month || meta.averageDailyVolume10Day;
    const volBadge = getRelVolBadge(regVol, avgVol);
    let volBadgeEl = blk.querySelector('.stk-vol-badge');
    if (volBadge) {
        if (!volBadgeEl) { volBadgeEl = document.createElement('span'); blk.querySelector('.stk-chg')?.insertAdjacentElement('afterend', volBadgeEl); }
        volBadgeEl.className = `stk-vol-badge ${volBadge.cls}`;
        volBadgeEl.textContent = volBadge.text;
    } else if (volBadgeEl) { volBadgeEl.remove(); }
}
// R5.5 helper: one-time logo setup per stock row
function _initStockLogo(blk, sym, brand, brandColor) {
    const logoDiv = blk.querySelector('.stk-logo');
    const img = logoDiv?.querySelector('img');
    if (!img || img.dataset.logoInit) return;
    img.dataset.logoInit = '1';
    img.removeAttribute('style');
    img.removeAttribute('onerror');
    if (brand.domain) img.src = `https://www.google.com/s2/favicons?domain=${brand.domain}&sz=64`;
    img.addEventListener('error', () => {
        img.style.display = 'none';
        if (!logoDiv.querySelector('.stk-logo-fb')) {
            const fb = document.createElement('span');
            fb.className = 'stk-logo-fb';
            fb.textContent = sym.replace('^', '').replace('-USD', '').slice(0, 2).toUpperCase();
            fb.style.background = brandColor;
            logoDiv.appendChild(fb);
        }
    });
}
function fmtPrice(p, s) { const n = parseFloat(p); if (s === 'BTC-USD') return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }); return n >= 1000 ? '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n >= 100 ? '$' + n.toFixed(1) : '$' + n.toFixed(2); }
let _svgIdCounter = 0;
function bezierChart(prices, col) {
    if (!prices || prices.length < 2) return '';
    const W = 200, H = 28, P = 2; const min = Math.min(...prices), max = Math.max(...prices), rng = max - min || 1;
    const pts = prices.map((p, i) => ({ x: P + (i / (prices.length - 1)) * (W - 2 * P), y: P + (1 - (p - min) / rng) * (H - 2 * P) }));
    let path = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
        const cp = (pts[i].x - pts[i - 1].x) / 2;
        path += ` C${pts[i - 1].x + cp},${pts[i - 1].y} ${pts[i].x - cp},${pts[i].y} ${pts[i].x},${pts[i].y}`;
    }
    const area = path + ` L${pts[pts.length - 1].x},${H - P} L${pts[0].x},${H - P} Z`;
    const gid = 'sg' + (++_svgIdCounter);
    const last = pts[pts.length - 1];
    return `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.5"/><stop offset="100%" stop-color="${col}" stop-opacity="0.03"/></linearGradient></defs><path d="${area}" fill="url(#${gid})"/><path d="${path}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round"/><circle cx="${last.x}" cy="${last.y}" r="2.5" fill="${col}" opacity="0.9"/><circle cx="${last.x}" cy="${last.y}" r="4" fill="${col}" opacity="0.2"/>`;
}

// R5.8: Currency Rates — ER-API (primary) + ExchangeRate-API (fallback)
const CUR_APIS = ['https://open.er-api.com/v6/latest/ILS', 'https://api.exchangerate-api.com/v4/latest/ILS'];
const CUR_TTL = 1800000; // 30min
async function loadCurrency() {
    if (!_pageVisible || !acquireLock('cur')) return;
    setSync('cur', 'syncing');
    const key = 'cur';
    const fresh = cGet(key, CUR_TTL);
    if (fresh) { renderCurrency(fresh); setSync('cur', 'success'); releaseLock('cur'); return; }
    const stale = cGetStale(key); if (stale) renderCurrency(stale);
    let ok = false;
    for (const api of CUR_APIS) {
        try {
            const d = await fetchJSON(api);
            if (d.rates) { cSet(key, d.rates); renderCurrency(d.rates); setSync('cur', 'success'); syncBurst('cur'); recordSuccess('cur'); ok = true; break; }
        } catch (_) { /* try next */ }
    }
    if (!ok) { setSync('cur', stale ? 'success' : 'error'); recordFailure('cur'); }
    releaseLock('cur');
}
let _prevRates = null;
// R5.9: Unified currency tiles config — pairs + metals in one array
const CUR_TILES = [
    { code: 'USD', el: 'curUsd', chgEl: 'curUsdChg', decimals: 3, threshold: 0.0005, prefix: '₪', sparkId: 'usd', histKey: 'usd' },
    { code: 'EUR', el: 'curEur', chgEl: 'curEurChg', decimals: 3, threshold: 0.0005, prefix: '₪', sparkId: 'eur', histKey: 'eur' },
    { code: 'GBP', el: 'curGbp', chgEl: 'curGbpChg', decimals: 3, threshold: 0.0005, prefix: '₪', sparkId: 'gbp', histKey: 'gbp' },
    { code: 'XAU', el: 'curGold', chgEl: 'curGoldChg', decimals: 0, threshold: 5, prefix: '₪', sparkId: 'gold', histKey: 'gold' },
    { code: 'XAG', el: 'curSilver', chgEl: 'curSilverChg', decimals: 1, threshold: 1, prefix: '₪', sparkId: 'silver', histKey: 'silver' },
];
function renderCurrency(rates) {
    const container = document.getElementById('currency-body');
    for (const tile of CUR_TILES) {
        const rateEl = el[tile.el], chgEl = el[tile.chgEl];
        if (!rateEl) continue;
        const raw = rates[tile.code];
        const val = raw ? (1 / raw) : null;
        const display = val ? tile.prefix + (tile.decimals === 0 ? Math.round(val).toLocaleString('he-IL') : val.toFixed(tile.decimals)) : '--';
        animateNumber(rateEl, display);
        rateEl.classList.remove('skeleton');
        // Change indicator vs previous fetch
        if (chgEl && _prevRates?.[tile.code] && val) {
            const prevVal = 1 / _prevRates[tile.code];
            const diff = tile.decimals === 0 ? Math.round(val) - Math.round(prevVal) : val - prevVal;
            if (Math.abs(diff) > tile.threshold) {
                chgEl.textContent = (diff > 0 ? '▲' : '▼') + ' ' + Math.abs(tile.decimals === 0 ? diff : +diff.toFixed(tile.decimals));
                chgEl.className = 'cur-chg ' + (diff > 0 ? 'positive' : 'negative');
            } else { chgEl.textContent = ''; chgEl.className = 'cur-chg'; }
        } else if (chgEl) { chgEl.textContent = ''; }
    }
    _prevRates = { ...rates };
    // Record history + draw sparklines
    const histValues = {};
    for (const tile of CUR_TILES) {
        histValues[tile.histKey] = rates[tile.code] ? (tile.decimals === 0 ? Math.round(1 / rates[tile.code]) : (1 / rates[tile.code])) : 0;
    }
    if (histValues.usd && histValues.eur) {
        recordCurrencyHistory(histValues.usd, histValues.eur, histValues.gold, histValues.silver, histValues.gbp);
        renderCurrencySparklines();
    }
    if (container) { container.classList.remove('data-fresh'); void container.offsetWidth; container.classList.add('data-fresh'); }
}

// ── Red Alerts — צבע אדום (dynamic adaptive polling via api.tzevaadom.co.il) ──
const ALERT_URL = 'https://api.tzevaadom.co.il/alerts-history';
const THREAT_LABELS = { 0: '🚀 ירי רקטות', 1: '🚀 ירי רקטות', 5: '✈️ כלי טיס עוין' };
let _lastAlertId = null;
let _alertsHaveActive = false;
let _alertTimer = null;
let _alertRealtime = localStorage.getItem('dash_alert_rt') === 'on';
const ALERT_INTERVAL_ACTIVE = 60000;  // 60s when active alerts
const ALERT_INTERVAL_RT     = 10000;  // 10s real-time mode
const ALERT_INTERVAL_IDLE   = 300000; // 5min when no recent alerts

// R6.5: Notify on new alert — beep + desktop notification
function _notifyNewAlert(data) {
    playAlertBeep(880, 0.18, 0.3);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const cities = data[0]?.alerts?.flatMap(a => a.cities ?? []).slice(0, 3).join(', ') || 'אזורים שונים';
        try { new Notification('⚠️ צבע אדום', { body: cities, icon: './favicon.ico', dir: 'rtl', lang: 'he' }); } catch (_) {}
    }
}

async function loadAlerts() {
    if (!_alertsOn) return;
    if (!_pageVisible) { scheduleAlerts(); return; }
    setSync('alerts', 'syncing');
    const key = 'alerts';
    const stale = cGetStale(key); if (stale) renderAlerts(stale, false);
    try {
        // R6.5: direct → proxy fallback loop (same pattern as R6.2)
        let data;
        const sources = [
            { url: ALERT_URL, extract: r => r.json() },
            ...PROXIES.map(p => ({
                url: p + encodeURIComponent(ALERT_URL),
                extract: r => p.includes('allorigins') ? r.json().then(j => JSON.parse(j.contents)) : r.json()
            })),
        ];
        for (const src of sources) {
            try {
                const r = await fetch(src.url);
                if (!r.ok) continue;
                data = await src.extract(r);
                if (Array.isArray(data) && data.length) break;
                data = null;
            } catch (_) { continue; }
        }
        if (Array.isArray(data) && data.length) {
            const newTopId = data[0]?.id ?? null;
            const isNew = _lastAlertId !== null && newTopId !== _lastAlertId;
            _lastAlertId = newTopId;
            if (isNew) _notifyNewAlert(data);
            cSet(key, data);
            renderAlerts(data, isNew);
            setSync('alerts', 'success'); syncBurst('alerts'); recordSuccess('alerts');
            const now = Date.now() / 1000;
            _alertsHaveActive = data.some(ev => ev.alerts?.some(a => (now - a.time) < 600));
        } else {
            _alertsHaveActive = false;
            setSync('alerts', stale ? 'success' : 'error'); recordFailure('alerts');
        }
    } catch (e) { console.error('Alerts:', e); setSync('alerts', stale ? 'success' : 'error'); recordFailure('alerts'); }
    scheduleAlerts();
}

function scheduleAlerts() {
    if (_alertTimer) clearTimeout(_alertTimer);
    const interval = _alertsHaveActive ? (_alertRealtime ? ALERT_INTERVAL_RT : ALERT_INTERVAL_ACTIVE) : ALERT_INTERVAL_IDLE;
    _alertTimer = setTimeout(loadAlerts, interval);
}

// R6.6: Build a single alert event DOM element
function _buildAlertItem(ev, now, isHighlightFirst, isClone) {
    if (!ev.alerts?.length) return null;
    const firstAlert = ev.alerts[0];
    const allCities = ev.alerts.flatMap(a => a.cities);
    const threat = ev.alerts.reduce((mx, a) => Math.max(mx, a.threat ?? 0), 0);
    const ageMin = Math.floor((now - firstAlert.time) / 60);
    const div = document.createElement('div');
    div.className = 'alert-item' + (ageMin < 10 ? ' active' : ' past') + (isHighlightFirst ? ' new-alert' : '') + (isClone ? ' clone' : '');
    const cities = document.createElement('div');
    cities.className = 'alert-cities';
    const unique = [...new Set(allCities)];
    cities.textContent = unique.length > 5 ? unique.slice(0, 5).join(', ') + ` (+${unique.length - 5})` : unique.join(', ');
    div.appendChild(cities);
    const meta = document.createElement('div');
    meta.className = 'alert-meta';
    const time = document.createElement('span');
    time.className = 'alert-time';
    const d = new Date(firstAlert.time * 1000);
    time.textContent = relTime(d.toISOString()) + ' | ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    meta.appendChild(time);
    const thr = document.createElement('span');
    thr.className = 'alert-threat';
    thr.textContent = THREAT_LABELS[threat] || '⚠️ התרעה';
    meta.appendChild(thr);
    div.appendChild(meta);
    return div;
}

function renderAlerts(data, highlightNew) {
    if (!el.alertsScroll || !Array.isArray(data)) return;
    if (highlightNew) {
        _unreadAlerts++;
        if (el.alertsBadge) { el.alertsBadge.textContent = _unreadAlerts; el.alertsBadge.style.display = ''; }
    }
    const filtered = filterAlertsByZone(data);
    const now = Date.now() / 1000;
    let total24h = 0;
    for (const ev of filtered) { for (const a of ev.alerts) { if (now - a.time < 86400) total24h++; } }
    const recentEvents = filtered.slice(0, 25);
    const hasActive = filtered.some(ev => ev.alerts?.some(a => (now - a.time) < 600));

    // Build items twice for seamless scroll loop
    const frag = document.createDocumentFragment();
    for (const isClone of [false, true]) {
        const counter = document.createElement('div');
        counter.className = 'alert-count' + (isClone ? ' clone' : '');
        counter.textContent = '🚨 ' + total24h + ' התרעות ב-24 שעות האחרונות';
        if (hasActive && !isClone) {
            const dot = document.createElement('span');
            dot.className = 'alert-live-dot';
            dot.title = 'התרעה פעילה';
            counter.appendChild(dot);
        }
        frag.appendChild(counter);
        if (!recentEvents.length) {
            const empty = document.createElement('div');
            empty.className = 'alert-count';
            empty.textContent = '✅ אין התרעות אחרונות';
            frag.appendChild(empty);
        } else {
            for (let i = 0; i < recentEvents.length; i++) {
                const item = _buildAlertItem(recentEvents[i], now, highlightNew && i === 0 && !isClone, isClone);
                if (item) frag.appendChild(item);
            }
        }
    }
    el.alertsScroll.innerHTML = '';
    el.alertsScroll.appendChild(frag);
    // Dynamic keyframe for scroll animation
    const h = el.alertsScroll.scrollHeight / 2;
    const dur = Math.max(25, recentEvents.length * 4);
    injectScrollKeyframes('alerts-scroll-style', 'alertsScroll', h);
    el.alertsScroll.style.animation = `alertsScroll ${dur}s linear infinite`;
}

// ── Google Calendar (ICS native render) ──
const CAL_ICS = 'https://calendar.google.com/calendar/ical/rajwan.family%40gmail.com/public/basic.ics';
const CAL_DAYS_AHEAD = 21;
const CAL_TTL = 900000; // 15 min

// R6.4: Fetch secondary ICS sources and merge with primary calendar
async function loadCalendarExtra() {
    if (!_pageVisible) return;
    const extra = [];
    for (let i = 2; i <= 3; i++) {
        const url = localStorage.getItem(`dash_ics_url_${i}`);
        if (!url) continue;
        const key = `cal-ics-${i}`;
        const fresh = cGet(key, CAL_TTL);
        if (fresh) { extra.push(...parseICS(fresh, i)); continue; }
        const stale = cGetStale(key); if (stale) extra.push(...parseICS(stale, i));
        try {
            const r = await fetchWithTimeout(url, 10000);
            if (r.ok) {
                const t = await r.text();
                if (t.includes('BEGIN:VCALENDAR')) { cSet(key, t); extra.push(...parseICS(t, i)); diagLog(`cal-extra-${i} OK`); }
            }
        } catch (e) { diagLog(`cal-extra-${i} ERR: ` + e.message); }
    }
    if (!extra.length) return;
    const primary = parseICS(cGetStale('cal-ics') || '', 1);
    const merged = [...primary, ...extra].sort((a, b) => a.start - b.start);
    renderCalendar(merged);
    updateTodayEventCount();
    diagLog(`cal-extra merged: ${extra.length} extra events`);
}

// R6.1: ICS date parser — handles YYYYMMDD (all-day) and YYYYMMDDTHHmmSS[Z]
function _parseICSDate(raw) {
    if (!raw) return null;
    if (raw.length === 8) return new Date(raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8) + 'T00:00:00');
    const s = raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/, '$1-$2-$3T$4:$5:$6' + (raw.endsWith('Z') ? 'Z' : ''));
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}
// R6.1: Unescape ICS text values
function _unescapeICS(str, sep = ' ') {
    return (str || '').replace(/\\,/g, ',').replace(/\\n/g, sep).replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseICS(text, icsIdx = 0) {
    const events = [];
    const blocks = text.split('BEGIN:VEVENT');
    for (let i = 1; i < blocks.length; i++) {
        const unfolded = blocks[i].replace(/\r?\n[ \t]/g, '');
        const get = key => {
            const m = unfolded.match(new RegExp('(?:^|\n)' + key + '(?:;[^:]*)?:([^\r\n]+)', 'i'));
            return m ? m[1].trim() : null;
        };
        const dtRaw = get('DTSTART') || '';
        const summary = _unescapeICS(get('SUMMARY'));
        if (!dtRaw || !summary) continue;
        const start = _parseICSDate(dtRaw);
        if (!start) continue;
        const allDay = dtRaw.length === 8;
        const end = allDay ? null : _parseICSDate(get('DTEND') || '');
        const location = _unescapeICS(get('LOCATION'), ', ');
        events.push({ start, end, allDay, summary, location, icsIdx });
    }
    return events;
}

// R6.3: Build a single calendar event row element
function _renderCalEvent(ev, isConflict) {
    const row = document.createElement('div');
    row.className = 'cal-event' + (isConflict ? ' has-conflict' : '');
    if (ev.icsIdx) row.dataset.ics = String(ev.icsIdx);
    const timeEl = document.createElement('div');
    timeEl.className = 'cal-event-time';
    timeEl.textContent = ev.allDay
        ? 'כל היום'
        : ev.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    if (!ev.allDay && ev.end && ev.end > ev.start) {
        const endStr = ev.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
        const durMin = Math.round((ev.end - ev.start) / 60000);
        const durStr = durMin >= 60 ? `${Math.floor(durMin / 60)}:${String(durMin % 60).padStart(2, '0')}h` : `${durMin}m`;
        timeEl.textContent += `–${endStr} (${durStr})`;
    }
    const titleEl = document.createElement('div');
    titleEl.style.flex = '1';
    const catRow = document.createElement('div');
    catRow.style.cssText = 'display:flex;align-items:flex-start;gap:2px';
    const dot = document.createElement('span');
    dot.className = 'cal-dot cal-dot-' + detectCalCategory(ev.summary);
    catRow.appendChild(dot);
    const titleLine = document.createElement('div');
    titleLine.className = 'cal-event-title';
    titleLine.textContent = ev.summary;
    catRow.appendChild(titleLine);
    titleEl.appendChild(catRow);
    if (ev.location) {
        const locEl = document.createElement('div');
        locEl.className = 'cal-event-loc';
        locEl.textContent = '\uD83D\uDCCD ' + ev.location;
        titleEl.appendChild(locEl);
    }
    row.appendChild(timeEl);
    row.appendChild(titleEl);
    return row;
}

// R6.3: Update countdown badge for next upcoming event
function _renderCalCountdown(upcoming, now) {
    if (!el.calCountdown) return;
    const next7 = upcoming.filter(e => e.start > now && (e.start - now) < 7 * 86400000);
    if (next7.length) {
        const ev = next7[0];
        const days = Math.ceil((ev.start - now) / 86400000);
        const label = days === 0 ? 'היום' : days === 1 ? 'מחר' : `עוד ${days} ימים`;
        el.calCountdown.textContent = `${label}: ${(ev.summary || '').substring(0, 20)}`;
        el.calCountdown.style.display = '';
    } else {
        el.calCountdown.style.display = 'none';
    }
}

function renderCalendar(events) {
    renderCalWeekStrip(events);
    _renderCalTodayStrip(events);
    const now = new Date();
    const cutoff = new Date(now.getTime() + CAL_DAYS_AHEAD * 86400000);
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = events
        .filter(e => e.start >= todayMidnight && e.start <= cutoff)
        .sort((a, b) => a.start - b.start);

    // Detect overlapping timed events
    const conflictSet = new Set();
    const timed = upcoming.filter(e => !e.allDay && e.end);
    for (let i = 0; i < timed.length; i++) {
        for (let j = i + 1; j < timed.length; j++) {
            if (timed[j].start >= timed[i].end) break;
            conflictSet.add(timed[i]); conflictSet.add(timed[j]);
        }
    }

    const frag = document.createDocumentFragment();
    if (!upcoming.length) {
        const empty = document.createElement('div');
        empty.className = 'cal-empty';
        empty.textContent = 'אין אירועים ב-21 הימים הקרובים';
        frag.appendChild(empty);
    } else {
        let lastDateKey = null;
        const todayKey = now.toDateString();
        for (const ev of upcoming) {
            const dateKey = ev.start.toDateString();
            if (dateKey !== lastDateKey) {
                lastDateKey = dateKey;
                const hdr = document.createElement('div');
                hdr.className = 'cal-day-header' + (dateKey === todayKey ? ' today' : '');
                const dayHe = ev.start.toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
                const dateFmt = ev.start.toLocaleDateString('he-IL', { day: '2-digit', month: 'long', timeZone: 'Asia/Jerusalem' });
                hdr.textContent = dayHe + ' · ' + dateFmt;
                frag.appendChild(hdr);
            }
            frag.appendChild(_renderCalEvent(ev, conflictSet.has(ev)));
        }
    }
    if (el.calAgenda) {
        el.calAgenda.innerHTML = '';
        el.calAgenda.appendChild(frag);
    }
    _renderCalCountdown(upcoming, now);
    return upcoming.length;
}

// R6.2: Validate and store ICS data (extracted from loadCalendar for reuse)
function _acceptICS(icsText, source) {
    if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) return false;
    const events = parseICS(icsText);
    diagLog(`calendar ${source} OK (${icsText.length} bytes, ${events.length} events)`);
    cSet('cal-ics', icsText);
    const count = renderCalendar(events);
    if (count > 0) el.calAgenda?.closest('.cal-wrapper')?.classList.add('ics-loaded');
    updateTodayEventCount();
    setSync('cal', 'success'); syncBurst('cal'); recordSuccess('cal');
    return true;
}

async function loadCalendar() {
    if (!_pageVisible || !acquireLock('cal')) return;
    const CAL_ICS_ACTIVE = localStorage.getItem('dash_ics_url') || CAL_ICS;
    const key = 'cal-ics';
    const fresh = cGet(key, CAL_TTL);
    if (fresh) {
        const count = renderCalendar(parseICS(fresh));
        if (count > 0) el.calAgenda?.closest('.cal-wrapper')?.classList.add('ics-loaded');
        updateTodayEventCount();
        setSync('cal', 'success'); releaseLock('cal'); return;
    }
    const staleText = cGetStale(key);
    if (staleText) renderCalendar(parseICS(staleText));
    setSync('cal', 'syncing');

    // R6.2: Build ordered source list — direct → CORS proxies → corsproxy.io
    const sources = [
        { url: CAL_ICS_ACTIVE, name: 'direct', timeout: 10000, extract: r => r.text() },
        ...PROXIES.map(p => ({
            url: p + encodeURIComponent(CAL_ICS_ACTIVE),
            name: p.includes('allorigins') ? 'allorigins' : 'codetabs',
            timeout: 12000,
            extract: r => p.includes('allorigins') ? r.json().then(j => j.contents) : r.text()
        })),
        { url: 'https://corsproxy.io/?' + encodeURIComponent(CAL_ICS), name: 'corsproxy.io', timeout: 12000, extract: r => r.text() },
    ];
    for (const src of sources) {
        try {
            diagLog(`calendar: trying ${src.name}...`);
            const r = await fetchWithTimeout(src.url, src.timeout);
            if (!r.ok) { diagLog(`calendar ${src.name} HTTP ${r.status}`); continue; }
            const icsText = await src.extract(r);
            if (_acceptICS(icsText, src.name)) { releaseLock('cal'); return; }
            diagLog(`calendar ${src.name} no VCALENDAR (len=${(icsText || '').length})`);
        } catch (e) { diagLog(`calendar ${src.name} ERR: ${e.message}`); }
    }
    diagLog('calendar ALL FAILED — iframe embed remains visible');
    setSync('cal', 'error'); recordFailure('cal');
    releaseLock('cal');
}

// ── R6.8: Motivation (2-min rotation, crossfade) ──
function _setMotiContent(m) {
    el.motiText.textContent = m.t;
    el.motiAuthor.textContent = m.a ? '— ' + m.a : '';
    el.motiSrc.textContent = '';
}
function _shareMoti(m) {
    const text = m.t + (m.a ? ' — ' + m.a : '');
    if (navigator.share) {
        navigator.share({ text }).catch(() => {});
    } else {
        navigator.clipboard?.writeText(text).then(() => showToast('📋 הציטוט הועתק!')).catch(() => {});
    }
}
function loadMotivation() {
    const card = el.motiText?.closest('.moti-card');
    const m = MOTIVATIONS[motiIdx++ % MOTIVATIONS.length];
    if (card) {
        card.style.transition = 'opacity 0.5s ease';
        card.style.opacity = '0';
        setTimeout(() => { _setMotiContent(m); card.style.opacity = '1'; }, 500);
    } else {
        _setMotiContent(m);
    }
    if (el.motiShareBtn) el.motiShareBtn.onclick = () => _shareMoti(m);
    if (el.motiNextBtn) el.motiNextBtn.onclick = () => loadMotivation();
    setSync('moti', 'success');
}

// ── Per-Pane Refresh Scheduler ──
//  Each pane refreshes independently — no full-page reload.
//  Intervals are chosen by how fast each data source changes.
//  ┌──────────────┬──────────┬─────────────────────────────────────┐
//  │ Pane         │ Interval │ Reasoning                           │
//  ├──────────────┼──────────┼─────────────────────────────────────┤
//  │ Alerts       │ 60s/5min │ 60s when active alerts, 5min idle   │
//  │ Clock        │ 1min     │ No seconds — minute granularity     │
//  │ Market badge │ 5min     │ Local time check, cheap             │
//  │ News+Ticker  │ 15min    │ RSS feeds, low-cadence              │
//  │ Stocks       │ 10min/30m│ 10min when NYSE open, 30min closed  │
//  │ Weather      │ 30min    │ Weather changes slowly              │
//  │ Currency     │ 1h       │ Exchange rates drift slowly         │
//  │ Calendar     │ 15min    │ ICS fetch, 21-day window            │
//  │ Motivation   │ 4h       │ Static rotation, no external API    │
//  │ Hebrew date  │ 3h       │ Changes once per day                │
//  │ Shabbat      │ 6h       │ Changes once per week               │
//  │ Holidays     │ 12h      │ Changes rarely                      │
//  └──────────────┴──────────┴─────────────────────────────────────┘

function stampRefresh() {
    el.refresh.textContent = 'רענון: ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    const uptEl = document.getElementById('uptime-display');
    if (uptEl) uptEl.textContent = '⏱ ' + getUptime();
}

// ── Screen Mode Selector ──
const SCREEN_MODES = ['tv', 'tablet', 'phone'];
function applyScreenMode(mode) {
    if (!SCREEN_MODES.includes(mode)) mode = 'tv';
    document.body.classList.remove(...SCREEN_MODES.map(m => 'mode-' + m));
    document.body.classList.add('mode-' + mode);
    try { localStorage.setItem('dash_screenMode', mode); } catch (_) {}
    const sel = document.getElementById('screen-mode-select');
    if (sel && sel.value !== mode) sel.value = mode;
}
function initScreenMode() {
    const saved = localStorage.getItem('dash_screenMode') || 'tv';
    applyScreenMode(saved);
    const sel = document.getElementById('screen-mode-select');
    if (sel) sel.addEventListener('change', e => applyScreenMode(e.target.value));
}

// ── R6.7: Alerts Toggle (show/hide red alerts pane) ──
let _alertsOn = true;
let _alertsToggleSel = null;
function applyAlerts(state) {
    _alertsOn = state === 'on';
    document.body.classList.toggle('alerts-off', !_alertsOn);
    try { localStorage.setItem('dash_alerts', state); } catch (_) {}
    if (_alertsToggleSel && _alertsToggleSel.value !== state) _alertsToggleSel.value = state;
    if (!_alertsOn && _alertTimer) { clearTimeout(_alertTimer); _alertTimer = null; }
    if (_alertsOn && !_alertTimer) loadAlerts();
    startStocksScroll();
}
function initAlerts() {
    _alertsToggleSel = document.getElementById('alerts-toggle');
    applyAlerts(localStorage.getItem('dash_alerts') || 'off');
    if (_alertsToggleSel) _alertsToggleSel.addEventListener('change', e => applyAlerts(e.target.value));
}

const THEMES = ['black', 'blue', 'matrix', 'amber', 'purple'];
function applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'black';
    document.body.classList.remove(...THEMES.map(t => 'theme-' + t));
    document.body.classList.add('theme-' + theme);
    try { localStorage.setItem('dash_theme', theme); } catch (_) {}
    const sel = document.getElementById('theme-select');
    if (sel && sel.value !== theme) sel.value = theme;
}
function cycleTheme() {
    const cur = THEMES.findIndex(t => document.body.classList.contains('theme-' + t));
    applyTheme(THEMES[(cur + 1) % THEMES.length]);
}
function initTheme() {
    const saved = localStorage.getItem('dash_theme') || 'black';
    applyTheme(saved);
    const sel = document.getElementById('theme-select');
    if (sel) sel.addEventListener('change', e => applyTheme(e.target.value));
    // Keyboard shortcut: press T to cycle themes, D for diagnostics
    document.addEventListener('keydown', e => {
        if (e.key === 't' || e.key === 'T') cycleTheme();
        if (e.key === 'a' || e.key === 'A') applyAlerts(_alertsOn ? 'off' : 'on');
        if (e.key === 's' || e.key === 'S') toggleConfig();
        if (e.key === 'n' || e.key === 'N') toggleNightDim();  // Feature 54
        if (e.key === 'r' || e.key === 'R') forceRefresh();    // Feature 59
        if (e.key === 'd' || e.key === 'D') toggleDiag();
        if (e.key === 'm' || e.key === 'M') toggleAlertSound();
        if (e.key === 'p' || e.key === 'P') window.print(); // Feature 50
        if (e.key === '+' || e.key === '=') adjustFontScale(0.05);  // Feature 49
        if (e.key === '-' || e.key === '_') adjustFontScale(-0.05); // Feature 49
        if (e.key === 'f' || e.key === 'F') toggleFullscreen();
        if (e.key === 'b' || e.key === 'B') toggleNewsBookmarkFilter(); // F156
        if (e.key === '?' || e.key === 'h' || e.key === 'H') toggleHelp(); // F150: H as alt help
        if (e.key === 'Escape' && _maximizedCard) toggleCardMaximize(_maximizedCard);
        if (e.key === 'Escape' && el.helpOverlay?.classList.contains('visible')) toggleHelp();
        if (e.key === 'Escape' && el.halachaOverlay?.classList.contains('visible')) _closeHalachaOverlay(); // F157
        if (e.key === 'Escape' && document.getElementById('config-overlay')?.classList.contains('visible')) toggleConfig();
    });
}

// ── Feature: Fullscreen (F key) ──
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}


// ── Feature 99: Card drag-reorder within columns ──
const _COL_FLEX = {
    left:  [65, 35],
    mid:   [20, 65, 15],
    right: [1, 1, 1]
};

function _reapplyColFlex(col) {
    const colId = col.classList.contains('grid-col-left') ? 'left'
                : col.classList.contains('grid-col-mid') ? 'mid' : 'right';
    const flex = _COL_FLEX[colId] || [];
    [...col.querySelectorAll(':scope > .card')].forEach((card, i) => {
        card.style.flex = `${flex[i] ?? 1} 1 0`;
    });
}

function initCardDrag() {
    document.querySelectorAll('.grid-col').forEach(col => {
        const colId = col.classList.contains('grid-col-left') ? 'left'
                    : col.classList.contains('grid-col-mid') ? 'mid' : 'right';
        // Restore saved order
        const saved = localStorage.getItem(`dash_card_order_${colId}`);
        if (saved) {
            const ids = saved.split(',');
            const cards = [...col.querySelectorAll(':scope > .card')];
            const ordered = ids.map(id => cards.find(c => c.dataset.cardId === id)).filter(Boolean);
            const remaining = cards.filter(c => !ids.includes(c.dataset.cardId));
            [...ordered, ...remaining].forEach(c => col.appendChild(c));
        }
        _reapplyColFlex(col);

        // Wire drag events on headers
        col.querySelectorAll(':scope > .card').forEach(card => {
            const header = card.querySelector('.card-header');
            if (!header) return;
            header.setAttribute('draggable', 'true');
            header.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', card.dataset.cardId || '');
                e.dataTransfer.effectAllowed = 'move';
                requestAnimationFrame(() => card.classList.add('dragging'));
            });
            header.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                col.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            });
        });

        col.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const target = e.target.closest('.card');
            if (!target || target.classList.contains('dragging')) return;
            col.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            target.classList.add('drag-over');
        });

        col.addEventListener('dragleave', e => {
            if (!col.contains(e.relatedTarget)) {
                col.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
            }
        });

        col.addEventListener('drop', e => {
            e.preventDefault();
            const srcId = e.dataTransfer.getData('text/plain');
            const target = e.target.closest('.card');
            const srcCard = col.querySelector(`[data-card-id="${srcId}"]`);
            col.querySelectorAll('.drag-over, .dragging').forEach(c => c.classList.remove('drag-over', 'dragging'));
            if (!srcCard || !target || srcCard === target) return;
            const cards = [...col.querySelectorAll(':scope > .card')];
            const tgtIdx = cards.indexOf(target);
            const srcIdx = cards.indexOf(srcCard);
            if (srcIdx < tgtIdx) target.after(srcCard);
            else target.before(srcCard);
            _reapplyColFlex(col);
            const order = [...col.querySelectorAll(':scope > .card')].map(c => c.dataset.cardId).join(',');
            localStorage.setItem(`dash_card_order_${colId}`, order);
            diagLog(`Cards reordered in ${colId}: ${order}`);
        });
    });
}

// ── Feature 100: Configurable chore wheel ──
function getChores() {
    try {
        const raw = localStorage.getItem('dash_chores');
        if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
    } catch (_) {}
    return CHORES;
}


/** Convert Celsius to display string respecting current unit preference */
function toDisplayTemp(c) {
    if (_tempUnit === 'F') return Math.round(c * 9 / 5 + 32) + '°F';
    return c + '°C';
}
function toggleTempUnit() {
    _tempUnit = _tempUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('dash_tempUnit', _tempUnit);
    diagLog('tempUnit → ' + _tempUnit);
    const wx = cGetStale('wx');
    if (wx) renderWeather(wx);
}

// ── Feature: Burn-in Protection (OLED) ──
/** Subtle 1–3 px random translate on the container every 5 min to prevent pixel burn-in */
function startBurnInProtection() {
    const container = document.querySelector('.container');
    if (!container) return;
    setInterval(() => {
        const x = Math.round((Math.random() - 0.5) * 6);
        const y = Math.round((Math.random() - 0.5) * 6);
        container.style.transform = `translate(${x}px, ${y}px)`;
    }, 300000); // every 5 min
}

// ── Feature: Background Image Cycling ──
/** Apply a CSS background image URL via an injected <style> tag */
function setBgImage(url) {
    let styleEl = document.getElementById('bg-img-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'bg-img-style';
        document.head.appendChild(styleEl);
    }
    // Only allow HTTPS URLs to prevent injection
    const safe = /^https:\/\//.test(url) ? url : '';
    styleEl.textContent = safe ? `body::after { background-image: url('${safe}'); opacity: 0.18; }` : '';
}
function startBgCycling() {
    // Custom URL overrides the cycle; supports comma-separated for slideshow (F85)
    const customUrl = localStorage.getItem('dash_bgUrl');
    if (customUrl) {
        const urls = customUrl.split(',').map(u => u.trim()).filter(u => /^https:\/\//.test(u));
        if (urls.length > 1) { startPhotoSlideshow(urls); return; }
        setBgImage(urls[0] || null); return;
    }
    let bgIdx = parseInt(localStorage.getItem('dash_bgIdx') || '0', 10) % BG_IMAGES.length;
    setBgImage(BG_IMAGES[bgIdx]);
    setInterval(() => {
        bgIdx = (bgIdx + 1) % BG_IMAGES.length;
        localStorage.setItem('dash_bgIdx', String(bgIdx));
        setBgImage(BG_IMAGES[bgIdx]);
        diagLog('bg cycling → image ' + bgIdx);
    }, 1800000); // 30 min
}

// ── Feature: Auto Night Theme ──
/** Switch to OLED black after sunset; restore saved theme after sunrise */
function applyAutoTheme() {
    if (!_autoTheme) return;
    if (!_todaySunrise || !_todaySunset) return;
    const now = new Date();
    const isNight = now > _todaySunset || now < _todaySunrise;
    const isBlack = document.body.classList.contains('theme-black');
    if (isNight && !isBlack) {
        _themeBeforeDark = localStorage.getItem('dash_theme') || 'black';
        applyTheme('black');
        diagLog('auto-theme: night → black');
    } else if (!isNight && isBlack && _themeBeforeDark && _themeBeforeDark !== 'black') {
        applyTheme(_themeBeforeDark);
        _themeBeforeDark = null;
        diagLog('auto-theme: day → ' + localStorage.getItem('dash_theme'));
    }
}

// ── Feature: Birthdays Countdown ──
function checkBirthdays() {
    if (!BIRTHDAYS.length) { if (el.hcBirthday) el.hcBirthday.style.display = 'none'; return; }
    const now = new Date();
    const upcoming = BIRTHDAYS.map(b => {
        let bd = new Date(now.getFullYear(), b.month - 1, b.day);
        if (bd < now) bd = new Date(now.getFullYear() + 1, b.month - 1, b.day);
        const days = Math.ceil((bd - now) / 86400000);
        return { ...b, days };
    }).sort((a, b2) => a.days - b2.days);
    const soon = upcoming.filter(b => b.days <= 7);
    if (soon.length && el.hcBirthday) {
        el.hcBirthday.textContent = soon.map(b =>
            b.days === 0 ? `🎂 יום הולדת שמח ל${b.name}!` : `🎂 ${b.name} — עוד ${b.days} ימים`
        ).join(' · ');
        el.hcBirthday.style.display = '';
    } else if (el.hcBirthday) {
        el.hcBirthday.style.display = 'none';
    }
    // F104: header birthday chip — 14-day lookahead
    if (el.headerBirthdayChip) {
        const chipSoon = upcoming.filter(b => b.days <= 14);
        if (chipSoon.length) {
            const b = chipSoon[0];
            el.headerBirthdayChip.textContent = b.days === 0 ? `🎂 ${b.name}!` : `🎂 ${b.name} — ${b.days}יום`;
            el.headerBirthdayChip.title = chipSoon.map(x => x.days === 0 ? `יום הולדת: ${x.name}!` : `${x.name}: עוד ${x.days} ימים`).join(' · ');
            el.headerBirthdayChip.style.display = '';
        } else {
            el.headerBirthdayChip.style.display = 'none';
        }
    }
}

// ── Feature: Shabbat Countdown ──
function updateShabbatCountdown() {
    if (!_candleDate || !el.hcCountdown || !el.hcCountdownRow) return;
    const now = Date.now();
    const diff = Math.floor((_candleDate - now) / 1000);
    if (diff <= 0 || diff > 86400) {
        el.hcCountdownRow.style.display = 'none';
        // Check if Shabbat is ongoing (past candles but before havdalah)
        if (diff <= 0 && _shabbatEnd && now < _shabbatEnd.getTime()) {
            applyShabbatMode(true);
        } else if (_shabbatEnd && now >= _shabbatEnd.getTime()) {
            applyShabbatMode(false);
        }
        return;
    }
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    el.hcCountdown.textContent = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
    el.hcCountdown.className = `hc-val hc-countdown${diff < 3600 ? ' urgent' : ''}`;
    el.hcCountdownRow.style.display = '';
    // Feature 77: update header shabbat pill
    updateShabbatHeaderPill();
}

// ── Feature: Shabbat Mode (auto-dim during Shabbat) ──
function applyShabbatMode(on) {
    if (_shabbatMode === on) return;
    _shabbatMode = on;
    document.body.classList.toggle('shabbat-mode', on);
    diagLog('Shabbat mode: ' + (on ? 'ON' : 'OFF'));
}

// ── Feature: Help Overlay (? key) ──
function toggleHelp() {
    if (!el.helpOverlay) return;
    el.helpOverlay.classList.toggle('visible');
}

// ═══════════════════════════════════════════════════════════════
// SPRINT 3 FEATURES (v4.11)
// ═══════════════════════════════════════════════════════════════

// ── Feature 21: Parasha Aliyot — first verse of weekly reading ──
async function _loadParashaAliyot() {
    if (_aliyotLoaded) return;
    const dayKey = new Date().toDateString();
    const cacheKey = 'dash_v2_aliyot_' + dayKey;
    let verseText = cGet(cacheKey, 86400000); // 24h TTL
    if (!verseText) {
        try {
            const cal = await fetch('https://www.sefaria.org/api/calendars').then(r => r.json());
            const pw = (cal.calendar_items || []).find(i => i.title?.en === 'Parashat Hashavua');
            if (!pw?.ref) return;
            // Get only the very first verse (e.g. "Bereishit 1:1" from "Bereishit 1:1-6:8")
            const firstRef = pw.ref.split('-')[0].trim();
            const vd = await fetch(`https://www.sefaria.org/api/texts/${encodeURIComponent(firstRef)}?context=0&lang=he&stripItags=1`).then(r => r.json());
            const rawHe = vd?.he;
            const raw = Array.isArray(rawHe) ? rawHe[0] : rawHe;
            verseText = (typeof raw === 'string' ? raw : (raw?.[0] || '')).replace(/<[^>]+>/g, '').trim().substring(0, 90);
            if (verseText) cSet(cacheKey, verseText);
        } catch (_) { return; }
    }
    if (verseText && el.hcAliyot && el.hcAliyotRow) {
        el.hcAliyot.textContent = '"' + verseText + (verseText.length >= 90 ? '..."' : '"');
        el.hcAliyotRow.style.display = '';
        _aliyotLoaded = true;
    }
}

// ── Feature 22: Electricity Peak-Hour Badge (IEC Israel tariffs) ──
function checkElecPeak() {
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes();
    const month = now.getMonth(); // 0=Jan
    // Both winter & summer: peak 17:00–22:00; summer (Apr–Oct) also adds 08:00–10:00
    let peak = (totalMin >= 17 * 60 && totalMin < 22 * 60);
    if (month >= 3 && month <= 9) peak = peak || (totalMin >= 8 * 60 && totalMin < 10 * 60);
    if (el.elecBadge) el.elecBadge.classList.toggle('peak-on', peak);
}

// ── Feature 23: Psalm of the Day (שיר של יום) ──
// Traditional daily psalms: Sun=24, Mon=48, Tue=82, Wed=94, Thu=81, Fri=93, Sat=92
const DOW_PSALMS = [24, 48, 82, 94, 81, 93, 92];
async function loadPsalm() {
    if (_psalmLoaded) return;
    const psalmNum = DOW_PSALMS[new Date().getDay()];
    const cacheKey = `dash_v2_psalm_${psalmNum}`;
    let excerpt = cGet(cacheKey, 86400000); // 24h TTL
    if (!excerpt) {
        try {
            const d = await fetch(`https://www.sefaria.org/api/texts/Psalms.${psalmNum}?context=0&lang=he&stripItags=1`).then(r => r.json());
            const verses = d?.he;
            const firstVerse = Array.isArray(verses) ? verses[0] : verses;
            const raw = typeof firstVerse === 'string' ? firstVerse : (firstVerse?.[0] || '');
            excerpt = raw.replace(/<[^>]+>/g, '').trim().substring(0, 80);
            if (excerpt) cSet(cacheKey, excerpt);
        } catch (_) { return; }
    }
    if (excerpt && el.hcPsalm && el.hcPsalmRow) {
        el.hcPsalm.textContent = `תהילים ${psalmNum}: ${excerpt}...`;
        el.hcPsalmRow.style.display = '';
        _psalmLoaded = true;
        diagLog(`Psalm ${psalmNum} loaded`);
    }
}

// ── Feature 24: Moon Phase — pure JS synodic calculation ──
function getMoonPhase() {
    // Known new moon: Jan 6, 2000 at 18:14 UTC
    const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);
    const SYNODIC_MS = 29.53059 * 86400000;
    const elapsed = ((Date.now() - KNOWN_NEW_MOON) % SYNODIC_MS + SYNODIC_MS) % SYNODIC_MS;
    const pct = elapsed / SYNODIC_MS;
    const age = Math.round(elapsed / 86400000);
    const PHASES = [
        { max: 0.0625, emoji: '🌑', name: 'ירח חדש'    },
        { max: 0.25,   emoji: '🌒', name: 'סהר גדל'    },
        { max: 0.375,  emoji: '🌓', name: 'רבע ראשון'  },
        { max: 0.5,    emoji: '🌔', name: 'מתמלא'      },
        { max: 0.5625, emoji: '🌕', name: 'ירח מלא'    },
        { max: 0.75,   emoji: '🌖', name: 'מתרוקן'     },
        { max: 0.875,  emoji: '🌗', name: 'רבע אחרון'  },
        { max: 1.0,    emoji: '🌘', name: 'סהר דועך'   },
    ];
    const phase = PHASES.find(p => pct <= p.max) || PHASES[7];
    return { emoji: phase.emoji, name: phase.name, age };
}
function updateMoonPhase() {
    if (!el.hcMoon) return;
    const { emoji, name, age } = getMoonPhase();
    el.hcMoon.textContent = `${emoji} ${name} · יום ${age}`;
}

// ── Feature 27: Seasonal CSS Body Class ──
function applySeasonClass() {
    const m = new Date().getMonth(); // 0=Jan
    const season = (m >= 2 && m <= 4) ? 'spring'
                 : (m >= 5 && m <= 7) ? 'summer'
                 : (m >= 8 && m <= 10) ? 'autumn'
                 : 'winter';
    ['spring', 'summer', 'autumn', 'winter'].forEach(s =>
        document.body.classList.toggle('season-' + s, s === season)
    );
    diagLog('Season: ' + season);
}

// ── Feature: Parashat HaShavua + Sefaria Reading Reference ──
async function loadParasha() {
    const key = 'parasha-' + new Date().toDateString();
    const cached = cGet(key, 86400000); // 24h TTL
    if (cached) { _renderParasha(cached); return; }
    const stale = cGetStale(key); if (stale) _renderParasha(stale);
    try {
        const d = await fetchJSON(`https://www.hebcal.com/shabbat?cfg=json&geonameid=${getGeonameid()}&M=on`);
        const parasha = (d.items || []).find(i => i.category === 'parashat');
        if (parasha) {
            const name = parasha.hebrew || parasha.title;
            cSet(key, name);
            _renderParasha(name);
            diagLog('parasha OK: ' + name);
            // Fetch Sefaria reading reference asynchronously (non-blocking)
            _loadParashaRef().catch(() => {});
            // Feature 21: also load first-verse aliyot excerpt (non-blocking)
            _loadParashaAliyot().catch(() => {});
        } else {
            cSet(key, null);
        }
    } catch (e) { diagLog('parasha ERR: ' + e.message); }
}
async function _loadParashaRef() {
    if (!el.hcParashaRef) return;
    const key = 'parasha-ref-' + new Date().toDateString();
    const cached = cGet(key, 86400000);
    if (cached) { el.hcParashaRef.textContent = ' · ' + cached; return; }
    try {
        const cal = await fetch('https://www.sefaria.org/api/calendars').then(r => r.json());
        const pw = (cal.calendar_items || []).find(i => i.title?.en === 'Parashat Hashavua');
        if (pw?.displayValue?.he) {
            const ref = pw.displayValue.he;
            cSet(key, ref);
            el.hcParashaRef.textContent = ' · ' + ref;
            // Feature 44: store Sefaria URL for deep link
            if (pw.url) _parashaSefariaUrl = 'https://www.sefaria.org/' + pw.url;
            // Feature 44: store Sefaria URL for deep link
            if (pw.url) _parashaSefariaUrl = 'https://www.sefaria.org/' + pw.url;
        }
    } catch (_) {}
}
function _renderParasha(name) {
    if (!name || !el.hcParasha || !el.hcParashaRow) return;
    el.hcParasha.textContent = name;
    el.hcParashaRow.style.display = '';
    // Feature 78: show parasha weekly progress bar
    renderParashaProgress();
    // Feature 44: show Sefaria link row
    const linkRow = document.getElementById('hc-parasha-link-row');
    const linkBtn = document.getElementById('hc-parasha-link');
    if (linkRow) linkRow.style.display = '';
    if (linkBtn && !linkBtn.dataset.wired) {
        linkBtn.dataset.wired = '1';
        linkBtn.addEventListener('click', openParashaOnSefaria);
    }
}

// ── Feature: Daf Yomi ──
async function loadDafYomi() {
    const now = new Date();
    const key = `daf-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const cached = cGet(key, 86400000); // 24h TTL
    if (cached) { _renderDaf(cached); return; }
    const stale = cGetStale(key); if (stale) _renderDaf(stale);
    try {
        const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&daf=on&maj=off&min=off&ss=off&mf=off&year=${now.getFullYear()}&month=${now.getMonth() + 1}&day=${now.getDate()}`;
        const d = await fetchJSON(url);
        const daf = (d.items || []).find(i => i.category === 'dafyomi');
        if (daf) {
            const title = daf.hebrew || daf.title;
            // Feature 53: store Sefaria ref from dafyomi URL
            if (daf.url) _dafSefariaRef = daf.url;
            cSet(key, title);
            _renderDaf(title);
            diagLog('dafyomi OK: ' + title);
        } else {
            cSet(key, null);
        }
    } catch (e) { diagLog('dafyomi ERR: ' + e.message); }
}
function _renderDaf(title) {
    if (!title || !el.hcDaf || !el.hcDafRow) return;
    el.hcDaf.textContent = title;
    el.hcDafRow.style.display = '';
    // Feature 53: show Sefaria link row
    const linkRow = document.getElementById('hc-daf-link-row');
    const linkBtn = document.getElementById('hc-daf-link');
    if (linkRow) linkRow.style.display = '';
    if (linkBtn && !linkBtn.dataset.wired) {
        linkBtn.dataset.wired = '1';
        linkBtn.addEventListener('click', openDafOnSefaria);
    }
}

// ── Feature: Zmanim (Prayer Times) ──
let _zmanimParsed = []; // F109: sorted array of {label, time: Date} for next-zman indicator
async function loadZmanim() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const key = 'zmanim-' + dateStr;
    const cached = cGet(key, 43200000); // 12h TTL — same for the full day
    if (cached) { _renderZmanim(cached); return; }
    const stale = cGetStale(key); if (stale) _renderZmanim(stale);
    try {
        const d = await fetchJSON(`https://www.hebcal.com/zmanim?cfg=json&geonameid=${getGeonameid()}&date=${dateStr}`);
        if (d.times) {
            cSet(key, d.times);
            _renderZmanim(d.times);
            diagLog('zmanim OK');
        }
    } catch (e) { diagLog('zmanim ERR: ' + e.message); }
}
function _renderZmanim(times) {
    if (!times || !el.zmanimGrid || !el.zmanimSection) return;
    // Show 6 key zmanim in 3-col grid
    const SHOW = [
        { key: 'alotHaShachar',    label: 'עלות השחר' },
        { key: 'misheyakir',       label: 'משיכיר' },
        { key: 'sunrise',          label: 'זריחה' },
        { key: 'sofZmanShmaMGA',   label: 'סו"ז שמע מג"א' },
        { key: 'sofZmanShmaGRA',   label: 'סו"ז שמע גר"א' },
        { key: 'chatzot',          label: 'חצות' },
        { key: 'minchaGedola',     label: 'מנחה גדולה' },
        { key: 'sunset',           label: 'שקיעה' },
        { key: 'tzait7083deg',     label: 'צאת הכוכבים' },
    ];
    const frag = document.createDocumentFragment();
    let count = 0;
    for (const z of SHOW) {
        const raw = times[z.key];
        if (!raw) continue;
        const t = new Date(raw).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
        const item = document.createElement('div');
        item.className = 'zman-item';
        const nameEl = document.createElement('div');
        nameEl.className = 'zman-name';
        nameEl.textContent = z.label;
        const timeEl = document.createElement('div');
        timeEl.className = 'zman-time';
        timeEl.textContent = t;
        item.appendChild(nameEl);
        item.appendChild(timeEl);
        frag.appendChild(item);
        count++;
    }
    if (count) {
        el.zmanimGrid.innerHTML = '';
        el.zmanimGrid.appendChild(frag);
        el.zmanimSection.style.display = '';
    }
    // F109: populate _zmanimParsed for header indicator
    _zmanimParsed = [];
    for (const z of SHOW) {
        const raw = times[z.key];
        if (!raw) continue;
        const t = new Date(raw);
        if (!isNaN(t.getTime())) _zmanimParsed.push({ label: z.label, time: t });
    }
    _zmanimParsed.sort((a, b) => a.time - b.time);
    updateNextZman();
}
// F109: Show the next upcoming Zman in the header
function updateNextZman() {
    if (!el.headerNextZman) return;
    const now = Date.now();
    const next = _zmanimParsed.find(z => z.time > now);
    if (!next) { el.headerNextZman.style.display = 'none'; return; }
    const t = next.time.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    el.headerNextZman.textContent = `⏰ ${next.label} ${t}`;
    el.headerNextZman.style.display = '';
}



// ── Sprint 4 Features ──

// Feature 31: Wind Direction Arrow  deg→16-point compass arrow
function deg2arrow(deg) {
    const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}
// F108: Hebrew compass direction label
function deg2hebrewDir(deg) {
    const dirs = ['צפון', 'צ-מ', 'מזרח', 'ד-מ', 'דרום', 'ד-מ', 'מערב', 'צ-מ'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

// Feature 32: Extreme Weather Alert Banner
const SEVERE_WX = { 82: '⛈ גשם עז מאוד', 95: '⛈ סופת רעמים', 96: '⛈ סופה עם ברד', 99: '⛈ סופת רעמים קשה' };
let _lastSevereMsg = null; // F134: track to avoid repeated toasts
function checkSevereWeather(code) {
    const banner = document.getElementById('wx-alert-banner');
    if (!banner) return;
    const msg = SEVERE_WX[code];
    if (msg) {
        banner.textContent = msg;
        banner.classList.add('visible');
        // F134: toast + Notification only on new severe event (not every refresh)
        if (msg !== _lastSevereMsg) {
            _lastSevereMsg = msg;
            showToast('⛈ ' + msg, 6000);
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification('⛈ מזג אוויר קיצוני', { body: msg, dir: 'rtl', lang: 'he', icon: './favicon.ico' }); } catch (_) {}
            }
            diagLog(`F134: severe weather notification: ${msg}`);
        }
    } else {
        banner.classList.remove('visible');
        _lastSevereMsg = null;
    }
}

// Feature 33: Config Panel
function toggleConfig() {
    const overlay = document.getElementById('config-overlay');
    if (!overlay) return;
    const opening = !overlay.classList.contains('visible');
    overlay.classList.toggle('visible', opening);
    if (opening) {
        // Populate fields with current values
        const bgInput = document.getElementById('cfg-bg-url');
        const birthdayInput = document.getElementById('cfg-birthday');
        const autoThemeInput = document.getElementById('cfg-auto-theme');
        const tempInput = document.getElementById('cfg-temp-unit');
        const tickerInput = document.getElementById('cfg-ticker-msg');
        const stockAlertsInput = document.getElementById('cfg-stock-alerts');
        const soundInput = document.getElementById('cfg-alert-sound');
        if (bgInput) bgInput.value = localStorage.getItem('dash_bgUrl') || '';
        if (birthdayInput) birthdayInput.value = localStorage.getItem('dash_birthday') || '';
        if (autoThemeInput) autoThemeInput.value = localStorage.getItem('dash_autoTheme') === 'off' ? 'off' : 'on';
        if (tempInput) tempInput.value = _tempUnit;
        if (tickerInput) tickerInput.value = localStorage.getItem('dash_ticker_msg') || '';
        if (soundInput) soundInput.value = _alertSoundEnabled ? 'on' : 'off';
        if (stockAlertsInput) stockAlertsInput.value = localStorage.getItem('dash_stock_alerts') || '';
        // Sprint 9 new fields
        const familyInput = document.getElementById('cfg-family-name');
        const icsInput = document.getElementById('cfg-ics-url');
        const alertZoneInput = document.getElementById('cfg-alert-zone');
        const dimStartInput = document.getElementById('cfg-dim-start');
        const dimEndInput = document.getElementById('cfg-dim-end');
        if (familyInput) familyInput.value = localStorage.getItem('dash_family_name') || '';
        if (icsInput) icsInput.value = localStorage.getItem('dash_ics_url') || '';
        if (alertZoneInput) alertZoneInput.value = localStorage.getItem('dash_alert_zone') || '';
        if (dimStartInput) dimStartInput.value = localStorage.getItem('dash_dim_start') ?? '23';
        if (dimEndInput) dimEndInput.value = localStorage.getItem('dash_dim_end') ?? '6';
        // Sprint 10 new fields (F93-F100)
        const homeLat = document.getElementById('cfg-home-lat');
        const homeLon = document.getElementById('cfg-home-lon');
        const homeName = document.getElementById('cfg-home-name');
        const hebGeoInput = document.getElementById('cfg-heb-geonameid');
        const feedsDisInput = document.getElementById('cfg-feeds-disabled');
        const stocksHiddenInput = document.getElementById('cfg-stocks-hidden');
        const rtAlertsInput = document.getElementById('cfg-alert-realtime');
        const choresInput = document.getElementById('cfg-chores');
        if (homeLat) homeLat.value = localStorage.getItem('dash_home_lat') || '';
        if (homeLon) homeLon.value = localStorage.getItem('dash_home_lon') || '';
        if (homeName) homeName.value = localStorage.getItem('dash_home_name') || '';
        if (hebGeoInput) hebGeoInput.value = localStorage.getItem('dash_geonameid') || '';
        if (feedsDisInput) feedsDisInput.value = localStorage.getItem('dash_feed_disabled') || '';
        if (stocksHiddenInput) stocksHiddenInput.value = localStorage.getItem('dash_stocks_hidden') || '';
        if (rtAlertsInput) rtAlertsInput.value = _alertRealtime ? 'on' : 'off';
        if (choresInput) choresInput.value = localStorage.getItem('dash_chores') || '';
        // F139: countdown chip config
        const ctDateInp = document.getElementById('cfg-countdown-date');
        const ctLblInp  = document.getElementById('cfg-countdown-label');
        if (ctDateInp) ctDateInp.value = localStorage.getItem('dash_countdown_date') || '';
        if (ctLblInp)  ctLblInp.value  = localStorage.getItem('dash_countdown_label') || '';
        // Sprint 11: secondary ICS URLs (F102)
        const ics2Input2 = document.getElementById('cfg-ics-url-2');
        const ics3Input2 = document.getElementById('cfg-ics-url-3');
        if (ics2Input2) ics2Input2.value = localStorage.getItem('dash_ics_url_2') || '';
        if (ics3Input2) ics3Input2.value = localStorage.getItem('dash_ics_url_3') || '';
        // Sprint 12: F117 weather cities, F118 members
        for (let i = 1; i <= 3; i++) {
            const ci = document.getElementById(`cfg-city-${i}`);
            if (ci) ci.value = localStorage.getItem(`dash_city_${i}`) || '';
        }
        const membersInp = document.getElementById('cfg-members');
        if (membersInp) membersInp.value = localStorage.getItem('dash_members') || '';
        // Custom proxy (corporate network)
        const cpInp = document.getElementById('cfg-custom-proxy');
        if (cpInp) cpInp.value = localStorage.getItem('dash_custom_proxy') || '';
        // F119: restore last active tab
        switchCfgTab(localStorage.getItem('dash_cfg_tab') || 'display');
    }
}
function saveConfig() {
    const bgInput = document.getElementById('cfg-bg-url');
    const birthdayInput = document.getElementById('cfg-birthday');
    const autoThemeInput = document.getElementById('cfg-auto-theme');
    const tempInput = document.getElementById('cfg-temp-unit');
    if (bgInput?.value.trim()) {
        const raw = bgInput.value.trim();
        localStorage.setItem('dash_bgUrl', raw);
        const urls = raw.split(',').map(u => u.trim()).filter(u => /^https:\/\//.test(u));
        if (urls.length > 1) { startPhotoSlideshow(urls); }
        else { stopPhotoSlideshow(); setBgImage(urls[0] || null); }
    } else if (bgInput) {
        localStorage.removeItem('dash_bgUrl');
        stopPhotoSlideshow(); setBgImage(null);
    }
    if (birthdayInput?.value.trim()) {
        localStorage.setItem('dash_birthday', birthdayInput.value.trim());
    }
    if (autoThemeInput) {
        const val = autoThemeInput.value.trim().toLowerCase();
        if (val === 'off') {
            localStorage.setItem('dash_autoTheme', 'off');
            _autoTheme = false;
        } else {
            localStorage.removeItem('dash_autoTheme');
            _autoTheme = true;
        }
    }
    if (tempInput) {
        const unit = tempInput.value.trim().toUpperCase();
        if (unit === 'F' || unit === 'C') {
            _tempUnit = unit;
            localStorage.setItem('dash_tempUnit', unit);
            const wx = cGetStale('wx'); if (wx) renderWeather(wx);
        }
    }
    // Feature 48: custom ticker message
    const tickerInput = document.getElementById('cfg-ticker-msg');
    if (tickerInput) {
        const msg = tickerInput.value.trim();
        if (msg) localStorage.setItem('dash_ticker_msg', msg);
        else localStorage.removeItem('dash_ticker_msg');

    // Feature 55: stock price alerts
    const stockAlertsInput = document.getElementById('cfg-stock-alerts');
    if (stockAlertsInput) {
        const val = stockAlertsInput.value.trim();
        if (val) { try { JSON.parse(val); localStorage.setItem('dash_stock_alerts', val); } catch {} }
        else localStorage.removeItem('dash_stock_alerts');
    }   // Force re-render halacha ticker with new message
        const cached = cGetStale('halacha'); if (cached) renderHalacha(cached);
    }
    // Feature 43: alert sound
    const soundInput = document.getElementById('cfg-alert-sound');
    if (soundInput) {
        const val = soundInput.value.trim().toLowerCase();
        if (val === 'off') { _alertSoundEnabled = false; localStorage.setItem('dash_alertSound', 'off'); }
        else if (val === 'on') { _alertSoundEnabled = true; localStorage.setItem('dash_alertSound', 'on'); }
    }
    // Sprint 9: family name (F84)
    const familyInput = document.getElementById('cfg-family-name');
    if (familyInput !== null) {
        const name = familyInput.value.trim();
        if (name) localStorage.setItem('dash_family_name', name);
        else localStorage.removeItem('dash_family_name');
    }
    // Sprint 9: ICS calendar URL (F83)
    const icsInput = document.getElementById('cfg-ics-url');
    if (icsInput !== null) {
        const url = icsInput.value.trim();
        if (url && /^https:\/\//.test(url)) { localStorage.setItem('dash_ics_url', url); safeLoad(loadCalendar); }
        else if (!url) localStorage.removeItem('dash_ics_url');
    }
    // Sprint 9: alert zone filter (F86)
    const alertZoneInput = document.getElementById('cfg-alert-zone');
    if (alertZoneInput !== null) {
        const zone = alertZoneInput.value.trim();
        if (zone) localStorage.setItem('dash_alert_zone', zone);
        else localStorage.removeItem('dash_alert_zone');
    }
    // Sprint 9: night dim schedule (F88)
    const dimStartInput = document.getElementById('cfg-dim-start');
    const dimEndInput = document.getElementById('cfg-dim-end');
    if (dimStartInput) { const v = parseInt(dimStartInput.value, 10); if (!isNaN(v) && v >= 0 && v <= 23) localStorage.setItem('dash_dim_start', String(v)); }
    if (dimEndInput)   { const v = parseInt(dimEndInput.value, 10);   if (!isNaN(v) && v >= 0 && v <= 23) localStorage.setItem('dash_dim_end', String(v)); }
    // Sprint 10: F93-F100 config fields
    const homeLat = document.getElementById('cfg-home-lat');
    const homeLon = document.getElementById('cfg-home-lon');
    const homeName = document.getElementById('cfg-home-name');
    if (homeLat && homeLon) {
        const lat = parseFloat(homeLat.value); const lon = parseFloat(homeLon.value);
        const name = homeName?.value.trim() || 'ביתי';
        if (!isNaN(lat) && !isNaN(lon)) {
            localStorage.setItem('dash_home_lat', String(lat));
            localStorage.setItem('dash_home_lon', String(lon));
            localStorage.setItem('dash_home_name', name);
            injectHomeCity(); switchWxCity('home');
        } else if (!homeLat.value.trim()) {
            localStorage.removeItem('dash_home_lat'); localStorage.removeItem('dash_home_lon'); localStorage.removeItem('dash_home_name');
            delete WX_CITIES.home; if (_wxCityKey === 'home') switchWxCity('jerusalem');
        }
    }
    const hebGeoInput = document.getElementById('cfg-heb-geonameid');
    if (hebGeoInput) {
        const geo = hebGeoInput.value.trim();
        if (geo && /^\d+$/.test(geo)) { localStorage.setItem('dash_geonameid', geo); safeLoad(loadHebCal); }
        else if (!geo) localStorage.removeItem('dash_geonameid');
    }
    const feedsDisInput = document.getElementById('cfg-feeds-disabled');
    if (feedsDisInput) {
        const dis = feedsDisInput.value.trim();
        if (dis) localStorage.setItem('dash_feed_disabled', dis); else localStorage.removeItem('dash_feed_disabled');
        safeLoad(loadNews);
    }
    const stocksHiddenInput = document.getElementById('cfg-stocks-hidden');
    if (stocksHiddenInput) {
        const h = stocksHiddenInput.value.trim();
        if (h) localStorage.setItem('dash_stocks_hidden', h); else localStorage.removeItem('dash_stocks_hidden');
        applyHiddenStocks();
    }
    const rtAlertsInput = document.getElementById('cfg-alert-realtime');
    if (rtAlertsInput) {
        const v = rtAlertsInput.value.trim().toLowerCase();
        _alertRealtime = v === 'on';
        if (_alertRealtime) localStorage.setItem('dash_alert_rt', 'on');
        else localStorage.removeItem('dash_alert_rt');
    }
    const choresInput = document.getElementById('cfg-chores');
    if (choresInput) {
        const val = choresInput.value.trim();
        if (val) { try { JSON.parse(val); localStorage.setItem('dash_chores', val); } catch {} }
        else localStorage.removeItem('dash_chores');
    }
    // F139: Save countdown chip config
    const ctDateInp = document.getElementById('cfg-countdown-date');
    const ctLblInp  = document.getElementById('cfg-countdown-label');
    if (ctDateInp) {
        const v = ctDateInp.value;
        if (v) localStorage.setItem('dash_countdown_date', v); else localStorage.removeItem('dash_countdown_date');
    }
    if (ctLblInp) {
        const v = ctLblInp.value.trim();
        if (v) localStorage.setItem('dash_countdown_label', v); else localStorage.removeItem('dash_countdown_label');
    }
    updateCountdownChip(new Date()); // refresh chip immediately
    // Sprint 11: secondary ICS calendar URLs (F102)
    for (let i = 2; i <= 3; i++) {
        const inp = document.getElementById(`cfg-ics-url-${i}`);
        if (inp === null) continue;
        const url = inp.value.trim();
        if (url && /^https:\/\//.test(url)) localStorage.setItem(`dash_ics_url_${i}`, url);
        else localStorage.removeItem(`dash_ics_url_${i}`);
    }
    if (localStorage.getItem('dash_ics_url_2') || localStorage.getItem('dash_ics_url_3')) {
        safeLoad(loadCalendarExtra);
    }
    // F117: Configurable weather city slots
    for (let i = 1; i <= 3; i++) {
        const cityInp = document.getElementById(`cfg-city-${i}`);
        if (!cityInp) continue;
        const val = cityInp.value.trim();
        if (val) localStorage.setItem(`dash_city_${i}`, val);
        else localStorage.removeItem(`dash_city_${i}`);
    }
    initWeatherCities();
    // F118: Family members list
    const membersInp = document.getElementById('cfg-members');
    if (membersInp) {
        const val = membersInp.value.trim();
        if (val) localStorage.setItem('dash_members', val); else localStorage.removeItem('dash_members');
    }
    // F160: News font size slider
    const newsFontInp = document.getElementById('cfg-news-fontsize');
    if (newsFontInp) {
        const val = parseInt(newsFontInp.value, 10) || 100;
        localStorage.setItem('dash_news_fontsize', String(val));
        document.documentElement.style.setProperty('--news-font-scale', (val / 100).toFixed(2));
    }
    // Custom CORS proxy
    const cpInp = document.getElementById('cfg-custom-proxy');
    if (cpInp !== null) {
        const v = cpInp.value.trim();
        if (v && /^https:\/\//.test(v)) localStorage.setItem('dash_custom_proxy', v);
        else localStorage.removeItem('dash_custom_proxy');
    }
    toggleConfig();
    diagLog('Config saved');
}

// Feature 34: Chore Wheel — daily rotating family chore assignments
const CHORES = [
    { person: 'עמרי',  chore: '🧹 לנקות סלון' },
    { person: 'בר',    chore: '🍽️ לשטוף כלים' },
    { person: 'גל',    chore: '🗑️ לרוקן פחים' },
    { person: 'נועה',  chore: '🧺 לסדר כביסה' },
    { person: 'עמרי',  chore: '🧴 לנקות שירותים' },
    { person: 'בר',    chore: '🧽 לנקות מטבח' },
    { person: 'גל',    chore: '🪴 להשקות צמחים' },
];
function updateChoreWheel() {
    if (!el.hcChore || !el.hcChoreRow) return;
    const doy = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 86400000);
    const chores = getChores();
    const chore = chores[doy % chores.length];
    el.hcChore.textContent = `${chore.person}: ${chore.chore}`;
    el.hcChoreRow.style.display = '';
}

// Feature 35: Portfolio P&L Overlay on Stock Rows
// Store cost basis as: dash_portfolio = JSON: { 'AAPL': {cost:182.5, qty:10}, ... }
function _getPortfolio() {
    try { return JSON.parse(localStorage.getItem('dash_portfolio') || '{}'); } catch { return {}; }
}
function updatePortfolioPnL(sym, currentPrice) {
    const portfolio = _getPortfolio();
    const pos = portfolio[sym];
    if (!pos || !pos.cost || !pos.qty || !currentPrice) return;
    const pnl = (currentPrice - pos.cost) * pos.qty;
    const pct = ((currentPrice - pos.cost) / pos.cost) * 100;
    const blk = document.querySelector(`.stk[data-symbol="${CSS.escape(sym)}"]`);
    if (!blk) return;
    let pnlEl = blk.querySelector('.stk-pnl');
    if (!pnlEl) {
        pnlEl = document.createElement('div');
        pnlEl.className = 'stk-pnl';
        const valsDiv = blk.querySelector('.stk-vals');
        if (valsDiv) valsDiv.appendChild(pnlEl);
    }
    const sign = pnl >= 0 ? '+' : '';
    pnlEl.textContent = `${sign}$${pnl.toFixed(0)} (${sign}${pct.toFixed(1)}%)`;
    pnlEl.className = 'stk-pnl ' + (pnl >= 0 ? 'gain' : 'loss');
}


// Feature 37: Today Event Count in Header (from ICS cache)
function updateTodayEventCount() {
    const hdrEl = document.getElementById('header-event-count');
    if (!hdrEl) return;
    const raw = cGetStale('cal-ics');
    if (!raw) return;
    const events = parseICS(raw);
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayMidnight.getTime() + 86400000);
    const todayCount = events.filter(e => e.start >= todayMidnight && e.start < todayEnd).length;
    if (todayCount > 0) {
        hdrEl.textContent = todayCount + ' 📅';
        hdrEl.style.display = '';
    } else {
        hdrEl.style.display = 'none';
    }
}

// Feature 38: Currency Sparkline (7-day rate history in localStorage)
const _CUR_HIST_KEY = 'dash_v2_cur_hist';
const _CUR_HIST_MAX = 7;
function recordCurrencyHistory(usd, eur, gold = 0, silver = 0, gbp = 0) {
    try {
        const hist = JSON.parse(localStorage.getItem(_CUR_HIST_KEY) || '[]');
        const today = new Date().toDateString();
        // Replace or add today's entry
        const idx = hist.findIndex(h => h.d === today);
        const entry = { d: today, usd, eur, gold, silver, gbp };
        if (idx >= 0) hist[idx] = entry; else hist.push(entry);
        // Keep last 7 days
        while (hist.length > _CUR_HIST_MAX) hist.shift();
        localStorage.setItem(_CUR_HIST_KEY, JSON.stringify(hist));
    } catch (_) {}
}
function renderCurrencySparklines() {
    try {
        const hist = JSON.parse(localStorage.getItem(_CUR_HIST_KEY) || '[]');
        if (hist.length < 2) return;
        const usdVals   = hist.map(h => h.usd).filter(v => v > 0);
        const eurVals   = hist.map(h => h.eur).filter(v => v > 0);
        const goldVals  = hist.map(h => h.gold).filter(v => v > 0);
        const silverVals = hist.map(h => h.silver).filter(v => v > 0);
        const gbpVals   = hist.map(h => h.gbp).filter(v => v > 0);
        _drawSparkline('cur-usd-spark', usdVals);
        _drawSparkline('cur-eur-spark', eurVals);
        _drawSparkline('cur-gold-spark', goldVals);
        _drawSparkline('cur-silver-spark', silverVals);
        _drawSparkline('cur-gbp-spark', gbpVals);
    } catch (_) {}
}
// R5.10: Shared sparkline path builder — Bézier (smooth) or polyline
function _sparkPath(vals, W, H, smooth) {
    const P = 2;
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 0.01;
    const pts = vals.map((v, i) => ({
        x: +(P + (i / (vals.length - 1)) * (W - 2 * P)).toFixed(1),
        y: +(P + (1 - (v - min) / rng) * (H - 2 * P)).toFixed(1)
    }));
    let d;
    if (smooth) {
        d = `M${pts[0].x},${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const cp = (pts[i].x - pts[i - 1].x) / 2;
            d += ` C${pts[i - 1].x + cp},${pts[i - 1].y} ${pts[i].x - cp},${pts[i].y} ${pts[i].x},${pts[i].y}`;
        }
    } else {
        d = pts.map(p => `${p.x},${p.y}`).join(' ');
    }
    const trend = vals[vals.length - 1] >= vals[0] ? '#34d399' : '#f87171';
    return { d, trend, last: pts[pts.length - 1] };
}
function _drawSparkline(id, vals) {
    const svg = document.getElementById(id);
    if (!svg || vals.length < 2) return;
    const { d, trend, last } = _sparkPath(vals, 60, 22, true);
    svg.innerHTML = `<path d="${d}" fill="none" stroke="${trend}" stroke-width="1.5" stroke-linecap="round"/><circle cx="${last.x}" cy="${last.y}" r="2" fill="${trend}"/>`;
}

// Feature 39: News Source Filter chips
const _RSS_SOURCES = {};   // { feedId: true/false } — true = visible
let _newsFilterActive = false;
function initNewsFilter() {
    const bar = document.getElementById('news-filter-bar');
    if (!bar) return;
    // "All" chip
    const allChip = document.createElement('button');
    allChip.className = 'news-filter-chip active';
    allChip.textContent = 'הכל';
    allChip.dataset.src = '__all__';
    allChip.addEventListener('click', () => {
        _newsFilterActive = false;
        bar.querySelectorAll('.news-filter-chip').forEach(c => c.classList.toggle('active', c.dataset.src === '__all__'));
        document.querySelectorAll('.rss-item[data-src]').forEach(row => row.style.display = '');
    });
    bar.appendChild(allChip);
}
function addNewsFilterChip(srcName) {
    const bar = document.getElementById('news-filter-bar');
    if (!bar || bar.querySelector(`[data-src="${CSS.escape(srcName)}"]`)) return;
    const chip = document.createElement('button');
    chip.className = 'news-filter-chip';
    chip.dataset.src = srcName;
    // Feature 73: show favicon for known domains
    const domain = NEWS_SRC_DOMAIN[srcName];
    const favicon = domain
        ? `<img class="news-chip-favicon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=16" alt="" loading="lazy" onerror="this.style.display='none'">`
        : '';
    chip.innerHTML = favicon + document.createTextNode(srcName).textContent;
    chip.addEventListener('click', () => {
        const bar = document.getElementById('news-filter-bar');
        if (!bar) return;
        bar.querySelectorAll('.news-filter-chip').forEach(c => c.classList.toggle('active', c.dataset.src === srcName));
        _newsFilterActive = true;
        document.querySelectorAll('.rss-item[data-src]').forEach(row => {
            row.style.display = (row.dataset.src === srcName) ? '' : 'none';
        });
    });
    bar.appendChild(chip);
}

// Feature 40: Connectivity health indicator (ping test via small fetch)
let _connTimer = null;
async function checkConnectivity() {
    const indicator = document.getElementById('conn-indicator');
    if (!indicator) return;
    const t0 = Date.now();
    try {
        await fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) });
        const ms = Date.now() - t0;
        indicator.textContent = ms < 500 ? '● מהיר' : '● בינוני';
        indicator.className = ms < 500 ? 'conn-ok' : 'conn-slow';
    } catch {
        indicator.textContent = '● איטי';
        indicator.className = 'conn-bad';
    }
}

// ── Sprint 5 Features ──

// R5.6: Market status badge — uses shared _getNYTime()
function updateMarketBadge() {
    if (!el.marketBadge) return;
    const { d, t } = _getNYTime();
    const isWeekday = d >= 1 && d <= 5;
    let label, cls;
    if (!isWeekday)                       { label = '🔴 סגור'; cls = 'market-closed'; }
    else if (t >= 240 && t < 570)         { label = '🟡 טרום'; cls = 'market-premarket'; }
    else if (t >= 570 && t <= 960)        { label = '🟢 פתוח'; cls = 'market-open'; }
    else if (t > 960 && t <= 1200)        { label = '🟣 אחרי'; cls = 'market-afterhours'; }
    else                                  { label = '🔴 סגור'; cls = 'market-closed'; }
    el.marketBadge.textContent = label;
    el.marketBadge.className = `market-badge ${cls}`;
}

// Feature 42: Weather Sky Color Pill
const WX_SKY = {
    0: { label: '☀️ בהיר', bg: 'rgba(251,191,36,0.2)', color: '#fbbf24' },
    1: { label: '🌤 יפה', bg: 'rgba(251,191,36,0.15)', color: '#fcd34d' },
    2: { label: '⛅ חלקית', bg: 'rgba(148,163,184,0.2)', color: '#94a3b8' },
    3: { label: '☁️ מעונן', bg: 'rgba(100,116,139,0.2)', color: '#64748b' },
    45: { label: '🌫 ערפל', bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    61: { label: '🌦 גשם', bg: 'rgba(96,165,250,0.2)', color: '#60a5fa' },
    80: { label: '🌧 מטר', bg: 'rgba(59,130,246,0.2)', color: '#3b82f6' },
    95: { label: '⛈ סופה', bg: 'rgba(248,113,113,0.25)', color: '#f87171' },
};
function updateWeatherSkyPill(code) {
    const pill = document.getElementById('wx-sky-pill');
    if (!pill) return;
    const coarseCode = code <= 1 ? code : code <= 3 ? code : code <= 48 ? 45 : code <= 67 ? 61 : code <= 82 ? 80 : 95;
    const info = WX_SKY[coarseCode] || WX_SKY[3];
    pill.textContent = info.label;
    pill.style.background = info.bg;
    pill.style.color = info.color;
}

// Feature 43: Alert Sound (Web Audio API, zero dependencies)
let _audioCtx = null;
let _alertSoundEnabled = localStorage.getItem('dash_alertSound') !== 'off';
function getAudioCtx() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}
function playAlertBeep(freq = 880, duration = 0.18, vol = 0.25) {
    if (!_alertSoundEnabled) return;
    try {
        const ctx = getAudioCtx();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch (_) {}
}
function toggleAlertSound() {
    _alertSoundEnabled = !_alertSoundEnabled;
    localStorage.setItem('dash_alertSound', _alertSoundEnabled ? 'on' : 'off');
    const btn = document.getElementById('sound-toggle');
    if (btn) btn.textContent = _alertSoundEnabled ? '🔔' : '🔇';
    diagLog('Alert sound: ' + (_alertSoundEnabled ? 'on' : 'off'));
}

// Feature 44: Parasha Sefaria Deep Link
let _parashaSefariaUrl = null;
function openParashaOnSefaria() {
    const url = _parashaSefariaUrl || 'https://www.sefaria.org/texts/Torah';
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Feature 45: Multi-City Weather
const WX_CITIES = {
    jerusalem: { lat: 31.7683, lon: 35.2137, name: 'ירושלים' },
    telaviv:   { lat: 32.0853, lon: 34.7818, name: 'תל אביב' },
    haifa:     { lat: 32.7940, lon: 34.9896, name: 'חיפה' },
};
let _wxCityKey = localStorage.getItem('dash_wxCity') || 'jerusalem';
function getCurrentWxCity() { return WX_CITIES[_wxCityKey] || WX_CITIES.jerusalem; }
function switchWxCity(cityKey) {
    if (_wxCityKey === cityKey) return;
    _wxCityKey = cityKey;
    localStorage.setItem('dash_wxCity', cityKey);
    // Invalidate wx cache so next load fetches fresh
    try { localStorage.removeItem('dash_v2_wx'); } catch (_) {}
    // Update header label
    const labelEl = document.getElementById('wx-city-label');
    const city = WX_CITIES[cityKey];
    if (labelEl && city) labelEl.textContent = `מזג אויר — ${city.name}`;
    // Update tab active state
    document.querySelectorAll('.wx-city-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.city === cityKey);
    });
    // Reload weather for new city
    safeLoad(loadWeather);
    diagLog('City switched: ' + (city?.name || cityKey));
}
function initWxCityTabs() {
    document.querySelectorAll('.wx-city-tab').forEach(tab => {
        tab.addEventListener('click', () => switchWxCity(tab.dataset.city));
        tab.classList.toggle('active', tab.dataset.city === _wxCityKey);
    });
    // Apply saved city label
    const city = getCurrentWxCity();
    const labelEl = document.getElementById('wx-city-label');
    if (labelEl && city) labelEl.textContent = `מזג אויר — ${city.name}`;
}

// Feature 46: Stock 52-Week Range Bar
function updateStockRange(blk, cur, low52, high52) {
    if (!blk || !cur || !low52 || !high52 || high52 <= low52) return;
    const pct = Math.max(0, Math.min(100, ((cur - low52) / (high52 - low52)) * 100));
    let rangeDiv = blk.querySelector('.stk-range');
    if (!rangeDiv) {
        rangeDiv = document.createElement('div');
        rangeDiv.className = 'stk-range';
        const fill = document.createElement('div');
        fill.className = 'stk-range-fill';
        rangeDiv.appendChild(fill);
        // Insert after .stk-chart
        const chart = blk.querySelector('.stk-chart');
        if (chart && chart.parentNode) chart.insertAdjacentElement('afterend', rangeDiv);
        else blk.appendChild(rangeDiv);
    }
    const fill = rangeDiv.querySelector('.stk-range-fill');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    rangeDiv.title = `52w Low: $${low52?.toFixed(2)} | Current | High: $${high52?.toFixed(2)}`;
}

// Feature 49: Font Size Scaler (TV distance adjustment)
let _fontScale = parseFloat(localStorage.getItem('dash_fontScale') || '1.0');
let _fontScaleTimer = null;
function applyFontScale() {
    const container = document.querySelector('.container');
    if (container) container.style.fontSize = (_fontScale * 16) + 'px';
    const indicator = document.getElementById('font-scale-indicator');
    if (indicator) {
        indicator.textContent = `Aa ${Math.round(_fontScale * 100)}%`;
        indicator.classList.add('visible');
        clearTimeout(_fontScaleTimer);
        _fontScaleTimer = setTimeout(() => indicator.classList.remove('visible'), 2000);
    }
}
function adjustFontScale(delta) {
    _fontScale = Math.max(0.7, Math.min(1.5, parseFloat((_fontScale + delta).toFixed(2))));
    localStorage.setItem('dash_fontScale', _fontScale);
    applyFontScale();
}

// ══════════════════════════════════════════════════════════
// SPRINT 6 FEATURES (51–60)
// ══════════════════════════════════════════════════════════

// Feature 51: Portfolio Total Value Display
let _stkPrices = {};  // { SYM: latestPrice } — cache for portfolio total
function updatePortfolioTotal() {
    const portfolio = _getPortfolio();
    const syms = Object.keys(portfolio);
    if (!syms.length) return;
    let totalValue = 0, totalCost = 0, hasAny = false;
    for (const sym of syms) {
        const pos = portfolio[sym];
        const price = _stkPrices[sym];
        if (!pos?.qty || !pos?.cost || !price) continue;
        totalValue += price * pos.qty;
        totalCost += pos.cost * pos.qty;
        hasAny = true;
    }
    if (!hasAny) return;
    const pnl = totalValue - totalCost;
    const pct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const row = document.getElementById('stk-total-row');
    const valEl = document.getElementById('stk-total-val');
    const pnlEl = document.getElementById('stk-total-pnl');
    if (!row || !valEl || !pnlEl) return;
    valEl.textContent = '$' + totalValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = pnl >= 0 ? '+' : '';
    pnlEl.textContent = `${sign}$${Math.abs(pnl).toFixed(0)} (${sign}${pct.toFixed(1)}%)`;
    pnlEl.className = pnl >= 0 ? 'gain' : 'loss';
    row.style.display = '';
    // F132: update header portfolio P&L chip
    if (el.headerPortfolioPl) {
        const chipSign = pnl >= 0 ? '+' : '';
        el.headerPortfolioPl.textContent = `💼 ${chipSign}${pct.toFixed(1)}%`;
        el.headerPortfolioPl.className = pnl >= 0 ? 'pl-gain' : 'pl-loss';
        el.headerPortfolioPl.style.display = '';
    }
}

// Feature 53: Daf Yomi Sefaria Deep Link
let _dafSefariaRef = null;
function openDafOnSefaria() {
    const url = _dafSefariaRef
        ? 'https://www.sefaria.org/' + _dafSefariaRef
        : 'https://www.sefaria.org/Daf_Yomi';
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Feature 54: Night Screen Auto-Dimmer
let _nightDimOverride = false;
let _nightDimOn = false;
function updateNightDimmer() {
    if (_nightDimOverride) return;
    const h = parseInt(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem'
    }), 10);
    const dimStart = parseInt(localStorage.getItem('dash_dim_start') ?? '23', 10);
    const dimEnd   = parseInt(localStorage.getItem('dash_dim_end')   ?? '6',  10);
    // Handle wrap-around midnight: e.g. 23:00 → 06:00
    const shouldDim = dimStart > dimEnd ? (h >= dimStart || h < dimEnd) : (h >= dimStart && h < dimEnd);
    const overlay = document.getElementById('night-dim');
    if (!overlay) return;
    if (shouldDim !== _nightDimOn) {
        _nightDimOn = shouldDim;
        overlay.style.opacity = shouldDim ? '0.45' : '0';
    }
}
function toggleNightDim() {
    const overlay = document.getElementById('night-dim');
    if (!overlay) return;
    _nightDimOverride = true;
    _nightDimOn = !_nightDimOn;
    overlay.style.opacity = _nightDimOn ? '0.45' : '0';
    // Auto-cancel override after 10 minutes so schedule resumes
    setTimeout(() => { _nightDimOverride = false; updateNightDimmer(); }, 600000);
}

// Feature 55: Stock Price Threshold Alerts
function _getStockAlerts() {
    try { return JSON.parse(localStorage.getItem('dash_stock_alerts') || '{}'); } catch { return {}; }
}
// F131: Track fired alerts per session so we don't spam on every refresh
const _firedStockAlerts = new Set();
function checkStockAlerts(sym, price) {
    const alerts = _getStockAlerts();
    const rule = alerts[sym];
    if (!rule || !price) return;
    const blk = document.querySelector(`.stk[data-symbol="${CSS.escape(sym)}"]`);
    if (!blk) return;
    blk.classList.remove('alert-above', 'alert-below');
    if (rule.above != null && price >= parseFloat(rule.above)) {
        blk.classList.add('alert-above');
        playAlertBeep(1046, 0.12, 0.2);  // C6 — price above target
        const key = sym + ':above:' + Math.floor(price / 10);
        if (!_firedStockAlerts.has(key)) {
            _firedStockAlerts.add(key);
            const msg = `📈 ${sym} עלה מעל ${fmtPrice(rule.above, sym)}`;
            showToast(msg, 5000); // F131
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification('⬆️ ' + sym, { body: `המחיר ${fmtPrice(price, sym)} חצה יעד ${fmtPrice(rule.above, sym)}`, dir: 'rtl', lang: 'he' }); } catch (_) {}
            }
            diagLog(`F131: stock alert above fired ${sym}=${price}`);
        }
    } else if (rule.below != null && price <= parseFloat(rule.below)) {
        blk.classList.add('alert-below');
        playAlertBeep(330, 0.12, 0.2);   // E4 — price below target
        const key = sym + ':below:' + Math.floor(price / 10);
        if (!_firedStockAlerts.has(key)) {
            _firedStockAlerts.add(key);
            const msg = `📉 ${sym} ירד מתחת ל-${fmtPrice(rule.below, sym)}`;
            showToast(msg, 5000); // F131
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification('⬇️ ' + sym, { body: `המחיר ${fmtPrice(price, sym)} חצה יעד ${fmtPrice(rule.below, sym)}`, dir: 'rtl', lang: 'he' }); } catch (_) {}
            }
            diagLog(`F131: stock alert below fired ${sym}=${price}`);
        }
    }
}

// Feature 58: Calendar Event Category Detection
function detectCalCategory(summary) {
    const s = (summary || '').toLowerCase();
    if (/\b(work|עבודה|meeting|פגישה|office|משרד|zoom|ועדה|ישיבה|הרצאה|תכנון|פרויקט)\b/.test(s)) return 'work';
    if (/\b(family|משפחה|ילדים|בית|הורים|dinner|ארוחה|אמא|אבא|סבא|סבתא|אחים|חתונה|ברית|בר.מצוה)\b/.test(s)) return 'family';
    if (/\b(doctor|רופא|רופאה|קופת|medical|בריאות|hospital|clinic|ניתוח|טיפול|שיניים|תרופות|אמבולנס)\b/.test(s)) return 'health';
    if (/\b(חג|holiday|shabbat|שבת|eid|omer|passover|pesach|sukk|chanuk|purim|rosh|yom.kip|שמחה|חנוכה|פורים|פסח|סוכות|שבועות)\b/i.test(s)) return 'holiday';
    return 'default';
}

// Feature 59: Force Refresh (R key — clears in-memory cache, reloads all panes)
function forceRefresh() {
    _mem.clear();  // clear in-memory cache layer
    const toast = document.getElementById('refresh-toast');
    if (toast) { toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2200); }
    [loadHebrewDate, loadWeather, loadNews, loadAllStocks,
     loadCurrency, loadAlerts, loadCalendar, loadHalacha, loadHebCal, loadZmanim].forEach(fn => safeLoad(fn));
    stampRefresh();
}

// ── SPRINT 7 FEATURES (F61–F70) ──

// Feature 61: Stock Relative Volume Badge
function getRelVolBadge(regularVol, avgVol) {
    if (!regularVol || !avgVol || avgVol <= 0) return null;
    const ratio = regularVol / avgVol;
    if (ratio >= 2.5) return { cls: 'stk-vol-xhigh', text: `VOL \u00d7${ratio.toFixed(1)}` };
    if (ratio >= 1.5) return { cls: 'stk-vol-high',  text: `VOL +${Math.round((ratio - 1) * 100)}%` };
    return null;
}

// Feature 63: Calendar 7-day event density mini-strip
const CAL_WEEK_DAY_HE = ['\u05e9', '\u05d0', '\u05d1', '\u05d2', '\u05d3', '\u05d4', '\u05d5']; // Sat Sun Mon Tue Wed Thu Fri
function renderCalWeekStrip(events) {
    const strip = document.getElementById('cal-week-strip');
    if (!strip) return;
    const now = new Date();
    const rows = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + i);
        const key = day.toDateString();
        const count = events.filter(ev => ev.start && ev.start.toDateString() === key).length;
        const isToday = i === 0;
        const dots = [...Array(Math.min(count, 4))].map((_, j) =>
            `<div class="cal-week-dot" style="background:${j === 0 ? 'var(--accent)' : j === 1 ? 'var(--positive)' : j === 2 ? 'var(--warning)' : '#94a3b8'}"></div>`
        ).join('');
        // Feature 72: heat-map class based on event count
        const heatClass = count >= 4 ? ' heat-3' : count >= 2 ? ' heat-2' : count >= 1 ? ' heat-1' : '';
        rows.push(`<div class="cal-week-day${isToday ? ' cal-week-today' : ''}${heatClass}"><div class="cal-week-label">${CAL_WEEK_DAY_HE[day.getDay()]}</div><div class="cal-week-dots">${dots}</div></div>`);
    }
    strip.innerHTML = rows.join('');
}


// Feature 65: Per-stock price history sparkline (localStorage — last 8 closes)
const _STK_PH_PFX = 'dash_sph_';
const _STK_PH_MAX = 8;
function recordStkPrice(sym, price) {
    if (!price || !isFinite(price)) return;
    try {
        const arr = JSON.parse(localStorage.getItem(_STK_PH_PFX + sym) || '[]');
        arr.push(+price.toFixed(4));
        if (arr.length > _STK_PH_MAX) arr.splice(0, arr.length - _STK_PH_MAX);
        localStorage.setItem(_STK_PH_PFX + sym, JSON.stringify(arr));
    } catch (_) {}
}
function drawStkSpark(blk, sym) {
    try {
        const arr = JSON.parse(localStorage.getItem(_STK_PH_PFX + sym) || '[]');
        if (arr.length < 2) return;
        let svgEl = blk.querySelector('.stk-ph-spark');
        if (!svgEl) {
            svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgEl.setAttribute('class', 'stk-ph-spark');
            svgEl.setAttribute('viewBox', '0 0 44 12');
            svgEl.setAttribute('preserveAspectRatio', 'none');
            const rangeEl = blk.querySelector('.stk-range');
            if (rangeEl) rangeEl.insertAdjacentElement('afterend', svgEl);
            else blk.appendChild(svgEl);
        }
        // R5.10: use shared sparkline path builder (polyline mode)
        const { d, trend } = _sparkPath(arr, 44, 12, false);
        svgEl.innerHTML = `<polyline points="${d}" fill="none" stroke="${trend}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    } catch (_) {}
}

// Feature 67: News item published age (relative)
function newsRelAge(pubDate) {
    if (!pubDate) return '';
    try {
        const mins = Math.round((Date.now() - new Date(pubDate)) / 60000);
        if (!isFinite(mins) || mins < 0) return '';
        if (mins < 60) return `\u05dc\u05e4\u05e0\u05d9 ${mins}\u05d3'`;
        const hrs = Math.round(mins / 60);
        if (hrs < 24) return `\u05dc\u05e4\u05e0\u05d9 ${hrs}\u05e9'`;
        return `\u05dc\u05e4\u05e0\u05d9 ${Math.round(hrs / 24)}\u05d9'`;
    } catch (_) { return ''; }
}

// Feature 68: Market open/close countdown below stocks
function updateMarketCountdown() {
    const cntEl = document.getElementById('stk-mkt-countdown');
    if (!cntEl) return;
    const nyNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const dow = nyNow.getDay(); // 0=Sun 6=Sat
    const tot = nyNow.getHours() * 60 + nyNow.getMinutes();
    const OPEN = 9 * 60 + 30, CLOSE = 16 * 60;
    const fmt = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
    if (dow === 0 || dow === 6) {
        cntEl.textContent = '\u05e9\u05d5\u05e7 \u05e1\u05d2\u05d5\u05e8 (\u05e1\u05d5\u05e4\u05e9\u05d1\u05d5\u05e2)';
        cntEl.className = '';
    } else if (tot < OPEN) {
        cntEl.textContent = `\u23f3 \u05e0\u05d9\u05d5 \u05d9\u05d5\u05e8\u05e7 \u05e0\u05e4\u05ea\u05d7 \u05d1\u05e2\u05d5\u05d3 ${fmt(OPEN - tot)}`;
        cntEl.className = 'mkt-soon';
    } else if (tot < CLOSE) {
        cntEl.textContent = `\ud83d\udcc8 NYSE \u05e4\u05ea\u05d5\u05d7 \u2014 \u05e0\u05e1\u05d2\u05e8 \u05d1\u05e2\u05d5\u05d3 ${fmt(CLOSE - tot)}`;
        cntEl.className = 'mkt-open';
    } else {
        cntEl.textContent = '\u05e9\u05d5\u05e7 \u05e0\u05d9\u05d5 \u05d9\u05d5\u05e8\u05e7 \u05e1\u05d2\u05d5\u05e8';
        cntEl.className = '';
    }
}


// Feature 70: Copy full diagnostics log to clipboard
function copyDiagLog() {
    const logEl = document.getElementById('diag-log');
    const panesEl = document.getElementById('diag-panes');
    if (!logEl) return;
    const text = (panesEl ? panesEl.innerText + '\n---\n' : '') + logEl.innerText;
    navigator.clipboard?.writeText(text).then(() => {
        const btn = document.getElementById('diag-copy-btn');
        if (btn) { btn.textContent = '✓ הועתק'; setTimeout(() => { btn.textContent = '📋 העתק לוג'; }, 2000); }
        showToast('📋 לוג אבחון הועתק!'); // F121: toast feedback
    });
}

// ── SPRINT 8 FEATURES (F71–F80) ──

// Feature 71: GBP / ILS — handled in renderCurrency() extension (see below)

// Feature 77: Shabbat remaining time pill in header
function updateShabbatHeaderPill() {
    const pill = document.getElementById('header-shabbat-pill');
    if (!pill) return;
    if (!_candleDate) { pill.style.display = 'none'; return; }
    const now = Date.now();
    const candleMs = _candleDate.getTime();
    const havdalahMs = _shabbatEnd ? _shabbatEnd.getTime() : 0;
    let show = false, txt = '';
    if (now < candleMs) {
        const diff = candleMs - now;
        if (diff < 3600000 * 36) { // within 36h pre-Shabbat
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            txt = `\ud83d\udd6f\ufe0f ${h ? h + '\u05e9 ' : ''}${m}\u05d3`;
            show = true;
        }
    } else if (havdalahMs && now < havdalahMs) { // Shabbat active
        const diff = havdalahMs - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        txt = `\u2728 ${h ? h + '\u05e9 ' : ''}${m}\u05d3`;
        show = true;
    }
    pill.textContent = txt;
    pill.style.display = show ? 'block' : 'none';
}

// Feature 78: Parasha weekly progress bar (Sun=0/7 → Sat=7/7)
function renderParashaProgress() {
    const row = document.getElementById('hc-parasha-progress-row');
    const fill = document.getElementById('hc-parasha-progress-fill');
    if (!row || !fill) return;
    const hcParashaRow = document.getElementById('hc-parasha-row');
    if (!hcParashaRow || hcParashaRow.style.display === 'none') { row.style.display = 'none'; return; }
    // Day of week: 0=Sun (start of week after Shabbat) → 6=Sat (Shabbat)
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    // Reading cycle: Shabbat=end, so pct = (dayOfWeek+1)/7
    const pct = Math.min(100, Math.max(5, Math.round(((dayOfWeek + 1) / 7) * 100)));
    fill.style.width = pct + '%';
    row.style.display = '';
}

// Feature 79: Weather chart hover tooltip (SVG <title> on each data point)
// Implemented inline in renderHourlyChart() — see updated function below

// Feature 80: PWA install prompt
let _pwaInstallPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _pwaInstallPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'block';
});
function pwaInstall() {
    if (!_pwaInstallPrompt) return;
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(() => {
        _pwaInstallPrompt = null;
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.style.display = 'none';
    });
}

// ── SPRINT 9 FEATURES (F81–F90) ──

// Feature 85: Multi-photo background slideshow
// cfg-bg-url supports comma-separated URLs → auto-cycle every 30s with fade
let _slideshowTimer = null;
let _slideshowPhotos = [];
let _slideshowIdx = 0;
function startPhotoSlideshow(urls) {
    stopPhotoSlideshow();
    _slideshowPhotos = urls;
    _slideshowIdx = 0;
    _applySlide();
    _slideshowTimer = setInterval(() => {
        _slideshowIdx = (_slideshowIdx + 1) % _slideshowPhotos.length;
        _applySlide();
    }, 30000);
}
function stopPhotoSlideshow() {
    if (_slideshowTimer) { clearInterval(_slideshowTimer); _slideshowTimer = null; }
}
function _applySlide() {
    if (!_slideshowPhotos.length) return;
    setBgImage(_slideshowPhotos[_slideshowIdx]);
    // Brief fade-in animation
    document.body.classList.remove('slideshow-fade');
    void document.body.offsetWidth; // force reflow
    document.body.classList.add('slideshow-fade');
}

// Feature 86: Alert zone filter — only show alerts for cities in the configured zone
function _getAlertZone() {
    const z = localStorage.getItem('dash_alert_zone') || '';
    return z ? z.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
}
function filterAlertsByZone(data) {
    const zones = _getAlertZone();
    if (!zones.length) return data;
    return data.map(ev => {
        const filtered = ev.alerts.map(a => ({
            ...a,
            cities: (a.cities || []).filter(c => zones.some(z => c.toLowerCase().includes(z)))
        })).filter(a => a.cities.length > 0);
        return { ...ev, alerts: filtered };
    }).filter(ev => ev.alerts.length > 0);
}

// Feature 87: News headline description tooltip — set on rss-title spans
// (Applied at render time in the news markup loop — see updated renderNews)

// Feature 89: Clock seconds toggle — click clock to show/hide seconds
let _clockSec = localStorage.getItem('dash_clockSec') === 'true';
let _secInterval = null;
function applyClockSec() {
    const clkEl = document.getElementById('clock');
    if (!clkEl) return;
    clkEl.classList.toggle('with-seconds', _clockSec);
    if (_clockSec) {
        if (!_secInterval) _secInterval = setInterval(tickClock, 1000);
    } else {
        if (_secInterval) { clearInterval(_secInterval); _secInterval = null; }
    }
}
function toggleClockSec() {
    _clockSec = !_clockSec;
    localStorage.setItem('dash_clockSec', _clockSec);
    applyClockSec();
    diagLog('Clock seconds: ' + (_clockSec ? 'on' : 'off'));
}

// Feature 90: Offline banner with cache age
function _recordOnlineTime() {
    if (navigator.onLine) localStorage.setItem('dash_last_online', String(Date.now()));
}
function _getOfflineCacheAgeStr() {
    const ts = parseInt(localStorage.getItem('dash_last_online') || '0', 10);
    if (!ts) return '';
    const diffMs = Date.now() - ts;
    const diffMin = Math.round(diffMs / 60000);
    const lastTime = new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
    if (diffMin < 60) return `(נתונים מ-${lastTime}, לפני ${diffMin}ד)`;
    const diffH = Math.round(diffMin / 60);
    return `(נתונים מ-${lastTime}, לפני ${diffH}ש)`;
}

// ── Diagnostic Logger ──
const DIAG_BUFFER_SIZE = 80;
const DIAG_DISPLAY_LIMIT = 20;
const _diagLog = [];
const _diagStatus = {};
function diagLog(msg) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    const entry = `[${ts}] ${msg}`;
    _diagLog.push(entry);
    if (_diagLog.length > DIAG_BUFFER_SIZE) _diagLog.shift();
    console.log('[Dashboard]', msg);
    refreshDiag();
}
function diagPane(name, status, detail) {
    _diagStatus[name] = { status, detail, ts: Date.now() };
    refreshDiag();
}
function refreshDiag() {
    const el = document.getElementById('diag-panes');
    const logEl = document.getElementById('diag-log');
    if (!el) return;
    el.innerHTML = Object.entries(_diagStatus).map(([k, v]) => {
        const cls = v.status === 'ok' ? 'ok' : v.status === 'error' ? 'err' : 'pending';
        return `<div class="diag-row"><span class="pane">${k}</span><span class="status ${cls}">${v.status}</span><span>${v.detail || ''}</span></div>`;
    }).join('');
    if (logEl) logEl.textContent = _diagLog.slice(-DIAG_DISPLAY_LIMIT).join('\n');
}
function toggleDiag() {
    const overlay = document.getElementById('diag-overlay');
    if (overlay) overlay.classList.toggle('visible');
}

// ── Global Error Catchers (auto-show diag on errors) ──
window.addEventListener('unhandledrejection', e => {
    diagLog('UNHANDLED REJECTION: ' + (e.reason?.message || e.reason || 'unknown'));
    const overlay = document.getElementById('diag-overlay');
    if (overlay && !overlay.classList.contains('visible')) toggleDiag();
});
window.addEventListener('error', e => {
    diagLog('JS ERROR: ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno);
    const overlay = document.getElementById('diag-overlay');
    if (overlay && !overlay.classList.contains('visible')) toggleDiag();
});

/** Safe loader — catches errors so one failing pane doesn't break others (async-aware) */
async function safeLoad(fn) {
    try {
        diagPane(fn.name, 'loading', 'started');
        await fn();
        diagPane(fn.name, 'ok', 'done');
    } catch (e) {
        console.error('[Dashboard] Loader failed:', fn.name, e);
        diagLog(`FAIL: ${fn.name} — ${e.message}`);
        diagPane(fn.name, 'error', e.message?.substring(0, 60));
    }
}

function init() {
    diagLog('init() starting — origin: ' + location.protocol + '//' + location.host);
    // ── Startup Self-Check ──
    let issues = 0;
    // Validate motivations array integrity
    for (let i = 0; i < MOTIVATIONS.length; i++) {
        const m = MOTIVATIONS[i];
        if (!m || typeof m.t !== 'string') { diagLog(`SELFCHECK: MOTIVATIONS[${i}] malformed`); issues++; }
    }
    // Validate DOM refs
    const missingEls = Object.entries(el).filter(([k, v]) => v === null).map(([k]) => k);
    if (missingEls.length) { diagLog('SELFCHECK: Missing DOM refs: ' + missingEls.join(', ')); issues++; }
    // Validate proxies
    if (!PROXIES.length) { diagLog('SELFCHECK: PROXIES array is empty — all API calls will fail'); issues++; }
    // Validate stock symbols
    if (!STOCK_SYMBOLS.length) { diagLog('SELFCHECK: STOCK_SYMBOLS is empty'); issues++; }
    if (issues) { diagLog(`SELFCHECK: ${issues} issue(s) found — opening diagnostics`); toggleDiag(); }
    else { diagLog('SELFCHECK: All pre-flight checks passed'); }

    // Log hardware capabilities
    const gpuInfo = detectGPU();
    diagLog(`PERF: CPU cores=${CPU_CORES}, concurrency limit=${MAX_CONCURRENT} (60%)`);
    diagLog(`PERF: GPU=${gpuInfo.gpu}, renderer=${gpuInfo.renderer}`);
    diagLog(`PERF: requestIdleCallback=${!!window.requestIdleCallback}, WebGL=${gpuInfo.renderer !== 'no WebGL'}`);

    scheduleIdle(() => cEvict()); // defer non-critical cache cleanup
    initScreenMode();
    initTheme();
    initAlerts();
    updateNightDimmer();  // Feature 54: check night dim on startup
    updateNetworkBanner();
    tickClock(); updateMarketBadge();

    // ── New feature startup hooks ──
    startBurnInProtection();
    startBgCycling();
    checkBirthdays();
    applySeasonClass();   // Feature 27: apply spring/summer/autumn/winter body class
    updateMoonPhase();    // Feature 24: initial moon phase display
    checkElecPeak();      // Feature 22: initial electricity peak check
    updateChoreWheel();   // Feature 34: initial chore wheel
    initNewsFilter();     // Feature 39: news filter chips
    checkConnectivity();  // Feature 40: connectivity check
    renderCurrencySparklines(); // Feature 38: draw sparklines from history
    renderParashaProgress();    // Feature 78: initial parasha progress (may be hidden until data loads)
    applyClockSec();            // Feature 89: restore clock seconds preference
    _recordOnlineTime();        // Feature 90: record initial online time
    document.getElementById('clock')?.addEventListener('click', toggleClockSec);  // F89
    document.getElementById('pwa-install-btn')?.addEventListener('click', pwaInstall);
    initWxCityTabs();     // Feature 45: multi-city weather tabs
    injectHomeCity();     // Feature 93: home city config
    applyFontScale();     // Feature 49: restore saved font scale
    updateNightDimmer();  // Feature 54: check night dim on startup
    updateMarketCountdown(); // Feature 68: initial market countdown button wiring
    applyHiddenStocks();  // Feature 96: apply hidden stocks config
    // Sprint 12 init hooks
    initNotifBell();      // F114: show bell if notification permission not granted
    initWeatherCities();  // F117: load configured weather city names/coords
    switchCfgTab(localStorage.getItem('dash_cfg_tab') || 'display'); // F119: restore last tab
    // F103: wire news search input
    if (el.newsSearch) {
        el.newsSearch.addEventListener('input', () => {
            clearTimeout(_newsSearchDebounce);
            _newsSearchDebounce = setTimeout(() => applyNewsSearch(el.newsSearch.value.trim()), 250);
        });
        el.newsSearch.addEventListener('keydown', e => { if (e.key === 'Escape') { el.newsSearch.value = ''; applyNewsSearch(''); } });
    }
    if (el.newsSearchClear) el.newsSearchClear.addEventListener('click', () => { if (el.newsSearch) el.newsSearch.value = ''; applyNewsSearch(''); });
    document.getElementById('cfg-gear-btn')?.addEventListener('click', toggleConfig);
    document.getElementById('cfg-save-btn')?.addEventListener('click', saveConfig);
    document.getElementById('cfg-close-btn')?.addEventListener('click', toggleConfig);
    document.getElementById('config-overlay')?.addEventListener('click', e => { if (e.target === document.getElementById('config-overlay')) toggleConfig(); });
    // Wire °C/°F toggle to temperature elements
    el.topTemp?.addEventListener('click', toggleTempUnit);
    el.wxTemp?.addEventListener('click', toggleTempUnit);
    el.helpOverlay?.addEventListener('click', e => { if (e.target === el.helpOverlay) toggleHelp(); });

    const loaders = [loadHebrewDate, loadOmer, loadWeather,
                     loadNews, loadAllStocks, loadCurrency, loadAlerts, loadMotivation, loadCalendar, loadHalacha, loadHebCal, loadZmanim, loadPsalm];
    runConcurrent(loaders.map(fn => () => safeLoad(fn))).then(() => {
        diagLog('All loaders settled');
        stampRefresh();
        // F102: load secondary calendar sources if configured
        if (localStorage.getItem('dash_ics_url_2') || localStorage.getItem('dash_ics_url_3')) {
            safeLoad(loadCalendarExtra);
        }
    });
    initPrintDate();               // F140: wire beforeprint event for print datetime
    updateCountdownChip(new Date()); // F139: initial render of countdown chip
    setupCardCollapse();           // F159: wire collapse buttons and restore persisted state
    applyNewsFontScale();          // F160: apply saved news font size
    // F157: wire halacha ticker bar click to show full text overlay
    const tickerBar = document.querySelector('.ticker-bar');
    if (tickerBar) tickerBar.addEventListener('click', _showHalachaOverlay);
    if (el.halachaOverlay) {
        el.halachaOverlay.addEventListener('click', e => { if (!e.target.closest('.halacha-overlay-inner')) _closeHalachaOverlay(); });
        el.halachaOverlay.querySelector('.halacha-overlay-close')?.addEventListener('click', _closeHalachaOverlay);
    }
}

// Real-time (1min) — clock has no seconds, minute tick is sufficient
setInterval(tickClock, 60000);

// Critical — adaptive (alerts schedule themselves via setTimeout)
// loadAlerts() called in init(), then self-schedules 60s/5min

// Medium (5-15min)
setInterval(() => { loadNews(); stampRefresh(); }, 900000); // 15min

// Medium-slow (stocks: adaptive 5min open / 30min closed, weather: 30min)
function scheduleStockRefresh() {
    const interval = getStockTTL() === 600000 ? 300000 : 1800000; // 5min market open, 30min closed
    setTimeout(() => { loadAllStocks().then(stampRefresh); scheduleStockRefresh(); }, interval);
}
scheduleStockRefresh();
setInterval(() => { loadWeather(); stampRefresh(); }, 1800000);  // 30min

// Slow (1h+)
setInterval(loadCurrency, 3600000);       // 1h
setInterval(loadMotivation, 120000);     // 2min loop — cycles through 50 quotes on TV display
setInterval(loadCalendar, 900000);        // 15min

// Very slow (3h+)
setInterval(loadHebrewDate, 10800000);    // 3h
setInterval(loadHebCal, 21600000);        // 6h — refresh heb-cal card
setInterval(loadHalacha, 43200000);       // 12h — daily halacha
setInterval(loadOmer, 1800000);           // 30min — re-check omer (switches at sunset)
setInterval(loadZmanim, 43200000);        // 12h — zmanim change once per day
setInterval(updateShabbatCountdown, 60000); // 1min — live Shabbat countdown
setInterval(checkCalendarReminders, 60000); // 1min — F124: calendar event reminders
setInterval(updateShabbatHeaderPill, 60000); // 1min — Feature 77: header shabbat pill
setInterval(checkBirthdays, 3600000);     // 1h   — birthday re-check
setInterval(applyAutoTheme, 900000);      // 15min — re-evaluate night/day theme
setInterval(updateMoonPhase, 3600000);    // 1h   — moon phase update (Feature 24)
setInterval(applySeasonClass, 43200000);  // 12h  — re-check season at midday/midnight (Feature 27)
setInterval(() => { _psalmLoaded = false; loadPsalm(); }, 86400000); // 24h — reload psalm at next day (Feature 23)
setInterval(updateChoreWheel, 3600000);   // 1h   — chore wheel (Feature 34)
setInterval(checkConnectivity, 300000);   // 5min — connectivity check (Feature 40)
setInterval(updateMarketBadge, 60000);    // 1min — market badge (Sprint 5: pre/after now time-sensitive)
setInterval(updateNightDimmer, 60000);    // 1min — night screen dimmer re-check (Feature 54)
setInterval(updateMarketCountdown, 60000); // 1min — market open/close countdown (Feature 68)

// ── Card Entrance Animations ──
const CARD_ANIMS = ['cardSlideLeft','cardSlideRight','cardSlideUp','cardSlideDown','cardPopIn','cardFlipIn'];
function randomAnim() { return CARD_ANIMS[Math.floor(Math.random() * CARD_ANIMS.length)]; }

/** Assign random entrance animation to each card on startup */
function initCardAnimations() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, i) => {
        card.style.animation = `${randomAnim()} 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.08}s both`;
    });
}

/** Every 5min, pick a random card and re-animate it for attention */
function cardAttentionLoop() {
    const cards = document.querySelectorAll('.card');
    if (!cards.length) return;
    const card = cards[Math.floor(Math.random() * cards.length)];
    const anim = randomAnim();
    // Remove current animation, force reflow, apply new one
    card.style.animation = 'none';
    void card.offsetWidth; // force reflow
    card.style.animation = `${anim} 0.7s cubic-bezier(0.22, 1, 0.36, 1) both`;
}
setInterval(cardAttentionLoop, 300000); // 5min

// ── Card Maximize (click card header to expand/collapse) ──
let _maximizedCard = null;
/** Track manual scroll state for maximized looping cards */
let _manualScroll = null; // { el, offset, halfH }

/** Find the scroll-loop container inside a card (news/stocks/alerts) */
function _findScrollLoop(card) {
    return card.querySelector('.rss-scroll, .stocks-scroll, .alerts-scroll');
}

/** Get current translateY from a CSS-animated element's computed transform */
function _getCurrentTranslateY(el) {
    const st = getComputedStyle(el);
    const m = st.transform || st.webkitTransform;
    if (!m || m === 'none') return 0;
    // matrix(a,b,c,d,tx,ty)
    const parts = m.match(/matrix.*\((.+)\)/);
    if (!parts) return 0;
    const vals = parts[1].split(',').map(Number);
    return vals[5] || 0; // ty
}

/** Pause CSS animation and switch to manual translateY for wheel control */
function _enableManualScroll(card) {
    const loop = _findScrollLoop(card);
    if (!loop) return;
    const offset = _getCurrentTranslateY(loop);
    const halfH = loop.scrollHeight / 2;
    // Pause animation and take over with manual transform
    loop.style.animationPlayState = 'paused';
    loop.style.transform = `translateY(${offset}px)`;
    _manualScroll = { el: loop, offset, halfH };
}

/** Restore CSS animation when card is collapsed */
function _disableManualScroll() {
    if (!_manualScroll) return;
    const { el } = _manualScroll;
    el.style.transform = '';
    el.style.animationPlayState = '';
    _manualScroll = null;
}

/** Handle wheel events on maximized cards with scroll loops */
function _onMaximizedWheel(e) {
    if (!_manualScroll) return;
    e.preventDefault();
    const { el, halfH } = _manualScroll;
    // Apply delta (negative = scroll down = content moves up)
    _manualScroll.offset -= e.deltaY;
    // Wrap around for seamless loop: keep offset in [-halfH, 0]
    if (_manualScroll.offset < -halfH) _manualScroll.offset += halfH;
    if (_manualScroll.offset > 0) _manualScroll.offset -= halfH;
    el.style.transform = `translateY(${_manualScroll.offset}px)`;
}

/** Compute the target rect for a maximized card (fills area below clock header, above footer) */
function _maxTargetRect() {
    const container = document.querySelector('.container');
    const timeSection = document.querySelector('.time-section');
    const footer = document.querySelector('.status-bar');
    const cRect = container.getBoundingClientRect();
    // Top edge: just below the clock/header section so it stays visible
    const top = timeSection ? timeSection.getBoundingClientRect().bottom + 6 : cRect.top;
    // Bottom edge: just above footer (or container bottom)
    const bottom = footer ? footer.getBoundingClientRect().top - 6 : cRect.bottom;
    return { top, left: cRect.left, width: cRect.width, height: bottom - top };
}

// R6.9: Collapse a maximized card back to its original position
function _collapseCard(card) {
    _disableManualScroll();
    card.removeEventListener('wheel', _onMaximizedWheel);
    const orig = card._origRect;
    if (orig) {
        card.style.top = orig.top + 'px';
        card.style.left = orig.left + 'px';
        card.style.width = orig.width + 'px';
        card.style.height = orig.height + 'px';
    }
    const onEnd = () => {
        card.removeEventListener('transitionend', onEnd);
        card.classList.remove('maximized');
        card.style.top = card.style.left = card.style.width = card.style.height = '';
        card.style.position = '';
        delete card._origRect;
    };
    card.addEventListener('transitionend', onEnd, { once: false });
    setTimeout(onEnd, 500);
    document.querySelectorAll('.card-hidden').forEach(c => c.classList.remove('card-hidden'));
    _maximizedCard = null;
}

// R6.9: Expand a card to fill the viewport area below clock
function _expandCard(card) {
    if (_maximizedCard) return;
    if (card.id === 'card-alerts' || card.querySelector('#alerts-badge-count')) resetAlertsBadge();
    const startRect = card.getBoundingClientRect();
    card._origRect = { top: startRect.top, left: startRect.left, width: startRect.width, height: startRect.height };
    document.querySelectorAll('.grid-col > .card').forEach(el => {
        if (el !== card) el.classList.add('card-hidden');
    });
    card.style.position = 'fixed';
    card.style.top = startRect.top + 'px';
    card.style.left = startRect.left + 'px';
    card.style.width = startRect.width + 'px';
    card.style.height = startRect.height + 'px';
    card.classList.add('maximized');
    void card.offsetWidth;
    const target = _maxTargetRect();
    card.style.top = target.top + 'px';
    card.style.left = target.left + 'px';
    card.style.width = target.width + 'px';
    card.style.height = target.height + 'px';
    _maximizedCard = card;
    if (_findScrollLoop(card)) {
        _enableManualScroll(card);
        card.addEventListener('wheel', _onMaximizedWheel, { passive: false });
    }
}

function toggleCardMaximize(card) {
    if (card.classList.contains('maximized')) _collapseCard(card);
    else _expandCard(card);
}

/** Attach click listeners to all card headers */
function initCardMaximize() {
    document.querySelectorAll('.card-header').forEach(hdr => {
        hdr.addEventListener('click', e => {
            const card = hdr.closest('.card');
            if (!card) return;
            e.stopPropagation();
            toggleCardMaximize(card);
        });
    });
}

// Inline end-of-body: DOM is parsed but DOMContentLoaded may not have fired yet.
// Use exclusive if/else so init() is called exactly once.
loadFromHash(); // F120: apply URL hash settings before init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        scheduleIdle(() => initCardAnimations());
        initCardMaximize();
    });
} else {
    init();
    scheduleIdle(() => initCardAnimations());
    initCardMaximize();
}

// Feature 92/101: ServiceWorker registration + update notification banner
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
        diagLog('SW registered: ' + (reg.scope || ''));
        // F101: show update banner when a new SW is waiting
        function showUpdateBanner() {
            const banner = document.getElementById('sw-update-banner');
            if (banner) { banner.classList.add('visible'); diagLog('SW update available — showing banner'); }
        }
        if (reg.waiting) showUpdateBanner();
        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner();
            });
        });
        // After SW activates (SKIP_WAITING sent), reload page
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) { refreshing = true; location.reload(); }
        });
        // F113: SW notifies page when network recovers — re-load stale panes
        // F167: SW notifies page when a new version has activated
        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data?.type === 'NETWORK_BACK') {
                diagLog('SW: network restored — refreshing stale panes');
                safeLoad(loadWeather); safeLoad(loadHebCal); safeLoad(loadAlerts); safeLoad(loadAllStocks);
            }
            if (e.data?.type === 'VERSION_ACTIVATED') {
                diagLog('SW: version activated — ' + (e.data.version || ''));
            }
        });
    }).catch(err => {
        diagLog('SW registration failed: ' + err.message);
    });
    // F168: Trigger periodic SW update check when the tab becomes active
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update(); });
        }
    });
}
// F101: Tell the waiting SW to skip waiting, then page reloads via controllerchange
function swUpdateReload() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            else location.reload();
        });
    } else { location.reload(); }
}
// F165: PWA install prompt
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredInstall = e;
    if (el.btnInstall) el.btnInstall.style.display = '';
});
function triggerInstall() {
    if (!_deferredInstall) return;
    _deferredInstall.prompt();
    _deferredInstall.userChoice.then(() => {
        _deferredInstall = null;
        if (el.btnInstall) el.btnInstall.style.display = 'none';
    });
}
el.btnInstall?.addEventListener('click', triggerInstall);