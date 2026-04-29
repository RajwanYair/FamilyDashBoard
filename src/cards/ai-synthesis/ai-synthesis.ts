/**
 * FamilyDashBoard — AI Synthesis Card (Sprint 202 / X9)
 *
 * Fetches a Hebrew daily synthesis tile from /api/ai/synthesis.
 * Cached 4 hours. Opt-in via `synthesisEnabled` config key.
 * Faith-safe: the worker prompt explicitly avoids political/divisive content.
 */

import "./ai-synthesis.css";
import { WORKER_BASE_URL } from "../../core/constants";
import { cGet, cSet, cGetStale } from "../../core/cache";
import { diagLog } from "../../core/diag";
import { loadConfig } from "../../core/config";
import { setSync } from "../../core/sync";
import type { CardConfigField } from "../../types/card";

// ── Constants ──────────────────────────────────────────────────────────────

const SYNTH_CACHE_KEY = "ai:synthesis";
const SYNTH_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const SYNTH_REFRESH_MS = SYNTH_CACHE_TTL;

// ── Config schema (opt-in toggle) ──────────────────────────────────────────

export const aiSynthesisConfigSchema: CardConfigField[] = [
  {
    key: "synthesisEnabled",
    labelHe: "הפעל תקציר AI יומי",
    labelEn: "Enable daily AI synthesis",
    type: "boolean",
    defaultValue: false,
    group: "כללי",
  },
];

// ── DOM refs ───────────────────────────────────────────────────────────────

let _elText: HTMLElement | null = null;
let _elMeta: HTMLElement | null = null;
let _scheduleId: number | null = null;

// ── Data shape from worker ─────────────────────────────────────────────────

interface SynthesisPayload {
  synthesis: string;
}

interface WorkerSynthesisResponse {
  ok: boolean;
  data?: SynthesisPayload;
  error?: string;
  source?: "cache" | "ai";
}

// ── Loader ─────────────────────────────────────────────────────────────────

let _pageVisible = true;

/**
 * Fetch the AI synthesis text from the worker.
 * Returns null when the worker is unavailable or AI is disabled.
 * Exported for unit testing.
 */
export async function fetchSynthesis(): Promise<string | null> {
  const url = `${WORKER_BASE_URL}/api/ai/synthesis`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      diagLog(`[ai-synthesis] Worker returned ${String(res.status)}`);
      return null;
    }
    const json = (await res.json()) as WorkerSynthesisResponse;
    if (!json.ok || !json.data?.synthesis) {
      diagLog(`[ai-synthesis] Worker error: ${json.error ?? "unknown"}`);
      return null;
    }
    return json.data.synthesis;
  } catch (err) {
    diagLog(`[ai-synthesis] Fetch failed: ${String(err)}`);
    return null;
  }
}

// ── Render helper ──────────────────────────────────────────────────────────

function renderSynthesis(text: string, source: "fresh" | "cached"): void {
  if (_elText) _elText.textContent = text;
  if (_elMeta) {
    const now = new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    _elMeta.textContent = source === "cached" ? `עודכן: ${now} (מטמון)` : `עודכן: ${now}`;
  }
}

function renderDisabled(): void {
  if (_elText) _elText.textContent = "תקציר AI כבוי — הפעל מתפריט ההגדרות";
  if (_elMeta) _elMeta.textContent = "";
}

function renderError(staleText: string | null): void {
  if (staleText) {
    renderSynthesis(staleText, "cached");
  } else {
    if (_elText) _elText.textContent = "שירות AI אינו זמין כרגע";
  }
}

// ── Card loader ────────────────────────────────────────────────────────────

async function loadAiSynthesisData(): Promise<void> {
  if (!_pageVisible) return;

  const cfg = loadConfig();
  if (!cfg.synthesisEnabled) {
    renderDisabled();
    setSync("ai-synthesis", "ok");
    return;
  }

  setSync("ai-synthesis", "loading");

  // Serve cached immediately while revalidating
  const cached = cGet<SynthesisPayload>(SYNTH_CACHE_KEY, SYNTH_CACHE_TTL);
  if (cached?.synthesis) {
    renderSynthesis(cached.synthesis, "cached");
    setSync("ai-synthesis", "ok");
    return;
  }

  // Attempt live fetch
  const text = await fetchSynthesis();
  if (text) {
    cSet(SYNTH_CACHE_KEY, { synthesis: text } satisfies SynthesisPayload);
    renderSynthesis(text, "fresh");
    setSync("ai-synthesis", "ok");
  } else {
    const stale = cGetStale<SynthesisPayload>(SYNTH_CACHE_KEY);
    renderError(stale?.synthesis ?? null);
    setSync("ai-synthesis", "error");
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initAiSynthesisCard(): void {
  _elText = document.getElementById("synth-text");
  _elMeta = document.getElementById("synth-meta");

  document.addEventListener("visibilitychange", () => {
    _pageVisible = document.visibilityState === "visible";
  });

  void loadAiSynthesisData();
  _scheduleId = window.setInterval(() => { void loadAiSynthesisData(); }, SYNTH_REFRESH_MS);
}

export function destroyAiSynthesisCard(): void {
  if (_scheduleId !== null) {
    clearInterval(_scheduleId);
    _scheduleId = null;
  }
  _elText = null;
  _elMeta = null;
}

/** Reset module-level state — for unit tests only. */
export function _resetAiSynthesisForTest(): void {
  _elText = null;
  _elMeta = null;
  _scheduleId = null;
  _pageVisible = true;
}
