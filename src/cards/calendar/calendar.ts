/**
 * FamilyDashBoard v7 — Google Calendar ICS Card
 *
 * Fetches up to 3 Google Calendar ICS feeds, parses VEVENT blocks,
 * and renders a 21-day agenda with day headers, category dots, and
 * a 7-day week-strip density bar.
 * Refresh: INTERVALS.CALENDAR (15 minutes).
 */

import { scheduleCard } from "../base-card";
import "./calendar.css";
import {
  INTERVALS,
  PROXIES,
  LS_ICS_URL,
  MS_PER_DAY,
  MS_PER_MIN,
} from "../../core/constants";
import { cGet, cGetStale, cSet } from "../../core/cache";
import { fetchWithTimeout } from "../../core/fetch";
import {
  setSync,
  syncBurst,
  recordSuccess,
  recordFailure,
} from "../../core/sync";
import { diagLog } from "../../core/diag";
import { acquireLock, releaseLock } from "../../core/fetch";
import type { CalendarEvent } from "../../types/api";
import type { CardConfigField } from "../../types/card";

// ── Constants ──
const CAL_DAYS_AHEAD = 21;
const CAL_DIRECT_TIMEOUT = 10_000;
const CAL_PROXY_TIMEOUT = 12_000;

// Default ICS URL (set at build time; users override via Settings)
const CAL_ICS_DEFAULT =
  "https://calendar.google.com/calendar/ical/rajwan.family%40gmail.com/public/basic.ics";

// ── DOM cache ──
interface CalEls {
  agenda: HTMLElement | null;
  todayStrip: HTMLElement | null;
  countdown: HTMLElement | null;
  weekStrip: HTMLElement | null;
}

let els: CalEls = {
  agenda: null,
  todayStrip: null,
  countdown: null,
  weekStrip: null,
};

export function cacheDom(): void {
  els = {
    agenda: document.getElementById("cal-agenda"),
    todayStrip: document.getElementById("cal-today-strip"),
    countdown: document.getElementById("cal-countdown"),
    weekStrip: document.getElementById("cal-week-strip"),
  };
}

// ── ICS Parsing ──

function parseICSDate(raw: string): Date | null {
  if (!raw) return null;
  if (raw.length === 8) {
    // All-day: YYYYMMDD
    return new Date(
      `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`,
    );
  }
  const s = raw.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
    "$1-$2-$3T$4:$5:$6" + (raw.endsWith("Z") ? "Z" : ""),
  );
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function unescapeICS(str: string | null | undefined, sep = " "): string {
  return (str ?? "")
    .replace(/\\,/g, ",")
    .replace(/\\n/g, sep)
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function parseICS(text: string, icsIndex = 0): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = text.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]!;
    const unfolded = block.replace(/\r?\n[ \t]/g, "");
    const get = (key: string): string | null => {
      const m = unfolded.match(
        new RegExp("(?:^|\n)" + key + "(?:;[^:]*)?:([^\r\n]+)", "i"),
      );
      return m ? m[1]!.trim() : null;
    };
    const dtRaw = get("DTSTART") ?? "";
    const summaryRaw = get("SUMMARY");
    if (!dtRaw || !summaryRaw) continue;
    const start = parseICSDate(dtRaw);
    if (!start) continue;
    const allDay = dtRaw.length === 8;
    const endRaw = get("DTEND");
    const end = endRaw ? (parseICSDate(endRaw) ?? start) : start;
    const summary = unescapeICS(summaryRaw);
    const location = unescapeICS(get("LOCATION"), ", ");
    const description = unescapeICS(get("DESCRIPTION"), "\n");
    events.push({
      summary,
      start,
      end,
      allDay,
      location: location || undefined,
      description: description || undefined,
      icsIndex,
      category: detectCalCategory(summary),
    });
  }
  return events;
}

// ── Category Detection ──
export function detectCalCategory(summary: string): string {
  const s = summary.toLowerCase();
  if (
    /work|עבודה|meeting|פגישה|office|משרד|zoom|ועדה|ישיבה|הרצאה|תכנון|פרויקט/.test(
      s,
    )
  )
    return "work";
  if (
    /family|משפחה|ילדים|בית|הורים|dinner|ארוחה|אמא|אבא|סבא|סבתא|אחים|חתונה|ברית|בר.מצוה/.test(
      s,
    )
  )
    return "family";
  if (
    /doctor|רופא|רופאה|קופת|medical|בריאות|hospital|clinic|ניתוח|טיפול|שיניים|תרופות/.test(
      s,
    )
  )
    return "health";
  if (
    /חג|holiday|shabbat|שבת|omer|passover|pesach|sukk|chanuk|purim|rosh|yom.kip|שמחה|חנוכה|פורים|פסח|סוכות|שבועות/i.test(
      s,
    )
  )
    return "holiday";
  return "default";
}

