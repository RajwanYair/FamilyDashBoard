/**
 * FamilyDashBoard v7 — Google Calendar ICS Card
 *
 * Fetches up to 3 Google Calendar ICS feeds, parses VEVENT blocks,
 * and renders a 7-day weekly tiled grid — one tile per day, each tile lists
 * that day's events (or a muted placeholder when empty).
 * Refresh: INTERVALS.CALENDAR (15 minutes).
 */

import { scheduleCard } from "../base-card";
import "./calendar.css";
import { INTERVALS, PROXIES, LS_ICS_URL, MS_PER_DAY, MS_PER_MIN, WORKER_BASE_URL, isWorkerEnabled } from "../../core/constants";
import { cGetStale, cGetAsync, cGetStaleAsync, cSetAsync } from "../../core/cache";
import { fetchWithTimeout } from "../../core/fetch";
import { setSync, syncBurst, recordSuccess, recordFailure } from "../../core/sync";
import { diagLog } from "../../core/diag";
import { acquireLock, releaseLock } from "../../core/fetch";
import type { CalendarEvent } from "../../types/api";
import type { CardConfigField } from "../../types/card";

// ── Constants ──
const CAL_WEEK_DAYS = 7;
const CAL_DIRECT_TIMEOUT = 10_000;
const CAL_PROXY_TIMEOUT = 12_000;
const CAL_WEEK_DAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const CAL_WEEK_DAY_SHORT_HE = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

// Default ICS URL (set at build time; users override via Settings)
const CAL_ICS_DEFAULT =
  "https://calendar.google.com/calendar/ical/rajwan.family%40gmail.com/public/basic.ics";

// ── DOM cache ──
interface CalEls {
  grid: HTMLElement | null;
  countdown: HTMLElement | null;
}

let els: CalEls = {
  grid: null,
  countdown: null,
};

export function cacheDom(): void {
  els = {
    grid: document.getElementById("cal-week-grid"),
    countdown: document.getElementById("cal-countdown"),
  };
}

// ── ICS Parsing ──

