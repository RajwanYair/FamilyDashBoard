/**
 * FamilyDashBoard v7 — Motivation Card
 *
 * Static quotes, no network dependency. Rotates with fade animation.
 */

import { INTERVALS, MS_PER_MIN, WORKER_BASE_URL } from "../../core/constants";
import "./motivation.css";
import { createAsyncCardLoader, scheduleCard } from "../base-card";
import { setSync } from "../../core/sync";
import { diagLog } from "../../core/diag";
import { t } from "../../core/i18n";
import { showToast } from "../../ui/toast";
import { loadConfig } from "../../core/config";
import type { CardConfigField } from "../../types/card";

/** Sprint 23: Category labels for motivation quotes. */
export type MotivationCategory =
  | "general"
  | "morning"
  | "shabbat"
  | "family"
  | "success"
  | "gratitude"
  | "courage"
  | "calm";

/**
 * M1 (Sprint 176): Source attribution for displayed quote.
 * Rendered as a colored badge below the author line.
 */
export type MotivationSource = "tanakh" | "hazal" | "modern" | "ai";

/** Sprint 23: Categorized quotes with `category` field. */
export interface MotivationQuote {
  text: string;
  author: string;
  category: MotivationCategory;
  /** M1 (Sprint 176): Optional source attribution badge. */
  source?: MotivationSource;
}

// Hebrew motivational quotes
export const MOTIVATIONS: ReadonlyArray<MotivationQuote> = [
  { text: "הכל מתחיל בצעד אחד קטן.", author: "", category: "general" },
  { text: "אל תשפטו את כל השנה על ידי יום אחד בלבד.", author: "", category: "general" },
  { text: "גם מסע של אלף מיל מתחיל בצעד אחד.", author: "לאו דזה", category: "general", source: "modern" },
  { text: "אין דבר יותר עוצמתי מרוח האדם.", author: "", category: "general" },
  { text: "הצלחה זה לעשות את מה שאתה אוהב.", author: "", category: "success" },
  { text: "כל יום הוא הזדמנות חדשה.", author: "", category: "morning" },
  {
    text: "הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו.",
    author: "אברהם לינקולן",
    category: "success",
    source: "modern",
  },
  { text: "מי שלא מנסה — לא מפסיד ולא מרוויח.", author: "", category: "general" },
  { text: "חיים זה מה שקורה כשאתה עסוק בתכניות אחרות.", author: "ג׳ון לנון", category: "general", source: "modern" },
  { text: "לא כל מי שמשוטט — אבוד.", author: "ג׳.ר.ר טולקין", category: "general", source: "modern" },
  { text: "בוקר טוב — כל בוקר חדש הוא ברכה.", author: "", category: "morning" },
  { text: "שבת שלום — הקדש זמן לאהובים.", author: "", category: "shabbat" },
  { text: "מה שמחזק משפחה הוא האהבה והשמחה.", author: "", category: "family" },
  { text: "ילדים הם הגן שבו נשמות פורחות.", author: "", category: "family" },
  { text: "ריחם של פרחים בבוקר — הכל אפשרי.", author: "", category: "morning" },
  { text: "שבת היא מתנה — היא מזכירה לנו מה חשוב.", author: "", category: "shabbat" },
  { text: "ההצלחה היא תוצאה של הרגלים יומיומיים.", author: "", category: "success" },
  { text: "כל מה שאנחנו מחפשים בחוץ — נמצא בפנים.", author: "", category: "general" },
  { text: "תנו לאהבה להיות המדריך שלכם.", author: "", category: "family" },
  { text: "אם לא עכשיו — אז מתי?", author: "הלל הזקן", category: "success", source: "hazal" },
  // M2 / gratitude
  { text: "הודו לה׳ כי טוב כי לעולם חסדו.", author: "תהילים קו:א", category: "gratitude", source: "tanakh" },
  { text: "כל הנשמה תהלל יה.", author: "תהילים קנ:ו", category: "gratitude", source: "tanakh" },
  { text: "שמח בחלקך — זוהי העושר האמיתי.", author: "פרקי אבות ד:א", category: "gratitude", source: "hazal" },
  { text: "הכרת הטוב היא מידה מהמידות הנעלות ביותר.", author: "", category: "gratitude" },
  // M2 / courage
  { text: "חזקו ואמצו אל תיראו ואל תערצו.", author: "דברים לא:ו", category: "courage", source: "tanakh" },
  { text: "אמץ ואל תירא, כי ה׳ אלוהיך עמך.", author: "יהושע א:ט", category: "courage", source: "tanakh" },
  { text: "הגיבורים לא נולדים — הם נעשים.", author: "", category: "courage", source: "modern" },
  { text: "הפחד הוא שקר; הגבורה היא שתלך קדימה בכל זאת.", author: "", category: "courage" },
  // M2 / calm
  { text: "שלום שלום לרחוק ולקרוב.", author: "ישעיהו נז:יט", category: "calm", source: "tanakh" },
  { text: "נפשי בידיו אפקיד — ישנה ולא אפחד.", author: "פיוט 'אדון עולם'", category: "calm", source: "hazal" },
  { text: "מי שיש לו שלווה פנימית — לא יבנה חומות.", author: "", category: "calm" },
  { text: "הכל לטובה.", author: "נחום איש גמזו", category: "calm", source: "hazal" },
];

