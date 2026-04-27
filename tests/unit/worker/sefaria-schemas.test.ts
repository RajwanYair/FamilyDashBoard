/**
 * Worker unit tests — Sefaria Valibot strict error-handling (V13-DATA)
 *
 * Verifies that SefariaCalendarSchema and SefariaTextSchema:
 *   1. Validate all required fields (failing fast on invalid upstream responses).
 *   2. Use v.looseObject() so unknown Sefaria API additions pass through without
 *      breaking validation (forward-compatible).
 *   3. safeParse() returns ok:false on invalid data so the route can return 502.
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

  it("passes through unknown extra fields (looseObject — forward-compatible)", () => {
    const input = {
      title: { en: "Daf Yomi", he: "דף יומי", extra: "new API field" },
      displayValue: { en: "Bava Kamma 12", he: "בבא קמא יב", extraField: 42 },
      unknownTopLevel: "new API addition",
    };
    const result = safeParse(SefariaCalendarItemSchema, input);
    // looseObject: must succeed and preserve extra fields for forward-compatibility
    expect(result.ok).toBe(true);
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

  it("passes through extra top-level fields (looseObject — forward-compatible)", () => {
    const input = {
      calendar_items: [
        {
          title: { en: "Daf Yomi" },
          displayValue: { en: "Bava Kamma 12" },
        },
      ],
      date: "2025-01-01", // new API field — preserved in looseObject
    };
    const result = safeParse(SefariaCalendarSchema, input);
    // looseObject: must succeed (extra fields are fine)
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for empty calendar_items (strict error path triggers 502)", () => {
    // An empty array means Sefaria returned no data — treat as invalid
    const result = safeParse(SefariaCalendarSchema, { calendar_items: [] });
    // minLength(1) enforced: empty array is invalid
    expect(result.ok).toBe(false);
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

  it("passes through unknown extra fields (looseObject — forward-compatible)", () => {
    const input = {
      ref: "Berakhot 2a",
      he: "text",
      unknownField: "new API field",
      anotherExtra: 123,
    };
    const result = safeParse(SefariaTextSchema, input);
    // looseObject: must succeed and preserve extra fields
    expect(result.ok).toBe(true);
  });

  it("rejects when ref field is missing", () => {
    const result = safeParse(SefariaTextSchema, { he: "text" });
    expect(result.ok).toBe(false);
  });

  it("passes through unknown fields in versions items (looseObject)", () => {
    const input = {
      ref: "Berakhot 2a",
      versions: [{ text: "Version 1", extraInVersion: "new API field" }],
    };
    const result = safeParse(SefariaTextSchema, input);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for missing ref (route must return 502)", () => {
    const result = safeParse(SefariaTextSchema, { he: "some text", text: "some text" });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for null input", () => {
    expect(safeParse(SefariaTextSchema, null).ok).toBe(false);
  });
});
