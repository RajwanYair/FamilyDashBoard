/**
 * FamilyDashBoard v13 — Hebrew Calendar Card
 *
 * Fetches candles/havdalah, next holiday, omer count, parasha, and Daf Yomi
 * from the Hebcal API. Also renders a daily motivation saying (from MOTIVATIONS).
 * Refresh: INTERVALS.SHABBAT (6 hours).
 */

import { scheduleCard } from "../base-card";
import "./hebrew-cal.css";
import { INTERVALS, API, MS_PER_DAY, MS_PER_HOUR, MS_PER_MIN } from "../../core/constants";
import { cGetStale, cGetAsync, cGetStaleAsync, cSetAsync } from "../../core/cache";
import { fetchJSONWithWorker } from "../../core/fetch";
import { setSync, syncBurst, recordSuccess, recordFailure } from "../../core/sync";
import { diagLog } from "../../core/diag";
import { loadConfig } from "../../core/config";
import { idbGet, idbSet, idbDelete } from "../../core/idb-store";
import { getTasksForToday } from "../tasks/tasks";
import { decomposeDuration, pad2, computeMoonPhase } from "../../core/utils";
import type { HebcalResponse, HebcalItem } from "../../types/api";
import type { CardConfigField } from "../../types/card";

// ── Sprint 27: Pure Hebrew-cal utility functions ───────────────────────────

/**
 * Returns true if the current moment is between candle-lighting and havdala
 * (i.e., we are currently in Shabbat or Yom Tov).
 * Uses the known candles/havdala times if provided; otherwise falls back
 * to a simple Friday/Saturday heuristic (covers most UI cases).
 */
export function isShabbat(candlesMs?: number | null, havdalaMs?: number | null): boolean {
  const now = Date.now();
  if (candlesMs != null && havdalaMs != null) {
    return now >= candlesMs && now < havdalaMs;
  }
  // Heuristic: Friday after 18:00 or all of Saturday
  const d = new Date();
  const day = d.getDay();
  const h = d.getHours();
  if (day === 6) return true; // All of Saturday
  if (day === 5 && h >= 18) return true; // Friday evening
  return false;
}

/**
 * Find the next upcoming holiday name from a list of Hebcal items.
 * Looks at items with category "holiday" and a future date.
 * Returns null when there are no upcoming holidays.
 */