let motiIdx = 0;
let elText: HTMLElement | null = null;
let elAuthor: HTMLElement | null = null;
/** M1 (Sprint 176): Source attribution badge element. */
let elSrc: HTMLElement | null = null;

// ── Sprint 70: Non-repeat window ──────────────────────────────────────────────

/** localStorage key for the rolling used-index list. */
const LS_MOTI_USED = "moti-used-indices";

/**
 * Max number of recently shown quote indices to remember.
 * For pools smaller than this, the effective window is pool.length - 1.
 */
export const MOTIVATION_NO_REPEAT_WINDOW = 8;

/** Read the rolling used-indices list from localStorage. */
export function getUsedIndices(): number[] {
  try {
    const raw = localStorage.getItem(LS_MOTI_USED);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as unknown[]).filter((x): x is number => typeof x === "number");
  } catch {
    return [];
  }
}

/** Append `idx` to the rolling used list, trimming to the window size. */
export function markIndexUsed(idx: number, poolSize: number): void {
  const used = getUsedIndices();
  used.push(idx);
  const maxWindow = Math.min(MOTIVATION_NO_REPEAT_WINDOW, Math.max(poolSize - 1, 1));
  while (used.length > maxWindow) used.shift();
  try {
    localStorage.setItem(LS_MOTI_USED, JSON.stringify(used));
  } catch {
    // ignore localStorage quota errors
  }
}

/**
 * Pick the next quote index, skipping recently used ones.
 * Exported for unit testing.
 */
export function pickNextQuoteIndex(poolSize: number, usedIndices: number[]): number {
  if (poolSize <= 1) return 0;
  const windowSize = Math.min(MOTIVATION_NO_REPEAT_WINDOW, poolSize - 1);
  const recentUsed = usedIndices.slice(-windowSize);
  const available: number[] = [];
  for (let i = 0; i < poolSize; i++) {
    if (!recentUsed.includes(i)) available.push(i);
  }
  if (available.length === 0) {
    // All in window (tiny pool) — pick any index uniformly
    return Math.floor(Math.random() * poolSize);
  }
  return available[Math.floor(Math.random() * available.length)]!;
}

// ── end Sprint 70 ────────────────────────────────────────────────────────────

/** Sprint 23: Active category filter — null = show all categories. */
let _activeCategory: MotivationCategory | null = null;

// ── M1: Source attribution labels ─────────────────────────────────────────────

/** Human-readable label and CSS class for each source. */
export const SOURCE_META: Readonly<Record<MotivationSource, { label: string; cls: string }>> = {
  tanakh: { label: "תנ״ך", cls: "src-tanakh" },
  hazal: { label: "חז״ל", cls: "src-hazal" },
  modern: { label: "מודרני", cls: "src-modern" },
  ai: { label: "AI", cls: "src-ai" },
};

// ── M2: Theme-by-day rotation ─────────────────────────────────────────────────

/**
 * Day-of-week → quote category mapping.
 * Index 0 = Sunday, 6 = Saturday.
 * Used for automatic theme rotation when no manual category is selected.
 */
