/**
 * FamilyDashBoard — Card Preview [DEV ONLY]
 *
 * Isolated card harness for development and visual review.
 * Not listed in rollupOptions.input — excluded from production builds.
 *
 * Usage:  npx vite  →  http://localhost:3000/FamilyDashBoard/preview.html?card=news
 *
 * URL params:
 *   ?card=<id>   — card to mount on load (default: "news")
 *
 * Keyboard:
 *   R  — reload current card
 *   D  — toggle diag panel
 *   M  — maximize / restore card
 */

// ── Design system ──────────────────────────────────────────────────────────
import "./styles/tokens.css";
import "./styles/themes.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/scroll.css";
import "./styles/animations.css";
import "./styles/maximize.css";
import "./styles/a11y.css";
import "./styles/preview.css";

// ── Card CSS not self-imported by their own modules ──
import "./cards/tasks/tasks.css";
import "./cards/system-info/system-info.css";

// ── Card registry (side-effect: registers all 11 built-in cards) ──
import { loadCard, listCards } from "./core/card-registry";
import { trustedHTML } from "./core/trusted-types";
import { getDiagEntries, clearDiag, formatDiagEntry } from "./core/diag";
import { toggleCardMaximize } from "./ui/maximize";
import { THEMES } from "./core/constants";
import type { ThemeName } from "./core/constants";
import type { CardDefinition } from "./types/card";

// ── State ──────────────────────────────────────────────────────────────────
let _currentDef: CardDefinition | null = null;
let _currentEl: HTMLElement | null = null;
let _diagPollTimer: number | null = null;
let _diagVisible = true;
let _settingsVisible = false;
let _indexDoc: Document | null = null;

// ── Stable DOM refs ────────────────────────────────────────────────────────
const mount = document.getElementById("preview-mount") as HTMLElement;
const diagEntriesEl = document.getElementById("preview-diag-entries") as HTMLElement;

// ── URL helpers ────────────────────────────────────────────────────────────
function getCardParam(): string {
  return new URLSearchParams(location.search).get("card") ?? "news";
}

function setCardParam(id: string): void {
  const url = new URL(location.href);
  url.searchParams.set("card", id);
  history.replaceState(null, "", url.toString());
}

// ── Legacy card DOM hydration ──────────────────────────────────────────────
// Cards that pre-date the FdbCard self-build pattern (hebrew-cal, calendar,
// currency, alerts, system-info, countdown) call initXxxCard() inside
// connect() without first calling buildShell(). Their DOM IDs live in
// src/index.html and must be injected into the custom element before the
// second connectedCallback fires.

async function fetchIndexHTML(): Promise<Document> {
  if (_indexDoc) return _indexDoc;
  const resp = await fetch(`${import.meta.env.BASE_URL}index.html`);
  const text = await resp.text();
  _indexDoc = new DOMParser().parseFromString(text, "text/html");
  return _indexDoc;
}

async function ensureLegacyCardDOM(id: string, el: HTMLElement): Promise<void> {
  // Modern cards call buildShell() in connect() — they already have children.
  if (el.childElementCount > 0) return;

  try {
    const indexDoc = await fetchIndexHTML();
    const template = indexDoc.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
    if (!template) return;

    // Copy classes (e.g. "card") from the index.html template element.
    for (const cls of Array.from(template.classList)) {
      el.classList.add(cls);
    }
    // Inject the card's inner HTML (all IDs and structure).
    el.innerHTML = trustedHTML(template.innerHTML);

    // Remove and re-append so connectedCallback fires again, this time with
    // all DOM IDs present as descendants of the custom element.
    el.remove();
    mount.appendChild(el);
  } catch {
    // Fail silently — card shows empty but won't crash the harness.
  }
}

