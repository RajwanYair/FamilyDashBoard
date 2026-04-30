/**
 * FamilyDashBoard v13 — Config Auto-Renderer (Sprint 100)
 *
 * Generates form controls from a CardConfigField[] schema.
 * Used by the config panel to render per-card settings without
 * hand-coding each input element.
 */

import type { CardConfigField, ConfigFieldType } from "../types/card";

/**
 * Create a single `<label>` + control element for a CardConfigField.
 * Returns a container `<div>` with class `cfg-field`.
 */
export function renderConfigField(
  field: CardConfigField,
  currentValue?: string | number | boolean,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "cfg-field";
  wrap.dataset.key = field.key;

  const label = document.createElement("label");
  label.htmlFor = `cfg-${field.key}`;
  label.textContent = field.labelHe || field.labelEn;
  wrap.appendChild(label);

  const val = currentValue ?? field.defaultValue;
  const input = _createControl(field, val);
  input.id = `cfg-${field.key}`;
  input.dataset.configKey = field.key;
  wrap.appendChild(input);

  return wrap;
}

/**
 * Render a full set of config fields into a container.
 * Groups fields by `group` property into `<details>` accordions when present.
 *
 * @param fields      Schema fields to render
 * @param values      Current values keyed by field key
 * @param container   Target DOM element (cleared before rendering)
 */
export function renderConfigFields(
  fields: CardConfigField[],
  values: Record<string, string | number | boolean>,
  container: HTMLElement,
): void {
  container.textContent = "";

  // Separate grouped vs ungrouped fields
  const grouped = new Map<string, CardConfigField[]>();
  const ungrouped: CardConfigField[] = [];

  for (const f of fields) {
    if (f.group) {
      if (!grouped.has(f.group)) grouped.set(f.group, []);
      grouped.get(f.group)!.push(f);
    } else {
      ungrouped.push(f);
    }
  }

  // Render ungrouped fields first
  for (const f of ungrouped) {
    container.appendChild(renderConfigField(f, values[f.key]));
  }

  // Render grouped fields in <details> accordions
  for (const [groupName, groupFields] of grouped) {
    const details = document.createElement("details");
    if (groupFields[0]?.groupOpenByDefault) details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = groupName;
    details.appendChild(summary);

    for (const f of groupFields) {
      details.appendChild(renderConfigField(f, values[f.key]));
    }

    container.appendChild(details);
  }
}

/**
 * Read current values from rendered config fields.
 * @param container The container previously rendered by renderConfigFields
 */
export function readConfigValues(
  container: HTMLElement,
): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  const inputs = container.querySelectorAll<HTMLElement>("[data-config-key]");

  for (const el of inputs) {
    const key = el.dataset.configKey;
    if (!key) continue;

    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox") values[key] = el.checked;
      else if (el.type === "number" || el.type === "range") values[key] = Number(el.value);
      else values[key] = el.value;
    } else if (el instanceof HTMLSelectElement) {
      values[key] = el.value;
    } else if (el instanceof HTMLTextAreaElement) {
      values[key] = el.value;
    }
  }

  return values;
}

// ── Sprint 107: Config field search/filter ───────────────────────────────

/**
 * Filter visible config fields in a container by search query.
 * Hides `.cfg-field` elements whose label text doesn't match the query.
 * Also hides empty `<details>` groups when all their children are hidden.
 *
 * @param container  The element rendered by `renderConfigFields()`
 * @param query      Search term (case-insensitive). Empty string shows all.
 */
export function filterConfigFields(container: HTMLElement, query: string): void {
  const q = query.trim().toLowerCase();
  const fields = container.querySelectorAll<HTMLElement>(".cfg-field");

  for (const field of fields) {
    const label = field.querySelector("label");
    const text = (label?.textContent ?? "").toLowerCase();
    const visible = q === "" || text.includes(q);
    field.style.display = visible ? "" : "none";
  }

  // Hide <details> groups where all children are hidden
  const groups = container.querySelectorAll<HTMLDetailsElement>("details");
  for (const group of groups) {
    const visibleChildren = group.querySelectorAll<HTMLElement>(
      ".cfg-field:not([style*='display: none'])",
    );
    group.style.display = visibleChildren.length > 0 || q === "" ? "" : "none";
  }
}

// ── Internal: create the appropriate input element ──

function _createControl(
  field: CardConfigField,
  value: string | number | boolean,
): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  const type: ConfigFieldType = field.type;

  if (type === "select") {
    const sel = document.createElement("select");
    for (const opt of field.options ?? []) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (String(value) === opt.value) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }

  if (type === "textarea") {
    const ta = document.createElement("textarea");
    ta.value = String(value);
    if (field.placeholder) ta.placeholder = field.placeholder;
    return ta;
  }

  if (type === "boolean") {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(value);
    return cb;
  }

  // text, number, url, date, range
  const inp = document.createElement("input");
  inp.type = type;
  inp.value = String(value);
  if (field.placeholder) inp.placeholder = field.placeholder;
  if (type === "range" || type === "number") {
    if (field.min !== undefined) inp.min = String(field.min);
    if (field.max !== undefined) inp.max = String(field.max);
    if (field.step !== undefined) inp.step = String(field.step);
  }
  return inp;
}
