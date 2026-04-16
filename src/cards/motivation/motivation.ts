/**
 * FamilyDashBoard v6 — Motivation Card
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

// Hebrew motivational quotes
export const MOTIVATIONS: ReadonlyArray<{ text: string; author: string }> = [
  { text: "הכל מתחיל בצעד אחד קטן.", author: "" },
  { text: "אל תשפטו את כל השנה על ידי יום אחד בלבד.", author: "" },
  { text: "גם מסע של אלף מיל מתחיל בצעד אחד.", author: "לאו דזה" },
  { text: "אין דבר יותר עוצמתי מרוח האדם.", author: "" },
  { text: "הצלחה זה לעשות את מה שאתה אוהב.", author: "" },
  { text: "כל יום הוא הזדמנות חדשה.", author: "" },
  {
    text: "הדרך הטובה ביותר לחזות את העתיד היא ליצור אותו.",
    author: "אברהם לינקולן",
  },
  { text: "מי שלא מנסה — לא מפסיד ולא מרוויח.", author: "" },
  { text: "חיים זה מה שקורה כשאתה עסוק בתכניות אחרות.", author: "ג׳ון לנון" },
  { text: "לא כל מי שמשוטט — אבוד.", author: "ג׳.ר.ר טולקין" },
];

let motiIdx = 0;
let elText: HTMLElement | null = null;
let elAuthor: HTMLElement | null = null;

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
    diagLog(`[motivation] Auto-advance every ${minutes}min`);
  }
}

export function getCurrentQuote(): { text: string; author: string } | null {
  const lastIdx = ((motiIdx - 1) + MOTIVATIONS.length) % MOTIVATIONS.length;
  return MOTIVATIONS[lastIdx] ?? null;
}

export function renderMotivation(): void {
  const m = MOTIVATIONS[motiIdx++ % MOTIVATIONS.length];
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
  diagLog("[motivation] Quote shared");
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
  diagLog("[motivation] Initialized");
}
