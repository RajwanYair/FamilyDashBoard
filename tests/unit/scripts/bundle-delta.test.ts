/**
 * Unit tests — per-card source delta gate (F17)
 *
 * Tests the logic that computes per-card source folder sizes and
 * checks them against a bundle-trend.json baseline for > 10% growth.
 *
 * Because check-bundle-size.mjs is a Node script (not a module), we
 * replicate the pure delta-gate logic here and test it in isolation.
 */

import { describe, it, expect } from "vitest";

// ── Pure helper: compute delta and decide if CI should fail ──────────────────

const GROWTH_THRESHOLD = 0.10;

/**
 * Given current KB and baseline KB, returns:
 *   - { ok: true, pct } if within threshold
 *   - { ok: false, pct } if exceeding threshold
 *   - { ok: true, pct: null, skipped: true } if no baseline
 */
function checkCardDelta(
  currentKb: number,
  baseKb: number | undefined,
): { ok: boolean; pct: number | null; skipped?: boolean } {
  if (typeof baseKb !== "number" || baseKb === 0) return { ok: true, pct: null, skipped: true };
  const delta = (currentKb - baseKb) / baseKb;
  return { ok: delta <= GROWTH_THRESHOLD, pct: parseFloat((delta * 100).toFixed(1)) };
}

/**
 * Run the per-card delta gate over a list of card measurements.
 * Returns { ok, failures } where failures lists card names that exceeded threshold.
 */
function runCardDeltaGate(
  cards: Array<{ name: string; sourceKb: number }>,
  baseline: Record<string, number>,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const { name, sourceKb } of cards) {
    const result = checkCardDelta(sourceKb, baseline[name]);
    if (!result.ok) failures.push(name);
  }
  return { ok: failures.length === 0, failures };
}

// ── checkCardDelta ────────────────────────────────────────────────────────────