export function nextHolidayName(items: HebcalItem[], now: Date = new Date()): string | null {
  const upcoming = items
    .filter(
      (i) => i.category === "holiday" && new Date(i.date).getTime() >= now.setHours(0, 0, 0, 0),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return upcoming[0]?.hebrew ?? upcoming[0]?.title ?? null;
}

/**
 * Get the Hebrew date month name (e.g. "תשרי", "ניסן") for a given date
 * using the `Intl.DateTimeFormat` Hebrew calendar extension.
 */
export function hebrewMonthName(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("he-u-ca-hebrew", { month: "long" }).format(date);
}

/**
 * Extract the Parasha (weekly Torah portion) Hebrew name from a list of
 * Hebcal items. Returns null when no parasha is found.
 */
export function getParashat(items: HebcalItem[]): string | null {
  const p = items.find((i) => i.category === "parashat");
  return p?.hebrew ?? p?.title ?? null;
}

/**
 * Sprint 178 / H4: Extract the Haftarah reference from Hebcal items.
 * Hebcal returns items with `category === "haftara"` in the Shabbat feed.
 * Returns null when absent (weekdays, Yom Tov without distinct Haftarah).
 */
export function getHaftarah(items: HebcalItem[]): string | null {
  const h = items.find((i) => i.category === "haftara");
  return h?.hebrew ?? h?.title ?? null;
}

/**
 * Sprint 178 / H5: Find a Rosh Chodesh item from Hebcal items that occurs
 * today or within the next 2 days (covers both days of a two-day Rosh Chodesh).
 * Returns the Hebrew name, or null when not Rosh Chodesh period.
 */
export function getRoshChodesh(items: HebcalItem[], now: Date = new Date()): string | null {
  const todayMs = new Date(now).setHours(0, 0, 0, 0);
  const cutoffMs = todayMs + 2 * 86_400_000; // +2 days
  const rc = items.find((i) => {
    if (i.category !== "roshchodesh") return false;
    const d = new Date(i.date).setHours(0, 0, 0, 0);
    return d >= todayMs && d <= cutoffMs;
  });
  return rc?.hebrew ?? rc?.title ?? null;
}

/**
 * V13-DATA: Returns true when the given date falls on 29 Elul in the Hebrew calendar.
 * 29 Elul is the last day of the Hebrew year — the trigger for pre-warming next-year
 * holiday data from the Hebcal API so it is available immediately on Rosh Hashana.
 * Uses `Intl.DateTimeFormat` with `ca-hebrew` extension (rule 28).
 */
export function is29Elul(date: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("he-u-ca-hebrew", {
    day: "numeric",
    month: "long",
  });
  const parts = fmt.formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  // Hebrew month name for Elul — "אלול"
  return day === "29" && month === "אלול";
}

/**
 * V13-DATA: Returns the Gregorian year + 1 that will be the next Hebrew year
 * when called on 29 Elul. Used to build the pre-warm Hebcal URL for next year's
 * holidays. Returns the current Gregorian year + 1 as a simple approximation
 * (Rosh Hashana always falls in Sept–Oct, so next Hebrew year maps to next Gregorian year).
 */
export function nextHebrewYearGregorianApprox(date: Date = new Date()): number {
  return date.getFullYear() + 1;
}

/**
 * V13-DATA: Fire-and-forget pre-warm for next year's holiday list.
 * Called on 29 Elul so Rosh Hashana data is cached before midnight rollover.
 * The result is stored under a dedicated 30-day key to avoid evicting the
 * current-year entry. Safe to call multiple times — skips if already cached.
 */
export async function prewarmNextYearHolidays(
  dateFn: () => Date = () => new Date(),
): Promise<void> {
  const nextYear = nextHebrewYearGregorianApprox(dateFn());
  const key = `holidays-prewarm-${nextYear}`;
  const existing = await cGetAsync<HebcalResponse>(key, MS_PER_DAY * 30);
  if (existing !== null) return;
  try {
    const d = await fetchJSONWithWorker<HebcalResponse>(
      `${API.HEBCAL}?v=1&cfg=json&maj=on&min=on&year=${nextYear}&month=x`,
    );
    if (d.items) {
      await cSetAsync(key, d);
      diagLog(`FDB-029: [hebrew-cal] Pre-warmed ${d.items.length} holidays for ${nextYear}`);
    }
  } catch {
    diagLog(`FDB-029: [hebrew-cal] Pre-warm for ${nextYear} failed (will retry next load)`);
  }
}

/**
 * Format a zmanim time string (ISO or HH:MM) to a fixed "HH:MM" display,
 * with AM/PM stripped. Returns "--" on parse failure.
 */
export function zmanimTimeLabel(isoOrTime: string): string {
  if (!isoOrTime) return "--";
  // Handles both "2024-01-01T06:00:00+02:00" and "06:00"
  const d = new Date(isoOrTime);
  if (!isNaN(d.getTime())) {
    return d.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  // If it looks like HH:MM already, return as-is
  if (/^\d{1,2}:\d{2}$/u.test(isoOrTime)) return isoOrTime;
  return "--";
}

// ── DOM cache ──
interface HebCalEls {
  candles: HTMLElement | null;
  havdala: HTMLElement | null;
  holiday: HTMLElement | null;
  holidayRow: HTMLElement | null;
  special: HTMLElement | null;
  specialRow: HTMLElement | null;
  omerCount: HTMLElement | null;
  omerRow: HTMLElement | null;
  parasha: HTMLElement | null;
  parashaRow: HTMLElement | null;
  daf: HTMLElement | null;
  dafRow: HTMLElement | null;
  saying: HTMLElement | null;
  moonEl: HTMLElement | null;
  moonRow: HTMLElement | null;
  zmanimSection: HTMLElement | null;
  zmanimGrid: HTMLElement | null;
  eventEl: HTMLElement | null;
  eventRow: HTMLElement | null;
  psalmEl: HTMLElement | null;
  psalmRow: HTMLElement | null;
  // v7.1 additions
  countdown: HTMLElement | null;
  countdownRow: HTMLElement | null;
  dafLink: HTMLElement | null;
  dafLinkRow: HTMLElement | null;
  parashaLink: HTMLElement | null;
  parashaLinkRow: HTMLElement | null;
  halacha: HTMLElement | null;
  halacaRow: HTMLElement | null;
  school: HTMLElement | null;
  schoolRow: HTMLElement | null;
  // Sprint 178: H4 Haftarah + H5 Rosh Chodesh
  haftara: HTMLElement | null;
  haftaraRow: HTMLElement | null;
  roshChodesh: HTMLElement | null;
  roshChodeshRow: HTMLElement | null;
}

let els: HebCalEls = {
  candles: null,
  havdala: null,
  holiday: null,
  holidayRow: null,
  special: null,
  specialRow: null,
  omerCount: null,
  omerRow: null,
  parasha: null,
  parashaRow: null,
  daf: null,
  dafRow: null,
  saying: null,
  moonEl: null,
  moonRow: null,
  countdown: null,
  countdownRow: null,
  dafLink: null,
  dafLinkRow: null,
  parashaLink: null,
  parashaLinkRow: null,
  halacha: null,
  halacaRow: null,
  school: null,
  schoolRow: null,
  haftara: null,
  haftaraRow: null,
  roshChodesh: null,
  roshChodeshRow: null,
  zmanimSection: null,
  zmanimGrid: null,
  eventEl: null,
  eventRow: null,
  psalmEl: null,
  psalmRow: null,
};

function cacheDom(): void {
  els = {
    candles: document.getElementById("hc-candles"),
    havdala: document.getElementById("hc-havdala"),
    holiday: document.getElementById("hc-holiday"),
    holidayRow: document.getElementById("hc-holiday-row"),
    special: document.getElementById("hc-special"),
    specialRow: document.getElementById("hc-special-row"),
    omerCount: document.getElementById("hc-omer"),
    omerRow: document.getElementById("hc-omer-row"),
    parasha: document.getElementById("hc-parasha"),
    parashaRow: document.getElementById("hc-parasha-row"),
    daf: document.getElementById("hc-daf"),
    dafRow: document.getElementById("hc-daf-row"),
    saying: document.getElementById("hc-saying"),
    moonEl: document.getElementById("hc-moon"),
    moonRow: document.getElementById("hc-moon-row"),
    zmanimSection: document.getElementById("zmanim-section"),
    zmanimGrid: document.getElementById("zmanim-grid"),
    eventEl: document.getElementById("hc-event"),
    eventRow: document.getElementById("hc-event-row"),
    psalmEl: document.getElementById("hc-psalm"),
    psalmRow: document.getElementById("hc-psalm-row"),
    countdown: document.getElementById("hc-countdown"),
    countdownRow: document.getElementById("hc-countdown-row"),
    dafLink: document.getElementById("hc-daf-link"),
    dafLinkRow: document.getElementById("hc-daf-link-row"),
    parashaLink: document.getElementById("hc-parasha-link"),
    parashaLinkRow: document.getElementById("hc-parasha-link-row"),
    halacha: document.getElementById("hc-halacha"),
    halacaRow: document.getElementById("hc-halacha-row"),
    school: document.getElementById("hc-school"),
    schoolRow: document.getElementById("hc-school-row"),
    haftara: document.getElementById("hc-haftara"),
    haftaraRow: document.getElementById("hc-haftara-row"),
    roshChodesh: document.getElementById("hc-rosh-chodesh"),
    roshChodeshRow: document.getElementById("hc-rosh-chodesh-row"),
  };
}

// ── Helpers ──
function getGeonameid(): string {
  return loadConfig().geonameid ?? "281184"; // Jerusalem default
}

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

// ── Dedup state (holiday/special names for filtering event & special rows) ──
let _lastHolidayName = "";
let _lastSpecialNames: string[] = [];

// ── Shabbat countdown state ──
let _candlesTime: Date | null = null;
let _havdalaTime: Date | null = null;
let _countdownInterval: ReturnType<typeof setInterval> | null = null;
let _hebCalScheduleId: number | null = null;

// ── Sefaria link refs ──
let _dafSefariaUrl = "";
let _parashaSefariaName = "";

/** Static fallback shown when Sefaria is unreachable and no cache exists. */
export const DAF_STATIC_FALLBACK = {
  ref: "Yoma 2a",
  heRef: "יומא ב׳",
} as const;

// ── School vacation keywords (Hebrew + English) ──
const SCHOOL_VACATION_TITLES = [
  "Passover",
  "Pesach",
  "Sukkot",
  "Shavuot",
  "Hanukkah",
  "Chanukah",
  "Purim",
  "Rosh Hashana",
  "Yom Kippur",
  "פסח",
  "סוכות",
  "שבועות",
  "חנוכה",
  "פורים",
  "ראש השנה",
  "יום כיפור",
] as const;

// ── Candles + Havdalah ──
async function loadCandlesHavdala(): Promise<void> {
  const geonameid = getGeonameid();
  const key = `shabbat-${new Date().toDateString()}`;
  const fresh = await cGetAsync<HebcalResponse>(key, INTERVALS.HEBREW_CAL);
  if (fresh !== null) {
    renderCandlesHavdala(fresh.items);
    return;
  }
  const stale = await cGetStaleAsync<HebcalResponse>(key);
  if (stale !== null) renderCandlesHavdala(stale.items);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}/shabbat?cfg=json&geonameid=${geonameid}&M=on`,
  );
  if (d.items) {
    await cSetAsync(key, d);
    renderCandlesHavdala(d.items);
  }
}

function renderCandlesHavdala(items: HebcalItem[]): void {
  const candle = items.find((i) => i.category === "candles");
  const havdala = items.find((i) => i.category === "havdalah");
  if (els.candles) {
    els.candles.textContent = candle ? fmtTime(candle.date) : "--";
    els.candles.classList.remove("skeleton");
  }
  if (els.havdala) {
    els.havdala.textContent = havdala ? fmtTime(havdala.date) : "--";
  }
  // Capture times for Shabbat countdown
  if (candle) _candlesTime = new Date(candle.date);
  if (havdala) _havdalaTime = new Date(havdala.date);
  startCountdown();
}

// ── Next Holiday ──
async function loadHoliday(): Promise<void> {
  const now = new Date();
  const key = `holidays-${now.getFullYear()}-${now.getMonth()}`;
  const fresh = await cGetAsync<HebcalResponse>(key, INTERVALS.HALACHA); // 12h TTL
  const items = fresh?.items;
  if (items) {
    renderHoliday(items, now);
    return;
  }
  const stale = await cGetStaleAsync<HebcalResponse>(key);
  if (stale?.items) renderHoliday(stale.items, now);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}?v=1&cfg=json&maj=on&min=on&year=${now.getFullYear()}&month=x`,
  );
  if (d.items) {
    await cSetAsync(key, d);
    renderHoliday(d.items, now);
  }
}

