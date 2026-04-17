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
