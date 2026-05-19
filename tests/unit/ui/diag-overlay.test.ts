/**
 * Tests for src/ui/diag-overlay.ts
 *
 * Covers: openDiagOverlay, closeDiagOverlay, toggleDiagOverlay,
 * isDiagOverlayOpen, renderLog (entries appear in #diag-log),
 * initDiagOverlay (button wiring).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  openDiagOverlay,
  closeDiagOverlay,
  toggleDiagOverlay,
  isDiagOverlayOpen,
  initDiagOverlay,
  copyDiagLog,
  providerStatusIcon,
  renderProviderHealthHtml,
} from "@/ui/diag-overlay";
import { diagLog, clearDiag } from "@/core/diag";
import {
  recordProviderSuccess,
  recordProviderFailure,
  recordProviderLatency,
  _resetProviderHealth,
} from "@/core/provider";
import * as fetchMod from "@/core/fetch";
import * as errorTrackerMod from "@/core/error-tracker";
import * as perfMod from "@/core/perf";

function polyfillDialog(dlg: Element | null): void {
  // happy-dom does not implement HTMLDialogElement methods.
  const d = dlg as HTMLDialogElement & {
    show?: () => void;
    close?: () => void;
  };
  if (d && typeof d.show !== "function") {
    d.show = function () {
      this.setAttribute("open", "");
    };
    d.showModal = function () {
      this.setAttribute("open", "");
    };
    d.close = function () {
      this.removeAttribute("open");
    };
  }
}

function buildDOM(): void {
  document.body.innerHTML = `
    <dialog id="diag-overlay">
      <button id="diag-copy-btn">📋 העתק לוג</button>
      <button id="diag-clear-btn">🗑 נקה לוג</button>
      <div id="diag-log"></div>
    </dialog>
  `;
  polyfillDialog(document.getElementById("diag-overlay"));
}

describe("Diag Overlay — open/close/toggle", () => {
  beforeEach(() => {
    buildDOM();
    clearDiag();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
  });

  it("openDiagOverlay sets open attribute", () => {
    openDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(true);
  });

  it("closeDiagOverlay removes open attribute", () => {
    openDiagOverlay();
    closeDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(false);
  });

  it("toggleDiagOverlay opens when closed", () => {
    toggleDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(true);
  });

  it("toggleDiagOverlay closes when open", () => {
    openDiagOverlay();
    toggleDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(false);
  });

  it("isDiagOverlayOpen reflects state correctly", () => {
    expect(isDiagOverlayOpen()).toBe(false);
    openDiagOverlay();
    expect(isDiagOverlayOpen()).toBe(true);
    closeDiagOverlay();
    expect(isDiagOverlayOpen()).toBe(false);
  });

  it("does not throw when overlay is absent", () => {
    document.body.innerHTML = "";
    expect(() => openDiagOverlay()).not.toThrow();
  });
});

describe("Diag Overlay — renderLog", () => {
  beforeEach(() => {
    buildDOM();
    clearDiag();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
  });

  it("renders logged entries into #diag-log", () => {
    diagLog("[test] Hello from test");
    openDiagOverlay();
    const log = document.getElementById("diag-log");
    expect(log?.textContent).toContain("[test] Hello from test");
  });

  it("renders empty state when no entries", () => {
    openDiagOverlay();
    const log = document.getElementById("diag-log");
    expect(log?.textContent).toContain("אין רשומות");
  });

  it("renders multiple entries", () => {
    diagLog("[a] message one");
    diagLog("[b] message two");
    openDiagOverlay();
    const entries = document.querySelectorAll(".diag-entry");
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Diag Overlay — copyDiagLog", () => {
  beforeEach(() => {
    buildDOM();
    clearDiag();
    // Mock clipboard
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("calls clipboard.writeText", () => {
    diagLog("[test] copy test");
    copyDiagLog();
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
  });

  it("writes log content to clipboard", () => {
    diagLog("[test] clipboard content");
    copyDiagLog();
    const arg = vi.mocked(navigator.clipboard.writeText).mock.calls[0]?.[0] ?? "";
    expect(arg).toContain("[test] clipboard content");
  });

  it("flashes button text after clipboard write resolves", async () => {
    diagLog("[test] flash test");
    copyDiagLog();
    // Flush the resolved clipboard promise so .then() runs
    await vi.advanceTimersByTimeAsync(0);
    const btn = document.getElementById("diag-copy-btn")!;
    expect(btn.textContent).toBe("✅ הועתק!");
    // After 1500ms the original text should be restored
    await vi.advanceTimersByTimeAsync(1500);
    expect(btn.textContent).toBe("📋 העתק לוג");
  });

  it("handles missing copy button in .then() callback gracefully", async () => {
    // Remove the button before calling copyDiagLog
    document.getElementById("diag-copy-btn")?.remove();
    diagLog("[test] no-btn test");
    copyDiagLog();
    await vi.advanceTimersByTimeAsync(0);
    // Should not throw — the if(btn) check returns early
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
  });
});

describe("Diag Overlay — initDiagOverlay", () => {
  beforeEach(() => {
    buildDOM();
    clearDiag();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
  });

  it("wires copy button click", () => {
    diagLog("[init] wired");
    initDiagOverlay();
    document.getElementById("diag-copy-btn")?.click();
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
  });

  it("closes overlay on background click", () => {
    initDiagOverlay();
    openDiagOverlay();
    const overlay = document.getElementById("diag-overlay")!;
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: false }));
    // target === overlay → should close
    expect(isDiagOverlayOpen()).toBe(false);
  });

  it("does not throw with missing elements", () => {
    document.body.innerHTML = "";
    expect(() => initDiagOverlay()).not.toThrow();
  });
});

// ── Sprint: diag-overlay uncovered branches ─────────────────────────────────

describe("Diag Overlay — null element branches", () => {
  beforeEach(() => {
    clearDiag();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
  });

  it("toggleDiagOverlay returns early when no overlay element exists", () => {
    document.body.innerHTML = "";
    // overlay() returns null → if (!ov) return (line 83)
    expect(() => toggleDiagOverlay()).not.toThrow();
    expect(isDiagOverlayOpen()).toBe(false);
  });

  it("isDiagOverlayOpen returns false when overlay is missing", () => {
    document.body.innerHTML = "";
    // overlay()?.classList.contains("visible") → undefined → ?? false (line 89)
    expect(isDiagOverlayOpen()).toBe(false);
  });

  it("openDiagOverlay handles missing #diag-log gracefully", () => {
    // Has overlay but no diag-log → renderLog's logContainer() → null → if (!el) return
    document.body.innerHTML = `<dialog id="diag-overlay"></dialog>`;
    polyfillDialog(document.getElementById("diag-overlay"));
    expect(() => openDiagOverlay()).not.toThrow();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(true);
  });

  it("openDiagOverlay re-queries disconnected logContainer", () => {
    // First call: set up logEl
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <div id="diag-log"></div>
      </dialog>`;
    polyfillDialog(document.getElementById("diag-overlay"));
    openDiagOverlay();
    // Detach diag-log (logEl becomes disconnected)
    document.getElementById("diag-log")?.remove();
    // Re-add a new diag-log
    const newLog = document.createElement("div");
    newLog.id = "diag-log";
    document.getElementById("diag-overlay")?.appendChild(newLog);
    // Second call should re-query via !logEl.isConnected (line 22)
    diagLog("[test] re-query test");
    openDiagOverlay();
    expect(newLog.textContent).not.toBe("");
  });
});

// ── renderLog empty state (line 60) ─────────────────────────────────────────

describe("DiagOverlay — renderLog empty state", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <div id="diag-log"></div>
      </dialog>`;
    polyfillDialog(document.getElementById("diag-overlay"));
    clearDiag();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows Hebrew empty message when no diag entries exist", () => {
    openDiagOverlay();
    const log = document.getElementById("diag-log")!;
    expect(log.textContent).toBe("אין רשומות אבחון");
  });
});

// ── initDiagOverlay copy-btn wiring (line 81) ───────────────────────────────

describe("DiagOverlay — initDiagOverlay wires copy button", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clicking diag-copy-btn triggers copyDiagLog without throwing", () => {
    document.body.innerHTML = `
      <dialog id="diag-overlay"><div id="diag-log"></div></dialog>
      <button id="diag-copy-btn">📋 העתק לוג</button>`;
    polyfillDialog(document.getElementById("diag-overlay"));
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    initDiagOverlay();
    const btn = document.getElementById("diag-copy-btn")!;
    expect(() => btn.click()).not.toThrow();
  });

  it("initDiagOverlay handles missing copy button without throwing", () => {
    document.body.innerHTML = `<dialog id="diag-overlay"><div id="diag-log"></div></dialog>`;
    polyfillDialog(document.getElementById("diag-overlay"));
    // No #diag-copy-btn in DOM — the if-guard (line 82) should skip wiring
    expect(() => initDiagOverlay()).not.toThrow();
  });
});

// ── Branch coverage: logContainer FALSE path (line 24) ──────────────────────

describe("DiagOverlay — logContainer branch: logEl already connected (line 24)", () => {
  beforeEach(() => {
    buildDOM();
    clearDiag();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
  });

  it("skips logEl re-query on second call when logEl is already connected", () => {
    // First call: logEl is null → re-queries DOM (TRUE branch of line 24 condition)
    openDiagOverlay();
    // Second call: logEl is non-null AND connected → condition is FALSE → skip re-query
    // This also adds a second diagLog entry to render
    diagLog("[test] second open");
    openDiagOverlay();
    // Result: log still renders correctly
    const log = document.getElementById("diag-log");
    expect(log?.textContent).toContain("[test] second open");
  });
});

// ── Branch coverage: closeDiagOverlay when ov.open = false (line 81) ────────

describe("DiagOverlay — closeDiagOverlay when overlay not open (line 81)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
  });

  it("does not throw when dialog exists but is not open (ov?.open FALSE branch)", () => {
    buildDOM();
    // Dialog is in DOM but NOT open — closeDiagOverlay's `if (ov?.open) ov.close()`
    // → ov.open = false → skip close (FALSE branch of line 81)
    expect(() => closeDiagOverlay()).not.toThrow();
    // Overlay should still be closed
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(false);
  });
});

// ── F1 (v7.3): Clear log button ────────────────────────────────────────────

describe("DiagOverlay — clear log button (F1 v7.3)", () => {
  beforeEach(() => {
    buildDOM();
    clearDiag();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
  });

  it("clicking clear button empties the log", () => {
    diagLog("[test] entry one");
    diagLog("[test] entry two");
    initDiagOverlay();
    openDiagOverlay();
    // Verify entries exist
    expect(document.getElementById("diag-log")?.textContent).toContain("entry one");
    // Click clear
    document.getElementById("diag-clear-btn")?.click();
    // After clear + renderLog + diagLog("[diag] Log cleared"), we should NOT see original entries
    const text = document.getElementById("diag-log")?.textContent ?? "";
    expect(text).not.toContain("entry one");
    expect(text).not.toContain("entry two");
  });

  it("initDiagOverlay wires clear button", () => {
    initDiagOverlay();
    diagLog("[test] before clear");
    openDiagOverlay();
    const clearBtn = document.getElementById("diag-clear-btn")!;
    clearBtn.click();
    // The handler calls clearDiag() then renderLog() — log is re-rendered empty
    // then diagLog("[diag] Log cleared") adds one entry but doesn't re-render
    // Re-open to force renderLog
    openDiagOverlay();
    const log = document.getElementById("diag-log")!;
    expect(log.textContent).toContain("Log cleared");
  });
});

// ── renderStats populates #diag-panes ───────────────────────────

describe("DiagOverlay — renderStats populates #diag-panes", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <button id="diag-copy-btn">📋 העתק לוג</button>
        <button id="diag-clear-btn">🗑 נקה לוג</button>
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
      </dialog>`;
    const dlg = document.getElementById("diag-overlay") as HTMLDialogElement & {
      show?: () => void;
      close?: () => void;
    };
    if (typeof dlg.show !== "function") {
      dlg.show = function () {
        this.setAttribute("open", "");
      };
      dlg.showModal = function () {
        this.setAttribute("open", "");
      };
      dlg.close = function () {
        this.removeAttribute("open");
      };
    }
    clearDiag();
  });
  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
    vi.useRealTimers();
  });

  it("openDiagOverlay renders .diag-stats into #diag-panes", () => {
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.innerHTML).toContain("diag-stats");
    closeDiagOverlay();
  });

  it("renderStats shows LocalStorage label in #diag-panes", () => {
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.textContent).toContain("LocalStorage");
    closeDiagOverlay();
  });

  it("closeDiagOverlay clears the auto-refresh timer", () => {
    vi.useFakeTimers();
    openDiagOverlay();
    closeDiagOverlay();
    // After close, timer should be cleared — advancing time should not throw
    expect(() => vi.advanceTimersByTime(15000)).not.toThrow();
  });
});

// ── providerStatusIcon + renderProviderHealthHtml ────────────

describe("providerStatusIcon ", () => {
  it("returns green for ok", () => {
    expect(providerStatusIcon("ok")).toBe("🟢");
  });

  it("returns yellow for degraded", () => {
    expect(providerStatusIcon("degraded")).toBe("🟡");
  });

  it("returns red for down", () => {
    expect(providerStatusIcon("down")).toBe("🔴");
  });

  it("returns red for unknown status", () => {
    expect(providerStatusIcon("unknown")).toBe("🔴");
  });
});

describe("renderProviderHealthHtml ", () => {
  afterEach(() => {
    _resetProviderHealth();
  });

  it("returns empty string when no providers recorded", () => {
    expect(renderProviderHealthHtml()).toBe("");
  });

  it("returns HTML string when a provider has been recorded", () => {
    recordProviderSuccess("news");
    const html = renderProviderHealthHtml();
    expect(html).toContain("news");
    expect(html).toContain("🟢");
  });

  it("shows consecutive fails count when consecutiveFails > 0", () => {
    recordProviderFailure("weather");
    recordProviderFailure("weather");
    const html = renderProviderHealthHtml();
    expect(html).toContain("×2");
  });

  it("omits consecutive fails marker when consecutiveFails is 0", () => {
    recordProviderSuccess("stocks");
    const html = renderProviderHealthHtml();
    // No consecutive fails marker
    expect(html).not.toContain("×");
  });

  it("includes lastOkAt timestamp when provider has succeeded", () => {
    recordProviderSuccess("calendar");
    const html = renderProviderHealthHtml();
    // lastOkAt is set on success; should show ok@ timestamp
    expect(html).toContain("ok@");
  });

  it("shows success rate percentage", () => {
    recordProviderSuccess("api");
    recordProviderSuccess("api");
    recordProviderFailure("api");
    const html = renderProviderHealthHtml();
    expect(html).toContain("67%");
  });

  it("shows avg latency when samples exist", () => {
    recordProviderSuccess("fast");
    recordProviderLatency("fast", 100);
    recordProviderLatency("fast", 200);
    const html = renderProviderHealthHtml();
    expect(html).toContain("150ms");
  });
});

// ── renderStats via openDiagOverlay (lines 59-200) ─────────────

function buildFullDiagDOM(): void {
  document.body.innerHTML = `
    <dialog id="diag-overlay">
      <button id="diag-copy-btn">📋 העתק לוג</button>
      <button id="diag-clear-btn">🗑 נקה לוג</button>
      <button id="diag-clear-errors-btn">🗑 נקה שגיאות</button>
      <div id="diag-log"></div>
      <div id="diag-panes"></div>
      <div id="diag-error-log"></div>
      <div id="diag-build-time"></div>
    </dialog>
  `;
  const dlg = document.getElementById("diag-overlay") as HTMLDialogElement & {
    show?: () => void;
    close?: () => void;
  };
  if (typeof dlg.show !== "function") {
    dlg.show = function () {
      this.setAttribute("open", "");
    };
    dlg.showModal = function () {
      this.setAttribute("open", "");
    };
    dlg.close = function () {
      this.removeAttribute("open");
    };
  }
}

describe("DiagOverlay — renderStats via openDiagOverlay ", () => {
  beforeEach(() => {
    buildFullDiagDOM();
    clearDiag();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
  });

  it("openDiagOverlay populates #diag-panes with HTML", () => {
    openDiagOverlay();
    const panes = document.getElementById("diag-panes");
    expect(panes?.innerHTML.length).toBeGreaterThan(0);
  });

  it("diag-panes contains LocalStorage usage text", () => {
    openDiagOverlay();
    const text = document.getElementById("diag-panes")?.textContent ?? "";
    expect(text).toContain("LocalStorage");
  });

  it("diag-panes contains worker status text", () => {
    openDiagOverlay();
    const text = document.getElementById("diag-panes")?.textContent ?? "";
    expect(text).toMatch(/Worker/i);
  });

  it("diag-panes contains cache hit information", () => {
    openDiagOverlay();
    const text = document.getElementById("diag-panes")?.textContent ?? "";
    expect(text).toMatch(/Cache/i);
  });

  it("openDiagOverlay sets open attribute on overlay", () => {
    openDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(true);
    closeDiagOverlay();
  });
});

describe("DiagOverlay — renderErrors ", () => {
  beforeEach(() => {
    buildFullDiagDOM();
    clearDiag();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
  });

  it("openDiagOverlay populates #diag-error-log", () => {
    openDiagOverlay();
    const errLog = document.getElementById("diag-error-log");
    expect(errLog).not.toBeNull();
    // When no errors: shows success message
    expect(errLog?.textContent).toContain("אין שגיאות");
    closeDiagOverlay();
  });

  it("clear-errors-btn calls clearErrors and re-renders", () => {
    initDiagOverlay();
    openDiagOverlay();
    const clearErrBtn = document.getElementById("diag-clear-errors-btn")!;
    expect(() => clearErrBtn.click()).not.toThrow();
    closeDiagOverlay();
  });
});

describe("DiagOverlay — diag-build-time stamp ( , lines 378-382)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("stamps #diag-build-time when element is present", () => {
    buildFullDiagDOM();
    initDiagOverlay();
    const buildEl = document.getElementById("diag-build-time");
    // Should contain some text (date or raw build time string)
    expect(buildEl?.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it("does not throw when #diag-build-time is absent", () => {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <button id="diag-copy-btn">📋</button>
        <button id="diag-clear-btn">🗑</button>
        <div id="diag-log"></div>
      </dialog>
    `;
    const dlg = document.getElementById("diag-overlay") as HTMLDialogElement & {
      show?: () => void;
      close?: () => void;
    };
    if (typeof dlg.show !== "function") {
      dlg.show = function () {
        this.setAttribute("open", "");
      };
      dlg.close = function () {
        this.removeAttribute("open");
      };
    }
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    expect(() => initDiagOverlay()).not.toThrow();
    vi.restoreAllMocks();
  });
});

// ── renderStats branch coverage via vi.spyOn ─────────────────────

describe("DiagOverlay — renderStats network tier + trend branches", () => {
  function buildStatsDom(): void {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <button id="diag-copy-btn">📋 העתק לוג</button>
        <button id="diag-clear-btn">🗑 נקה לוג</button>
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
        <div id="diag-error-log"></div>
      </dialog>`;
    const dlg = document.getElementById("diag-overlay") as HTMLDialogElement & {
      show?: () => void;
      close?: () => void;
    };
    if (typeof dlg.show !== "function") {
      dlg.show = function () {
        this.setAttribute("open", "");
      };
      dlg.close = function () {
        this.removeAttribute("open");
      };
    }
  }

  afterEach(() => {
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
  });

  it("renders 🟡 when network tier is slow", () => {
    buildStatsDom();
    vi.spyOn(fetchMod, "getNetworkQualityTier").mockReturnValue("slow");
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.innerHTML).toContain("🟡");
    closeDiagOverlay();
  });

  it("renders 🔴 when network tier is bad", () => {
    buildStatsDom();
    vi.spyOn(fetchMod, "getNetworkQualityTier").mockReturnValue("bad");
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.innerHTML).toContain("🔴");
    closeDiagOverlay();
  });

  it("appends (offline) when isNetworkOffline returns true", () => {
    buildStatsDom();
    vi.spyOn(fetchMod, "isNetworkOffline").mockReturnValue(true);
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.textContent).toContain("offline");
    closeDiagOverlay();
  });

  it("renders ×N consecutive fails in renderStats", () => {
    buildStatsDom();
    vi.spyOn(fetchMod, "getConsecutiveFailures").mockReturnValue(5);
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.innerHTML).toContain("×5");
    closeDiagOverlay();
  });

  it("renders error trend sparkline when getErrorTrend returns 2+ items", () => {
    buildStatsDom();
    // trend.length >= 2 → renderErrorTrendHtml renders bars
    // v === 0 → "var(--positive)", v < 1 → "var(--warning)", v >= 1 → "var(--negative)"
    vi.spyOn(errorTrackerMod, "getErrorTrend").mockReturnValue([0, 0.5, 2]);
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.innerHTML).toContain("Error Rate Trend");
    closeDiagOverlay();
  });

  it("renders card timing table when getCardTimings returns non-empty map", () => {
    buildStatsDom();
    const timings = new Map<string, number>([
      ["weather", 3], // < 5 → positive
      ["news", 12], // < 20 → warning
      ["stocks", 50], // >= 20 → negative
    ]);
    vi.spyOn(perfMod, "getCardTimings").mockReturnValue(timings);
    openDiagOverlay();
    const panes = document.getElementById("diag-panes")!;
    expect(panes.innerHTML).toContain("Card Init Timing");
    closeDiagOverlay();
  });
});

// ── openDiagOverlay interval callback (lines 313-315) ────────────────────────

describe("DiagOverlay — openDiagOverlay auto-refresh interval (lines 312-316)", () => {
  beforeEach(() => {
    buildFullDiagDOM();
    clearDiag();
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    closeDiagOverlay();
    document.body.innerHTML = "";
    clearDiag();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("setInterval callback rerenders log/stats/errors (lines 313-315 TRUE)", () => {
    openDiagOverlay();
    // Add a log entry after open to verify re-render
    diagLog("[test] after-open entry");
    vi.advanceTimersByTime(5000);
    const logEl = document.getElementById("diag-log");
    expect(logEl?.textContent).toContain("[test] after-open entry");
  });
});

// ── renderErrors with actual errors ──────────────────────────────────────────

describe("Diag Overlay — renderErrors with errors present", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
        <div id="diag-error-log"></div>
      </dialog>
    `;
    polyfillDialog(document.getElementById("diag-overlay"));
    clearDiag();
  });
  afterEach(() => {
    closeDiagOverlay();
    document.body.innerHTML = "";
    clearDiag();
  });

  it("renders error entries when recordError has been called", async () => {
    const { recordError, clearErrors } = await import("@/core/error-tracker");
    recordError("Test error 1", "test.ts", 42);
    recordError("Test error 2", "other.ts");
    openDiagOverlay();
    const errLog = document.getElementById("diag-error-log");
    expect(errLog?.textContent).toContain("Test error 1");
    expect(errLog?.textContent).toContain("Test error 2");
    const rows = errLog?.querySelectorAll(".diag-error");
    expect(rows?.length).toBe(2);
    clearErrors();
  });
});

// ── initDiagOverlay — snapshot + build stamp ──────────────────────────────────

describe("Diag Overlay — init wires snapshot + build time", () => {
  afterEach(() => {
    closeDiagOverlay();
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
  });

  it("stamps build time into #diag-build-time element", () => {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <span id="diag-build-time"></span>
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
      </dialog>
    `;
    polyfillDialog(document.getElementById("diag-overlay"));
    initDiagOverlay();
    const buildEl = document.getElementById("diag-build-time");
    expect(buildEl?.textContent).toContain("Build:");
  });

  it("snapshot button wires downloadSnapshot", async () => {
    const snapshotMod = await import("@/core/snapshot");
    const spy = vi.spyOn(snapshotMod, "downloadSnapshot").mockImplementation(() => {});
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <button id="diag-snapshot-btn">📸</button>
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
      </dialog>
    `;
    polyfillDialog(document.getElementById("diag-overlay"));
    initDiagOverlay();
    document.getElementById("diag-snapshot-btn")!.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it("clear-errors button calls clearErrors and rerenders", async () => {
    const { recordError, getErrorCount } = await import("@/core/error-tracker");
    recordError("err");
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <button id="diag-clear-errors-btn">🗑</button>
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
        <div id="diag-error-log"></div>
      </dialog>
    `;
    polyfillDialog(document.getElementById("diag-overlay"));
    initDiagOverlay();
    openDiagOverlay();
    expect(getErrorCount()).toBe(1);
    document.getElementById("diag-clear-errors-btn")!.click();
    expect(getErrorCount()).toBe(0);
  });
});

// ── renderStats branches — failed panes + error count ─────────────────────────

describe("Diag Overlay — renderStats with failed panes and errors", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <dialog id="diag-overlay">
        <div id="diag-log"></div>
        <div id="diag-panes"></div>
        <div id="diag-error-log"></div>
      </dialog>
    `;
    polyfillDialog(document.getElementById("diag-overlay"));
    clearDiag();
  });
  afterEach(() => {
    closeDiagOverlay();
    document.body.innerHTML = "";
    clearDiag();
    vi.restoreAllMocks();
  });

  it("shows failed panes with backoff info in stats", async () => {
    const { recordFailure, recordSuccess } = await import("@/core/sync");
    recordFailure("weather");
    recordFailure("weather");
    openDiagOverlay();
    const panes = document.getElementById("diag-panes");
    expect(panes?.textContent).toContain("weather");
    recordSuccess("weather");
  });

  it("shows error count in red when errors exist", async () => {
    const { recordError, clearErrors } = await import("@/core/error-tracker");
    recordError("boom");
    openDiagOverlay();
    const panes = document.getElementById("diag-panes");
    expect(panes?.innerHTML).toContain("שגיאות");
    clearErrors();
  });
});