function renderHoliday(items: HebcalItem[], now: Date): void {
  const upcoming = items
    .filter((i) => i.category === "holiday" && new Date(i.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const h = upcoming[0];
  if (!h || !els.holiday) return;
  const holidayDate = new Date(h.date);
  const days = Math.ceil((holidayDate.getTime() - now.getTime()) / MS_PER_DAY);
  const name = h.hebrew ?? h.title;
  _lastHolidayName = name;

  // Format Gregorian date for the holiday (day + short month)
  const gregDate = holidayDate.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jerusalem",
  });

  let label: string;
  if (days <= 0) {
    label = name;
  } else if (days === 1) {
    label = `מחר: ${name}`;
  } else {
    label = `${name} — ${gregDate} (בעוד ${days} ימים)`;
  }
  els.holiday.textContent = label;

  // Proximity colouring: red ≤ 7 days, amber ≤ 30 days, default otherwise
  els.holiday.dataset["days"] = String(days);
  els.holiday.style.color = days <= 7 ? "var(--negative)" : days <= 30 ? "var(--warning)" : "";

  if (els.holidayRow) els.holidayRow.style.display = "";

  // School vacation: show if any major holiday started in the last 7 days
  renderSchool(items, now);

  // Sprint 178 / H5: Rosh Chodesh tile
  const rcName = getRoshChodesh(items, now);
  if (rcName && els.roshChodesh && els.roshChodeshRow) {
    els.roshChodesh.textContent = rcName;
    els.roshChodeshRow.style.display = "";
  } else if (els.roshChodeshRow) {
    els.roshChodeshRow.style.display = "none";
  }
}

