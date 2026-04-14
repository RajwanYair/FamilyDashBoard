/**
 * FamilyDashBoard v6 — Hebrew Calendar Card
 *
 * Fetches candles/havdalah, next holiday, omer count, parasha, and Daf Yomi
 * from the Hebcal API. Also renders a daily motivation saying (from MOTIVATIONS).
 * Refresh: INTERVALS.SHABBAT (6 hours).
 */

import { scheduleCard } from "../base-card";
import "./hebrew-cal.css";
import { INTERVALS, API } from "../../core/constants";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { fetchJSONWithWorker } from "../../core/fetch";
import {
  setSync,
  syncBurst,
  recordSuccess,
  recordFailure,
} from "../../core/sync";
import { diagLog } from "../../core/diag";
import { loadConfig } from "../../core/config";
import { getTasksForToday } from "../tasks/tasks";
import type { HebcalResponse, HebcalItem } from "../../types/api";

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

// ── Candles + Havdalah ──
async function loadCandlesHavdala(): Promise<void> {
  const geonameid = getGeonameid();
  const key = `shabbat-${new Date().toDateString()}`;
  const fresh = cGet<HebcalResponse>(key, INTERVALS.HEBREW_CAL);
  if (fresh) {
    renderCandlesHavdala(fresh.items);
    return;
  }
  const stale = cGetStale<HebcalResponse>(key);
  if (stale) renderCandlesHavdala(stale.items);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}/shabbat?cfg=json&geonameid=${geonameid}&M=on`,
  );
  if (d.items) {
    cSet(key, d);
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
}

// ── Next Holiday ──
async function loadHoliday(): Promise<void> {
  const now = new Date();
  const key = `holidays-${now.getFullYear()}-${now.getMonth()}`;
  const fresh = cGet<HebcalResponse>(key, 12 * 60 * 60_000); // 12h TTL
  const items = fresh?.items;
  if (items) {
    renderHoliday(items, now);
    return;
  }
  const stale = cGetStale<HebcalResponse>(key);
  if (stale?.items) renderHoliday(stale.items, now);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}?v=1&cfg=json&maj=on&min=on&year=${now.getFullYear()}&month=x`,
  );
  if (d.items) {
    cSet(key, d);
    renderHoliday(d.items, now);
  }
}

