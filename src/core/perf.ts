/**
 * FamilyDashBoard — Web Vitals Tracker
 *
 * Uses native PerformanceObserver to capture key Web Vitals:
 *   LCP  — Largest Contentful Paint (loading)
 *   CLS  — Cumulative Layout Shift (visual stability)
 *   INP  — Interaction to Next Paint (responsiveness)
 *   FCP  — First Contentful Paint (loading)
 *   TTFB — Time to First Byte (server response)
 *
 * Exports:
 *   initPerfObserver()   — start collecting (called once on app init)
 *   getPerfVitals()      — return current snapshot
 *   hasPerfSupport()     — true if PerformanceObserver is available
 */

export interface PerfVitals {
  lcp: number | null;   // ms — Largest Contentful Paint
  cls: number | null;   // score — Cumulative Layout Shift (unitless)
  inp: number | null;   // ms — Interaction to Next Paint
  fcp: number | null;   // ms — First Contentful Paint
  ttfb: number | null;  // ms — Time to First Byte
  startup: number | null; // ms — DOMContentLoaded → all cards rendered (waterfall)
}

const _vitals: PerfVitals = {
  lcp: null,
  cls: null,
  inp: null,
  fcp: null,
  ttfb: null,
  startup: null,
};

let _clsAccumulator = 0;

/**
 * Return true when the browser supports PerformanceObserver.
 */
export function hasPerfSupport(): boolean {
  return typeof PerformanceObserver !== "undefined";
}

/**
 * Return a snapshot of the currently tracked vitals.
 * Values are null until the metric fires.
 */
export function getPerfVitals(): PerfVitals {
  return { ..._vitals };
}

/**
 * Format a vitals value for display.
 * LCP / INP / FCP are in ms → show as "X ms"; CLS is unitless → "X"; TTFB → ms.
 */
export function formatVital(key: keyof PerfVitals, value: number | null): string {
  if (value === null) return "–";
  switch (key) {
    case "cls": return value.toFixed(3);
    default: return `${Math.round(value)} ms`;
  }
}
export function rateVital(key: keyof PerfVitals, value: number | null): "good" | "needs-improvement" | "poor" | "unknown" {
  if (value === null) return "unknown";
  switch (key) {
    case "lcp": return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "cls": return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    case "inp": return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    case "fcp": return value <= 1800 ? "good" : value <= 3000 ? "needs-improvement" : "poor";
    case "ttfb": return value <= 800 ? "good" : value <= 1800 ? "needs-improvement" : "poor";
    case "startup": return value <= 3000 ? "good" : value <= 6000 ? "needs-improvement" : "poor";
  }
}

let _initialized = false;

/**
 * Start PerformanceObserver instances for all supported vitals.
 * Idempotent — safe to call multiple times.
 */
export function initPerfObserver(): void {
  if (_initialized || !hasPerfSupport()) return;
  _initialized = true;

  // LCP
  try {
    const obs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
      if (last) _vitals.lcp = (last.renderTime ?? last.loadTime ?? 0) || last.startTime;
    });
    obs.observe({ type: "largest-contentful-paint", buffered: true });
  } catch { /* browser may not support */ }

  // CLS
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!e.hadRecentInput) _clsAccumulator += e.value ?? 0;
      }
      _vitals.cls = _clsAccumulator;
    });
    obs.observe({ type: "layout-shift", buffered: true });
  } catch { /* browser may not support */ }

  // INP (Interaction to Next Paint — replaces FID)
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { processingStart?: number; duration?: number };
        const duration = e.duration ?? 0;
        if (_vitals.inp === null || duration > _vitals.inp) _vitals.inp = duration;
      }
    });
    obs.observe({ type: "event", buffered: true } as PerformanceObserverInit);
  } catch { /* browser may not support */ }

  // FCP
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          _vitals.fcp = entry.startTime;
        }
      }
    });
    obs.observe({ type: "paint", buffered: true });
  } catch { /* browser may not support */ }

  // TTFB via Navigation Timing
  try {
    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (navEntries[0]) {
      _vitals.ttfb = navEntries[0].responseStart - navEntries[0].requestStart;
    } else {
      // Fallback: observe navigation timing
      const obs = new PerformanceObserver((list) => {
        const nav = list.getEntries()[0] as PerformanceNavigationTiming | undefined;
        if (nav) _vitals.ttfb = nav.responseStart - nav.requestStart;
      });
      obs.observe({ type: "navigation", buffered: true });
    }
  } catch { /* browser may not support */ }
}

/** Reset observer state (test helper). */
export function _resetPerfObserver(): void {
  _initialized = false;
  _vitals.lcp = null;
  _vitals.cls = null;
  _vitals.inp = null;
  _vitals.fcp = null;
  _vitals.ttfb = null;
  _vitals.startup = null;
  _clsAccumulator = 0;
}

// ── Startup Waterfall ──────────────────────────────────────────────────────────

/**
 * Record a `DOMContentLoaded` timestamp so `markStartupComplete()` can
 * compute the full "DomContentLoaded → all cards rendered" waterfall.
 */
export function markDomReady(): void {
  // Store in performance.mark for reliable cross-context reference
  try { performance.mark("fdb:dom-ready"); } catch { /* Safari < 15 */ }
}

/**
 * Call this once all cards have completed their first render cycle
 * (i.e. after the last `setSync(id, 'ok')` in the init sequence).
 * Records `startup` waterfall in _vitals and logs via diagLog.
 */
export function markStartupComplete(): void {
  if (_vitals.startup !== null) return; // already measured
  const domReadyMark = performance.getEntriesByName("fdb:dom-ready")[0];
  const origin = domReadyMark ? domReadyMark.startTime : 0;
  _vitals.startup = Math.round(performance.now() - origin);
  // Import diagLog lazily to avoid top-level circular dep
  import("./diag").then(({ diagLog }) => {
    diagLog(`FDB-058: [perf] startup waterfall ${String(_vitals.startup)} ms`);
  }).catch(() => { /* swallow in test env */ });
}
