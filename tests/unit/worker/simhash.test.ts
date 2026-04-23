import { describe, it, expect } from "vitest";
import { simHash, hammingDistance, isNearDuplicate } from "../../../worker/src/utils/simhash";

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
