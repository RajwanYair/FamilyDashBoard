/**
 * Sprint 126 — Integration: Cache dashboard + error rate combined stats
 *
 * Verifies that the cache dashboard and error rate utilities work together
 * to provide a coherent system health snapshot.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { cSet, cGet, cClear, cacheDashboard, resetCacheStats } from "@/core/cache";
import { recordError, clearErrors, errorRate, getErrorCount } from "@/core/error-tracker";
import { checkAllVitalBudgets } from "@/core/perf";
import { _resetPerfObserver } from "@/core/perf";

describe("System health snapshot (Sprint 126)", () => {
  beforeEach(() => {
    cClear();
    resetCacheStats();
    clearErrors();
    _resetPerfObserver();
  });

  it("assembles a complete health report", () => {
    // Simulate some activity
    cSet("weather", { temp: 22 });
    cSet("news", [{ title: "headline" }]);
    cGet("weather", 60_000); // hit
    cGet("missing", 60_000); // miss

    recordError("test error");

    const cd = cacheDashboard();
    expect(cd.memEntries).toBe(2);
    expect(cd.hits).toBe(1);
    expect(cd.misses).toBe(1);

    expect(getErrorCount()).toBe(1);
    expect(errorRate()).toBeGreaterThanOrEqual(1);

    const budgets = checkAllVitalBudgets();
    expect(budgets.length).toBe(6);
    // All pending on fresh state
    for (const b of budgets) {
      expect(b.status).toBe("pending");
    }
  });

  it("clean state produces zero health metrics", () => {
    const cd = cacheDashboard();
    expect(cd.memEntries).toBe(0);
    expect(cd.lsEntries).toBe(0);
    expect(cd.hits).toBe(0);
    expect(cd.misses).toBe(0);
    expect(getErrorCount()).toBe(0);
    expect(errorRate()).toBe(0);
  });
});
