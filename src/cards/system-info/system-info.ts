/**
 * FamilyDashBoard v7 — System Info Card
 *
 * Displays live client-side system status with zero network dependency:
 *   - Online / offline status
 *   - Battery level + charging state (Battery Status API)
 *   - Connection type + effective speed (Network Information API)
 *   - Page performance (navigation timing)
 *   - Browser + platform info
 *   - Dashboard uptime since page load
 *
 * All APIs are optional — gracefully degrades when unavailable.
 */

import { diagLog } from "../../core/diag";
import { loadConfig } from "../../core/config";
import type { CardDefinition } from "../../types/card";

// ── Types for non-standard browser APIs ──────────────────────────────────

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
}

interface NetworkInformation {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface NavigatorUABrandVersion {
  brand: string;
  version: string;
}
interface NavigatorUAData {
  brands: NavigatorUABrandVersion[];
  platform: string;
}
type NavigatorWithExtras = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
  connection?: NetworkInformation;
  userAgentData?: NavigatorUAData;
  deviceMemory?: number;
};

const PAGE_LOAD_TIME = Date.now();

// ── Sprint 29: Pure helpers for JS heap + GPU ──────────────────────────────

/**
 * Format JS heap usage as "used / limit MB".
 * Returns "" when inputs are not positive numbers.
 */
export function formatHeapMb(usedBytes: number, limitBytes: number): string {
  if (!usedBytes || !limitBytes) return "";
  return `${(usedBytes / 1_048_576).toFixed(1)} / ${(limitBytes / 1_048_576).toFixed(0)} MB`;
}

/**
 * Shorten a WebGL renderer string to ≤30 chars by trimming after "/" or "(".
 */
export function gpuShortName(renderer: string): string {
  const trimmed = (renderer.split("/")[0] ?? renderer).split("(")[0]?.trim() ?? renderer;
  return trimmed.slice(0, 30);
}

// ── Battery helper ─────────────────────────────────────────────────────────

async function getBatteryInfo(): Promise<{
  level: number;
  charging: boolean;
} | null> {
  try {
    const nav = navigator as NavigatorWithExtras;
    if (!nav.getBattery) return null;
    const battery = await nav.getBattery();
    return { level: battery.level, charging: battery.charging };
  } catch {
    return null;
  }
}

// ── DOM refs ───────────────────────────────────────────────────────────────

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setText(id: string, text: string): void {
  const e = el(id);
  if (e) e.textContent = text;
}

// ── Render ─────────────────────────────────────────────────────────────────

export async function renderSystemInfo(): Promise<void> {
  // Online status
  setText("sysinfo-online", navigator.onLine ? "🟢 מחובר" : "🔴 מנותק");

  // Battery
  const battery = await getBatteryInfo();
  if (battery) {
    const pct = Math.round(battery.level * 100);
    const icon = battery.charging
      ? "⚡"
      : pct > 50
        ? "🔋"
        : pct > 20
          ? "🪫"
          : "🔴";
    setText(
      "sysinfo-battery",
      `${icon} ${pct}%${battery.charging ? " (טוען)" : ""}`,
    );
  } else {
    setText("sysinfo-battery", "—");
  }

  // Network info (Chrome / Android)
  const conn = (navigator as NavigatorWithExtras).connection;
  if (conn) {
    const parts: string[] = [];
    if (conn.effectiveType) parts.push(conn.effectiveType);
    if (conn.downlink !== undefined) parts.push(`${conn.downlink} Mbps`);
    if (conn.rtt !== undefined) parts.push(`RTT ${conn.rtt}ms`);
    setText("sysinfo-net", parts.join(" · ") || "—");
  } else {
    setText("sysinfo-net", "—");
  }

  // Uptime — formatted as HH:MM:SS
  const upMs = Date.now() - PAGE_LOAD_TIME;
  const upHh = Math.floor(upMs / 3_600_000);
  const upMm = Math.floor((upMs % 3_600_000) / 60_000);
  const upSs = Math.floor((upMs % 60_000) / 1_000);
  const upStr = `${String(upHh).padStart(2, "0")}:${String(upMm).padStart(2, "0")}:${String(upSs).padStart(2, "0")}`;
  setText("sysinfo-uptime", upStr);

  // Page load timing
  const perf = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (perf) {
    const loadMs = Math.round(perf.loadEventEnd - perf.startTime);
    setText("sysinfo-load", loadMs > 0 ? `${loadMs} ms` : "—");
  }

  // Browser / platform
  const ua = (navigator as NavigatorWithExtras).userAgentData;
  let platform = "—";
  if (ua) {
    platform =
      ua.brands
        .filter(
          (b: NavigatorUABrandVersion) =>
            !b.brand.includes("Not") && !b.brand.includes("Chromium"),
        )
        .map((b: NavigatorUABrandVersion) => `${b.brand} ${b.version}`)
        .join(", ") || ua.platform;
  } else {
    // Fallback: parse navigator.userAgent
    const m = navigator.userAgent?.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
    if (m) platform = `${m[1]} ${m[2]}`;
  }
  setText("sysinfo-browser", platform);

  // Viewport resolution
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dpr = window.devicePixelRatio ?? 1;
  setText("sysinfo-viewport", `${vw}×${vh}${dpr !== 1 ? ` @${dpr}x` : ""}`);

  // Device memory (GB, Chrome-only)
  const devMem = (navigator as NavigatorWithExtras).deviceMemory;
  setText("sysinfo-memory", devMem !== undefined ? `${devMem} GB` : "—");

  // CPU hardware concurrency (core count)
  const cores = navigator.hardwareConcurrency;
  setText("sysinfo-cpu", cores ? `×${cores} ליבות` : "—");

  // F2 (v7.3): Storage quota estimate (StorageManager API)
  if (navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const usedMb = ((est.usage ?? 0) / 1_048_576).toFixed(1);
      const quotaMb = ((est.quota ?? 0) / 1_048_576).toFixed(0);
      setText("sysinfo-storage", `${usedMb} / ${quotaMb} MB`);
    } catch {
      setText("sysinfo-storage", "—");
    }
  }

  // F9 (v7.3): Network RTT tile — prefer Connection API, fallback to navigation timing
  const rttTile =
    (document
      .getElementById("sysinfo-rtt")
      ?.closest(".sysinfo-tile") as HTMLElement) ?? null;
  if (rttTile)
    rttTile.style.display = loadConfig().sysInfoShowRtt ? "" : "none";
  const rttConn = (navigator as NavigatorWithExtras).connection;
  if (rttConn?.rtt !== undefined && rttConn.rtt > 0) {
    setText("sysinfo-rtt", `${rttConn.rtt}ms`);
  } else {
    const navEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navEntry) {
      const rttMs = Math.round(navEntry.responseEnd - navEntry.fetchStart);
      setText("sysinfo-rtt", rttMs > 0 ? `${rttMs}ms` : "—");
    } else {
      setText("sysinfo-rtt", "—");
    }
  }

  // Sprint 29: JS Heap memory (Chrome only — performance.memory)
  const perfMem = (performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  }).memory;
  if (perfMem) {
    setText("sysinfo-heap", formatHeapMb(perfMem.usedJSHeapSize, perfMem.jsHeapSizeLimit));
  }

  // Sprint 29: GPU renderer via WebGL debug extension
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbgInfo) {
        const renderer = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) as string;
        setText("sysinfo-gpu", gpuShortName(renderer));
      }
    }
  } catch {
    // WebGL not available — leave "—"
  }

  diagLog("FDB-053: [system-info] Rendered");
}

