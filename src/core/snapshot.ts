/**
 * FamilyDashBoard — Dashboard Snapshot Export
 *
 * Captures the current dashboard state (config, localStorage keys, card
 * visibility, theme) and downloads it as a timestamped JSON file.
 *
 * Gated by the diagnostics overlay (debug menu).
 * No external deps. Zero security surface — no sensitive credentials exported.
 */

import { loadConfig } from "../core/config";
import { getDiagEntries } from "../core/diag";
import { today } from "../core/temporal";

interface DashboardSnapshot {
  version: string;
  timestamp: string;
  userAgent: string;
  config: ReturnType<typeof loadConfig>;
  localStorageSummary: Record<string, string | null>;
  diagLog: string[];
}

const SNAPSHOT_LS_PREFIXES = ["dash", "fdb"];

/** Collect a sanitized summary of all dashboard-related localStorage keys. */
function collectLocalStorageSummary(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const isRelevant = SNAPSHOT_LS_PREFIXES.some((p) => key.startsWith(p));
      if (!isRelevant) continue;
      const raw = localStorage.getItem(key);
      // Truncate large values (e.g. cached API data) to 300 chars
      out[key] = raw && raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
    }
  } catch {
    out["_error"] = "localStorage inaccessible";
  }
  return out;
}

/** Build the snapshot object. */
export function buildSnapshot(): DashboardSnapshot {
  return {
    version: __APP_VERSION__,
    timestamp: today().toISOString(),
    userAgent: navigator.userAgent,
    config: loadConfig(),
    localStorageSummary: collectLocalStorageSummary(),
    diagLog: getDiagEntries().map((e) => `[${e.ts}] ${e.msg}`),
  };
}

/** Trigger a file download of the snapshot JSON. */
export function downloadSnapshot(): void {
  const snap = buildSnapshot();
  const json = JSON.stringify(snap, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = today().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `fdb-snapshot-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
