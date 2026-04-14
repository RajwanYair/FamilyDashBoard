/**
 * FamilyDashBoard v6 — Status Bar
 *
 * Manages the bottom status bar:
 *   - Version badge
 *   - Sync dot registration + initialization
 *   - Last-refresh timestamp stamp
 *   - Day/year progress bars (delegated to header — shared updateProgress)
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

function cacheDom(): void {
  elVersion = document.getElementById("version-badge");
  elRefreshStamp = document.getElementById("refresh-stamp");
}

// ── Version Badge ──
const APP_VERSION = "6.5.0";

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
  diagLog("[status-bar] Initialized");
}
