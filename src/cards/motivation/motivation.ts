/**
 * FamilyDashBoard v7 — Motivation Card
 *
 * Static quotes, no network dependency. Rotates with fade animation.
 */

import { INTERVALS } from "../../core/constants";
import "./motivation.css";
import { scheduleCard } from "../base-card";
import { setSync } from "../../core/sync";
import { diagLog } from "../../core/diag";
import { showToast } from "../../ui/toast";
import { loadConfig } from "../../core/config";

/** Sprint 23: Category labels for motivation quotes. */
export type MotivationCategory = "general" | "morning" | "shabbat" | "family" | "success";

/** Sprint 23: Categorized quotes with `category` field. */
export interface MotivationQuote {
  text: string;
  author: string;
  category: MotivationCategory;
}

// Hebrew motivational quotes
export const MOTIVATIONS: ReadonlyArray<MotivationQuote> = [
  { text: "הכל מתחיל בצעד אחד קטן.", author: "", category: "general" },
  { text: "אל תשפטו את כל השנה על ידי יום אחד בלבד.", author: "", category: "general" },
  { text: "גם מסע של אלף מיל מתחיל בצעד אחד.", author: "לאו דזה", category: "general" },
  { text: "אין דבר יותר עוצמתי מרוח האדם.", author: "", category: "general" },
  { text: "הצלחה זה לעשות את מה שאתה אוהב.", author: "", category: "success" },
  { text: "כל יום הוא הזדמנות חדשה.", author: "", category: "morning" },
  {
    text: "הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו.",
    author: "אברהם לינקולן",
    category: "success",
  },
  { text: "מי שלא מנסה — לא מפסיד ולא מרוויח.", author: "", category: "general" },
  { text: "חיים זה מה שקורה כשאתה עסוק בתכניות אחרות.", author: "ג׳ון לנון", category: "general" },
  { text: "לא כל מי שמשוטט — אבוד.", author: "ג׳.ר.ר טולקין", category: "general" },
  { text: "בוקר טוב — כל בוקר חדש הוא ברכה.", author: "", category: "morning" },
  { text: "שבת שלום — הקדש זמן לאהובים.", author: "", category: "shabbat" },
  { text: "מה שמחזק משפחה הוא האהבה והשמחה.", author: "", category: "family" },
  { text: "ילדים הם הגן שבו נשמות פורחות.", author: "", category: "family" },
  { text: "ריחם של פרחים בבוקר — הכל אפשרי.", author: "", category: "morning" },
  { text: "שבת היא מתנה — היא מזכירה לנו מה חשוב.", author: "", category: "shabbat" },
  { text: "ההצלחה היא תוצאה של הרגלים יומיומיים.", author: "", category: "success" },
  { text: "כל מה שאנחנו מחפשים בחוץ — נמצא בפנים.", author: "", category: "general" },
  { text: "תנו לאהבה להיות המדריך שלכם.", author: "", category: "family" },
  { text: "אם לא עכשיו — אז מתי?", author: "הלל הזקן", category: "success" },
];

let motiIdx = 0;
let elText: HTMLElement | null = null;
let elAuthor: HTMLElement | null = null;

/** Sprint 23: Active category filter — null = show all categories. */
let _activeCategory: MotivationCategory | null = null;

/**
 * Sprint 23: Returns quotes filtered by category (or all when null).
 */
export function getQuotesByCategory(category: MotivationCategory | null): ReadonlyArray<MotivationQuote> {
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
    _motiAutoInterval = setInterval(renderMotivation, minutes * 60_000);
    diagLog(`FDB-039: [motivation] Auto-advance every ${minutes}min`);
  }
}

export function getCurrentQuote(): MotivationQuote | null {
  const pool = getQuotesByCategory(_activeCategory);
  const lastIdx = ((motiIdx - 1) + pool.length) % pool.length;
  return pool[lastIdx] ?? null;
}

export function renderMotivation(): void {
  const pool = getQuotesByCategory(_activeCategory);
  if (!pool.length) return;
  const m = pool[motiIdx++ % pool.length];
  if (!m) return;

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
  setSync("moti", "ok");
}

export function setContent(m: { text: string; author: string }): void {
  if (elText) elText.textContent = m.text;
  if (elAuthor) elAuthor.textContent = m.author ? `— ${m.author}` : "";
}

export function shareMotivation(): void {
  const q = getCurrentQuote();
  if (!q) return;
  const text = q.author ? `"${q.text}" — ${q.author}` : `"${q.text}"`;
  if (navigator.share) {
    void navigator.share({ text });
  } else {
    void navigator.clipboard.writeText(text).then(() => {
      showToast("📋 הציטוט הועתק ללוח");
    });
  }
  diagLog("FDB-040: [motivation] Quote shared");
}

async function loadMotivation(): Promise<void> {
  await Promise.resolve(renderMotivation());
}

export function initMotivationCard(): void {
  elText = document.getElementById("moti-text");
  elAuthor = document.getElementById("moti-author");

  document.getElementById("moti-next-btn")?.addEventListener("click", () => {
    renderMotivation();
  });
  document.getElementById("moti-share-btn")?.addEventListener("click", () => {
    shareMotivation();
  });

  void loadMotivation();
  scheduleCard(loadMotivation, INTERVALS.MOTIVATION);
  // F7 (v7.3): Start auto-advance timer if configured
  setMotivationInterval(loadConfig().motivationInterval ?? 0);
  diagLog("FDB-041: [motivation] Initialized");
}
