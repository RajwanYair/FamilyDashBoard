/**
 * FamilyDashBoard v6 — Status Bar
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

import { registerSyncDot } from "../core/sync";
import { diagLog } from "../core/diag";

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

const PAGE_START = Date.now();

function cacheDom(): void {
  elVersion = document.getElementById("version-badge");
  elRefreshStamp = document.getElementById("refresh-stamp");
  elUptime = document.getElementById("uptime-display");
  elConn = document.getElementById("conn-indicator");
  elFontScale = document.getElementById("font-scale-indicator");
}

// ── Version Badge ──
const APP_VERSION = "7.1.3";

function renderVersionBadge(): void {
  if (!elVersion) return;
  elVersion.textContent = `v${APP_VERSION}`;
}

// ── Refresh Timestamp ──
export function stampRefresh(): void {
  if (!elRefreshStamp) return;
  const now = new Date();
  elRefreshStamp.textContent =
    "רענון: " +
    now.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
}

// ── Uptime counter ──
function formatUptime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
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
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-scale")
    .trim();
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

  // Uptime ticks every 60 s
  setInterval(updateUptime, 60_000);

  // Listen for connectivity changes
  window.addEventListener("online", () => {
    updateConnIndicator();
    diagLog("[status-bar] Online");
  });
  window.addEventListener("offline", () => {
    updateConnIndicator();
    diagLog("[status-bar] Offline");
  });

  diagLog("[status-bar] Initialized");
}
