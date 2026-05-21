/**
 * FamilyDashBoard v13 — Diagnostics Overlay
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
import {
  cacheStats,
  getOldestCacheAgeMinutes,
  cacheDashboard,
  cacheInventory,
  lastHitLayer,
} from "../core/cache";
import { downloadSnapshot } from "../core/snapshot";
import { getConsecutiveFailures, isNetworkOffline, getNetworkQualityTier } from "../core/fetch";
import {
  getErrors,
  clearErrors,
  formatErrorEntry,
  getErrorCount,
  getErrorTrend,
} from "../core/error-tracker";
import {
  getPerfVitals,
  formatVital,
  rateVital,
  hasPerfSupport,
  getCardTimings,
} from "../core/perf";
import { idbEstimateSize } from "../core/idb-cache";
import { formatHardwareProfile, getHardwareTier } from "../core/hardware";
import {
  getAllProviderHealth,
  getProviderSuccessRate,
  getProviderAvgLatency,
  getProviderLatency,
} from "../core/provider";
import { trustedHTML } from "../core/trusted-types";
import { getGovernorStats } from "../core/refresh-governor";
import { fromISOString, formatTimeHHMM } from "../core/temporal";
import { getDedupStats } from "../core/feed-stats";

let overlayEl: HTMLDialogElement | null = null;
let logEl: HTMLElement | null = null;

/** Compute the 95th-percentile value from a latency samples array. Returns 0 if empty. */
function computeP95(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return Math.round(sorted[Math.max(0, idx)] ?? 0);
}

function overlay(): HTMLDialogElement | null {
  if (!overlayEl?.isConnected)
    overlayEl = document.getElementById("diag-overlay") as HTMLDialogElement | null;
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
  } catch {
    /* quota error */
  }
  const lsKB = (lsBytes / 1024).toFixed(1);

  // Failed panes backoff
  const failed = getFailedPanes();
  const failedText =
    failed.length === 0 ? "אין כשלים" : failed.map((f) => `${f.key}(×${f.delay})`).join(", ");

  // Worker status
  const workerStatus = isWorkerEnabled() ? "✅ פעיל" : "❌ כבוי";

  // Cache stats ( + full dashboard)
  const cs = cacheStats();
  const cd = cacheDashboard();
  const hitPct = cs.hitRate.toFixed(0);
  const oldestAge = getOldestCacheAgeMinutes();
  const cacheAgeStr = oldestAge > 0 ? `${oldestAge}m` : "N/A";

  // Network quality ( +37)
  const networkTier = getNetworkQualityTier();
  const networkIcon =
    networkTier === "ok"
      ? "🟢"
      : networkTier === "slow"
        ? "🟡"
        : networkTier === "bad"
          ? "🔴"
          : "⚪";
  const consecutiveFails = getConsecutiveFailures();
  const networkOffline = isNetworkOffline() ? " (offline)" : "";

  // Build info
  const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "?";
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "?";

  // Error count
  const errCount = getErrorCount();

  panes.replaceChildren();
  const html = `
    <div class="diag-stats">
      <span>🗄️ LocalStorage: <b>${lsKB} KB</b></span>
      <span>🌐 Worker: <b>${workerStatus}</b></span>
      <span>⚠️ כשלים: <b>${failedText}</b></span>
      <span>📦 Cache: <b>${cs.hits}↑ / ${cs.misses}↓ (${hitPct}%)</b> · mem:${cd.memEntries} ls:${cd.lsEntries} · last:${lastHitLayer()}</span>
      <span>🕰️ ותק מטמון: <b>${cacheAgeStr}</b></span>
      <span>${networkIcon} רשת: <b>${networkTier}${networkOffline}</b>${consecutiveFails > 0 ? ` (×${consecutiveFails})` : ""}</span>
      <span>🏷️ v${version}</span>
      <span>🕒 Build: ${buildTime.slice(0, 10)}</span>
      ${errCount > 0 ? `<span style="color:var(--negative)">⚠️ שגיאות: <b>${errCount}</b></span>` : '<span style="color:var(--positive)">\u2705 אין שגיאות</span>'}
      <span id="diag-idb-size">💾 IDB: טוען...</span>
    </div>`;
  // Web Vitals section + startup waterfall
  const vitalsHtml = hasPerfSupport()
    ? (() => {
        const v = getPerfVitals();
        const vitalColor = (r: string): string =>
          r === "good" ? "var(--positive)" : r === "poor" ? "var(--negative)" : "var(--warning)";
        const items: string[] = [];
        for (const key of ["lcp", "fcp", "ttfb", "inp", "cls", "startup"] as const) {
          const rating = rateVital(key, v[key]);
          const label = key === "startup" ? "INIT" : key.toUpperCase();
          items.push(
            `<span style="color:${vitalColor(rating)}">${label}: <b>${formatVital(key, v[key])}</b></span>`,
          );
        }
        return `<div class="diag-stats" style="margin-top:6px;font-size:0.78em">${items.join("")}</div>`;
      })()
    : "";

  // Hardware profile section
  const hwTier = getHardwareTier();
  const hwColor =
    hwTier === "high" ? "var(--positive)" : hwTier === "mid" ? "var(--warning)" : "var(--negative)";
  const hwHtml = `<div class="diag-stats" style="margin-top:6px;font-size:0.78em;color:var(--text-muted)">
    🖥️ HW: <span style="color:${hwColor}"><b>${formatHardwareProfile()}</b></span>
  </div>`;

  panes.innerHTML = trustedHTML(
    html +
      vitalsHtml +
      hwHtml +
      renderCardTimingsHtml() +
      renderGovernorStatsHtml() +
      renderErrorTrendHtml() +
      renderNewsDedupHtml() +
      renderProviderHealthHtml(),
  );

  // Async IDB size + inventory update (v7.10 — non-blocking — key count)
  void Promise.all([idbEstimateSize(), cacheInventory()]).then(([bytes, inv]) => {
    const idbEl = document.getElementById("diag-idb-size");
    if (!idbEl) return;
    const idbMB = (bytes / (1024 * 1024)).toFixed(2);
    idbEl.innerHTML = trustedHTML(
      `💾 IDB: <b>${idbMB} MB</b> · ${String(inv.idbEntries)} keys · LS ${(inv.lsBytes / 1024).toFixed(1)} KB`,
    );
  });
}

