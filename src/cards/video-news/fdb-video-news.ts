/**
 * FamilyDashBoard — FdbVideoNewsCard Custom Element
 *
 * Wraps the video-news card logic inside a FdbCard Web Component shell.
 * Registered as <fdb-video-news> in the card registry.
 *
 * Features:
 *   - Standard .card__header via buildShell() (icon + title + sync-dot)
 *   - Collapse button + mini-info span appended to header
 *   - Click on header toggles maximize (full-viewport)
 *   - Collapsed state: body hidden, header shows active channel name
 *   - Maximized state: grid shows all channels simultaneously
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initVideoNews, destroyVideoNews, switchChannel } from "./video-news";
import { toggleCardMaximize } from "../../ui/maximize";
import { LS_COLLAPSED } from "../../core/constants";
import type { VideoChannelId } from "../../types/stream";

export class FdbVideoNewsCard extends FdbCard {
  override connect(): void {
    const { header, body } = this.buildShell("📺", "ערוץ חדשות", "Video News");

    // ── Add collapse button into the end slot (beside settings button) ───
    const endSlot = header.querySelector<HTMLElement>(".card__hd-end");
    if (endSlot && !endSlot.querySelector(".card-collapse-btn")) {
      const collapseBtn = document.createElement("button");
      collapseBtn.type = "button";
      collapseBtn.className = "card-collapse-btn";
      collapseBtn.setAttribute("aria-label", "מזער/הרחב כרטיסית");
      collapseBtn.setAttribute("aria-expanded", "true");
      collapseBtn.title = "מזער/הרחב — Collapse / Expand";
      collapseBtn.textContent = "▼";
      endSlot.prepend(collapseBtn);

      // Restore collapsed state from localStorage
      const cardId = this.dataset["cardId"] ?? "video-news";
      const stored = this._loadCollapsedIds();
      if (stored.has(cardId)) {
        this.classList.add("collapsed");
        collapseBtn.textContent = "▶";
        collapseBtn.setAttribute("aria-expanded", "false");
      }
      // Click is handled by initCardCollapse() in maximize.ts — no listener here.
    }

    // ── Add mini-info span into center slot (next to title) ───────────────
    const centerSlot = header.querySelector<HTMLElement>(".card__hd-center");
    if (centerSlot && !centerSlot.querySelector(".card-mini-info")) {
      const miniInfo = document.createElement("span");
      miniInfo.className = "card-mini-info";
      miniInfo.id = "mini-video-news";
      centerSlot.appendChild(miniInfo);
    }

    // ── Maximize on header click (ignoring collapse btn clicks) ──────────
    header.addEventListener("click", (e: Event) => {
      if ((e.target as HTMLElement).closest(".card-collapse-btn")) return;
      e.stopPropagation();
      toggleCardMaximize(this);
    });

    // ── Build card body content ───────────────────────────────────────────
    if (body.childElementCount === 0) {
      const initialChannel = (this.dataset["channel"] as VideoChannelId | undefined) ?? "c14";
      initVideoNews(body, initialChannel);
    }

    diagLog("[fdb-video-news] connected");
  }

  override disconnect(): void {
    destroyVideoNews();
    diagLog("[fdb-video-news] disconnected");
  }

  /** Switch channel programmatically (e.g. from config change). */
  setChannel(id: VideoChannelId): void {
    switchChannel(id);
  }

  // ── Collapse helpers ───────────────────────────────────────────────────

  private _loadCollapsedIds(): Set<string> {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_COLLAPSED) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  }
}

if (!customElements.get("fdb-video-news")) {
  customElements.define("fdb-video-news", FdbVideoNewsCard);
}
