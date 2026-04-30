/**
 * FamilyDashBoard v13 — Status Bar
 *
 * Manages the bottom status bar:
 *   - Version badge
 *   - Sync dot registration + initialization
 *   - Last-refresh timestamp stamp
 *   - Day/year progress bars (delegated to header — shared updateProgress)
 *   - Uptime counter (time since page load, updated every minute)
 *   - Connectivity indicator (online / offline)
 *   - Font scale indicator (current --font-scale %)
 */

import "./status-bar.css";
import { registerSyncDot } from "../core/sync";
import { diagLog } from "../core/diag";
import { getOldestCacheAgeMinutes } from "../core/cache";
import { MS_PER_MIN } from "../core/constants";
import { decomposeDuration } from "../core/utils";

// ── Sync Pane Definitions ──
// Each pane name maps to an HTML element ID for its sync indicator.
const SYNC_PANES: Array<{ name: string; dotId: string }> = [
  { name: "weather", dotId: "sync-weather" },
  { name: "news", dotId: "sync-news" },
  { name: "stocks", dotId: "sync-stocks" },
  { name: "currency", dotId: "sync-currency" },
  { name: "alerts", dotId: "sync-alerts" },
  { name: "hebcal", dotId: "sync-hebcal" },
  { name: "cal", dotId: "sync-cal" },
  { name: "moti", dotId: "sync-moti" },
];

// ── DOM cache ──
let elVersion: HTMLElement | null = null;
let elRefreshStamp: HTMLElement | null = null;
let elUptime: HTMLElement | null = null;
let elConn: HTMLElement | null = null;
let elFontScale: HTMLElement | null = null;
let elCacheAge: HTMLElement | null = null;

const PAGE_START = Date.now();

function cacheDom(): void {
  elVersion = document.getElementById("version-badge");
  elRefreshStamp = document.getElementById("refresh-stamp");
  elUptime = document.getElementById("uptime-display");
  elConn = document.getElementById("conn-indicator");
  elFontScale = document.getElementById("font-scale-indicator");
  elCacheAge = document.getElementById("cache-age");
}

// ── Version Badge ──
declare const __APP_VERSION__: string;
const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

function renderVersionBadge(): void {
  if (!elVersion) return;
  elVersion.textContent = `v${APP_VERSION}`;
}

// ── Refresh Timestamp ──
let _lastRefreshMs = 0;

export function stampRefresh(): void {
  if (!elRefreshStamp) return;
  _lastRefreshMs = Date.now();
  const now = new Date(_lastRefreshMs);
  elRefreshStamp.textContent =
    "רענון: " +
    now.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
}

/** Update the refresh stamp to show relative age ("3m ago"). Called every minute. */
export function updateRefreshAge(): void {
  if (!elRefreshStamp || _lastRefreshMs === 0) return;
  const mins = Math.floor((Date.now() - _lastRefreshMs) / MS_PER_MIN);
  if (mins < 1) return; // still fresh — no age suffix needed
  const now = new Date(_lastRefreshMs);
  const timeStr = now.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
  elRefreshStamp.textContent = `רענון: ${timeStr} (${mins}m)`;
}

// ── Uptime counter ──
function formatUptime(ms: number): string {
  const { hours: h, minutes: m } = decomposeDuration(ms);
  if (h > 0) return `⏱ ${h}h ${m}m`;
  return `⏱ ${m}m`;
}

export function updateUptime(): void {
  if (!elUptime) return;
  elUptime.textContent = formatUptime(Date.now() - PAGE_START);
  elUptime.title = "זמן פעילות הלוח מאז טעינה";
}

// ── Connectivity indicator ──
export function updateConnIndicator(): void {
  if (!elConn) return;
  if (navigator.onLine) {
    elConn.textContent = "🟢";
    elConn.title = "מחובר לאינטרנט";
  } else {
    elConn.textContent = "🔴";
    elConn.title = "לא מחובר לאינטרנט";
  }
}

// ── Font scale indicator ──
export function updateFontScaleIndicator(): void {
  if (!elFontScale) return;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim();
  const pct = raw ? Math.round(parseFloat(raw) * 100) : 100;
  elFontScale.textContent = pct !== 100 ? `${pct}%` : "";
  elFontScale.title = `גודל גופן: ${pct}% — לחץ +/- לשינוי`;
}

// ── Sync Dot Registration ──
function registerSyncDots(): void {
  for (const { name, dotId } of SYNC_PANES) {
    const dot = document.getElementById(dotId);
    if (dot) {
      registerSyncDot(name, dot);
      diagLog(`[status-bar] Registered sync dot: ${name} (#${dotId})`);
    } else {
      diagLog(`[status-bar] Missing sync dot element: #${dotId}`);
    }
  }
}

// ── Init ──
export function initStatusBar(): void {
  cacheDom();
  renderVersionBadge();
  registerSyncDots();
  stampRefresh();
  updateUptime();
  updateConnIndicator();
  updateFontScaleIndicator();

  // Uptime ticks every 60 s; also refresh the "N min ago" stamp
  setInterval(() => {
    updateUptime();
    updateRefreshAge();
  }, MS_PER_MIN);

  // F6 (v7.2): Cache staleness chip — update every 60 s
  const updateCacheAge = (): void => {
    if (!elCacheAge) return;
    const mins = getOldestCacheAgeMinutes();
    elCacheAge.textContent = mins > 0 ? `⏱ ${mins}m` : "";
  };
  updateCacheAge();
  setInterval(updateCacheAge, MS_PER_MIN);

  // Listen for connectivity changes
  window.addEventListener("online", () => {
    updateConnIndicator();
    diagLog("[status-bar] Online");
  });
  window.addEventListener("offline", () => {
    updateConnIndicator();
    diagLog("[status-bar] Offline");
  });

  // F5 (v7.3): Listen for VERSION_ACTIVATED from Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as { type?: string; version?: string };
      if (data?.type === "VERSION_ACTIVATED" && data.version) {
        const swChip = document.getElementById("sw-version");
        if (swChip) {
          swChip.textContent = `SW ${data.version.replace("familydashboard-", "")}`;
          swChip.hidden = false;
          diagLog(`[status-bar] SW activated: ${data.version}`);
        }
      }
    });
  }

  diagLog("[status-bar] Initialized");
}
