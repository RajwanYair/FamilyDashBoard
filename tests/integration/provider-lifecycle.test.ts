/**
 * Integration: provider adapter lifecycle
 * Tests that provider health tracking + latency recording + backoff work together.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordProviderSuccess,
  recordProviderFailure,
  getProviderHealth,
  getAllProviderHealth,
  _resetProviderHealth,
  getBackoffMs,
  recordProviderLatency,
  getProviderLatency,
} from "@/core/provider";

describe("Provider adapter lifecycle ", () => {
  beforeEach(() => {
    _resetProviderHealth();
  });

  it("full lifecycle: success → latency → failure → backoff → recovery", () => {
    // 1. Initial success
    recordProviderSuccess("test-api");
    recordProviderLatency("test-api", 120);
    expect(getProviderHealth("test-api").status).toBe("ok");
    expect(getProviderLatency("test-api")).toEqual([120]);

    // 2. Failures degrade status
    recordProviderFailure("test-api");
    recordProviderLatency("test-api", 8000); // timeout
    expect(getProviderHealth("test-api").status).toBe("degraded");

    recordProviderFailure("test-api");
    recordProviderFailure("test-api");
    expect(getProviderHealth("test-api").status).toBe("down");

    // 3. Backoff grows exponentially
    const bo = getBackoffMs("test-api", 2000);
    expect(bo).toBeGreaterThan(2000);

    // 4. Recovery on success
    recordProviderSuccess("test-api");
    recordProviderLatency("test-api", 95);
    expect(getProviderHealth("test-api").status).toBe("ok");
    expect(getBackoffMs("test-api")).toBe(0);
    expect(getProviderLatency("test-api")).toHaveLength(3);
  });

  it("multiple providers tracked independently", () => {
    recordProviderSuccess("weather");
    recordProviderFailure("stocks");
    recordProviderFailure("stocks");
    recordProviderFailure("stocks");

    const all = getAllProviderHealth();
    const weather = all.find((h) => h.id === "weather")!;
    const stocks = all.find((h) => h.id === "stocks")!;

    expect(weather.status).toBe("ok");
    expect(stocks.status).toBe("down");
  });

  it("latency history isolated per provider", () => {
    recordProviderLatency("a", 100);
    recordProviderLatency("b", 200);
    recordProviderLatency("a", 150);

    expect(getProviderLatency("a")).toEqual([100, 150]);
    expect(getProviderLatency("b")).toEqual([200]);
  });
});
