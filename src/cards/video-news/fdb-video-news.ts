/**
 * FamilyDashBoard — FdbVideoNewsCard Custom Element
 *
 * Wraps the video-news card logic inside a FdbCard Web Component shell.
 * Registered as <fdb-video-news> in the card registry.
 */

import { FdbCard } from "../../core/fdb-card";
import { diagLog } from "../../core/diag";
import { initVideoNews, destroyVideoNews } from "./video-news";
import type { VideoChannelId } from "../../types/stream";

export class FdbVideoNewsCard extends FdbCard {
  override connect(): void {
    const { body } = this.buildShell("📺", "ערוץ חדשות", "Video News");

    if (body.childElementCount === 0) {
      body.classList.add("video-news");
      body.setAttribute("data-card-id", "video-news");

      // ── 16:9 wrapper ──
      const aspect = document.createElement("div");
      aspect.className = "video-news__aspect";

      const video = document.createElement("video");
      video.className = "video-news__video";
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("aria-label", "שידור חדשות חי — מושתק");
      aspect.appendChild(video);

      const errorEl = document.createElement("div");
      errorEl.className = "video-news__error";
      errorEl.hidden = true;
      errorEl.setAttribute("role", "status");
      errorEl.setAttribute("aria-live", "polite");
      aspect.appendChild(errorEl);

      body.appendChild(aspect);

      // ── Overlay strip (RTL) ──
      const overlay = document.createElement("div");
      overlay.className = "video-news__overlay";

      const label = document.createElement("span");
      label.className = "video-news__channel-label";
      overlay.appendChild(label);

      const controls = document.createElement("div");
      controls.className = "video-news__controls";

      const muteBtn = document.createElement("button");
      muteBtn.type = "button";
      muteBtn.className = "video-news__mute-btn";
      muteBtn.setAttribute("aria-pressed", "true");
      muteBtn.title = "הפעל שמע (M)";
      muteBtn.textContent = "🔇";
      controls.appendChild(muteBtn);

      const channelBtn = document.createElement("button");
      channelBtn.type = "button";
      channelBtn.className = "video-news__channel-btn";
      channelBtn.title = "החלף ערוץ (V)";
      channelBtn.textContent = "📡";
      controls.appendChild(channelBtn);

      overlay.appendChild(controls);
      aspect.appendChild(overlay);

      const initialChannel = (this.dataset["channel"] as VideoChannelId | undefined) ?? "c14";
      initVideoNews(body, initialChannel);
      diagLog("[fdb-video-news] connected");
    }
  }

  override disconnect(): void {
    destroyVideoNews();
    diagLog("[fdb-video-news] disconnected");
  }
}

if (!customElements.get("fdb-video-news")) {
  customElements.define("fdb-video-news", FdbVideoNewsCard);
}
