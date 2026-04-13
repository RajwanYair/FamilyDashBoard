/**
 * FamilyDashBoard v6 — Config (Settings Persistence)
 *
 * Load/save user settings from localStorage. Share via URL hash.
 */

import type { DashboardConfig } from "../types/config";
import { DEFAULT_CONFIG } from "../types/config";
import { diagLog } from "./diag";

const LS_KEY = "dash_v2_config";

/**
 * Load user config from localStorage, merging with defaults.
 */
export function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null)
      return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...(parsed as Partial<DashboardConfig>) };
  } catch {
    diagLog("[config] Failed to parse localStorage config");
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save the full config object to localStorage.
 */
export function saveConfig(config: DashboardConfig): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(config));
  } catch {
    diagLog("[config] Failed to save config");
  }
}

/**
 * Update a single config field and persist.
 */
export function updateConfig<K extends keyof DashboardConfig>(
  key: K,
  value: DashboardConfig[K],
): void {
  const config = loadConfig();
  config[key] = value;
  saveConfig(config);
}

/**
 * Encode config into a URL hash for sharing.
 */
export function shareConfigHash(config: DashboardConfig): string {
  const json = JSON.stringify(config);
  return "#cfg=" + btoa(unescape(encodeURIComponent(json)));
}

/**
 * Decode config from a URL hash fragment.
 */
export function loadConfigFromHash(hash: string): DashboardConfig | null {
  if (!hash.startsWith("#cfg=")) return null;
  try {
    const b64 = hash.slice(5);
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return { ...DEFAULT_CONFIG, ...(parsed as Partial<DashboardConfig>) };
  } catch {
    diagLog("[config] Invalid hash config");
    return null;
  }
}
