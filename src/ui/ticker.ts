/**
 * FamilyDashBoard v6 — Halacha Ticker
 *
 * Fetches the daily Halakhah Yomit from Sefaria and renders
 * a seamlessly looped horizontal ticker strip.
 * Also renders a short excerpt in the Hebrew Calendar card row (#hc-halacha-row).
 * Refresh: 12 hours (changes once per day).
 */

import "./ticker.css";
import { cGet, cGetStale, cSet } from "../core/cache";
import { fetchWithTimeout } from "../core/fetch";
import { diagLog } from "../core/diag";
import { PROXIES, API } from "../core/constants";
import { scheduleCard } from "../cards/base-card";

// ── Types ──
interface HalachaData {
  ref: string;
  heRef: string;
  category: string;
  url: string;
  texts: string[];
}

interface SefariaCalItem {
  title: { en: string; he: string };
  url: string;
  displayValue?: { he: string; en: string };
  category?: string[];
}

interface SefariaCalResponse {
  calendar_items: SefariaCalItem[];
}

interface SefariaTextVersion {
  language: string;
  text: string | string[];
}

interface SefariaTextResponse {
  heRef?: string;
  versions?: SefariaTextVersion[];
}

// ── State ──
let _halachaData: HalachaData | null = null;
// Speed multiplier: tickerSpeed 1–5 maps to 0.5–2× reference speed (higher = faster)
let _speedMultiplier = 1;

const TICKER_SPEED_DURATIONS: Record<number, number> = { 1: 60, 2: 45, 3: 30, 4: 20, 5: 12 };

/**
 * Apply ticker scroll speed from config (1 = slowest, 5 = fastest).
 * Updates the CSS custom property and re-sets the current animation.
 */
export function applyTickerSpeed(speed: number): void {
  const clamped = Math.max(1, Math.min(5, Math.round(speed)));
  const baseSec = TICKER_SPEED_DURATIONS[clamped] ?? 30;
  // Compute a simple multiplier vs default 30s reference
  _speedMultiplier = 30 / baseSec;
  // Update CSS var for the initial load before ticker JS sets inline style
  document.documentElement.style.setProperty("--ticker-duration", `${baseSec}s`);
  // If ticker is already rendered, update inline duration
  if (elTicker) {
    const w = elTicker.scrollWidth / 2;
    if (w > 0) {
      const base = Math.max(30, w / 140);
      elTicker.style.animationDuration = `${Math.round(base / _speedMultiplier)}s`;
    }
  }
}

const TICKER_CACHE_KEY = "halacha";
const TICKER_TTL = 12 * 60 * 60_000; // 12h
const LS_TICKER_MSG = "dash_v2_ticker_msg";

// ── DOM cache ──
let elTicker: HTMLElement | null = null;
let elHcHalacha: HTMLElement | null = null;
let elHcHalachaRow: HTMLElement | null = null;

function cacheDom(): void {
  elTicker = document.getElementById("halacha-ticker");
  elHcHalacha = document.getElementById("hc-halacha");
  elHcHalachaRow = document.getElementById("hc-halacha-row");
}