function renderHoliday(items: HebcalItem[], now: Date): void {
  const upcoming = items
    .filter((i) => i.category === "holiday" && new Date(i.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const h = upcoming[0];
  if (!h || !els.holiday) return;
  const days = Math.ceil(
    (new Date(h.date).getTime() - now.getTime()) / 86_400_000,
  );
  const name = h.hebrew ?? h.title;
  _lastHolidayName = name;
  els.holiday.textContent =
    days <= 0
      ? name
      : days === 1
        ? `מחר: ${name}`
        : `${name} — בעוד ${days} ימים`;
  if (els.holidayRow) els.holidayRow.style.display = "";
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
  const omerDate = afterSunset ? new Date(now.getTime() + 86_400_000) : now;
  const yr = omerDate.getFullYear();
  const mo = omerDate.getMonth() + 1;
  const dy = omerDate.getDate();
  const key = `omer-${yr}-${mo}-${dy}`;

  const fresh = cGet<HebcalItem>(key, 86_400_000);
  if (fresh !== null) {
    renderOmer(fresh);
    return;
  }
  const stale = cGetStale<HebcalItem>(key);
  if (stale !== null) renderOmer(stale);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}?v=1&cfg=json&omer=on&maj=off&min=off&ss=off&mf=off&year=${yr}&month=${mo}&day=${dy}`,
  );
  const item = d.items?.find((i) => i.category === "omer") ?? null;
  // Only cache positive omer results — never cache null, so a failed/off-season
  // fetch doesn't permanently suppress the row until the key expires.
  if (item !== null) cSet(key, item);
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
      els.special.textContent = deduped
        .map((i) => `✡️ ${i.hebrew ?? i.title}`)
        .join("  ·  ");
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
  const fresh = cGet<HebcalResponse>(key, 24 * 60 * 60_000);
  if (fresh?.items) {
    renderParasha(fresh.items);
    return;
  }
  const stale = cGetStale<HebcalResponse>(key);
  if (stale?.items) renderParasha(stale.items);

  const d = await fetchJSONWithWorker<HebcalResponse>(
    `${API.HEBCAL}/shabbat?cfg=json&geonameid=${geonameid}&M=on&ss=on`,
  );
  if (d.items) {
    cSet(key, d);
    renderParasha(d.items);
  }
}

function renderParasha(items: HebcalItem[]): void {
  const p = items.find((i) => i.category === "parashat");
  if (!p || !els.parasha) return;
  els.parasha.textContent = p.hebrew ?? p.title;
  if (els.parashaRow) els.parashaRow.style.display = "";
}

// ── Daf Yomi ──
async function loadDafYomi(): Promise<void> {
  const now = new Date();
  const key = `daf-${now.toDateString()}`;
  const fresh = cGet<{ ref: string; heRef: string }>(
    key,
    24 * 60 * 60_000,
  );
  if (fresh !== null) {
    renderDaf(fresh);
    return;
  }
  const stale = cGetStale<{ ref: string; heRef: string }>(key);
  if (stale !== null) renderDaf(stale);

  try {
    const d = await fetchJSONWithWorker<{
      calendar_items: Array<{ title: { he: string; en: string }; ref: string }>;
    }>(API.SEFARIA_CALENDAR);
    const daf = d.calendar_items?.find((i) =>
      i.title?.en?.toLowerCase().includes("daf yomi"),
    );
    const item = daf ? { ref: daf.ref, heRef: daf.title.he } : null;
    cSet(key, item);
    renderDaf(item);
  } catch {
    diagLog("[hebrew-cal] Daf Yomi fetch failed");
  }
}

function renderDaf(item: { ref: string; heRef: string } | null): void {
  if (!els.daf) return;
  if (!item) {
    if (els.dafRow) els.dafRow.style.display = "none";
    return;
  }
  els.daf.textContent = item.heRef ?? item.ref;
  if (els.dafRow) els.dafRow.style.display = "";
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
          n === _lastHolidayName ||
          n.includes(_lastHolidayName) ||
          _lastHolidayName.includes(n),
      )
    ) {
      if (els.specialRow) els.specialRow.style.display = "none";
    }
    // Re-evaluate event row now that holiday/special names are known
    renderNextCalEvent();
    diagLog("[hebrew-cal] Load complete");
  } catch (err) {
    diagLog(`[hebrew-cal] Error: ${String(err)}`);
    setSync("hebcal", "error");
    recordFailure("hebcal");
  }
}

// ── Moon phase ──

/**
 * Compute the lunar phase for the given date using synodic month math.
 * Returns an emoji + Hebrew label.
 */
export function computeMoonPhase(date: Date): { emoji: string; label: string } {
  const SYNODIC = 29.530588853;
  const REF = new Date("2000-01-06T18:14:00Z").getTime();
  const elapsed = (date.getTime() - REF) / 86_400_000;
  const phase = ((elapsed % SYNODIC) + SYNODIC) % SYNODIC;
  const frac = phase / SYNODIC;
  if (frac < 0.0625) return { emoji: "🌑", label: "ירח חדש" };
  if (frac < 0.1875) return { emoji: "🌒", label: "ירח גדל" };
  if (frac < 0.3125) return { emoji: "🌓", label: "רבע ראשון" };
  if (frac < 0.4375) return { emoji: "🌔", label: "ירח כמעט מלא" };
  if (frac < 0.5625) return { emoji: "🌕", label: "ירח מלא" };
  if (frac < 0.6875) return { emoji: "🌖", label: "ירח פוחת" };
  if (frac < 0.8125) return { emoji: "🌗", label: "רבע אחרון" };
  if (frac < 0.9375) return { emoji: "🌘", label: "ירח דועך" };
  return { emoji: "🌑", label: "ירח חדש" };
}

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
  const section =
    els.zmanimSection ?? document.getElementById("zmanim-section");
  if (!grid || !section) return;
  const frag = document.createDocumentFragment();
  for (const [key, label] of ZMANIM_DISPLAY) {
    const raw = times[key];
    if (!raw) continue;
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
  }
  grid.innerHTML = "";
  grid.appendChild(frag);
  section.style.display = "";
  // Equalize all cell widths to the widest cell so all blocks are uniform.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      const cells = Array.from(
        grid.querySelectorAll<HTMLElement>(".zman-item"),
      );
      const maxW = cells.reduce(
        (m, el) => Math.max(m, el.getBoundingClientRect().width),
        0,
      );
      if (maxW > 0) {
        grid.style.gridTemplateColumns = `repeat(3, ${Math.ceil(maxW)}px)`;
      }
    });
  }
}

async function loadZmanim(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `zmanim-${today}`;
  const fresh = cGet<ZmanimResponse>(key, 12 * 60 * 60_000);
  if (fresh) {
    renderZmanim(fresh.times);
    return;
  }
  const stale = cGetStale<ZmanimResponse>(key);
  if (stale) renderZmanim(stale.times);
  const geonameid = getGeonameid();
  const url = `${API.ZMANIM}?cfg=json&geonameid=${geonameid}&date=${today}&tzid=Asia%2FJerusalem`;
  try {
    const data = await fetchJSONWithWorker<ZmanimResponse>(url);
    if (data?.times) {
      cSet(key, data);
      renderZmanim(data.times);
    }
  } catch {
    diagLog("[hebrew-cal] Zmanim fetch failed");
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
    const summary = (sumMatch[1] ?? "")
      .replace(/\\,/g, ",")
      .replace(/\\n/g, " ")
      .trim();
    const raw = dtMatch[1] ?? "";
    if (!raw) continue;
    let d: Date;
    if (raw.length === 8) {
      d = new Date(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`,
      );
    } else {
      d = new Date(
        raw.replace(
          /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
          "$1-$2-$3T$4:$5:$6$7",
        ),
      );
    }
    if (!isNaN(d.getTime()) && d.getTime() > now)
      events.push({ summary, start: d });
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
      (summary.includes(_lastHolidayName) ||
        _lastHolidayName.includes(summary))) ||
    _lastSpecialNames.some((s) => summary.includes(s) || s.includes(summary));
  if (isDuplicate) {
    eventRow.style.display = "none";
    return;
  }
  const daysUntil = Math.ceil((next.start.getTime() - now) / 86_400_000);
  const when =
    daysUntil <= 0 ? "היום" : daysUntil === 1 ? "מחר" : `בעוד ${daysUntil} ימ׳`;
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
  cacheDom();
  renderMoonPhase();
  renderNextCalEvent();
  renderPsalmOfDay();
  renderTasksStrip();
  void loadHebCal();
  scheduleCard(loadHebCal, INTERVALS.HEBREW_CAL);
  diagLog("[hebrew-cal] Initialized");
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
