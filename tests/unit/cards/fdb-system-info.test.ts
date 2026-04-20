/**
 * Tests for FdbSystemInfoCard (Stream B2)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FdbSystemInfoCard } from "@/cards/system-info/fdb-system-info";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/core/diag", () => ({ diagLog: vi.fn() }));

vi.mock("@/cards/system-info/system-info", () => ({
  initSystemInfoCard: vi.fn(),
  destroySystemInfoCard: vi.fn(),
  renderSystemInfo: vi.fn(),
  systemInfoCard: { id: "system-info", defaultSize: "md", configSchema: [] },
  formatHeapMb: vi.fn(),
  gpuShortName: vi.fn(),
  getConnectionInfo: vi.fn(),
  getViewportSize: vi.fn(),
  formatBytes: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mountCard(): FdbSystemInfoCard {
  const card = document.createElement("fdb-system-info") as FdbSystemInfoCard;
  card.setAttribute("data-card-id", "system-info");
  document.body.appendChild(card);
  return card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FdbSystemInfoCard", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("calls initSystemInfoCard on connect", async () => {
    const { initSystemInfoCard } = await import(
      "@/cards/system-info/system-info"
    );
    mountCard();
    expect(initSystemInfoCard).toHaveBeenCalled();
  });

  it("calls destroySystemInfoCard on disconnect", async () => {
    const { destroySystemInfoCard } = await import(
      "@/cards/system-info/system-info"
    );
    const card = mountCard();
    card.remove();
    expect(destroySystemInfoCard).toHaveBeenCalled();
  });

  it("is registered as the fdb-system-info custom element", () => {
    expect(customElements.get("fdb-system-info")).toBeDefined();
  });
});