function renderSchool(items: HebcalItem[], now: Date): void {
  if (!els.school || !els.schoolRow) return;
  const vacationItem = items.find((i) => {
    if (i.category !== "holiday") return false;
    const d = new Date(i.date);
    const diffDays = (d.getTime() - now.getTime()) / MS_PER_DAY;
    // Show if this holiday started 0-7 days ago (we're in the vacation window)
    if (diffDays < -7 || diffDays > 0) return false;
    const lc = (i.hebrew ?? i.title).toLowerCase();
    const titleLc = i.title.toLowerCase();
    return SCHOOL_VACATION_TITLES.some(
      (k) => lc.includes(k.toLowerCase()) || titleLc.includes(k.toLowerCase()),
    );
  });
  if (vacationItem) {
    els.school.textContent = vacationItem.hebrew ?? vacationItem.title;
    els.schoolRow.style.display = "";
  } else {
    els.schoolRow.style.display = "none";
  }
}

// ── Omer + Special items ──
async function loadOmer(): Promise<void> {
  const now = new Date();
  // Detect after-sunset (Hebrew calendar day advances)
  const ilHour = parseInt(
    now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Jerusalem",
    }),
    10,
  );
  const afterSunset = ilHour >= 20;
  const omerDate = afterSunset ? new Date(now.getTime() + MS_PER_DAY) : now;
  const yr = omerDate.getFullYear();
  const mo = omerDate.getMonth() + 1;
  const dy = omerDate.getDate();
  const key = `omer-${yr}-${mo}-${dy}`;

  const fresh = await cGetAsync<HebcalItem>(key, MS_PER_DAY);
  if (fresh !== null) {
    renderOmer(fresh);
    return;
  }
  const stale = await cGetStaleAsync<HebcalItem>(key);
  if (stale !== null) renderOmer(stale);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}?v=1&cfg=json&omer=on&maj=off&min=off&ss=off&mf=off&year=${yr}&month=${mo}&day=${dy}`,
  );
  const item = d.items?.find((i) => i.category === "omer") ?? null;
  // Only cache positive omer results — never cache null, so a failed/off-season
  // fetch doesn't permanently suppress the row until the key expires.
  if (item !== null) await cSetAsync(key, item);
  renderOmer(item);

  // Also render special items (Hanukkah, special holidays) — skip if duplicate of holiday row
  const specials = (d.items ?? []).filter((i) => i.category === "holiday");
  if (specials.length && els.special && els.specialRow) {
    const deduped = specials.filter((i) => {
      const rawName = i.hebrew ?? i.title;
      return rawName !== _lastHolidayName;
    });
    if (deduped.length) {
      _lastSpecialNames = deduped.map((i) => i.hebrew ?? i.title);
      els.special.textContent = deduped.map((i) => `✡️ ${i.hebrew ?? i.title}`).join("  ·  ");
      els.specialRow.style.display = "";
    } else {
      els.specialRow.style.display = "none";
    }
  }
}

function renderOmer(item: HebcalItem | null): void {
  if (!els.omerCount) return;
  if (!item) {
    els.omerCount.textContent = "";
    if (els.omerRow) els.omerRow.style.display = "none";
    return;
  }
  const display = item.hebrew ?? item.title;
  els.omerCount.textContent = display ? `🌾 ${display}` : "";
  if (item.title) els.omerCount.title = item.title;
  if (els.omerRow) els.omerRow.style.display = display ? "" : "none";
}

// ── Parasha ──
async function loadParasha(): Promise<void> {
  const geonameid = getGeonameid();
  const key = `parasha-${new Date().toDateString()}`;
  const fresh = await cGetAsync<HebcalResponse>(key, INTERVALS.DAY);
  if (fresh?.items) {
    renderParasha(fresh.items);
    return;
  }
  const stale = await cGetStaleAsync<HebcalResponse>(key);
  if (stale?.items) renderParasha(stale.items);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}/shabbat?cfg=json&geonameid=${geonameid}&M=on&ss=on`,
  );
  if (d.items) {
    await cSetAsync(key, d);
    renderParasha(d.items);
  }
}