// card init timing breakdown ──

function renderCardTimingsHtml(): string {
  const timings = getCardTimings();
  if (timings.size === 0) return "";
  const sorted = [...timings.entries()].sort((a, b) => b[1] - a[1]);
  const rows = sorted
    .map(([id, ms]) => {
      const color = ms < 5 ? "var(--positive)" : ms < 20 ? "var(--warning)" : "var(--negative)";
      return `<tr><td>${id}</td><td style="color:${color};text-align:end"><b>${ms.toFixed(1)}ms</b></td></tr>`;
    })
    .join("");
  return `<div style="margin-top:6px;font-size:0.75em">
    <b>⏱️ Card Init Timing</b>
    <table style="width:100%;border-collapse:collapse;margin-top:3px">${rows}</table>
  </div>`;
}

// error rate trend sparkline ──

function renderErrorTrendHtml(): string {
  const trend = getErrorTrend();
  if (trend.length < 2) return "";
  const max = Math.max(...trend, 1);
  const bars = trend
    .map((v) => {
      const h = Math.max(2, Math.round((v / max) * 24));
      const color = v === 0 ? "var(--positive)" : v < 1 ? "var(--warning)" : "var(--negative)";
      return `<span style="display:inline-block;width:8px;height:${String(h)}px;background:${color};border-radius:1px;vertical-align:bottom"></span>`;
    })
    .join("");
  return `<div style="margin-top:6px;font-size:0.75em">
    <b>📉 Error Rate Trend</b> (err/min)
    <div style="display:flex;gap:2px;align-items:end;height:28px;margin-top:3px">${bars}</div>
  </div>`;
}

// ── Governor render stats ──

function renderGovernorStatsHtml(): string {
  const stats = getGovernorStats();
  if (stats.length === 0) return "";
  const totalRenders = stats.reduce((s, c) => s + c.renders, 0);
  const totalSkips = stats.reduce((s, c) => s + c.skips, 0);
  const rows = stats
    .sort((a, b) => b.skips - a.skips)
    .map((s) => {
      const skipPct =
        s.renders + s.skips > 0 ? ((s.skips / (s.renders + s.skips)) * 100).toFixed(0) : "0";
      return `<span>${s.cardId}: ${s.renders}↑ ${s.skips}⏭ (${skipPct}%)</span>`;
    })
    .join("");
  return `<div class="diag-stats" style="margin-top:6px;font-size:0.78em">
    🎛️ Governor: ${totalRenders} renders · ${totalSkips} skipped ${rows}
  </div>`;
}

// ── Provider health table ( , enhanced ) ──

/** Map provider status to emoji icon. */
export function providerStatusIcon(status: string): string {
  if (status === "ok") return "🟢";
  if (status === "degraded") return "🟡";
  return "🔴";
}