export const DAY_THEME_MAP: ReadonlyArray<MotivationCategory> = [
  "gratitude", // 0 Sun
  "courage",   // 1 Mon
  "calm",      // 2 Tue
  "general",   // 3 Wed
  "success",   // 4 Thu
  "morning",   // 5 Fri
  "shabbat",   // 6 Sat
];

/**
 * M2 (Sprint 176): Returns the recommended quote category for a given date.
 * @param date  Date to evaluate (defaults to today).
 */
export function getThemeForDay(date: Date = new Date()): MotivationCategory {
  const dow = date.getDay(); // 0 = Sunday … 6 = Saturday
  return DAY_THEME_MAP[dow] ?? "general";
}

/**
 * Sprint 23: Returns quotes filtered by category (or all when null).
 */
export function getQuotesByCategory(
  category: MotivationCategory | null,
): ReadonlyArray<MotivationQuote> {
  if (category === null) return MOTIVATIONS;
  return MOTIVATIONS.filter((q) => q.category === category);
}

/**
 * Sprint 23: Set the active category filter and restart the index counter.
 * Pass null to show all categories.
 */
export function setMotivationCategory(category: MotivationCategory | null): void {
  _activeCategory = category;
  motiIdx = 0;
  // Sprint 70: clear used-index window when category changes (new pool = fresh start)
  try {
    localStorage.removeItem(LS_MOTI_USED);
  } catch {
    /* ignore */
  }
  diagLog(`FDB-039b: [motivation] Category set to ${category ?? "all"}`);
  renderMotivation();
}

/** Sprint 23: Returns the currently active category filter. */
export function getMotivationCategory(): MotivationCategory | null {
  return _activeCategory;
}

// F7 (v7.3): Auto-advance timer
let _motiAutoInterval: ReturnType<typeof setInterval> | null = null;

/**
 * F7 (v7.3): Start or stop motivation auto-advance.
 * @param minutes 0 = disabled; 1–60 = rotate every N minutes
 */
export function setMotivationInterval(minutes: number): void {
  if (_motiAutoInterval !== null) {
    clearInterval(_motiAutoInterval);
    _motiAutoInterval = null;
  }
  if (minutes > 0) {
    _motiAutoInterval = setInterval(renderMotivation, minutes * MS_PER_MIN);
    diagLog(`FDB-039: [motivation] Auto-advance every ${minutes}min`);
  }
}

export function getCurrentQuote(): MotivationQuote | null {
  const pool = getQuotesByCategory(_activeCategory);
  return pool[motiIdx] ?? null;
}

/**
 * Render a specific quote with fade animation.
 * Used by both renderMotivation (user-triggered) and the async loader.
 */
function renderMotivationQuote(m: MotivationQuote): void {
  const card = elText?.closest(".moti-card") as HTMLElement | null;
  if (card) {
    card.style.transition = "opacity 0.5s ease";
    card.style.opacity = "0";
    setTimeout(() => {
      setContent(m);
      card.style.opacity = "1";
    }, 500);
  } else {
    setContent(m);
  }
}

export function renderMotivation(): void {
  const pool = getQuotesByCategory(_activeCategory);
  if (!pool.length) return;
  // Sprint 70: pick via non-repeat window instead of simple sequential index
  const usedIndices = getUsedIndices();
  motiIdx = pickNextQuoteIndex(pool.length, usedIndices);
  markIndexUsed(motiIdx, pool.length);
  const m = pool[motiIdx];
  if (!m) return;
  renderMotivationQuote(m);
  setSync("moti", "ok");
}

/**
 * V13-DATA: Fetch an AI-generated Hebrew motivational quote from the worker.
 * Falls back to static quotes on any error.
 */
