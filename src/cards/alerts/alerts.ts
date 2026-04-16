/**
 * FamilyDashBoard v6 — Alerts Card (צבע אדום / Tzeva Adom)
 *
 * Polls the Tzeva Adom alert history API with adaptive intervals:
 *   60s when alerts active, 5min when idle.
 * On new alert: plays a beep and shows a desktop notification if granted.
 * Renders scrolling list of recent alert events.
 */

import { INTERVALS, THREAT_LABELS, API, PROXIES, WORKER_BASE_URL, isWorkerEnabled } from "../../core/constants";
import "./alerts.css";
import { cSet, cGetStale } from "../../core/cache";
import {
  setSync,
  syncBurst,
  recordSuccess,
  recordFailure,
} from "../../core/sync";
import { isPageVisible } from "../../core/idle";
import { diagLog } from "../../core/diag";
import type { AlertEvent, AlertsResponse } from "../../types/api";

// ── State ──
let _enabled = true;
let _lastAlertId: string | number | null = null;
let _haveActive = false;
let _unread = 0;
let _timer: ReturnType<typeof setTimeout> | null = null;
let _realtimeMode = false;
let _beepVolume = 18; // 0-100, matches config.alertVolume default

/** Set alert beep volume (0–100). Persists for the session. */
export function setAlertVolume(vol: number): void {
  _beepVolume = Math.max(0, Math.min(100, vol));
}

/** Get current alert beep volume. */
export function getAlertVolume(): number {
  return _beepVolume;
}

// ── DOM cache ──
let elScroll: HTMLElement | null = null;
let elBadge: HTMLElement | null = null;

const ALERT_INTERVAL_RT = 10_000; // 10s real-time mode

export function cacheDom(): void {
  elScroll = document.getElementById("alerts-scroll");
  elBadge = document.getElementById("alerts-badge");
}

// ── Sound notification (AudioContext beep) ──
function playBeep(): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = _beepVolume / 100;
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
    ctx.close().catch(() => {});
  } catch {
    // AudioContext not available — silent fail
  }
}

// ── Desktop notification ──
function notify(data: AlertEvent[]): void {
  playBeep();
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  )
    return;
  const cities =
    data[0]?.alerts
      ?.flatMap((a) => a.cities ?? [])
      .slice(0, 3)
      .join(", ") ?? "אזורים שונים";
  try {
    new Notification("⚠️ צבע אדום", {
      body: cities,
      icon: "./favicon.ico",
      dir: "rtl",
      lang: "he",
    });
  } catch {
    // Notification failed — silent
  }
}

// ── Schedule next poll ──
function scheduleAlerts(): void {
  if (_timer) clearTimeout(_timer);
  const interval = _haveActive
    ? _realtimeMode
      ? ALERT_INTERVAL_RT
      : INTERVALS.ALERTS_ACTIVE
    : INTERVALS.ALERTS_IDLE;
  _timer = setTimeout(() => void loadAlerts(), interval);
}

// ── Fetch alerts (worker-first, then direct + proxy chain) ──
async function fetchAlerts(): Promise<AlertEvent[]> {
  // Worker-first: avoids CORS + uses edge cache
  if (isWorkerEnabled()) {
    try {
      const res = await fetch(`${WORKER_BASE_URL}/api/alerts`);
      if (res.ok) {
        const data = (await res.json()) as AlertEvent[];
        if (Array.isArray(data) && data.length) {
          diagLog("[alerts] worker OK");
          return data;
        }
      }
    } catch {
      diagLog("[alerts] worker failed, falling back to direct");
    }
  }

  // Fallback: direct + proxy chain
  const sources: Array<{ url: string; isAllOrigins: boolean }> = [
    { url: API.ALERTS, isAllOrigins: false },
    ...PROXIES.map((p) => ({
      url: p + encodeURIComponent(API.ALERTS),
      isAllOrigins: p.includes("allorigins"),
    })),
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url);
      if (!res.ok) continue;
      const data = src.isAllOrigins
        ? (JSON.parse(
            ((await res.json()) as { contents: string }).contents,
          ) as AlertEvent[])
        : ((await res.json()) as AlertEvent[]);
      if (Array.isArray(data) && data.length) return data;
    } catch {
      continue;
    }
  }
  return [];
}

