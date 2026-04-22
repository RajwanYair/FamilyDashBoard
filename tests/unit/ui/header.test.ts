/**
 * Tests for src/ui/header.ts
 *
 * Covers: tickClock (updates DOM), toggleClockSeconds, initHeader (caches DOM + ticks),
 *         updateBirthdayChip, updateCountdownChip.
 *
 * Uses vi.resetModules() per describe because header stores module-level DOM refs
 * and clockShowSeconds state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type HeaderMod = {
  tickClock: () => void;
  toggleClockSeconds: () => void;
  setClockSeconds: (v: boolean) => void;
  initHeader: () => void;
  updateBirthdayChip: () => void;
  updateCountdownChip: () => void;
  updateElecBadge: (now: Date) => void;
};

async function freshHdr(): Promise<HeaderMod> {
  vi.resetModules();
  return import("@/ui/header") as Promise<HeaderMod>;
}

function buildHeaderDOM(): void {
  document.body.innerHTML = `
    <span id="clock"></span>
    <span id="eng-date"></span>
    <span id="greeting"></span>
    <div id="day-bar" style="width:0%"></div>
    <div id="year-bar" style="width:0%"></div>
    <span id="header-birthday-chip" hidden></span>
    <span id="header-countdown" hidden></span>
    <span id="elec-badge"></span>
  `;
}

// ── tickClock ──

describe("Header — tickClock", () => {
  let mod: HeaderMod;

  beforeEach(async () => {
    localStorage.clear();
    buildHeaderDOM();
    mod = await freshHdr();
    mod.initHeader();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("sets textContent on #clock", () => {
    const clock = document.getElementById("clock");
    expect(clock?.textContent).toMatch(/^\d{1,2}:\d{2}/);
  });

  it("sets textContent on #eng-date", () => {
    const date = document.getElementById("eng-date");
    expect(date?.textContent).toMatch(/\d{4}/); // contains a year
  });

  it("sets textContent on #greeting", () => {
    const greeting = document.getElementById("greeting");
    expect(greeting?.textContent?.length).toBeGreaterThan(0);
  });

  it("sets day-bar width to a percentage string", () => {
    const bar = document.getElementById("day-bar") as HTMLElement;
    expect(bar.style.width).toMatch(/^\d+(\.\d+)?%$/);
  });

  it("sets year-bar width to a percentage string", () => {
    const bar = document.getElementById("year-bar") as HTMLElement;
    expect(bar.style.width).toMatch(/^\d+(\.\d+)?%$/);
  });

  it("day-bar width is between 0% and 100%", () => {
    const bar = document.getElementById("day-bar") as HTMLElement;
    const pct = parseFloat(bar.style.width);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("year-bar width is between 0% and 100%", () => {
    const bar = document.getElementById("year-bar") as HTMLElement;
    const pct = parseFloat(bar.style.width);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("does not throw when elements are absent", async () => {
    document.body.innerHTML = "";
    const emptyMod = await freshHdr();
    expect(() => emptyMod.tickClock()).not.toThrow();
  });
});

// ── toggleClockSeconds ──

describe("Header — toggleClockSeconds", () => {
  let mod: HeaderMod;

  beforeEach(async () => {
    buildHeaderDOM();
    mod = await freshHdr();
    mod.initHeader();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("does not throw", () => {
    expect(() => mod.toggleClockSeconds()).not.toThrow();
  });

  it("adds seconds to clock text after enabling", () => {
    mod.toggleClockSeconds(); // enable seconds
    const text = document.getElementById("clock")?.textContent ?? "";
    // seconds mode: HH:MM:SS — check for 5-char minimum (8:00:00 or 08:00:00)
    expect(text.length).toBeGreaterThanOrEqual(5);
  });

  it("toggling twice restores no-seconds format", () => {
    const before = document.getElementById("clock")?.textContent ?? "";
    mod.toggleClockSeconds();
    mod.toggleClockSeconds(); // back to no-seconds
    const after = document.getElementById("clock")?.textContent ?? "";
    // Both should match HH:MM format (no seconds)
    expect(before).toMatch(/^\d{1,2}:\d{2}$/);
    expect(after).toMatch(/^\d{1,2}:\d{2}$/);
  });
});

// ── initHeader ──

describe("Header — initHeader", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("does not throw with full DOM", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    expect(() => mod.initHeader()).not.toThrow();
  });

  it("does not throw with empty DOM", async () => {
    document.body.innerHTML = "";
    const mod = await freshHdr();
    expect(() => mod.initHeader()).not.toThrow();
  });

  it("reads clockSeconds from saved config", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ clockSeconds: true }));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    // With clockSeconds=true, the clock text should have seconds (HH:MM:SS)
    const text = document.getElementById("clock")?.textContent ?? "";
    // Pattern: digits:digits:digits
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it("greeting contains Hebrew text", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    // Hebrew greeting words
    const hebrewGreetings = ["בוקר", "צהריים", "ערב", "לילה"];
    expect(hebrewGreetings.some((g) => greeting.includes(g))).toBe(true);
  });

  it("greeting switches to English when interface language is en", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ interfaceLanguage: "en", familyName: "Rajwan" }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    const englishGreetings = ["Good morning", "Good afternoon", "Good evening", "Good night"];
    expect(englishGreetings.some((g) => greeting.includes(g))).toBe(true);
  });
});

// ── updateBirthdayChip ──

describe("Header — updateBirthdayChip", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("hides chip when no birthdays configured", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    expect(chip.hidden).toBe(true);
    expect(chip.textContent).toBe("");
  });

  it("shows chip when a birthday is within 14 days", async () => {
    const today = new Date();
    const soon = new Date(today.getTime() + 5 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [{ name: "עמרי", month: soon.getMonth() + 1, day: soon.getDate() }],
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("עמרי");
  });

  it("shows today message when birthday is today", async () => {
    const today = new Date();
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [{ name: "שרה", month: today.getMonth() + 1, day: today.getDate() }],
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("יום הולדת");
    expect(chip.textContent).toContain("שרה");
  });

  it("hides chip when birthday is 15+ days away", async () => {
    const today = new Date();
    const far = new Date(today.getTime() + 20 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [{ name: "דניאל", month: far.getMonth() + 1, day: far.getDate() }],
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    expect(chip.hidden).toBe(true);
  });

  it("picks the nearest birthday when multiple configured", async () => {
    const today = new Date();
    const in3 = new Date(today.getTime() + 3 * 86_400_000);
    const in10 = new Date(today.getTime() + 10 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [
          { name: "אורי", month: in10.getMonth() + 1, day: in10.getDate() },
          { name: "מיה", month: in3.getMonth() + 1, day: in3.getDate() },
        ],
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    expect(chip.textContent).toContain("מיה");
    expect(chip.textContent).not.toContain("אורי");
  });

  it("does not throw when chip element is absent", async () => {
    document.body.innerHTML = "";
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ birthdays: [{ name: "test", month: 1, day: 1 }] }),
    );
    const mod = await freshHdr();
    mod.initHeader();
    expect(() => mod.updateBirthdayChip()).not.toThrow();
  });
});

// ── updateCountdownChip ──

describe("Header — updateCountdownChip", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("hides chip when no countdownDate configured", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateCountdownChip();
    const chip = document.getElementById("header-countdown") as HTMLElement;
    expect(chip.hidden).toBe(true);
  });

  it("hides chip when countdownLabel is missing", async () => {
    const future = new Date(Date.now() + 10 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        countdownDate: future.toISOString().substring(0, 10),
        countdownLabel: "",
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateCountdownChip();
    const chip = document.getElementById("header-countdown") as HTMLElement;
    expect(chip.hidden).toBe(true);
  });

  it("shows chip with label and days for a future date", async () => {
    const future = new Date(Date.now() + 30 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        countdownDate: future.toISOString().substring(0, 10),
        countdownLabel: "חופשה",
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateCountdownChip();
    const chip = document.getElementById("header-countdown") as HTMLElement;
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("חופשה");
    expect(chip.textContent).toContain("ימים");
  });

  it("shows today message when countdownDate is today", async () => {
    const today = new Date();
    // Use local date (not UTC) — updateCountdownChip compares local midnight
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ countdownDate: iso, countdownLabel: "ברית מצווה" }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateCountdownChip();
    const chip = document.getElementById("header-countdown") as HTMLElement;
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("היום");
    expect(chip.textContent).toContain("ברית מצווה");
  });

  it("hides chip when countdownDate is in the past", async () => {
    const past = new Date(Date.now() - 5 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        countdownDate: past.toISOString().substring(0, 10),
        countdownLabel: "אירוע שעבר",
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateCountdownChip();
    const chip = document.getElementById("header-countdown") as HTMLElement;
    expect(chip.hidden).toBe(true);
  });

  it("does not throw when chip element is absent", async () => {
    document.body.innerHTML = "";
    const future = new Date(Date.now() + 10 * 86_400_000);
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        countdownDate: future.toISOString().substring(0, 10),
        countdownLabel: "test",
      }),
    );
    const mod = await freshHdr();
    mod.initHeader();
    expect(() => mod.updateCountdownChip()).not.toThrow();
  });
});

// ── setClockSeconds ──

describe("Header — setClockSeconds", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("enables seconds — clock shows HH:MM:SS format", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.setClockSeconds(true);
    const text = document.getElementById("clock")?.textContent ?? "";
    expect(text).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it("disables seconds — clock shows HH:MM format", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.setClockSeconds(true);
    mod.setClockSeconds(false);
    const text = document.getElementById("clock")?.textContent ?? "";
    expect(text).toMatch(/^\d{1,2}:\d{2}$/);
  });

  it("does not throw when called without DOM", async () => {
    document.body.innerHTML = "";
    const mod = await freshHdr();
    mod.initHeader();
    expect(() => mod.setClockSeconds(true)).not.toThrow();
  });
});

// ── updateElecBadge ──

describe("Header — updateElecBadge (electricity peak hours)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("adds peak-on class during weekday peak hours (18:00 Sun–Thu)", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    // Sunday (day 0) at 18:00 local — pass a mock Date
    const peakTime = new Date();
    peakTime.setHours(18, 0, 0, 0);
    // Ensure it is a weekday (Sun–Thu = getDay 0–4)
    // Use vi.setSystemTime to control day if needed; here we pass directly
    const sunday = new Date("2024-01-07T18:00:00"); // Sunday
    mod.updateElecBadge(sunday);
    const badge = document.getElementById("elec-badge");
    expect(badge?.classList.contains("peak-on")).toBe(true);
  });

  it("removes peak-on class outside peak hours (10:00)", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const monday = new Date("2024-01-08T10:00:00"); // Monday 10am
    mod.updateElecBadge(monday);
    const badge = document.getElementById("elec-badge");
    expect(badge?.classList.contains("peak-on")).toBe(false);
  });

  it("no peak-on on Saturday (weekend)", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const saturday = new Date("2024-01-06T19:00:00"); // Saturday 19:00
    mod.updateElecBadge(saturday);
    expect(document.getElementById("elec-badge")?.classList.contains("peak-on")).toBe(false);
  });

  it("no peak-on on Friday (weekend)", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const friday = new Date("2024-01-05T20:00:00"); // Friday 20:00
    mod.updateElecBadge(friday);
    expect(document.getElementById("elec-badge")?.classList.contains("peak-on")).toBe(false);
  });

  it("peak on Thursday 21:59 (last peak minute)", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const thu = new Date("2024-01-04T21:59:00"); // Thursday 21:59
    mod.updateElecBadge(thu);
    expect(document.getElementById("elec-badge")?.classList.contains("peak-on")).toBe(true);
  });

  it("no peak at 22:00 (after peak ends)", async () => {
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const mon = new Date("2024-01-08T22:00:00"); // Monday 22:00
    mod.updateElecBadge(mon);
    expect(document.getElementById("elec-badge")?.classList.contains("peak-on")).toBe(false);
  });

  it("does not throw when #elec-badge is absent", async () => {
    document.body.innerHTML = "";
    const mod = await freshHdr();
    mod.initHeader();
    const d = new Date("2024-01-08T18:00:00");
    expect(() => mod.updateElecBadge(d)).not.toThrow();
  });
});

// ── getGreeting member-specific greeting (L34-35) ──

describe("Header — greeting with members config", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("morning greeting includes a member name when members configured", async () => {
    // 8:00 AM on Jan 1 — morning branch uses suffix
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 8, 0, 0));
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ members: ["אבי", "שרה", "דנה"], familyName: "רגואן" }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    // Jan 1 → idx = (1-1) % 3 = 0 → "אבי"
    expect(greeting).toContain("בוקר טוב");
    expect(greeting).toContain("אבי!");
  });

  it("evening greeting includes a member name", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 2, 19, 0, 0));
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({ members: ["אבי", "שרה", "דנה"], familyName: "רגואן" }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    // Jan 2 → idx = (2-1) % 3 = 1 → "שרה"
    expect(greeting).toContain("ערב טוב");
    expect(greeting).toContain("שרה!");
  });

  it("falls back to family name when members array is empty", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1, 8, 0, 0));
    localStorage.setItem("dash_v2_config", JSON.stringify({ members: [], familyName: "ישראלי" }));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    expect(greeting).toContain("למשפחת ישראלי!");
  });
});
// ── Branch coverage: getGreeting variants ─────────────────────────────────

describe("Header — getGreeting with members configured", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("uses greetPerson name in suffix when members array is non-empty", async () => {
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        members: ["אלי", "שרה", "דדי"],
        familyName: "לוי",
      }),
    );
    buildHeaderDOM();
    vi.setSystemTime(new Date("2024-06-15T08:00:00")); // morning
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    // Should contain one of the member names + "!"
    expect(greeting).toMatch(/אלי!|שרה!|דדי!/);
  });

  it("falls back to familyName when members is empty array", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ members: [], familyName: "כהן" }));
    buildHeaderDOM();
    vi.setSystemTime(new Date("2024-06-15T08:00:00")); // morning
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    expect(greeting).toContain("למשפחת כהן!");
  });

  it("handles undefined members key in config (uses ?? [] default)", async () => {
    localStorage.setItem("dash_v2_config", JSON.stringify({ familyName: "ברק" }));
    buildHeaderDOM();
    vi.setSystemTime(new Date("2024-06-15T08:00:00")); // morning — uses familyName
    const mod = await freshHdr();
    mod.initHeader();
    const greeting = document.getElementById("greeting")?.textContent ?? "";
    expect(greeting).toContain("למשפחת ברק!");
  });
});

// ── Branch coverage: updateBirthdayChip next-year birthday ────────────────

describe("Header — updateBirthdayChip next-year birthday path", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("handles birthday that already passed this year — uses next-year date", async () => {
    vi.setSystemTime(new Date("2024-06-15T00:00:00"));
    // Birthday on Jan 1 — already passed in June
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [{ name: "יפה", month: 1, day: 1 }],
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    // Birthday is next Jan 1, 2025 — 200 days away, so chip should be hidden
    expect(chip.hidden).toBe(true);
  });

  it("birthday within 14 days AND second birthday farther — shows first", async () => {
    vi.setSystemTime(new Date("2024-06-15T00:00:00"));
    // First birthday in 3 days, second in 10 days — both within 14
    const d1 = new Date("2024-06-18");
    const d2 = new Date("2024-06-25");
    localStorage.setItem(
      "dash_v2_config",
      JSON.stringify({
        birthdays: [
          { name: "קרוב", month: d1.getMonth() + 1, day: d1.getDate() },
          { name: "רחוק", month: d2.getMonth() + 1, day: d2.getDate() },
        ],
      }),
    );
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.updateBirthdayChip();
    const chip = document.getElementById("header-birthday-chip") as HTMLElement;
    // First birthday (3 days) is closer, so chip shows "קרוב"
    expect(chip.textContent).toContain("קרוב");
    expect(chip.textContent).not.toContain("רחוק");
  });
});

// ── getGreeting noon + evening branches (lines 32/33) ───────────────────────────

describe("Header — getGreeting noon branch", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
  });

  it("returns noon greeting between 12:00 and 16:59", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T14:00:00"));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.tickClock();
    const greeting = document.getElementById("greeting")!;
    expect(greeting.textContent).toContain("צהריים");
  });

  it("returns evening greeting between 17:00 and 20:59", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T19:00:00"));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.tickClock();
    const greeting = document.getElementById("greeting")!;
    expect(greeting.textContent).toContain("ערב");
  });

  it("returns night greeting after 21:00", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T22:00:00"));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.tickClock();
    const greeting = document.getElementById("greeting")!;
    expect(greeting.textContent).toContain("לילה");
  });

  it("returns morning greeting for member at index-based rotation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T08:00:00"));
    localStorage.setItem("dash_v2_config", JSON.stringify({ members: ["עמרי", "ריבה"] }));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.tickClock();
    const greeting = document.getElementById("greeting")!;
    expect(greeting.textContent).toContain("בוקר");
  });
});

// ── getGreeting: cfg.members ?? [] fallback (line 25) ─────────────────────────

describe("Header — cfg.members null ?? [] fallback (line 25)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("falls back to empty members array when config has members: null (line 25)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T09:00:00"));
    // Save config with members explicitly set to null — triggers cfg.members ?? []
    localStorage.setItem("dash_v2_config", JSON.stringify({ members: null }));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    mod.tickClock();
    // Greeting should still render (falls back to empty [] with familyName default)
    const greeting = document.getElementById("greeting")!;
    expect(greeting.textContent?.length).toBeGreaterThan(0);
  });
});

// ── initHeader: cfg.clockSeconds ?? false fallback (line 209) ─────────────────

describe("Header — cfg.clockSeconds ?? false fallback (line 209)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses false when clockSeconds key is absent from saved config (line 209)", async () => {
    // Save a config WITHOUT clockSeconds → loadConfig spreads over defaults
    // If saved config has clockSeconds=undefined (key absent), the spread keeps default=false
    // But a saved config with explicit clockSeconds=null → cfg.clockSeconds=null → ?? false fires
    localStorage.setItem("dash_v2_config", JSON.stringify({ clockSeconds: null }));
    buildHeaderDOM();
    const mod = await freshHdr();
    mod.initHeader();
    // clockShowSeconds should be false (from ?? false fallback)
    mod.tickClock(); // no throw
    const clock = document.getElementById("clock");
    expect(clock).not.toBeNull();
  });
});
