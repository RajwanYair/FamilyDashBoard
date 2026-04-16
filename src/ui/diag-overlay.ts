/**
 * FamilyDashBoard v6 — Diagnostics Overlay
 *
 * Renders getDiagEntries() into #diag-log when the overlay is opened.
 * Wires the copy-to-clipboard button (#diag-copy-btn).
 * Exposes openDiagOverlay / closeDiagOverlay / toggleDiagOverlay.
 */

import "./diag-overlay.css";
import { getDiagEntries, formatDiagEntry, clearDiag } from "../core/diag";
import { diagLog } from "../core/diag";
import { getFailedPanes } from "../core/sync";
import { isWorkerEnabled } from "../core/constants";

let overlayEl: HTMLDialogElement | null = null;
let logEl: HTMLElement | null = null;

function overlay(): HTMLDialogElement | null {
  if (!overlayEl?.isConnected)
    overlayEl = document.getElementById(
      "diag-overlay",
    ) as HTMLDialogElement | null;
  return overlayEl;
}

function logContainer(): HTMLElement | null {
  if (!logEl?.isConnected) logEl = document.getElementById("diag-log");
  return logEl;
}

// ── Render log entries ──
function renderLog(): void {
  const el = logContainer();
  if (!el) return;

  const entries = getDiagEntries();
  if (entries.length === 0) {
    el.textContent = "אין רשומות אבחון";
    return;
  }

  const frag = document.createDocumentFragment();
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "diag-entry";
    row.textContent = formatDiagEntry(entry);
    frag.appendChild(row);
  }

  el.textContent = "";
  el.appendChild(frag);
}

// ── Render diag stats panel ──
function renderStats(): void {
  const panes = document.getElementById("diag-panes");
  if (!panes) return;

  // localStorage usage
  let lsBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      lsBytes += k.length + (localStorage.getItem(k)?.length ?? 0);
    }
  } catch { /* quota error */ }
  const lsKB = (lsBytes / 1024).toFixed(1);

  // Failed panes backoff
  const failed = getFailedPanes();
  const failedText =
    failed.length === 0
      ? "אין כשלים"
      : failed.map((f) => `${f.key}(×${f.delay})`).join(", ");

  // Worker status
  const workerStatus = isWorkerEnabled() ? "✅ פעיל" : "❌ כבוי";

  // Build info
  const version =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "?";
  const buildTime =
    typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "?";

  panes.innerHTML = "";
  const html = `
    <div class="diag-stats">
      <span>🗄️ LocalStorage: <b>${lsKB} KB</b></span>
      <span>🌐 Worker: <b>${workerStatus}</b></span>
      <span>⚠️ כשלים: <b>${failedText}</b></span>
      <span>🏷️ v${version}</span>
      <span>🕒 Build: ${buildTime.slice(0, 10)}</span>
    </div>`;
  panes.innerHTML = html;
}

// ── Copy log to clipboard ──
export function copyDiagLog(): void {
  const entries = getDiagEntries();
  const text = entries.map(formatDiagEntry).join("\n");
  void navigator.clipboard.writeText(text).then(() => {
    diagLog("[diag] Log copied to clipboard");
    // Flash the button text briefly
    const btn = document.getElementById("diag-copy-btn");
    if (btn) {
      const original = btn.textContent ?? "📋 העתק לוג";
      btn.textContent = "✅ הועתק!";
      setTimeout(() => {
        btn.textContent = original;
      }, 1500);
    }
  });
}

// ── Public API ──

let _refreshTimer: ReturnType<typeof setInterval> | null = null;

export function openDiagOverlay(): void {
  const ov = overlay();
  if (!ov) return;
  renderLog();
  renderStats();
  ov.show(); // non-modal: positioned in corner
  // Auto-refresh log + stats every 5 seconds while open
  _refreshTimer = setInterval(() => {
    renderLog();
    renderStats();
  }, 5000);
  diagLog("[diag] Overlay opened");
}

export function closeDiagOverlay(): void {
  const ov = overlay();
  if (ov?.open) ov.close();
  if (_refreshTimer !== null) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
}

export function toggleDiagOverlay(): void {
  const ov = overlay();
  if (!ov) return;
  if (ov.open) closeDiagOverlay();
  else openDiagOverlay();
}

export function isDiagOverlayOpen(): boolean {
  return overlay()?.open ?? false;
}

// ── Init ──
export function initDiagOverlay(): void {
  // Wire copy button (replaces inline onclick="copyDiagLog()")
  const copyBtn = document.getElementById("diag-copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", copyDiagLog);
  }

  // F1 (v7.3): Clear diagnostics log button
  const clearBtn = document.getElementById("diag-clear-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearDiag();
      renderLog();
      diagLog("[diag] Log cleared");
    });
  }

  // Close when clicking the overlay background
  const ov = overlay();
  if (ov) {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeDiagOverlay();
    });
  }

  diagLog("[diag] Overlay initialized");

  // Stamp build time into the overlay header (if the element exists)
  const buildEl = document.getElementById("diag-build-time");
  if (buildEl) {
    try {
      const ts = new Date(__BUILD_TIME__);
      buildEl.textContent = `Build: ${ts.toLocaleDateString("he-IL")} ${ts.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      buildEl.textContent = `Build: ${__BUILD_TIME__}`;
    }
  }
}