/**
 * Render a Grafana-style provider health scorecard table.
 * Returns empty string when no providers have been recorded.
 *
 * Columns: Status | Provider | ✓ | ✗ | Rate% | p50ms | p95ms | Consec | Last OK
 */
export function renderProviderHealthHtml(): string {
  const providers = getAllProviderHealth();
  if (providers.length === 0) return "";

  const tableRows = providers
    .map((p) => {
      const rate = getProviderSuccessRate(p.id) * 100;
      const rateStr = rate.toFixed(0);
      const rateColor =
        rate >= 95 ? "var(--positive)" : rate >= 80 ? "var(--warning)" : "var(--negative)";

      const samples = getProviderLatency(p.id);
      const p50 = getProviderAvgLatency(p.id);
      const p95 = computeP95(samples);
      const p50Str = p50 > 0 ? String(p50) : "–";
      const p95Str = p95 > 0 ? String(p95) : "–";
      const p95Color =
        p95 === 0
          ? "inherit"
          : p95 < 1000
            ? "var(--positive)"
            : p95 < 3000
              ? "var(--warning)"
              : "var(--negative)";

      const consecStr = p.consecutiveFails > 0 ? `×${p.consecutiveFails}` : "–";
      const consecColor = p.consecutiveFails === 0 ? "inherit" : "var(--negative)";
      const lastOkStr = p.lastOkAt ? p.lastOkAt.slice(11, 16) : "–";

      return (
        `<tr>` +
        `<td>${providerStatusIcon(p.status)}</td>` +
        `<td style="font-weight:700">${p.id}</td>` +
        `<td style="text-align:end;color:var(--positive)">${p.successCount}</td>` +
        `<td style="text-align:end;color:var(--negative)">${p.failureCount}</td>` +
        `<td style="text-align:end;color:${rateColor}"><b>${rateStr}%</b></td>` +
        `<td style="text-align:end">${p50Str}</td>` +
        `<td style="text-align:end;color:${p95Color}">${p95Str}</td>` +
        `<td style="text-align:end;color:${consecColor}">${consecStr}</td>` +
        `<td style="text-align:end;color:var(--text-muted)">${lastOkStr}</td>` +
        `</tr>`
      );
    })
    .join("");

  return `<div style="margin-top:8px;font-size:0.75em">
    <b>🏥 Provider Health Scorecard</b>
    <table style="width:100%;border-collapse:collapse;margin-top:4px;line-height:1.5">
      <thead>
        <tr style="color:var(--text-muted);font-size:0.9em">
          <th style="text-align:start"></th>
          <th style="text-align:start">Provider</th>
          <th style="text-align:end">✓</th>
          <th style="text-align:end">✗</th>
          <th style="text-align:end">Rate</th>
          <th style="text-align:end">p50</th>
          <th style="text-align:end">p95</th>
          <th style="text-align:end">Consec</th>
          <th style="text-align:end">Last OK</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
}

/**
 * Render the P3 Feed Intelligence dedup stats as an HTML string.
 * Returns empty string when no news fetch has occurred yet.
 */
function renderNewsDedupHtml(): string {
  const stats = getDedupStats();
  if (!stats) return "";
  const dedupedCount = stats.totalFetched - stats.uniqueAfterDedup;
  const dedupRatio =
    stats.totalFetched > 0 ? ((dedupedCount / stats.totalFetched) * 100).toFixed(1) : "0.0";
  const runTime = stats.lastRunAt.slice(11, 16);
  return `<div class="diag-stats" style="margin-top:6px;font-size:0.78em">
    📰 News Dedup: <b>${String(stats.uniqueAfterDedup)}/${String(stats.totalFetched)}</b> · deduped <b>${String(dedupedCount)}</b> (${dedupRatio}%) · rendered <b>${String(stats.renderedCount)}</b> · ${runTime}
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

  // Clear runtime errors button
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

  // Snapshot export button
  const snapBtn = document.getElementById("diag-snapshot-btn");
  if (snapBtn) {
    snapBtn.addEventListener("click", () => {
      downloadSnapshot();
      diagLog("[diag] Snapshot exported");
    });
  }

  // Stamp build time into the overlay header (if the element exists)
  const buildEl = document.getElementById("diag-build-time");
  if (buildEl) {
    try {
      const ts = fromISOString(__BUILD_TIME__);
      buildEl.textContent = `Build: ${ts.toLocaleDateString("he-IL")} ${formatTimeHHMM(ts)}`;
    } catch {
      buildEl.textContent = `Build: ${__BUILD_TIME__}`;
    }
  }
}