function renderParasha(items: HebcalItem[]): void {
  const p = items.find((i) => i.category === "parashat");
  if (!p || !els.parasha) return;
  els.parasha.textContent = p.hebrew ?? p.title;
  if (els.parashaRow) els.parashaRow.style.display = "";
  // Wire Sefaria parasha link button
  _parashaSefariaName = p.title.replace(/\s+/g, "_");
  if (els.parashaLink && els.parashaLinkRow) {
    els.parashaLink.onclick = () =>
      window.open(
        `https://www.sefaria.org/${_parashaSefariaName}`,
        "_blank",
        "noopener,noreferrer",
      );
    els.parashaLinkRow.style.display = "";
  }
  // Sprint 178 / H4: Render Haftarah row when present
  const haftarahName = getHaftarah(items);
  if (haftarahName && els.haftara && els.haftaraRow) {
    els.haftara.textContent = haftarahName;
    els.haftaraRow.style.display = "";
  } else if (els.haftaraRow) {
    els.haftaraRow.style.display = "none";
  }
}

// ── Daf Yomi ──
async function loadDafYomi(): Promise<void> {
  const now = new Date();
  const key = `daf-${now.toDateString()}`;
  const fresh = await cGetAsync<{ ref: string; heRef: string }>(key, INTERVALS.DAY);
  if (fresh !== null) {
    renderDaf(fresh);
    return;
  }
  const stale = await cGetStaleAsync<{ ref: string; heRef: string }>(key);
  if (stale !== null) renderDaf(stale);

  try {
    const d = await fetchJSONWithWorker<{
      calendar_items: Array<{
        title: { he: string; en: string };
        ref: string;
        url?: string | undefined;
      }>;
    }>(API.SEFARIA_CALENDAR);
    const daf = d.calendar_items?.find((i) => i.title?.en?.toLowerCase().includes("daf yomi"));
    const item = daf ? { ref: daf.ref, heRef: daf.title.he, url: daf.url } : null;
    await cSetAsync(key, item);
    renderDaf(item);
    // Also extract Halacha Yomit from the same response (no extra network call)
    const halachaItem = d.calendar_items?.find((i) =>
      i.title?.en?.toLowerCase().includes("halacha yomit"),
    );
    renderHalacha(
      halachaItem
        ? {
            text: halachaItem.title.he,
            ref: halachaItem.ref,
            url: halachaItem.url,
          }
        : null,
    );
  } catch {
    diagLog("FDB-034: [hebrew-cal] Daf Yomi fetch failed");
    // Show static fallback if no stale data was shown
    if (stale === null) renderDaf(DAF_STATIC_FALLBACK);
  }
}

function renderDaf(item: { ref: string; heRef: string; url?: string | undefined } | null): void {
  if (!els.daf) return;
  if (!item) {
    if (els.dafRow) els.dafRow.style.display = "none";
    if (els.dafLinkRow) els.dafLinkRow.style.display = "none";
    return;
  }
  els.daf.textContent = item.heRef ?? item.ref;
  if (els.dafRow) els.dafRow.style.display = "";
  // Wire Sefaria Daf Yomi link button
  _dafSefariaUrl = item.url
    ? `https://www.sefaria.org/${item.url}`
    : `https://www.sefaria.org/${item.ref.replace(/\s+/g, ".")}`;
  if (els.dafLink && els.dafLinkRow) {
    els.dafLink.onclick = () => window.open(_dafSefariaUrl, "_blank", "noopener,noreferrer");
    els.dafLinkRow.style.display = "";
  }
}

// ── Halacha Yomit ──
function renderHalacha(item: { text: string; ref: string; url?: string | undefined } | null): void {
  if (!els.halacha || !els.halacaRow) return;
  if (!item) {
    els.halacaRow.style.display = "none";
    return;
  }
  els.halacha.textContent = item.text;
  if (item.url) {
    const halachaUrl = `https://www.sefaria.org/${item.url}`;
    els.halacha.title = halachaUrl;
    els.halacha.onclick = () => window.open(halachaUrl, "_blank", "noopener,noreferrer");
    els.halacha.style.cursor = "pointer";
  }
  els.halacaRow.style.display = "";
}

