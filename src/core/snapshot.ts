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
import { getDiagEntries, redactDiagnosticText } from "../core/diag";
import { nowISO } from "../core/temporal";
import { LS_CONFIG, LS_CUSTOM_PROXY, LS_ICS_URL } from "./constants";

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
      const safe = sanitizeStoredValue(key, raw);
      // Truncate large values (e.g. cached API data) to 300 chars
      out[key] = safe && safe.length > 300 ? `${safe.slice(0, 300)}…` : safe;
    }
  } catch {
    out["_error"] = "localStorage inaccessible";
  }
  return out;
}

function isPrivateUrlKey(key: string): boolean {
  return key === LS_CUSTOM_PROXY || key === LS_ICS_URL || key.startsWith(`${LS_ICS_URL}_`);
}

function sanitizeStoredValue(key: string, raw: string | null): string | null {
  if (!raw) return raw;
  if (isPrivateUrlKey(key)) return "[redacted private URL]";

  if (key === LS_CONFIG) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        const config = parsed as Record<string, unknown>;
        if (Array.isArray(config.calendarUrls)) {
          config.calendarUrls = config.calendarUrls.map(() => "[redacted calendar URL]");
        }
        if (typeof config.customProxy === "string" && config.customProxy.length > 0) {
          config.customProxy = "[redacted custom proxy]";
        }
        return JSON.stringify(config);
      }
    } catch {
      // Fall through to generic URL redaction for malformed config values.
    }
  }

  return redactDiagnosticText(raw);
}

function sanitizeConfig(): ReturnType<typeof loadConfig> {
  const config = loadConfig();
  return {
    ...config,
    calendarUrls: config.calendarUrls.map(() => "[redacted calendar URL]"),
    customProxy: config.customProxy ? "[redacted custom proxy]" : "",
  };
}

/** Build the snapshot object. */
export function buildSnapshot(): DashboardSnapshot {
  return {
    version: __APP_VERSION__,
    timestamp: nowISO(),
    userAgent: navigator.userAgent,
    config: sanitizeConfig(),
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
  const ts = nowISO().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `fdb-snapshot-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
