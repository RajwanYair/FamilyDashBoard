/**
 * Tests for FdbAlertsCard (Stream B2)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbAlertsCard } from "@/cards/alerts/fdb-alerts";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/cards/alerts/alerts", () => ({
  initAlertsCard: vi.fn(),
  destroyAlertsCard: vi.fn(),
  alertsConfigSchema: [],
  isAlertsEnabled: vi.fn(() => true),
  setAlertsRealtime: vi.fn(),
  _resetAlertsForTest: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountCard(): FdbAlertsCard {
  const card = document.createElement("fdb-alerts") as FdbAlertsCard;
  card.setAttribute("data-card-id", "alerts");
  document.body.appendChild(card);
  return card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbAlertsCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls initAlertsCard on connect", async () => {
    const { initAlertsCard } = await import("@/cards/alerts/alerts");
    mountCard();
    expect(initAlertsCard).toHaveBeenCalled();
  });

  it("calls destroyAlertsCard on disconnect", async () => {
    const { destroyAlertsCard } = await import("@/cards/alerts/alerts");
    const card = mountCard();
    card.remove();
    expect(destroyAlertsCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-alerts custom element", () => {
    expect(customElements.get("fdb-alerts")).toBeDefined();
  });

  it("does not re-register when already defined (if-FALSE branch)", async () => {
    // Element is already registered from the module-level import above.
    // Re-importing the module after resetModules() will find it already registered
    // and skip the customElements.define call (covers the FALSE branch of line 26).
    vi.resetModules();
    await import("@/cards/alerts/fdb-alerts");
    // Still defined — no error about duplicate registration
    expect(customElements.get("fdb-alerts")).toBeDefined();
  });
});