export async function fetchAiMotivationQuote(): Promise<MotivationQuote | null> {
  try {
    const resp = await fetch(`${WORKER_BASE_URL}/api/motivation/hebrew`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { text?: string; author?: string };
    if (typeof data.text !== "string" || !data.text) return null;
    return { text: data.text, author: data.author ?? "", category: "general" };
  } catch {
    diagLog("FDB-042: [motivation] AI Hebrew fetch failed — falling back to static");
    return null;
  }
}

/**
 * Stream D2.4: Async fetch for the createAsyncCardLoader lifecycle.
 * Picks the next quote from the active category pool.
 */
async function fetchMotivation(): Promise<MotivationQuote> {
  if (loadConfig().motivationAiHebrew) {
    const ai = await fetchAiMotivationQuote();
    if (ai) return ai;
  }
  const pool = getQuotesByCategory(_activeCategory);
  const usedIndices = getUsedIndices();
  const idx = pickNextQuoteIndex(pool.length, usedIndices);
  markIndexUsed(idx, pool.length);
  motiIdx = idx;
  return Promise.resolve(pool[idx] ?? MOTIVATIONS[0]!);
}

/** Stream D2.4: Standard async card loader with visibility + lock lifecycle. */
export const loadMotivation = createAsyncCardLoader<MotivationQuote>(
  { id: "moti", ttl: INTERVALS.MOTIVATION, interval: INTERVALS.MOTIVATION },
  fetchMotivation,
  renderMotivationQuote,
);

export function setContent(m: { text: string; author: string; source?: MotivationSource }): void {
  if (elText) elText.textContent = m.text;
  if (elAuthor) elAuthor.textContent = m.author ? `— ${m.author}` : "";
  // M1 (Sprint 176): source attribution badge
  if (elSrc) {
    if (m.source) {
      const meta = SOURCE_META[m.source];
      elSrc.textContent = meta.label;
      elSrc.className = `moti-src ${meta.cls}`;
    } else {
      elSrc.textContent = "";
      elSrc.className = "moti-src";
    }
  }
}

export function shareMotivation(): void {
  const q = getCurrentQuote();
  if (!q) return;
  const text = q.author ? `"${q.text}" — ${q.author}` : `"${q.text}"`;
  if (navigator.share) {
    void navigator.share({ text });
  } else {
    void navigator.clipboard.writeText(text).then(() => {
      showToast(t("quoteCopied"));
    });
  }
  diagLog("FDB-040: [motivation] Quote shared");
}

export function initMotivationCard(): void {
  elText = document.getElementById("moti-text");
  elAuthor = document.getElementById("moti-author");
  elSrc = document.getElementById("moti-src");

  document.getElementById("moti-next-btn")?.addEventListener("click", () => {
    renderMotivation();
  });
  document.getElementById("moti-share-btn")?.addEventListener("click", () => {
    shareMotivation();
  });

  // M2 (Sprint 176): Apply theme-by-day when no manual category is set
  if (_activeCategory === null) {
    _activeCategory = getThemeForDay();
  }

  // Synchronous initial render — no async overhead for first display
  renderMotivation();
  // Stream D2.4: use createAsyncCardLoader for all scheduled refreshes
  // (adds visibility + lock checks, consistent with other cards)
  scheduleCard(loadMotivation, INTERVALS.MOTIVATION);
  // F7 (v7.3): Start auto-advance timer if configured
  setMotivationInterval(loadConfig().motivationInterval ?? 0);
  diagLog("FDB-041: [motivation] Initialized");
}

// ── Sprint 83: configSchema ────────────────────────────────────────────────

export const motivationConfigSchema: CardConfigField[] = [
  {
    key: "motivationInterval",
    labelHe: "החלפה אוטומטית (דקות, 0=כבוי)",
    labelEn: "Auto-advance interval (min, 0=off)",
    type: "range",
    defaultValue: 0,
    min: 0,
    max: 60,
    step: 5,
    tab: "display",
    group: "motivation",
  },
  {
    key: "motivationAiHebrew",
    labelHe: "ציטוטים AI בעברית (דריש רשת)",
    labelEn: "AI-generated Hebrew quotes (requires network)",
    type: "boolean",
    defaultValue: false,
    tab: "display",
    group: "motivation",
  },
];

// ── Test isolation (Stream G.1) ───────────────────────────────────────────────

/**
 * Reset all module-level mutable state to defaults.
 * Use in `beforeEach` instead of `vi.resetModules()` to avoid costly
 * module re-evaluation.
 *
 * @internal — test use only
 */
export function _resetMotivationForTest(): void {
  motiIdx = 0;
  elText = null;
  elAuthor = null;
  elSrc = null;
  _activeCategory = null;
  if (_motiAutoInterval !== null) {
    clearInterval(_motiAutoInterval);
    _motiAutoInterval = null;
  }
}
