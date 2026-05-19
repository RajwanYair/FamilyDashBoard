/**
 * Tests for provider-toast ( / Roadmap ).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));

import { showToast } from "@/ui/toast";
import {
  notifyProviderBlocked,
  notifyProviderDegraded,
  initProviderDegradationToasts,
  _resetProviderToast,
} from "@/core/provider-toast";
import { recordProviderFailure, _resetProviderHealth } from "@/core/provider";

describe("provider-toast ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProviderToast();
  });

  it("surfaces a toast on first call for a provider", () => {
    const surfaced = notifyProviderBlocked("currency", "Currency Exchange Rates", 1_000_000);
    expect(surfaced).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showToast).mock.calls[0]?.[0]).toContain("Currency Exchange Rates");
  });

  it("rate-limits subsequent calls within 10 minutes", () => {
    notifyProviderBlocked("currency", "Currency", 1_000_000);
    const surfaced = notifyProviderBlocked("currency", "Currency", 1_000_000 + 60_000);
    expect(surfaced).toBe(false);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("re-surfaces after the rate-limit window elapses", () => {
    notifyProviderBlocked("currency", "Currency", 1_000_000);
    const surfaced = notifyProviderBlocked("currency", "Currency", 1_000_000 + 11 * 60_000);
    expect(surfaced).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("rate-limits per provider id independently", () => {
    notifyProviderBlocked("currency", "Currency", 1_000_000);
    const surfaced = notifyProviderBlocked("weather", "Weather", 1_000_000);
    expect(surfaced).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("uses Date.now() when no timestamp is provided", () => {
    const surfaced = notifyProviderBlocked("stocks", "Stocks");
    expect(surfaced).toBe(true);
  });

  it("_resetProviderToast clears state", () => {
    notifyProviderBlocked("currency", "Currency", 1_000_000);
    _resetProviderToast();
    const surfaced = notifyProviderBlocked("currency", "Currency", 1_000_000);
    expect(surfaced).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(2);
  });
});

describe("notifyProviderDegraded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProviderToast();
  });

  it("surfaces a degradation toast on first call", () => {
    const surfaced = notifyProviderDegraded("weather", 1_000_000);
    expect(surfaced).toBe(true);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showToast).mock.calls[0]?.[0]).toContain("weather");
  });

  it("rate-limits degradation toasts", () => {
    notifyProviderDegraded("weather", 1_000_000);
    const surfaced = notifyProviderDegraded("weather", 1_000_000 + 60_000);
    expect(surfaced).toBe(false);
  });
});

describe("initProviderDegradationToasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProviderToast();
    _resetProviderHealth();
  });

  it("fires degradation toast when provider transitions to degraded", () => {
    initProviderDegradationToasts();
    recordProviderFailure("api"); // consecutiveFails=1 → degraded
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showToast).mock.calls[0]?.[0]).toContain("api");
  });

  it("fires blocked toast when provider transitions to down", () => {
    initProviderDegradationToasts();
    recordProviderFailure("api"); // degraded
    vi.clearAllMocks();
    recordProviderFailure("api"); // still degraded (consecutiveFails=2)
    recordProviderFailure("api"); // down (consecutiveFails=3)
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showToast).mock.calls[0]?.[0]).toContain("חסום");
  });
});
