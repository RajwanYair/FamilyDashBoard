/**
 * Tests for provider health model (Sprint 45).
 * src/core/provider.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordProviderSuccess,
  recordProviderFailure,
  getProviderHealth,
  getAllProviderHealth,
  _resetProviderHealth,
  getBackoffMs,
  shouldBackoff,
  recordProviderLatency,
  getProviderLatency,
  getAllProviderLatencies,
} from "@/core/provider";

beforeEach(() => {
  _resetProviderHealth();
});

describe("getProviderHealth — default record", () => {
  it("returns ok status for unknown provider", () => {
    const h = getProviderHealth("unknown");
    expect(h.status).toBe("ok");
    expect(h.successCount).toBe(0);
    expect(h.failureCount).toBe(0);
    expect(h.consecutiveFails).toBe(0);
    expect(h.lastOkAt).toBeNull();
  });

  it("returns a copy, not the internal reference", () => {
    const h1 = getProviderHealth("p1");
    h1.successCount = 999;
    const h2 = getProviderHealth("p1");
    expect(h2.successCount).toBe(0); // internal not mutated
  });
});

describe("recordProviderSuccess", () => {
  it("increments successCount", () => {
    recordProviderSuccess("open-meteo");
    expect(getProviderHealth("open-meteo").successCount).toBe(1);
    recordProviderSuccess("open-meteo");
    expect(getProviderHealth("open-meteo").successCount).toBe(2);
  });

  it("resets consecutiveFails and sets status ok", () => {
    recordProviderFailure("open-meteo");
    recordProviderFailure("open-meteo");
    expect(getProviderHealth("open-meteo").status).toBe("degraded");
    recordProviderSuccess("open-meteo");
    const h = getProviderHealth("open-meteo");
    expect(h.consecutiveFails).toBe(0);
    expect(h.status).toBe("ok");
  });

  it("sets lastOkAt to ISO string", () => {
    recordProviderSuccess("open-meteo");
    const h = getProviderHealth("open-meteo");
    expect(typeof h.lastOkAt).toBe("string");
    expect(h.lastOkAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("recordProviderFailure", () => {
  it("increments failureCount", () => {
    recordProviderFailure("yahoo");
    expect(getProviderHealth("yahoo").failureCount).toBe(1);
  });

  it("status becomes degraded after 1 failure", () => {
    recordProviderFailure("yahoo");
    expect(getProviderHealth("yahoo").status).toBe("degraded");
  });

  it("status becomes degraded after 2 consecutive failures", () => {
    recordProviderFailure("yahoo");
    recordProviderFailure("yahoo");
    expect(getProviderHealth("yahoo").status).toBe("degraded");
  });

  it("status becomes down after 3+ consecutive failures", () => {
    recordProviderFailure("yahoo");
    recordProviderFailure("yahoo");
    recordProviderFailure("yahoo");
    expect(getProviderHealth("yahoo").status).toBe("down");
    recordProviderFailure("yahoo");
    expect(getProviderHealth("yahoo").status).toBe("down");
  });

  it("consecutiveFails resets after success", () => {
    recordProviderFailure("yahoo");
    recordProviderFailure("yahoo");
    recordProviderFailure("yahoo");
    recordProviderSuccess("yahoo");
    recordProviderFailure("yahoo");
    expect(getProviderHealth("yahoo").consecutiveFails).toBe(1);
    expect(getProviderHealth("yahoo").status).toBe("degraded");
  });
});

describe("getAllProviderHealth", () => {
  it("returns empty array when no providers recorded", () => {
    expect(getAllProviderHealth()).toHaveLength(0);
  });

  it("returns all tracked providers", () => {
    recordProviderSuccess("a");
    recordProviderFailure("b");
    const all = getAllProviderHealth();
    expect(all.map((h) => h.id).sort()).toEqual(["a", "b"]);
  });

  it("returns copies, not internal references", () => {
    recordProviderSuccess("a");
    const all = getAllProviderHealth();
    all[0]!.successCount = 999;
    expect(getProviderHealth("a").successCount).toBe(1);
  });
});

describe("_resetProviderHealth", () => {
  it("clears all records", () => {
    recordProviderSuccess("a");
    recordProviderFailure("b");
    _resetProviderHealth();
    expect(getAllProviderHealth()).toHaveLength(0);
  });
});

// ── Sprint 96: Backoff policy ──────────────────────────────────────────────

describe("getBackoffMs (Sprint 96)", () => {
  it("returns 0 when no failures", () => {
    recordProviderSuccess("bo");
    expect(getBackoffMs("bo")).toBe(0);
  });

  it("returns baseMs after 1 failure", () => {
    recordProviderFailure("bo");
    expect(getBackoffMs("bo", 2000)).toBe(2000);
  });

  it("doubles for each consecutive failure", () => {
    recordProviderFailure("bo");
    recordProviderFailure("bo");
    expect(getBackoffMs("bo", 2000)).toBe(4000);
    recordProviderFailure("bo");
    expect(getBackoffMs("bo", 2000)).toBe(8000);
  });

  it("caps at maxMs", () => {
    for (let i = 0; i < 20; i++) recordProviderFailure("bo");
    expect(getBackoffMs("bo", 2000, 60_000)).toBe(60_000);
  });

  it("resets to 0 after success", () => {
    recordProviderFailure("bo");
    recordProviderFailure("bo");
    recordProviderSuccess("bo");
    expect(getBackoffMs("bo")).toBe(0);
  });
});

describe("shouldBackoff (Sprint 96)", () => {
  it("returns false when no failures", () => {
    expect(shouldBackoff("sb", Date.now())).toBe(false);
  });

  it("returns true within backoff window", () => {
    recordProviderFailure("sb");
    // Last attempt was just now, backoff = 2s
    expect(shouldBackoff("sb", Date.now(), 2000)).toBe(true);
  });

  it("returns false after backoff window elapsed", () => {
    recordProviderFailure("sb");
    // Last attempt was 10s ago, backoff = 2s
    expect(shouldBackoff("sb", Date.now() - 10_000, 2000)).toBe(false);
  });
});

// ── Sprint 170: Provider latency histogram ─────────────────────────────────

describe("recordProviderLatency (Sprint 170)", () => {
  it("records latency samples", () => {
    recordProviderLatency("p1", 120.456);
    recordProviderLatency("p1", 85.2);
    const hist = getProviderLatency("p1");
    expect(hist).toEqual([120.5, 85.2]);
  });

  it("returns empty array for unknown provider", () => {
    expect(getProviderLatency("unknown")).toEqual([]);
  });

  it("caps at 20 samples (FIFO)", () => {
    for (let i = 0; i < 25; i++) recordProviderLatency("p2", i * 10);
    const hist = getProviderLatency("p2");
    expect(hist.length).toBe(20);
    expect(hist[0]).toBe(50); // first 5 shifted out
  });

  it("getAllProviderLatencies returns all providers", () => {
    recordProviderLatency("a", 100);
    recordProviderLatency("b", 200);
    const all = getAllProviderLatencies();
    expect(all.size).toBe(2);
    expect(all.get("a")).toEqual([100]);
    expect(all.get("b")).toEqual([200]);
  });

  it("reset clears latency history", () => {
    recordProviderLatency("c", 50);
    _resetProviderHealth();
    expect(getProviderLatency("c")).toEqual([]);
  });
});
