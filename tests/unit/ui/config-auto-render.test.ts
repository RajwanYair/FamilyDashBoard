/**
 * Config auto-renderer tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  renderConfigField,
  renderConfigFields,
  readConfigValues,
  filterConfigFields,
} from "@/ui/config-auto-render";
import type { CardConfigField } from "@/types/card";

describe("renderConfigField ", () => {
  it("renders a text field with label", () => {
    const field: CardConfigField = {
      key: "city",
      labelHe: "עיר",
      labelEn: "City",
      type: "text",
      defaultValue: "jerusalem",
    };
    const div = renderConfigField(field);
    expect(div.className).toBe("cfg-field");
    expect(div.querySelector("label")?.textContent).toBe("עיר");
    const input = div.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("text");
    expect(input.value).toBe("jerusalem");
    expect(input.id).toBe("cfg-city");
  });

  it("renders a boolean field as checkbox", () => {
    const field: CardConfigField = {
      key: "showWind",
      labelHe: "רוח",
      labelEn: "Wind",
      type: "boolean",
      defaultValue: true,
    };
    const div = renderConfigField(field, false);
    const cb = div.querySelector("input") as HTMLInputElement;
    expect(cb.type).toBe("checkbox");
    expect(cb.checked).toBe(false);
  });

  it("renders a select field with options", () => {
    const field: CardConfigField = {
      key: "tempUnit",
      labelHe: "יחידות",
      labelEn: "Unit",
      type: "select",
      defaultValue: "C",
      options: [
        { value: "C", label: "°C" },
        { value: "F", label: "°F" },
      ],
    };
    const div = renderConfigField(field, "F");
    const sel = div.querySelector("select") as HTMLSelectElement;
    expect(sel.options.length).toBe(2);
    expect(sel.value).toBe("F");
  });

  it("renders a range field with min/max/step", () => {
    const field: CardConfigField = {
      key: "interval",
      labelHe: "מרווח",
      labelEn: "Interval",
      type: "range",
      defaultValue: 5,
      min: 0,
      max: 30,
      step: 1,
    };
    const div = renderConfigField(field);
    const inp = div.querySelector("input") as HTMLInputElement;
    expect(inp.type).toBe("range");
    expect(inp.min).toBe("0");
    expect(inp.max).toBe("30");
  });

  it("renders a textarea field", () => {
    const field: CardConfigField = {
      key: "notes",
      labelHe: "הערות",
      labelEn: "Notes",
      type: "textarea",
      defaultValue: "",
      placeholder: "Type here...",
    };
    const div = renderConfigField(field);
    const ta = div.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    expect(ta.placeholder).toBe("Type here...");
  });
});

describe("renderConfigFields ", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("renders multiple fields into container", () => {
    const fields: CardConfigField[] = [
      { key: "a", labelHe: "א", labelEn: "A", type: "text", defaultValue: "" },
      { key: "b", labelHe: "ב", labelEn: "B", type: "boolean", defaultValue: true },
    ];
    renderConfigFields(fields, {}, container);
    expect(container.querySelectorAll(".cfg-field").length).toBe(2);
  });

  it("renders grouped fields in details/summary", () => {
    const fields: CardConfigField[] = [
      { key: "x", labelHe: "א", labelEn: "X", type: "text", defaultValue: "", group: "Advanced" },
      { key: "y", labelHe: "ב", labelEn: "Y", type: "number", defaultValue: 0, group: "Advanced" },
    ];
    renderConfigFields(fields, {}, container);
    const details = container.querySelector("details");
    expect(details).toBeTruthy();
    expect(details?.querySelector("summary")?.textContent).toBe("Advanced");
    expect(details?.querySelectorAll(".cfg-field").length).toBe(2);
  });

  it("clears container before rendering", () => {
    container.textContent = "old content";
    renderConfigFields([], {}, container);
    expect(container.textContent).toBe("");
  });
});

describe("readConfigValues ", () => {
  it("reads text and checkbox values from rendered fields", () => {
    const fields: CardConfigField[] = [
      { key: "city", labelHe: "עיר", labelEn: "City", type: "text", defaultValue: "test" },
      { key: "show", labelHe: "הצג", labelEn: "Show", type: "boolean", defaultValue: true },
    ];
    const container = document.createElement("div");
    renderConfigFields(fields, { city: "haifa", show: true }, container);

    const vals = readConfigValues(container);
    expect(vals["city"]).toBe("haifa");
    expect(vals["show"]).toBe(true);
  });

  it("reads number and select values", () => {
    const fields: CardConfigField[] = [
      { key: "count", labelHe: "מספר", labelEn: "Count", type: "number", defaultValue: 5 },
      {
        key: "unit",
        labelHe: "יחידה",
        labelEn: "Unit",
        type: "select",
        defaultValue: "C",
        options: [
          { value: "C", label: "C" },
          { value: "F", label: "F" },
        ],
      },
    ];
    const container = document.createElement("div");
    renderConfigFields(fields, { count: 10, unit: "F" }, container);

    const vals = readConfigValues(container);
    expect(vals["count"]).toBe(10);
    expect(vals["unit"]).toBe("F");
  });
});

// ── readConfigValues — textarea branch ──────────────────────

describe("readConfigValues — textarea", () => {
  it("reads textarea value", () => {
    const fields: CardConfigField[] = [
      { key: "notes", labelHe: "הערות", labelEn: "Notes", type: "textarea", defaultValue: "" },
    ];
    const container = document.createElement("div");
    renderConfigFields(fields, { notes: "hello world" }, container);

    const vals = readConfigValues(container);
    expect(vals["notes"]).toBe("hello world");
  });

  it("skips elements with missing data-config-key", () => {
    const container = document.createElement("div");
    const orphan = document.createElement("input");
    orphan.setAttribute("data-config-key", "");
    container.appendChild(orphan);

    const vals = readConfigValues(container);
    expect(Object.keys(vals)).toHaveLength(0);
  });
});

// ── filterConfigFields ──────────────────────────────────────

describe("filterConfigFields ", () => {
  it("hides fields that don't match the query", () => {
    const container = document.createElement("div");
    const fields: CardConfigField[] = [
      { key: "city", labelHe: "עיר", labelEn: "City", type: "text", defaultValue: "" },
      { key: "wind", labelHe: "רוח", labelEn: "Wind", type: "boolean", defaultValue: true },
    ];
    renderConfigFields(fields, {}, container);
    filterConfigFields(container, "רוח");

    const divs = container.querySelectorAll<HTMLElement>(".cfg-field");
    expect(divs[0].style.display).toBe("none");
    expect(divs[1].style.display).toBe("");
  });

  it("shows all fields when query is empty", () => {
    const container = document.createElement("div");
    const fields: CardConfigField[] = [
      { key: "a", labelHe: "אלפא", labelEn: "Alpha", type: "text", defaultValue: "" },
      { key: "b", labelHe: "בטא", labelEn: "Beta", type: "text", defaultValue: "" },
    ];
    renderConfigFields(fields, {}, container);
    filterConfigFields(container, "אלפא");
    filterConfigFields(container, "");

    const divs = container.querySelectorAll<HTMLElement>(".cfg-field");
    expect(divs[0].style.display).toBe("");
    expect(divs[1].style.display).toBe("");
  });

  it("hides details group when all children hidden", () => {
    const container = document.createElement("div");
    const fields: CardConfigField[] = [
      {
        key: "x",
        labelHe: "שדה",
        labelEn: "Field",
        type: "text",
        defaultValue: "",
        group: "Advanced",
      },
    ];
    renderConfigFields(fields, {}, container);
    filterConfigFields(container, "nomatch");

    const details = container.querySelector<HTMLDetailsElement>("details");
    expect(details?.style.display).toBe("none");
  });
});