// ── Settings panel ─────────────────────────────────────────────────────────
function updateSettingsPanel(def: CardDefinition): void {
  const settingsBtn = document.getElementById(
    "preview-settings-toggle",
  ) as HTMLButtonElement | null;
  const body = document.getElementById("preview-settings-body") as HTMLElement;

  const hasSchema = Array.isArray(def.configSchema) && def.configSchema.length > 0;
  if (settingsBtn) settingsBtn.disabled = !hasSchema;

  body.textContent = "";

  if (!hasSchema) {
    const msg = document.createElement("p");
    msg.className = "preview-settings-empty";
    msg.textContent = "This card has no configurable settings.";
    body.appendChild(msg);
    return;
  }

  const frag = document.createDocumentFragment();

  for (const field of def.configSchema!) {
    const row = document.createElement("div");
    row.className = "preview-settings-row";

    const lbl = document.createElement("label");
    lbl.className = "preview-settings-label";
    lbl.textContent = field.labelHe;
    lbl.title = field.labelEn;

    const stored = localStorage.getItem(field.key);
    const currentVal = stored !== null ? stored : String(field.defaultValue);

    if (field.type === "boolean") {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "preview-settings-checkbox";
      cb.checked = currentVal === "true";
      cb.addEventListener("change", () => {
        localStorage.setItem(field.key, String(cb.checked));
      });
      row.appendChild(lbl);
      row.appendChild(cb);
    } else if (field.type === "range") {
      const range = document.createElement("input");
      range.type = "range";
      range.className = "preview-settings-range";
      range.min = String(field.min ?? 0);
      range.max = String(field.max ?? 100);
      range.step = String(field.step ?? 1);
      range.value = currentVal;

      const valDisplay = document.createElement("span");
      valDisplay.className = "preview-settings-val";
      valDisplay.textContent = currentVal;

      range.addEventListener("input", () => {
        valDisplay.textContent = range.value;
        localStorage.setItem(field.key, range.value);
      });

      row.appendChild(lbl);
      row.appendChild(range);
      row.appendChild(valDisplay);
    } else if (field.type === "select" && field.options) {
      const sel = document.createElement("select");
      sel.className = "preview-settings-input preview-select";
      for (const opt of field.options) {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === currentVal) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        localStorage.setItem(field.key, sel.value);
      });
      row.appendChild(lbl);
      row.appendChild(sel);
    } else {
      const inp = document.createElement("input");
      inp.type = field.type === "url" ? "url" : field.type === "date" ? "date" : "text";
      inp.className = "preview-settings-input";
      inp.value = currentVal;
      if (field.placeholder) inp.placeholder = field.placeholder;
      inp.addEventListener("change", () => {
        localStorage.setItem(field.key, inp.value);
      });
      row.appendChild(lbl);
      row.appendChild(inp);
    }

    frag.appendChild(row);
  }

  // Apply button — re-mounts the card so changes take effect.
  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "preview-btn preview-settings-apply";
  applyBtn.textContent = "♻ Apply & Reload";
  applyBtn.addEventListener("click", () => void mountCard(getCardParam()));
  frag.appendChild(applyBtn);

  body.appendChild(frag);
}

// ── Card lifecycle ─────────────────────────────────────────────────────────
async function mountCard(id: string): Promise<void> {
  // Tear down the current card.
  if (_currentEl) {
    _currentDef?.destroy?.();
    _currentEl.remove();
    _currentEl = null;
    _currentDef = null;
  }

  setCardParam(id);

  const statusEl = document.getElementById("preview-status") as HTMLElement;
  statusEl.textContent = `Loading ${id}…`;

  try {
    const def = await loadCard(id);
    _currentDef = def;

    const el = def.render();
    mount.appendChild(el);

    // Legacy cards (no buildShell) get their DOM injected from index.html.
    await ensureLegacyCardDOM(id, el);

    _currentEl = el;
    def.init(); // no-op for FdbCard-based cards; lifecycle owned by connectedCallback.

    // Wire header click → maximize / restore.
    // Covers both modern (.card__header) and legacy (.card-header) shells.
    const hdr = el.querySelector<HTMLElement>(".card__header, .card-header");
    if (hdr) {
      hdr.style.cursor = "pointer";
      hdr.title = "Click to maximize / restore (M)";
      hdr.addEventListener("click", () => toggleCardMaximize(el));
    }

    // Sync settings panel with the newly loaded card's schema.
    updateSettingsPanel(def);

    statusEl.textContent = `✅ ${id}`;
  } catch (err) {
    statusEl.textContent = `❌ ${String(err)}`;
    // log to diagnostic overlay — no console in production
    const w = window as unknown as Record<string, unknown>;
    if (typeof w["diagLog"] === "function") {
      (w["diagLog"] as (tag: string, data?: unknown) => void)(
        `[preview] mountCard(${id}) failed:`,
        err,
      );
    }
  }
}