/**
 * Sprint 25: Return a short Hebrew label for how many days until `date`.
 * Returns "" when `date` is today, "מחר" for tomorrow, "עוד N ימים" otherwise.
 * Returns "" for past dates (should not appear in agenda, but defensive).
 */
export function calDaysUntilLabel(date: Date, now: Date = new Date()): string {
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (dateMidnight.getTime() - todayMidnight.getTime()) / MS_PER_DAY,
  );
  if (diffDays <= 0) return "";
  if (diffDays === 1) return "מחר";
  return `עוד ${diffDays} ימים`;
}

// ── Rendering ──

function renderCalEvent(ev: CalendarEvent, isConflict: boolean): HTMLElement {
  const now = Date.now();
  const msTilStart = ev.start.getTime() - now;
  const isSoon =
    !ev.allDay && msTilStart > 0 && msTilStart < 60 * 60 * 1000;

  const row = document.createElement("div");
  row.className =
    "cal-event" +
    (isConflict ? " has-conflict" : "") +
    (isSoon ? " event-soon" : "");
  if (ev.icsIndex) row.dataset["ics"] = String(ev.icsIndex);

  const timeEl = document.createElement("div");
  timeEl.className = "cal-event-time";
  if (ev.allDay) {
    timeEl.textContent = "כל היום";
  } else {
    const startStr = ev.start.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
    const durMin = Math.round(
      (ev.end.getTime() - ev.start.getTime()) / MS_PER_MIN,
    );
    if (durMin > 0 && ev.end > ev.start) {
      const endStr = ev.end.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jerusalem",
      });
      const durStr =
        durMin >= 60
          ? `${Math.floor(durMin / 60)}:${String(durMin % 60).padStart(2, "0")}h`
          : `${durMin}m`;
      timeEl.textContent = `${startStr}–${endStr} (${durStr})`;
    } else {
      timeEl.textContent = startStr;
    }
  }

  const titleEl = document.createElement("div");
  titleEl.style.flex = "1";

  const catRow = document.createElement("div");
  catRow.style.cssText = "display:flex;align-items:flex-start;gap:2px";

  const dot = document.createElement("span");
  dot.className = `cal-dot cal-dot-${ev.category ?? "default"}`;
  catRow.appendChild(dot);

  const titleLine = document.createElement("div");
  titleLine.className = "cal-event-title";
  titleLine.textContent = ev.summary;
  catRow.appendChild(titleLine);
  titleEl.appendChild(catRow);

  if (ev.location) {
    const locEl = document.createElement("div");
    locEl.className = "cal-event-loc";
    locEl.textContent = "📍 " + ev.location;
    titleEl.appendChild(locEl);
  }

  row.appendChild(timeEl);
  row.appendChild(titleEl);
  return row;
}

function renderCalCountdown(upcoming: CalendarEvent[], now: Date): void {
  if (!els.countdown) return;
  const next7 = upcoming.filter(
    (e) => e.start > now && e.start.getTime() - now.getTime() < 7 * MS_PER_DAY,
  );
  const ev = next7[0];
  if (!ev) {
    els.countdown.style.display = "none";
    return;
  }
  const days = Math.ceil((ev.start.getTime() - now.getTime()) / MS_PER_DAY);
  const label = days <= 0 ? "היום" : days === 1 ? "מחר" : `עוד ${days} ימים`;
  els.countdown.textContent = `${label}: ${ev.summary.substring(0, 20)}`;
  els.countdown.style.display = "";
}

function renderTodayStrip(events: CalendarEvent[]): void {
  if (!els.todayStrip) return;
  const now = new Date();
  const endOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const todayEvents = events
    .filter((e) => !e.allDay && e.start >= now && e.start < endOfDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 5);

  els.todayStrip.textContent = "";
  for (const ev of todayEvents) {
    const pill = document.createElement("span");
    pill.className = "cal-strip-event";
    const t = ev.start.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    });
    pill.textContent = `${t} ${ev.summary}`;
    if (ev.icsIndex) pill.dataset["ics"] = String(ev.icsIndex);
    els.todayStrip.appendChild(pill);
  }
}

