/**
 * fast-check property tests — src/ui/config-auto-render.ts (Sprint 544)
 *
 * Properties under test:
 *  CA1. renderConfigField returns a div with class cfg-field
 *  CA2. renderConfigField sets data-key to field.key
 *  CA3. renderConfigFields renders all fields in container
 *  CA4. readConfigValues round-trips text field values
 *  CA5. filterConfigFields hides non-matching fields
 *  CA6. filterConfigFields empty query shows all
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  renderConfigField,
  renderConfigFields,
  readConfigValues,
  filterConfigFields,
} from "@/ui/config-auto-render";
import type { CardConfigField } from "@/types/card";

const textField = (key: string, label: string): CardConfigField => ({
  key,
  labelHe: label,
  labelEn: label,
  type: "text" as const,
  defaultValue: "",
});

// ── CA1: returns cfg-field div ───────────────────────────────────────────────

describe("config-auto-render — CA1: cfg-field class", () => {
  it("returns div with cfg-field class", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,8}$/),
        (key) => {
          const el = renderConfigField(textField(key, "לייבל"));
          expect(el.className).toBe("cfg-field");
          expect(el.tagName).toBe("DIV");
        },
      ),
      { numRuns: 5 },
    );
  });
});

// ── CA2: data-key set ────────────────────────────────────────────────────────

describe("config-auto-render — CA2: data-key", () => {
  it("sets dataset.key to field key", () => {
    const el = renderConfigField(textField("myKey", "test"));
    expect(el.dataset.key).toBe("myKey");
  });
});

// ── CA3: renderConfigFields all rendered ─────────────────────────────────────

describe("config-auto-render — CA3: renderConfigFields count", () => {
  it("renders all fields into container", () => {
    const fields: CardConfigField[] = [
      textField("a", "שדה א"),
      textField("b", "שדה ב"),
      textField("c", "שדה ג"),
    ];
    const container = document.createElement("div");
    renderConfigFields(fields, {}, container);
    const rendered = container.querySelectorAll(".cfg-field");
    expect(rendered.length).toBe(3);
  });
});

// ── CA4: readConfigValues round-trip ─────────────────────────────────────────

describe("config-auto-render — CA4: readConfigValues round-trip", () => {
  it("reads back text values that were set", () => {
    const fields: CardConfigField[] = [textField("name", "שם")];
    const container = document.createElement("div");
    renderConfigFields(fields, { name: "hello" }, container);
    const vals = readConfigValues(container);
    expect(vals.name).toBe("hello");
  });
});

// ── CA5: filterConfigFields hides non-matching ───────────────────────────────

describe("config-auto-render — CA5: filterConfigFields hide", () => {
  it("hides fields whose label does not match", () => {
    const fields: CardConfigField[] = [
      textField("weather", "מזג אוויר"),
      textField("news", "חדשות"),
    ];
    const container = document.createElement("div");
    renderConfigFields(fields, {}, container);
    filterConfigFields(container, "חדשות");
    const visibleFields = container.querySelectorAll<HTMLElement>(".cfg-field");
    const visible = [...visibleFields].filter((f) => f.style.display !== "none");
    expect(visible.length).toBe(1);
  });
});

// ── CA6: filterConfigFields empty shows all ──────────────────────────────────

describe("config-auto-render — CA6: empty filter shows all", () => {
  it("empty query shows all fields", () => {
    const fields: CardConfigField[] = [
      textField("a", "שדה א"),
      textField("b", "שדה ב"),
    ];
    const container = document.createElement("div");
    renderConfigFields(fields, {}, container);
    filterConfigFields(container, "שדה א"); // hide some first
    filterConfigFields(container, ""); // then clear
    const visibleFields = container.querySelectorAll<HTMLElement>(".cfg-field");
    const visible = [...visibleFields].filter((f) => f.style.display !== "none");
    expect(visible.length).toBe(2);
  });
});