// ── Diag polling ───────────────────────────────────────────────────────────
function refreshDiag(): void {
  const entries = getDiagEntries(50);
  diagEntriesEl.textContent = "";
  if (entries.length === 0) return;

  const frag = document.createDocumentFragment();
  for (const entry of entries) {
    const line = document.createElement("div");
    line.className = "preview-diag-line";
    line.textContent = formatDiagEntry(entry);
    frag.appendChild(line);
  }
  diagEntriesEl.appendChild(frag);
}

function startDiagPoll(): void {
  if (_diagPollTimer !== null) clearInterval(_diagPollTimer);
  _diagPollTimer = window.setInterval(refreshDiag, 1_000);
}

// ── Theme ──────────────────────────────────────────────────────────────────
function applyTheme(theme: ThemeName): void {
  for (const t of THEMES) document.body.classList.remove(`theme-${t}`);
  document.body.classList.add(`theme-${theme}`);
}

// ── Toolbar builder ────────────────────────────────────────────────────────
function buildToolbar(): void {
  const toolbar = document.getElementById("preview-toolbar") as HTMLElement;
  toolbar.textContent = "";

  const makeSep = (): HTMLSpanElement => {
    const s = document.createElement("span");
    s.className = "preview-sep";
    s.setAttribute("aria-hidden", "true");
    s.textContent = "|";
    return s;
  };

  const makeLabel = (text: string): HTMLSpanElement => {
    const s = document.createElement("span");
    s.textContent = text;
    return s;
  };

  const makeBtn = (text: string, ttl: string): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preview-btn";
    btn.textContent = text;
    btn.title = ttl;
    return btn;
  };

  // ── Title ──
  const title = document.createElement("span");
  title.className = "preview-title";
  title.textContent = "🔬 Card Preview [DEV]";
  toolbar.appendChild(title);

  toolbar.appendChild(makeSep());

  // ── Card selector ──
  const cardLabel = document.createElement("label");
  cardLabel.className = "preview-label";
  cardLabel.appendChild(makeLabel("Card:"));

  const cardSelect = document.createElement("select");
  cardSelect.id = "preview-card-select";
  cardSelect.className = "preview-select";
  const currentId = getCardParam();
  for (const entry of listCards()) {
    const opt = document.createElement("option");
    opt.value = entry.id;
    opt.textContent = `${entry.icon} ${entry.titleHe} / ${entry.titleEn}`;
    if (entry.id === currentId) opt.selected = true;
    cardSelect.appendChild(opt);
  }
  cardSelect.addEventListener("change", () => void mountCard(cardSelect.value));
  cardLabel.appendChild(cardSelect);
  toolbar.appendChild(cardLabel);

  toolbar.appendChild(makeSep());

  // ── Theme selector ──
  const themeLabel = document.createElement("label");
  themeLabel.className = "preview-label";
  themeLabel.appendChild(makeLabel("Theme:"));

  const themeSelect = document.createElement("select");
  themeSelect.id = "preview-theme-select";
  themeSelect.className = "preview-select";
  for (const theme of THEMES) {
    const opt = document.createElement("option");
    opt.value = theme;
    opt.textContent = theme;
    if (theme === "black") opt.selected = true;
    themeSelect.appendChild(opt);
  }
  themeSelect.addEventListener("change", () => applyTheme(themeSelect.value as ThemeName));
  themeLabel.appendChild(themeSelect);
  toolbar.appendChild(themeLabel);

  toolbar.appendChild(makeSep());

  // ── Action buttons ──
  const reloadBtn = makeBtn("↺ Reload", "Reload current card (R)");
  reloadBtn.addEventListener("click", () => void mountCard(getCardParam()));
  toolbar.appendChild(reloadBtn);

  const maxBtn = makeBtn("⛶ Expand", "Maximize / restore card (M)");
  maxBtn.id = "preview-maximize-btn";
  maxBtn.addEventListener("click", () => {
    if (_currentEl) toggleCardMaximize(_currentEl);
  });
  toolbar.appendChild(maxBtn);

  toolbar.appendChild(makeSep());

  const settingsBtn = makeBtn("⚙️ Settings", "Toggle card settings panel");
  settingsBtn.id = "preview-settings-toggle";
  settingsBtn.disabled = true; // enabled once a card with configSchema is loaded
  settingsBtn.addEventListener("click", () => {
    _settingsVisible = !_settingsVisible;
    const panel = document.getElementById("preview-settings-panel") as HTMLElement;
    panel.hidden = !_settingsVisible;
    settingsBtn.classList.toggle("active", _settingsVisible);
    if (_settingsVisible && _currentDef) updateSettingsPanel(_currentDef);
  });
  toolbar.appendChild(settingsBtn);

  const diagBtn = makeBtn("📋 Diag", "Toggle diagnostic log (D)");
  diagBtn.id = "preview-diag-toggle";
  diagBtn.classList.add("active");
  diagBtn.addEventListener("click", () => {
    _diagVisible = !_diagVisible;
    const panel = document.getElementById("preview-diag-panel") as HTMLElement;
    panel.hidden = !_diagVisible;
    diagBtn.classList.toggle("active", _diagVisible);
  });
  toolbar.appendChild(diagBtn);

  const clearBtn = makeBtn("🗑 Clear", "Clear diagnostic log");
  clearBtn.addEventListener("click", () => {
    clearDiag();
    diagEntriesEl.textContent = "";
  });
  toolbar.appendChild(clearBtn);

  // ── Status ──
  const status = document.createElement("span");
  status.id = "preview-status";
  status.className = "preview-status";
  toolbar.appendChild(status);
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.target as HTMLElement).closest("input, select, textarea")) return;
  if (e.key === "r" || e.key === "R") void mountCard(getCardParam());
  if (e.key === "d" || e.key === "D") {
    (document.getElementById("preview-diag-toggle") as HTMLButtonElement | null)?.click();
  }
  if (e.key === "m" || e.key === "M") {
    if (_currentEl) toggleCardMaximize(_currentEl);
  }
  if (e.key === "Escape") {
    // Collapse a maximized card when pressing Escape.
    if (_currentEl?.classList.contains("maximized")) toggleCardMaximize(_currentEl);
  }
});

// ── Diag panel resize ──────────────────────────────────────────────────────
function initDiagResize(): void {
  const handle = document.getElementById("preview-diag-resize") as HTMLElement;
  const panel = document.getElementById("preview-diag-panel") as HTMLElement;
  if (!handle || !panel) return;

  let _startX = 0;
  let _startW = 0;

  handle.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    _startX = e.clientX;
    _startW = panel.offsetWidth;
    handle.classList.add("dragging");

    const onMove = (ev: MouseEvent): void => {
      // Panel is on the right side; dragging left (smaller clientX) = wider panel.
      const delta = _startX - ev.clientX;
      const next = Math.min(720, Math.max(140, _startW + delta));
      panel.style.width = `${next}px`;
    };

    const onUp = (): void => {
      handle.classList.remove("dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

// ── Boot ───────────────────────────────────────────────────────────────────
buildToolbar();
startDiagPoll();
initDiagResize();
void mountCard(getCardParam());