// ── Build a single alert DOM element ──
export function buildAlertItem(
  ev: AlertEvent,
  now: number,
  highlightNew: boolean,
  isClone: boolean,
): HTMLElement | null {
  if (!ev.alerts?.length) return null;

  const firstAlert = ev.alerts[0];
  if (!firstAlert) return null;

  const allCities = ev.alerts.flatMap((a) => a.cities ?? []);
  const threat = ev.alerts.reduce((mx, a) => Math.max(mx, a.threat ?? 0), 0);
  const ageMin = Math.floor((now - firstAlert.time) / 60);

  const div = document.createElement("div");
  div.className =
    "alert-item" +
    (ageMin < 10 ? " active" : " past") +
    (highlightNew ? " new-alert" : "") +
    (isClone ? " clone" : "");

  const citiesEl = document.createElement("div");
  citiesEl.className = "alert-cities";
  const unique = [...new Set(allCities)];
  citiesEl.textContent =
    unique.length > 5
      ? unique.slice(0, 5).join(", ") + ` (+${unique.length - 5})`
      : unique.join(", ");
  div.appendChild(citiesEl);

  const metaEl = document.createElement("div");
  metaEl.className = "alert-meta";

  const timeEl = document.createElement("span");
  timeEl.className = "alert-time";
  const d = new Date(firstAlert.time * 1000);
  timeEl.textContent = d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
  metaEl.appendChild(timeEl);

  const thrEl = document.createElement("span");
  thrEl.className = "alert-threat";
  thrEl.textContent = THREAT_LABELS[threat] ?? "⚠️ התרעה";
  metaEl.appendChild(thrEl);
  div.appendChild(metaEl);

  return div;
}

// ── Render alerts list ──
export function renderAlerts(data: AlertEvent[], highlightNew: boolean): void {
  if (!elScroll) return;

  if (highlightNew) {
    _unread++;
    if (elBadge) {
      elBadge.textContent = String(_unread);
      elBadge.style.display = "";
    }
  }

  const now = Date.now() / 1000;
  let total24h = 0;
  for (const ev of data) {
    for (const a of ev.alerts ?? []) {
      if (now - a.time < 86_400) total24h++;
    }
  }

  const recent = data.slice(0, 25);
  const hasActive = data.some((ev) =>
    ev.alerts?.some((a) => now - a.time < 600),
  );

  const frag = document.createDocumentFragment();
  for (const isClone of [false, true]) {
    const counter = document.createElement("div");
    counter.className = "alert-count" + (isClone ? " clone" : "");
    counter.textContent = `🚨 ${total24h} התרעות ב-24 שעות האחרונות`;
    if (hasActive && !isClone) {
      const dot = document.createElement("span");
      dot.className = "alert-live-dot";
      dot.title = "התרעה פעילה";
      counter.appendChild(dot);
    }
    frag.appendChild(counter);

    if (!recent.length) {
      const empty = document.createElement("div");
      empty.className = "alert-count";
      empty.textContent = "✅ אין התרעות אחרונות";
      frag.appendChild(empty);
    } else {
      for (let i = 0; i < recent.length; i++) {
        const item = buildAlertItem(
          recent[i] as AlertEvent,
          now,
          highlightNew && i === 0 && !isClone,
          isClone,
        );
        if (item) frag.appendChild(item);
      }
    }
  }

  elScroll.innerHTML = "";
  elScroll.appendChild(frag);

  // Scroll animation
  const h = elScroll.scrollHeight / 2;
  const dur = Math.max(25, recent.length * 4);
  const style =
    document.getElementById("alerts-scroll-style") ??
    (() => {
      const s = document.createElement("style");
      s.id = "alerts-scroll-style";
      document.head.appendChild(s);
      return s;
    })();
  style.textContent = `@keyframes alertsScroll { from{transform:translateY(0) translateZ(0)} to{transform:translateY(-${h}px) translateZ(0)} }`;
  elScroll.style.animation = `alertsScroll ${dur}s linear infinite`;
}

// ── Main load function ──
export async function loadAlerts(): Promise<void> {
  if (!_enabled) return;
  if (!isPageVisible()) {
    scheduleAlerts();
    return;
  }

  setSync("alerts", "loading");

  const key = "alerts";
  const stale = cGetStale<AlertsResponse>(key);
  if (stale && Array.isArray(stale)) renderAlerts(stale as AlertEvent[], false);

  try {
    const data = await fetchAlerts();
    if (data.length) {
      const newTopId = data[0]?.id ?? null;
      const isNew = _lastAlertId !== null && newTopId !== _lastAlertId;
      _lastAlertId = newTopId;
      if (isNew) notify(data);

      cSet(key, data);
      renderAlerts(data, isNew);
      setSync("alerts", "ok");
      syncBurst("alerts");
      recordSuccess("alerts");

      const now = Date.now() / 1000;
      _haveActive = data.some((ev) =>
        ev.alerts?.some((a) => now - a.time < 600),
      );
    } else {
      _haveActive = false;
      setSync("alerts", stale ? "ok" : "error");
      recordFailure("alerts");
    }
  } catch (err) {
    diagLog(`[alerts] Error: ${String(err)}`);
    setSync("alerts", stale ? "ok" : "error");
    recordFailure("alerts");
  }

  scheduleAlerts();
}

export function setAlertsEnabled(enabled: boolean): void {
  _enabled = enabled;
  if (!enabled && _timer) {
    clearTimeout(_timer);
    _timer = null;
  }
}

export function toggleAlerts(): void {
  setAlertsEnabled(!_enabled);
}

export function isAlertsEnabled(): boolean {
  return _enabled;
}

export function setAlertsRealtime(on: boolean): void {
  _realtimeMode = on;
}

export function initAlertsCard(): void {
  cacheDom();
  void loadAlerts();
  diagLog("[alerts] Initialized");
}
