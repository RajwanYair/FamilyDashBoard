/**
 * Sprint 169 — buildConfigAccordion tests
 * Validates grouping, open-by-default, and flat-field rendering.
 */

import { describe, it, expect } from "vitest";
import { buildConfigAccordion } from "@/ui/config-panel";
import type { CardConfigField } from "@/types/card";

const grouped: CardConfigField[] = [
  { key: "a", labelHe: "א", labelEn: "A", type: "text", defaultValue: "", group: "Group1" },
  { key: "b", labelHe: "ב", labelEn: "B", type: "boolean", defaultValue: true, group: "Group1" },
  { key: "c", labelHe: "ג", labelEn: "C", type: "range", defaultValue: 5, min: 0, max: 10, group: "Group2", groupOpenByDefault: true },
];

const flat: CardConfigField[] = [
  { key: "x", labelHe: "X", labelEn: "X", type: "text", defaultValue: "val" },
  { key: "y", labelHe: "Y", labelEn: "Y", type: "number", defaultValue: 3 },
];

describe("buildConfigAccordion (Sprint 169)", () => {
  it("groups fields into <details> elements", () => {
    const container = document.createElement("div");
    buildConfigAccordion(grouped, container);
    const details = container.querySelectorAll("details");
    expect(details.length).toBe(2);
    expect(details[0]!.querySelector("summary")!.textContent).toBe("Group1");
    expect(details[1]!.querySelector("summary")!.textContent).toBe("Group2");
  });

  it("puts multiple fields in the same group", () => {
    const container = document.createElement("div");
    buildConfigAccordion(grouped, container);
    const g1 = container.querySelector("details")!;
    const rows = g1.querySelectorAll(".cfg-row");
    expect(rows.length).toBe(2);
  });

  it("respects groupOpenByDefault", () => {
    const container = document.createElement("div");
    buildConfigAccordion(grouped, container);
    const details = container.querySelectorAll("details");
    expect(details[0]!.open).toBe(false);
    expect(details[1]!.open).toBe(true);
  });

  it("renders ungrouped fields flat at top level", () => {
    const container = document.createElement("div");
    buildConfigAccordion(flat, container);
    expect(container.querySelectorAll("details").length).toBe(0);
    expect(container.querySelectorAll(".cfg-row").length).toBe(2);
  });
});
