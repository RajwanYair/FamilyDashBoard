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
  private _collapseBtn: HTMLButtonElement | null = null;

  override connect(): void {
    const { header, body } = this.buildShell("📺", "ערוץ חדשות", "Video News");

    // ── Add collapse button (before title span) ───────────────────────────
    if (!header.querySelector(".card-collapse-btn")) {
      const collapseBtn = document.createElement("button");
      collapseBtn.type = "button";
      collapseBtn.className = "card-collapse-btn";
      collapseBtn.setAttribute("aria-label", "מזער/הרחב כרטיסית");
      collapseBtn.setAttribute("aria-expanded", "true");
      collapseBtn.title = "מזער/הרחב — Collapse / Expand";
      collapseBtn.textContent = "▼";
      header.prepend(collapseBtn);
      this._collapseBtn = collapseBtn;

      // Restore collapsed state from localStorage
      const cardId = this.dataset["cardId"] ?? "video-news";
      const stored = this._loadCollapsedIds();
      if (stored.has(cardId)) {
        this.classList.add("collapsed");
        collapseBtn.textContent = "▶";
        collapseBtn.setAttribute("aria-expanded", "false");
      }

      collapseBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleCollapse();
      });
    }

    // ── Add mini-info span (after sync-dot) ───────────────────────────────
    if (!header.querySelector(".card-mini-info")) {
      const miniInfo = document.createElement("span");
      miniInfo.className = "card-mini-info";
      miniInfo.id = "mini-video-news";
      header.appendChild(miniInfo);
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
    this._collapseBtn = null;
    diagLog("[fdb-video-news] disconnected");
  }

  /** Switch channel programmatically (e.g. from config change). */
  setChannel(id: VideoChannelId): void {
    switchChannel(id);
  }

  // ── Collapse helpers ───────────────────────────────────────────────────

  private _toggleCollapse(): void {
    const doToggle = (): void => {
      this.classList.toggle("collapsed");
      const isCollapsed = this.classList.contains("collapsed");
      if (this._collapseBtn) {
        this._collapseBtn.textContent = isCollapsed ? "▶" : "▼";
        this._collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
      }
      // Persist state
      const cardId = this.dataset["cardId"] ?? "video-news";
      const set = this._loadCollapsedIds();
      if (isCollapsed) set.add(cardId); else set.delete(cardId);
      this._saveCollapsedIds(set);
      diagLog(`[fdb-video-news] ${isCollapsed ? "collapsed" : "expanded"}`);
    };

    if ("startViewTransition" in document) {
      void (document as { startViewTransition: (fn: () => void) => unknown }).startViewTransition(doToggle);
    } else {
      doToggle();
    }
  }

  private _loadCollapsedIds(): Set<string> {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_COLLAPSED) ?? "[]") as string[]);
    } catch { return new Set(); }
  }

  private _saveCollapsedIds(set: Set<string>): void {
    try { localStorage.setItem(LS_COLLAPSED, JSON.stringify([...set])); } catch { /* quota */ }
  }
}

if (!customElements.get("fdb-video-news")) {
  customElements.define("fdb-video-news", FdbVideoNewsCard);
}