const CAL_WEEK_DAY_HE = ["ש", "א", "ב", "ג", "ד", "ה", "ו"];

function renderWeekStrip(events: CalendarEvent[]): void {
  if (!els.weekStrip) return;
  const now = new Date();
  const rows: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + i);
    const key = day.toDateString();
    const count = events.filter(
      (ev) => ev.start?.toDateString() === key,
    ).length;
    const isToday = i === 0;
    const dots = Array.from({ length: Math.min(count, 4) }, (_, j) => {
      const color =
        j === 0
          ? "var(--accent)"
          : j === 1
            ? "var(--positive)"
            : j === 2
              ? "var(--warning)"
              : "#94a3b8";
      return `<div class="cal-week-dot" style="background:${color}"></div>`;
    }).join("");
    const heat =
      count >= 4
        ? " heat-3"
        : count >= 2
          ? " heat-2"
          : count >= 1
            ? " heat-1"
            : "";
    rows.push(
      `<div class="cal-week-day${isToday ? " cal-week-today" : ""}${heat}">` +
        `<div class="cal-week-label">${CAL_WEEK_DAY_HE[day.getDay()]!}</div>` +
        `<div class="cal-week-dots">${dots}</div></div>`,
    );
  }
  els.weekStrip.innerHTML = rows.join("");
}

function updateTodayEventCount(events: CalendarEvent[]): void {
  const hdrEl = document.getElementById("header-event-count");
  if (!hdrEl) return;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayMidnight.getTime() + MS_PER_DAY);
  const count = events.filter(
    (e) => e.start >= todayMidnight && e.start < todayEnd,
  ).length;
  hdrEl.textContent = count > 0 ? `${count} 📅` : "";
  hdrEl.style.display = count > 0 ? "" : "none";
}

export function renderCalendar(events: CalendarEvent[]): number {
  renderWeekStrip(events);
  renderTodayStrip(events);

  const now = new Date();
  const cutoff = new Date(now.getTime() + CAL_DAYS_AHEAD * MS_PER_DAY);
  const todayMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const upcoming = events
    .filter((e) => e.start >= todayMidnight && e.start <= cutoff)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Detect overlapping timed events
  const conflictSet = new Set<CalendarEvent>();
  const timed = upcoming.filter((e) => !e.allDay && e.end > e.start);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timed[j]!.start >= timed[i]!.end) break;
      conflictSet.add(timed[i]!);
      conflictSet.add(timed[j]!);
    }
  }

  const frag = document.createDocumentFragment();
  if (!upcoming.length) {
    const empty = document.createElement("div");
    empty.className = "cal-empty";
    empty.textContent = `אין אירועים ב-${CAL_DAYS_AHEAD} הימים הקרובים`;
    frag.appendChild(empty);
  } else {
    let lastDateKey: string | null = null;
    const todayKey = now.toDateString();
    for (const ev of upcoming) {
      const dateKey = ev.start.toDateString();
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        const hdr = document.createElement("div");
        hdr.className =
          "cal-day-header" + (dateKey === todayKey ? " today" : "");
        const dayHe = ev.start.toLocaleDateString("he-IL", {
          weekday: "long",
          timeZone: "Asia/Jerusalem",
        });
        const dateFmt = ev.start.toLocaleDateString("he-IL", {
          day: "2-digit",
          month: "long",
          timeZone: "Asia/Jerusalem",
        });
        const daysUntil = calDaysUntilLabel(ev.start, now);
        hdr.textContent = daysUntil
          ? `${dayHe} · ${dateFmt} · ${daysUntil}`
          : `${dayHe} · ${dateFmt}`;
        frag.appendChild(hdr);
      }
      frag.appendChild(renderCalEvent(ev, conflictSet.has(ev)));
    }
  }

  if (els.agenda) {
    els.agenda.textContent = "";
    els.agenda.appendChild(frag);
  }

  renderCalCountdown(upcoming, now);
  updateTodayEventCount(events);
  return upcoming.length;
}

// ── ICS Fetch ──

function getICSUrls(): string[] {
  const primary = localStorage.getItem(LS_ICS_URL) ?? CAL_ICS_DEFAULT;
  const urls = [primary];
  for (let i = 2; i <= 3; i++) {
    const extra = localStorage.getItem(`${LS_ICS_URL}_${i}`);
    if (extra) urls.push(extra);
  }
  return urls;
}