function parseICSDate(raw: string): Date | null {
  if (!raw) return null;
  if (raw.length === 8) {
    // All-day: YYYYMMDD
    return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`);
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
      const m = unfolded.match(new RegExp("(?:^|\n)" + key + "(?:;[^:]*)?:([^\r\n]+)", "i"));
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
  if (/work|עבודה|meeting|פגישה|office|משרד|zoom|ועדה|ישיבה|הרצאה|תכנון|פרויקט/.test(s))
    return "work";
  if (/family|משפחה|ילדים|בית|הורים|dinner|ארוחה|אמא|אבא|סבא|סבתא|אחים|חתונה|ברית|בר.מצוה/.test(s))
    return "family";
  if (/doctor|רופא|רופאה|קופת|medical|בריאות|hospital|clinic|ניתוח|טיפול|שיניים|תרופות/.test(s))
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
  const diffDays = Math.round((dateMidnight.getTime() - todayMidnight.getTime()) / MS_PER_DAY);
  if (diffDays <= 0) return "";
  if (diffDays === 1) return "מחר";
  return `עוד ${diffDays} ימים`;
}

// ── Rendering ──

/** Format an event time range (or "כל היום" for all-day, or single time for zero-duration). */
function formatEventTime(ev: CalendarEvent): string {
  if (ev.allDay) return "כל היום";
  const startStr = ev.start.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
  const durMin = Math.round((ev.end.getTime() - ev.start.getTime()) / MS_PER_MIN);
  if (durMin > 0 && ev.end > ev.start) {
    const endStr = ev.end.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });
    return `${startStr}–${endStr}`;
  }
  return startStr;
}

/** Build the event row element inside a day tile. */
function renderCalEvent(ev: CalendarEvent, isConflict: boolean): HTMLElement {
  const now = Date.now();
  const msTilStart = ev.start.getTime() - now;
  const isSoon = !ev.allDay && msTilStart > 0 && msTilStart < 60 * 60 * 1000;

  const row = document.createElement("div");
  row.className = "cal-event" + (isConflict ? " has-conflict" : "") + (isSoon ? " event-soon" : "");
  if (ev.icsIndex) row.dataset["ics"] = String(ev.icsIndex);

  const timeEl = document.createElement("div");
  timeEl.className = "cal-event-time";
  timeEl.textContent = formatEventTime(ev);

  const titleEl = document.createElement("div");
  titleEl.className = "cal-event-body";

  const dot = document.createElement("span");
  dot.className = `cal-dot cal-dot-${ev.category ?? "default"}`;
  titleEl.appendChild(dot);

  const titleLine = document.createElement("span");
  titleLine.className = "cal-event-title";
  titleLine.textContent = ev.summary;
  titleEl.appendChild(titleLine);

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

function updateTodayEventCount(events: CalendarEvent[]): void {
  const hdrEl = document.getElementById("header-event-count");
  if (!hdrEl) return;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayMidnight.getTime() + MS_PER_DAY);
  const count = events.filter((e) => e.start >= todayMidnight && e.start < todayEnd).length;
  hdrEl.textContent = count > 0 ? `${count} 📅` : "";
  hdrEl.style.display = count > 0 ? "" : "none";
}

/**
 * Group events by local-date key and return an array of CAL_WEEK_DAYS buckets
 * starting from today midnight. Each bucket is sorted earliest-first.
 */
export function groupEventsByDay(
  events: readonly CalendarEvent[],
  now: Date = new Date(),
): { date: Date; events: CalendarEvent[] }[] {
  const buckets: { date: Date; events: CalendarEvent[] }[] = [];
  for (let i = 0; i < CAL_WEEK_DAYS; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    buckets.push({ date: day, events: [] });
  }
  const firstKey = buckets[0]!.date.getTime();
  const lastKey = buckets[CAL_WEEK_DAYS - 1]!.date.getTime() + MS_PER_DAY;
  for (const ev of events) {
    const t = ev.start.getTime();
    if (t < firstKey || t >= lastKey) continue;
    const diffDays = Math.floor((t - firstKey) / MS_PER_DAY);
    const bucket = buckets[diffDays];
    if (bucket) bucket.events.push(ev);
  }
  for (const b of buckets) {
    b.events.sort((a, b2) => a.start.getTime() - b2.start.getTime());
  }
  return buckets;
}

/** Build a single day tile element. */
function renderDayTile(
  date: Date,
  dayEvents: CalendarEvent[],
  conflictSet: Set<CalendarEvent>,
  isToday: boolean,
): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "cal-day-tile" + (isToday ? " is-today" : "");
  if (dayEvents.length === 0) tile.classList.add("is-empty");

  const hdr = document.createElement("div");
  hdr.className = "cal-day-tile-hdr";

  const dayName = document.createElement("span");
  dayName.className = "cal-day-name";
  dayName.textContent = isToday ? "היום" : (CAL_WEEK_DAY_HE[date.getDay()] ?? CAL_WEEK_DAY_SHORT_HE[date.getDay()] ?? "");
  hdr.appendChild(dayName);

  const dateLbl = document.createElement("span");
  dateLbl.className = "cal-day-date";
  dateLbl.textContent = date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
  hdr.appendChild(dateLbl);

  if (dayEvents.length > 0) {
    const countBadge = document.createElement("span");
    countBadge.className = "cal-day-count";
    countBadge.textContent = String(dayEvents.length);
    hdr.appendChild(countBadge);
  }
  tile.appendChild(hdr);

  const body = document.createElement("div");
  body.className = "cal-day-tile-body";

  if (dayEvents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cal-day-empty";
    empty.textContent = "—";
    body.appendChild(empty);
  } else {
    for (const ev of dayEvents) {
      body.appendChild(renderCalEvent(ev, conflictSet.has(ev)));
    }
  }
  tile.appendChild(body);

  return tile;
}

export function renderCalendar(events: CalendarEvent[]): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Week window: always Sunday → Saturday of the current week
  const dayOfWeek = todayMidnight.getDay(); // 0 = Sunday
  const weekStart = new Date(todayMidnight.getTime() - dayOfWeek * MS_PER_DAY);
  const weekEnd = new Date(weekStart.getTime() + CAL_WEEK_DAYS * MS_PER_DAY);
  const upcoming = events
    .filter((e) => e.start >= weekStart && e.start < weekEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Detect overlapping timed events (for conflict indicator)
  const conflictSet = new Set<CalendarEvent>();
  const timed = upcoming.filter((e) => !e.allDay && e.end > e.start);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (timed[j]!.start >= timed[i]!.end) break;
      conflictSet.add(timed[i]!);
      conflictSet.add(timed[j]!);
    }
  }

  const buckets = groupEventsByDay(upcoming, weekStart);
  const todayKey = now.toDateString();

  if (els.grid) {
    els.grid.textContent = "";
    const frag = document.createDocumentFragment();
    for (const bucket of buckets) {
      const isToday = bucket.date.toDateString() === todayKey;
      frag.appendChild(renderDayTile(bucket.date, bucket.events, conflictSet, isToday));
    }
    els.grid.appendChild(frag);
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
  // 0. Cloudflare Worker — server-side ICS proxy, no CORS or network-proxy dependency
  if (isWorkerEnabled()) {
    const workerUrl = `${WORKER_BASE_URL}/api/calendar?url=${encodeURIComponent(url)}`;
    try {
      const r = await fetchWithTimeout(workerUrl, CAL_DIRECT_TIMEOUT);
      if (r.ok) {
        const text = await r.text();
        if (text.includes("BEGIN:VCALENDAR")) {
          diagLog(`FDB-022W: [calendar] worker OK (${text.length} bytes)`);
          return text;
        }
      }
    } catch (e) {
      diagLog(`FDB-022E: [calendar] worker ERR: ${String(e)}`);
    }
  }

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

  // Serve from fresh async cache first (memory → IDB → LS)
  const fresh = await cGetAsync<string>(key0, INTERVALS.CALENDAR);
  if (fresh !== null) {
    const events = [...parseICS(fresh, 0), ...loadExtraEventsFromCache(urls)];
    renderCalendar(events);
    setSync("cal", "ok");
    releaseLock("cal");
    return;
  }

  // Use stale while revalidating
  const staleText = await cGetStaleAsync<string>(key0);
  if (staleText !== null) {
    const events = [...parseICS(staleText, 0), ...loadExtraEventsFromCache(urls)];
    renderCalendar(events);
  }

  try {
    // Fetch all ICS feeds in parallel
    const results = await Promise.allSettled(urls.map((url, idx) => fetchICSWithCache(url, idx)));
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

async function fetchICSWithCache(url: string, idx: number): Promise<CalendarEvent[]> {
  const key = idx === 0 ? "cal-ics" : `cal-ics-${idx}`;
  const text = await fetchICS(url);
  if (!text) return [];
  await cSetAsync(key, text);
  return parseICS(text, idx);
}

let _calScheduleId: number | null = null;

export function initCalendarCard(): void {
  cacheDom();
  void loadCalendar();
  _calScheduleId = scheduleCard(loadCalendar, INTERVALS.CALENDAR);
  diagLog("FDB-029: [calendar] Initialized");
}

export function destroyCalendarCard(): void {
  if (_calScheduleId !== null) {
    clearInterval(_calScheduleId);
    _calScheduleId = null;
  }
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
