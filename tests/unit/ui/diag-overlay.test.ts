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
} from "@/ui/diag-overlay";
import { diagLog, clearDiag } from "@/core/diag";

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
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(
      true,
    );
  });

  it("closeDiagOverlay removes open attribute", () => {
    openDiagOverlay();
    closeDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(
      false,
    );
  });

  it("toggleDiagOverlay opens when closed", () => {
    toggleDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(
      true,
    );
  });

  it("toggleDiagOverlay closes when open", () => {
    openDiagOverlay();
    toggleDiagOverlay();
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(
      false,
    );
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
    const arg =
      vi.mocked(navigator.clipboard.writeText).mock.calls[0]?.[0] ?? "";
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
    expect(document.getElementById("diag-overlay")?.hasAttribute("open")).toBe(
      true,
    );
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