async function fetchICS(url: string): Promise<string | null> {
  // 1. Direct fetch
  try {
    const r = await fetchWithTimeout(url, CAL_DIRECT_TIMEOUT);
    if (r.ok) {
      const text = await r.text();
      if (text.includes("BEGIN:VCALENDAR")) {
        diagLog(`FDB-023: [calendar] direct OK (${text.length} bytes)`);
        return text;
      }
    }
  } catch (e) {
    diagLog(`FDB-024: [calendar] direct ERR: ${String(e)}`);
  }

  // 2. CORS proxy chain
  for (const proxy of PROXIES) {
    const proxied = proxy + encodeURIComponent(url);
    try {
      const r = await fetchWithTimeout(proxied, CAL_PROXY_TIMEOUT);
      if (!r.ok) continue;
      let text: string;
      if (proxy.includes("allorigins")) {
        const json = (await r.json()) as { contents?: string };
        text = json.contents ?? "";
      } else {
        text = await r.text();
      }
      if (text.includes("BEGIN:VCALENDAR")) {
        diagLog(`FDB-025: [calendar] proxy ${proxy} OK`);
        return text;
      }
    } catch (e) {
      diagLog(`FDB-026: [calendar] proxy ${proxy} ERR: ${String(e)}`);
    }
  }

  diagLog(`FDB-027: [calendar] all sources failed for ${url}`);
  return null;
}

// ── Main Loader ──
async function loadCalendar(): Promise<void> {
  if (document.hidden) return;
  if (!acquireLock("cal")) return;
  setSync("cal", "loading");

  const urls = getICSUrls();
  const key0 = "cal-ics";

  // Serve from fresh cache first
  const fresh = cGet<string>(key0, INTERVALS.CALENDAR);
  if (fresh) {
    const events = [...parseICS(fresh, 0), ...loadExtraEventsFromCache(urls)];
    renderCalendar(events);
    setSync("cal", "ok");
    releaseLock("cal");
    return;
  }

  // Use stale while revalidating
  const staleText = cGetStale<string>(key0);
  if (staleText) {
    const events = [
      ...parseICS(staleText, 0),
      ...loadExtraEventsFromCache(urls),
    ];
    renderCalendar(events);
  }

  try {
    // Fetch all ICS feeds in parallel
    const results = await Promise.allSettled(
      urls.map((url, idx) => fetchICSWithCache(url, idx)),
    );
    const allEvents: CalendarEvent[] = [];
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) allEvents.push(...r.value);
    }
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    if (allEvents.length > 0) {
      renderCalendar(allEvents);
      setSync("cal", "ok");
      syncBurst("cal");
      recordSuccess("cal");
    } else {
      setSync("cal", "error");
      recordFailure("cal");
    }
  } catch (err) {
    diagLog(`FDB-028: [calendar] loadCalendar error: ${String(err)}`);
    setSync("cal", "error");
    recordFailure("cal");
  } finally {
    releaseLock("cal");
  }
}

function loadExtraEventsFromCache(urls: string[]): CalendarEvent[] {
  const extra: CalendarEvent[] = [];
  for (let i = 1; i < urls.length; i++) {
    const stale = cGetStale<string>(`cal-ics-${i}`);
    if (stale) extra.push(...parseICS(stale, i));
  }
  return extra;
}

async function fetchICSWithCache(
  url: string,
  idx: number,
): Promise<CalendarEvent[]> {
  const key = idx === 0 ? "cal-ics" : `cal-ics-${idx}`;
  const text = await fetchICS(url);
  if (!text) return [];
  cSet(key, text);
  return parseICS(text, idx);
}

export function initCalendarCard(): void {
  cacheDom();
  void loadCalendar();
  scheduleCard(loadCalendar, INTERVALS.CALENDAR);
  diagLog("FDB-029: [calendar] Initialized");
}

// ── Sprint 139: configSchema ────────────────────────────────────────────────

export const calendarConfigSchema: CardConfigField[] = [
  {
    key: "calendarDaysAhead",
    labelHe: "ימים קדימה",
    labelEn: "Days ahead",
    type: "range",
    defaultValue: 21,
    min: 7,
    max: 60,
    step: 7,
    group: "תצוגה",
    groupOpenByDefault: true,
  },
];
