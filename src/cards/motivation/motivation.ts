/**
 * FamilyDashBoard v6 — Motivation Card
 *
 * Static quotes, no network dependency. Rotates with fade animation.
 */

import { INTERVALS } from "../../core/constants";
import { scheduleCard } from "../base-card";
import { setSync } from "../../core/sync";
import { diagLog } from "../../core/diag";

// Hebrew motivational quotes
const MOTIVATIONS: ReadonlyArray<{ text: string; author: string }> = [
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

function renderMotivation(): void {
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

function setContent(m: { text: string; author: string }): void {
  if (elText) elText.textContent = m.text;
  if (elAuthor) elAuthor.textContent = m.author ? `— ${m.author}` : "";
}

async function loadMotivation(): Promise<void> {
  renderMotivation();
}

export function initMotivationCard(): void {
  elText = document.getElementById("moti-text");
  elAuthor = document.getElementById("moti-author");

  void loadMotivation();
  scheduleCard(loadMotivation, INTERVALS.MOTIVATION);
  diagLog("[motivation] Initialized");
}