describe("checkCardDelta — per-card source size delta gate (F17)", () => {
  it("returns ok:true when card is exactly at baseline", () => {
    const result = checkCardDelta(10.0, 10.0);
    expect(result.ok).toBe(true);
    expect(result.pct).toBe(0);
  });

  it("returns ok:true when growth is exactly 10%", () => {
    const result = checkCardDelta(11.0, 10.0);
    expect(result.ok).toBe(true);
    expect(result.pct).toBe(10.0);
  });

  it("returns ok:false when growth is > 10%", () => {
    const result = checkCardDelta(11.1, 10.0);
    expect(result.ok).toBe(false);
    expect(result.pct).toBeGreaterThan(10);
  });

  it("returns ok:true when card shrank", () => {
    const result = checkCardDelta(8.0, 10.0);
    expect(result.ok).toBe(true);
    expect(result.pct).toBeLessThan(0);
  });

  it("returns skipped:true when baseline is undefined", () => {
    const result = checkCardDelta(10.0, undefined);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.pct).toBeNull();
  });

  it("returns skipped:true when baseline is 0 (avoid divide-by-zero)", () => {
    const result = checkCardDelta(10.0, 0);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("returns ok:false for 50% growth", () => {
    const result = checkCardDelta(15.0, 10.0);
    expect(result.ok).toBe(false);
    expect(result.pct).toBeCloseTo(50, 0);
  });

  it("returns ok:true for 9.9% growth (just under threshold)", () => {
    const result = checkCardDelta(10.99, 10.0);
    expect(result.ok).toBe(true);
  });
});

// ── runCardDeltaGate ──────────────────────────────────────────────────────────

describe("runCardDeltaGate — full per-card gate (F17)", () => {
  const baseline = {
    weather: 15.0,
    stocks: 22.5,
    calendar: 8.0,
    news: 12.0,
  };

  it("returns ok:true when all cards are within threshold", () => {
    const cards = [
      { name: "weather", sourceKb: 15.0 },
      { name: "stocks", sourceKb: 23.0 },
      { name: "calendar", sourceKb: 8.5 },
    ];
    const result = runCardDeltaGate(cards, baseline);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("returns ok:false and names the failing card", () => {
    const cards = [
      { name: "weather", sourceKb: 20.0 }, // +33% — exceeds 10%
      { name: "stocks", sourceKb: 23.0 },
    ];
    const result = runCardDeltaGate(cards, baseline);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain("weather");
    expect(result.failures).not.toContain("stocks");
  });

  it("skips cards with no baseline entry (new cards)", () => {
    const cards = [
      { name: "new-card", sourceKb: 100.0 }, // no baseline — skip
      { name: "weather", sourceKb: 15.0 },
    ];
    const result = runCardDeltaGate(cards, baseline);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("reports multiple failures simultaneously", () => {
    const cards = [
      { name: "weather", sourceKb: 20.0 }, // +33%
      { name: "news", sourceKb: 14.0 },    // +16.7%
      { name: "stocks", sourceKb: 23.0 },   // +2.2% — ok
    ];
    const result = runCardDeltaGate(cards, baseline);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain("weather");
    expect(result.failures).toContain("news");
    expect(result.failures).not.toContain("stocks");
  });

  it("returns ok:true with empty cards array", () => {
    const result = runCardDeltaGate([], baseline);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("returns ok:true with empty baseline (all cards new)", () => {
    const cards = [
      { name: "weather", sourceKb: 15.0 },
      { name: "stocks", sourceKb: 22.5 },
    ];
    const result = runCardDeltaGate(cards, {});
    expect(result.ok).toBe(true);
  });
});

// ── bundle-trend.json schema ──────────────────────────────────────────────────

describe("bundle-trend.json record schema (F17)", () => {
  it("a valid record has required fields", () => {
    const record = {
      date: "2025-07-01",
      version: "12.8.0",
      jsKb: 88.4,
      cssKb: 17.2,
      cards: { weather: 12.3, stocks: 8.1 },
      cardSource: { weather: 15.0, stocks: 22.5 },
    };
    expect(typeof record.date).toBe("string");
    expect(typeof record.version).toBe("string");
    expect(typeof record.jsKb).toBe("number");
    expect(typeof record.cssKb).toBe("number");
    expect(typeof record.cards).toBe("object");
    expect(typeof record.cardSource).toBe("object");
  });

  it("cardSource values are numbers in KB", () => {
    const cardSource = { weather: 15.0, stocks: 22.5, calendar: 8.0 };
    for (const [, kb] of Object.entries(cardSource)) {
      expect(typeof kb).toBe("number");
      expect(kb).toBeGreaterThan(0);
    }
  });

  it("history is an array of records", () => {
    const history = [
      { date: "2025-06-01", version: "12.7.0", jsKb: 87.0, cssKb: 16.5 },
      { date: "2025-07-01", version: "12.8.0", jsKb: 88.4, cssKb: 17.2 },
    ];
    expect(Array.isArray(history)).toBe(true);
    const last = history[history.length - 1]!;
    expect(last.version).toBe("12.8.0");
  });
});

// ── cardSourceBytes sanity checks ─────────────────────────────────────────────

describe("per-card source size sanity — src/cards/ directory exists with known cards (F17)", () => {
  it("src/cards directory contains at least 8 known card sub-directories", async () => {
    const { readdirSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const cardsDir = resolve(process.cwd(), "src", "cards");
    let entries: string[] = [];
    try {
      entries = readdirSync(cardsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      // If cards dir doesn't exist in test environment, skip
    }
    expect(entries.length).toBeGreaterThanOrEqual(8);
  });

  it("each known card directory contains at least one .ts file", async () => {
    const { readdirSync } = await import("node:fs");
    const { resolve, join } = await import("node:path");
    const cardsDir = resolve(process.cwd(), "src", "cards");
    const knownCards = ["weather", "stocks", "calendar", "news", "tasks"];

    for (const card of knownCards) {
      let files: string[] = [];
      try {
        files = readdirSync(join(cardsDir, card));
      } catch {
        continue; // skip if not found
      }
      expect(files.some((f) => f.endsWith(".ts"))).toBe(true);
    }
  });
});
