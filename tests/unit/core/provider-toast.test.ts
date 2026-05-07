/**
 * Tests for provider-toast ( / Roadmap ).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/ui/toast", () => ({ showToast: vi.fn() }));

import { showToast } from "@/ui/toast";
import { notifyProviderBlocked, _resetProviderToast } from "@/core/provider-toast";

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
