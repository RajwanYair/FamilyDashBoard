/**
 * ticker.ts overlay wiring coverage
 *
 * Runs in its own file so the module-level `_docKeydownWired` flag starts
 * as `false` (fresh module per Vitest file isolation), allowing us to reach
 * the `if (!_docKeydownWired)` branch (line 348) and the `#halacha-overlay`
 * wiring block (lines 340–341).
 *
 * Also covers `openHalachaOverlay` and `closeHalachaOverlay` through
 * simulated DOM events on the wired elements.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { initTicker, applyTickerSpeed } from "@/ui/ticker";
import { cGet } from "@/core/cache";

vi.mock("@/core/fetch", () => ({
  fetchWithTimeout: vi.fn().mockRejectedValue(new Error("network mocked")),
}));

vi.mock("@/core/cache", () => ({
  cGet: vi.fn().mockReturnValue(null),
  cGetStale: vi.fn().mockReturnValue(null),
  cSet: vi.fn(),
}));

vi.mock("@/cards/base-card", () => ({
  scheduleCard: vi.fn(),
  createCardLoader: vi.fn(),
}));

vi.mock("@/core/diag", () => ({
  diagLog: vi.fn(),
}));

vi.mock("@/core/constants", () => ({
  API: {
    SEFARIA_CALENDAR: "https://www.sefaria.org/api/calendars",
    SEFARIA_TEXT: "https://www.sefaria.org/api/texts/",
  },
  PROXIES: [],
  LS_TICKER_MSG: "dash_v2_ticker_msg",
  INTERVALS: { HALACHA: 43200000 },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildFullTickerDOM(): void {
  document.body.innerHTML = `
    <div id="halacha-ticker" class="ticker-inner"></div>
    <div id="hc-halacha-row" style="display:none">
      <div id="hc-halacha"></div>
    </div>
    <div id="halacha-overlay">
      <span id="halacha-overlay-ref"></span>
      <div id="halacha-overlay-text"></div>
    </div>
  `;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Ticker overlay wiring — wireHalachaOverlay with #halacha-overlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("wires #halacha-overlay click listener AND document keydown on first call", () => {
    buildFullTickerDOM();
    // _docKeydownWired starts false in this fresh module context — this is the first test
    const docSpy = vi.spyOn(document, "addEventListener");
    expect(() => initTicker()).not.toThrow();
    // Verify overlay element is wired (lines 340–341)
    const ov = document.getElementById("halacha-overlay");
    expect(ov?.dataset["overlayWired"]).toBe("1");
    // Verify document keydown listener was added (line 348)
    const keydownCalls = docSpy.mock.calls.filter(([type]) => type === "keydown");
    expect(keydownCalls.length).toBeGreaterThan(0);
  });

  it("does not double-wire #halacha-overlay on repeated initTicker calls", () => {
    buildFullTickerDOM();
    initTicker();
    const ov = document.getElementById("halacha-overlay")!;
    const addEvtSpy = vi.spyOn(ov, "addEventListener");
    initTicker(); // second call — should skip wiring (dataset["overlayWired"] === "1")
    expect(addEvtSpy).not.toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("dispatching click on #halacha-overlay calls closeHalachaOverlay (removes .visible)", () => {
    buildFullTickerDOM();
    initTicker();
    const ov = document.getElementById("halacha-overlay")!;
    ov.classList.add("visible");
    ov.dispatchEvent(new Event("click"));
    expect(ov.classList.contains("visible")).toBe(false);
  });

  it("Escape keydown on document removes .visible from overlay", () => {
    buildFullTickerDOM();
    initTicker();
    const ov = document.getElementById("halacha-overlay")!;
    ov.classList.add("visible");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(ov.classList.contains("visible")).toBe(false);
  });
});

describe("Ticker overlay — openHalachaOverlay via ticker click", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("clicking #halacha-ticker opens overlay when halachaData is set", () => {
    buildFullTickerDOM();
    // Provide cached halacha data so _halachaData gets set
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.1",
      heRef: 'שו"ע א',
      category: "Halakhah",
      url: "https://www.sefaria.org/SA.OC.1",
      texts: ["test text"],
    });
    initTicker();
    // Wait for microtasks so loadHalacha(stale path) runs
    const ticker = document.getElementById("halacha-ticker")!;
    // Simulate click on ticker
    ticker.dispatchEvent(new Event("click"));
    const ov = document.getElementById("halacha-overlay")!;
    // Overlay should be visible after click when _halachaData is set
    expect(ov.classList.contains("visible")).toBe(true);
  });

  it("openHalachaOverlay sets ref text from category + ref", () => {
    buildFullTickerDOM();
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.1",
      heRef: 'שו"ע א',
      category: "Halakhah",
      url: "https://www.sefaria.org/SA.OC.1",
      texts: ["test text"],
    });
    initTicker();
    const ticker = document.getElementById("halacha-ticker")!;
    ticker.dispatchEvent(new Event("click"));
    const refEl = document.getElementById("halacha-overlay-ref")!;
    expect(refEl.textContent).toContain("SA.OC.1");
  });

  it("openHalachaOverlay with no category uses ref only", () => {
    buildFullTickerDOM();
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.2",
      heRef: 'שו"ע ב',
      category: "",
      url: "",
      texts: ["text b"],
    });
    initTicker();
    const ticker = document.getElementById("halacha-ticker")!;
    ticker.dispatchEvent(new Event("click"));
    const refEl = document.getElementById("halacha-overlay-ref")!;
    expect(refEl.textContent).toBe("SA.OC.2");
  });

  it("Enter key on #halacha-ticker opens overlay", () => {
    buildFullTickerDOM();
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.3",
      heRef: 'שו"ע ג',
      category: "",
      url: "",
      texts: ["text c"],
    });
    initTicker();
    const ticker = document.getElementById("halacha-ticker")!;
    ticker.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const ov = document.getElementById("halacha-overlay")!;
    expect(ov.classList.contains("visible")).toBe(true);
  });

  it("Space key on #halacha-ticker opens overlay", () => {
    buildFullTickerDOM();
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.4",
      heRef: 'שו"ע ד',
      category: "",
      url: "",
      texts: ["text d"],
    });
    initTicker();
    const ticker = document.getElementById("halacha-ticker")!;
    ticker.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    const ov = document.getElementById("halacha-overlay")!;
    expect(ov.classList.contains("visible")).toBe(true);
  });
});

describe("Ticker overlay — hc-halacha-row keydown opens overlay", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("Enter key on #hc-halacha-row opens overlay when data is set", () => {
    buildFullTickerDOM();
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.5",
      heRef: 'שו"ע ה',
      category: "",
      url: "",
      texts: ["text e"],
    });
    initTicker();
    const row = document.getElementById("hc-halacha-row")!;
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    const ov = document.getElementById("halacha-overlay")!;
    expect(ov.classList.contains("visible")).toBe(true);
  });
});

describe("Ticker — applyTickerSpeed with live elTicker (branch w > 0)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--ticker-duration");
    vi.clearAllMocks();
  });

  it("updates animationDuration when elTicker has scrollWidth > 0", () => {
    buildFullTickerDOM();
    const ticker = document.getElementById("halacha-ticker")!;
    // Mock scrollWidth > 0 (jsdom doesn't compute layout, so override)
    Object.defineProperty(ticker, "scrollWidth", { value: 2800, configurable: true });
    vi.mocked(cGet).mockReturnValue({
      ref: "SA.OC.X",
      heRef: 'שו"ע',
      category: "",
      url: "",
      texts: ["ticker text for scrollWidth test"],
    });
    initTicker();
    // applyTickerSpeed(3) after render should update animation duration
    applyTickerSpeed(3);
    // Animation duration should be set (not default "")
    expect(ticker.style.animationDuration).toBeTruthy();
  });
});
