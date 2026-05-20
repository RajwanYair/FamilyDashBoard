/**
 * FamilyDashBoard — AI Synthesis Card
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
import { setCardSignal } from "../../core/card-signal-protocol";
import { registerSemanticProducer } from "../../core/semantic-clipboard";
import type { SemanticPayload } from "../../core/semantic-clipboard";
import type { CardConfigField } from "../../types/card";
import { today, formatTimeHHMM } from "../../core/temporal";

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
let _elSpeakBtn: HTMLButtonElement | null = null;
let _scheduleId: number | null = null;
/** X15: snapshot for semantic clipboard producer. */
let _synthesisSnapshot: string | null = null;

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
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }); // owasp-allow:A10 — url is WORKER_BASE_URL constant, not user-controlled
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
  _synthesisSnapshot = text; // X15: keep snapshot for semantic producer
  if (_elText) _elText.textContent = text;
  if (_elMeta) {
    const now = formatTimeHHMM();
    _elMeta.textContent = source === "cached" ? `עודכן: ${now} (מטמון)` : `עודכן: ${now}`;
  }
}

// X15: semantic clipboard producer
function buildAiSynthesisPayload(): SemanticPayload | null {
  if (!_synthesisSnapshot) return null;
  return {
    cardId: "ai-synthesis",
    text: `תקציר AI: ${_synthesisSnapshot.substring(0, 200)}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      name: "תקציר AI יומי",
      description: _synthesisSnapshot,
      inLanguage: "he",
    },
    ts: Date.now(),
  };
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
    setCardSignal("ai-synthesis", "synthesis", null); // X12: clear signal when disabled
    setSync("ai-synthesis", "ok");
    return;
  }

  setSync("ai-synthesis", "loading");

  // Serve cached immediately while revalidating
  const cached = cGet<SynthesisPayload>(SYNTH_CACHE_KEY, SYNTH_CACHE_TTL);
  if (cached?.synthesis) {
    renderSynthesis(cached.synthesis, "cached");
    setCardSignal("ai-synthesis", "synthesis", { text: cached.synthesis }); // X12
    setSync("ai-synthesis", "ok");
    return;
  }

  // Attempt live fetch
  const text = await fetchSynthesis();
  if (text) {
    cSet(SYNTH_CACHE_KEY, { synthesis: text } satisfies SynthesisPayload);
    renderSynthesis(text, "fresh");
    setCardSignal("ai-synthesis", "synthesis", { text }); // X12: publish for MCP + today-pane
    setSync("ai-synthesis", "ok");
  } else {
    const stale = cGetStale<SynthesisPayload>(SYNTH_CACHE_KEY);
    renderError(stale?.synthesis ?? null);
    setSync("ai-synthesis", "error");
  }
}

// ── PC-1: Read-aloud via SpeechSynthesis ─────────────────────
// Uses the Web Speech API (SpeechSynthesisUtterance) — no CSP media-src
// directive needed. Gate: audio-CSP audit OPEN for SpeechSynthesis.

function _setSpeakBtnState(speaking: boolean): void {
  if (!_elSpeakBtn) return;
  _elSpeakBtn.setAttribute("aria-pressed", speaking ? "true" : "false");
  _elSpeakBtn.textContent = speaking ? "⏹" : "🔊";
  _elSpeakBtn.title = speaking ? "PC-1: עצור קריאה — Stop reading" : "PC-1: קרא בקול — Read aloud";
}

export function speakSynthesis(): void {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  const text = _synthesisSnapshot;
  if (!text) return;

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    _setSpeakBtnState(false);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "he-IL";
  utterance.rate = 0.9;
  utterance.onstart = () => {
    _setSpeakBtnState(true);
  };
  utterance.onend = () => {
    _setSpeakBtnState(false);
  };
  utterance.onerror = () => {
    _setSpeakBtnState(false);
  };
  window.speechSynthesis.speak(utterance);
}

export function stopSpeakSynthesis(): void {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  _setSpeakBtnState(false);
}

// ── Init ───────────────────────────────────────────────────────────────────

export function initAiSynthesisCard(): void {
  _elText = document.getElementById("synth-text");
  _elMeta = document.getElementById("synth-meta");
  _elSpeakBtn = document.getElementById("synth-speak-btn") as HTMLButtonElement | null;

  if (_elSpeakBtn) {
    _elSpeakBtn.addEventListener("click", () => {
      speakSynthesis();
    });
  }

  document.addEventListener("visibilitychange", () => {
    _pageVisible = document.visibilityState === "visible";
    if (!_pageVisible) stopSpeakSynthesis();
  });

  void loadAiSynthesisData();
  _scheduleId = window.setInterval(() => {
    void loadAiSynthesisData();
  }, SYNTH_REFRESH_MS);
  // X15: register semantic clipboard producer
  registerSemanticProducer("ai-synthesis", buildAiSynthesisPayload);
}

export function destroyAiSynthesisCard(): void {
  stopSpeakSynthesis();
  if (_scheduleId !== null) {
    clearInterval(_scheduleId);
    _scheduleId = null;
  }
  _elText = null;
  _elMeta = null;
  _elSpeakBtn = null;
}

/** Reset module-level state — for unit tests only. */
export function _resetAiSynthesisForTest(): void {
  _elText = null;
  _elMeta = null;
  _elSpeakBtn = null;
  _scheduleId = null;
  _pageVisible = true;
  _synthesisSnapshot = null;
}

/** Test-only hook to seed _synthesisSnapshot without going through the loader. */
export function _setSnapshotForTest(text: string | null): void {
  _synthesisSnapshot = text;
}