// ── Init ────────────────────────────────────────────────────────────────────

let _sysInfoInterval: number | null = null;

export function initSystemInfoCard(): void {
  void renderSystemInfo();
  if (_sysInfoInterval) clearInterval(_sysInfoInterval);
  // Refresh every 30 seconds
  _sysInfoInterval = window.setInterval(() => void renderSystemInfo(), 30_000);

  // React to online/offline events
  window.addEventListener("online", () => {
    setText("sysinfo-online", "🟢 מחובר");
  });
  window.addEventListener("offline", () => {
    setText("sysinfo-online", "🔴 מנותק");
  });
}

export function destroySystemInfoCard(): void {
  if (_sysInfoInterval) {
    clearInterval(_sysInfoInterval);
    _sysInfoInterval = null;
  }
}

// ── Sprint 28: Pure system-info utility functions ─────────────────────────

/**
 * Returns the effective connection type string (e.g. "4g", "3g", "slow-2g")
 * or "unknown" when the Network Information API is not available.
 */
export function getConnectionInfo(): string {
  const nav = navigator as NavigatorWithExtras;
  return nav.connection?.effectiveType ?? "unknown";
}

/**
 * Returns the current viewport dimensions and device pixel ratio.
 */
export function getViewportSize(): { width: number; height: number; dpr: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio ?? 1,
  };
}

/**
 * Format a byte count into a human-readable string (B / KB / MB / GB).
 * Uses binary prefixes (1 KB = 1024 bytes).
 */
export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/**
 * Returns the approximate page load time in milliseconds, defined as the
 * time elapsed since the module's PAGE_LOAD_TIME constant was captured.
 */
export function getPageLoadTime(): number {
  return Date.now() - PAGE_LOAD_TIME;
}

/**
 * Classify the current device category based on viewport width and DPR.
 * Returns "tv" | "desktop" | "tablet" | "mobile".
 */
export function categorizeDevice(): "tv" | "desktop" | "tablet" | "mobile" {
  const { width } = getViewportSize();
  if (width >= 1920) return "tv";
  if (width >= 1024) return "desktop";
  if (width >= 600) return "tablet";
  return "mobile";
}

// ── CardDefinition export (for registry) ─────────────────────────────────

export const systemInfoCard: CardDefinition = {
  id: "system-info",
  icon: "🖥",
  titleHe: "מצב מערכת",
  titleEn: "System Info",
  defaultSlot: { col: 2, order: 4, flexGrow: 14, hidden: false },
  defaultSize: "sm",
  render(): HTMLElement {
    const section = document.createElement("section");
    section.className = "card";
    section.dataset.cardId = "system-info";
    section.setAttribute("aria-label", "System Info");
    section.innerHTML = `<div class="card-header"><span class="icon-badge cyan">🖥</span> מצב מערכת</div><div class="sysinfo-body" id="sysinfo-body"></div>`;
    return section;
  },
  init: initSystemInfoCard,
  destroy: destroySystemInfoCard,
};