// ── Category CSS class ──
function halachaCatClass(category: string): string {
  if (/שב[תו]/.test(category)) return "hc-tag-shabbat";
  if (/תפיל|תפלה|ברכ/.test(category)) return "hc-tag-tefila";
  if (/כשר|אכיל|מאכל/.test(category)) return "hc-tag-kashrut";
  if (/משפח|נדה|טהר|אישות/.test(category)) return "hc-tag-family";
  if (/חג|מועד|פסח|סוכ|ראש השנה|יו"ט/.test(category)) return "hc-tag-moadim";
  return "";
}

// ── Render ──
function makeTickerSet(data: HalachaData, isClone: boolean): DocumentFragment {
  const frag = document.createDocumentFragment();

  // Custom announcement message (from config panel)
  const customMsg = localStorage.getItem(LS_TICKER_MSG) ?? "";
  if (customMsg) {
    const announce = document.createElement("span");
    announce.className =
      "ticker-item ticker-custom-msg" + (isClone ? " clone" : "");
    announce.textContent = `📢 ${customMsg}`;
    frag.appendChild(announce);
  }

  // Reference header span
  const refSpan = document.createElement("span");
  refSpan.className = "ticker-item" + (isClone ? " clone" : "");

  if (data.category && !isClone) {
    const cat = document.createElement("span");
    cat.className = `ticker-halacha-cat ${halachaCatClass(data.category)}`;
    cat.textContent = data.category;
    refSpan.appendChild(cat);
  }

  const src = document.createElement("span");
  src.className = "ticker-src";
  src.textContent = "📜 " + data.ref;
  refSpan.appendChild(src);
  frag.appendChild(refSpan);

  // Text items
  data.texts.forEach((text, i) => {
    const span = document.createElement("span");
    span.className = "ticker-item" + (isClone ? " clone" : "");
    span.textContent = `(${i + 1}) ${text}`;
    frag.appendChild(span);
  });

  return frag;
}

function renderTicker(data: HalachaData): void {
  if (!elTicker || !data.texts?.length) return;
  _halachaData = data;

  const frag = document.createDocumentFragment();
  frag.appendChild(makeTickerSet(data, false));
  frag.appendChild(makeTickerSet(data, true)); // clone for seamless loop

  elTicker.textContent = "";
  elTicker.appendChild(frag);

  // Duration proportional to content width (140px/s reference), scaled by speed
  const w = elTicker.scrollWidth / 2;
  elTicker.style.animationDuration = `${Math.round(Math.max(12, w / 140) / _speedMultiplier)}s`;

  // Render excerpt in Hebrew-Cal card
  renderHalachaExcerpt(data);

  diagLog(`[ticker] Rendered: ${data.ref}`);
}

function renderHalachaExcerpt(data: HalachaData): void {
  if (!elHcHalacha || !elHcHalachaRow) return;
  const text = data.texts[0] ?? "";
  const excerpt = text.length > 90 ? text.substring(0, 90) + "..." : text;
  elHcHalacha.textContent = excerpt;
  elHcHalachaRow.style.display = excerpt ? "" : "none";

  if (data.url) {
    (elHcHalachaRow).onclick = (): void => {
      try {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch {
        // Ignore blocked popups
      }
    };
    elHcHalachaRow.title = "לחץ לקרוא ב-Sefaria";
  } else {
    (elHcHalachaRow).onclick = null;
  }
}

// ── Fetch from Sefaria ──
async function fetchFromSefaria(url: string): Promise<unknown | null> {
  // Direct fetch
  try {
    const r = await fetchWithTimeout(url, 8_000);
    if (r.ok) return (await r.json()) as unknown;
  } catch {
    // Fall through to proxy chain
  }

  // Proxy chain
  for (const proxy of PROXIES) {
    try {
      const r = await fetchWithTimeout(proxy + encodeURIComponent(url), 10_000);
      if (!r.ok) continue;
      if (proxy.includes("allorigins")) {
        const j = (await r.json()) as { contents?: string };
        return j.contents ? (JSON.parse(j.contents) as unknown) : null;
      }
      return (await r.json()) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}

// ── Main Loader ──
async function loadHalacha(): Promise<void> {
  if (document.hidden) return;

  const fresh = cGet<HalachaData>(TICKER_CACHE_KEY, TICKER_TTL);
  if (fresh) {
    renderTicker(fresh);
    return;
  }
  const stale = cGetStale<HalachaData>(TICKER_CACHE_KEY);
  if (stale) renderTicker(stale);

  try {
    const calData = (await fetchFromSefaria(
      API.SEFARIA_CALENDAR,
    )) as SefariaCalResponse | null;

    if (!calData?.calendar_items) {
      diagLog("[ticker] Sefaria calendar fetch failed");
      return;
    }

    const halachaItem = calData.calendar_items.find(
      (it) => it.title?.en === "Halakhah Yomit",
    );
    if (!halachaItem?.url) {
      diagLog("[ticker] Halakhah Yomit not found in calendar");
      return;
    }

    const textUrl = API.SEFARIA_TEXT + encodeURIComponent(halachaItem.url);
    const textData = (await fetchFromSefaria(
      textUrl,
    )) as SefariaTextResponse | null;

    if (!textData?.versions?.length) {
      diagLog("[ticker] Sefaria text fetch failed");
      return;
    }

    const heVer = textData.versions.find((v) => v.language === "he");
    if (!heVer?.text) {
      diagLog("[ticker] No Hebrew text version available");
      return;
    }

    const rawTexts = heVer.text;
    const texts = (Array.isArray(rawTexts) ? rawTexts : [String(rawTexts)])
      .map((t) => t.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);

    const halacha: HalachaData = {
      ref: halachaItem.displayValue?.he ?? halachaItem.title.he,
      heRef: textData.heRef ?? "",
      category: halachaItem.category?.[1] ?? halachaItem.category?.[0] ?? "",
      url: halachaItem.url ? `https://www.sefaria.org/${halachaItem.url}` : "",
      texts,
    };

    cSet(TICKER_CACHE_KEY, halacha);
    renderTicker(halacha);
    diagLog(`[ticker] Loaded: ${halacha.ref}`);
  } catch (err) {
    diagLog(`[ticker] Error: ${String(err)}`);
  }
}

// ── Expose halacha data for overlay ──
export function getHalachaData(): HalachaData | null {
  return _halachaData;
}

// ── Init ──
export function initTicker(): void {
  cacheDom();
  void loadHalacha();
  scheduleCard(loadHalacha, TICKER_TTL);
  diagLog("[ticker] Initialized");
}