// ── Shabbat Countdown ──
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const { hours: h, minutes: m, seconds: s } = decomposeDuration(ms);
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

function tickCountdown(): void {
  const el = els.countdown ?? document.getElementById("hc-countdown");
  const row = els.countdownRow ?? document.getElementById("hc-countdown-row");
  if (!el || !row) return;
  const now = Date.now();
  const dow = new Date().getDay(); // 5=Fri, 6=Sat
  // Saturday: show havdala countdown
  if (dow === 6 && _havdalaTime && _havdalaTime.getTime() > now) {
    el.textContent = `הבדלה בעוד ${formatCountdown(_havdalaTime.getTime() - now)}`;
    row.style.display = "";
    return;
  }
  // Friday or within 6 hours of candles: show candles countdown
  if (_candlesTime && _candlesTime.getTime() > now) {
    const ms = _candlesTime.getTime() - now;
    if (ms <= 6 * MS_PER_HOUR || dow === 5) {
      el.textContent = `כניסה בעוד ${formatCountdown(ms)}`;
      row.style.display = "";
      return;
    }
  }
  row.style.display = "none";
}

export function startCountdown(): void {
  if (_countdownInterval !== null) clearInterval(_countdownInterval);
  tickCountdown();
  _countdownInterval = setInterval(tickCountdown, 1000);
}

// ── Main load function ──
async function loadHebCal(): Promise<void> {
  setSync("hebcal", "loading");
  try {
    // Start all async loads eagerly — fresh-cache paths resolve synchronously,
    // keeping the UI responsive without a blocking await up front.
    const settled = Promise.allSettled([
      loadCandlesHavdala(),
      loadOmer(),
      loadParasha(),
      loadDafYomi(),
      loadZmanim(),
    ]);
    // Await holiday separately so _lastHolidayName is set before the
    // post-settlement dedup re-check below.
    await loadHoliday();
    await settled;
    setSync("hebcal", "ok");
    syncBurst("hebcal");
    recordSuccess("hebcal");
    // Post-settlement dedup: if loadOmer's fetch raced ahead of loadHoliday,
    // the special row might duplicate the holiday row.  Correct it now that
    // _lastHolidayName is guaranteed to be set.
    if (
      _lastHolidayName &&
      els.specialRow?.style.display !== "none" &&
      _lastSpecialNames.some(
        (n) =>
          n === _lastHolidayName || n.includes(_lastHolidayName) || _lastHolidayName.includes(n),
      )
    ) {
      if (els.specialRow) els.specialRow.style.display = "none";
    }
    // Re-evaluate event row now that holiday/special names are known
    renderNextCalEvent();
    // V13-DATA: If today is 29 Elul (last day of Hebrew year), fire-and-forget
    // a background pre-warm of next year's holiday data.
    if (is29Elul()) {
      void prewarmNextYearHolidays();
    }
    diagLog("FDB-035: [hebrew-cal] Load complete");
  } catch (err) {
    diagLog(`FDB-036: [hebrew-cal] Error: ${String(err)}`);
    setSync("hebcal", "error");
    recordFailure("hebcal");
  }
}

// ── Moon phase ──

// Re-export shared computeMoonPhase for backward compatibility
export { computeMoonPhase };

export function renderMoonPhase(): void {
  const moonEl = els.moonEl ?? document.getElementById("hc-moon");
  const moonRow = els.moonRow ?? document.getElementById("hc-moon-row");
  if (!moonEl) return;
  const { emoji, label } = computeMoonPhase(new Date());
  moonEl.textContent = `${emoji} ${label}`;
  if (moonRow) moonRow.style.display = "";
}

// ── Zmanim (Jewish prayer times) ──

interface ZmanimResponse {
  times: Record<string, string>;
}

const ZMANIM_DISPLAY: Array<[string, string]> = [
  ["alotHaShachar", "עלות השחר"],
  ["sunrise", "זריחה"],
  ["sofZmanShmaGRA", 'סוף ק"ש'],
  ["sofZmanTfilla", "סוף תפילה"],
  ["chatzot", "חצות"],
  ["minchaGedola", "מנחה גדולה"],
  ["sunset", "שקיעה"],
  ["tzait85min", "צאת כוכבים"],
];

