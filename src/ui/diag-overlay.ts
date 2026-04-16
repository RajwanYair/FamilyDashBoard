/**
 * FamilyDashBoard v6 — Diagnostics Overlay
 *
 * Renders getDiagEntries() into #diag-log when the overlay is opened.
 * Wires the copy-to-clipboard button (#diag-copy-btn).
 * Exposes openDiagOverlay / closeDiagOverlay / toggleDiagOverlay.
 */

import { getDiagEntries, formatDiagEntry, clearDiag } from "../core/diag";
import { diagLog } from "../core/diag";

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

export function openDiagOverlay(): void {
  const ov = overlay();
  if (!ov) return;
  renderLog();
  ov.show(); // non-modal: positioned in corner
  diagLog("[diag] Overlay opened");
}

export function closeDiagOverlay(): void {
  const ov = overlay();
  if (ov?.open) ov.close();
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
}
