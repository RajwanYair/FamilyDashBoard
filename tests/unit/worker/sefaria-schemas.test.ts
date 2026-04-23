/**
 * Worker unit tests — Sefaria Valibot strict schema (V13-DATA)
 *
 * Verifies that SefariaCalendarSchema and SefariaTextSchema use strict
 * v.object() validation (strips unknown fields) instead of v.looseObject().
 */

import { describe, it, expect } from "vitest";
import {
  SefariaCalendarItemSchema,
  SefariaCalendarSchema,
  SefariaTextSchema,
  safeParse,
} from "../../../worker/src/utils/schemas";

// ── SefariaCalendarItemSchema ─────────────────────────────────────────────────

describe("SefariaCalendarItemSchema — strict object parsing", () => {
  it("accepts a valid calendar item", () => {
    const input = {
      title: { en: "Daf Yomi", he: "דף יומי" },
      displayValue: { en: "Bava Kamma 12", he: "בבא קמא יב" },
    };
    const result = safeParse(SefariaCalendarItemSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title.en).toBe("Daf Yomi");
      expect(result.data.title.he).toBe("דף יומי");
      expect(result.data.displayValue.en).toBe("Bava Kamma 12");
    }
  });

  it("accepts item with optional he field absent", () => {
    const input = {
      title: { en: "Daf Yomi" },
      displayValue: { en: "Bava Kamma 12" },
    };
    const result = safeParse(SefariaCalendarItemSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title.he).toBeUndefined();
    }
  });

  it("strips unknown extra fields (strict mode)", () => {
    const input = {
      title: { en: "Daf Yomi", he: "דף יומי", extra: "should be stripped" },
      displayValue: { en: "Bava Kamma 12", he: "בבא קמא יב", extraField: 42 },
      unknownTopLevel: "removed",
    };
    const result = safeParse(SefariaCalendarItemSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as Record<string, unknown>)["unknownTopLevel"]).toBeUndefined();
      expect((result.data.title as Record<string, unknown>)["extra"]).toBeUndefined();
    }
  });

  it("rejects item missing required title.en", () => {
    const input = {
      title: { he: "דף יומי" },
      displayValue: { en: "Bava Kamma 12" },
    };
    const result = safeParse(SefariaCalendarItemSchema, input);
    expect(result.ok).toBe(false);
  });

  it("rejects item missing required displayValue", () => {
    const input = { title: { en: "Daf Yomi" } };
    const result = safeParse(SefariaCalendarItemSchema, input);
    expect(result.ok).toBe(false);
  });
});

// ── SefariaCalendarSchema ─────────────────────────────────────────────────────

describe("SefariaCalendarSchema — strict object parsing", () => {
  it("accepts a valid calendar response", () => {
    const input = {
      calendar_items: [
        {
          title: { en: "Daf Yomi", he: "דף יומי" },
          displayValue: { en: "Bava Kamma 12", he: "בבא קמא יב" },
        },
      ],
    };
    const result = safeParse(SefariaCalendarSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.calendar_items).toHaveLength(1);
      expect(result.data.calendar_items[0]!.title.en).toBe("Daf Yomi");
    }
  });

  it("accepts empty calendar_items array", () => {
    const result = safeParse(SefariaCalendarSchema, { calendar_items: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.calendar_items).toHaveLength(0);
  });

  it("strips unknown top-level fields (strict mode)", () => {
    const input = {
      calendar_items: [
        {
          title: { en: "Daf Yomi" },
          displayValue: { en: "Bava Kamma 12" },
        },
      ],
      date: "2025-01-01", // unknown field — should be stripped
    };
    const result = safeParse(SefariaCalendarSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as Record<string, unknown>)["date"]).toBeUndefined();
    }
  });

  it("rejects when calendar_items is missing", () => {
    const result = safeParse(SefariaCalendarSchema, { other: [] });
    expect(result.ok).toBe(false);
  });
});

// ── SefariaTextSchema ─────────────────────────────────────────────────────────

describe("SefariaTextSchema — strict object parsing", () => {
  it("accepts a valid text response with all fields", () => {
    const input = {
      ref: "Berakhot 2a",
      he: "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בָּעַרְבִּין",
      text: "From what time may one recite the Shema in the evening?",
      versions: [{ text: "Version 1" }],
    };
    const result = safeParse(SefariaTextSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ref).toBe("Berakhot 2a");
      expect(result.data.he).toBe("מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בָּעַרְבִּין");
    }
  });

  it("accepts response with minimal fields (only ref required)", () => {
    const result = safeParse(SefariaTextSchema, { ref: "Genesis 1:1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ref).toBe("Genesis 1:1");
      expect(result.data.he).toBeUndefined();
      expect(result.data.text).toBeUndefined();
    }
  });

  it("accepts he as an array (Tanach format)", () => {
    const input = { ref: "Genesis 1:1", he: ["בְּרֵאשִׁית", "בָּרָא"] };
    const result = safeParse(SefariaTextSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.data.he)).toBe(true);
    }
  });

  it("strips unknown extra fields (strict mode)", () => {
    const input = {
      ref: "Berakhot 2a",
      he: "text",
      unknownField: "removed",
      anotherExtra: 123,
    };
    const result = safeParse(SefariaTextSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.data as Record<string, unknown>)["unknownField"]).toBeUndefined();
      expect((result.data as Record<string, unknown>)["anotherExtra"]).toBeUndefined();
    }
  });

  it("rejects when ref field is missing", () => {
    const result = safeParse(SefariaTextSchema, { he: "text" });
    expect(result.ok).toBe(false);
  });

  it("strips unknown fields in versions items (strict mode)", () => {
    const input = {
      ref: "Berakhot 2a",
      versions: [{ text: "Version 1", extraInVersion: "stripped" }],
    };
    const result = safeParse(SefariaTextSchema, input);
    expect(result.ok).toBe(true);
    if (result.ok && result.data.versions?.[0]) {
      expect((result.data.versions[0] as Record<string, unknown>)["extraInVersion"]).toBeUndefined();
    }
  });
});
