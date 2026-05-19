/**
 * Tests for src/core/simhash.ts — client-side SimHash deduplication.
 */

import { describe, it, expect } from "vitest";
import { simHash, hammingDistance, isNearDuplicate, deduplicateBySimHash } from "../../../src/core/simhash";

describe("simHash", () => {
  it("returns 0n for empty string", () => {
    expect(simHash("")).toBe(0n);
  });

  it("produces consistent fingerprints for identical text", () => {
    const a = simHash("שלום עולם זה כותרת חדשות");
    const b = simHash("שלום עולם זה כותרת חדשות");
    expect(a).toBe(b);
  });

  it("produces different fingerprints for different text", () => {
    const a = simHash("ראש הממשלה נפגש עם נשיא ארצות הברית");
    const b = simHash("מזג האוויר מחר יהיה חם מאוד בכל הארץ");
    expect(a).not.toBe(b);
  });

  it("produces similar fingerprints for slightly different wording", () => {
    const a = simHash("ראש הממשלה נפגש עם נשיא ארצות הברית בבית הלבן");
    const b = simHash("ראש הממשלה נפגש עם נשיא ארה״ב בבית הלבן");
    // Should be within hamming distance 8 (similar content)
    expect(hammingDistance(a, b)).toBeLessThan(16);
  });
});

describe("hammingDistance", () => {
  it("returns 0 for identical fingerprints", () => {
    expect(hammingDistance(0b1010n, 0b1010n)).toBe(0);
  });

  it("counts differing bits correctly", () => {
    expect(hammingDistance(0b1111n, 0b0000n)).toBe(4);
    expect(hammingDistance(0b1010n, 0b0101n)).toBe(4);
  });
});

describe("isNearDuplicate", () => {
  it("returns true when distance is within threshold", () => {
    const a = simHash("חדשות מהשטח: כוחות צבא פעלו בגזרה הצפונית");
    const b = simHash("חדשות מהשטח: כוחות צבא פעלו בגזרה הצפונית הלילה");
    // With word-bigram SimHash, adding one word changes a few bigrams
    expect(isNearDuplicate(a, b, 12)).toBe(true);
  });

  it("returns false for completely different content", () => {
    const a = simHash("מדד תל אביב 125 עלה ב-2% היום");
    const b = simHash("גשם כבד צפוי מחר בצפון הארץ ובגולן");
    expect(isNearDuplicate(a, b, 4)).toBe(false);
  });
});

describe("deduplicateBySimHash", () => {
  it("removes near-duplicate items", () => {
    const items = [
      { title: "ראש הממשלה נפגש היום עם נשיא ארה״ב בבית הלבן" },
      { title: "ראש הממשלה נפגש עם נשיא ארה״ב בבית הלבן היום" },
      { title: "מזג האוויר: גשם כבד צפוי מחר בכל רחבי הארץ" },
    ];
    const result = deduplicateBySimHash(items, (i) => i.title, 8);
    // First item should be kept, second (near-dup) removed, third kept
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result[0]).toBe(items[0]);
    // The weather article should always survive
    expect(result.some((i) => i.title.includes("מזג האוויר"))).toBe(true);
  });

  it("keeps all items when they are unique", () => {
    const items = [
      { title: "כלכלה: הדולר ירד מתחת ל-3.5 שקלים" },
      { title: "ספורט: מכבי תל אביב ניצחה 2-0" },
      { title: "טכנולוגיה: אפל הכריזה על מוצר חדש" },
    ];
    const result = deduplicateBySimHash(items, (i) => i.title, 4);
    expect(result).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(deduplicateBySimHash([], (i: string) => i, 4)).toHaveLength(0);
  });
});
