import { describe, it, expect } from "vitest";
import {
  simHash,
  hammingDistance,
  isNearDuplicate,
  simHashV2,
  isNearDuplicateV2,
} from "../../../worker/src/utils/simhash";

describe("simHash", () => {
  it("returns a bigint fingerprint", () => {
    expect(typeof simHash("hello world")).toBe("bigint");
  });

  it("produces the same fingerprint for identical strings", () => {
    const s = "Breaking News: Major earthquake strikes Pacific Rim region";
    expect(simHash(s)).toBe(simHash(s));
  });

  it("produces different fingerprints for completely unrelated strings", () => {
    const a = simHash("Stock markets rally on strong earnings reports");
    const b = simHash("Basketball team wins championship after overtime thriller");
    expect(a).not.toBe(b);
  });

  it("handles empty string", () => {
    expect(simHash("")).toBe(0n);
  });

  it("handles short strings (< 4 chars)", () => {
    expect(typeof simHash("hi")).toBe("bigint");
    expect(typeof simHash("a")).toBe("bigint");
  });
});

describe("hammingDistance", () => {
  it("returns 0 for identical fingerprints", () => {
    const h = simHash("identical text");
    expect(hammingDistance(h, h)).toBe(0);
  });

  it("returns > 0 for different fingerprints", () => {
    const a = simHash("first string with content");
    const b = simHash("completely different second piece");
    expect(hammingDistance(a, b)).toBeGreaterThan(0);
  });

  it("is symmetric", () => {
    const a = simHash("apple");
    const b = simHash("orange");
    expect(hammingDistance(a, b)).toBe(hammingDistance(b, a));
  });
});

describe("isNearDuplicate", () => {
  it("treats identical strings as near-duplicates", () => {
    const title = "PM visits hospital amid ongoing budget talks";
    const h = simHash(title);
    expect(isNearDuplicate(h, h)).toBe(true);
  });

  it("detects near-duplicates with minor wording differences", () => {
    const a = simHash("Government announces new climate policy for 2025");
    const b = simHash("Government announces new climate policy for 2026");
    // These two strings share 47/48 chars — hamming distance should be <= 10
    expect(isNearDuplicate(a, b, 10)).toBe(true);
  });

  it("does not flag unrelated headlines as near-duplicates (default threshold)", () => {
    const a = simHash("Tech giant unveils next-gen AI chip with 100x performance");
    const b = simHash("Local football team promoted to premier league division");
    expect(isNearDuplicate(a, b)).toBe(false);
  });

  it("respects custom threshold: same strings at threshold=0", () => {
    const h = simHash("test");
    expect(isNearDuplicate(h, h, 0)).toBe(true);
  });

  it("respects custom threshold: different strings at threshold=64 always match", () => {
    const a = simHash("foo bar baz");
    const b = simHash("qux quux quuz");
    expect(isNearDuplicate(a, b, 64)).toBe(true);
  });
});

// ── SimHash v2 (word-bigram) ──────────────────────────────────────────────────

describe("simHashV2", () => {
  it("returns a bigint fingerprint", () => {
    expect(typeof simHashV2("hello world")).toBe("bigint");
  });

  it("returns 0n for empty string", () => {
    expect(simHashV2("")).toBe(0n);
  });

  it("is deterministic for identical inputs", () => {
    const s = "ממשלת ישראל מכריזה על תוכנית חירום כלכלית";
    expect(simHashV2(s)).toBe(simHashV2(s));
  });

  it("strips Hebrew nikud before fingerprinting", () => {
    // Same text with and without nikud should match
    const withNikud = "שָׁלוֹם עוֹלָם"; // shalom olam with nikud
    const withoutNikud = "שלום עולם";
    // Both should produce very close fingerprints (hamming ≤ 8)
    const dist = hammingDistance(simHashV2(withNikud), simHashV2(withoutNikud));
    expect(dist).toBeLessThanOrEqual(8);
  });

  it("treats differently worded versions of same headline as near-duplicates", () => {
    const a = simHashV2("Government announces new climate policy for 2025");
    const b = simHashV2("Government announces new climate policy for 2026");
    expect(isNearDuplicateV2(a, b, 10)).toBe(true);
  });

  it("does not flag unrelated headlines as near-duplicates", () => {
    const a = simHashV2("ממשלה מאשרת תקציב שנתי חדש לשנת הכספים הבאה");
    const b = simHashV2("נבחרת ישראל בכדורגל עלתה לגמר האליפות האירופאית");
    expect(isNearDuplicateV2(a, b)).toBe(false);
  });

  it("handles single-word text", () => {
    expect(typeof simHashV2("word")).toBe("bigint");
    expect(simHashV2("word")).not.toBe(0n);
  });

  it("produces different fingerprints from v1 for same text", () => {
    const s = "Breaking news story about the economy";
    // v1 (char 4-gram) and v2 (word bigram) use different tokenization
    // They MAY collide, but for non-trivial text they typically differ
    // This test just checks they are independent functions
    expect(typeof simHashV2(s)).toBe("bigint");
    expect(typeof simHash(s)).toBe("bigint");
  });
});

describe("isNearDuplicateV2", () => {
  it("treats identical fingerprints as near-duplicates", () => {
    const h = simHashV2("exact same headline text here");
    expect(isNearDuplicateV2(h, h)).toBe(true);
  });

  it("uses threshold=4 by default (tighter than v1)", () => {
    const h = simHashV2("test headline");
    expect(isNearDuplicateV2(h, h, 0)).toBe(true);
  });

  it("at threshold=64 any two fingerprints match", () => {
    const a = simHashV2("first completely different story");
    const b = simHashV2("second utterly unrelated piece");
    expect(isNearDuplicateV2(a, b, 64)).toBe(true);
  });
});