export function renderZmanim(times: Record<string, string>): void {
  const grid = els.zmanimGrid ?? document.getElementById("zmanim-grid");
  const section = els.zmanimSection ?? document.getElementById("zmanim-section");
  if (!grid || !section) return;
  const now = Date.now();
  const frag = document.createDocumentFragment();
  let nextItem: HTMLElement | null = null;
  let nextTime = Infinity;
  for (const [key, label] of ZMANIM_DISPLAY) {
    const raw = times[key];
    if (!raw) continue;
    const t = new Date(raw).getTime();
    const item = document.createElement("div");
    item.className = "zman-item";
    const nameEl = document.createElement("div");
    nameEl.className = "zman-name";
    nameEl.textContent = label;
    const timeEl = document.createElement("div");
    timeEl.className = "zman-time";
    timeEl.textContent = new Date(raw).toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
    item.appendChild(nameEl);
    item.appendChild(timeEl);
    frag.appendChild(item);
    if (t > now && t < nextTime) {
      nextTime = t;
      nextItem = item;
    }
  }
  if (nextItem) {
    nextItem.classList.add("zman-next");
    const minsUntil = Math.round((nextTime - now) / MS_PER_MIN);
    nextItem.title = `בעוד ${minsUntil} דק׳`;
  }
  grid.replaceChildren(frag);
  section.style.display = "";
  // Equalize all cell widths to the widest cell so all blocks are uniform.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      const cells = Array.from(grid.querySelectorAll<HTMLElement>(".zman-item"));
      const maxW = cells.reduce((m, el) => Math.max(m, el.getBoundingClientRect().width), 0);
      if (maxW > 0) {
        grid.style.gridTemplateColumns = `repeat(3, ${Math.ceil(maxW)}px)`;
      }
    });
  }
}

async function loadZmanim(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `zmanim-${today}`;
  const fresh = await cGetAsync<ZmanimResponse>(key, INTERVALS.HALACHA);
  if (fresh) {
    renderZmanim(fresh.times);
    return;
  }
  const stale = await cGetStaleAsync<ZmanimResponse>(key);
  if (stale) renderZmanim(stale.times);
  const geonameid = getGeonameid();
  const url = `${API.ZMANIM}?cfg=json&geonameid=${geonameid}&date=${today}&tzid=Asia%2FJerusalem`;
  try {
    const data = await fetchJSONWithWorker<ZmanimResponse>(url);
    if (data?.times) {
      await cSetAsync(key, data);
      renderZmanim(data.times);
    }
  } catch {
    diagLog("FDB-037: [hebrew-cal] Zmanim fetch failed");
  }
}

// ── Next calendar event ──

/**
 * Reads the ICS text from the calendar card stale cache (`cal-ics`),
 * finds the next upcoming VEVENT after now, and displays it in `#hc-event`.
 */
