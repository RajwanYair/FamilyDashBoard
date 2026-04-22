/**
 * FamilyDashBoard v8 — Motivation Card (FdbCard subclass)
 *
 * Sprint 187: First FdbCard-migrated card. Static quotes with fade animation.
 * No network dependency. Uses scheduleRefresh for auto-advance.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { t } from "../../core/i18n";
import { showToast } from "../../ui/toast";
import { INTERVALS, MS_PER_MIN } from "../../core/constants";
import { getQuotesByCategory, type MotivationCategory, type MotivationQuote } from "./motivation";

export class FdbMotivationCard extends FdbCard {
  private _idx = 0;
  private _category: MotivationCategory | null = null;
  private _autoTimer: ReturnType<typeof setInterval> | null = null;
  private _elText: HTMLElement | null = null;
  private _elAuthor: HTMLElement | null = null;

  override connect(): void {
    const { body } = this.buildShell("✨", "מוטיבציה", "Motivation");

    if (body.childElementCount > 0) {
      return;
    }

    // Build inner DOM
    const motiCard = document.createElement("div");
    motiCard.className = "moti-card";

    this._elText = document.createElement("div");
    this._elText.className = "moti-text";
    this._elText.setAttribute("aria-live", "polite");
    this._elText.textContent = t("refreshing");
    motiCard.appendChild(this._elText);

    this._elAuthor = document.createElement("div");
    this._elAuthor.className = "moti-author";
    motiCard.appendChild(this._elAuthor);

    const nextBtn = FdbCard.createEl(
      "button",
      "moti-btn",
      document.documentElement.lang === "en" ? "⏭ Next" : "⏭ הבא",
    );
    nextBtn.type = "button";
    nextBtn.addEventListener("click", () => this.nextQuote());

    const shareBtn = FdbCard.createEl(
      "button",
      "moti-btn",
      document.documentElement.lang === "en" ? "📤 Share" : "📤 שתף",
    );
    shareBtn.type = "button";
    shareBtn.addEventListener("click", () => this.shareQuote());

    const actions = document.createElement("div");
    actions.className = "moti-actions";
    actions.appendChild(nextBtn);
    actions.appendChild(shareBtn);
    motiCard.appendChild(actions);

    body.appendChild(motiCard);

    // Initial render + schedule
    this.nextQuote();
    this.scheduleRefresh(() => {
      this.nextQuote();
    }, INTERVALS.MOTIVATION);
    this.watchConfig("motivationInterval", true);

    this.setSyncState("ok");
    diagLog("FDB-063: [fdb-motivation] connected");
  }

  override disconnect(): void {
    if (this._autoTimer !== null) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
  }

  override refresh(): Promise<void> {
    this.nextQuote();
    return Promise.resolve();
  }

  override onConfigChange(key: string, value: unknown): void {
    if (key === "motivationInterval") {
      this._setAutoInterval(typeof value === "number" ? value : 0);
    }
  }

  nextQuote(): void {
    const pool = getQuotesByCategory(this._category);
    if (!pool.length) return;
    const q = pool[this._idx++ % pool.length];
    if (!q) return;
    this._renderQuote(q);
  }

  private _renderQuote(q: MotivationQuote): void {
    if (this._elText) this._elText.textContent = q.text;
    if (this._elAuthor) this._elAuthor.textContent = q.author ? `— ${q.author}` : "";
  }

  shareQuote(): void {
    const pool = getQuotesByCategory(this._category);
    const lastIdx = (this._idx - 1 + pool.length) % pool.length;
    const q = pool[lastIdx];
    if (!q) return;
    const text = q.author ? `"${q.text}" — ${q.author}` : `"${q.text}"`;
    if (navigator.share) {
      void navigator.share({ text });
    } else {
      void navigator.clipboard.writeText(text).then(() => {
        showToast(t("quoteCopied"));
      });
    }
    diagLog("FDB-064: [fdb-motivation] Quote shared");
  }

  setCategory(category: MotivationCategory | null): void {
    this._category = category;
    this._idx = 0;
    this.nextQuote();
  }

  getCategory(): MotivationCategory | null {
    return this._category;
  }

  private _setAutoInterval(minutes: number): void {
    if (this._autoTimer !== null) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
    if (minutes > 0) {
      this._autoTimer = setInterval(() => this.nextQuote(), minutes * MS_PER_MIN);
    }
  }
}

// Register custom element
if (!customElements.get("fdb-motivation")) {
  customElements.define("fdb-motivation", FdbMotivationCard);
}
