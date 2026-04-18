/**
 * FamilyDashBoard v7 — Diagnostics Overlay
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
import { cacheStats, getOldestCacheAgeMinutes } from "../core/cache";
import { getConsecutiveFailures, isNetworkOffline, getNetworkQualityTier } from "../core/fetch";
import { getErrors, clearErrors, formatErrorEntry, getErrorCount } from "../core/error-tracker";
import { getPerfVitals, formatVital, rateVital, hasPerfSupport } from "../core/perf";
import { idbEstimateSize } from "../core/idb-cache";
import { formatHardwareProfile, getHardwareTier } from "../core/hardware";
import { getAllProviderHealth } from "../core/provider";

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

  // Cache stats (Sprint 37)
  const cs = cacheStats();
  const hitPct = cs.hitRate.toFixed(0);
  const oldestAge = getOldestCacheAgeMinutes();
  const cacheAgeStr = oldestAge > 0 ? `${oldestAge}m` : "N/A";

  // Network quality (Sprint 34+37)
  const networkTier = getNetworkQualityTier();
  const networkIcon = networkTier === "ok" ? "🟢" : networkTier === "slow" ? "🟡" : networkTier === "bad" ? "🔴" : "⚪";
  const consecutiveFails = getConsecutiveFailures();
  const networkOffline = isNetworkOffline() ? " (offline)" : "";

  // Build info
  const version =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "?";
  const buildTime =
    typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "?";

  // Error count
  const errCount = getErrorCount();

  panes.innerHTML = "";
  const html = `
    <div class="diag-stats">
      <span>🗄️ LocalStorage: <b>${lsKB} KB</b></span>
      <span>🌐 Worker: <b>${workerStatus}</b></span>
      <span>⚠️ כשלים: <b>${failedText}</b></span>
      <span>📦 Cache: <b>${cs.hits}↑ / ${cs.misses}↓ (${hitPct}%)</b></span>
      <span>🕰️ ותק מטמון: <b>${cacheAgeStr}</b></span>
      <span>${networkIcon} רשת: <b>${networkTier}${networkOffline}</b>${consecutiveFails > 0 ? ` (×${consecutiveFails})` : ""}</span>
      <span>🏷️ v${version}</span>
      <span>🕒 Build: ${buildTime.slice(0, 10)}</span>
      ${errCount > 0 ? `<span style="color:var(--negative)">⚠️ שגיאות: <b>${errCount}</b></span>` : "<span style=\"color:var(--positive)\">\u2705 אין שגיאות</span>"}
      <span id="diag-idb-size">💾 IDB: טוען...</span>
    </div>`;
  // Web Vitals section (Sprint 41) + startup waterfall (Sprint 16)
  const vitalsHtml = hasPerfSupport() ? (() => {
    const v = getPerfVitals();
    const vitalColor = (r: string): string =>
      r === "good" ? "var(--positive)" : r === "poor" ? "var(--negative)" : "var(--warning)";
    const items: string[] = [];
    for (const key of ["lcp", "fcp", "ttfb", "inp", "cls", "startup"] as const) {
      const rating = rateVital(key, v[key]);
      const label = key === "startup" ? "INIT" : key.toUpperCase();
      items.push(`<span style="color:${vitalColor(rating)}">${label}: <b>${formatVital(key, v[key])}</b></span>`);
    }
    return `<div class="diag-stats" style="margin-top:6px;font-size:0.78em">${items.join("")}</div>`;
  })() : "";

  // Hardware profile section
  const hwTier = getHardwareTier();
  const hwColor = hwTier === "high" ? "var(--positive)" : hwTier === "mid" ? "var(--warning)" : "var(--negative)";
  const hwHtml = `<div class="diag-stats" style="margin-top:6px;font-size:0.78em;color:var(--text-muted)">
    🖥️ HW: <span style="color:${hwColor}"><b>${formatHardwareProfile()}</b></span>
  </div>`;

  panes.innerHTML = html + vitalsHtml + hwHtml + renderProviderHealthHtml();

  // Async IDB size update (v7.10 — non-blocking)
  void idbEstimateSize().then((bytes) => {
    const idbEl = document.getElementById("diag-idb-size");
    if (!idbEl) return;
    const idbMB = (bytes / (1024 * 1024)).toFixed(2);
    idbEl.innerHTML = `💾 IDB storage: <b>${idbMB} MB</b>`;
  });
}

// ── Provider health table (Sprint 46, enhanced Sprint 93) ──

/** Map provider status to emoji icon. */
export function providerStatusIcon(status: string): string {
  if (status === "ok") return "🟢";
  if (status === "degraded") return "🟡";
  return "🔴";
}

/**
 * Render a provider health summary as an HTML string (Sprint 93).
 * Returns empty string when no providers have been recorded.
 */
export function renderProviderHealthHtml(): string {
  const providers = getAllProviderHealth();
  if (providers.length === 0) return "";
  const rows = providers
    .map(
      (p) =>
        `<span>${providerStatusIcon(p.status)} <b>${p.id}</b>: ` +
        `↑${p.successCount} ↓${p.failureCount}` +
        `${p.consecutiveFails > 0 ? ` (×${p.consecutiveFails})` : ""}` +
        `${p.lastOkAt ? ` • ok@${p.lastOkAt.slice(11, 16)}` : ""}</span>`,
    )
    .join("");
  return `<div class="diag-stats" style="margin-top:6px;font-size:0.78em">
    🏥 Providers: ${rows}
  </div>`;
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

// ── Render runtime error log ──
function renderErrors(): void {
  const el = document.getElementById("diag-error-log");
  if (!el) return;

  const errors = getErrors();
  if (errors.length === 0) {
    el.textContent = "✅ אין שגיאות זמן-ריצה";
    el.style.color = "var(--positive)";
    return;
  }

  el.style.color = "";
  const frag = document.createDocumentFragment();
  for (const err of errors) {
    const row = document.createElement("div");
    row.className = "diag-entry diag-error";
    row.style.color = "var(--negative)";
    row.textContent = formatErrorEntry(err);
    frag.appendChild(row);
  }
  el.textContent = "";
  el.appendChild(frag);
}

// ── Public API ──

let _refreshTimer: ReturnType<typeof setInterval> | null = null;

export function openDiagOverlay(): void {
  const ov = overlay();
  if (!ov) return;
  renderLog();
  renderStats();
  renderErrors();
  ov.show(); // non-modal: positioned in corner
  // Auto-refresh log + stats every 5 seconds while open
  _refreshTimer = setInterval(() => {
    renderLog();
    renderStats();
    renderErrors();
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

  // Sprint 39: Clear runtime errors button
  const clearErrBtn = document.getElementById("diag-clear-errors-btn");
  if (clearErrBtn) {
    clearErrBtn.addEventListener("click", () => {
      clearErrors();
      renderErrors();
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