export function renderNextCalEvent(): void {
  const eventEl = els.eventEl ?? document.getElementById("hc-event");
  const eventRow = els.eventRow ?? document.getElementById("hc-event-row");
  if (!eventEl || !eventRow) return;
  const icsText = cGetStale<string>("cal-ics");
  if (!icsText) {
    eventRow.style.display = "none";
    return;
  }
  const now = Date.now();
  const events: Array<{ summary: string; start: Date }> = [];
  const blocks = icsText.split("BEGIN:VEVENT");
  for (const block of blocks.slice(1)) {
    const sumMatch = /^SUMMARY[^:]*:(.+)/m.exec(block);
    const dtMatch = /^DTSTART(?:;[^:]+)?:(\d{8}(?:T\d{6}Z?)?)/m.exec(block);
    if (!sumMatch || !dtMatch) continue;
    const summary = (sumMatch[1] ?? "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
    const raw = dtMatch[1] ?? "";
    if (!raw) continue;
    let d: Date;
    if (raw.length === 8) {
      d = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`);
    } else {
      d = new Date(
        raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/, "$1-$2-$3T$4:$5:$6$7"),
      );
    }
    if (!isNaN(d.getTime()) && d.getTime() > now) events.push({ summary, start: d });
  }
  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  const next = events[0];
  if (!next) {
    eventRow.style.display = "none";
    return;
  }
  // Suppress if summary duplicates an already-shown holiday or special row
  const summary = next.summary;
  const isDuplicate =
    (_lastHolidayName !== "" &&
      (summary.includes(_lastHolidayName) || _lastHolidayName.includes(summary))) ||
    _lastSpecialNames.some((s) => summary.includes(s) || s.includes(summary));
  if (isDuplicate) {
    eventRow.style.display = "none";
    return;
  }
  const daysUntil = Math.ceil((next.start.getTime() - now) / MS_PER_DAY);
  const when = daysUntil <= 0 ? "היום" : daysUntil === 1 ? "מחר" : `בעוד ${daysUntil} ימ׳`;
  eventEl.textContent = `${summary} (${when})`;
  eventRow.style.display = "";
}

// ── Psalm of the Day (שיר של יום) ──

/** Day-of-week → Psalm number (0=Sunday through 6=Saturday). */
const PSALM_BY_WEEKDAY: readonly number[] = [24, 48, 82, 94, 81, 93, 92];

export function getPsalmOfDay(date: Date): number {
  return PSALM_BY_WEEKDAY[date.getDay()] ?? 24;
}

export function renderPsalmOfDay(): void {
  const psalmEl = els.psalmEl ?? document.getElementById("hc-psalm");
  const psalmRow = els.psalmRow ?? document.getElementById("hc-psalm-row");
  if (!psalmEl || !psalmRow) return;
  const num = getPsalmOfDay(new Date());
  psalmEl.textContent = `תהילים ${num}`;
  psalmRow.style.display = "";
}

export function initHebrewCalCard(): void {
  _lastHolidayName = "";
  _lastSpecialNames = [];
  _candlesTime = null;
  _havdalaTime = null;
  _dafSefariaUrl = "";
  _parashaSefariaName = "";
  cacheDom();
  renderMoonPhase();
  renderNextCalEvent();
  renderPsalmOfDay();
  renderTasksStrip();
  void loadHebCal();
  _hebCalScheduleId = scheduleCard(loadHebCal, INTERVALS.HEBREW_CAL);
  diagLog("FDB-038: [hebrew-cal] Initialized");
}

export function destroyHebrewCalCard(): void {
  if (_hebCalScheduleId !== null) {
    clearInterval(_hebCalScheduleId);
    _hebCalScheduleId = null;
  }
  if (_countdownInterval !== null) {
    clearInterval(_countdownInterval);
    _countdownInterval = null;
  }
}

/** Render pending family tasks as a compact strip inside the heb-cal card. */
function renderTasksStrip(): void {
  const strip = document.getElementById("hc-tasks-strip");
  if (!strip) return;
  const tasks = getTasksForToday();
  if (!tasks.length) {
    strip.style.display = "none";
    return;
  }
  strip.textContent = "";
  const frag = document.createDocumentFragment();
  tasks.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "hc-task-chip";
    chip.textContent = `${t.person}: ${t.chore}`;
    frag.appendChild(chip);
  });
  strip.appendChild(frag);
  strip.style.display = "";
}

// ── Sprint 206 / H6: Yahrzeit IDB list ────────────────────────────────────

const IDB_HC_DB = "fdb-hebrew-cal";
const IDB_YZ_STORE = "yahrzeits";
const YZ_MAX = 20;

/** A persisted yahrzeit entry (Hebrew calendar month + day). */
export interface YahrzeitEntry {
  id: string;       // unique stable key
  name: string;     // person's name
  hebrewMonth: number; // 1–13
  hebrewDay: number;   // 1–30
  addedAt: string;  // ISO-8601
}

/** Return today's Hebrew {month, day} using Intl API. */
export function todayHebrewMD(now: Date = new Date()): { month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("he-u-ca-hebrew", { month: "numeric", day: "numeric" });
  const parts = fmt.formatToParts(now);
  const month = parseInt(parts.find((p) => p.type === "month")?.value ?? "1", 10);
  const day = parseInt(parts.find((p) => p.type === "day")?.value ?? "1", 10);
  return { month: isNaN(month) ? 1 : month, day: isNaN(day) ? 1 : day };
}

/** Persist a new yahrzeit (max 20 entries). */
export async function addYahrzeit(
  name: string,
  hebrewMonth: number,
  hebrewDay: number,
): Promise<YahrzeitEntry> {
  const existing = await getYahrzeits();
  const id = `yz-${hebrewMonth}-${hebrewDay}-${name.trim().toLowerCase().replace(/\s+/g, "-")}`;
  const entry: YahrzeitEntry = {
    id,
    name: name.trim(),
    hebrewMonth,
    hebrewDay,
    addedAt: new Date().toISOString(),
  };
  const updated = [entry, ...existing.filter((e) => e.id !== id)].slice(0, YZ_MAX);
  await idbSet<YahrzeitEntry[]>(IDB_HC_DB, IDB_YZ_STORE, "__list__", updated);
  return entry;
}

/** Remove a yahrzeit by id. */
export async function removeYahrzeit(id: string): Promise<void> {
  const existing = await getYahrzeits();
  const updated = existing.filter((e) => e.id !== id);
  await idbSet<YahrzeitEntry[]>(IDB_HC_DB, IDB_YZ_STORE, "__list__", updated);
  await idbDelete(IDB_HC_DB, IDB_YZ_STORE, id);
}

/** Return all stored yahrzeits. */
export async function getYahrzeits(): Promise<YahrzeitEntry[]> {
  const raw = await idbGet<YahrzeitEntry[]>(IDB_HC_DB, IDB_YZ_STORE, "__list__");
  return Array.isArray(raw) ? raw : [];
}

/**
 * Return yahrzeits whose Hebrew date falls within `days` days from today
 * (using a simple month+day window — month rollover is not handled).
 */
export async function getUpcomingYahrzeits(
  days = 7,
  now: Date = new Date(),
): Promise<YahrzeitEntry[]> {
  const all = await getYahrzeits();
  const today = todayHebrewMD(now);
  return all.filter((yz) => {
    const monthDiff = yz.hebrewMonth - today.month;
    const dayDiff =
      monthDiff === 0 ? yz.hebrewDay - today.day : monthDiff === 1 ? 30 - today.day + yz.hebrewDay : -1;
    return dayDiff >= 0 && dayDiff < days;
  });
}

// ── Sprint 140: configSchema ────────────────────────────────────────────────

export const hebrewCalConfigSchema: CardConfigField[] = [
  {
    key: "geonameid",
    labelHe: "מיקום (GeoName ID)",
    labelEn: "Location (GeoName ID)",
    type: "text",
    defaultValue: "281184",
    group: "מיקום",
    groupOpenByDefault: true,
  },
];
